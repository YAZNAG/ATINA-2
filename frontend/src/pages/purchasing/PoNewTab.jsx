import { useEffect, useState } from 'react';
import { Lock, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { createPurchaseOrder } from '../../api/purchasing.api';
import PoLinesEditor, { newLine, linesPayload, linesTotal } from './components/PoLinesEditor';
import { Card, Field, EmptyState, inputCls, btnPrimary, btnSecondary } from './components/PurchasingUi';
import { errMsg, fmtMoney, todayIso, addDaysIso } from './purchasingUtils';

/** Onglet « Nouveau BC » : fournisseur, node, lignes SKU / qté / prix ; Enregistrer (brouillon) ou Valider. */
export default function PoNewTab({ lookups, perms, toast, initialSupplierId, onCreated, onCancel }) {
  const [supplierId, setSupplierId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [expectedTouched, setExpectedTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [saving, setSaving] = useState(null); // 'draft' | 'validate'
  const [error, setError] = useState('');

  const supplier = lookups.suppliers.find((s) => s.id === supplierId);

  useEffect(() => {
    if (initialSupplierId && !supplierId && lookups.suppliers.some((s) => s.id === initialSupplierId)) setSupplierId(initialSupplierId);
  }, [initialSupplierId, lookups.suppliers, supplierId]);

  useEffect(() => {
    if (!nodeId && lookups.nodes.length === 1) setNodeId(lookups.nodes[0].id);
  }, [lookups.nodes, nodeId]);

  // Date de livraison prévue proposée = aujourd'hui + délai fournisseur (tant que non modifiée).
  useEffect(() => {
    if (!expectedTouched) setExpectedAt(supplier ? addDaysIso(todayIso(), supplier.lead_time_days || 0) : '');
  }, [supplier, expectedTouched]);

  if (!perms.create) {
    return (
      <EmptyState icon={Lock} title="Création de BC non autorisée">
        <p>La permission purchase_orders.create est requise.</p>
      </EmptyState>
    );
  }

  const reset = () => {
    setSupplierId(''); setNodeId(lookups.nodes.length === 1 ? lookups.nodes[0].id : ''); setExpectedAt(''); setExpectedTouched(false);
    setNotes(''); setLines([newLine()]); setError('');
  };

  const submit = async (validate) => {
    setError('');
    if (!supplierId) return setError('Choisissez un fournisseur');
    if (!nodeId) return setError('Choisissez le node (dark store) de livraison');
    const items = linesPayload(lines);
    if (!items.length) return setError('Ajoutez au moins une ligne avec un SKU');
    const bad = lines.find((l) => l.sku && !(Number(l.qty_ordered) > 0));
    if (bad) return setError(`Quantité invalide pour ${bad.sku.sku_code}`);
    setSaving(validate ? 'validate' : 'draft');
    try {
      const { data } = await createPurchaseOrder({
        supplier_id: supplierId, node_id: nodeId, expected_at: expectedAt || null, notes: notes || null, items, validate,
      });
      toast('success', validate ? `BC ${data.data.reference} créé et validé (envoyé)` : `BC ${data.data.reference} enregistré en brouillon`);
      reset();
      onCreated(data.data);
    } catch (err) {
      setError(errMsg(err, 'Création du BC impossible'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card title="En-tête du bon de commande">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Fournisseur" required hint={supplier ? `${supplier.payment_terms || 'Conditions non renseignées'} · délai ${supplier.lead_time_days ?? '—'} j` : 'Seuls les fournisseurs actifs sont proposés'}>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Choisir —</option>
              {lookups.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_fr}{s.code ? ` (${s.code})` : ''}</option>)}
            </select>
          </Field>
          <Field label="Node de livraison" required>
            <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={inputCls}>
              <option value="">— Choisir —</option>
              {lookups.nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
            </select>
          </Field>
          <Field label="Livraison prévue" hint="Proposée selon le délai du fournisseur">
            <input type="date" value={expectedAt} onChange={(e) => { setExpectedAt(e.target.value); setExpectedTouched(true); }} className={inputCls} />
          </Field>
          <Field label="Référence">
            <input value="Générée à l'enregistrement (PO-AAAAMMJJ-XXXX)" disabled className={inputCls} />
          </Field>
          <Field label="Notes" className="md:col-span-4">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Instructions de livraison, conditions particulières…" className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card title="Lignes (SKU, quantité en unité d'achat, prix HT)">
        <PoLinesEditor lines={lines} setLines={setLines} supplierId={supplierId} />
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-neutral-600">Total HT : <strong className="text-neutral-900">{fmtMoney(linesTotal(lines))}</strong></span>
        <button type="button" className={btnSecondary} onClick={() => { reset(); onCancel(); }} disabled={!!saving}>Annuler</button>
        <button type="button" className={btnSecondary} onClick={() => submit(false)} disabled={!!saving}>
          {saving === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer en brouillon
        </button>
        <button type="button" className={btnPrimary} onClick={() => submit(true)} disabled={!!saving}>
          {saving === 'validate' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Valider
        </button>
      </div>
    </div>
  );
}
