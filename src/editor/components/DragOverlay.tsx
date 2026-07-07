import { Download } from './icons';
import './DragOverlay.css';

export default function DragOverlay() {
  return (
    <div className="drag-overlay">
      <div className="drag-panel">
        <Download size={46} />
        <p>Drop to add your pages!</p>
      </div>
    </div>
  );
}
