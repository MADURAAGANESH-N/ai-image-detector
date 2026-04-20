# 🔍 VISIONSCAN — AI Image Forensics Detector

> Detect AI-generated and AI-modified images using Error Level Analysis, frequency decomposition, and deep-learning classification.

---

## 🏗 Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌──────────────┐
│  Astro Frontend          │ ──▶  │  FastAPI Backend (Python) │ ──▶  │   MongoDB    │
│  (Netlify)               │      │  (Render / Railway)       │      │  (Atlas)     │
└─────────────────────────┘      └──────────────────────────┘      └──────────────┘
```

- **Frontend**: Astro static site → deployed on Netlify
- **Backend**: Python FastAPI → deployed on Render.com (free tier)
- **Database**: MongoDB Atlas
- **Proxy**: Netlify rewrites `/api/*` → backend URL

---

## 🧠 Detection Pipeline

1. **ELA (Error Level Analysis)** — Compresses image at quality 92% and measures per-pixel difference. AI images and manipulated regions show abnormal error patterns.
2. **Frequency Analysis (DCT)** — Analyzes DCT coefficient energy distribution across 8×8 blocks. AI images often have unnatural high-frequency characteristics.
3. **ML Classifier** — Uses `umm-maybe/AI-image-detector` (HuggingFace ViT model) for binary AI vs. real classification.
4. **Region Marking** — Combines all signals to locate suspicious regions, fits minimum enclosing circles, and draws them in **red** (or **black** if the background is red-dominant).

---

## 🚀 Deployment Guide

### Step 1 — Backend on Render.com

1. Sign up at [render.com](https://render.com)
2. Click **New → Web Service → Connect Git Repo** (or use Docker)
3. Set **Root Directory**: `backend`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Set **Environment Variables**:
   ```
   MONGO_URI = mongodb+srv://madhuraaaganesh_db_user:RaMYA@1982@cluster0.qzhfzew.mongodb.net/
   DB_NAME   = ai_image_detector
   ALLOWED_ORIGINS = https://your-site.netlify.app
   ```
7. Deploy and copy the URL (e.g. `https://ai-image-detector-api.onrender.com`)

**Alternative: Railway.app**
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

---

### Step 2 — Update netlify.toml

Edit `netlify.toml` and replace `YOUR_BACKEND_URL` with your actual backend URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://ai-image-detector-api.onrender.com/api/:splat"
  status = 200
  force = true
```

---

### Step 3 — Frontend on Netlify

1. Push this entire repo to GitHub
2. Log in to [netlify.com](https://netlify.com) → **New site from Git**
3. Select your repo
4. Configure build:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Add environment variable in Netlify dashboard:
   ```
   PUBLIC_API_URL = https://ai-image-detector-api.onrender.com
   ```
6. Deploy!

---

## 💻 Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env → PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:4321`

---

## 📦 Project Structure

```
ai-image-detector/
├── backend/
│   ├── main.py         # FastAPI app, all routes
│   ├── detector.py     # ELA + ML analysis, circle drawing
│   ├── database.py     # MongoDB async operations (motor)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro    # Main upload + results page
│   │   │   └── history.astro  # Full history + modal viewer
│   │   └── layouts/
│   │       └── Layout.astro   # Global styles + head
│   ├── astro.config.mjs
│   └── package.json
├── netlify.toml        # Netlify build + API proxy config
├── render.yaml         # Render deployment config
└── README.md
```

---

## 🎨 Detection Verdicts

| Verdict | Meaning | Indicator Color |
|---------|---------|-----------------|
| **AI Generated** | Image fully created by AI | 🔴 Red |
| **AI Modified** | Real image with AI edits | 🟠 Orange |
| **Real / Authentic** | No AI manipulation detected | 🟢 Green |

---

## 🔴 Circle Color Logic

- Detected suspicious regions are outlined with **red circles**
- If the background pixel color under a circle is predominantly **red** (R > 130 and R > G×1.4 and R > B×1.4), the circle switches to **black** for visibility

---

## 🗃 MongoDB Schema

```json
{
  "_id": "ObjectId",
  "filename": "photo.jpg",
  "verdict": "AI Generated",
  "confidence": 87.5,
  "ai_probability": 91.2,
  "ela_score": 18.43,
  "ela_max": 255.0,
  "frequency_score": 0.312,
  "composite_score": 0.782,
  "regions_detected": 4,
  "image_size": "1024x768",
  "model_used": "umm-maybe/AI-image-detector + ELA",
  "annotated_image": "<base64>",
  "ela_image": "<base64>",
  "original_thumb": "<base64>",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Upload + analyze image |
| `GET`  | `/api/history` | Get paginated history |
| `GET`  | `/api/history/:id` | Get single analysis (with images) |
| `GET`  | `/api/stats` | Aggregate verdict statistics |
| `DELETE` | `/api/history/:id` | Delete a record |
| `GET`  | `/health` | Health check |

---

## 🔧 Model Information

The ML component uses [`umm-maybe/AI-image-detector`](https://huggingface.co/umm-maybe/AI-image-detector) — a Vision Transformer fine-tuned to distinguish AI-generated images from real photographs.

If the model is unavailable (first cold boot), the system falls back to **ELA + Frequency Analysis only**, still providing reliable detection.
