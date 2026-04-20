import cv2
import numpy as np
from PIL import Image, ImageFilter
import io
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try importing transformers for ML-based detection
try:
    from transformers import pipeline
    import torch
    HF_AVAILABLE = True
    logger.info("HuggingFace transformers available")
except ImportError:
    HF_AVAILABLE = False
    logger.warning("HuggingFace transformers not available, using ELA-only detection")

_classifier = None


def get_classifier():
    global _classifier
    if _classifier is None and HF_AVAILABLE:
        try:
            device = 0 if torch.cuda.is_available() else -1
            _classifier = pipeline(
                "image-classification",
                model="umm-maybe/AI-image-detector",
                device=device,
            )
            logger.info("AI image detector model loaded")
        except Exception as e:
            logger.error(f"Failed to load classifier: {e}")
            _classifier = None
    return _classifier


# ─── ELA Analysis ────────────────────────────────────────────────────────────

def ela_analysis(image: Image.Image, quality: int = 92) -> np.ndarray:
    """
    Error Level Analysis — saves the image at reduced JPEG quality,
    then computes the absolute difference to reveal re-saved / AI-artifact regions.
    """
    buf = io.BytesIO()
    rgb = image.convert("RGB")
    rgb.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    compressed = Image.open(buf).convert("RGB")

    orig_arr = np.array(rgb, dtype=np.float32)
    comp_arr = np.array(compressed, dtype=np.float32)

    ela = np.abs(orig_arr - comp_arr)
    # Amplify differences
    ela = np.clip(ela * 15, 0, 255).astype(np.uint8)
    return ela


def frequency_analysis(image: Image.Image) -> float:
    """
    DCT-based frequency analysis — AI images often have unnatural high-freq patterns.
    Returns a score (0-1); higher means more suspicious.
    """
    gray = np.array(image.convert("L"), dtype=np.float32)
    # Apply DCT on 8x8 blocks and check energy distribution
    h, w = gray.shape
    h = (h // 8) * 8
    w = (w // 8) * 8
    gray = gray[:h, :w]

    blocks = gray.reshape(h // 8, 8, w // 8, 8)
    blocks = blocks.transpose(0, 2, 1, 3).reshape(-1, 8, 8)

    scores = []
    for block in blocks[:500]:  # sample 500 blocks
        dct = cv2.dct(block)
        energy_high = np.sum(np.abs(dct[4:, 4:]))
        energy_total = np.sum(np.abs(dct)) + 1e-6
        scores.append(energy_high / energy_total)

    return float(np.mean(scores))


# ─── Suspicious Region Detection ──────────────────────────────────────────────

def find_suspicious_circles(ela: np.ndarray, min_area: int = 800) -> list[tuple[int, int, int]]:
    """
    From the ELA heatmap, find regions with high error levels and fit
    minimum enclosing circles around them.
    """
    gray = cv2.cvtColor(ela, cv2.COLOR_RGB2GRAY)

    # Adaptive threshold to handle varying illumination
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 25, 255, cv2.THRESH_BINARY)

    # Morphological ops to merge nearby regions
    kernel = np.ones((7, 7), np.uint8)
    thresh = cv2.dilate(thresh, kernel, iterations=2)
    thresh = cv2.erode(thresh, kernel, iterations=1)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    circles = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area >= min_area:
            (cx, cy), radius = cv2.minEnclosingCircle(cnt)
            if radius >= 15:
                circles.append((int(cx), int(cy), int(radius) + 8))  # slight padding

    # Merge overlapping circles
    circles = merge_overlapping_circles(circles)
    return circles


def merge_overlapping_circles(circles: list) -> list:
    """Merge circles whose centers are within combined radius range."""
    if not circles:
        return []

    merged = list(circles)
    changed = True
    while changed:
        changed = False
        result = []
        used = [False] * len(merged)
        for i in range(len(merged)):
            if used[i]:
                continue
            x1, y1, r1 = merged[i]
            group = [(x1, y1, r1)]
            for j in range(i + 1, len(merged)):
                if used[j]:
                    continue
                x2, y2, r2 = merged[j]
                dist = np.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
                if dist < (r1 + r2) * 0.8:
                    group.append((x2, y2, r2))
                    used[j] = True
            if len(group) > 1:
                changed = True
            avg_x = int(np.mean([c[0] for c in group]))
            avg_y = int(np.mean([c[1] for c in group]))
            max_r = max(c[2] for c in group)
            result.append((avg_x, avg_y, max_r))
            used[i] = True
        merged = result

    return merged


# ─── Color-aware Circle Drawing ───────────────────────────────────────────────

def is_red_dominant(image: Image.Image, cx: int, cy: int, radius: int) -> bool:
    """
    Sample pixels on the circle outline to determine if the
    background is predominantly red. Returns True → use black circle.
    """
    arr = np.array(image.convert("RGB"))
    h, w = arr.shape[:2]

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), radius, 255, max(3, radius // 10))

    ys, xs = np.where(mask > 0)
    if len(ys) == 0:
        return False

    pixels = arr[ys, xs]
    avg_r = float(pixels[:, 0].mean())
    avg_g = float(pixels[:, 1].mean())
    avg_b = float(pixels[:, 2].mean())

    return avg_r > 130 and avg_r > avg_g * 1.4 and avg_r > avg_b * 1.4


def draw_detection_circles(image: Image.Image, circles: list, label: str) -> Image.Image:
    """
    Draw circles on image:
    - Red circle by default
    - Black circle if the underlying area is red-dominant
    Also renders a small label next to each circle.
    """
    img_cv = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    thickness = max(2, min(5, image.width // 300))

    for idx, (cx, cy, radius) in enumerate(circles):
        red_bg = is_red_dominant(image, cx, cy, radius)
        color = (0, 0, 0) if red_bg else (0, 0, 255)  # BGR

        # Outer glow circle (semi-transparent look via double drawing)
        cv2.circle(img_cv, (cx, cy), radius + 3, color, 1)
        cv2.circle(img_cv, (cx, cy), radius, color, thickness)

        # Crosshair lines
        cross_len = max(8, radius // 4)
        cv2.line(img_cv, (cx - cross_len, cy), (cx + cross_len, cy), color, 1)
        cv2.line(img_cv, (cx, cy - cross_len), (cx, cy + cross_len), color, 1)

        # Label
        lbl = f"#{idx + 1}"
        font_scale = max(0.4, min(0.7, radius / 60))
        lx = min(cx + radius + 5, img_cv.shape[1] - 40)
        ly = max(cy - radius, 20)
        cv2.putText(img_cv, lbl, (lx, ly), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, 1, cv2.LINE_AA)

    return Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))


# ─── Main Analysis Function ───────────────────────────────────────────────────

def analyze_image(image_bytes: bytes, filename: str = "image.jpg") -> dict:
    """
    Full pipeline:
    1. ML-based AI classification (if model available)
    2. ELA analysis for manipulation detection
    3. Frequency analysis
    4. Draw circles around suspicious regions
    5. Return structured result dict
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        orig_w, orig_h = image.size
    except Exception as e:
        raise ValueError(f"Cannot open image: {e}")

    # ── Step 1: ML Classification ──────────────────────────────────────────
    ai_prob = 0.5  # default prior
    model_used = "ELA + Frequency Analysis"

    classifier = get_classifier()
    if classifier is not None:
        try:
            results = classifier(image)
            # Model returns labels like "artificial" / "human"
            for r in results:
                lbl = r["label"].lower()
                if "artif" in lbl or "fake" in lbl or "generat" in lbl or "ai" in lbl:
                    ai_prob = float(r["score"])
                    break
                elif "human" in lbl or "real" in lbl or "natural" in lbl:
                    ai_prob = 1.0 - float(r["score"])
                    break
            model_used = "umm-maybe/AI-image-detector + ELA"
        except Exception as e:
            logger.warning(f"Classifier inference failed: {e}")

    # ── Step 2: ELA Analysis ───────────────────────────────────────────────
    ela = ela_analysis(image)
    ela_gray = cv2.cvtColor(ela, cv2.COLOR_RGB2GRAY)
    ela_mean = float(ela_gray.mean())
    ela_max = float(ela_gray.max())
    ela_score = min(1.0, ela_mean / 30.0)

    # ── Step 3: Frequency Analysis ─────────────────────────────────────────
    freq_score = frequency_analysis(image)

    # ── Step 4: Find Suspicious Regions ───────────────────────────────────
    circles = find_suspicious_circles(ela)

    # Limit circles for very small / very large images
    max_circles = 12
    circles = sorted(circles, key=lambda c: c[2], reverse=True)[:max_circles]

    # ── Step 5: Composite Score & Label ───────────────────────────────────
    # Weighted combination of signals
    composite = (
        ai_prob * 0.50
        + ela_score * 0.30
        + freq_score * 0.20
    )

    if composite >= 0.65:
        verdict = "AI Generated"
        verdict_color = "#ff4444"
        confidence = composite
    elif composite >= 0.40 or len(circles) >= 2:
        verdict = "AI Modified"
        verdict_color = "#ff8c00"
        confidence = composite
    else:
        verdict = "Real / Authentic"
        verdict_color = "#00e676"
        confidence = 1.0 - composite

    # ── Step 6: Draw Circles on Image ─────────────────────────────────────
    annotated = draw_detection_circles(image, circles, verdict)

    # Encode annotated image as base64 PNG
    buf = io.BytesIO()
    annotated.save(buf, format="PNG")
    annotated_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    # Encode ELA heatmap
    ela_img = Image.fromarray(ela)
    ela_buf = io.BytesIO()
    ela_img.save(ela_buf, format="PNG")
    ela_b64 = base64.b64encode(ela_buf.getvalue()).decode("utf-8")

    # Encode original thumbnail
    thumb = image.copy()
    if thumb.mode not in ("RGB",):
        if thumb.mode in ("RGBA", "LA", "PA"):
            bg = Image.new("RGB", thumb.size, (255, 255, 255))
            bg.paste(thumb, mask=thumb.split()[-1])
            thumb = bg
        else:
            thumb = thumb.convert("RGB")
    thumb.thumbnail((800, 800))
    thumb_buf = io.BytesIO()
    thumb.save(thumb_buf, format="JPEG", quality=85)
    original_b64 = base64.b64encode(thumb_buf.getvalue()).decode("utf-8")

    return {
        "verdict": verdict,
        "verdict_color": verdict_color,
        "confidence": round(float(confidence * 100), 2),
        "composite_score": round(float(composite), 4),
        "ai_probability": round(float(ai_prob * 100), 2),
        "ela_score": round(ela_mean, 4),
        "ela_max": round(ela_max, 4),
        "frequency_score": round(float(freq_score), 4),
        "regions_detected": len(circles),
        "image_size": f"{orig_w}x{orig_h}",
        "model_used": model_used,
        "annotated_image": annotated_b64,
        "ela_image": ela_b64,
        "original_thumb": original_b64,
        "filename": filename,
    }
