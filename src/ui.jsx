/* 期末速通 v1 · UI 组件 */

const { useState, useEffect, useMemo, useCallback, useRef } = React;

/* ===== 图标（精简到 12 个） ===== */
const I = {
  home: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  upload: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  cards: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 1h14a2 2 0 0 1 2 2v14"/></svg>,
  target: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  refresh: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>,
  error: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  arrow: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  arrowL: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  x: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  sun: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>,
  moon: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  info: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  loader: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  bell: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

/* ===== Toast 系统 ===== */
let _toastId = 0;
let _setToasts = null;

const Toast = ({ id, message, type = 'info', onClose }) => {
  useEffect(() => {
    const t = setTimeout(() => onClose(id), 3000);
    return () => clearTimeout(t);
  }, [id, onClose]);

  const icons = { success: I.check, error: I.error, warning: I.bell, info: I.info };
  const colors = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--accent)' };
  const backgrounds = { success: 'var(--success-soft)', error: 'var(--danger-soft)', warning: 'var(--warning-soft)', info: 'var(--accent-soft)' };
  const Icon = icons[type] || I.info;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      background: backgrounds[type], border: `1px solid ${colors[type]}`,
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)',
      animation: 'toastIn 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      fontSize: 13, fontWeight: 500, color: 'var(--text)', maxWidth: 360,
    }}>
      <Icon width={16} height={16} style={{ color: colors[type], flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={() => onClose(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-3)' }}>
        <I.x width={14} height={14} />
      </button>
    </div>
  );
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  const addToast = useCallback((message, type = 'info') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 暴露给全局使用
  useEffect(() => {
    window.toast = { success: (m) => addToast(m, 'success'), error: (m) => addToast(m, 'error'), warning: (m) => addToast(m, 'warning'), info: (m) => addToast(m, 'info') };
    return () => { delete window.toast; };
  }, [addToast]);

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => <Toast key={t.id} {...t} onClose={removeToast} />)}
    </div>
  );
};

// 全局 toast 函数
const showToast = (message, type = 'info') => {
  if (_setToasts) {
    const id = ++_toastId;
    _setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => _setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }
};

/* ===== 骨架屏 ===== */
const Skeleton = ({ width = '100%', height = 20, borderRadius = 'var(--radius-sm)', style = {} }) => (
  <div className="skeleton" style={{ width, height, borderRadius, ...style }} />
);

const SkeletonCard = ({ lines = 3, style = {} }) => (
  <div style={{ padding: 18, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', ...style }}>
    <Skeleton width={60} height={16} style={{ marginBottom: 12 }} />
    <Skeleton width="80%" height={18} style={{ marginBottom: 8 }} />
    {lines > 0 && <Skeleton width="100%" height={14} style={{ marginBottom: 6 }} />}
    {lines > 1 && <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />}
    {lines > 2 && <Skeleton width="60%" height={14} />}
  </div>
);

const SkeletonList = ({ count = 5, style = {} }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg-elev)' }}>
        <Skeleton width={28} height={28} borderRadius="var(--radius-sm)" />
        <div style={{ flex: 1 }}>
          <Skeleton width="70%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>
    ))}
  </div>
);

/* ===== Button ===== */
const Button = ({ variant = 'ghost', size = 'md', icon: Icon, loading = false, children, style, ...rest }) => {
  const cls = ['btn', `btn-${variant}`];
  if (size === 'sm') cls.push('btn-sm');
  if (size === 'lg') cls.push('btn-lg');
  return (
    <button className={cls.join(' ')} style={style} disabled={loading || rest.disabled} {...rest}>
      {loading ? <I.loader width={14} height={14} className="spin" /> : Icon && <Icon width={14} height={14} />}
      {children}
    </button>
  );
};

/* ===== 环形图 ===== */
const RingChart = ({ value = 0, size = 180, stroke = 12 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s' }} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="28" fontWeight="600" fill="var(--text)" fontFamily="JetBrains Mono, monospace">{value}%</text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fontSize="11" fill="var(--text-3)">掌握度</text>
    </svg>
  );
};
