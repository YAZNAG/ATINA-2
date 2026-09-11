import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Download, X, Loader2, ChevronDown, Trash2, Plus,
  Folder, CheckCircle2, AlertCircle, UploadCloud, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getReorderRules,
  getReorderRuleRefs,
  updateReorderRule,
  createReorderRule,
  deleteReorderRule,
  bulkSaveReorderRules,
} from '../../api/stock.api';
import { getReorderThresholds } from '../../api/stockCounts.api';
import { getNodes } from '../../api/locationNode.api';
import { getFamiliesList, getBrandsList, getSku } from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { N, downloadCsv, asList, apiError, todayStamp } from './inventaireUtils';

// Paramètres Stock (Réappro) — WF#8 / US-048.
// Cet écran ne fait QUE paramétrer les seuils : les alertes s'affichent dans
// Niveaux de stock > « Alertes rupture » (US-113). Aucun stock physique modifié ici.

const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(v));

const TABS = [
  { key: 'list', label: 'Liste des règles' },
  { key: 'edit', label: 'Édition règle' },
  { key: 'bulk', label: 'Import en masse' },
];

const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] disabled:opacity-60';
const selectCls = 'appearance-none border rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none';

/**
 * Contrôles de cohérence WF#8 (identiques côté serveur) :
 * safety_stock ≥ 0 ; reorder_point ≥ safety_stock ; economic_qty > 0 ; max_stock ≥ reorder_point si renseigné.
 * Retourne la liste des erreurs (vide si OK).
 */
export function checkRule({ safety_stock, reorder_point, economic_qty, max_stock, lead_time_days, costing_method_id }) {
  const errs = [];
  const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
  if (!isNum(safety_stock) || Number(safety_stock) < 0) errs.push('Stock de sécurité : nombre ≥ 0 requis');
  if (!isNum(reorder_point) || Number(reorder_point) < 0) errs.push('Point de réappro : nombre ≥ 0 requis');
  if (!isNum(economic_qty) || Number(economic_qty) <= 0) errs.push('Quantité économique : doit être > 0');
  if (isNum(safety_stock) && isNum(reorder_point) && Number(reorder_point) < Number(safety_stock))
    errs.push('Le point de réappro doit être ≥ au stock de sécurité');
  if (max_stock !== '' && max_stock !== null && max_stock !== undefined) {
    if (!isNum(max_stock)) errs.push('Stock maximum invalide');
    else if (isNum(reorder_point) && Number(max_stock) < Number(reorder_point)) errs.push('Le stock maximum doit être ≥ au point de réappro');
  }
  if (lead_time_days !== '' && lead_time_days !== undefined && (!Number.isInteger(Number(lead_time_days)) || Number(lead_time_days) < 0))
    errs.push('Délai fournisseur : nombre entier de jours ≥ 0');
  if (!costing_method_id) errs.push('Méthode de valorisation obligatoire');
  return errs;
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-green-500' : 'bg-gray-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

function Field({ label, required, help, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-[#E10600]"> *</span>}
      </span>
      {children}
      {help && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{help}</p>}
    </label>
  );
}

// ─── Onglet « Édition règle » ───────────────────────────────────────────────

function EditRuleTab({ row, rows, refs, nodeId, nodeCode, canManage, onPickSku, onSaved, onBack }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickFilter, setPickFilter] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      safety_stock: row.has_rule ? row.safety_stock : 0,
      reorder_point: row.has_rule ? row.reorder_point : '',
      economic_qty: row.has_rule ? row.economic_qty : '',
      max_stock: row.max_stock ?? '',
      lead_time_days: row.lead_time_days ?? 1,
      costing_method_id: row.costing_method_id ?? (refs.costing_methods?.length === 1 ? refs.costing_methods[0].id : ''),
      preferred_supplier_id: row.preferred_supplier_id ?? '',
      is_active: row.has_rule ? !!row.is_active : true,
    });
    setError('');
  }, [row, refs.costing_methods]);

  const candidates = useMemo(() => {
    const q = pickFilter.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.sku?.article?.sku_code?.toLowerCase().includes(q) || r.sku?.article?.name_fr?.toLowerCase().includes(q))
      .slice(0, 200);
  }, [rows, pickFilter]);

  // Sélection du SKU (création d'une nouvelle règle)
  if (!row) {
    return (
      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-poppins font-semibold text-gray-900 mb-1">Nouvelle règle — choisir le SKU</h3>
        <p className="text-sm text-gray-500 mb-4">
          Node : <span className="font-medium text-[#E10600]">{nodeCode || '—'}</span>. Une seule règle par couple node × SKU :
          choisir un SKU qui a déjà une règle ouvre cette règle en modification.
        </p>
        <div className="relative mb-3 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={pickFilter} onChange={(e) => setPickFilter(e.target.value)} placeholder="Rechercher un SKU vendable sur ce node..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-full focus:ring-2 focus:ring-[#E10600] outline-none" />
        </div>
        <div className="border rounded-lg max-h-96 overflow-y-auto divide-y">
          {candidates.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">Aucun SKU vendable sur ce node pour cette recherche.</p>}
          {candidates.map((r) => (
            <button key={r.sku_id} type="button" onClick={() => onPickSku(r)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between">
              <span><span className="font-medium text-gray-900">{r.sku?.article?.sku_code}</span> — {r.sku?.article?.name_fr}</span>
              <span className={`text-xs ${r.has_rule ? 'text-green-600' : 'text-gray-400'}`}>{r.has_rule ? 'Règle existante' : 'Sans règle'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const errors = checkRule(form);

  const handleSave = async () => {
    setError('');
    if (errors.length) { setError(errors.join(' • ')); return; }
    setSaving(true);
    try {
      const payload = {
        node_id: nodeId,
        sku_id: row.sku_id,
        safety_stock: N(form.safety_stock),
        reorder_point: N(form.reorder_point),
        economic_qty: N(form.economic_qty),
        max_stock: form.max_stock === '' || form.max_stock === null ? null : N(form.max_stock),
        lead_time_days: parseInt(form.lead_time_days, 10) || 0,
        costing_method_id: form.costing_method_id,
        preferred_supplier_id: form.preferred_supplier_id || null,
        is_active: !!form.is_active,
      };
      if (row.has_rule && row.rule_id) await updateReorderRule(row.rule_id, payload);
      else await createReorderRule(payload);
      toast.success('Règle de réappro enregistrée');
      onSaved();
    } catch (e) {
      setError(apiError(e, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row.rule_id) return;
    if (!window.confirm('Supprimer cette règle de réapprovisionnement ? Le couple ne déclenchera plus d\'alerte « sous seuil ».')) return;
    setSaving(true);
    try {
      await deleteReorderRule(row.rule_id);
      toast.success('Règle supprimée');
      onSaved();
    } catch (e) {
      setError(apiError(e, 'Erreur lors de la suppression'));
    } finally {
      setSaving(false);
    }
  };

  const art = row.sku?.article || {};
  const disabled = !canManage || saving;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={15} /> Retour à la liste</button>

      <div className="bg-white border rounded-xl px-6 py-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-poppins font-bold text-lg text-gray-900">{row.has_rule ? 'Modifier la règle' : 'Nouvelle règle'} — {art.name_fr ?? '—'}</h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${form.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {form.is_active ? 'Règle active' : 'Règle inactive'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{art.sku_code ?? '—'} × {nodeCode ?? '—'} (couple UNIQUE){art.family?.name_fr ? ` • ${art.family.name_fr}` : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="border rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Disponible sur {nodeCode ?? '—'}</p>
            <p className="text-xl font-bold text-green-600">{fmt(row.qty_available)}</p>
          </div>
          <div className="border rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Entrant</p>
            <p className="text-xl font-bold text-blue-600">{fmt(row.qty_incoming)}</p>
          </div>
        </div>
      </div>

      {!canManage && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Lecture seule : la permission « stock.manage » est requise pour modifier les règles.</p>}

      <div className="bg-white border rounded-xl px-6 py-5">
        <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-4">Seuils &amp; quantités de réappro</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Stock de sécurité" required help="Matelas minimal (≥ 0) en dessous duquel le stock est jugé critique">
            <input type="number" min="0" step="any" value={form.safety_stock ?? ''} disabled={disabled} onChange={(e) => set('safety_stock', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Point de réapprovisionnement" required help="Niveau de qty_available qui déclenche l'alerte (≥ stock de sécurité)">
            <input type="number" min="0" step="any" value={form.reorder_point ?? ''} disabled={disabled} onChange={(e) => set('reorder_point', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Quantité économique de commande" required help="Quantité optimale (EOQ) suggérée pour le prochain BC (> 0)">
            <input type="number" min="0" step="any" value={form.economic_qty ?? ''} disabled={disabled} onChange={(e) => set('economic_qty', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Stock maximum" help="Vide = pas de plafond ; si renseigné, doit être ≥ point de réappro">
            <input type="number" min="0" step="any" value={form.max_stock ?? ''} placeholder="Pas de plafond" disabled={disabled} onChange={(e) => set('max_stock', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Délai fournisseur (jours)" help="Délai d'appro estimé, sert à anticiper le moment de recommander">
            <input type="number" min="0" step="1" value={form.lead_time_days ?? ''} disabled={disabled} onChange={(e) => set('lead_time_days', e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      <div className="bg-white border rounded-xl px-6 py-5">
        <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-4">Valorisation &amp; fournisseur</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Méthode de valorisation" required help="FIFO ou CUMP, appliquée à ce SKU sur ce node">
            <div className="flex gap-2">
              {(refs.costing_methods || []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => set('costing_method_id', m.id)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border ${form.costing_method_id === m.id ? 'bg-[#E10600] text-white border-transparent' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                >
                  {m.code}
                </button>
              ))}
              {!refs.costing_methods?.length && <span className="text-sm text-gray-400">Aucune méthode de valorisation paramétrée.</span>}
            </div>
          </Field>
          <Field label="Fournisseur préféré" help="Optionnel — fournisseur par défaut des BC de réappro de ce couple">
            <div className="relative">
              <select value={form.preferred_supplier_id ?? ''} disabled={disabled} onChange={(e) => set('preferred_supplier_id', e.target.value)} className={`${inputCls} appearance-none`}>
                <option value="">— Aucun —</option>
                {(refs.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </Field>
        </div>
      </div>

      {(error || (errors.length > 0 && canManage)) && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error || `Contrôles de cohérence : ${errors.join(' • ')}`}
        </div>
      )}

      <div className="bg-white border rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Toggle checked={!!form.is_active} disabled={disabled} onChange={(v) => set('is_active', v)} />
          <span className="text-sm font-medium text-gray-700">Règle active</span>
          <span className="text-xs text-gray-400">(une règle inactive est ignorée par les alertes)</span>
        </div>
        <div className="flex items-center gap-3">
          {row.has_rule && canManage && (
            <button onClick={handleDelete} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 size={15} /> Supprimer
            </button>
          )}
          <button onClick={onBack} disabled={saving} className="text-sm text-gray-500 hover:text-gray-700 font-medium px-2">Annuler</button>
          {canManage && (
            <button onClick={handleSave} disabled={saving || errors.length > 0} className="px-5 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500] disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV ────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'node', 'sku', 'safety_stock', 'reorder_point', 'economic_qty',
  'max_stock', 'lead_time_days', 'costing_method', 'preferred_supplier',
];

// Accepte « ; » (Excel FR) ou « , » comme séparateur (détecté sur l'en-tête)
function parseCsv(text) {
  const lines = text.replace(/^\s+/, '') /* retire BOM UTF-8 et blancs initiaux */.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = !inQuotes;
      } else if (c === sep && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const obj = {};
    header.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
}

const decimal = (v) => (v === '' || v === undefined || v === null ? '' : String(v).replace(',', '.'));

// ─── Onglet « Import en masse » ─────────────────────────────────────────────

function BulkImportTab({ nodes, refs, canManage, onSaved }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const nodeByCode = useMemo(() => Object.fromEntries(nodes.map((n) => [n.code?.toLowerCase(), n])), [nodes]);
  const costingByCode = useMemo(() => Object.fromEntries((refs.costing_methods || []).map((m) => [m.code?.toLowerCase(), m])), [refs.costing_methods]);
  const supplierByCode = useMemo(() => {
    const map = {};
    (refs.suppliers || []).forEach((s) => {
      if (s.code) map[s.code.toLowerCase()] = s;
      if (s.name_fr) map[s.name_fr.toLowerCase()] = s;
    });
    return map;
  }, [refs.suppliers]);

  const resetFile = () => {
    setFileName('');
    setParsedRows([]);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    downloadCsv('modele-regles-reappro.csv', CSV_COLUMNS, [
      [nodes[0]?.code ?? 'NODE01', 'SKU-0001', '5', '10', '24', '60', '2', refs.costing_methods?.[0]?.code ?? 'CUMP', ''],
    ]);
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setMessage({ type: 'error', text: 'Le fichier doit être au format .csv' }); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage({ type: 'error', text: 'Fichier trop volumineux (max 5 Mo)' }); return; }

    setFileName(file.name);
    setMessage(null);
    const raw = parseCsv(await file.text());
    if (!raw.length) { setMessage({ type: 'error', text: 'Le fichier CSV est vide.' }); setParsedRows([]); return; }
    const missing = ['node', 'sku', 'reorder_point', 'economic_qty', 'costing_method'].filter((c) => !(c in raw[0]));
    if (missing.length) { setMessage({ type: 'error', text: `Colonnes manquantes : ${missing.join(', ')}` }); setParsedRows([]); return; }

    const seen = new Set();
    const rows = raw.map((r, i) => {
      const errors = [];
      const node = nodeByCode[(r.node || '').toLowerCase()];
      if (!node) errors.push('node inconnu');
      const skuCode = (r.sku || '').trim();
      if (!skuCode) errors.push('sku manquant');
      const costing = costingByCode[(r.costing_method || '').toLowerCase()];
      if (!costing) errors.push('costing_method inconnu');
      const supplier = r.preferred_supplier ? supplierByCode[r.preferred_supplier.toLowerCase()] : null;
      if (r.preferred_supplier && !supplier) errors.push('preferred_supplier inconnu');
      const k = `${(r.node || '').toLowerCase()}|${skuCode.toLowerCase()}`;
      if (seen.has(k)) errors.push('doublon node × SKU dans le fichier');
      seen.add(k);

      const values = {
        safety_stock: decimal(r.safety_stock) === '' ? 0 : decimal(r.safety_stock),
        reorder_point: decimal(r.reorder_point),
        economic_qty: decimal(r.economic_qty),
        max_stock: decimal(r.max_stock),
        lead_time_days: r.lead_time_days === '' || r.lead_time_days === undefined ? 1 : r.lead_time_days,
        costing_method_id: costing?.id ?? 'x',
      };
      checkRule(values).filter((e) => !/valorisation/.test(e)).forEach((e) => errors.push(e));

      return {
        line: i + 2,
        node_code: r.node,
        sku_code: skuCode,
        node_id: node?.id ?? null,
        safety_stock: N(values.safety_stock),
        reorder_point: N(values.reorder_point),
        economic_qty: N(values.economic_qty),
        max_stock: values.max_stock === '' ? null : N(values.max_stock),
        lead_time_days: parseInt(values.lead_time_days, 10) || 0,
        costing_method_id: costing?.id ?? null,
        preferred_supplier_id: supplier?.id ?? null,
        errors,
      };
    });
    setParsedRows(rows);
  };

  const validCount = parsedRows.filter((r) => !r.errors.length).length;
  const errorCount = parsedRows.length - validCount;

  const handleImport = async () => {
    const payload = parsedRows.filter((r) => !r.errors.length).map((r) => ({
      line: r.line,
      node_id: r.node_id,
      sku_code: r.sku_code,
      safety_stock: r.safety_stock,
      reorder_point: r.reorder_point,
      economic_qty: r.economic_qty,
      max_stock: r.max_stock,
      lead_time_days: r.lead_time_days,
      costing_method_id: r.costing_method_id,
      preferred_supplier_id: r.preferred_supplier_id,
    }));
    if (!payload.length) { setMessage({ type: 'error', text: 'Aucune ligne valide à importer.' }); return; }

    setSaving(true);
    setMessage(null);
    try {
      await bulkSaveReorderRules(payload);
      setMessage({ type: 'success', text: `${payload.length} règle(s) créée(s) ou mise(s) à jour.${errorCount ? ` ${errorCount} ligne(s) en erreur ignorée(s).` : ''}` });
      setParsedRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSaved();
    } catch (e) {
      setMessage({ type: 'error', text: apiError(e, "Erreur lors de l'import.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-3xl bg-white border rounded-xl px-8 py-8">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center mb-4"><Folder size={26} className="text-amber-500" /></div>
          <h3 className="font-poppins font-bold text-lg text-gray-900">Import en masse de règles (CSV)</h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Mapping des colonnes (séparateur « ; » ou « , ») : {CSV_COLUMNS.map((c, i) => (
              <React.Fragment key={c}>
                <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{c}</code>{i < CSV_COLUMNS.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}. « node » = code du node, « sku » = code SKU, « costing_method » = FIFO / CUMP, « preferred_supplier » = code ou nom du fournisseur.
            La validation crée ou met à jour les règles (1 par node × SKU) après les contrôles de cohérence WF#8.
          </p>
          <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#E10600] hover:underline"><Download size={14} /> Télécharger un modèle</button>

          {!canManage && <p className="mt-4 text-sm text-amber-700">Permission « stock.manage » requise pour importer.</p>}

          {canManage && (!fileName ? (
            <button onClick={() => fileInputRef.current?.click()} className="mt-6 w-full border-2 border-dashed border-gray-300 rounded-lg py-8 hover:border-[#E10600]/50 hover:bg-gray-50">
              <span className="block text-sm font-medium text-[#E10600]">Cliquez pour sélectionner un fichier</span>
              <span className="block text-sm text-gray-400 mt-1">.csv (max 5 Mo)</span>
            </button>
          ) : (
            <div className="mt-6 w-full border rounded-lg p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
                <button onClick={resetFile} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              {parsedRows.length > 0 && (
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={13} /> {validCount} valide(s)</span>
                  {errorCount > 0 && <span className="flex items-center gap-1 text-red-500"><AlertCircle size={13} /> {errorCount} en erreur</span>}
                </div>
              )}
            </div>
          ))}

          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

          {message && (
            <div className={`mt-4 w-full text-sm rounded-lg px-3 py-2 text-left ${message.type === 'error' ? 'text-red-600 bg-red-50 border border-red-200' : 'text-green-700 bg-green-50 border border-green-200'}`}>
              {message.text}
            </div>
          )}
        </div>

        {parsedRows.length > 0 && (
          <div className="mt-6">
            <div className="max-h-72 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left border-b">
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Node</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium text-right">Sécu.</th>
                    <th className="px-3 py-2 font-medium text-right">Point</th>
                    <th className="px-3 py-2 font-medium text-right">EOQ</th>
                    <th className="px-3 py-2 font-medium text-right">Max</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r) => (
                    <tr key={r.line} className={`border-b last:border-0 ${r.errors.length ? 'bg-red-50/60' : ''}`}>
                      <td className="px-3 py-2 text-gray-500">{r.line}</td>
                      <td className="px-3 py-2 text-gray-700">{r.node_code}</td>
                      <td className="px-3 py-2 text-gray-700">{r.sku_code}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.safety_stock)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.reorder_point)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.economic_qty)}</td>
                      <td className="px-3 py-2 text-right">{r.max_stock === null ? '—' : fmt(r.max_stock)}</td>
                      <td className="px-3 py-2">{r.errors.length ? <span className="text-red-500">{r.errors.join(', ')}</span> : <span className="text-green-600">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleImport} disabled={saving || !validCount} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#E10600] text-white text-sm font-semibold hover:bg-[#c00500] disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              Valider l'import {validCount > 0 ? `(${validCount} ligne(s))` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ReorderRulesPage() {
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('stock.manage');

  const urlNode = searchParams.get('node_id') || '';
  const urlSku = searchParams.get('sku_id') || '';

  const [tab, setTab] = useState('list');
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState(urlNode);
  const [families, setFamilies] = useState([]);
  const [familyId, setFamilyId] = useState('');
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [skuFocus, setSkuFocus] = useState(urlSku); // pré-filtre « Aller au réappro »
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({ costing_methods: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState(null);
  const autoOpened = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [nodesRes, refsRes] = await Promise.all([getNodes({ limit: 500 }), getReorderRuleRefs()]);
        const nodeList = asList(nodesRes);
        setNodes(nodeList);
        if (!urlNode && nodeList.length) setNodeId(nodeList[0].id);
        setRefs(refsRes?.data?.data || { costing_methods: [], suppliers: [] });
      } catch (e) {
        setError(apiError(e, 'Erreur lors du chargement des référentiels.'));
      }
      getFamiliesList().then((res) => setFamilies(asList(res))).catch(() => {});
      getBrandsList().then((res) => setBrands(asList(res))).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRules = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getReorderRules({
        node_id: nodeId,
        ...(familyId ? { sku_family_id: familyId } : {}),
        ...(brandId ? { brand_id: brandId } : {}),
        ...(ruleFilter ? { has_rule: ruleFilter } : {}),
      });
      setRows(asList(res));
    } catch (e) {
      setError(apiError(e, 'Erreur lors du chargement des règles.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId, familyId, brandId, ruleFilter]);

  useEffect(() => { loadRules(); }, [loadRules]);

  // « Aller au réappro » : ouvre directement l'édition de la règle du couple node × SKU
  useEffect(() => {
    if (autoOpened.current || !urlSku || loading || nodeId !== urlNode) return;
    autoOpened.current = true;
    const found = rows.find((r) => r.sku_id === urlSku);
    if (found) { setEditRow(found); setTab('edit'); return; }
    // SKU non vendable sur ce node : on construit la ligne à partir du SKU et de la règle éventuelle
    (async () => {
      try {
        const [skuRes, thRes] = await Promise.all([getSku(urlSku), getReorderThresholds({ node_id: urlNode, sku_id: urlSku })]);
        const s = skuRes?.data?.data;
        const rule = asList(thRes)[0];
        if (!s) return;
        setEditRow({
          sku_id: s.id, node_id: urlNode, has_rule: !!rule, rule_id: rule?.id ?? null, is_active: rule?.is_active ?? true,
          safety_stock: N(rule?.safety_stock), reorder_point: N(rule?.reorder_point), economic_qty: N(rule?.economic_qty),
          max_stock: rule?.max_stock != null ? N(rule.max_stock) : null, lead_time_days: rule?.lead_time_days ?? 1,
          costing_method_id: rule?.costing_method?.id ?? null, preferred_supplier_id: rule?.preferred_supplier?.id ?? null,
          qty_available: null, qty_incoming: null,
          sku: { article: { sku_code: s.sku_code, name_fr: s.name_fr, family: s.sku_family } },
        });
        setTab('edit');
      } catch { /* pas d'ouverture automatique */ }
    })();
  }, [rows, loading, urlSku, urlNode, nodeId]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (skuFocus) list = list.filter((r) => r.sku_id === skuFocus);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        r.sku?.article?.sku_code?.toLowerCase().includes(q)
        || r.sku?.article?.name_fr?.toLowerCase().includes(q)
        || r.sku?.article?.ean13?.includes(q));
    }
    return list;
  }, [rows, search, skuFocus]);

  const handleToggleActive = async (row, next) => {
    if (!row.has_rule || !row.rule_id) {
      // Pas de règle : il faut saisir les seuils avant d'activer
      setEditRow(row);
      setTab('edit');
      return;
    }
    setRows((prev) => prev.map((r) => (r.sku_id === row.sku_id ? { ...r, is_active: next } : r)));
    try {
      await updateReorderRule(row.rule_id, { is_active: next });
      toast.success(next ? 'Règle activée' : 'Règle désactivée');
    } catch (e) {
      toast.error(apiError(e, 'Erreur lors de la mise à jour'));
      loadRules();
    }
  };

  const selectedNode = nodes.find((n) => n.id === nodeId);

  const openEdit = (row) => { setEditRow(row); setTab('edit'); };
  const newRule = () => { setEditRow(null); setTab('edit'); };
  const afterSave = () => { setEditRow(null); setTab('list'); loadRules(); };

  const handleExport = () => {
    downloadCsv(`regles-reappro-${selectedNode?.code ?? 'node'}-${todayStamp()}.csv`,
      ['node', 'sku', 'nom', 'safety_stock', 'reorder_point', 'economic_qty', 'max_stock', 'lead_time_days', 'costing_method', 'preferred_supplier', 'statut'],
      filteredRows.map((r) => [
        selectedNode?.code ?? '', r.sku?.article?.sku_code ?? '', r.sku?.article?.name_fr ?? '',
        r.has_rule ? N(r.safety_stock) : '', r.has_rule ? N(r.reorder_point) : '', r.has_rule ? N(r.economic_qty) : '',
        r.has_rule && r.max_stock != null ? N(r.max_stock) : '', r.has_rule ? r.lead_time_days : '',
        r.has_rule && r.costing_method ? r.costing_method.code : '', r.preferred_supplier?.code ?? r.preferred_supplier?.name_fr ?? '',
        !r.has_rule ? 'Sans règle' : r.is_active ? 'Active' : 'Inactive',
      ]));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-poppins font-bold text-2xl text-gray-900">Paramètres Stock (Réappro)</h1>
        <div className="flex gap-2">
          {tab === 'list' && (
            <button onClick={handleExport} disabled={!filteredRows.length} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              <Download size={16} /> Exporter
            </button>
          )}
          {canManage && tab === 'list' && (
            <button onClick={newRule} disabled={!nodeId} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500] disabled:opacity-50">
              <Plus size={16} /> Nouvelle règle
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Paramétrage des règles de réapprovisionnement par couple node × SKU. Les alertes de rupture s'affichent dans Niveaux de stock &gt; « Alertes rupture ».
      </p>

      <div className="flex gap-6 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'list' || tab === 'edit') && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); setEditRow(null); setSkuFocus(''); }} className={`${selectCls} font-medium text-gray-800`}>
              {!nodes.length && <option value="">Aucun node</option>}
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          {tab === 'list' && (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un SKU..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-56 focus:ring-2 focus:ring-[#E10600] outline-none" />
              </div>
              <div className="relative">
                <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={selectCls}>
                  <option value="">Toutes familles</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <div className="relative">
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectCls}>
                  <option value="">Toutes marques</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name_fr}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <div className="relative">
                <select value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className={selectCls}>
                  <option value="">Avec et sans règle</option>
                  <option value="true">Avec règle</option>
                  <option value="false">Sans règle</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {skuFocus && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm text-[#E10600]">
                  Filtré sur le SKU sélectionné
                  <button onClick={() => setSkuFocus('')}><X size={14} /></button>
                </span>
              )}
              <div className="ml-auto text-sm text-gray-500">{filteredRows.length} SKU vendable(s) sur {selectedNode?.code || '—'}</div>
            </>
          )}
        </div>
      )}

      {tab === 'list' && (
        <div className="border rounded-xl overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left border-b">
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Nom produit</th>
                <th className="px-4 py-3 font-medium text-right">Disponible</th>
                <th className="px-4 py-3 font-medium text-right">Stock sécurité</th>
                <th className="px-4 py-3 font-medium text-right">Point réappro</th>
                <th className="px-4 py-3 font-medium text-right">Qté éco. (EOQ)</th>
                <th className="px-4 py-3 font-medium text-right">Stock max</th>
                <th className="px-4 py-3 font-medium text-right">Délai (j)</th>
                <th className="px-4 py-3 font-medium">Valorisation</th>
                <th className="px-4 py-3 font-medium">Fournisseur préféré</th>
                <th className="px-4 py-3 font-medium">Statut règle</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</td></tr>}
              {!loading && error && <tr><td colSpan={11} className="px-4 py-10 text-center text-red-600">{error}</td></tr>}
              {!loading && !error && filteredRows.map((r) => (
                <tr key={r.sku_id} onClick={() => openEdit(r)} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-gray-600">{r.sku?.article?.sku_code}</td>
                  <td className="px-4 py-3 text-gray-900">{r.sku?.article?.name_fr}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(r.qty_available)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? fmt(r.safety_stock) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{r.has_rule ? fmt(r.reorder_point) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? fmt(r.economic_qty) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? (r.max_stock != null ? fmt(r.max_stock) : 'Illimité') : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? r.lead_time_days : '—'}</td>
                  <td className="px-4 py-3">{r.has_rule && r.costing_method ? <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{r.costing_method.code}</span> : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.preferred_supplier?.name_fr ?? '—'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Toggle checked={!!r.is_active && r.has_rule} disabled={!canManage} onChange={(v) => handleToggleActive(r, v)} />
                      <span className={`text-xs font-medium ${r.has_rule ? (r.is_active ? 'text-green-600' : 'text-gray-400') : 'text-gray-400 italic'}`}>
                        {!r.has_rule ? 'Sans règle' : r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !error && !filteredRows.length && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">Aucun SKU vendable pour ces filtres sur ce node.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'edit' && (
        <EditRuleTab
          row={editRow}
          rows={rows}
          refs={refs}
          nodeId={nodeId}
          nodeCode={selectedNode?.code}
          canManage={canManage}
          onPickSku={(r) => setEditRow(r)}
          onSaved={afterSave}
          onBack={() => { setEditRow(null); setTab('list'); }}
        />
      )}

      {tab === 'bulk' && <BulkImportTab nodes={nodes} refs={refs} canManage={canManage} onSaved={loadRules} />}
    </div>
  );
}
