import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import * as geo from '../../api/locationNode.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const PATH = {
  globe: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  plus: 'M12 4v16m8-8H4',
  chevron: 'M9 5l7 7-7 7',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  x: 'M6 18L18 6M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const LEVEL_CFG = {
  regions: {
    label: 'Régions',
    icon: PATH.globe,
    gradient: 'from-red-700 to-red-500',
    bg: 'bg-red-600',
    childLabel: 'villes',
    createPerm: 'regions.create',
    updatePerm: 'regions.update',
    deletePerm: 'regions.delete',
  },
  cities: {
    label: 'Villes',
    icon: PATH.building,
    gradient: 'from-pink-700 to-pink-500',
    bg: 'bg-pink-600',
    childLabel: null,
    createPerm: 'cities.create',
    updatePerm: 'cities.update',
    deletePerm: 'cities.delete',
  },
};

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Inactif
    </span>
  );
}

function GeoCard({ level, item, childCount, clickable, onClick, onEdit, onDelete }) {
  const lc = LEVEL_CFG[level];
  const sub = level === 'cities' && item.postal_code ? `CP: ${item.postal_code}` : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className={`flex-1 p-5 ${clickable ? 'cursor-pointer' : ''}`} onClick={clickable ? onClick : undefined}>
        <div className="flex items-start gap-4 mb-3">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${lc.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon d={lc.icon} className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name_fr}</h3>
            {item.name_ar && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{item.name_ar}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {item.code && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                  {item.code}
                </span>
              )}
              <StatusBadge active={item.is_active} />
            </div>
          </div>
        </div>

        {sub && <p className="text-xs text-gray-400 font-medium">{sub}</p>}

        {item.description_fr && (
          <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-2">{item.description_fr}</p>
        )}

        {childCount != null && clickable && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <Icon d={PATH.chevron} className="w-3.5 h-3.5 text-red-300" />
            <span>{childCount} {lc.childLabel}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <Icon d={PATH.edit} className="w-3.5 h-3.5" />
          Modifier
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto"
        >
          <Icon d={PATH.trash} className="w-3.5 h-3.5" />
          Supprimer
        </button>
      </div>
    </div>
  );
}

function DeleteModal({ item, level, onCancel, onConfirm, loading }) {
  const lc = LEVEL_CFG[level];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={PATH.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">{item?.name_fr}</span> sera supprimé{lc.label === 'Villes' ? 'e' : ''} définitivement.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const ta = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300 resize-none';

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

const EMPTY = {
  regions: { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', is_active: true },
  cities: { code: '', name_fr: '', name_ar: '', postal_code: '', is_active: true },
};

function GeoDrawer({ level, regionId, editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const lc = LEVEL_CFG[level];

  const [form, setForm] = useState({ ...EMPTY[level] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      if (level === 'regions') {
        setForm({
          code: editItem.code ?? '',
          name_fr: editItem.name_fr ?? '',
          name_ar: editItem.name_ar ?? '',
          description_fr: editItem.description_fr ?? '',
          description_ar: editItem.description_ar ?? '',
          is_active: editItem.is_active ?? true,
        });
      } else {
        setForm({
          code: editItem.code ?? '',
          name_fr: editItem.name_fr ?? '',
          name_ar: editItem.name_ar ?? '',
          postal_code: editItem.postal_code ?? '',
          is_active: editItem.is_active ?? true,
        });
      }
    } else {
      setForm({ ...EMPTY[level] });
    }
  }, [level, editItem]);

  const hc = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const buildPayload = () => {
    const p = { ...form };
    if (level === 'cities' && regionId) p.region_id = regionId;
    return p;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (level === 'regions') {
        isEdit ? await geo.updateRegion(editItem.id, payload) : await geo.createRegion(payload);
      } else {
        isEdit ? await geo.updateCity(editItem.id, payload) : await geo.createCity(payload);
      }
      toast.success(isEdit ? 'Mis à jour' : 'Créé avec succès');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const singularLabel = { regions: 'Région', cities: 'Ville' }[level];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className={`flex items-center justify-between px-6 py-5 bg-gradient-to-r ${lc.gradient}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={lc.icon} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                {isEdit ? 'Modifier' : 'Nouveau'}
              </p>
              <h2 className="text-white font-bold text-xl leading-tight">{singularLabel}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors">
            <Icon d={PATH.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        <form id="geo-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Code" req>
              <input
                name="code"
                className={`${inp} uppercase`}
                value={form.code}
                onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toUpperCase() } })}
                required
                placeholder="EX: REG-01"
              />
            </Fld>
            <Fld label="Statut">
              <div className="h-full flex items-end">
                <label className="flex items-center gap-3 cursor-pointer pb-1">
                  <div
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-red-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className={`text-sm font-semibold ${form.is_active ? 'text-red-600' : 'text-gray-400'}`}>
                    {form.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </label>
              </div>
            </Fld>
          </div>

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} required placeholder="Nom en français" />
          </Fld>
          <Fld label="Nom (Arabe)">
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="الاسم بالعربية" />
          </Fld>

          {level === 'cities' && (
            <Fld label="Code postal">
              <input name="postal_code" className={inp} value={form.postal_code ?? ''} onChange={hc} placeholder="16000" />
            </Fld>
          )}

          {level === 'regions' && (
            <>
              <Fld label="Description (FR)">
                <textarea name="description_fr" className={ta} rows={2} value={form.description_fr ?? ''} onChange={hc} placeholder="Description optionnelle…" />
              </Fld>
              <Fld label="Description (AR)">
                <textarea name="description_ar" className={ta} rows={2} value={form.description_ar ?? ''} onChange={hc} dir="rtl" />
              </Fld>
            </>
          )}
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button type="submit" form="geo-form" disabled={saving} className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${lc.bg} hover:opacity-90 disabled:opacity-50`}>
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function GeoPage() {
  const { hasPermission } = useAuth();

  const location = useLocation();

  const [level, setLevel] = useState('regions');
  const [selectedRegion, setSelectedRegion] = useState(null);

  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityCounts, setCityCounts] = useState({}); // city count per region id
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const p = location.pathname;
    const nextLevel = p.includes('/geo/cities') ? 'cities' : 'regions';
    setLevel(nextLevel);
    if (nextLevel === 'regions') setSelectedRegion(null);
  }, [location.pathname]);

  const loadRegions = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, cityRes] = await Promise.all([
        geo.getRegions({ limit: 500 }),
        geo.getCities({ limit: 500 }),
      ]);
      const regs = regRes.data.data ?? [];
      const cityAll = cityRes.data.data ?? [];
      setRegions(regs);
      const counts = {};
      for (const c of cityAll) {
        counts[c.region_id] = (counts[c.region_id] ?? 0) + 1;
      }
      setCityCounts(counts);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  const loadCities = useCallback(async () => {
    if (!selectedRegion) return;
    setLoading(true);
    try {
      const res = await geo.getCities({ limit: 500, region_id: selectedRegion.id });
      setCities(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [selectedRegion]);

  useEffect(() => {
    if (level === 'regions') loadRegions();
    else loadCities();
  }, [level, loadRegions, loadCities]);

  const refresh = useCallback(() => {
    if (level === 'regions') loadRegions();
    else loadCities();
  }, [level, loadRegions, loadCities]);

  const goToRegions = () => {
    setLevel('regions');
    setSelectedRegion(null);
    setSearch(''); setSearchInput(''); setStatusFilter('all');
  };

  const drillRegion = (r) => {
    setSelectedRegion(r);
    setLevel('cities');
    setSearch(''); setSearchInput(''); setStatusFilter('all');
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      if (level === 'regions') await geo.deleteRegion(deleting.id);
      else await geo.deleteCity(deleting.id);
      toast.success('Supprimé avec succès');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const lc = LEVEL_CFG[level];
  const rows = level === 'regions' ? regions : cities;
  const q = search.toLowerCase();

  const filtered = rows.filter((r) => {
    if (statusFilter === 'active' && !r.is_active) return false;
    if (statusFilter === 'inactive' && r.is_active) return false;
    if (q && !(r.name_fr ?? '').toLowerCase().includes(q) && !(r.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal
          item={deleting}
          level={level}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
      {drawer && (
        <GeoDrawer
          level={level}
          regionId={selectedRegion?.id}
          editItem={drawer.editItem ?? null}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); refresh(); }}
        />
      )}

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <nav className="flex items-center gap-2 text-sm mb-2 flex-wrap">
                <button
                  onClick={goToRegions}
                  className={`font-semibold transition-colors ${level === 'regions' ? 'text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                >
                  Régions
                </button>

                {level === 'cities' && selectedRegion && (
                  <>
                    <Icon d={PATH.chevron} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <span className="font-semibold text-pink-600 max-w-[160px] truncate">
                      {selectedRegion.name_fr}
                    </span>
                  </>
                )}
              </nav>

              <h1 className="text-2xl font-bold text-gray-900">{lc.label}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {level === 'regions' && 'Niveau supérieur géographique'}
                {level === 'cities' && `Villes de la région « ${selectedRegion?.name_fr} »`}
              </p>
            </div>

            {hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className={`flex items-center gap-2 ${lc.bg} hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0`}
              >
                <Icon d={PATH.plus} className="w-4 h-4" />
                Ajouter
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[
                { key: 'regions', label: 'Régions', disabled: false },
                { key: 'cities', label: 'Villes', disabled: !selectedRegion },
              ].map((tab) => (
                <button
                  key={tab.key}
                  disabled={tab.disabled}
                  onClick={() => { if (tab.key === 'regions') goToRegions(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    level === tab.key
                      ? 'bg-white text-red-600 shadow-sm'
                      : tab.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-800 cursor-pointer'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === opt.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 flex-1 min-w-0 max-w-sm"
            >
              <div className="relative flex-1">
                <Icon d={PATH.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher par nom, code…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0">
                Filtrer
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="px-2.5 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50"
                >
                  ✕
                </button>
              )}
            </form>

            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} élément{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {level === 'regions' && regions.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total régions', value: regions.length, color: 'bg-red-50 border-red-100 text-red-700' },
              { label: 'Actives', value: regions.filter((r) => r.is_active).length, color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              { label: 'Inactives', value: regions.filter((r) => !r.is_active).length, color: 'bg-gray-50 border-gray-100 text-gray-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className={`animate-spin rounded-full h-10 w-10 border-b-2 ${level === 'regions' ? 'border-red-600' : 'border-pink-600'}`} />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${level === 'regions' ? 'bg-red-50 border border-red-100' : 'bg-pink-50 border border-pink-100'}`}>
              <Icon d={lc.icon} className={`w-10 h-10 ${level === 'regions' ? 'text-red-200' : 'text-pink-200'}`} />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun élément</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || statusFilter !== 'all'
                  ? 'Essayez de modifier vos filtres.'
                  : hasPermission(lc.createPerm)
                  ? 'Cliquez sur « Ajouter » pour créer le premier.'
                  : 'Aucun élément disponible.'}
              </p>
            </div>
            {!search && statusFilter === 'all' && hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className={`px-5 py-2.5 ${lc.bg} hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-colors`}
              >
                + Créer le premier
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <GeoCard
                key={item.id}
                level={level}
                item={item}
                childCount={level === 'regions' ? (cityCounts[item.id] ?? 0) : null}
                clickable={level === 'regions'}
                onClick={() => { if (level === 'regions') drillRegion(item); }}
                onEdit={(it) => setDrawer({ editItem: it })}
                onDelete={(it) => setDeleting(it)}
              />
            ))}

            {hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className={`rounded-2xl border-2 border-dashed bg-white transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-[180px] ${
                  level === 'regions'
                    ? 'border-red-200 hover:border-red-400 hover:bg-red-50 text-red-400 hover:text-red-600'
                    : 'border-pink-200 hover:border-pink-400 hover:bg-pink-50 text-pink-400 hover:text-pink-600'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${level === 'regions' ? 'bg-red-100' : 'bg-pink-100'}`}>
                  <Icon d={PATH.plus} className={`w-6 h-6 ${level === 'regions' ? 'text-red-500' : 'text-pink-500'}`} />
                </div>
                <span className="text-sm font-semibold">Ajouter</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}