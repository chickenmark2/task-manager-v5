export default function DarkToggle({ darkMode, toggleDark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '14px', userSelect: 'none' }}>{darkMode ? '🌙' : '☀️'}</span>
      <button
        onClick={toggleDark}
        aria-label={darkMode ? 'ライトモードに切替' : 'ダークモードに切替'}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '100px',
          background: darkMode ? 'var(--primary)' : 'var(--border)',
          border: 'none',
          padding: '2px',
          cursor: 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'white',
          transform: darkMode ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }} />
      </button>
    </div>
  );
}
