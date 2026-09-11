import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Save } from 'lucide-react';
import {
  getExchangeRule, getExchangeEligibleSkus, createExchangeRule, updateExchangeRule,
  activateExchangeRule, deactivateExchangeRule,
} from '../../../api/pointsExchange.api';
import { apiError, nodeLabel, formatDateTime, RuleStatusBadge, Toggle } from './pxUi';

const EMPTY = { node_id: '', sku_id: '', points_cost: '', max_qty_per_order: '', is_active: true };

/** Onglet « Configuration échange » (WF #19 §3-10, US-087, US-088). */
export default function ExchangeRuleForm({ ruleId, nodes = [], canManage, onSaved, onOpenRule }) {
  const isNew = !ruleId;
  const [rule, setRule] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [existingId, setExistingId] = useState(null);
  const [info, setInfo] = useState(null);
  const [skuSearch, setSkuSearch] = useState('');
  const [skuOptions, setSkuOptions] = useState([]);

  useEffect(() => {
    setError(null); setInfo(null); setExistingId(null);
    if (isNew) { setRule(null); setForm(EMPTY); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    getExchangeRule(ruleId)
      .then(({ data }) => {
        if (cancelled) return;
        const r = data.data;
        setRule(r);
        setForm({
          node_id: r.node_id, sku_id: r.sku_id, points_cost: r.points_cost,
          max_qty_per_order: r.max_qty_per_order ?? '', is_active: r.is_active,
        });
      })
      .catch((err) => !cancelled && setError(apiError(err, 'Règle introuvable')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [ruleId, isNew]);

  // SKU actifs et vendables sur le node choisi.
  useEffect(() => {
    if (!form.node_id) { setSkuOptions([]); return undefined; }
    const t = setTimeout(() => {
      getExchangeEligibleSkus({ node_id: form.node_id, search: skuSearch || undefined, limit: 50 })
        .then(({ data }) => setSkuOptions(data.data ?? []))
        .catch(() => setSkuOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [form.node_id, skuSearch]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    if (!form.node_id) return 'Node obligatoire : une règle d\'échange vaut pour un seul node';
    if (!form.sku_id) return 'SKU obligatoire';
    const pc = Number(form.points_cost);
    if (!Number.isInteger(pc) || pc <= 0) return 'Le coût en points doit être un entier strictement supérieur à 0';
    if (form.max_qty_per_order !== '' && (!Number.isInteger(Number(form.max_qty_per_order)) || Number(form.max_qty_per_order) <= 0)) {
      return 'La quantité max par commande doit être un entier strictement supérieur à 0 (vide = illimité)';
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true); setError(null); setInfo(null); setExistingId(null);
    const payload = {
      node_id: form.node_id,
      sku_id: form.sku_id,
      points_cost: Number(form.points_cost),
      max_qty_per_order: form.max_qty_per_order === '' ? null : Number(form.max_qty_per_order),
    };
    if (isNew) payload.is_active = !!form.is_active;
    try {
      const { data } = isNew ? await createExchangeRule(payload) : await updateExchangeRule(ruleId, payload);
      setInfo(isNew ? 'Règle créée' : 'Règle mise à jour (sans effet sur les commandes déjà confirmées)');
      if (!isNew) setRule(data.data);
      onSaved?.(data.data, { created: isNew });
    } catch (err) {
      setError(apiError(err, "Échec de l'enregistrement"));
      setExistingId(err?.response?.data?.data?.existing_id ?? null);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(next) {
    setError(null);
    try {
      const { data } = next ? await activateExchangeRule(ruleId) : await deactivateExchangeRule(ruleId);
      setRule(data.data);
      setForm((f) => ({ ...f, is_active: data.data.is_active }));
      onSaved?.(data.data, { created: false });
    } catch (err) {
      setError(apiError(err, 'Changement de statut impossible'));
    }
  }

  if (loading) return <div className="card py-12 text-center text-sm text-slate-400">Chargement…</div>;
  if (!isNew && !rule) return <div className="card py-12 text-center text-sm text-red-500">{error || 'Règle introuvable'}</div>;

  const currentSkuMissing = form.sku_id && !skuOptions.some((s) => s.id === form.sku_id) && rule?.sku_id === form.sku_id;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="card space-y-5 !p-5 lg:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Ajouter un SKU échangeable' : `${rule.sku?.name_fr}`}</h2>
            {!isNew && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {rule.sku?.sku_code} · {nodeLabel(rule.node)} <RuleStatusBadge rule={rule} /> · créée le {formatDateTime(rule.created_at)}
              </p>
            )}
          </div>
          {!isNew && canManage && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Toggle checked={!!rule.is_active} onChange={toggleActive} title="Activer / Désactiver" />
              {rule.is_active ? 'Active' : 'Inactive'}
            </label>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
            {existingId && (
              <button type="button" className="ml-2 font-medium underline" onClick={() => onOpenRule?.(existingId)}>Ouvrir la règle existante</button>
            )}
          </div>
        )}
        {info && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}
        {!isNew && rule.warning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {rule.warning}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="form-label">Node *</label>
            <select
              className="form-select"
              value={form.node_id}
              disabled={!canManage}
              onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value, sku_id: isNew ? '' : f.sku_id }))}
            >
              <option value="">— Choisir le node —</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Obligatoire : aucun scope global. Pour plusieurs nodes, une règle par node (duplication depuis la liste).</p>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">SKU *</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="form-input sm:!w-56" placeholder="Rechercher…" value={skuSearch} disabled={!form.node_id || !canManage} onChange={(e) => setSkuSearch(e.target.value)} />
              <select className="form-select flex-1" value={form.sku_id} disabled={!form.node_id || !canManage} onChange={set('sku_id')}>
                <option value="">{form.node_id ? '— SKU actif et vendable sur ce node —' : 'Choisissez d\'abord le node'}</option>
                {currentSkuMissing && <option value={rule.sku_id}>{rule.sku?.sku_code} — {rule.sku?.name_fr} (actuel)</option>}
                {skuOptions.map((s) => {
                  const taken = s.existing_rule_id && s.existing_rule_id !== ruleId;
                  return (
                    <option key={s.id} value={s.id} disabled={taken}>
                      {s.sku_code} — {s.name_fr}{taken ? ' (déjà configuré sur ce node)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Coût en points * (pour 1 unité)</label>
            <input type="number" min="1" step="1" className="form-input" value={form.points_cost} disabled={!canManage} onChange={set('points_cost')} />
          </div>
          <div>
            <label className="form-label">Quota : quantité max par commande</label>
            <input type="number" min="1" step="1" className="form-input" value={form.max_qty_per_order} disabled={!canManage} onChange={set('max_qty_per_order')} placeholder="Vide = illimité" />
          </div>
          {isNew && (
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Toggle checked={form.is_active} disabled={!canManage} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                {form.is_active ? 'Active dès l\'enregistrement' : 'Inactive'}
              </label>
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              <Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-3 !p-5 text-sm text-slate-600">
        <p className="flex items-center gap-2 font-semibold text-slate-700"><Info size={16} /> Règles d'échange</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Modèle <strong>points uniquement</strong> : aucun paiement en espèces.</li>
          <li>Une seule règle non supprimée par couple (node, SKU).</li>
          <li>Le SKU doit être actif et vendable sur le node.</li>
          <li>Modification <strong>non rétroactive</strong> : les commandes confirmées gardent les points figés à la confirmation.</li>
          <li>Aucun point n'est débité et aucun stock n'est réservé par la configuration : le débit n'a lieu qu'à la confirmation de commande.</li>
          <li>Désactiver = retrait temporaire ; supprimer = retrait définitif (le couple redevient créable).</li>
        </ul>
      </div>
    </div>
  );
}
