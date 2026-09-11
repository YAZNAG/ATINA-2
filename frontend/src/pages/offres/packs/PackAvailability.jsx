import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { getPacks, updatePack, activatePack, deactivatePack } from '../../../api/packs.api';
import {
  apiError, nodeLabel, formatDateTime, StatusBadge, VisibilityBadge, ComponentBadge, Toggle, vendableLabel,
} from './packUi';

/**
 * Onglet « Disponibilité & assemblables » (US-098, US-099, US-100, WF #23) :
 * nombre de packs assemblables calculé à la volée sur le node du pack (sans réservation),
 * plafond de vente, quantité vendable et flag d'affichage app (is_available, recalculé par trigger).
 */
export default function PackAvailability({ nodes = [], perms = {}, initialNodeId = '', onOpenPack }) {
  const { canUpdate = false } = perms;
  const [nodeId, setNodeId] = useState(initialNodeId || '');
  const [status, setStatus] = useState('');
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [computedAt, setComputedAt] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [capDraft, setCapDraft] = useState({});   // packId → valeur saisie
  const [rowError, setRowError] = useState({});   // packId → message
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params = { limit: 200 };
      if (nodeId) params.node_id = nodeId;
      if (status) params.status = status;
      const { data } = await getPacks(params);
      setPacks(data.data ?? []);
      setComputedAt(new Date());
    } catch (err) {
      setError(apiError(err, 'Impossible de charger la disponibilité des packs'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [nodeId, status]);

  useEffect(() => { load(); }, [load]);
  // Recalcul read-time périodique (la quantité n'est jamais stockée).
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  function replacePack(p) {
    setPacks((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  }

  async function run(packId, fn) {
    setBusyId(packId);
    setRowError((e) => ({ ...e, [packId]: null }));
    try {
      const { data } = await fn();
      replacePack(data.data);
      return true;
    } catch (err) {
      setRowError((e) => ({ ...e, [packId]: apiError(err, 'Action impossible') }));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const toggleActive = (p, next) => run(p.id, () => (next ? activatePack(p.id) : deactivatePack(p.id)));
  const toggleBackorder = (p, next) => run(p.id, () => updatePack(p.id, { is_backorderable: next }));
  const saveRestock = (p, days) => run(p.id, () => updatePack(p.id, { estimated_restock_days: Number(days || 1) }));

  async function saveCap(p) {
    const raw = capDraft[p.id];
    if (raw === undefined) return;
    const value = raw === '' ? null : Number(raw);
    if (value !== null && value < (p.sold_count ?? 0)) {
      setRowError((e) => ({ ...e, [p.id]: `Valeur minimale acceptée : ${p.sold_count} (packs déjà vendus). Pour arrêter la vente, désactivez le pack.` }));
      return;
    }
    const ok = await run(p.id, () => updatePack(p.id, { max_pack_qty: value }));
    if (ok) setCapDraft((d) => { const n = { ...d }; delete n[p.id]; return n; });
  }

  function toggleRow(id) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 !p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div>
            <label className="form-label">Node</label>
            <select className="form-select sm:!w-64" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Statut</label>
            <select className="form-select sm:!w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Calcul à la volée — {computedAt ? `dernier calcul ${computedAt.toLocaleTimeString('fr-FR')}` : '…'}</span>
          <button type="button" className="btn-secondary" onClick={() => load()}><RefreshCw size={16} /> Rafraîchir</button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <strong>Assemblables</strong> = MIN sur les composants de FLOOR(stock disponible du node / qté du composant) — indicatif, aucune réservation.
        {' '}<strong>Plafond restant</strong> = max_pack_qty − packs vendus. <strong>Qté vendable</strong> = MIN(assemblables, plafond restant) ; en vente en rupture, seul le plafond limite.
        {' '}<strong>Visibilité app</strong> (is_available) = (vente en rupture OU assemblables ≥ 1) ET plafond non atteint — recalculée par trigger et poussée en temps réel.
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th w-8" />
                <th className="table-th">Pack</th>
                <th className="table-th">Node</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Assemblables</th>
                <th className="table-th">Plafond (max_pack_qty)</th>
                <th className="table-th">Vendus</th>
                <th className="table-th">Plafond restant</th>
                <th className="table-th">Qté vendable</th>
                <th className="table-th">Vente en rupture</th>
                <th className="table-th">Visibilité app</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={11} className="table-td py-8 text-center text-slate-400">Chargement…</td></tr>}
              {!loading && packs.length === 0 && (
                <tr><td colSpan={11} className="table-td py-8 text-center text-slate-400">Aucun pack pour ces filtres.</td></tr>
              )}
              {!loading && packs.map((p) => {
                const open = expanded.has(p.id);
                const draft = capDraft[p.id];
                return (
                  <Fragment key={p.id}>
                    <tr className={busyId === p.id ? 'opacity-60' : ''}>
                      <td className="table-td">
                        <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => toggleRow(p.id)} title="Composants">
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="table-td">
                        <button type="button" className="text-left font-medium text-slate-800 hover:text-red-600" onClick={() => onOpenPack?.(p.id)}>{p.name_fr}</button>
                        <div className="text-xs text-slate-400" dir="rtl">{p.name_ar}</div>
                      </td>
                      <td className="table-td whitespace-nowrap">{nodeLabel(p.node, nodes, p.node_id)}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {canUpdate && <Toggle checked={!!p.is_active} disabled={busyId === p.id} onChange={(v) => toggleActive(p, v)} title="Activer / Désactiver" />}
                          <StatusBadge active={p.is_active} />
                        </div>
                      </td>
                      <td className="table-td">
                        <span className={`font-semibold ${p.assemblable_count > 0 ? 'text-slate-800' : 'text-red-600'}`}>{p.assemblable_count}</span>
                      </td>
                      <td className="table-td">
                        {canUpdate ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={p.sold_count ?? 0}
                              className="form-input !w-24 !py-1.5"
                              value={draft !== undefined ? draft : (p.max_pack_qty ?? '')}
                              placeholder="Illimité"
                              onChange={(e) => setCapDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && saveCap(p)}
                            />
                            {draft !== undefined && (
                              <button type="button" className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700" onClick={() => saveCap(p)}>Ajuster</button>
                            )}
                          </div>
                        ) : (p.max_pack_qty ?? 'Illimité')}
                      </td>
                      <td className="table-td">{p.sold_count ?? 0}</td>
                      <td className="table-td">{p.remaining_cap === null || p.remaining_cap === undefined ? 'Illimité' : p.remaining_cap}</td>
                      <td className="table-td font-semibold">{vendableLabel(p)}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <Toggle checked={!!p.is_backorderable} disabled={!canUpdate || busyId === p.id} onChange={(v) => toggleBackorder(p, v)} title="Basculer is_backorderable" />
                          {p.is_backorderable && (
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              <input
                                type="number"
                                min="0"
                                className="form-input !w-16 !py-1"
                                defaultValue={p.estimated_restock_days ?? 1}
                                disabled={!canUpdate}
                                onBlur={(e) => Number(e.target.value) !== Number(p.estimated_restock_days) && saveRestock(p, e.target.value)}
                              />
                              j
                            </label>
                          )}
                        </div>
                      </td>
                      <td className="table-td">
                        <VisibilityBadge visible={p.is_available} />
                        <div className="mt-1 text-[11px] text-slate-400" title="Dernier recalcul du flag par le trigger">
                          {p.availability_updated_at ? `Flag : ${formatDateTime(p.availability_updated_at)}` : 'Flag non calculé'}
                          {p.is_available_flag !== null && p.is_available_flag !== undefined && p.is_available_flag !== p.is_available && ' · écart'}
                        </div>
                      </td>
                    </tr>
                    {rowError[p.id] && (
                      <tr><td colSpan={11} className="bg-red-50 px-4 py-2 text-sm text-red-600">{rowError[p.id]}</td></tr>
                    )}
                    {open && (
                      <tr>
                        <td />
                        <td colSpan={10} className="bg-slate-50 px-4 py-3">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-xs uppercase text-slate-400">
                                <th className="py-1 pr-4 text-left font-medium">SKU</th>
                                <th className="py-1 pr-4 text-left font-medium">Qté / pack</th>
                                <th className="py-1 pr-4 text-left font-medium">Stock dispo (node)</th>
                                <th className="py-1 pr-4 text-left font-medium">Assemblables</th>
                                <th className="py-1 text-left font-medium">État</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(p.items ?? []).map((it) => (
                                <tr key={it.sku_id}>
                                  <td className="py-1 pr-4">{it.sku_code} — {it.name_fr}</td>
                                  <td className="py-1 pr-4">{it.qty}</td>
                                  <td className="py-1 pr-4">{it.stock_available}</td>
                                  <td className={`py-1 pr-4 ${it.assemblable === p.assemblable_count ? 'font-semibold text-slate-800' : ''}`}>{it.assemblable}</td>
                                  <td className="py-1"><ComponentBadge code={it.component_status} label={it.component_status_label} /></td>
                                </tr>
                              ))}
                              {(p.items ?? []).length === 0 && <tr><td colSpan={5} className="py-2 text-slate-400">Aucun composant.</td></tr>}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
