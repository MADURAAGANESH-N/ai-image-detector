import { useState, useCallback, useRef } from 'react';

const API_BASE = 'https://ai-image-detector-o8bv.onrender.com';

function categoryColor(cat) {
  if (cat === 'generated') return '#dc2626';
  if (cat === 'modified')  return '#f59e0b';
  return '#22c55e';
}

function categoryBadgeClass(cat) {
  if (cat === 'generated') return 'badge-generated';
  if (cat === 'modified')  return 'badge-modified';
  return 'badge-real';
}

function categoryLabel(cat) {
  if (cat === 'generated') return 'AI GENERATED';
  if (cat === 'modified')  return 'AI MODIFIED';
  return 'REAL / AUTHENTIC';
}

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between mb-1" style={{ fontSize: '11px' }}>
        <span style={{ color: '#6b7280', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ color, fontFamily: 'monospace' }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: '4px', borderRadius: '2px', background: '#1e2030', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: '2px', transition: 'width 1s ease-out' }} />
      </div>
    </div>
  );
}

function DropZone({ onFile, loading }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handle = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDrop={handle}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      style={{
        border: `2px dashed ${drag ? '#dc2626' : '#1e2030'}`,
        borderRadius: '8px',
        minHeight: '260px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: drag ? 'rgba(220,38,38,0.05)' : '#0c0d12',
        transition: 'all 0.2s',
        padding: '40px',
        gap: '16px',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handle} />
      {loading ? (
        <>
          <div style={{
            width: '60px', height: '60px', border: '2px solid rgba(220,38,38,0.3)',
            borderRadius: '4px', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '2px',
              background: 'linear-gradient(90deg, transparent, #dc2626, transparent)',
              animation: 'scan 2s ease-in-out infinite'
            }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.1em' }}>ANALYZING IMAGE...</p>
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>Running forensic detection</p>
          </div>
        </>
      ) : (
        <>
          <div style={{
            width: '56px', height: '56px', border: `2px solid ${drag ? '#dc2626' : '#1e2030'}`,
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: drag ? 'rgba(220,38,38,0.1)' : 'transparent', transition: 'all 0.2s'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={drag ? '#dc2626' : '#6b7280'} strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#e8eaf0', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.05em' }}>
              {drag ? 'DROP TO ANALYZE' : 'DROP IMAGE OR CLICK TO UPLOAD'}
            </p>
            <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '6px' }}>JPG · PNG · WEBP · up to 10MB</p>
          </div>
        </>
      )}
    </div>
  );
}

function ResultPanel({ result, preview }) {
  const [tab, setTab] = useState('annotated');
  const color = categoryColor(result.category);

  return (
    <div style={{ border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden', background: '#0c0d12', animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e2030' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color, letterSpacing: '0.1em' }}>{categoryLabel(result.category)}</span>
        </div>
        <span style={{
          fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontFamily: 'monospace',
          background: result.category === 'generated' ? 'rgba(220,38,38,0.12)' : result.category === 'modified' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
          color: result.category === 'generated' ? '#f87171' : result.category === 'modified' ? '#fbbf24' : '#4ade80',
          border: `1px solid ${result.category === 'generated' ? 'rgba(220,38,38,0.3)' : result.category === 'modified' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
        }}>
          {result.confidence}% confidence
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2030' }}>
        {['annotated', 'original'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: tab === t ? '#dc2626' : '#6b7280',
            borderBottom: tab === t ? '2px solid #dc2626' : '2px solid transparent',
          }}>
            {t === 'annotated' ? 'ANALYZED' : 'ORIGINAL'}
          </button>
        ))}
      </div>

      {/* Image */}
      <div style={{ background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '280px', position: 'relative' }}>
        <img
          src={tab === 'annotated' ? `data:image/png;base64,${result.annotated_image}` : preview}
          alt={tab}
          style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }}
        />
        {tab === 'annotated' && result.regions_detected > 0 && (
          <div style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(5,5,8,0.8)', border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontFamily: 'monospace', color: '#dc2626'
          }}>
            {result.regions_detected} REGION{result.regions_detected !== 1 ? 'S' : ''} FLAGGED
          </div>
        )}
      </div>

      {/* Scores */}
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #1e2030' }}>
        <ScoreBar label="AI PROBABILITY" value={result.ai_probability / 100} color="#dc2626" />
        <ScoreBar label="AUTHENTIC SCORE" value={1 - result.ai_probability / 100} color="#22c55e" />
      </div>

      {/* Meta */}
      <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        {[
          { label: 'VERDICT', value: result.verdict, color },
          { label: 'REGIONS', value: result.regions_detected },
          { label: 'IMAGE SIZE', value: result.image_size },
        ].map(item => (
          <div key={item.label} style={{ padding: '10px', border: '1px solid #1e2030', borderRadius: '6px' }}>
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6b7280', letterSpacing: '0.05em' }}>{item.label}</p>
            <p style={{ fontSize: '13px', fontWeight: '600', color: item.color || '#e8eaf0', marginTop: '4px' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DetectorApp() {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const handleFile = useCallback((f) => {
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }, []);

  const analyze = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e.message || 'Detection failed. Backend may be waking up — try again in 30 seconds.');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
      <style>{`
        @keyframes scan { 0%,100%{top:0} 50%{top:calc(100% - 2px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DropZone onFile={handleFile} loading={loading} />

        {preview && !loading && !result && (
          <div style={{ border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden', background: '#0c0d12' }}>
            <img src={preview} alt="preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>READY TO ANALYZE</p>
                <p style={{ fontSize: '13px', color: '#e8eaf0', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</p>
              </div>
              <button onClick={analyze} style={{
                padding: '8px 20px', background: '#dc2626', color: 'white', border: 'none',
                borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
                letterSpacing: '0.1em', transition: 'background 0.2s'
              }}>
                RUN ANALYSIS
              </button>
            </div>
          </div>
        )}

        {result && (
          <button onClick={reset} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}>
            ← ANALYZE ANOTHER IMAGE
          </button>
        )}

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '16px', color: '#f87171', fontFamily: 'monospace', fontSize: '13px' }}>
            ⚠ {error}
          </div>
        )}

        {!file && (
          <div style={{ border: '1px solid #1e2030', borderRadius: '8px', padding: '20px', background: '#0c0d12' }}>
            <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#dc2626', letterSpacing: '0.1em', marginBottom: '12px' }}>HOW IT WORKS</p>
            {[
              ['01', 'Upload any image (photo, screenshot, artwork)'],
              ['02', 'ViT model + ELA + frequency analysis scans for AI artifacts'],
              ['03', 'Suspicious regions marked with circles — red or black based on background'],
              ['04', 'Results stored in MongoDB for history review'],
            ].map(([n, t]) => (
              <div key={n} style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'monospace', color: '#dc2626', fontSize: '12px', minWidth: '20px' }}>{n}</span>
                <span style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right */}
      <div>
        {result ? (
          <ResultPanel result={result} preview={preview} />
        ) : (
          <div style={{
            border: '1px solid #1e2030', borderRadius: '8px', background: '#0c0d12',
            minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'
          }}>
            <div style={{ width: '64px', height: '64px', border: '1px solid #1e2030', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'monospace', fontSize: '13px', color: '#6b7280', letterSpacing: '0.1em' }}>AWAITING INPUT</p>
              <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>Analysis results appear here</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', width: '80%' }}>
              {[
                { l: 'REAL', c: 'rgba(34,197,94,0.12)', t: '#4ade80', b: 'rgba(34,197,94,0.3)' },
                { l: 'MODIFIED', c: 'rgba(245,158,11,0.12)', t: '#fbbf24', b: 'rgba(245,158,11,0.3)' },
                { l: 'AI GEN', c: 'rgba(220,38,38,0.12)', t: '#f87171', b: 'rgba(220,38,38,0.3)' },
              ].map(item => (
                <div key={item.l} style={{ background: item.c, border: `1px solid ${item.b}`, borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '11px', fontFamily: 'monospace', color: item.t }}>
                  {item.l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
