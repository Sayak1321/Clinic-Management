import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog - A lightweight modal built using native HTML5 <dialog>
 */
export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogNode = ref.current;
    if (!dialogNode) return;

    if (isOpen) {
      if (!dialogNode.open) {
        dialogNode.showModal();
      }
    } else {
      if (dialogNode.open) {
        dialogNode.close();
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isOpen) onCancel();
  };

  return (
    <dialog
      ref={ref}
      onClose={handleClose}
      className="p-0 rounded-card shadow-xl border border-surface-200 backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm max-w-sm w-full bg-white overflow-hidden focus:outline-none"
    >
      <div className="p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary bg-primary-700 hover:bg-primary-800 py-1.5 px-3 text-xs"
          >
            Confirm
          </button>
        </div>
      </div>
    </dialog>
  );
}
