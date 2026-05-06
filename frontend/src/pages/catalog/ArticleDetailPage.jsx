import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v, fallback = '—') {
  if (v == null || v === '') return fallback;
  return String(v);
}

function fmtPrice(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DA';
}

// ── primitives ────────────────────────────────────────────────────────────────

function Badge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Inactif
    </span>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 min-w-[130px]">
        {label}
      </span>
      <span className={`text-sm text-gray-800 text-right ${mono ? 'font-mono' : ''}`}>
        {fmt(value)}
      </span>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function ImageThumb({ url, isPrimary, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-square ${
        isPrimary ? 'border-red-500 shadow-lg shadow-red-100' : 'border-gray-200 hover:border-red-300'
      }`}
    >
      {!err && url ? (
        <img src={url} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      {isPrimary && (
        <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          Principale
        </span>
      )}
    </div>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({ article, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Supprimer le produit</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">{article.name_fr}</span> sera supprimé définitivement.
          Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function ArticleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [images, setImages] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      catalog.getArticle(id),
      catalog.getArticleSkuImages(id),
    ]).then(([artRes, imgRes]) => {
      if (!mounted) return;
      const art = artRes.data?.data ?? artRes.data;
      const imgs = imgRes.data?.data ?? [];
      setArticle(art);
      setImages(imgs);
      setFeatured(imgs[0] ?? null);
    }).catch((err) => {
      toast.error(getErrorMessage(err));
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await catalog.deleteArticle(id);
      toast.success('Produit supprimé');
      navigate('/catalog/articles');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 text-sm">Produit introuvable.</p>
        <button
          onClick={() => navigate('/catalog/articles')}
          className="text-sm text-red-600 font-semibold underline"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  const primaryImg = images.find((i) => i.is_primary) ?? images[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {showDelete && (
        <DeleteModal
          article={article}
          onCancel={() => setShowDelete(false)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/catalog/articles')}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Produits
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700 truncate max-w-[220px]">
              {article.name_fr}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/catalog/articles', { state: { editId: article.id } })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Primary image */}
            <div className="md:w-72 lg:w-80 flex-shrink-0 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-100 flex items-center justify-center p-6 min-h-[240px]">
              {featured && !featured._err ? (
                <img
                  src={featured.url}
                  alt={article.name_fr}
                  className="max-h-52 max-w-full object-contain rounded-xl"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-40 h-40 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Key info */}
            <div className="flex-1 p-6 flex flex-col justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{article.name_fr}</h1>
                    {article.name_ar && (
                      <p className="text-base text-gray-500 mt-0.5 font-arabic" dir="rtl">{article.name_ar}</p>
                    )}
                  </div>
                  <Badge active={article.is_active} />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {article.sku_code && (
                    <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-mono font-bold rounded-lg border border-red-200">
                      SKU: {article.sku_code}
                    </span>
                  )}
                  {article.ean13 && (
                    <span className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-mono rounded-lg border border-gray-200">
                      EAN: {article.ean13}
                    </span>
                  )}
                  {article.brand?.name_fr && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200">
                      {article.brand.name_fr}
                    </span>
                  )}
                </div>

                {article.description_fr && (
                  <p className="text-sm text-gray-600 leading-relaxed">{article.description_fr}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-0.5">Prix HT</p>
                  <p className="text-base font-bold text-red-700">{fmtPrice(article.price)}</p>
                </div>
                {article.vat_rate != null && (
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                    <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-0.5">TVA</p>
                    <p className="text-base font-bold text-orange-700">{article.vat_rate}%</p>
                  </div>
                )}
                {article.coeff != null && (
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide mb-0.5">Coefficient</p>
                    <p className="text-base font-bold text-purple-700">{article.coeff}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Image gallery */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Galerie ({images.length})
              </h3>
            </div>
            <div className="p-5 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {images.map((img) => (
                <ImageThumb
                  key={img.id}
                  url={img.url}
                  isPrimary={img.id === (primaryImg?.id)}
                  onClick={() => setFeatured(img)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Detail sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Taxonomie */}
          <Section
            icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            title="Taxonomie"
          >
            <InfoRow label="Famille" value={article.family?.name_fr} />
            <InfoRow label="Catégorie" value={article.category?.name_fr} />
            <InfoRow label="Sous-catégorie" value={article.sub_category?.name_fr} />
            <InfoRow label="Marque" value={article.brand?.name_fr} />
          </Section>

          {/* Classification */}
          <Section
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            title="Classification"
          >
            <InfoRow label="Type" value={article.article_type_id ?? '—'} />
            <InfoRow label="Statut article" value={article.article_status_id ?? '—'} />
            <InfoRow label="Conservation" value={article.conservation_type_id ?? '—'} />
            <InfoRow label="Taxe" value={article.tax_id ?? '—'} />
          </Section>

          {/* Unités */}
          <Section
            icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
            title="Unités & Physique"
          >
            <InfoRow label="Unité de vente" value={article.unit_sale} />
            <InfoRow label="Unité d'achat" value={article.unit_purchase} />
            <InfoRow label="Poids (g)" value={article.weight_g} />
            <InfoRow label="Volume (ml)" value={article.volume_ml} />
          </Section>

          {/* Descriptions AR */}
          {article.description_ar && (
            <Section
              icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              title="Description (AR)"
            >
              <p className="py-3 text-sm text-gray-700 leading-relaxed font-arabic" dir="rtl">
                {article.description_ar}
              </p>
            </Section>
          )}
        </div>

        {/* Meta */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Informations système</h3>
          </div>
          <div className="px-5 py-2 grid grid-cols-1 sm:grid-cols-2">
            <InfoRow label="ID" value={article.id} mono />
            <InfoRow label="SKU Code" value={article.sku_code} mono />
            <InfoRow label="EAN-13" value={article.ean13} mono />
            <InfoRow label="Statut" value={article.is_active ? 'Actif' : 'Inactif'} />
            <InfoRow
              label="Créé le"
              value={article.created_at ? new Date(article.created_at).toLocaleDateString('fr-DZ', { year: 'numeric', month: 'long', day: 'numeric' }) : null}
            />
            <InfoRow
              label="Modifié le"
              value={article.updated_at ? new Date(article.updated_at).toLocaleDateString('fr-DZ', { year: 'numeric', month: 'long', day: 'numeric' }) : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
