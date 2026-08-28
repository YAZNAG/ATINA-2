import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Search, Loader2, Lock, Power, PowerOff,
  Map, Building2, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getRegions, createRegion, updateRegion, deleteRegion, getRegionStats,
  getCities, createCity, updateCity, deleteCity,
} from '../../../api/locationNode.api';


const LIST_LIMIT = 500;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const buildStatusParams = (status) => {
  if (status === 'active') return { is_active: true };
  if (status === 'inactive') return { is_active: false };
  if (status === 'deleted') return { is_deleted: true };
  return {};
};

const LEVELS = {
  region: {
    key: 'region',
    label: 'Région',
    labelPlural: 'Régions',
    icon: Map,
    api: { list: getRegions, create: createRegion, update: updateRegion, remove: deleteRegion },
    parentKey: null,
    emptyForm: { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '' },
    fields: [
      { name: 'code', label: 'Code', required: true, col: 'full' },
      { name: 'name_fr', label: 'Nom (FR)', required: true, col: 'half' },
      { name: 'name_ar', label: 'Nom (AR)', required: true, col: 'half', dir: 'rtl' },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea', col: 'full' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', col: 'full', dir: 'rtl' },
    ],
  },
  city: {
    key: 'city',
    label: 'Ville',
    labelPlural: 'Villes',
    icon: Building2,
    api: { list: getCities, create: createCity, update: updateCity, remove: deleteCity },
    parentKey: 'region_id',
    emptyForm: { code: '', name_fr: '', name_ar: '', postal_code: '' },
    fields: [
      { name: 'code', label: 'Code', required: true, col: 'half' },
      { name: 'postal_code', label: 'Code postal', col: 'half' },
      { name: 'name_fr', label: 'Nom (FR)', required: true, col: 'half' },
      { name: 'name_ar', label: 'Nom (AR)', required: true, col: 'half', dir: 'rtl' },
    ],
  },
};

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    error
      ? 'border-[#E10600] focus:ring-[#E10600]/15'
      : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
  }`;

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#E10600]">{error}</span>}
    </label>
  );
}

function StatusDot({ item }) {
  if (item.is_deleted) {
    return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Supprimé</span>;
  }
  if (item.is_active) {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Inactif</span>;
}


export default function GeographyPage({ embedded = false }){
  const { hasPermission } = useAuth();

  const PERMS = {
    region: {
      view: hasPermission('regions.view'),
      create: hasPermission('regions.create'),
      update: hasPermission('regions.update'),
      delete: hasPermission('regions.delete'),
    },
    city: {
      view: hasPermission('cities.view'),
      create: hasPermission('cities.create'),
      update: hasPermission('cities.update'),
      delete: hasPermission('cities.delete'),
    },
  };

  const canView = PERMS.region.view;

  // Listes par niveau
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState({ region: true, city: false });
  const [search, setSearch] = useState({ region: '', city: '' });
  const [status, setStatus] = useState({ region: '', city: '' });

  // Sélection en cascade
  const [selectedRegion, setSelectedRegion] = useState(null);

  // Drawer création / édition
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // { level, mode: 'create'|'edit', id, form }
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState(null); // { level, item }
  const [deleteStats, setDeleteStats] = useState(null);
  const [deleteStatsLoading, setDeleteStatsLoading] = useState(false);
  const [deleteStatsError, setDeleteStatsError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Bascule statut
  const [togglingId, setTogglingId] = useState(null);

  const [mobileStep, setMobileStep] = useState('region');

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRegions = useCallback(async () => {
    if (!canView) return;
    setLoading((l) => ({ ...l, region: true }));
    try {
      const statusParams = buildStatusParams(status.region);
      const { data } = await getRegions({
        limit: LIST_LIMIT,
        ...(search.region && { search: search.region }),
        ...statusParams,
      });
      setRegions(data.data || data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des régions');
    } finally {
      setLoading((l) => ({ ...l, region: false }));
    }
  }, [search.region, status.region, canView]);

  const fetchCities = useCallback(async (regionId) => {
    if (!regionId || !PERMS.city.view) {
      setCities([]);
      return;
    }
    setLoading((l) => ({ ...l, city: true }));
    try {
      const statusParams = buildStatusParams(status.city);
      const { data } = await getCities({
        limit: LIST_LIMIT,
        region_id: regionId,
        ...(search.city && { search: search.city }),
        ...statusParams,
      });
      setCities(data.data || data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des villes');
    } finally {
      setLoading((l) => ({ ...l, city: false }));
    }
  }, [search.city, status.city]);

  useEffect(() => {
    const t = setTimeout(fetchRegions, search.region || status.region ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchRegions]);

  useEffect(() => {
    const t = setTimeout(() => fetchCities(selectedRegion?.id), search.city || status.city ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchCities, selectedRegion, status.city]);

  /* --------------------------- Sélection cascade --------------------------- */

  const selectRegion = (region) => {
    setSelectedRegion(region);
    setMobileStep('city');
  };

  //drawer creation / edition
  const openCreate = (level) => {
    setFormErrors({});
    setDrawer({ level, mode: 'create', id: null, form: { ...LEVELS[level].emptyForm } });
    setDrawerOpen(true);
  };

  const openEdit = (level, item) => {
    setFormErrors({});
    const cfg = LEVELS[level];
    const form = {};
    cfg.fields.forEach((f) => { form[f.name] = item[f.name] ?? ''; });
    setDrawer({ level, mode: 'edit', id: item.id, form });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const handleFieldChange = (name) => (e) => {
    setDrawer((d) => ({ ...d, form: { ...d.form, [name]: e.target.value } }));
    setFormErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const validate = () => {
    const cfg = LEVELS[drawer.level];
    const errs = {};
    cfg.fields.forEach((f) => {
      if (f.required && !String(drawer.form[f.name] || '').trim()) {
        errs[f.name] = `${f.label} requis`;
      }
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const cfg = LEVELS[drawer.level];
    const payload = { ...drawer.form };
    if (cfg.parentKey === 'region_id') payload.region_id = selectedRegion.id;

    setSaving(true);
    try {
      if (drawer.mode === 'edit') {
        await cfg.api.update(drawer.id, payload);
        showToast('success', `${cfg.label} mise à jour`);
      } else {
        await cfg.api.create(payload);
        showToast('success', `${cfg.label} créée`);
      }
      setDrawerOpen(false);
      refreshLevel(drawer.level);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erreur lors de l'enregistrement";
      showToast('error', msg);
      if (err?.response?.status === 409) {
        setFormErrors((errs) => ({ ...errs, code: msg }));
      }
    } finally {
      setSaving(false);
    }
  };

  const refreshLevel = (level) => {
    if (level === 'region') fetchRegions();
    if (level === 'city') fetchCities(selectedRegion?.id);
  };

  // activation / désactivation
  const toggleActive = async (level, item) => {
    const cfg = LEVELS[level];
    setTogglingId(item.id);
    try {
      await cfg.api.update(item.id, { is_active: !item.is_active });
      showToast('success', !item.is_active ? `${cfg.label} activée` : `${cfg.label} désactivée`);
      refreshLevel(level);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  // Suppression
  const prepareDeleteTarget = async (target) => {
    setDeleteTarget(target);
    setDeleteStats(null);
    setDeleteStatsError(null);

    if (target.level === 'region') {
      setDeleteStatsLoading(true);
      try {
        const { data } = await getRegionStats(target.item.id);
        setDeleteStats(data?.data || data);
      } catch (err) {
        setDeleteStatsError(err?.response?.data?.message || 'Impossible de charger les dépendances');
      } finally {
        setDeleteStatsLoading(false);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { level, item } = deleteTarget;
    const cfg = LEVELS[level];
    setDeleting(true);
    try {
      await cfg.api.remove(item.id);
      showToast('success', `${cfg.label} supprimée`);
      setDeleteTarget(null);
      setDeleteStats(null);
      setDeleteStatsError(null);
      if (level === 'region' && selectedRegion?.id === item.id) {
        setSelectedRegion(null);
        setCities([]);
      }
      refreshLevel(level);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  const drawerCfg = drawer ? LEVELS[drawer.level] : null;

  return (
    <div className={embedded ? 'p-6' : 'min-h-screen bg-neutral-50 p-6'}>
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
          }`}
        >
          {toast.message}
        </div>
      )}
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Géographie</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Régions et villes de référence...
          </p>
        </div>
      )}


      {/* Fil d'ariane */}
      <div className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <button
          onClick={() => { setSelectedRegion(null); setCities([]); setMobileStep('region'); }}
          className={`rounded-md px-2 py-1 hover:bg-neutral-100 ${!selectedRegion ? 'font-medium text-neutral-900' : ''}`}
        >
          Régions
        </button>
        {selectedRegion && (
          <>
            <ChevronRight size={14} />
            <span className="rounded-md px-2 py-1 font-medium text-neutral-900">{selectedRegion.name_fr}</span>
          </>
        )}
      </div>

      {/* 2 colonnes en cascade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Column
          level="region"
          mobileVisible={mobileStep === 'region'}
          title="Régions"
          icon={Map}
          items={regions}
          loading={loading.region}
          search={search.region}
          onSearchChange={(v) => setSearch((s) => ({ ...s, region: v }))}
          status={status.region}
          onStatusChange={(v) => setStatus((s) => ({ ...s, region: v }))}
          selectedId={selectedRegion?.id}
          onSelect={selectRegion}
          canView={PERMS.region.view}
          canCreate={PERMS.region.create}
          canUpdate={PERMS.region.update}
          canDelete={PERMS.region.delete}
          togglingId={togglingId}
          onCreate={() => openCreate('region')}
          onEdit={(item) => openEdit('region', item)}
          onDelete={(item) => prepareDeleteTarget({ level: 'region', item })}
          onToggle={(item) => toggleActive('region', item)}
          emptyLabel="Aucune région."
        />

        <Column
          level="city"
          mobileVisible={mobileStep === 'city'}
          title={selectedRegion ? `Villes — ${selectedRegion.name_fr}` : 'Villes'}
          icon={Building2}
          items={cities}
          loading={loading.city}
          search={search.city}
          onSearchChange={(v) => setSearch((s) => ({ ...s, city: v }))}
          status={status.city}
          onStatusChange={(v) => setStatus((s) => ({ ...s, city: v }))}
          canView={PERMS.city.view}
          canCreate={PERMS.city.create}
          canUpdate={PERMS.city.update}
          canDelete={PERMS.city.delete}
          togglingId={togglingId}
          onCreate={() => openCreate('city')}
          onEdit={(item) => openEdit('city', item)}
          onDelete={(item) => prepareDeleteTarget({ level: 'city', item })}
          onToggle={(item) => toggleActive('city', item)}
          disabled={!selectedRegion}
          disabledMessage="Sélectionnez une région pour voir ses villes."
          onBack={() => setMobileStep('region')}
          emptyLabel="Aucune ville pour cette région."
          selectable={false}
        />
      </div>

      {/* Drawer création / édition */}
      <div
        className={`fixed inset-0 z-40 transition-opacity ${
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />

        <div
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">
              {drawer?.mode === 'edit'
                ? `Modifier — ${drawerCfg?.label}`
                : `Nouvelle ${drawerCfg?.label?.toLowerCase() ?? ''}`}
            </h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          {drawer && drawerCfg && (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {drawer.level === 'city' && (
                  <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    Région parente : <span className="font-medium text-neutral-700">{selectedRegion?.name_fr}</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {drawerCfg.fields.map((f) => {
                    const wrapperClass = f.col === 'full' ? 'col-span-2' : 'col-span-1';
                    return (
                      <Field key={f.name} label={f.label} error={formErrors[f.name]} className={wrapperClass}>
                        {f.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            dir={f.dir}
                            value={drawer.form[f.name]}
                            onChange={handleFieldChange(f.name)}
                            className={inputClass(formErrors[f.name])}
                          />
                        ) : (
                          <input
                            dir={f.dir}
                            value={drawer.form[f.name]}
                            onChange={handleFieldChange(f.name)}
                            className={inputClass(formErrors[f.name])}
                          />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {drawer.mode === 'edit' ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modale suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">
              Supprimer {LEVELS[deleteTarget.level].label.toLowerCase()} ?
            </h3>
            <div className="mt-2 text-sm text-neutral-500">
              <p>
                <span className="font-medium text-neutral-700">{deleteTarget.item.name_fr}</span> passera au statut
                "Supprimé".
              </p>
              {deleteTarget.level === 'region' ? (
                <div className="mt-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                  <p className="font-semibold">Pour supprimer cette région, vous devez d'abord supprimer ses villes.</p>
                  {deleteStatsLoading ? (
                    <p className="mt-2">Chargement des dépendances...</p>
                  ) : deleteStatsError ? (
                    <p className="mt-2 text-red-700">{deleteStatsError}</p>
                  ) : (
                    deleteStats && (
                      <p className="mt-2">
                        {deleteStats.city_count} ville{deleteStats.city_count > 1 ? 's' : ''}
                      </p>
                    )
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteStats(null);
                  setDeleteStatsError(null);
                }}
                disabled={deleting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Colonne générique (Régions / Villes)                               */
/* ------------------------------------------------------------------ */

function Column({
  level, title, icon: Icon, items, loading, search, onSearchChange, status, onStatusChange,
  selectedId, onSelect, canView = true, canCreate, canUpdate, canDelete, togglingId,
  onCreate, onEdit, onDelete, onToggle, disabled, disabledMessage,
  onBack, emptyLabel, mobileVisible = true, selectable = true,
}) {
  if (!canView) {
    return (
      <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${mobileVisible ? '' : 'hidden lg:flex'}`}>
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <Icon size={16} className="text-neutral-400" />
          <h2 className="font-poppins text-sm font-semibold text-neutral-800">{title}</h2>
        </div>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-neutral-400">
          <Lock size={20} />
          Vous n'avez pas accès à cette section.
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${mobileVisible ? '' : 'hidden lg:flex'}`}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden">
              <ArrowLeft size={16} />
            </button>
          )}
          <Icon size={16} className="text-neutral-400" />
          <h2 className="font-poppins text-sm font-semibold text-neutral-800">{title}</h2>
        </div>
        {canCreate && (
          <button
            onClick={onCreate}
            disabled={disabled}
            title={disabled ? disabledMessage : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-[#E10600] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            <Plus size={14} />
            Nouvelle
          </button>
        )}
      </div>

      {!disabled && (
        <div className="space-y-2 border-b border-neutral-100 px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher (nom, code)…"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15"
            />
          </div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="max-h-[65vh] min-h-[200px] overflow-y-auto">
        {disabled ? (
          <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-xs text-neutral-400">
            {disabledMessage}
          </div>
        ) : loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-neutral-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-xs text-neutral-400">
            {emptyLabel}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item) => {
              const isDeleted = Boolean(item.is_deleted);
              const isSelected = selectable && selectedId === item.id;
              return (
                <li key={item.id}>
                  <div
                    onClick={() => selectable && !isDeleted && onSelect(item)}
                    className={`group flex items-center justify-between gap-2 px-4 py-2.5 transition ${
                      selectable ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-red-50/60' : 'hover:bg-neutral-50'} ${isDeleted ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm ${isSelected ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                          {item.name_fr}
                        </span>
                        <StatusDot item={item} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                        <span className="font-mono">{item.code}</span>
                        <span dir="rtl">{item.name_ar}</span>
                        {item.postal_code && <span>· {item.postal_code}</span>}
                      </div>
                    </div>

                    {!isDeleted && (canUpdate || canDelete) && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        {canUpdate && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggle(item); }}
                            disabled={togglingId === item.id}
                            title={item.is_active ? 'Désactiver' : 'Activer'}
                            className={`rounded-md p-1.5 transition disabled:opacity-50 ${
                              item.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'
                            }`}
                          >
                            {togglingId === item.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : item.is_active ? (
                              <Power size={14} />
                            ) : (
                              <PowerOff size={14} />
                            )}
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                            title="Modifier"
                            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                            title="Supprimer"
                            className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-[#E10600]"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
