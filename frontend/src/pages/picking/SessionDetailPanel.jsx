import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, MapPin, Play, RefreshCw, ScanLine, UserCog, XCircle, Repeat, PackageX,
} from 'lucide-react';
import Modal from '../../components/Modal';
import OrderDetailDrawer from '../commandes/OrderDetailDrawer';
import { useAuth } from '../../context/AuthContext';
import {
  getPickingSession, startSession, completeSession, cancelSession, pickItem, substituteItem, outOfStockItem,
} from '../../api/picking.api';
import { getErrorMessage } from '../../utils/helpers';
import ReassignPickerModal from './ReassignPickerModal';
import {
  sessionRef, orderRef, fmtDateTime, fmtMinutes, fmtQty, locationLabel, SESSION_STATUS_STYLE, ITEM_STATUS_STYLE, performanceOf,
} from './pickingUtils';

function ScanModal({ item, onClose, onConfirm }) {
  const [ean, setEan] = useState('');
  const [qty, setQty] = useState(Number(item?.qty_expected ?? 0));
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  if (!item) return null;
  const sku = item.order_item?.sku;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Scanner l'article"
      subtitle={`${sku?.sku_code ?? ''} · EAN attendu ${sku?.ean13 ?? '—'}`}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-danger" onClick={() => onConfirm({ ean, qty })}>Confirmer le prélèvement</button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-800">{sku?.name_fr ?? 'Article'}</p>
        <div>
          <label className="form-label">EAN scanné</label>
          <input ref={ref} className="form-input font-mono" value={ean} onChange={(e) => setEan(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm({ ean, qty })} placeholder="Scanner ou saisir l'EAN" />
        </div>
        <div>
          <label className="form-label">Quantité prélevée (attendue : {fmtQty(item.qty_expected)})</label>
          <input type="number" min="0" step="1" className="form-input" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800">{children}</div>
    </div>
  );
}

/** Onglet « Détail session & items » : items (SKU, qté, emplacement via sku_node_locations, statut, EAN scanné). */
export default function SessionDetailPanel({ sessionId }) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const can = (...codes) => codes.some((c) => hasPermission(c));
  const canManage   = can('picking.update', 'dashboard.view');
  const canReassign = can('picking.update', 'picking.reassign', 'dashboard.view');
  const canQuality  = can('quality_checks.create');

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');
  const [scanItem, setScanItem] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [orderId, setOrderId] = useState(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true); setError('');
    try {
      const r = await getPickingSession(sessionId);
      setSession(r.data?.data ?? null);
    } catch (err) {
      setError(getErrorMessage(err)); setSession(null);
    } finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, msg) => {
    setActing(key);
    try { await fn(); toast.success(msg); await load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(''); }
  };

  if (!sessionId) {
    return (
      <div className="card text-center text-sm text-slate-500">
        Sélectionnez une session dans l'onglet « Sessions en cours » ou « Historique » pour afficher son détail.
      </div>
    );
  }
  if (loading) return <div className="card text-center text-sm text-slate-400">Chargement de la session…</div>;
  if (error || !session) {
    return <div className="card text-center text-sm text-red-600">{error || 'Session introuvable'}</div>;
  }

  const code = session.status?.code;
  const closed = ['completed', 'cancelled'].includes(code);
  const m = session.metrics ?? {};
  const perf = performanceOf(m);
  const items = session.items ?? [];

  return (
    <div className="space-y-5">
      <ScanModalWrapper item={scanItem} onClose={() => setScanItem(null)} onConfirm={({ ean, qty }) => {
        const it = scanItem; setScanItem(null);
        act(`pick-${it.id}`, () => pickItem(it.id, { scanned_ean: ean || undefined, qty_picked: qty }), 'Article prélevé');
      }} />
      {reassignOpen && (
        <ReassignPickerModal session={session} onClose={() => setReassignOpen(false)} onDone={() => { setReassignOpen(false); load(); }} />
      )}
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={load} />

      {/* En-tête session */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-lg font-semibold text-slate-800">{sessionRef(session.id)}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SESSION_STATUS_STYLE[code] ?? 'bg-slate-100 text-slate-600'}`}>{session.status?.name_fr}</span>
              {m.error_count > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><AlertTriangle size={14} />{m.error_count} erreur(s) de scan</span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Commande{' '}
              <button type="button" className="font-mono font-semibold text-red-600 hover:underline" onClick={() => setOrderId(session.order_id)}>
                {orderRef(session.order_id)}
              </button>
              {session.order?.customer?.name ? ` · ${session.order.customer.name}` : ''}
              {session.order?.status?.name_fr ? ` · ${session.order.status.name_fr}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReassign && !closed && (
              <button type="button" className="btn-secondary" onClick={() => setReassignOpen(true)}>
                <UserCog size={16} />{session.picker ? 'Réassigner picker' : 'Affecter un picker'}
              </button>
            )}
            {canQuality && (
              <button type="button" className="btn-secondary" onClick={() => navigate(`/quality/checks?new=1&session=${session.id}`)}>
                <ClipboardCheck size={16} />Contrôle qualité
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={load} title="Rafraîchir"><RefreshCw size={16} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Info label="Node">{session.node ? `${session.node.code} · ${session.node.name_fr}` : '—'}</Info>
          <Info label="Picker">
            {session.picker ? (
              <Link to={`/staff/pickers/${session.picker.id}`} className="text-red-600 hover:underline">{session.picker.name}</Link>
            ) : <span className="font-semibold text-amber-600">Non assigné</span>}
          </Info>
          <Info label="Créée le">{fmtDateTime(session.created_at)}</Info>
          <Info label="Début / fin">{fmtDateTime(session.started_at)} → {fmtDateTime(session.completed_at)}</Info>
          <Info label="Durée">{closed ? fmtMinutes(m.duration_min) : (m.elapsed_min != null ? `${fmtMinutes(m.elapsed_min)} (en cours)` : '—')}</Info>
          <Info label="Progression">{m.items_processed ?? 0} / {m.items_total ?? 0} lignes ({m.progress_pct ?? 0} %)</Info>
          <Info label="Quantités">{fmtQty(m.qty_picked)} prélevées / {fmtQty(m.qty_expected)} attendues{m.accuracy_pct != null ? ` (${m.accuracy_pct} %)` : ''}</Info>
          <Info label="Performance"><span className={`font-semibold ${perf.cls}`}>{perf.label}</span>{m.items_per_min ? ` · ${m.items_per_min} lignes/min` : ''}</Info>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${m.progress_pct ?? 0}%` }} />
        </div>

        {(session.quality_checks?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Contrôles qualité :</span>
            {session.quality_checks.map((q) => (
              <Link key={q.id} to={`/quality/checks/${q.id}`}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${q.result === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {q.check_type?.name_fr} · {q.result.toUpperCase()}{q.score != null ? ` · ${q.score}` : ''}
              </Link>
            ))}
          </div>
        )}

        {/* Actions opérationnelles (normalement pilotées par l'app picker) */}
        {canManage && !closed && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400">Actions opérationnelles :</span>
            {code === 'open' && (
              <button type="button" className="btn-secondary" disabled={!!acting} onClick={() => act('start', () => startSession(session.id, {}), 'Session démarrée')}>
                <Play size={16} />Démarrer
              </button>
            )}
            {code === 'in_progress' && (
              <button type="button" className="btn-secondary" disabled={!!acting} onClick={() => act('complete', () => completeSession(session.id), 'Préparation terminée — commande prête')}>
                <CheckCircle2 size={16} />Terminer
              </button>
            )}
            <button type="button" className="btn-secondary text-rose-600" disabled={!!acting}
              onClick={() => { if (window.confirm('Annuler cette session de préparation ?')) act('cancel', () => cancelSession(session.id), 'Session annulée'); }}>
              <XCircle size={16} />Annuler la session
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="table-wrap">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Items à préparer ({items.length})</h3>
          {code === 'open' && <span className="text-xs text-slate-400">Démarrez la session pour activer le prélèvement.</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">SKU</th>
                <th className="table-th">Emplacement</th>
                <th className="table-th text-right">Qté attendue</th>
                <th className="table-th text-right">Qté prélevée</th>
                <th className="table-th">Statut</th>
                <th className="table-th">EAN scanné</th>
                <th className="table-th">Prélevé le</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr><td colSpan={8} className="table-td py-10 text-center text-slate-400">Aucun item dans cette session.</td></tr>
              ) : items.map((it) => {
                const sku = it.order_item?.sku;
                const loc = it.resolved_location;
                const expectedEan = sku?.ean13;
                const eanOk = it.scanned_ean && expectedEan ? it.scanned_ean === expectedEan : null;
                const short = Number(it.qty_picked) < Number(it.qty_expected);
                const pending = it.status?.code === 'pending';
                return (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="table-td">
                      <p className="font-mono text-xs text-slate-500">{sku?.sku_code ?? '—'}</p>
                      <p className="font-medium text-slate-800">{sku?.name_fr ?? 'Article inconnu'}</p>
                      {sku?.name_ar && <p className="text-xs text-slate-500" dir="rtl">{sku.name_ar}</p>}
                      {expectedEan && <p className="font-mono text-[11px] text-slate-400">EAN {expectedEan}</p>}
                      {it.substitute_sku && <p className="text-xs text-blue-600">Substitut : {it.substitute_sku.sku_code} · {it.substitute_sku.name_fr}</p>}
                    </td>
                    <td className="table-td">
                      {loc ? (
                        <span className="inline-flex items-start gap-1 text-slate-700"><MapPin size={14} className="mt-0.5 shrink-0 text-red-600" />{locationLabel(loc)}</span>
                      ) : <span className="text-slate-400">Non mappé</span>}
                      {it.location_source === 'sku_node_locations' && <p className="text-[11px] text-slate-400">via mapping SKU → emplacement</p>}
                      {(it.sku_locations?.length ?? 0) > 1 && <p className="text-[11px] text-slate-400">{it.sku_locations.length} emplacements pour ce SKU</p>}
                    </td>
                    <td className="table-td text-right font-semibold">{fmtQty(it.qty_expected)}</td>
                    <td className={`table-td text-right font-semibold ${pending ? 'text-slate-400' : short ? 'text-amber-600' : 'text-emerald-600'}`}>{fmtQty(it.qty_picked)}</td>
                    <td className="table-td">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ITEM_STATUS_STYLE[it.status?.code] ?? 'bg-slate-100 text-slate-600'}`}>{it.status?.name_fr ?? '—'}</span>
                    </td>
                    <td className="table-td">
                      {it.scanned_ean ? (
                        <span className={`font-mono text-xs ${eanOk === false ? 'text-rose-600' : 'text-emerald-600'}`}>{it.scanned_ean}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-td text-xs text-slate-500">{fmtDateTime(it.picked_at)}</td>
                    <td className="table-td text-right">
                      {canManage && code === 'in_progress' && pending ? (
                        <div className="flex justify-end gap-1">
                          <button type="button" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Scanner / prélever" disabled={!!acting} onClick={() => setScanItem(it)}><ScanLine size={16} /></button>
                          <button type="button" className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Proposer une substitution" disabled={!!acting}
                            onClick={() => act(`sub-${it.id}`, () => substituteItem(it.id), 'Substitution proposée')}><Repeat size={16} /></button>
                          <button type="button" className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Déclarer une rupture" disabled={!!acting}
                            onClick={() => act(`oos-${it.id}`, () => outOfStockItem(it.id), 'Rupture enregistrée')}><PackageX size={16} /></button>
                        </div>
                      ) : (
                        <button type="button" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline" onClick={() => setOrderId(session.order_id)}>
                          Commande <ExternalLink size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScanModalWrapper({ item, onClose, onConfirm }) {
  if (!item) return null;
  return <ScanModal key={item.id} item={item} onClose={onClose} onConfirm={onConfirm} />;
}
