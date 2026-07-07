import { CircleCheck } from './icons';
import './Toast.css';

interface Props {
  message: string;
  tone?: 'success' | 'error';
}

export default function Toast({ message, tone = 'success' }: Props) {
  return (
    <div
      className={`toast ${tone}`}
      role="status"
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="toast-icon" aria-hidden="true">
        <CircleCheck size={18} />
      </span>
      <span>{message}</span>
    </div>
  );
}
