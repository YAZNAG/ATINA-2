import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import {
  getExchangeRules, activateExchangeRule, deactivateExchangeRule, deleteExchangeRule, duplicateExchangeRule,
} from '../../../api/pointsExchange.api';
import { apiError, nodeLabel, points, RuleStatusBadge, Toggle, exportCsv } from './pxUi';

const PAGE_SIZE = 20;

/** Onglet « Liste des SKUs échangeables » (WF #19 §2, US-088). */
export default function ExchangeRulesList({ nodes = [], canManage, onEdit, onAdd }) {
  const [filters, setFilters] = useState({ node_id: '', status: '', search: '' });
  const [page, setPage] = useState(1);
  const [rules, setRules] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [delRule, setDelRule] = useState(null);
  const [dupRule, setDupRule] = useState(null);
  const [dupTargets, setDupTargets] = useState([]);
  const [dupActive, setDupActive] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState(null);

  const params = useCallback((extra = {}) => {
    const p = { page, limit: PAGE_SIZE, ...extra };
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getExchangeRules(params());
      setRules(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, pages: 1 });
    } catch (err) {
      setError(apiError(err, 'Impossible de charger le catalogue d\'échange'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);
  useEffect(() => { setPage(1); }, [filters]);

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  async function toggle(rule, next) {
    setBusyId(rule.id);
    setError(null);
    try {
      const { data } = next ? await activateExchangeRule(rule.id) : await deactivateExchangeRule(rule.id);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, ...data.data } : r)));
    } catch (err) {
      setError(apiError(err, 'Changement de statut impossible'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setModalBusy(true);
    setModalError(null);
    try {
      await deleteExchangeRule(delRule.id);
      setDelRule(null);
      setNotice('Règle supprimée : le couple (node, SKU) peut être recréé.');
      load();
    } catch (err) {
      setModalError(apiError(err, 'Suppression impossible'));
    } finally {
      setModalBusy(false);
    }
  }

  async function confirmDuplicate() {
    if (!dupTargets.length) { setModalError('Choisissez au moins un node cible'); return; }
    setModalBusy(true);
    setModalError(null);
    try {
      const { data } = await duplicateExchangeRule(dupRule.id, { node_ids: dupTargets, is_active: dupActive });
      const skipped = data.data?.skipped ?? [];
      setNotice(`${data.message}${skipped.length ? ` — ${skipped.map((s) => `${nodeLabel(nodes.find((n) => n.id === s.node_id))} : ${s.reason}`).join(' ; ')}` : ''}`);
      setDupRule(null);
      load();
    } catch (err) {
      setModalError(apiError(err, 'Duplication impossible'));
    } finally {
      setModalBusy(false);
    }
  }

  async function handleExport() {
    try {
      const { data } = await getExchangeRules(params({ all: true, page: 1 }));
      exportCsv(`sku_echangeables_${new Date().toISOString().slice(0, 10)}.csv`,
        ['SKU', 'Produit', 'Node', 'Coût en points', 'Max par commande', 'Statut', 'Vendable sur le node'],
        (data.data ?? []).map((r) => [
          r.sku?.sku_code, r.sku?.name_fr, nodeLabel(r.node), r.points_cost, r.max_qty_per_order ?? 'Illimité',
          r.is_deleted ? 'Supprimée' : (r.is_active ? 'Active' : 'Inactive'), r.sku_sellable ? 'Oui' : 'Non',
        ]));
    } catch (err) {
      setError(apiError(err, 'Export impossible'));
    }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 !p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="form-label">Node</label>
            <select className="form-select" value={filters.node_id} onChange={setFilter('node_id')}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Statut</label>
            <select className="form-select" value={filters.status} onChange={setFilter('status')}>
              <option value="">Actives et inactives</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deleted">Supprimée</option>
            </select>
          </div>
          <div>
            <label className="form-label">SKU</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="form-input !pl-9" placeholder="Code ou nom du SKU" value={filters.search} onChange={setFilter('search')} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={handleExport}><Download size={16} /> Exporter</button>
          {canManage && (
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              <Plus size={16} /> Ajouter SKU
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {notice && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">SKU</th>
                <th className="table-th">Node</th>
                <th className="table-th">Coût en points</th>
                <th className="table-th">Max par commande</th>
                <th className="table-th">Statut</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={6} className="table-td py-8 text-center text-slate-400">Chargement…</td></tr>}
              {!loading && rules.length === 0 && (
                <tr><td colSpan={6} className="table-td py-10 text-center text-slate-400">Aucun SKU échangeable pour ces filtres.</td></tr>
              )}
              {!loading && rules.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${r.is_deleted ? '' : 'cursor-pointer'}`} onClick={() => !r.is_deleted && onEdit(r.id)}>
                  <td className="table-td">
                    <div className="font-medium text-slate-800">{r.sku?.name_fr}</div>
                    <div className="text-xs text-slate-400">{r.sku?.sku_code}</div>
                    {r.warning && !r.is_deleted && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={12} /> {r.warning}</div>
                    )}
                  </td>
                  <td className="table-td whitespace-nowrap">{nodeLabel(r.node)}</td>
                  <td className="table-td font-semibold text-slate-800">{points(r.points_cost)}</td>
                  <td className="table-td">{r.max_qty_per_order ?? 'Illimité'}</td>
                  <td className="table-td"><RuleStatusBadge rule={r} /></td>
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    {!r.is_deleted && canManage && (
                      <div className="flex items-center justify-end gap-2">
                        <Toggle checked={!!r.is_active} disabled={busyId === r.id} onChange={(v) => toggle(r, v)} title="Activer / Désactiver" />
                        <button type="button" className="btn-icon-edit" title="Modifier" onClick={() => onEdit(r.id)}><Pencil size={15} /></button>
                        <button type="button" className="btn-icon-edit" title="Dupliquer vers d'autres nodes" onClick={() => { setDupRule(r); setDupTargets([]); setDupActive(false); setModalError(null); }}><Copy size={15} /></button>
                        <button type="button" className="btn-icon-delete" title="Supprimer" onClick={() => { setDelRule(r); setModalError(null); }}><Trash2 size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>{pagination.total} règle(s)</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary !py-1.5" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Précédent</button>
              <span className="self-center">Page {page} / {pagination.pages}</span>
              <button type="button" className="btn-secondary !py-1.5" disabled={page >= pagination.pages} onClick={() => setPage((x) => x + 1)}>Suivant</button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!delRule}
        onClose={() => setDelRule(null)}
        title="Supprimer la règle d'échange"
        subtitle={delRule ? `${delRule.sku?.sku_code} · ${nodeLabel(delRule.node)}` : ''}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDelRule(null)} disabled={modalBusy}>Annuler</button>
            <button type="button" className="btn-danger" onClick={confirmDelete} disabled={modalBusy}>{modalBusy ? 'Suppression…' : 'Supprimer'}</button>
          </>
        )}
      >
        <p className="text-sm text-slate-600">
          Le SKU disparaît du catalogue « Échanger mes points » de ce node. Suppression logique : les commandes déjà
          confirmées gardent leurs points dépensés, et le couple (node, SKU) pourra être recréé. Pour un retrait
          temporaire, préférez la désactivation.
        </p>
        {modalError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</div>}
      </Modal>

      <Modal
        open={!!dupRule}
        onClose={() => setDupRule(null)}
        title="Dupliquer vers d'autres nodes"
        subtitle={dupRule ? `${dupRule.sku?.sku_code} · ${points(dupRule.points_cost)}` : ''}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDupRule(null)} disabled={modalBusy}>Annuler</button>
            <button type="button" onClick={confirmDuplicate} disabled={modalBusy || !dupTargets.length} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              <Copy size={16} /> {modalBusy ? 'Duplication…' : 'Dupliquer'}
            </button>
          </>
        )}
      >
        <p className="mb-3 text-sm text-slate-600">Une règle est créée par node cible (même coût, même quota). Le SKU doit être vendable sur chaque node.</p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {nodes.filter((n) => n.id !== dupRule?.node_id).map((n) => (
            <label key={n.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={dupTargets.includes(n.id)}
                onChange={(e) => setDupTargets((t) => (e.target.checked ? [...t, n.id] : t.filter((x) => x !== n.id)))}
              />
              {nodeLabel(n)}
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <Toggle checked={dupActive} onChange={setDupActive} /> Activer immédiatement les copies
        </label>
        {modalError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</div>}
      </Modal>
    </div>
  );
}
