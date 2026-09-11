import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Settings2, CreditCard, ListTree, Pencil, Plus, Loader2, Search, Power, PowerOff, ExternalLink, Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import {
  getAppConfigs, getConfigValueTypes, createAppConfig, updateAppConfig,
  getAdminPaymentMethods, createAdminPaymentMethod, updateAdminPaymentMethod, toggleAdminPaymentMethod,
  getLookups,
} from '../../api/admin.api';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Admin / Configuration > App Configs & Méthodes de paiement
 * Onglets : « Paramètres applicatifs » (app_configs globales, node_id NULL),
 * « Méthodes de paiement » (payment_methods, modèle COD), « Lookups » (référentiels enum).
 * Lecture : app_configs.view — Écriture : app_configs.manage (toute modification est auditée).
 */

const TABS = [
  { key: 'configs', label: 'Paramètres applicatifs', icon: Settings2 },
  { key: 'payments', label: 'Méthodes de paiement', icon: CreditCard },
  { key: 'lookups', label: 'Lookups', icon: ListTree },
];

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const typeCode = (row) => String(row?.value_type?.code || 'string').toLowerCase();
const isBool = (c) => c === 'boolean' || c === 'bool';
const isInt = (c) => c === 'integer' || c === 'int';
const isNum = (c) => ['number', 'decimal', 'float'].includes(c);
const isJson = (c) => c === 'json';

/** Affichage lisible d'une valeur typée. */
const displayValue = (row) => {
  const c = typeCode(row);
  const v = row.config_value;
  if (isBool(c)) return v === 'true' ? 'Oui' : 'Non';
  return v;
};

/** Champ de saisie adapté au type de valeur. */
function TypedValueInput({ code, value, onChange }) {
  if (isBool(code)) {
    return (
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="true">Oui (true)</option>
        <option value="false">Non (false)</option>
      </select>
    );
  }
  if (isInt(code) || isNum(code)) {
    return (
      <input type="number" step={isInt(code) ? '1' : 'any'} className="form-input" value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (isJson(code)) {
    return <textarea rows={6} className="form-textarea font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input className="form-input" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Contrôle client (le serveur revalide). */
const validateTyped = (code, value) => {
  const s = String(value ?? '').trim();
  if (s === '') return 'Valeur requise';
  if (isInt(code) && !/^-?\d+$/.test(s)) return 'Un nombre entier est attendu';
  if (isNum(code) && !Number.isFinite(Number(s.replace(',', '.')))) return 'Un nombre est attendu';
  if (isJson(code)) {
    try { JSON.parse(s); } catch { return 'JSON mal formé'; }
  }
  return null;
};

/* ───────────────────────── Onglet Paramètres applicatifs ───────────────────────── */

function ConfigsTab({ canManage }) {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [valueTypes, setValueTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { row } | { row: null } (création)
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAppConfigs({ ...(category && { category }), ...(search.trim() && { search: search.trim() }) });
      setRows(data.data || []);
      setCategories(data.categories || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    getConfigValueTypes().then(({ data }) => setValueTypes(data.data || [])).catch(() => {});
  }, []);

  const openEdit = (row) => {
    setEditing({ row });
    setForm({ config_value: row.config_value ?? '', description: row.description ?? '' });
  };
  const openCreate = () => {
    const def = valueTypes.find((v) => v.code === 'string') || valueTypes[0];
    setEditing({ row: null });
    setForm({ config_key: '', value_type_id: def?.id || '', config_value: '', description: '' });
  };

  const formTypeCode = editing?.row
    ? typeCode(editing.row)
    : String(valueTypes.find((v) => v.id === form.value_type_id)?.code || 'string').toLowerCase();

  const save = async () => {
    const err = validateTyped(formTypeCode, form.config_value);
    if (err) return toast.error(err);
    setSaving(true);
    try {
      if (editing.row) {
        await updateAppConfig(editing.row.id, { config_value: form.config_value, description: form.description });
        toast.success('Paramètre mis à jour');
      } else {
        if (!String(form.config_key || '').trim()) { setSaving(false); return toast.error('Clé de configuration requise'); }
        await createAppConfig(form);
        toast.success('Paramètre créé');
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <label className="form-label">Catégorie</label>
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-72">
          <label className="form-label">Recherche</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className="form-input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Clé, valeur, description…" />
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn-primary ml-auto inline-flex items-center gap-1.5" onClick={openCreate}>
            <Plus size={15} />Nouveau paramètre
          </button>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-xs text-zinc-500">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        Paramètres globaux de l'application. Les frais de livraison et le montant minimum de commande sont définis par node
        (Master Data &gt; Nodes).
      </p>

      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Clé</th>
              <th className="table-th">Catégorie</th>
              <th className="table-th">Type</th>
              <th className="table-th">Valeur</th>
              <th className="table-th">Description</th>
              <th className="table-th">Dernière modification</th>
              {canManage && <th className="table-th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400">Aucun paramètre applicatif.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="table-td font-mono text-xs font-semibold text-zinc-800">
                  {r.config_key}
                  {r.node_level && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">défini par node</span>}
                </td>
                <td className="table-td text-zinc-600">{r.category?.label || '—'}</td>
                <td className="table-td text-xs text-zinc-500">{r.value_type?.name_fr || r.value_type?.code || '—'}</td>
                <td className="table-td max-w-[240px] truncate font-mono text-xs text-zinc-800" title={r.config_value}>{displayValue(r)}</td>
                <td className="table-td max-w-[280px] truncate text-zinc-600" title={r.description || ''}>{r.description || '—'}</td>
                <td className="table-td whitespace-nowrap text-xs text-zinc-500">
                  {fmtDateTime(r.updated_at)}
                  {r.editor && <p className="text-zinc-400">{r.editor.full_name}</p>}
                </td>
                {canManage && (
                  <td className="table-td text-right">
                    <button type="button" className="btn-icon-edit" title="Modifier" onClick={() => openEdit(r)}>
                      <Pencil size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.row ? 'Modifier le paramètre' : 'Nouveau paramètre'}
        subtitle={editing?.row ? editing.row.config_key : 'Paramètre global (tous nodes)'}
        footer={(
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Annuler</button>
            <button type="button" className="btn-primary inline-flex items-center gap-1.5" onClick={save} disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}Enregistrer
            </button>
          </div>
        )}
      >
        {editing && (
          <div className="space-y-4">
            {!editing.row && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Clé *</label>
                  <input
                    className="form-input font-mono"
                    value={form.config_key}
                    onChange={(e) => setForm((f) => ({ ...f, config_key: e.target.value.toLowerCase() }))}
                    placeholder="ex. support_phone"
                  />
                </div>
                <div>
                  <label className="form-label">Type de valeur *</label>
                  <select
                    className="form-select"
                    value={form.value_type_id}
                    onChange={(e) => setForm((f) => ({ ...f, value_type_id: e.target.value, config_value: '' }))}
                  >
                    {valueTypes.length === 0 && <option value="">Aucun type configuré</option>}
                    {valueTypes.map((v) => <option key={v.id} value={v.id}>{v.name_fr} ({v.code})</option>)}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="form-label">Valeur * <span className="font-normal normal-case text-zinc-400">({formTypeCode})</span></label>
              <TypedValueInput
                code={formTypeCode}
                value={isBool(formTypeCode) && form.config_value === '' ? 'false' : form.config_value}
                onChange={(v) => setForm((f) => ({ ...f, config_value: v }))}
              />
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea rows={3} className="form-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            {editing.row && (
              <p className="text-xs text-zinc-400">La modification est tracée dans le journal d'audit (valeur avant / après).</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── Onglet Méthodes de paiement ───────────────────────── */

const EMPTY_METHOD = { code: '', name_fr: '', name_ar: '', description: '' };

function PaymentMethodsTab({ canManage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // { row } | { row: null }
  const [form, setForm] = useState(EMPTY_METHOD);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAdminPaymentMethods();
      setRows(data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing({ row: null }); setForm(EMPTY_METHOD); };
  const openEdit = (row) => {
    setEditing({ row });
    setForm({ code: row.code, name_fr: row.name_fr || '', name_ar: row.name_ar || '', description: row.description || '' });
  };

  const save = async () => {
    if (!editing.row && !form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Libellé FR requis');
    if (!form.name_ar.trim()) return toast.error('Libellé AR requis');
    setSaving(true);
    try {
      if (editing.row) {
        await updateAdminPaymentMethod(editing.row.id, { name_fr: form.name_fr, name_ar: form.name_ar, description: form.description });
        toast.success('Méthode de paiement mise à jour');
      } else {
        await createAdminPaymentMethod(form);
        toast.success('Méthode de paiement ajoutée');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const toggle = async (row) => {
    setBusyId(row.id);
    try {
      await toggleAdminPaymentMethod(row.id);
      toast.success(row.is_active ? 'Méthode de paiement désactivée' : 'Méthode de paiement activée');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-xs text-zinc-500">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          Modèle COD : le paiement à la livraison est la méthode principale. Une méthode désactivée n'est plus proposée au checkout.
        </p>
        {canManage && (
          <button type="button" className="btn-primary inline-flex items-center gap-1.5" onClick={openCreate}>
            <Plus size={15} />Ajouter
          </button>
        )}
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Libellé FR</th>
              <th className="table-th">Libellé AR</th>
              <th className="table-th">Description</th>
              <th className="table-th">Paiements</th>
              <th className="table-th">Statut</th>
              {canManage && <th className="table-th text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400">Aucune méthode de paiement configurée.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="table-td font-mono text-xs font-semibold text-zinc-800">
                  {r.code}
                  {r.code === 'cod' && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">principal</span>}
                </td>
                <td className="table-td text-zinc-800">{r.name_fr}</td>
                <td className="table-td text-zinc-800" dir="rtl">{r.name_ar}</td>
                <td className="table-td max-w-[260px] truncate text-zinc-500" title={r.description || ''}>{r.description || '—'}</td>
                <td className="table-td text-zinc-600">{r.payments_count ?? 0}</td>
                <td className="table-td">
                  <span className={r.is_active ? 'badge-active' : 'badge-inactive'}>{r.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                {canManage && (
                  <td className="table-td">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn-icon-edit" title="Modifier" onClick={() => openEdit(r)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title={r.is_active ? 'Désactiver' : 'Activer'}
                        onClick={() => toggle(r)}
                        disabled={busyId === r.id}
                        className={`rounded-md p-1.5 transition disabled:opacity-50 ${r.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
                      >
                        {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : r.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.row ? 'Modifier la méthode de paiement' : 'Ajouter une méthode de paiement'}
        subtitle={editing?.row ? editing.row.code : ''}
        footer={(
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Annuler</button>
            <button type="button" className="btn-primary inline-flex items-center gap-1.5" onClick={save} disabled={saving}>
              {saving && <Loader2 size={15} className="animate-spin" />}Enregistrer
            </button>
          </div>
        )}
      >
        {editing && (
          <div className="space-y-4">
            {!editing.row && (
              <div>
                <label className="form-label">Code *</label>
                <input
                  className="form-input font-mono"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="ex. cod"
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Libellé FR *</label>
                <input className="form-input" value={form.name_fr} onChange={(e) => setForm((f) => ({ ...f, name_fr: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Libellé AR *</label>
                <input className="form-input" dir="rtl" value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea rows={2} maxLength={255} className="form-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── Onglet Lookups ───────────────────────── */

function LookupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getLookups()
      .then(({ data }) => setGroups(data.data || []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .filter((g) => !type || g.id === type)
      .map((g) => ({
        ...g,
        tables: g.tables.filter((t) => !q || t.label?.toLowerCase().includes(q) || t.table?.toLowerCase().includes(q)),
      }))
      .filter((g) => g.tables.length > 0);
  }, [groups, type, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <label className="form-label">Type</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les référentiels</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-72">
          <label className="form-label">Recherche</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className="form-input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou table…" />
          </div>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-zinc-500">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        Convention : les énumérations (statuts, types) sont des tables de référence. Cliquez sur « Gérer » pour ajouter ou modifier des valeurs.
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" size={22} /></div>
      ) : visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-400">Aucun référentiel trouvé.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((g) => (
            <section key={g.id} className="card overflow-hidden">
              <header className="border-b border-zinc-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-800">{g.title}</h3>
              </header>
              <ul className="divide-y divide-zinc-100">
                {g.tables.map((t) => (
                  <li key={`${g.id}-${t.table}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800">{t.label}</p>
                      <p className="font-mono text-xs text-zinc-400">{t.table}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        {t.count === null || t.count === undefined ? '—' : `${t.count} valeur(s)`}
                      </span>
                      <Link to={t.path} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
                        Gérer<ExternalLink size={12} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function AppSettingsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('app_configs.view');
  const canManage = hasPermission('app_configs.manage');
  const [activeTab, setActiveTab] = useState('configs');

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">App Configs &amp; Méthodes de paiement</h1>
          <p className="page-subtitle">Paramètres applicatifs globaux, méthodes de paiement (COD) et référentiels (lookups).</p>
        </div>
      </div>

      {!canView ? (
        <div className="card p-8 text-center text-sm text-zinc-500">Vous n'avez pas accès à la configuration applicative.</div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-zinc-200">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === t.key ? 'border-red-600 text-red-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Icon size={15} />{t.label}
                </button>
              );
            })}
          </div>
          {activeTab === 'configs' && <ConfigsTab canManage={canManage} />}
          {activeTab === 'payments' && <PaymentMethodsTab canManage={canManage} />}
          {activeTab === 'lookups' && <LookupsTab />}
        </>
      )}
    </div>
  );
}
