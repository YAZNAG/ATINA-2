import { Link } from 'react-router-dom';
import { ENTITY_REGISTRY, ENTITY_SLUGS } from './entityRegistry';
import { useAuth } from '../../context/AuthContext';

export default function CatalogDashboard() {
  const { hasPermission } = useAuth();

  const visibleReferentials = ENTITY_SLUGS.filter((slug) => {
    const cfg = ENTITY_REGISTRY[slug];
    return cfg && hasPermission(cfg.permissions.view);
  });

  const showArticles = hasPermission('articles.view');
  const showSkus = hasPermission('skus.view');
  const showSkuImages = hasPermission('sku_images.view');

  if (!visibleReferentials.length && !showArticles && !showSkus && !showSkuImages) {
    return (
      <div className="text-center py-12 text-gray-500">
        Vous n’avez aucune permission catalogue.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">Catalogue — Master Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Référentiels et articles : toutes les données viennent de l’API (aucune liste codée en dur).
        </p>
      </div>

      {showArticles && (
        <Link
          to="/catalog/articles"
          className="block card hover:border-blue-200 transition-colors border-blue-100 bg-blue-50/40"
        >
          <h2 className="font-semibold text-gray-900">Articles</h2>
          <p className="text-sm text-gray-600 mt-1">SKU, taxonomie, référentiels, images (sous-module dédié).</p>
        </Link>
      )}

      {(showSkus || showSkuImages) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showSkus && (
            <Link to="/catalog/skus" className="card hover:border-blue-200 transition-colors py-4">
              <h2 className="font-semibold text-gray-900">SKU</h2>
              <p className="text-sm text-gray-600 mt-1">Identifiants UUID (table skus).</p>
            </Link>
          )}
          {showSkuImages && (
            <Link to="/catalog/sku-images" className="card hover:border-blue-200 transition-colors py-4">
              <h2 className="font-semibold text-gray-900">Images SKU</h2>
              <p className="text-sm text-gray-600 mt-1">Table sku_images : URL, alts, principal, ordre.</p>
            </Link>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Référentiels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleReferentials.map((slug) => {
            const cfg = ENTITY_REGISTRY[slug];
            return (
              <Link
                key={slug}
                to={`/catalog/ref/${slug}`}
                className="card hover:border-blue-200 transition-colors py-4"
              >
                <h3 className="font-medium text-gray-900">{cfg.label}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cfg.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
