import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Settings2, CreditCard, LayoutGrid, Pencil, Loader2, Search, Check, X, AlertTriangle, Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import {
  getAppConfigs, updateAppConfig,
  getNodePaymentMethods, setNodePaymentMethod, getPaymentMethodMatrix,
} from '../../api/admin.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Admin / Configuration > App Configs & Méthodes de paiement (classeur 12-09).
 * Onglets : « Paramètres applicatifs » (app_configs, liste de clés FERMÉE — WF #41),
 * « Méthodes de paiement par node » (node_payment_methods — WF #42) et
 * « Synthèse méthodes × nodes » en lecture seule.
 * Lecture : app_configs.view — Écriture : app_configs.manage (toute modification est auditée).
 */

const TABS = [
  { key: 'configs', label: 'Paramètres applicatifs', icon: Settings2 },
  { key: 'payments', label: 'Méthodes de paiement par node', icon: CreditCard },
  { key: 'matrix', label: 'Synthèse méthodes × nodes', icon: LayoutGrid },
];

const asList = (res) => {
  const d = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(d) ? d : (d.data ?? []);
};

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
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { row }
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

  const openEdit = (row) => {
    setEditing({ row });
    setForm({ config_value: row.config_value ?? '', description: row.description ?? '' });
  };

  const formTypeCode = editing?.row ? typeCode(editing.row) : 'string';
  // US-118 : un changement de valeur peut avoir un effet large — on le dit avant.
  const impact = editing?.row?.impact && form.config_value !== editing.row.config_value
    ? editing.row.impact : null;

  const save = async () => {
    const err = validateTyped(formTypeCode, form.config_value);
    if (err) return toast.error(err);
    setSaving(true);
    try {
      await updateAppConfig(editing.row.id, { config_value: form.config_value, description: form.description });
      toast.success('Paramètre mis à jour');
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
      </div>

      <p className="flex items-start gap-1.5 text-xs text-zinc-500">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        Liste de clés fermée : seule la valeur se modifie, aucune clé ne se crée ni ne se supprime ici. Les frais de
        livraison et le montant minimum de commande sont définis par node (Master Data &gt; Nodes).
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
                  {r.spec && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-red-700">classeur</span>}
                  {r.node_level && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-700">défini par node</span>}
                  {r.spec_label && <p className="mt-0.5 font-sans text-[11px] font-normal text-zinc-500">{r.spec_label}</p>}
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
        title="Modifier le paramètre"
        subtitle={editing?.row?.spec_label || editing?.row?.config_key}
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
            <p className="font-mono text-xs text-zinc-500">{editing.row.config_key}</p>
            <div>
              <label className="form-label">Valeur * <span className="font-normal normal-case text-zinc-400">({formTypeCode})</span></label>
              {editing.row.options ? (
                <select
                  className="form-select"
                  value={form.config_value}
                  onChange={(e) => setForm((f) => ({ ...f, config_value: e.target.value }))}
                >
                  {editing.row.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <TypedValueInput
                  code={formTypeCode}
                  value={isBool(formTypeCode) && form.config_value === '' ? 'false' : form.config_value}
                  onChange={(v) => setForm((f) => ({ ...f, config_value: v }))}
                />
              )}
            </div>
            {impact && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{impact}</span>
              </div>
            )}
            <div>
              <label className="form-label">Description</label>
              <textarea rows={3} className="form-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <p className="text-xs text-zinc-400">La modification est tracée dans le journal d'audit (valeur avant / après).</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ──────────────── Onglet Méthodes de paiement par node (WF #42) ──────────────── */

function NodePaymentMethodsTab({ canManage }) {
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getNodes({ limit: 500 })
      .then((res) => {
        const list = asList(res);
        setNodes(list);
        setNodeId((cur) => cur || list[0]?.id || '');
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const load = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const { data } = await getNodePaymentMethods(nodeId);
      setRows(data.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row) => {
    setBusyId(row.payment_method_id);
    try {
      await setNodePaymentMethod(nodeId, row.payment_method_id, !row.is_active);
      toast.success(row.is_active ? 'Méthode désactivée sur ce nœud' : 'Méthode activée sur ce nœud');
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80">
          <label className="form-label">Nœud</label>
          <select className="form-select" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
            {nodes.length === 0 && <option value="">Aucun nœud</option>}
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
          </select>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-zinc-500">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        L'activation d'un moyen de paiement se fait nœud par nœud. Une méthode désactivée dans le catalogue ne peut
        pas être activée ici, et un nœud doit garder au moins une méthode active.
      </p>

      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Méthode</th>
              <th className="table-th">Code</th>
              <th className="table-th">Catalogue</th>
              <th className="table-th">Sur ce nœud</th>
              <th className="table-th">Dernière modification</th>
              {canManage && <th className="table-th text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="table-td py-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="table-td py-10 text-center text-zinc-400">Aucune méthode de paiement.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.payment_method_id} className="hover:bg-zinc-50">
                <td className="table-td font-medium text-zinc-800">
                  {r.name_fr}
                  <p className="text-xs text-zinc-400">{r.name_ar}</p>
                </td>
                <td className="table-td font-mono text-xs text-zinc-500">{r.code}</td>
                <td className="table-td">
                  <span className={`badge ${r.catalog_active ? 'badge-green' : 'badge-gray'}`}>
                    {r.catalog_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="table-td">
                  <span className={`badge ${r.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {r.is_active ? 'Activée' : 'Désactivée'}
                  </span>
                </td>
                <td className="table-td whitespace-nowrap text-xs text-zinc-500">
                  {fmtDateTime(r.updated_at)}
                  {r.updated_by && <p className="text-zinc-400">{r.updated_by}</p>}
                </td>
                {canManage && (
                  <td className="table-td text-right">
                    <button
                      type="button"
                      className={r.is_active ? 'btn-secondary' : 'btn-primary'}
                      disabled={busyId === r.payment_method_id || (!r.catalog_active && !r.is_active)}
                      onClick={() => toggle(r)}
                    >
                      {busyId === r.payment_method_id
                        ? <Loader2 size={14} className="animate-spin" />
                        : (r.is_active ? 'Désactiver' : 'Activer')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────── Onglet Synthèse méthodes × nodes (lecture seule) ────────── */

function PaymentMatrixTab() {
  const [matrix, setMatrix] = useState({ methods: [], nodes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentMethodMatrix()
      .then(({ data }) => setMatrix(data.data || { methods: [], nodes: [] }))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card p-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></div>;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 text-xs text-zinc-500">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        Vue d'ensemble en lecture seule : l'activation se fait dans l'onglet « Méthodes de paiement par node ».
      </p>
      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Nœud</th>
              {matrix.methods.map((m) => (
                <th key={m.id} className="table-th text-center">
                  {m.name_fr}
                  {!m.catalog_active && <p className="text-[10px] font-normal normal-case text-zinc-400">hors catalogue</p>}
                </th>
              ))}
              <th className="table-th text-center">Actives</th>
            </tr>
          </thead>
          <tbody>
            {matrix.nodes.length === 0 ? (
              <tr><td colSpan={matrix.methods.length + 2} className="table-td py-10 text-center text-zinc-400">Aucun nœud.</td></tr>
            ) : matrix.nodes.map((n) => (
              <tr key={n.id} className="hover:bg-zinc-50">
                <td className="table-td font-medium text-zinc-800">
                  {n.name_fr}
                  <p className="font-mono text-xs text-zinc-400">{n.code}</p>
                </td>
                {matrix.methods.map((m) => (
                  <td key={m.id} className="table-td text-center">
                    {n.methods[m.id]
                      ? <Check size={16} className="mx-auto text-emerald-600" aria-label="activée" />
                      : <X size={16} className="mx-auto text-zinc-300" aria-label="désactivée" />}
                  </td>
                ))}
                <td className="table-td text-center font-semibold tabular-nums text-zinc-700">{n.active_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <p className="page-subtitle">Paramètres globaux de la plateforme et activation des moyens de paiement, nœud par nœud.</p>
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
          {activeTab === 'payments' && <NodePaymentMethodsTab canManage={canManage} />}
          {activeTab === 'matrix' && <PaymentMatrixTab />}
        </>
      )}
    </div>
  );
}
