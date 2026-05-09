import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getDeliveryTypes,
  createDeliveryType,
  updateDeliveryType,
  deleteDeliveryType,
  seedDeliveryTypes,
} from '../../api/delivery.api';
import { getErrorMessage } from '../../utils/helpers';

// ── Icons ──────────────────────────────────────────────────────────────────────

const SVG = {
  plus:    'M12 4v16m8-8H4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:       'M6 18L18 6M6 6l12 12',
  truck:   'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z',
  store:   'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  seed:    'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Type config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  home: {
    label:      'Livraison à domicile',
    icon:       SVG.truck,
    bg:         'bg-blue-50',
    border:     'border-blue-200',
    text:       'text-blue-700',
    badge:      'bg-blue-100 text-blue-700',
    dot:        'bg-blue-500',
    iconBg:     'from-blue-500 to-blue-600',
    desc:       'Adresse + créneau livraison requis',
  },
  pickup: {
    label:      'Retrait magasin',
    icon:       SVG.store,
    bg:         'bg-violet-50',
    border:     'border-violet-200',
    text:       'text-violet-700',
    badge:      'bg-violet-100 text-violet-700',
    dot:        'bg-violet-500',
    iconBg:     'from-violet-500 to-violet-600',
    desc:       'Sélection nœud / point retrait requis',
  },
};

const getConfig = (code) =>
  TYPE_CONFIG[code?.toLowerCase()] ?? {
    label:  code,
    icon:   SVG.truck,
    bg:     'bg-gray-50',
    border: 'border-gray-200',
    text:   'text-gray-600',
    badge:  'bg-gray-100 text-gray-600',
    dot:    'bg-gray-400',
    iconBg: 'from-gray-400 to-gray-500',
    desc:   '',
  };

// ── TypeCard ───────────────────────────────────────────────────────────────────

function TypeCard({ item, onEdit, onDelete }) {
  const cfg   = getConfig(item.code);
  const count = item.orders_count ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex flex-col">
      <div className="flex-1 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br ${cfg.iconBg}`}>
            <Icon d={cfg.icon} className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name_fr}</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{item.name_ar}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                {item.code}
              </span>
            </div>
          </div>
        </div>

        {cfg.desc && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${cfg.bg} ${cfg.border}`}>
            <Icon d={SVG.info} className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${cfg.text}`} />
            <span className={cfg.text}>{cfg.desc}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-xs text-gray-400">Utilisations</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
            {count} commande{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button onClick={() => onEdit(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
          <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
        </button>
        <button
          onClick={() => onDelete(item)}
          disabled={count > 0}
          title={count > 0 ? `Utilisé par ${count} commande(s)` : 'Supprimer'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <Icon d={SVG.trash} className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Delete Modal ───────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le type <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300';

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const EMPTY = { code: '', name_fr: '', name_ar: '' };

function DeliveryTypeDrawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm]     = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem
      ? { code: editItem.code ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '' }
      : { ...EMPTY }
    );
  }, [editItem]);

  const hc = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.code.trim())    return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.name_ar.trim()) return toast.error('Nom (AR) requis');
    setSaving(true);
    try {
      if (isEdit) await updateDeliveryType(editItem.id, { name_fr: form.name_fr, name_ar: form.name_ar });
      else        await createDeliveryType(form);
      toast.success(isEdit ? 'Type mis à jour' : 'Type de livraison créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const cfg = getConfig(form.code || 'home');

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.truck} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                {isEdit ? 'Modifier' : 'Nouveau'}
              </p>
              <h2 className="text-white font-bold text-xl">Type de livraison</h2>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form id="dt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {form.code}
                <span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code}
                  onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
                  placeholder="home" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas — ex: home, pickup, express</p>
              </>
            )}
          </Fld>

          {/* Preview badge */}
          {form.code && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${cfg.iconBg}`}>
                <Icon d={cfg.icon} className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${cfg.text}`}>{form.name_fr || cfg.label}</p>
                {cfg.desc && <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>}
              </div>
            </div>
          )}

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc}
              placeholder="Livraison à domicile" />
          </Fld>

          <Fld label="Nom (Arabe)" req>
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc}
              dir="rtl" placeholder="التوصيل إلى المنزل" />
          </Fld>

          {/* Info block */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-600 space-y-1">
            <p className="font-semibold">Utilisé dans :</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-500">
              <li>Checkout mobile</li>
              <li>Commandes & créneaux livraison</li>
              <li>Dispatch & tournées</li>
              <li>Préparation commande</li>
            </ul>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">
            Annuler
          </button>
          <button type="submit" form="dt-form" disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function DeliveryTypesPage() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [drawer, setDrawer]     = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [seeding, setSeeding]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDeliveryTypes({ page, limit: PAGE_SIZE, ...(search && { search }) });
      setItems(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteDeliveryType(deleting.id);
      toast.success('Type de livraison supprimé');
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDeliveryTypes();
      toast.success('Données seedées : home & pickup');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSeeding(false); }
  };

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
      {drawer !== null && (
        <DeliveryTypeDrawer
          editItem={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span>
                <span>›</span>
                <span>Livraison</span>
                <span>›</span>
                <span className="text-blue-600 font-medium">Types de livraison</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Types de livraison</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Référentiel utilisé dans checkout, commandes, dispatch et tournées
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSeed}
                disabled={seeding}
                title="Initialiser home & pickup"
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-all disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4" />
                {seeding ? 'Seed…' : 'Seed'}
              </button>
              <button
                onClick={() => setDrawer(false)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau type
              </button>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }}
            className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher un type…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <button type="submit"
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
                className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>
            )}
          </form>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-sm">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{total}</p>
          </div>
          {['home', 'pickup'].map((code) => {
            const cfg   = getConfig(code);
            const count = items.filter((i) => i.code === code).length;
            return (
              <div key={code} className={`rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.text} opacity-70`}>{code}</p>
                <p className={`text-2xl font-bold mt-0.5 ${cfg.text}`}>{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-100">
              <Icon d={SVG.truck} className="w-10 h-10 text-blue-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun type de livraison</p>
              <p className="text-gray-400 text-sm mt-1">
                {search ? 'Aucun résultat pour cette recherche.' : 'Cliquez sur « Seed » pour initialiser home & pickup.'}
              </p>
            </div>
            {!search && (
              <div className="flex gap-3">
                <button onClick={handleSeed} disabled={seeding}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                  <Icon d={SVG.seed} className="w-4 h-4 inline mr-1.5" />Seed (home + pickup)
                </button>
                <button onClick={() => setDrawer(false)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl">
                  + Créer manuellement
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Code
                      <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Identifiant technique</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom français
                      <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Affiché dans l'app</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom arabe
                      <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Version AR</div>
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Commandes
                      <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Utilisations</div>
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => {
                    const cfg   = getConfig(item.code);
                    const count = item.orders_count ?? 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${cfg.iconBg}`}>
                              <Icon d={cfg.icon} className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                              {item.code}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-900">{item.name_fr}</p>
                          {cfg.desc && <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-gray-600" dir="rtl">{item.name_ar}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                            count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {count}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setDrawer(item)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Modifier">
                              <Icon d={SVG.edit} className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleting(item)}
                              disabled={count > 0}
                              title={count > 0 ? `Utilisé par ${count} commande(s)` : 'Supprimer'}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                              <Icon d={SVG.trash} className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                    ← Précédent
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '…' ? (
                        <span key={`e${i}`} className="px-2 text-gray-400 text-xs">…</span>
                      ) : (
                        <button key={p} onClick={() => setPage(p)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            page === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          {p}
                        </button>
                      )
                    )}
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
