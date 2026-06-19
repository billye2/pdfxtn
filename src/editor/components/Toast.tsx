import { CircleCheck } from './icons';

interface Props {
  message: string;
  tone?: 'success' | 'error';
}

export default function Toast({ message, tone = 'success' }: Props) {
  return (
    <div className={`toast ${tone}`}>
      <span className="toast-icon">
        <CircleCheck size={18} />
      </span>
      <span>{message}</span>
    </div>
  );
}
