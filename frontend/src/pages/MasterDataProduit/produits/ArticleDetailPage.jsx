import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ImageOff, Loader2, Package, Tag, Warehouse, ClipboardList, Star, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../../api/axios';
import { getArticle, getArticleImages } from '../../../api/catalog.api';
import { getStockLevelsBySku, getSellingRulesBySku } from '../../../api/stock.api';

const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const toWebPath = (rawPath) => {
  if (!rawPath) return null;
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalized = rawPath.replace(/\\/g, '/');
  const idx = normalized.indexOf('storage/');
  const relative = idx >= 0 ? normalized.slice(idx) : normalized.replace(/^(\.\.\/)+/, '');
  return `${API_ORIGIN}/${relative}`;
};

const TABS = [
  { key: 'info', label: 'Informations', icon: Tag },
  { key: 'stock', label: 'Stock par entrepôt', icon: Warehouse },
  { key: 'selling', label: 'Règles de vente', icon: ClipboardList },
];

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value ?? '—'}</span>
    </div>
  );
}

export default function ArticleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // ——— Images (toutes, pas seulement la principale — endpoint dédié sans limite) ———
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = fermée, sinon index dans `images`

  const [stockLevels, setStockLevels] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [sellingRules, setSellingRules] = useState([]);
  const [sellingLoading, setSellingLoading] = useState(false);

  const fetchArticle = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getArticle(id);
      setArticle(data.data || data);
    } catch {
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      const { data } = await getArticleImages(id);
      setImages(data.data || data || []);
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchArticle(); fetchImages(); }, [fetchArticle, fetchImages]);

  useEffect(() => {
    if (activeTab !== 'stock' || !article?.sku_uuid) return;
    setStockLoading(true);
    getStockLevelsBySku(article.sku_uuid)
      .then(({ data }) => setStockLevels(data.data || []))
      .catch(() => setStockLevels([]))
      .finally(() => setStockLoading(false));
  }, [activeTab, article?.sku_uuid]);

  useEffect(() => {
    if (activeTab !== 'selling' || !article?.sku_uuid) return;
    setSellingLoading(true);
    getSellingRulesBySku(article.sku_uuid)
      .then(({ data }) => setSellingRules(data.data || []))
      .catch(() => setSellingRules([]))
      .finally(() => setSellingLoading(false));
  }, [activeTab, article?.sku_uuid]);

  // ——— Lightbox : navigation clavier ———
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, images.length]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Package size={28} />
        <p className="text-sm">Article introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[#E10600] hover:underline">Retour</button>
      </div>
    );
  }

  const mainImage = toWebPath((images.find((i) => i.is_main) || images[0])?.image_path);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft size={16} />
        Retour aux articles
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {mainImage ? (
            <img src={mainImage} alt={article.name_fr} className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={20} className="text-neutral-300" />
          )}
        </div>
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">{article.name_fr}</h1>
          <p className="text-sm text-neutral-500">
            {article.sku_code}
            {article.ean13 && <span className="ml-2 text-neutral-400">· EAN {article.ean13}</span>}
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition -mb-px ${
                activeTab === t.key
                  ? 'border-[#E10600] text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ——— Onglet Informations ——— */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Général</h3>
            <InfoRow label="Nom (AR)" value={<span dir="rtl">{article.name_ar}</span>} />
            <InfoRow label="Prix" value={`${Number(article.price).toFixed(2)} DH`} />
            <InfoRow label="Taxe" value={article.tax ? `${article.tax.name_fr} (${article.tax.rate}%)` : null} />
            <InfoRow label="Statut" value={article.is_active ? 'Actif' : 'Inactif'} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Classification</h3>
            <InfoRow label="Famille" value={article.family?.name_fr} />
            <InfoRow label="Catégorie" value={article.category?.name_fr} />
            <InfoRow label="Sous-catégorie" value={article.sub_category?.name_fr} />
            <InfoRow label="Marque" value={article.brand?.name_fr} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Conditionnement</h3>
            <InfoRow label="Unité d'achat" value={article.unit_purchase_ref?.name_fr} />
            <InfoRow label="Unité de vente" value={article.unit_sale_ref?.name_fr} />
            <InfoRow label="Type de conditionnement" value={article.packaging_type?.name_fr} />
            <InfoRow label="Coefficient" value={article.coeff} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Logistique</h3>
            <InfoRow label="Poids" value={article.weight_g ? `${article.weight_g} g` : null} />
            <InfoRow label="Volume" value={article.volume_ml ? `${article.volume_ml} ml` : null} />
            <InfoRow label="Conservation" value={article.conservation_type?.name_fr} />
          </div>

          {/* ——— Images : toutes, cliquables pour zoomer ——— */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Images</h3>
            {imagesLoading ? (
              <div className="flex h-20 items-center justify-center">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
              </div>
            ) : images.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucune image pour cet article.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {images.map((img, idx) => {
                  const url = toWebPath(img.image_path);
                  return (
                    <button
                      key={img.id ?? idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200 transition hover:ring-2 hover:ring-[#E10600]/40"
                    >
                      {url ? (
                        <img src={url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300"><ImageOff size={16} /></div>
                      )}
                      {img.is_main && (
                        <span className="absolute left-1 top-1 rounded-full bg-[#E10600] p-1 text-white"><Star size={10} fill="currentColor" /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ——— Onglet Stock par entrepôt ——— */}
      {activeTab === 'stock' && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {stockLoading ? (
            <div className="py-12 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>
          ) : stockLevels.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">Aucun niveau de stock enregistré pour cet article.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Entrepôt</th>
                  <th className="px-4 py-3 font-medium">Physique</th>
                  <th className="px-4 py-3 font-medium">Réservé</th>
                  <th className="px-4 py-3 font-medium">Disponible</th>
                  <th className="px-4 py-3 font-medium">Backorder</th>
                  <th className="px-4 py-3 font-medium">Attendu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {stockLevels.map((lvl) => (
                  <tr key={lvl.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{lvl.node?.name_fr || '—'}</td>
                    <td className="px-4 py-3">{Number(lvl.qty_physical)}</td>
                    <td className="px-4 py-3">{Number(lvl.qty_reserved)}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700">{Number(lvl.qty_available)}</td>
                    <td className="px-4 py-3">{Number(lvl.qty_backordered)}</td>
                    <td className="px-4 py-3">{Number(lvl.qty_incoming)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ——— Onglet Règles de vente ——— */}
      {activeTab === 'selling' && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {sellingLoading ? (
            <div className="py-12 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>
          ) : sellingRules.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">Aucune règle de vente configurée pour cet article.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Entrepôt</th>
                  <th className="px-4 py-3 font-medium">Backorder autorisé</th>
                  <th className="px-4 py-3 font-medium">Limite</th>
                  <th className="px-4 py-3 font-medium">En backorder</th>
                  <th className="px-4 py-3 font-medium">Délai réappro (j)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sellingRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{rule.node?.name_fr || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rule.is_backorderable ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {rule.is_backorderable ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{Number(rule.backorder_limit)}</td>
                    <td className="px-4 py-3">{Number(rule.backordered_quantity)}</td>
                    <td className="px-4 py-3">{rule.estimated_restock_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ——— Lightbox plein écran ——— */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            title="Fermer (Échap)"
          >
            <X size={22} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                title="Précédente (←)"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                title="Suivante (→)"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <img
            src={toWebPath(images[lightboxIndex].image_path)}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
              {lightboxIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}