import './LoadingState.css';

export default function LoadingState() {
  return (
    <div className="loading">
      <div className="loading-dots">
        <span style={{ background: 'var(--c-del)', animationDelay: '0s' }} />
        <span style={{ background: 'var(--c-rotate)', animationDelay: '.14s' }} />
        <span style={{ background: 'var(--c-add)', animationDelay: '.28s' }} />
        <span style={{ background: 'var(--c-go)', animationDelay: '.42s' }} />
      </div>
      <p className="loading-label">Getting your pages ready…</p>
    </div>
  );
}
