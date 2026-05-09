import { Link } from 'react-router-dom';

/** Mêmes classes que `CatalogRefPage.jsx` (référentiels catalogue). */
export const catalogInputClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
export const catalogSelectClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700';
export const catalogTextareaClass =
  'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300 resize-none';

/**
 * En-tête aligné sur {@link ../catalog/CatalogRefPage#CatalogRefShell} :
 * `min-h-screen bg-gray-50`, bandeau blanc, fil Accueil / libellé rouge, titre `text-2xl`.
 */
export default function CustomerShell({
  /** Texte rouge dans le fil (ex. « Gestion des clients » ou « Clients »). */
  crumbLabel = 'Clients',
  /** Si défini, le fil rouge est un lien. */
  crumbHref,
  breadcrumbTail,
  /** Titre principal (h1), peut différer du fil (ex. fiche client). */
  title,
  pageSubtitle,
  headerRight,
  headerBottom,
  children,
  contentClassName = '',
}) {
  const crumb = crumbHref ? (
    <Link to={crumbHref} className="text-red-600 font-semibold hover:text-red-800">
      {crumbLabel}
    </Link>
  ) : (
    <span className="text-red-600 font-semibold">{crumbLabel}</span>
  );

  const h1 = title ?? crumbLabel;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="min-w-0">
              <nav className="text-xs text-gray-400 mb-1.5 flex flex-wrap items-center gap-x-1.5" aria-label="Fil d'Ariane">
                <Link to="/dashboard" className="hover:text-gray-600">
                  Accueil
                </Link>
                <span className="text-gray-300 mx-1.5">/</span>
                {crumb}
                {breadcrumbTail ? (
                  <>
                    <span className="text-gray-300 mx-1.5">/</span>
                    <span className="text-gray-600 truncate max-w-[10rem] sm:max-w-md">{breadcrumbTail}</span>
                  </>
                ) : null}
              </nav>
              <h1 className="text-2xl font-bold text-gray-900 truncate">{h1}</h1>
              {pageSubtitle ? <p className="text-sm text-gray-400 mt-0.5">{pageSubtitle}</p> : null}
            </div>
            {headerRight ? <div className="shrink-0 flex flex-wrap gap-2 justify-end">{headerRight}</div> : null}
          </div>
          {headerBottom ? <div className="border-t border-gray-50 pt-4">{headerBottom}</div> : null}
        </div>
      </div>

      <div className={`px-6 py-6 ${contentClassName}`}>{children}</div>
    </div>
  );
}
