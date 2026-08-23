import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ImageOff, Image as ImageIcon, Loader2, Package, Tag, ClipboardList, Star, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../../api/axios';
import { getSku, getSkuImages } from '../../../api/catalog.api';
import { getSellingRulesBySku, upsertSellingRule } from '../../../api/stock.api';

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
  { key: 'images', label: 'Images', icon: ImageIcon },
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

export default function SkuDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sku, setSku] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const [sellingRules, setSellingRules] = useState([]);
  const [sellingLoading, setSellingLoading] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState(null);

  const fetchSku = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSku(id);
      setSku(data.data || data);
    } catch {
      setSku(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      const { data } = await getSkuImages(id);
      setImages(data.data || data || []);
    } catch {
      setImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSku(); fetchImages(); }, [fetchSku, fetchImages]);

  useEffect(() => {
    if (activeTab !== 'selling' || !sku?.id) return;
    setSellingLoading(true);
    getSellingRulesBySku(sku.id)
      .then(({ data }) => setSellingRules(data.data || []))
      .catch(() => setSellingRules([]))
      .finally(() => setSellingLoading(false));
  }, [activeTab, sku?.id]);

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

  const patchRule = useCallback((ruleId, patch) => {
    setSellingRules((rules) => rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  }, []);

  const handleToggleSellable = useCallback(async (rule) => {
    const next = !rule.is_sellable;
    patchRule(rule.id, { is_sellable: next });
    setSavingRuleId(rule.id);
    try {
      await upsertSellingRule({ node_id: rule.node_id, sku_id: sku.id, is_sellable: next, price: rule.price });
    } catch {
      patchRule(rule.id, { is_sellable: rule.is_sellable });
    } finally {
      setSavingRuleId(null);
    }
  }, [patchRule, sku?.id]);

  const handlePriceBlur = useCallback(async (rule, value) => {
    const price = value === '' ? 0 : Number(value);
    if (isNaN(price) || price < 0 || price === Number(rule.price)) return;
    patchRule(rule.id, { price });
    setSavingRuleId(rule.id);
    try {
      await upsertSellingRule({ node_id: rule.node_id, sku_id: sku.id, is_sellable: rule.is_sellable, price });
    } catch {
      patchRule(rule.id, { price: rule.price });
    } finally {
      setSavingRuleId(null);
    }
  }, [patchRule, sku?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!sku) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Package size={28} />
        <p className="text-sm">SKU introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[#E10600] hover:underline">Retour</button>
      </div>
    );
  }

  const mainImage = toWebPath((images.find((i) => i.is_primary) || images[0])?.url);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft size={16} />
        Retour aux SKU
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {mainImage ? (
            <img src={mainImage} alt={sku.name_fr} className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={20} className="text-neutral-300" />
          )}
        </div>
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">{sku.name_fr}</h1>
          <p className="text-sm text-neutral-500">
            {sku.sku_code}
            {sku.ean13 && <span className="ml-2 text-neutral-400">· EAN {sku.ean13}</span>}
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

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Général</h3>
            <InfoRow label="Nom (AR)" value={<span dir="rtl">{sku.name_ar}</span>} />
            <InfoRow label="Prix" value={`${Number(sku.price).toFixed(2)} DH`} />
            <InfoRow label="Taxe" value={sku.tax ? `${sku.tax.name_fr} (${sku.tax.rate}%)` : null} />
            <InfoRow label="Statut" value={sku.is_active ? 'Actif' : 'Inactif'} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Classification</h3>
            <InfoRow label="Famille SKU" value={sku.sku_family?.name_fr} />
            <InfoRow label="Sous-famille SKU" value={sku.sku_subfamily?.name_fr} />
            <InfoRow label="Catégorie" value={sku.category?.name_fr} />
            <InfoRow label="Marque" value={sku.brand?.name_fr} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Conditionnement</h3>
            <InfoRow label="Unité d'achat" value={sku.unit_purchase_ref?.name_fr} />
            <InfoRow label="Unité de vente" value={sku.unit_sale_ref?.name_fr} />
            <InfoRow label="Type de conditionnement" value={sku.packaging_type?.name_fr} />
            <InfoRow label="Coefficient" value={sku.coeff} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">Logistique</h3>
            <InfoRow label="Poids" value={sku.weight_g ? `${sku.weight_g} g` : null} />
            <InfoRow label="Volume" value={sku.volume_ml ? `${sku.volume_ml} ml` : null} />
            <InfoRow label="Conservation" value={sku.conservation_type?.name_fr} />
          </div>
        </div>
      )}

      {activeTab === 'images' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800">Images</h3>
          {imagesLoading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 size={16} className="animate-spin text-neutral-400" />
            </div>
          ) : images.length === 0 ? (
            <p className="text-sm text-neutral-400">Aucune image pour ce SKU.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => {
                const url = toWebPath(img.url);
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
                    {img.is_primary && (
                      <span className="absolute left-1 top-1 rounded-full bg-[#E10600] p-1 text-white"><Star size={10} fill="currentColor" /></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'selling' && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-neutral-800">
            Règles de vendabilité &amp; prix <span className="font-normal text-neutral-400">(UNIQUE node×SKU)</span>
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Un SKU n'est vendable sur un nœud que si la règle est active et qu'un prix TTC est défini.
          </p>

          {sellingLoading ? (
            <div className="py-12 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>
          ) : sellingRules.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">Aucune règle de vente configurée pour ce SKU.</p>
          ) : (
            <div className="mt-4 divide-y divide-neutral-100">
              {sellingRules.map((rule) => {
                const isVendable = rule.is_sellable && Number(rule.price) > 0;
                return (
                  <div key={rule.id} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="font-medium text-neutral-800">
                        {rule.node?.code} — {rule.node?.name_fr}
                      </p>
                      <p className={`text-sm ${isVendable ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {isVendable ? 'Vendable' : 'Non vendable'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={rule.price > 0 ? rule.price : ''}
                          placeholder="Prix TTC"
                          disabled={savingRuleId === rule.id}
                          onBlur={(e) => handlePriceBlur(rule, e.target.value)}
                          className="w-20 bg-transparent text-right text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-300"
                        />
                        <span className="text-xs text-neutral-400">MAD</span>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.is_sellable}
                        disabled={savingRuleId === rule.id}
                        onClick={() => handleToggleSellable(rule)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          rule.is_sellable ? 'bg-emerald-500' : 'bg-neutral-200'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            rule.is_sellable ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
            src={toWebPath(images[lightboxIndex].url)}
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