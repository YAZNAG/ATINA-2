import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Pencil, Send, Truck, PackageCheck, CheckCheck, Ban, Trash2, Download, Save, Loader2, Boxes, History, X, Coins, Lock,
} from 'lucide-react';
import Modal from '../../components/Modal';
import {
  getPurchaseOrder, updatePurchaseOrder, changePurchaseOrderStatus, cancelPurchaseOrder, deletePurchaseOrder,
} from '../../api/purchasing.api';
import PoLinesEditor, { linesFromItems, linesPayload, linesTotal, newLine } from './components/PoLinesEditor';
import {
  Card, Field, InfoRow, EmptyState, Spinner, PoStatusPill, inputCls, btnPrimary, btnSecondary, btnDanger,
} from './components/PurchasingUi';
import { errMsg, fmtMoney, fmtPrice, fmtQty, fmtDate, fmtDateTime, downloadCsv, csvNum } from './purchasingUtils';

const PIPELINE = ['draft', 'sent', 'in_transit', 'partially_received', 'received'];

const locationLabel = (loc) => {
  if (!loc) return '';
  const path = [loc.aisle, loc.shelf, loc.level?.code].filter(Boolean).join('-');
  return loc.label && loc.label !== path ? `${loc.label} (${path})` : (loc.label || path);
};

function Pipeline({ statuses, current }) {
  if (current === 'cancelled') {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">Bon de commande annulé</p>;
  }
  const idx = PIPELINE.indexOf(current);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PIPELINE.map((code, i) => {
        const st = statuses.find((s) => s.code === code);
        const done = i <= idx;
        return (
          <div key={code} className="flex items-center gap-1">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${i === idx ? 'bg-[#E10600] text-white' : done ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
              {st?.name_fr || code}
            </span>
            {i < PIPELINE.length - 1 && <span className="h-px w-4 bg-neutral-300" />}
          </div>
        );
      })}
    </div>
  );
}

/** Onglet « Détail BC & lignes » : consultation, modification (selon statut), validation, transitions. */
export default function PoDetailTab({ poId, lookups, perms, toast, goTab, onChanged }) {
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(!!poId);
  const [editing, setEditing] = useState(false);
  const [header, setHeader] = useState({ supplier_id: '', node_id: '', expected_at: '', notes: '' });
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [editError, setEditError] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind, title, text, danger }
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const { data } = await getPurchaseOrder(poId);
      setPo(data.data);
    } catch (err) {
      toast('error', errMsg(err, 'Bon de commande introuvable'));
      setPo(null);
    } finally {
      setLoading(false);
    }
  }, [poId, toast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    setHeader({ supplier_id: po.supplier_id, node_id: po.node_id, expected_at: po.expected_at || '', notes: po.notes || '' });
    setLines(po.items.length ? linesFromItems(po.items) : [newLine()]);
    setEditError('');
    setEditing(true);
  };

  const saveEdit = async () => {
    setEditError('');
    const payload = { expected_at: header.expected_at || null, notes: header.notes || null };
    if (po.can_change_parties) {
      payload.supplier_id = header.supplier_id;
      payload.node_id = header.node_id;
    }
    if (po.can_edit_lines) {
      const items = linesPayload(lines);
      if (!items.length) return setEditError('Le BC doit garder au moins une ligne');
      payload.items = items;
    }
    setSaving(true);
    try {
      const { data } = await updatePurchaseOrder(po.id, payload);
      setPo(data.data);
      setEditing(false);
      toast('success', 'Bon de commande mis à jour (total HT recalculé)');
      onChanged?.();
    } catch (err) {
      setEditError(errMsg(err, 'Modification impossible'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (kind) => {
    setBusy(kind);
    try {
      let res;
      if (kind === 'sent' || kind === 'in_transit' || kind === 'received') res = await changePurchaseOrderStatus(po.id, kind);
      else if (kind === 'cancel') res = await cancelPurchaseOrder(po.id, reason || undefined);
      else if (kind === 'delete') {
        await deletePurchaseOrder(po.id);
        toast('success', `BC ${po.reference} supprimé`);
        setConfirm(null);
        onChanged?.();
        goTab('list', '');
        return;
      }
      setPo(res.data.data);
      toast('success', res.data.message || 'Statut mis à jour');
      setConfirm(null);
      setReason('');
      onChanged?.();
    } catch (err) {
      toast('error', errMsg(err, 'Action impossible'));
    } finally {
      setBusy('');
    }
  };

  const exportLines = () => {
    downloadCsv(`${po.reference}_lignes.csv`,
      ['Référence BC', 'Fournisseur', 'Node', 'Code SKU', 'SKU', "Unité d'achat", 'Qté commandée', 'Qté reçue', 'Reliquat', 'Prix HT unitaire', 'Total HT ligne'],
      po.items.map((i) => [
        po.reference, po.supplier?.name_fr, po.node?.name_fr, i.sku?.sku_code, i.sku?.name_fr, i.sku?.unit_purchase,
        csvNum(i.qty_ordered), csvNum(i.qty_received), csvNum(i.qty_remaining), csvNum(i.unit_price_ht), csvNum(i.line_total_ht),
      ]));
  };

  if (!poId) {
    return (
      <EmptyState icon={FileText} title="Aucun bon de commande sélectionné">
        <p>Ouvrez un BC depuis la « Liste des BC » ou créez-en un dans « Nouveau BC ».</p>
      </EmptyState>
    );
  }
  if (loading) return <Spinner className="py-24" />;
  if (!po) return <EmptyState icon={FileText} title="Bon de commande introuvable" />;

  const can = (t) => po.allowed_transitions?.includes(t);
  const statusCode = po.status?.code;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-xl font-semibold text-neutral-900">{po.reference}</h2>
              <PoStatusPill status={po.status} />
              {po.is_deleted && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimé</span>}
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {po.supplier?.name_fr} → {po.node?.name_fr} · créé le {fmtDateTime(po.created_at)}{po.created_by_name ? ` par ${po.created_by_name}` : ''}
            </p>
          </div>
          {!editing && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={exportLines}><Download size={16} /> Exporter</button>
              {perms.update && (po.can_edit_header || po.can_edit_lines) && (
                <button type="button" className={btnSecondary} onClick={startEdit}><Pencil size={16} /> Modifier</button>
              )}
              {perms.update && can('sent') && (
                <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => setConfirm({ kind: 'sent', title: 'Valider le bon de commande', text: 'Le BC passe au statut « Envoyé » : les quantités sont comptées « en commande » (qty_incoming) sur le node. Les lignes restent modifiables jusqu\'au passage en transit.' })}>
                  <Send size={16} /> Valider
                </button>
              )}
              {perms.update && can('in_transit') && (
                <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => runAction('in_transit')}>
                  {busy === 'in_transit' ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />} Marquer en transit
                </button>
              )}
              {perms.receive && po.can_receive && (
                <button type="button" className={btnPrimary} onClick={() => goTab('reception', po.id)}><PackageCheck size={16} /> Réceptionner</button>
              )}
              {perms.update && can('received') && (
                <button type="button" className={btnSecondary} disabled={!!busy} onClick={() => setConfirm({ kind: 'received', title: 'Clôturer le BC', text: 'Le reliquat non livré est abandonné et le BC passe au statut « Reçu ». Cette action est définitive.' })}>
                  <CheckCheck size={16} /> Clôturer (solder le reliquat)
                </button>
              )}
              {perms.update && po.can_cancel && (
                <button type="button" className={btnDanger} disabled={!!busy} onClick={() => setConfirm({ kind: 'cancel', title: 'Annuler le bon de commande', text: 'Le BC passe au statut « Annulé » (définitif). Les quantités en commande sont libérées.', danger: true, withReason: true })}>
                  <Ban size={16} /> Annuler le BC
                </button>
              )}
              {perms.update && po.can_delete && (
                <button type="button" className={btnDanger} disabled={!!busy} onClick={() => setConfirm({ kind: 'delete', title: 'Supprimer le bon de commande', text: 'Le BC est annulé puis retiré des listes (suppression logique). Impossible après une réception.', danger: true })}>
                  <Trash2 size={16} /> Supprimer
                </button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4"><Pipeline statuses={lookups.statuses} current={statusCode} /></div>
        {po.is_terminal && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600">
            <Lock size={13} /> Statut terminal « {po.status?.name_fr} » : ce bon de commande n'est plus modifiable.
          </p>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {editError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{editError}</div>}
          <Card title="Modifier le bon de commande">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field label="Fournisseur" hint={po.can_change_parties ? '' : 'Modifiable uniquement en brouillon'}>
                <select value={header.supplier_id} disabled={!po.can_change_parties} onChange={(e) => setHeader((h) => ({ ...h, supplier_id: e.target.value }))} className={inputCls}>
                  {!lookups.suppliers.some((s) => s.id === po.supplier_id) && <option value={po.supplier_id}>{po.supplier?.name_fr}</option>}
                  {lookups.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
                </select>
              </Field>
              <Field label="Node" hint={po.can_change_parties ? '' : 'Modifiable uniquement en brouillon'}>
                <select value={header.node_id} disabled={!po.can_change_parties} onChange={(e) => setHeader((h) => ({ ...h, node_id: e.target.value }))} className={inputCls}>
                  {!lookups.nodes.some((n) => n.id === po.node_id) && <option value={po.node_id}>{po.node?.name_fr}</option>}
                  {lookups.nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
                </select>
              </Field>
              <Field label="Livraison prévue">
                <input type="date" value={header.expected_at} disabled={!po.can_edit_header} onChange={(e) => setHeader((h) => ({ ...h, expected_at: e.target.value }))} className={inputCls} />
              </Field>
              <div />
              <Field label="Notes" className="md:col-span-4">
                <textarea rows={2} value={header.notes} disabled={!po.can_edit_header} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} className={inputCls} />
              </Field>
            </div>
          </Card>
          {po.can_edit_lines ? (
            <Card title="Lignes">
              <PoLinesEditor lines={lines} setLines={setLines} supplierId={header.supplier_id} />
            </Card>
          ) : (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Les lignes ne sont plus modifiables au statut « {po.status?.name_fr} » (modification possible en Brouillon ou Envoyé).
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {po.can_edit_lines && <span className="mr-auto text-sm text-neutral-600">Nouveau total HT : <strong>{fmtMoney(linesTotal(lines))}</strong></span>}
            <button type="button" className={btnSecondary} onClick={() => setEditing(false)} disabled={saving}><X size={16} /> Annuler</button>
            <button type="button" className={btnPrimary} onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card title={`Lignes (${po.items.length})`} className="xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium text-right">Commandée</th>
                    <th className="px-3 py-2 font-medium text-right">Reçue</th>
                    <th className="px-3 py-2 font-medium text-right">Reliquat</th>
                    <th className="px-3 py-2 font-medium text-right">Prix HT</th>
                    <th className="px-3 py-2 font-medium text-right" title="Coût moyen pondéré actuel du SKU sur le node de livraison (par unité de vente)">CUMP actuel</th>
                    <th className="py-2 pl-3 font-medium text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {po.items.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-neutral-400">Aucune ligne.</td></tr>
                  ) : po.items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-mono text-xs text-neutral-500">{i.sku?.sku_code}</p>
                        <p className="font-medium text-neutral-800">{i.sku?.name_fr}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(i.qty_ordered)} <span className="text-xs text-neutral-400">{i.sku?.unit_purchase}</span></td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${i.qty_received >= i.qty_ordered ? 'text-emerald-600' : i.qty_received > 0 ? 'text-amber-600' : 'text-neutral-500'}`}>{fmtQty(i.qty_received)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{fmtQty(i.qty_remaining)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{fmtPrice(i.unit_price_ht)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{i.cump_current != null ? fmtPrice(i.cump_current) : '—'}</td>
                      <td className="py-2.5 pl-3 text-right font-medium tabular-nums text-neutral-900">{fmtMoney(i.line_total_ht)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-neutral-200">
                  <tr>
                    <td colSpan={6} className="py-3 pr-3 text-right text-sm font-semibold text-neutral-700">Total HT</td>
                    <td className="py-3 pl-3 text-right text-base font-bold tabular-nums text-neutral-900">{fmtMoney(po.total_ht)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Informations">
              <InfoRow label="Fournisseur" value={(
                <button type="button" className="text-[#E10600] hover:underline" onClick={() => navigate(`/purchasing/suppliers?tab=detail&id=${po.supplier_id}`)}>
                  {po.supplier?.name_fr}
                </button>
              )} />
              <InfoRow label="Contact" value={[po.supplier?.contact_name, po.supplier?.contact_phone].filter(Boolean).join(' · ') || '—'} />
              <InfoRow label="Conditions de paiement" value={po.supplier?.payment_terms || '—'} />
              <InfoRow label="Node de livraison" value={po.node ? `${po.node.name_fr} (${po.node.code})` : '—'} />
              <InfoRow label="Envoyé au fournisseur" value={po.ordered_at ? fmtDateTime(po.ordered_at) : '—'} />
              <InfoRow label="Livraison prévue" value={fmtDate(po.expected_at)} />
              <InfoRow label="Dernière réception" value={po.received_at ? fmtDateTime(po.received_at) : '—'} />
              <InfoRow label="Réception" value={`${po.progress_pct ?? 0} %`} />
              <InfoRow label="Valeur reçue HT" value={fmtMoney(po.received_value_ht)} />
              {po.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{po.notes}</p>}
            </Card>
          </div>

          <Card
            title={<span className="flex items-center gap-2"><History size={15} /> Réceptions (entrées en stock)</span>}
            className="xl:col-span-3"
            actions={po.receptions?.length ? (
              <>
                <button type="button" className={btnSecondary} onClick={() => navigate(`/stock/moves?po_id=${po.id}`)}><History size={16} /> Mouvements de stock</button>
                <button type="button" className={btnSecondary} onClick={() => navigate('/stock/lots')}><Boxes size={16} /> Lots de stock</button>
              </>
            ) : null}
          >
            {!po.receptions?.length ? (
              <p className="py-4 text-sm text-neutral-400">Aucune réception enregistrée pour ce BC.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium text-right">Entrée stock</th>
                      <th className="px-3 py-2 font-medium">N° lot</th>
                      <th className="px-3 py-2 font-medium">Expiration</th>
                      <th className="px-3 py-2 font-medium text-right">Coût unitaire</th>
                      <th className="px-3 py-2 font-medium">Emplacement</th>
                      <th className="px-3 py-2 font-medium text-right">CUMP après</th>
                      <th className="py-2 pl-3 font-medium">Opérateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {po.receptions.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2 pr-3 text-xs text-neutral-500">{fmtDateTime(m.created_at)}</td>
                        <td className="px-3 py-2"><span className="font-mono text-xs text-neutral-500">{m.sku?.sku_code}</span> {m.sku?.name_fr}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-600">+{fmtQty(m.qty_delta)}</td>
                        <td className="px-3 py-2 text-neutral-600">{m.lot?.lot_number || '—'}</td>
                        <td className="px-3 py-2 text-neutral-600">{fmtDate(m.lot?.expiry_date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{m.lot ? fmtPrice(m.lot.cost_unit) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-neutral-600">{locationLabel(m.location) || <span className="text-neutral-300">—</span>}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{m.cump_after != null ? fmtPrice(m.cump_after) : <span className="text-xs text-neutral-300" title="Pas de snapshot CUMP (méthode FIFO)">FIFO</span>}</td>
                        <td className="py-2 pl-3 text-xs text-neutral-500">{m.operator?.full_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Coins size={15} /> Coût moyen (CUMP) — historique</span>}
            className="xl:col-span-3"
          >
            {!po.cump_history?.length ? (
              <p className="py-4 text-sm text-neutral-400">
                Aucun snapshot de coût pour les SKU de ce BC sur {po.node?.name_fr || 'ce node'} : le CUMP est recalculé à chaque réception
                (méthode CUMP ou SKU sans règle de réappro ; en FIFO, la valorisation est portée par les lots).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Date du calcul</th>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium text-right">CUMP (MAD / unité)</th>
                      <th className="px-3 py-2 font-medium text-right">Qté reçue</th>
                      <th className="py-2 pl-3 font-medium">Réception</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {po.cump_history.map((h) => (
                      <tr key={h.id} className={h.from_this_po ? 'bg-red-50/30' : ''}>
                        <td className="py-2 pr-3 text-xs text-neutral-500">{fmtDateTime(h.computed_at)}</td>
                        <td className="px-3 py-2"><span className="font-mono text-xs text-neutral-500">{h.sku?.sku_code}</span> {h.sku?.name_fr}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-neutral-900">{fmtPrice(h.cump)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{h.move ? `+${fmtQty(h.move.qty_delta)}` : '—'}</td>
                        <td className="py-2 pl-3 text-xs">
                          {h.from_this_po
                            ? <span className="rounded-full bg-[#E10600]/10 px-2 py-0.5 font-medium text-[#E10600]">Ce BC</span>
                            : <span className="font-mono text-neutral-500">{h.move?.reference || '—'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        size="sm"
        title={confirm?.title}
        subtitle={po.reference}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setConfirm(null)} disabled={!!busy}>Retour</button>
            <button type="button" className={confirm?.danger ? btnDanger : btnPrimary} onClick={() => runAction(confirm.kind)} disabled={!!busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Confirmer
            </button>
          </div>
        )}
      >
        <p className="text-sm text-neutral-600">{confirm?.text}</p>
        {confirm?.withReason && (
          <Field label="Motif (facultatif)" className="mt-3">
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} maxLength={500} />
          </Field>
        )}
      </Modal>
    </div>
  );
}
