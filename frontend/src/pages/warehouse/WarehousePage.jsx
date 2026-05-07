import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getZonesList, getLevelsList, getLocationsList,
  createLocation, updateLocation, deleteLocation, bulkGenerateLocations,
  getSkuLocations, createSkuLocation, updateSkuLocation, deleteSkuLocation,
} from '../../api/warehouse.api';
import { getNodes } from '../../api/locationNode.api';
import { getArticles } from '../../api/catalog.api';
import { getErrorMessage } from '../../utils/helpers';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SVG = {
  plus:      'M12 4v16m8-8H4',
  edit:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:         'M6 18L18 6M6 6l12 12',
  package:   'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  tag:       'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  star:      'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  lightning: 'M13 10V3L4 14h7v7l9-11h-7z',
  grid:      'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  node:      'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  check:     'M5 13l4 4L19 7',
  mapPin:    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const sel = `${inp} cursor-pointer`;

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

// ── Location Form Modal ───────────────────────────────────────────────────────

function LocationFormModal({ location, nodeId, zones, levels, onClose, onSaved }) {
  const isEdit = !!location;
  const [form, setForm] = useState(
    isEdit
      ? { aisle: location.aisle, shelf: location.shelf, level_id: location.level_id, zone_id: location.zone_id ?? '', is_active: location.is_active }
      : { aisle: '', shelf: '', level_id: '', zone_id: '', is_active: true }
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.aisle.trim()) return toast.error('Allée requise');
    if (!form.shelf.trim()) return toast.error('Rayon requis');
    if (!form.level_id) return toast.error('Niveau requis');
    setSaving(true);
    try {
      const payload = { ...form, zone_id: form.zone_id || null, node_id: nodeId };
      if (isEdit) {
        await updateLocation(location.id, payload);
        toast.success('Emplacement mis à jour');
        onSaved(null);
      } else {
        const res = await createLocation(payload);
        toast.success('Emplacement créé');
        onSaved(res.data?.data ?? null);
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? `Modifier — ${location.label}` : 'Nouvel emplacement'}
          </h2>
        </div>
        <form id="loc-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Allée" req>
              <input className={`${inp} uppercase`} value={form.aisle}
                onChange={(e) => set('aisle', e.target.value.toUpperCase())} placeholder="A" />
            </Fld>
            <Fld label="Rayon" req>
              <input className={inp} value={form.shelf}
                onChange={(e) => set('shelf', e.target.value)} placeholder="01" />
            </Fld>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Niveau" req>
              <select className={sel} value={form.level_id} onChange={(e) => set('level_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.name_fr} ({l.code})</option>)}
              </select>
            </Fld>
            <Fld label="Zone">
              <select className={sel} value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr}</option>)}
              </select>
            </Fld>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set('is_active', !form.is_active)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-red-600' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
            </div>
            <span className={`text-sm font-semibold ${form.is_active ? 'text-red-600' : 'text-gray-400'}`}>
              {form.is_active ? 'Actif' : 'Inactif'}
            </span>
          </label>
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" form="loc-form" disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Generate Modal ───────────────────────────────────────────────────────

function BulkModal({ nodeId, zones, levels, onClose, onDone }) {
  const [form, setForm] = useState({ aisles: '', shelves: '', zone_id: '' });
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleLevel = (id) =>
    setSelectedLevels((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const aisles = form.aisles.split(',').map((s) => s.trim()).filter(Boolean);
    const shelves = form.shelves.split(',').map((s) => s.trim()).filter(Boolean);
    if (!aisles.length) return toast.error('Au moins une allée requise');
    if (!shelves.length) return toast.error('Au moins un rayon requis');
    if (!selectedLevels.length) return toast.error('Au moins un niveau requis');
    setSaving(true);
    try {
      const res = await bulkGenerateLocations({ node_id: nodeId, aisles, shelves, level_ids: selectedLevels, zone_id: form.zone_id || null });
      setResult(res.data.data ?? res.data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  if (result) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">Résultat de la génération</h2>
        <div className="grid grid-cols-3 gap-3 text-center mb-5">
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
            <p className="text-xs text-emerald-600 mt-1 font-semibold">Créés</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
            <p className="text-xs text-amber-600 mt-1 font-semibold">Ignorés</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <p className="text-2xl font-bold text-red-700">{result.errors}</p>
            <p className="text-xs text-red-600 mt-1 font-semibold">Erreurs</p>
          </div>
        </div>
        <button onClick={() => { onDone(); onClose(); }}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
          Fermer
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Génération en lot</h2>
          <p className="text-xs text-gray-400 mt-1">Allées et rayons séparés par des virgules : A, B, C</p>
        </div>
        <form id="bulk-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Fld label="Allées" req>
              <input className={`${inp} uppercase`} value={form.aisles}
                onChange={(e) => set('aisles', e.target.value)} placeholder="A, B, C" />
            </Fld>
            <Fld label="Rayons" req>
              <input className={inp} value={form.shelves}
                onChange={(e) => set('shelves', e.target.value)} placeholder="01, 02, 03" />
            </Fld>
          </div>
          <Fld label="Niveaux" req>
            <div className="flex flex-wrap gap-2 mt-1">
              {levels.map((l) => (
                <button key={l.id} type="button" onClick={() => toggleLevel(l.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedLevels.includes(l.id)
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-red-400'
                  }`}>
                  {l.name_fr}
                </button>
              ))}
              {!levels.length && <p className="text-xs text-amber-600">Aucun niveau configuré</p>}
            </div>
          </Fld>
          <Fld label="Zone (optionnel)">
            <select className={sel} value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}>
              <option value="">— Aucune —</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr}</option>)}
            </select>
          </Fld>
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" form="bulk-form" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            <Icon d={SVG.lightning} className="w-4 h-4" />
            {saving ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Article Assignment Drawer (view + select modes) ───────────────────────────

function ArticleDrawer({ location, nodeId, onClose, onUpdated }) {
  const [assignments, setAssignments] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  // 'view' = show assigned list | 'select' = checkbox selector
  const [mode, setMode]               = useState('view');
  const [search, setSearch]           = useState('');
  const [removingId, setRemovingId]   = useState(null);

  // Select-mode state
  const [checked, setChecked]                   = useState(new Set());
  const [primarySkuUuids, setPrimarySkuUuids]   = useState(new Set());
  const [originalChecked, setOriginalChecked]   = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, artRes] = await Promise.all([
        getSkuLocations({ location_id: location.id, limit: 500 }),
        getArticles({ limit: 1000 }),
      ]);
      setAssignments(aRes.data.data ?? []);
      setAllArticles(artRes.data.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [location.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build checked/primary state from current assignments (called when entering select mode)
  const enterSelectMode = useCallback(() => {
    const assignedSkuIds = new Set(assignments.map((a) => a.sku_id));
    const newChecked = new Set();
    const newPrimary = new Set();
    for (const art of allArticles) {
      if (art.sku_uuid && assignedSkuIds.has(art.sku_uuid)) newChecked.add(art.id);
    }
    for (const asgn of assignments) {
      if (asgn.is_primary_location) newPrimary.add(asgn.sku_id);
    }
    setChecked(newChecked);
    setOriginalChecked(new Set(newChecked));
    setPrimarySkuUuids(newPrimary);
    setSearch('');
    setMode('select');
  }, [assignments, allArticles]);

  // ── View mode: immediate operations ───────────────────────────────────────

  const removeAssignment = async (asgn) => {
    setRemovingId(asgn.id);
    try {
      await deleteSkuLocation(asgn.id);
      toast.success('Article retiré');
      await loadData();
      onUpdated();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setRemovingId(null); }
  };

  const togglePrimaryView = async (asgn) => {
    try {
      await updateSkuLocation(asgn.id, { is_primary_location: !asgn.is_primary_location });
      toast.success(asgn.is_primary_location ? 'Principal retiré' : 'Emplacement principal défini');
      await loadData();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  // ── Select mode: checkbox operations ──────────────────────────────────────

  const assignmentBySku = useMemo(() => {
    const m = {};
    for (const a of assignments) m[a.sku_id] = a;
    return m;
  }, [assignments]);

  const toggleCheck = useCallback((art) => {
    if (!art.sku_uuid) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(art.id)) {
        next.delete(art.id);
        setPrimarySkuUuids((p) => { const np = new Set(p); np.delete(art.sku_uuid); return np; });
      } else {
        next.add(art.id);
      }
      return next;
    });
  }, []);

  const togglePrimarySelect = useCallback((e, art) => {
    e.stopPropagation();
    if (!art.sku_uuid || !checked.has(art.id)) return;
    setPrimarySkuUuids((prev) => {
      const next = new Set(prev);
      if (next.has(art.sku_uuid)) { next.delete(art.sku_uuid); }
      else { next.clear(); next.add(art.sku_uuid); }
      return next;
    });
  }, [checked]);

  const handleSave = async () => {
    const toAdd = allArticles.filter((a) => a.sku_uuid && checked.has(a.id) && !originalChecked.has(a.id));
    const toRemove = allArticles.filter((a) => a.sku_uuid && !checked.has(a.id) && originalChecked.has(a.id));
    const toUpdatePrimary = assignments.filter((asgn) => {
      if (toRemove.some((r) => r.sku_uuid === asgn.sku_id)) return false;
      return asgn.is_primary_location !== primarySkuUuids.has(asgn.sku_id);
    });

    if (!toAdd.length && !toRemove.length && !toUpdatePrimary.length) {
      setMode('view');
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        ...toAdd.map((a) => createSkuLocation({
          sku_id: a.sku_uuid, node_id: nodeId, location_id: location.id,
          is_primary_location: primarySkuUuids.has(a.sku_uuid), is_active: true,
        })),
        ...toRemove.map((a) => {
          const asgn = assignmentBySku[a.sku_uuid];
          return asgn ? deleteSkuLocation(asgn.id) : null;
        }).filter(Boolean),
        ...toUpdatePrimary.map((asgn) =>
          updateSkuLocation(asgn.id, { is_primary_location: primarySkuUuids.has(asgn.sku_id) })
        ),
      ]);
      toast.success(`Sauvegardé — +${toAdd.length} ajouté(s), -${toRemove.length} retiré(s)`);
      await loadData();
      onUpdated();
      setMode('view');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toAddCount    = allArticles.filter((a) => a.sku_uuid && checked.has(a.id) && !originalChecked.has(a.id)).length;
  const toRemoveCount = allArticles.filter((a) => a.sku_uuid && !checked.has(a.id) && originalChecked.has(a.id)).length;
  const hasChanges    = toAddCount > 0 || toRemoveCount > 0 ||
    assignments.some((asgn) => asgn.is_primary_location !== primarySkuUuids.has(asgn.sku_id));

  const filteredArticles = useMemo(() => {
    if (!search.trim()) return allArticles;
    const q = search.toLowerCase();
    return allArticles.filter(
      (a) => a.name_fr?.toLowerCase().includes(q) || a.sku_code?.toLowerCase().includes(q)
    );
  }, [allArticles, search]);

  const zoneColor = location.zone?.color || '#dc2626';

  // ── Shared header ─────────────────────────────────────────────────────────

  const Header = (
    <div className="px-6 py-5 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {mode === 'select' ? (
            <button onClick={() => setMode('view')}
              className="flex items-center gap-1.5 text-red-200 hover:text-white text-xs font-semibold mb-2 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour à l'emplacement
            </button>
          ) : (
            <p className="text-red-200 text-[11px] font-semibold uppercase tracking-widest mb-1">Emplacement</p>
          )}
          <h2 className="text-white font-bold text-2xl font-mono">{location.label}</h2>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-lg bg-white/15 text-white/80 text-xs font-medium">Allée {location.aisle}</span>
            <span className="px-2 py-0.5 rounded-lg bg-white/15 text-white/80 text-xs font-medium">Rayon {location.shelf}</span>
            {location.level?.name_fr && (
              <span className="px-2 py-0.5 rounded-lg bg-white/15 text-white/80 text-xs font-medium">{location.level.name_fr}</span>
            )}
            {location.zone?.name_fr && (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold text-white" style={{ background: zoneColor }}>
                {location.zone.name_fr}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center flex-shrink-0 ml-4 transition-colors">
          <Icon d={SVG.x} className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Stats pill */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
          <Icon d={SVG.package} className="w-3.5 h-3.5 text-white/70" />
          <span className="text-white text-xs font-bold">{assignments.length}</span>
          <span className="text-white/70 text-xs">article(s) assigné(s)</span>
        </div>
        {mode === 'select' && hasChanges && (
          <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5">
            {toAddCount > 0 && <span className="text-emerald-300 text-xs font-bold">+{toAddCount}</span>}
            {toRemoveCount > 0 && <span className="text-red-200 text-xs font-bold ml-0.5">-{toRemoveCount}</span>}
            <span className="text-white/70 text-xs ml-0.5">modification(s)</span>
          </div>
        )}
      </div>
    </div>
  );

  // ── VIEW MODE ─────────────────────────────────────────────────────────────

  if (mode === 'view') return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-lg">
        {Header}

        {/* Assigned articles list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                <Icon d={SVG.package} className="w-8 h-8 text-red-200" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600">Aucun article assigné</p>
                <p className="text-xs text-gray-400 mt-1">Cliquez sur « Ajouter des articles » pour commencer</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {assignments.map((asgn) => {
                const art = asgn.sku?.article;
                const isRemoving = removingId === asgn.id;
                return (
                  <div key={asgn.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                      <Icon d={SVG.tag} className="w-5 h-5 text-red-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {art?.name_fr ?? asgn.sku?.sku_code ?? '—'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400 font-mono">
                          {art?.sku_code ?? asgn.sku?.sku_code ?? '—'}
                        </span>
                        {asgn.is_primary_location && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                            <Icon d={SVG.star} className="w-2.5 h-2.5" />Principal
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Star toggle */}
                    <button
                      onClick={() => togglePrimaryView(asgn)}
                      title={asgn.is_primary_location ? 'Retirer comme principal' : 'Définir comme principal'}
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        asgn.is_primary_location
                          ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                          : 'bg-gray-100 text-gray-300 hover:bg-amber-50 hover:text-amber-500'
                      }`}>
                      <Icon d={SVG.star} className="w-4 h-4" />
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeAssignment(asgn)}
                      disabled={isRemoving}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors disabled:opacity-50">
                      {isRemoving
                        ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-500" />
                        : <Icon d={SVG.x} className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: Ajouter button */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-white transition-colors">
            Fermer
          </button>
          <button
            onClick={enterSelectMode}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50">
            <Icon d={SVG.plus} className="w-4 h-4" />
            Ajouter des articles
          </button>
        </div>
      </div>
    </>
  );

  // ── SELECT MODE ───────────────────────────────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-lg">
        {Header}

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="relative">
            <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher article ou code SKU…"
              className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <Icon d={SVG.x} className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            {filteredArticles.length} article(s) — cochez pour assigner à cet emplacement
          </p>
        </div>

        {/* Checkbox list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Aucun article trouvé</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredArticles.map((art) => {
                const isChecked      = checked.has(art.id);
                const hasSku         = !!art.sku_uuid;
                const isPrimary      = hasSku && primarySkuUuids.has(art.sku_uuid);
                const isNewlyAdded   = isChecked && !originalChecked.has(art.id);
                const isNewlyRemoved = !isChecked && originalChecked.has(art.id);

                return (
                  <div
                    key={art.id}
                    onClick={() => toggleCheck(art)}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors select-none ${
                      hasSku ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-40'
                    } ${isChecked ? 'bg-red-50/70' : ''}`}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'
                    }`}>
                      {isChecked && <Icon d={SVG.check} className="w-3 h-3 text-white" />}
                    </div>

                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked ? 'bg-red-100 border border-red-200' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <Icon d={SVG.tag} className={`w-4 h-4 ${isChecked ? 'text-red-500' : 'text-gray-400'}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isChecked ? 'text-red-800' : 'text-gray-800'}`}>
                        {art.name_fr || '—'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">{art.sku_code}</span>
                        {!hasSku && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-semibold">Sans SKU</span>}
                        {isNewlyAdded   && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">+ Ajout</span>}
                        {isNewlyRemoved && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">− Retrait</span>}
                      </div>
                    </div>

                    {/* Star — only when checked */}
                    {isChecked && hasSku && (
                      <button
                        onClick={(e) => togglePrimarySelect(e, art)}
                        title={isPrimary ? 'Retirer comme principal' : 'Définir comme principal'}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isPrimary ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-gray-100 text-gray-300 hover:bg-amber-50 hover:text-amber-500'
                        }`}>
                        <Icon d={SVG.star} className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: cancel + save */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex gap-3">
          <button onClick={() => setMode('view')}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-white transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white flex-shrink-0" />Enregistrement…</>
            ) : (
              <><Icon d={SVG.check} className="w-4 h-4" />
                Valider{hasChanges ? ` (+${toAddCount} / -${toRemoveCount})` : ''}</>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Emplacement Card ──────────────────────────────────────────────────────────

function LocationCard({ loc, onEdit, onDelete, onClick, canManage }) {
  const articleCount = loc._count?.sku_node_locations ?? 0;
  const zoneColor = loc.zone?.color || null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-4 cursor-pointer" onClick={onClick}>
        {/* Label + status */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900 font-mono leading-tight">{loc.label}</h3>
          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ml-2 ${
            loc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {loc.is_active ? 'Actif' : 'Inactif'}
          </span>
        </div>

        {/* Aisle / Shelf */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span>Allée <span className="font-bold text-gray-800">{loc.aisle}</span></span>
          <span className="text-gray-300">·</span>
          <span>Rayon <span className="font-bold text-gray-800">{loc.shelf}</span></span>
        </div>

        {/* Level + Zone badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {loc.level?.name_fr && (
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold">
              {loc.level.name_fr}
            </span>
          )}
          {loc.zone?.name_fr && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white"
              style={{ background: zoneColor || '#dc2626' }}>
              {loc.zone.name_fr}
            </span>
          )}
        </div>

        {/* Article count + cta */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold ${
            articleCount > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'
          }`}>
            <Icon d={SVG.package} className="w-3.5 h-3.5" />
            <span className="font-bold">{articleCount}</span>
            <span>{articleCount === 1 ? 'article' : 'articles'}</span>
          </div>
          <span className="text-[11px] text-red-400 font-semibold ml-auto">Gérer →</span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
          <button onClick={(e) => { e.stopPropagation(); onEdit(loc); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
            <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(loc); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto transition-colors">
            <Icon d={SVG.trash} className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ message, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-2">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('warehouse.manage');

  const [nodes, setNodes]         = useState([]);
  const [zones, setZones]         = useState([]);
  const [levels, setLevels]       = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const [nodesLoading, setNodesLoading] = useState(true);
  const [locsLoading, setLocsLoading]   = useState(false);

  const [nodeSearch, setNodeSearch] = useState('');
  const [locSearch, setLocSearch]   = useState('');

  const [locModal, setLocModal]           = useState(null);
  const [bulkModal, setBulkModal]         = useState(false);
  const [articleDrawer, setArticleDrawer] = useState(null);
  const [deleting, setDeleting]           = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load lookups once
  useEffect(() => {
    setNodesLoading(true);
    Promise.all([getNodes({ limit: 500 }), getZonesList(), getLevelsList()])
      .then(([nRes, zRes, lRes]) => {
        setNodes(nRes.data.data ?? []);
        setZones(zRes.data.data ?? []);
        setLevels(lRes.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => setNodesLoading(false));
  }, []);

  const loadLocations = useCallback(async (nodeId) => {
    if (!nodeId) { setLocations([]); return; }
    setLocsLoading(true);
    try {
      const res = await getLocationsList({ node_id: nodeId });
      setLocations(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLocsLoading(false); }
  }, []);

  useEffect(() => { loadLocations(selectedNode?.id); }, [selectedNode, loadLocations]);

  const handleDeleteLocation = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteLocation(deleting.id);
      toast.success('Emplacement supprimé');
      setDeleting(null);
      loadLocations(selectedNode?.id);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const filteredNodes = nodes.filter((n) => {
    if (!nodeSearch.trim()) return true;
    const q = nodeSearch.toLowerCase();
    return n.name_fr?.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q);
  });

  const filteredLocs = locations.filter((l) => {
    if (!locSearch.trim()) return true;
    const q = locSearch.toLowerCase();
    return l.label?.toLowerCase().includes(q) || l.aisle?.toLowerCase().includes(q) || l.shelf?.toLowerCase().includes(q);
  });

  const totalArticles = locations.reduce((s, l) => s + (l._count?.sku_node_locations ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Modals */}
      {locModal && (
        <LocationFormModal
          location={locModal.location}
          nodeId={selectedNode?.id}
          zones={zones} levels={levels}
          onClose={() => setLocModal(null)}
          onSaved={(newLoc) => { setLocModal(null); loadLocations(selectedNode?.id); if (newLoc) setArticleDrawer(newLoc); }}
        />
      )}
      {bulkModal && (
        <BulkModal
          nodeId={selectedNode?.id}
          zones={zones} levels={levels}
          onClose={() => setBulkModal(false)}
          onDone={() => loadLocations(selectedNode?.id)}
        />
      )}
      {deleting && (
        <DeleteModal
          message={`L'emplacement "${deleting.label}" sera supprimé.`}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDeleteLocation}
          loading={deleteLoading}
        />
      )}
      {articleDrawer && (
        <ArticleDrawer
          location={articleDrawer}
          nodeId={selectedNode?.id}
          onClose={() => setArticleDrawer(null)}
          onUpdated={() => loadLocations(selectedNode?.id)}
        />
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrepôt</h1>
          <p className="text-sm text-gray-400 mt-0.5">Emplacements &amp; affectation des articles</p>
        </div>
        {selectedNode && canManage && (
          <div className="flex items-center gap-3">
            <button onClick={() => setBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100 transition-colors">
              <Icon d={SVG.lightning} className="w-4 h-4" />Génération en lot
            </button>
            <button onClick={() => setLocModal({ location: null })}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">
              <Icon d={SVG.plus} className="w-4 h-4" />Créer emplacement
            </button>
          </div>
        )}
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: Node list ──────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Nœuds / Entrepôts
            </p>
            <div className="relative">
              <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
            {nodesLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600" />
              </div>
            ) : filteredNodes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-10">Aucun nœud trouvé</p>
            ) : filteredNodes.map((node) => {
              const color = node.node_type?.color_badge || '#dc2626';
              const isSelected = selectedNode?.id === node.id;
              return (
                <button key={node.id} onClick={() => { setSelectedNode(node); setLocSearch(''); }}
                  className={`w-full text-left rounded-xl p-3 flex items-center gap-3 transition-all border ${
                    isSelected ? 'border-red-200 bg-red-50 shadow-sm' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                  }`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${color}bb, ${color})` }}>
                    {node.node_type?.icon
                      ? <span className="text-base">{node.node_type.icon}</span>
                      : <Icon d={SVG.node} className="w-5 h-5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-red-700' : 'text-gray-800'}`}>
                      {node.name_fr}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">{node.code}</p>
                    {node.city?.name_fr && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                        <Icon d={SVG.mapPin} className="w-3 h-3 flex-shrink-0" />{node.city.name_fr}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {locations.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {!selectedNode ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-12">
              <div className="w-24 h-24 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center">
                <Icon d={SVG.grid} className="w-12 h-12 text-red-200" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-700 mb-2">Sélectionnez un entrepôt</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Choisissez un nœud dans la liste à gauche pour afficher et gérer ses emplacements.
                </p>
              </div>
              {nodes.length === 0 && !nodesLoading && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                  Aucun nœud configuré — créez d'abord un nœud dans le module Noeuds.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Node info + stats bar */}
              <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-6 flex-shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${selectedNode.node_type?.color_badge || '#dc2626'}bb, ${selectedNode.node_type?.color_badge || '#dc2626'})` }}>
                    {selectedNode.node_type?.icon
                      ? <span className="text-sm">{selectedNode.node_type.icon}</span>
                      : <Icon d={SVG.node} className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-800">{selectedNode.name_fr}</span>
                    <span className="text-xs text-gray-400 font-mono ml-2">{selectedNode.code}</span>
                    {selectedNode.city && <span className="text-xs text-gray-400 ml-2">· {selectedNode.city.name_fr}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-600">{locations.length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Emplacements</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-600">{locations.filter((l) => l.is_active).length}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Actifs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-700">{totalArticles}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Articles assignés</p>
                  </div>
                </div>
              </div>

              {/* Search bar */}
              <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={locSearch}
                    onChange={(e) => setLocSearch(e.target.value)}
                    placeholder="Filtrer par label, allée…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  />
                </div>
                <span className="text-xs text-gray-400 ml-auto">
                  {filteredLocs.length} emplacement{filteredLocs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Emplacements grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {locsLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
                    <p className="text-sm text-gray-400">Chargement…</p>
                  </div>
                ) : filteredLocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                      <Icon d={SVG.grid} className="w-10 h-10 text-red-200" />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600 font-semibold">
                        {locSearch ? 'Aucun emplacement trouvé' : 'Aucun emplacement pour ce nœud'}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {locSearch ? 'Modifiez votre recherche.' : 'Créez des emplacements ou utilisez la génération en lot.'}
                      </p>
                    </div>
                    {!locSearch && canManage && (
                      <div className="flex gap-3">
                        <button onClick={() => setBulkModal(true)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl border border-red-100">
                          <Icon d={SVG.lightning} className="w-4 h-4" />Génération en lot
                        </button>
                        <button onClick={() => setLocModal({ location: null })}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl">
                          <Icon d={SVG.plus} className="w-4 h-4" />Créer emplacement
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredLocs.map((loc) => (
                      <LocationCard
                        key={loc.id}
                        loc={loc}
                        canManage={canManage}
                        onClick={() => setArticleDrawer(loc)}
                        onEdit={(l) => setLocModal({ location: l })}
                        onDelete={(l) => setDeleting(l)}
                      />
                    ))}
                    {canManage && (
                      <button onClick={() => setLocModal({ location: null })}
                        className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-all flex flex-col items-center justify-center gap-3 p-6 min-h-[180px]">
                        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                          <Icon d={SVG.plus} className="w-6 h-6 text-red-500" />
                        </div>
                        <span className="text-sm font-semibold">Ajouter</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
