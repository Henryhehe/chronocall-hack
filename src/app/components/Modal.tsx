import { useEffect, useRef, type ReactNode } from 'react';

/** Native dialogs provide focus containment, Escape dismissal, and focus restoration. */
export function Modal({ open, onClose, label, children }: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [open]);

  return <dialog ref={ref} className="ui-modal" aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {children}
  </dialog>;
}
