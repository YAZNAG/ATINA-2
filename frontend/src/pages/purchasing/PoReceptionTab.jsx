import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageCheck, Lock, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Modal from '../../components/Modal';
import { getPurchaseOrder, getPurchaseOrders, receivePurchaseOrder } from '../../api/purchasing.api';
import {
  Card, Field, EmptyState, Spinner, PoStatusPill, inputCls, btnPrimary, btnSecondary,
} from './components/PurchasingUi';
import { errMsg, fmtMoney, fmtPrice, fmtQty, fmtDate, todayIso } from './purchasingUtils';

const RECEIVABLE = 'sent,in_transit,partially_received';

/**
 * Onglet « Réception » (WF #2 / US-054) : qté reçue par ligne, n° de lot, date d'expiration, coût.
 * « Réceptionner » crée les lots et les mouvements d'entrée en stock, met à jour les niveaux
 * de stock et passe le BC en « Partiellement reçu » ou « Reçu ».
 */
export default function PoReceptionTab({ poId, perms, toast, onSelect, onDone }) {
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [lines, setLines] = useState({});
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPurchaseOrders({ status: RECEIVABLE, all: true });
      setQueue(data.data || []);
    } catch (err) {
      toast('error', errMsg(err, 'Chargement des BC à réceptionner impossible'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadPo = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPurchaseOrder(poId);
      const p = data.data;
      setPo(p);
      setLines(Object.fromEntries(p.items.map((i) => [i.id, {
        qty: i.qty_remaining > 0 ? String(i.qty_remaining) : '0',
        lot_number: '',
        expiry_date: '',
        cost_unit: String(i.unit_price_ht ?? ''),
      }])));
    } catch (err) {
      toast('error', errMsg(err, 'Bon de commande introuvable'));
      setPo(null);
    } finally {
      setLoading(false);
    }
  }, [poId, toast]);

  useEffect(() => { if (poId) loadPo(); else loadQueue(); }, [poId, loadPo, loadQueue]);

  const setLine = (id, k, v) => setLines((ls) => ({ ...ls, [id]: { ...ls[id], [k]: v } }));

  const summary = useMemo(() => {
    if (!po) return { count: 0, value: 0, units: 0 };
    let count = 0; let value = 0; let units = 0;
    po.items.forEach((i) => {
      const q = Number(lines[i.id]?.qty) || 0;
      if (q > 0) {
        count += 1;
        value += q * (Number(lines[i.id]?.cost_unit) || 0);
        units += q * (Number(i.sku?.coeff) || 1);
      }
    });
    return { count, value, units };
  }, [po, lines]);

  if (!perms.receive) {
    return (
      <EmptyState icon={Lock} title="Réception non autorisée">
        <p>La permission purchase_orders.receive est requise.</p>
      </EmptyState>
    );
  }

  // ——— Pas de BC choisi : file des BC réceptionnables ———
  if (!poId) {
    return (
      <Card title="Bons de commande à réceptionner (Envoyé, En transit, Partiellement reçu)">
        {loading ? <Spinner /> : queue.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Aucun bon de commande en attente de réception.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Référence</th>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                  <th className="px-3 py-2 font-medium">Node</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Livraison prévue</th>
                  <th className="px-3 py-2 font-medium text-right">Total HT</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {queue.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold">{q.reference}</td>
                    <td className="px-3 py-2.5">{q.supplier?.name_fr}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{q.node?.name_fr}</td>
                    <td className="px-3 py-2.5"><PoStatusPill status={q.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500">{fmtDate(q.expected_at)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(q.total_ht)}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button type="button" className={btnPrimary} onClick={() => onSelect(q.id)}><PackageCheck size={15} /> Réceptionner</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  if (loading) return <Spinner className="py-24" />;
  if (!po) return <EmptyState icon={PackageCheck} title="Bon de commande introuvable" />;

  if (!po.can_receive) {
    return (
      <EmptyState icon={AlertTriangle} title={`BC ${po.reference} non réceptionnable`}>
        <p>Statut actuel : « {po.status?.name_fr} ». La réception est possible pour un BC Envoyé, En transit ou Partiellement reçu.</p>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => onSelect('')}><ArrowLeft size={16} /> BC à réceptionner</button>
      </EmptyState>
    );
  }

  const validate = () => {
    setError('');
    const today = todayIso();
    for (const i of po.items) {
      const l = lines[i.id];
      const q = Number(l?.qty) || 0;
      if (q < 0) return `${i.sku?.sku_code} : quantité invalide`;
      if (q > i.qty_remaining + 1e-9) return `${i.sku?.sku_code} : quantité reçue (${q}) supérieure au reliquat (${fmtQty(i.qty_remaining)})`;
      if (q > 0 && l.expiry_date && l.expiry_date < today) return `${i.sku?.sku_code} : date d'expiration dépassée`;
      if (q > 0 && l.cost_unit !== '' && Number(l.cost_unit) < 0) return `${i.sku?.sku_code} : coût unitaire invalide`;
    }
    if (!summary.count) return 'Saisissez une quantité reçue sur au moins une ligne';
    return '';
  };

  const openConfirm = () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        received_at: receivedAt || undefined,
        notes: notes || undefined,
        lines: po.items
          .filter((i) => Number(lines[i.id]?.qty) > 0)
          .map((i) => ({
            item_id: i.id,
            qty_received: lines[i.id].qty,
            lot_number: lines[i.id].lot_number || null,
            expiry_date: lines[i.id].expiry_date || null,
            ...(lines[i.id].cost_unit !== '' ? { cost_unit: lines[i.id].cost_unit } : {}),
          })),
      };
      const { data } = await receivePurchaseOrder(po.id, payload);
      toast('success', data.message || 'Réception enregistrée');
      setConfirmOpen(false);
      onDone(data.data);
    } catch (err) {
      setConfirmOpen(false);
      setError(errMsg(err, 'Réception impossible'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-lg font-semibold text-neutral-900">{po.reference}</h2>
            <PoStatusPill status={po.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">{po.supplier?.name_fr} → <strong>{po.node?.name_fr}</strong> · livraison prévue {fmtDate(po.expected_at)} · reçu à {po.progress_pct} %</p>
        </div>
        <button type="button" className={btnSecondary} onClick={() => onSelect('')}><ArrowLeft size={16} /> Autre BC</button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card title="Lignes à réceptionner">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="px-2 py-2 font-medium text-right">Commandée</th>
                <th className="px-2 py-2 font-medium text-right">Déjà reçue</th>
                <th className="w-28 px-2 py-2 font-medium text-right">Qté reçue</th>
                <th className="px-2 py-2 font-medium text-right">Écart</th>
                <th className="w-36 px-2 py-2 font-medium">N° lot</th>
                <th className="w-40 px-2 py-2 font-medium">Date d'expiration</th>
                <th className="w-32 px-2 py-2 font-medium text-right">Coût unit. HT</th>
                <th className="py-2 pl-2 font-medium text-right">Entrée stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {po.items.map((i) => {
                const l = lines[i.id] || {};
                const done = i.qty_remaining <= 0;
                const q = Number(l.qty) || 0;
                const gap = i.qty_received + q - i.qty_ordered;
                const coeff = Number(i.sku?.coeff) || 1;
                return (
                  <tr key={i.id} className={done ? 'opacity-50' : ''}>
                    <td className="py-2.5 pr-3">
                      <p className="font-mono text-xs text-neutral-500">{i.sku?.sku_code}</p>
                      <p className="font-medium text-neutral-800">{i.sku?.name_fr}</p>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmtQty(i.qty_ordered)} <span className="text-xs text-neutral-400">{i.sku?.unit_purchase}</span></td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-neutral-500">{fmtQty(i.qty_received)}</td>
                    {done ? (
                      <td colSpan={5} className="px-2 py-2.5 text-center text-xs font-medium text-emerald-600">Ligne entièrement reçue</td>
                    ) : (
                      <>
                        <td className="px-2 py-2.5">
                          <input type="number" min="0" max={i.qty_remaining} step="0.001" value={l.qty ?? ''} onChange={(e) => setLine(i.id, 'qty', e.target.value)} className={`${inputCls} text-right`} />
                        </td>
                        <td className={`px-2 py-2.5 text-right tabular-nums text-xs font-medium ${gap < 0 ? 'text-amber-600' : gap > 0 ? 'text-[#E10600]' : 'text-emerald-600'}`}>
                          {gap === 0 ? '0' : `${gap > 0 ? '+' : ''}${fmtQty(gap)}`}
                        </td>
                        <td className="px-2 py-2.5">
                          <input value={l.lot_number ?? ''} onChange={(e) => setLine(i.id, 'lot_number', e.target.value)} placeholder="Lot fournisseur" maxLength={100} className={inputCls} />
                        </td>
                        <td className="px-2 py-2.5">
                          <input type="date" min={todayIso()} value={l.expiry_date ?? ''} onChange={(e) => setLine(i.id, 'expiry_date', e.target.value)} className={inputCls} />
                        </td>
                        <td className="px-2 py-2.5">
                          <input type="number" min="0" step="0.0001" value={l.cost_unit ?? ''} onChange={(e) => setLine(i.id, 'cost_unit', e.target.value)} className={`${inputCls} text-right`} />
                        </td>
                      </>
                    )}
                    <td className="py-2.5 pl-2 text-right text-xs tabular-nums text-neutral-600">
                      {done ? '—' : (
                        <>
                          <span className="font-semibold text-neutral-800">+{fmtQty(q * coeff)}</span> {i.sku?.unit_sale || ''}
                          {coeff !== 1 && <span className="block text-neutral-400">({fmtQty(q)} × {coeff})</span>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Écart = total reçu − commandé (négatif : reliquat restant). Coût unitaire en unité d'achat (prérempli avec le prix du BC) ;
          le lot de stock est valorisé par unité de vente (coût ÷ coefficient).
        </p>
      </Card>

      <Card title="Réception">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Date de réception" required>
            <input type="date" max={todayIso()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Commentaire" className="md:col-span-3">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N° de BL, remarques qualité…" maxLength={1000} className={inputCls} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-sm text-neutral-600">
            {summary.count} ligne(s) · valeur reçue {fmtMoney(summary.value)}
          </span>
          <button type="button" className={btnPrimary} onClick={openConfirm} disabled={saving}>
            <PackageCheck size={16} /> Réceptionner (génère l'entrée en stock)
          </button>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        size="sm"
        title="Confirmer la réception"
        subtitle={po.reference}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setConfirmOpen(false)} disabled={saving}>Retour</button>
            <button type="button" className={btnPrimary} onClick={submit} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />} Confirmer la réception
            </button>
          </div>
        )}
      >
        <div className="space-y-2 text-sm text-neutral-600">
          <p>
            {summary.count} ligne(s) seront réceptionnées sur <strong>{po.node?.name_fr}</strong> :
            création des lots, des mouvements d'entrée en stock et mise à jour des niveaux de stock.
          </p>
          <p>Valeur reçue : <strong>{fmtMoney(summary.value)}</strong> · {fmtQty(summary.units)} unité(s) de stock.</p>
          {po.items.some((i) => (Number(lines[i.id]?.qty) || 0) < i.qty_remaining && i.qty_remaining > 0) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">Réception partielle : le BC passera en « Partiellement reçu ».</p>
          )}
          <p className="text-xs text-neutral-400">Les mouvements de stock sont définitifs (journal append-only). Prix du BC pour mémoire : {po.items.map((i) => `${i.sku?.sku_code} ${fmtPrice(i.unit_price_ht)}`).join(' · ')}</p>
        </div>
      </Modal>
    </div>
  );
}
