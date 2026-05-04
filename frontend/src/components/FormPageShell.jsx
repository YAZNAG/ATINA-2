import { Link } from 'react-router-dom';

function BackIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * En-tête de page formulaire (style « Nouvel utilisateur ») : fil d’Ariane + titre.
 */
export default function FormPageShell({
  backTo,
  backLabel = 'Retour',
  segmentLabel,
  title,
  description,
  maxWidthClass = 'max-w-2xl',
  children,
}) {
  return (
    <div className={`page-shell ${maxWidthClass} mx-auto space-y-4`}>
      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Fil d'Ariane">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 font-medium hover:text-slate-800 transition-colors"
        >
          <BackIcon />
          {backLabel}
        </Link>
        {segmentLabel ? (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{segmentLabel}</span>
          </>
        ) : null}
      </nav>
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
