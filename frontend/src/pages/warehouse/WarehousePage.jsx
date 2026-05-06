import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getZonesList, getLevelsList, getLocations, getLocationsList,
  createLocation, updateLocation, deleteLocation, bulkGenerateLocations,
  getSkuLocations, createSkuLocation, updateSkuLocation, deleteSkuLocation,
} from '../../api/warehouse.api';
import { getNodes } from '../../api/locationNode.api';
import { getSkusList } from '../../api/catalog.api';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

// ── helpers ──────────────────────────────────────────────────────────────────

const LOCATION_EMPTY = { node_id: '', aisle: '', shelf: '', level_id: '', zone_id: '', is_active: true };
const MAPPING_EMPTY = { sku_id: '', node_id: '', location_id: '', is_primary_location: false, is_active: true };

function Badge({ active, labels }) {
  return (
    <span className={active ? 'badge-active' : 'badge-inactive'}>
      {active ? labels[0] : labels[1]}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder = 'Tous' }) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <label className="text-xs text-gray-500">{label}</label>
      <select className="form-select text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Location Form Modal ───────────────────────────────────────────────────────

function LocationFormModal({ location, nodes, zones, levels, onClose, onSaved }) {
  const [form, setForm] = useState(
    location
      ? { node_id: location.node_id, aisle: location.aisle, shelf: location.shelf, level_id: location.level_id, zone_id: location.zone_id ?? '', is_active: location.is_active }
      : { ...LOCATION_EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!location;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.node_id) return toast.error('Node requis');
    if (!form.aisle.trim()) return toast.error('Allée requise');
    if (!form.shelf.trim()) return toast.error('Rayon requis');
    if (!form.level_id) return toast.error('Niveau requis');
    setSaving(true);
    try {
      const payload = { ...form, zone_id: form.zone_id || null };
      if (isEdit) await updateLocation(location.id, payload);
      else await createLocation(payload);
      toast.success(isEdit ? 'Emplacement mis à jour' : 'Emplacement créé');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {isEdit ? `Modifier l'emplacement ${location.label}` : 'Nouvel emplacement'}
          </h2>
          <form id="location-form" onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <div>
                <label className="form-label">Node <span className="text-red-500">*</span></label>
                <select className="form-select" value={form.node_id} onChange={(e) => set('node_id', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} – {n.name_fr}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Allée <span className="text-red-500">*</span></label>
                <input className="form-input uppercase" value={form.aisle} onChange={(e) => set('aisle', e.target.value.toUpperCase())} placeholder="A" />
              </div>
              <div>
                <label className="form-label">Rayon <span className="text-red-500">*</span></label>
                <input className="form-input" value={form.shelf} onChange={(e) => set('shelf', e.target.value)} placeholder="01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Niveau <span className="text-red-500">*</span></label>
                <select className="form-select" value={form.level_id} onChange={(e) => set('level_id', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.name_fr} ({l.code})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Zone</label>
                <select className="form-select" value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}>
                  <option value="">— Aucune —</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr} ({z.code})</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
              Actif
            </label>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Annuler</button>
          <button type="submit" form="location-form" className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Generate Modal ───────────────────────────────────────────────────────

function BulkGenerateModal({ nodes, zones, levels, onClose, onDone }) {
  const [form, setForm] = useState({ node_id: '', aisles: '', shelves: '', zone_id: '' });
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleLevel = (id) =>
    setSelectedLevels((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const parseList = (str) =>
    str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const aisles = parseList(form.aisles);
    const shelves = parseList(form.shelves);
    if (!form.node_id) return toast.error('Node requis');
    if (!aisles.length) return toast.error('Au moins une allée requise');
    if (!shelves.length) return toast.error('Au moins un rayon requis');
    if (!selectedLevels.length) return toast.error('Au moins un niveau requis');
    setSaving(true);
    try {
      const res = await bulkGenerateLocations({
        node_id: form.node_id, aisles, shelves, level_ids: selectedLevels, zone_id: form.zone_id || null,
      });
      setResult(res.data.data ?? res.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body space-y-3">
            <h2 className="text-base font-semibold text-gray-800">Résultat de la génération</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-600 mt-1">Créés</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-amber-600 mt-1">Ignorés</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-red-600 mt-1">Erreurs</p>
              </div>
            </div>
            {result.details?.errors?.length > 0 && (
              <div className="bg-red-50 rounded p-3 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                {result.details.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-primary text-sm" onClick={() => { onDone(); onClose(); }}>Fermer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Génération en lot</h2>
          <p className="text-xs text-gray-500 mb-4">
            Entrez les allées et rayons séparés par des virgules : <code className="bg-gray-100 px-1 rounded">A, B, C</code>
          </p>
          <form id="bulk-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Node <span className="text-red-500">*</span></label>
              <select className="form-select" value={form.node_id} onChange={(e) => set('node_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} – {n.name_fr}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Allées <span className="text-red-500">*</span></label>
                <input className="form-input uppercase" value={form.aisles} onChange={(e) => set('aisles', e.target.value)} placeholder="A, B, C" />
              </div>
              <div>
                <label className="form-label">Rayons <span className="text-red-500">*</span></label>
                <input className="form-input" value={form.shelves} onChange={(e) => set('shelves', e.target.value)} placeholder="01, 02, 03" />
              </div>
            </div>
            <div>
              <label className="form-label">Niveaux <span className="text-red-500">*</span></label>
              <div className="flex flex-wrap gap-2 mt-1">
                {levels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLevel(l.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedLevels.includes(l.id)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {l.name_fr}
                  </button>
                ))}
                {levels.length === 0 && <p className="text-xs text-amber-600">Aucun niveau configuré</p>}
              </div>
            </div>
            <div>
              <label className="form-label">Zone (optionnel)</label>
              <select className="form-select" value={form.zone_id} onChange={(e) => set('zone_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr} ({z.code})</option>)}
              </select>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Annuler</button>
          <button type="submit" form="bulk-form" className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SKU Mapping Form Modal ────────────────────────────────────────────────────

function SkuMappingFormModal({ mapping, nodes, zones, levels, skus, onClose, onSaved }) {
  const isEdit = !!mapping;
  const [form, setForm] = useState(
    isEdit
      ? { node_id: mapping.node_id, sku_id: mapping.sku_id, location_id: mapping.location_id, is_primary_location: mapping.is_primary_location, is_active: mapping.is_active }
      : { ...MAPPING_EMPTY }
  );
  const [locations, setLocations] = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.node_id) { setLocations([]); return; }
    setLoadingLocs(true);
    getLocationsList({ node_id: form.node_id })
      .then((res) => setLocations(res.data.data ?? []))
      .catch(() => setLocations([]))
      .finally(() => setLoadingLocs(false));
  }, [form.node_id]);

  const filteredSkus = skus.filter((s) => {
    if (!skuSearch.trim()) return true;
    const q = skuSearch.toLowerCase();
    return (
      s.sku_code?.toLowerCase().includes(q) ||
      s.article?.name_fr?.toLowerCase().includes(q)
    );
  }).slice(0, 80);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sku_id) return toast.error('SKU requis');
    if (!form.node_id) return toast.error('Node requis');
    if (!form.location_id) return toast.error('Emplacement requis');
    setSaving(true);
    try {
      if (isEdit) await updateSkuLocation(mapping.id, { location_id: form.location_id, is_primary_location: form.is_primary_location, is_active: form.is_active });
      else await createSkuLocation(form);
      toast.success(isEdit ? 'Affectation mise à jour' : 'Affectation créée');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {isEdit ? 'Modifier l\'affectation' : 'Affecter un SKU à un emplacement'}
          </h2>
          <form id="mapping-form" onSubmit={handleSubmit} className="space-y-4">
            {!isEdit && (
              <>
                <div>
                  <label className="form-label">Node <span className="text-red-500">*</span></label>
                  <select className="form-select" value={form.node_id} onChange={(e) => { set('node_id', e.target.value); set('location_id', ''); }}>
                    <option value="">— Choisir —</option>
                    {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} – {n.name_fr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">SKU <span className="text-red-500">*</span></label>
                  <input
                    className="form-input text-sm mb-1"
                    placeholder="Filtrer SKU…"
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                  />
                  <select className="form-select" value={form.sku_id} onChange={(e) => set('sku_id', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {filteredSkus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku_code} – {s.article?.name_fr ?? '?'}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="form-label">
                Emplacement <span className="text-red-500">*</span>
                {loadingLocs && <span className="text-xs text-gray-400 ml-2">chargement…</span>}
              </label>
              <select className="form-select" value={form.location_id} onChange={(e) => set('location_id', e.target.value)} disabled={!form.node_id}>
                <option value="">— Choisir —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} {l.zone ? `(${l.zone.code})` : ''} {l.level ? `[${l.level.code}]` : ''}
                  </option>
                ))}
              </select>
              {!form.node_id && <p className="text-xs text-gray-400 mt-1">Sélectionnez d'abord un node</p>}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_primary_location} onChange={(e) => set('is_primary_location', e.target.checked)} className="rounded" />
                Emplacement principal
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
                Actif
              </label>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Annuler</button>
          <button type="submit" form="mapping-form" className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Affecter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Locations Tab ─────────────────────────────────────────────────────────────

function LocationsTab({ nodes, zones, levels, canManage }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ node_id: '', zone_id: '', level_id: '', is_active: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);
  const LIMIT = 20;

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filters.node_id) params.node_id = filters.node_id;
      if (filters.zone_id) params.zone_id = filters.zone_id;
      if (filters.level_id) params.level_id = filters.level_id;
      if (filters.is_active !== '') params.is_active = filters.is_active;
      if (filters.search.trim()) params.search = filters.search.trim();
      const res = await getLocations(params);
      setRows(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer l'emplacement "${row.label}" ?`)) return;
    try {
      await deleteLocation(row.id);
      toast.success('Emplacement supprimé');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const clearFilters = () => {
    setFilters({ node_id: '', zone_id: '', level_id: '', is_active: '', search: '' });
    setSearchInput('');
    setPage(1);
  };

  const pages = Math.ceil(total / LIMIT);
  const hasFilters = Object.values(filters).some(Boolean);
  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.code} – ${n.name_fr}` }));
  const zoneOptions = zones.map((z) => ({ value: z.id, label: `${z.name_fr} (${z.code})` }));
  const levelOptions = levels.map((l) => ({ value: l.id, label: `${l.name_fr} (${l.code})` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Node" value={filters.node_id} onChange={(v) => setFilter('node_id', v)} options={nodeOptions} />
        <FilterSelect label="Zone" value={filters.zone_id} onChange={(v) => setFilter('zone_id', v)} options={zoneOptions} />
        <FilterSelect label="Niveau" value={filters.level_id} onChange={(v) => setFilter('level_id', v)} options={levelOptions} />
        <FilterSelect label="Statut" value={filters.is_active} onChange={(v) => setFilter('is_active', v)}
          options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFilter('search', searchInput); }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Recherche</label>
            <input className="form-input text-sm" placeholder="Label, allée…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="flex items-end gap-1">
            <button type="submit" className="btn-secondary text-sm">Filtrer</button>
            {hasFilters && <button type="button" className="btn-secondary text-sm" onClick={clearFilters}>Effacer</button>}
          </div>
        </form>
        {canManage && (
          <div className="flex gap-2 ml-auto">
            <button className="btn-secondary text-sm" onClick={() => setModal({ type: 'bulk' })}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 10h16M4 15h16M4 20h10" /></svg>
              Génération en lot
            </button>
            <button className="btn-primary text-sm" onClick={() => setModal({ type: 'form', location: null })}>
              <AddIcon /> Ajouter
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">Label</th>
                  <th className="table-th">Node</th>
                  <th className="table-th">Allée</th>
                  <th className="table-th">Rayon</th>
                  <th className="table-th">Niveau</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">SKU affectés</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Aucun emplacement</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-mono text-sm font-semibold text-gray-800">{row.label}</td>
                    <td className="table-td text-gray-600 text-sm">{row.node?.code ?? '—'}</td>
                    <td className="table-td text-gray-600">{row.aisle}</td>
                    <td className="table-td text-gray-600">{row.shelf}</td>
                    <td className="table-td">
                      {row.level ? <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{row.level.name_fr}</span> : '—'}
                    </td>
                    <td className="table-td">
                      {row.zone ? <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium">{row.zone.code}</span> : '—'}
                    </td>
                    <td className="table-td text-center">
                      <span className="font-semibold text-gray-700">{row._count?.sku_node_locations ?? 0}</span>
                    </td>
                    <td className="table-td">
                      <Badge active={row.is_active} labels={['Actif', 'Inactif']} />
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        {canManage && <EditButton onClick={() => setModal({ type: 'form', location: row })} />}
                        {canManage && <DeleteButton onClick={() => handleDelete(row)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>Page {page} / {pages} ({total} emplacements)</span>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
                <button className="btn-secondary text-xs py-1 px-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal?.type === 'form' && (
        <LocationFormModal
          location={modal.location}
          nodes={nodes} zones={zones} levels={levels}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'bulk' && (
        <BulkGenerateModal
          nodes={nodes} zones={zones} levels={levels}
          onClose={() => setModal(null)}
          onDone={() => load()}
        />
      )}
    </div>
  );
}

// ── SKU Mapping Tab ───────────────────────────────────────────────────────────

function SkuMappingTab({ nodes, zones, levels, canManage }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ node_id: '', zone_id: '', level_id: '', is_active: '', is_primary_location: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);
  const [skus, setSkus] = useState([]);
  const LIMIT = 20;

  useEffect(() => {
    getSkusList().then((r) => setSkus(r.data.data ?? [])).catch(() => {});
  }, []);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filters.node_id) params.node_id = filters.node_id;
      if (filters.zone_id) params.zone_id = filters.zone_id;
      if (filters.level_id) params.level_id = filters.level_id;
      if (filters.is_active !== '') params.is_active = filters.is_active;
      if (filters.is_primary_location !== '') params.is_primary_location = filters.is_primary_location;
      if (filters.search.trim()) params.search = filters.search.trim();
      const res = await getSkuLocations(params);
      setRows(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (row) => {
    const label = row.location?.label ?? row.location_id;
    const sku = row.sku?.sku_code ?? row.sku_id;
    if (!window.confirm(`Supprimer l'affectation SKU ${sku} → ${label} ?`)) return;
    try {
      await deleteSkuLocation(row.id);
      toast.success('Affectation supprimée');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const clearFilters = () => {
    setFilters({ node_id: '', zone_id: '', level_id: '', is_active: '', is_primary_location: '', search: '' });
    setSearchInput('');
    setPage(1);
  };

  const pages = Math.ceil(total / LIMIT);
  const hasFilters = Object.values(filters).some(Boolean);
  const nodeOptions = nodes.map((n) => ({ value: n.id, label: `${n.code} – ${n.name_fr}` }));
  const zoneOptions = zones.map((z) => ({ value: z.id, label: `${z.name_fr} (${z.code})` }));
  const levelOptions = levels.map((l) => ({ value: l.id, label: `${l.name_fr} (${l.code})` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Node" value={filters.node_id} onChange={(v) => setFilter('node_id', v)} options={nodeOptions} />
        <FilterSelect label="Zone" value={filters.zone_id} onChange={(v) => setFilter('zone_id', v)} options={zoneOptions} />
        <FilterSelect label="Niveau" value={filters.level_id} onChange={(v) => setFilter('level_id', v)} options={levelOptions} />
        <FilterSelect label="Statut" value={filters.is_active} onChange={(v) => setFilter('is_active', v)}
          options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]} />
        <FilterSelect label="Principal" value={filters.is_primary_location} onChange={(v) => setFilter('is_primary_location', v)}
          options={[{ value: 'true', label: 'Principal' }, { value: 'false', label: 'Secondaire' }]} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFilter('search', searchInput); }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Recherche</label>
            <input className="form-input text-sm" placeholder="SKU, article, emplacement…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="flex items-end gap-1">
            <button type="submit" className="btn-secondary text-sm">Filtrer</button>
            {hasFilters && <button type="button" className="btn-secondary text-sm" onClick={clearFilters}>Effacer</button>}
          </div>
        </form>
        {canManage && (
          <button className="btn-primary text-sm ml-auto" onClick={() => setModal({ mapping: null })}>
            <AddIcon /> Affecter
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">SKU</th>
                  <th className="table-th">Article</th>
                  <th className="table-th">Node</th>
                  <th className="table-th">Emplacement</th>
                  <th className="table-th">Zone</th>
                  <th className="table-th">Niveau</th>
                  <th className="table-th">Principal</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Aucune affectation</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-mono text-xs font-semibold text-gray-800">{row.sku?.sku_code ?? '—'}</td>
                    <td className="table-td text-sm text-gray-700">{row.sku?.article?.name_fr ?? '—'}</td>
                    <td className="table-td text-sm text-gray-600">{row.node?.code ?? '—'}</td>
                    <td className="table-td font-mono text-sm font-semibold text-gray-800">{row.location?.label ?? '—'}</td>
                    <td className="table-td">
                      {row.location?.zone
                        ? <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600 font-medium">{row.location.zone.code}</span>
                        : '—'}
                    </td>
                    <td className="table-td">
                      {row.location?.level
                        ? <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{row.location.level.name_fr}</span>
                        : '—'}
                    </td>
                    <td className="table-td text-center">
                      {row.is_primary_location
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">Principal</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="table-td">
                      <Badge active={row.is_active} labels={['Actif', 'Inactif']} />
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        {canManage && <EditButton onClick={() => setModal({ mapping: row })} />}
                        {canManage && <DeleteButton onClick={() => handleDelete(row)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>Page {page} / {pages} ({total} affectations)</span>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
                <button className="btn-secondary text-xs py-1 px-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <SkuMappingFormModal
          mapping={modal.mapping}
          nodes={nodes} zones={zones} levels={levels} skus={skus}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'locations', label: 'Emplacements' },
  { key: 'mapping', label: 'Mapping SKU' },
];

export default function WarehousePage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('locations');
  const [nodes, setNodes] = useState([]);
  const [zones, setZones] = useState([]);
  const [levels, setLevels] = useState([]);

  const canManage = hasPermission('warehouse.manage');

  useEffect(() => {
    Promise.all([
      getNodes({ limit: 200 }),
      getZonesList(),
      getLevelsList(),
    ]).then(([nRes, zRes, lRes]) => {
      setNodes(nRes.data.data ?? []);
      setZones(zRes.data.data ?? []);
      setLevels(lRes.data.data ?? []);
    }).catch(() => {});
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Entrepôt</h1>
          <p className="page-subtitle">Emplacements et affectations SKU</p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'locations' && (
        <LocationsTab nodes={nodes} zones={zones} levels={levels} canManage={canManage} />
      )}
      {tab === 'mapping' && (
        <SkuMappingTab nodes={nodes} zones={zones} levels={levels} canManage={canManage} />
      )}
    </div>
  );
}
