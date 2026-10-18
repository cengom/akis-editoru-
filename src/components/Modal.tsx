import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Tarayıcının <dialog> öğesiyle basit modal pencere. Esc ile kapanır. */
export function Modal({ open, title, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} onClose={onClose} aria-label={title}>
      {open && (
        <>
          <header className="modal-header">
            <h2>{title}</h2>
            <button type="button" className="icon" onClick={onClose} aria-label="Kapat">
              ×
            </button>
          </header>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
