import { useState, useEffect } from 'react';

const API_BASE = 'https://ai-image-detector-o8bv.onrender.com';

function categoryColor(cat) {
  if (cat === 'generated') return '#dc2626';
  if (cat === 'modified')  return '#f59e0b';
  return '#22c55e';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#0c0d12', border: '1px solid #1e2030', borderRadius: '8px', padding: '20px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280', letterSpacing: '0.1em', marginBottom: '8px' }}>{label}</p>
      <p style={{ fontSize: '28px', fontFamily: 'monospace', fontWeight: 'bold', color: color || '#e8eaf0' }}>{value}</p>
    </div>
  );
}

function HistoryCard({ record, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const color = categoryColor(record.category);

  const loadDetail = async () => {
    if (detail) { setDetail(null); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/detection/${record._id}`);
      setDetail(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this detection?')) return;
    await fetch(`${API_BASE}/api/detection/${record._id}`, { method: 'DELETE' });
    onDelete(record._id);
  };

  return (
    <div style={{ background: '#0c0d12', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div onClick={loadDetail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '13px', color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.filename}</p>
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{formatDate(record.timestamp)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{
            fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontFamily: 'monospace',
            background: record.category === 'generated' ? 'rgba(220,38,38,0.12)' : record.category === 'modified' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
            color: record.category === 'generated' ? '#f87171' : record.category === 'modified' ? '#fbbf24' : '#4ade80',
            border: `1px solid ${record.category === 'generated' ? 'rgba(220,38,38,0.3)' : record.category === 'modified' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
          }}>{record.verdict || record.label}</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>{record.confidence}%</span>
          <button onClick={handleDelete} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px', padding: '2px 6px' }}>✕</button>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>{loading ? '⟳' : detail ? '▲' : '▼'}</span>
        </div>
      </div>

      {detail && (
        <div style={{ borderTop: '1px solid #1e2030', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6b7280', marginBottom: '6px' }}>ORIGINAL</p>
              <img src={`data:image/jpeg;base64,${detail.original_thumb}`} alt="original" style={{ width: '100%', borderRadius: '4px', border: '1px solid #1e2030', maxHeight: '180px', objectFit: 'cover' }} />
            </div>
            <div>
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6b7280', marginBottom: '6px' }}>ANALYZED</p>
              <img src={`data:image/png;base64,${detail.annotated_image}`} alt="analyzed" style={{ width: '100%', borderRadius: '4px', border: '1px solid #1e2030', maxHeight: '180px', objectFit: 'cover' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'AI PROB', value: `${detail.ai_probability}%`, color: '#f87171' },
              { label: 'ELA SCORE', value: detail.ela_score, color: '#e8eaf0' },
              { label: 'FREQ SCORE', value: detail.frequency_score, color: '#e8eaf0' },
              { label: 'REGIONS', value: detail.regions_detected, color: '#e8eaf0' },
            ].map(item => (
              <div key={item.label} style={{ padding: '8px', border: '1px solid #1e2030', borderRadius: '4px' }}>
                <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6b7280' }}>{item.label}</p>
                <p style={{ fontSize: '13px', fontFamily: 'monospace', color: item.color, marginTop: '2px' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryApp() {
  const [records, setRecords] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([
          fetch(`${API_BASE}/api/history?limit=50`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        const hist  = await h.json();
        const stats = await s.json();
        setRecords(hist.records || []);
        setStats(stats);
      } catch {
        setError('Could not reach the backend. It may be waking up — refresh in 30 seconds.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = (id) => setRecords(prev => prev.filter(r => r._id !== id));
  const filtered = filter === 'all' ? records : records.filter(r => r.category === filter);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '10px', color: '#6b7280', fontFamily: 'monospace', fontSize: '13px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1s infinite' }} />
      LOADING DETECTIONS...
    </div>
  );

  if (error) return (
    <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '20px', color: '#f87171', fontFamily: 'monospace', fontSize: '13px' }}>
      ⚠ {error}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
          <StatCard label="TOTAL SCANS"  value={stats.total ?? 0} />
          <StatCard label="AI GENERATED" value={stats.generated?.count ?? 0} color="#dc2626" />
          <StatCard label="AI MODIFIED"  value={stats.modified?.count ?? 0}  color="#f59e0b" />
          <StatCard label="REAL / AUTH"  value={stats.real?.count ?? 0}      color="#22c55e" />
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2030' }}>
        {['all', 'generated', 'modified', 'real'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 16px', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: filter === f ? '#dc2626' : '#6b7280',
            borderBottom: filter === f ? '2px solid #dc2626' : '2px solid transparent',
            marginBottom: '-1px', transition: 'color 0.2s',
          }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280', fontFamily: 'monospace', fontSize: '13px' }}>
          NO DETECTIONS FOUND
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(r => (
            <HistoryCard key={r._id} record={r} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
