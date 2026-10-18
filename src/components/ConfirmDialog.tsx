import { useEffect, useRef } from 'react';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** "Vazgeç" yerine gösterilecek metin */
  cancelLabel?: string;
  /** İsteğe bağlı üçüncü seçenek (ör. "Kopya olarak kaydet") */
  secondary?: { label: string; onClick: () => void };
  /** Onay düğmesi geri alınamaz bir işlem mi (kırmızı gösterilir)? */
  danger?: boolean;
}

interface Props {
  request: ConfirmRequest | null;
  onClose: () => void;
}

export function ConfirmDialog({ request, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <dialog ref={ref} className="confirm" onClose={onClose}>
      {request && (
        <form method="dialog">
          <h2>{request.title}</h2>
          <p className="confirm-message">{request.message}</p>
          <div className="confirm-actions">
            <button type="submit" value="iptal">
              {request.cancelLabel ?? 'Vazgeç'}
            </button>
            {request.secondary && (
              <button type="button" onClick={run(request.secondary.onClick)}>
                {request.secondary.label}
              </button>
            )}
            <button type="button" className={request.danger ? 'danger-solid' : 'primary'} onClick={run(request.onConfirm)}>
              {request.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
