export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  if (!open) return null;

  const maxW = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }[size] || 'max-w-2xl';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal-panel ${maxW} sm:mx-auto`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg font-semibold text-slate-900 tracking-tight truncate">
              {title}
            </h2>
            {subtitle ? <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">{headerRight}</div>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
