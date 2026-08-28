import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Download, X, Loader2, ChevronDown, Save, Trash2,
  Folder, CheckCircle2, AlertCircle, UploadCloud,
} from 'lucide-react';
import {
  getReorderRules,
  getReorderRuleRefs,
  updateReorderRule,
  createReorderRule,
  deleteReorderRule,
  bulkSaveReorderRules,
} from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';
import { getFamiliesList } from '../../api/catalog.api';

const N = (v) => Number(v ?? 0);
const fmt = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v));

// ─── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0
        ${checked ? 'bg-green-500' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-1'}`}
      />
    </button>
  );
}

// ─── Field with helper text ─────────────────────────────────────────────────

function Field({ label, required, help, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-[#E10600]"> *</span>}
        {!required && label && !/\(optionnel\)|\(jours\)/i.test(label) && null}
      </span>
      {children}
      {help && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{help}</p>}
    </label>
  );
}

// ─── Edit / create drawer ───────────────────────────────────────────────────

function RuleDrawer({ open, onClose, row, refs, nodeId, nodeCode, onSaved, onDeleted }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!row) return;
    setForm({
      safety_stock: row.safety_stock ?? 0,
      reorder_point: row.reorder_point ?? 0,
      economic_qty: row.economic_qty ?? 0,
      max_stock: row.max_stock ?? '',
      lead_time_days: row.lead_time_days ?? 1,
      costing_method_id: row.costing_method_id ?? '',
      preferred_supplier_id: row.preferred_supplier_id ?? '',
      is_active: row.is_active ?? true,
    });
    setError('');
  }, [row]);

  if (!open || !row) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        node_id: nodeId,
        sku_id: row.sku_id,
        safety_stock: N(form.safety_stock),
        reorder_point: N(form.reorder_point),
        economic_qty: N(form.economic_qty),
        max_stock: form.max_stock === '' ? null : N(form.max_stock),
        lead_time_days: parseInt(form.lead_time_days, 10) || 0,
        costing_method_id: form.costing_method_id,
        preferred_supplier_id: form.preferred_supplier_id || null,
        is_active: form.is_active,
      };
      if (row.has_rule && row.rule_id) {
        await updateReorderRule(row.rule_id, payload);
      } else {
        await createReorderRule(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row.rule_id) return;
    if (!window.confirm('Supprimer cette règle de réapprovisionnement ?')) return;
    setSaving(true);
    try {
      await deleteReorderRule(row.rule_id);
      onDeleted();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const skuCode = row.sku?.article?.sku_code;
  const skuName = row.sku?.article?.name_fr;
  const categoryName = row.sku?.article?.category?.name_fr;
  const isActive = form.is_active ?? row.is_active;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gray-50 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-poppins font-bold text-lg text-gray-900">
                Édition règle — {skuName ?? '—'}
              </h2>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                {isActive ? 'Règle active' : 'Règle inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {skuCode ?? '—'} × {nodeCode ?? '—'} (couple UNIQUE)
              {categoryName ? ` • ${categoryName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl px-5 py-5 text-center">
              <p className="text-sm text-gray-500 mb-1">Qty disponible sur {nodeCode ?? '—'}</p>
              <p className="text-2xl font-bold text-green-600">{fmt(row.qty_available)}</p>
            </div>
            <div className="border rounded-xl px-5 py-5 text-center">
              <p className="text-sm text-gray-500 mb-1">Déclenchement réappro</p>
              <p className="text-sm font-semibold text-gray-900">qty_available ≤ point de réappro</p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                L'alerte s'affiche dans Niveaux de stock &gt; « Alertes rupture »
              </p>
            </div>
          </div>

          {/* Seuils & quantités */}
          <div className="border rounded-xl px-5 py-5">
            <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-4">
              Seuils &amp; quantités de réappro
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Stock de sécurité" required help="Palier minimal en dessous duquel le stock est jugé critique">
                <input type="number" min="0" value={form.safety_stock}
                  onChange={(e) => set('safety_stock', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]" />
              </Field>
              <Field label="Point de réapprovisionnement" required help="Niveau de qty_available qui déclenche l'alerte de réappro">
                <input type="number" min="0" value={form.reorder_point}
                  onChange={(e) => set('reorder_point', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]" />
              </Field>
              <Field label="Quantité économique de commande" required help="Quantité optimale (EOQ) suggérée pour le prochain BC">
                <input type="number" min="0" value={form.economic_qty}
                  onChange={(e) => set('economic_qty', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]" />
              </Field>
              <Field label="Stock maximum (optionnel)" help="Évite le surstock ; si renseigné, doit être ≥ point de réappro">
                <input type="number" min="0" value={form.max_stock}
                  placeholder="Illimité"
                  onChange={(e) => set('max_stock', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]" />
              </Field>
              <Field label="Délai fournisseur (jours)" help="Délai d'appro estimé, sert à anticiper le moment de recommander">
                <input type="number" min="0" value={form.lead_time_days}
                  onChange={(e) => set('lead_time_days', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]" />
              </Field>
            </div>
          </div>

          {/* Valorisation & fournisseur */}
          <div className="border rounded-xl px-5 py-5">
            <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-4">
              Valorisation &amp; fournisseur
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Méthode de valorisation" required help="Appliquée à ce SKU sur ce nœud">
                <div className="flex gap-2">
                  {refs.costing_methods?.map((m) => {
                    const selected = form.costing_method_id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set('costing_method_id', m.id)}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold border transition-colors
                          ${selected
                            ? 'bg-[#E10600] text-white border-transparent'
                            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {m.code}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Fournisseur préféré (optionnel)" help="Fournisseur par défaut pour les BC de réappro de ce couple">
                <div className="relative">
                  <select
                    value={form.preferred_supplier_id}
                    onChange={(e) => set('preferred_supplier_id', e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]"
                  >
                    <option value="">— Aucun —</option>
                    {refs.suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name_fr}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !form.costing_method_id}
            className="px-5 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500] disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>

          <div className="flex items-center gap-2">
            <Toggle checked={!!form.is_active} onChange={(v) => set('is_active', v)} />
            <span className="text-sm font-medium text-gray-700">Règle active</span>
          </div>

          <div className="flex items-center gap-4">
            {row.has_rule && (
              <button onClick={handleDelete} disabled={saving}
                className="text-red-600 hover:text-red-700">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={onClose} disabled={saving} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'node', 'sku', 'safety_stock', 'reorder_point', 'economic_qty',
  'max_stock', 'lead_time_days', 'costing_method', 'preferred_supplier',
];

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
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

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Import en masse tab ────────────────────────────────────────────────────

function BulkImportTab({ nodes, refs, onSaved }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error' | 'success', text }

  const nodeByCode = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.code?.toLowerCase(), n])),
    [nodes]
  );
  const costingByCode = useMemo(
    () => Object.fromEntries((refs.costing_methods || []).map((m) => [m.code?.toLowerCase(), m])),
    [refs.costing_methods]
  );
  const supplierByCode = useMemo(
    () => Object.fromEntries((refs.suppliers || []).map((s) => [(s.code || s.name_fr)?.toLowerCase(), s])),
    [refs.suppliers]
  );

  const resetFile = () => {
    setFileName('');
    setParsedRows([]);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Le fichier doit être au format .csv' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Fichier trop volumineux (max 5 Mo)' });
      return;
    }

    setFileName(file.name);
    setMessage(null);

    const text = await file.text();
    const raw = parseCsv(text);

    if (!raw.length) {
      setMessage({ type: 'error', text: 'Le fichier CSV est vide.' });
      setParsedRows([]);
      return;
    }

    const rows = raw.map((r, i) => {
      const errors = [];
      const node = nodeByCode[(r.node || '').toLowerCase()];
      if (!node) errors.push('node inconnu');

      const skuCode = r.sku || '';
      if (!skuCode) errors.push('sku manquant');

      const costing = costingByCode[(r.costing_method || '').toLowerCase()];
      if (!costing) errors.push('costing_method inconnu');

      const supplier = r.preferred_supplier
        ? supplierByCode[(r.preferred_supplier || '').toLowerCase()]
        : null;
      if (r.preferred_supplier && !supplier) errors.push('preferred_supplier inconnu');

      return {
        line: i + 2,
        raw: r,
        node_code: r.node,
        sku_code: skuCode,
        node_id: node?.id ?? null,
        sku_id: null, // résolu côté serveur par sku_code lors de l'import
        safety_stock: N(r.safety_stock),
        reorder_point: N(r.reorder_point),
        economic_qty: N(r.economic_qty),
        max_stock: r.max_stock === '' ? null : N(r.max_stock),
        lead_time_days: parseInt(r.lead_time_days, 10) || 1,
        costing_method_id: costing?.id ?? null,
        costing_method_code: r.costing_method,
        preferred_supplier_id: supplier?.id ?? null,
        errors,
      };
    });

    setParsedRows(rows);
  };

  const validCount = parsedRows.filter((r) => !r.errors.length).length;
  const errorCount = parsedRows.length - validCount;

  const handleImport = async () => {
    const payload = parsedRows
      .filter((r) => !r.errors.length)
      .map((r) => ({
        node_id: r.node_id,
        sku_code: r.sku_code, // le backend résout sku_code -> sku_id
        safety_stock: r.safety_stock,
        reorder_point: r.reorder_point,
        economic_qty: r.economic_qty,
        max_stock: r.max_stock,
        lead_time_days: r.lead_time_days,
        costing_method_id: r.costing_method_id,
        preferred_supplier_id: r.preferred_supplier_id,
      }));

    if (!payload.length) {
      setMessage({ type: 'error', text: 'Aucune ligne valide à importer.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await bulkSaveReorderRules(payload);
      setMessage({ type: 'success', text: `${payload.length} règle(s) importée(s) avec succès.` });
      setParsedRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSaved();
    } catch (e) {
      setMessage({ type: 'error', text: e?.response?.data?.message || 'Erreur lors de l\'import.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-xl bg-white border rounded-xl px-8 py-10">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <Folder size={26} className="text-amber-500" />
          </div>
          <h3 className="font-poppins font-bold text-lg text-gray-900">
            Import en masse de règles (CSV)
          </h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Uploadez un fichier CSV avec le mapping de colonnes : {CSV_COLUMNS.map((c, i) => (
              <React.Fragment key={c}>
                <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{c}</code>
                {i < CSV_COLUMNS.length - 1 ? ', ' : ''}
              </React.Fragment>
            ))}. La validation crée ou met à jour les règles de façon groupée.
          </p>

          {!fileName ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 w-full border-2 border-dashed border-gray-300 rounded-lg py-8 hover:border-[#E10600]/50 hover:bg-gray-50 transition-colors"
            >
              <span className="block text-sm font-medium text-[#E10600]">
                Cliquez pour sélectionner un fichier
              </span>
              <span className="block text-sm text-gray-400 mt-1">.csv (Max 5MB)</span>
            </button>
          ) : (
            <div className="mt-6 w-full border rounded-lg p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
                <button onClick={resetFile} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              {parsedRows.length > 0 && (
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 size={13} /> {validCount} valide(s)
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle size={13} /> {errorCount} en erreur
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {message && (
            <div className={`mt-4 w-full text-sm rounded-lg px-3 py-2 text-left
              ${message.type === 'error' ? 'text-red-600 bg-red-50 border border-red-200' : 'text-green-700 bg-green-50 border border-green-200'}`}>
              {message.text}
            </div>
          )}
        </div>

        {parsedRows.length > 0 && (
          <div className="mt-6">
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left border-b">
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Node</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r) => (
                    <tr key={r.line} className="border-b last:border-0">
                      <td className="px-3 py-2 text-gray-500">{r.line}</td>
                      <td className="px-3 py-2 text-gray-700">{r.node_code}</td>
                      <td className="px-3 py-2 text-gray-700">{r.sku_code}</td>
                      <td className="px-3 py-2">
                        {r.errors.length ? (
                          <span className="text-red-500">{r.errors.join(', ')}</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={saving || !validCount}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#E10600] text-white text-sm font-semibold hover:bg-[#c00500] disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              Importer {validCount > 0 ? `(${validCount})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ReorderRulesPage() {
  const [tab, setTab] = useState('list'); // 'list' | 'bulk'
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [families, setFamilies] = useState([]);
  const [familyId, setFamilyId] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [refs, setRefs] = useState({ costing_methods: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [drawerRow, setDrawerRow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: nodesRes }, { data: refsRes }] = await Promise.all([
          getNodes(),
          getReorderRuleRefs(),
        ]);
        const nodeList = nodesRes?.data || [];
        setNodes(nodeList);
        if (nodeList.length) setNodeId(nodeList[0].id);
        setRefs(refsRes?.data || { costing_methods: [], suppliers: [] });
      } catch (e) {
        console.error(e);
      }
      try {
        const { data: famRes } = await getFamiliesList();
        setFamilies(famRes?.data || []);
      } catch (e) {
        // familles optionnelles
      }
    })();
  }, []);

  const loadRules = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const { data } = await getReorderRules({
        node_id: nodeId,
        ...(familyId ? { category_id: familyId } : {}),
      });
      setRows(data?.data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId, familyId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      r.sku?.article?.sku_code?.toLowerCase().includes(q) ||
      r.sku?.article?.name_fr?.toLowerCase().includes(q) ||
      r.sku?.article?.ean13?.includes(q)
    );
  }, [rows, search]);

  const handleToggleActive = async (row, next) => {
    setRows((prev) => prev.map((r) => (r.sku_id === row.sku_id ? { ...r, is_active: next } : r)));
    try {
      if (row.has_rule && row.rule_id) {
        await updateReorderRule(row.rule_id, { is_active: next });
      } else {
        await createReorderRule({
          node_id: nodeId,
          sku_id: row.sku_id,
          costing_method_id: refs.costing_methods?.[0]?.id,
          is_active: next,
        });
        loadRules();
      }
    } catch (e) {
      console.error(e);
      loadRules();
    }
  };

  const selectedNode = nodes.find((n) => n.id === nodeId);

  const handleExport = () => {
    if (tab !== 'list') return; // rien à exporter côté import CSV

    const header = [
      'Node', 'SKU', 'Nom', 'Prix TTC', 'Stock sécurité', 'Point réappro',
      'Qté éco. (EOQ)', 'Stock max', 'Délai (j)', 'Valorisation', 'Fournisseur préféré', 'Statut règle',
    ];

    const lines = filteredRows.map((r) => [
      selectedNode?.code ?? '',
      r.sku?.article?.sku_code ?? '',
      r.sku?.article?.name_fr ?? '',
      r.price_ttc != null ? N(r.price_ttc) : '',
      r.has_rule ? N(r.safety_stock) : '',
      r.has_rule ? N(r.reorder_point) : '',
      r.has_rule ? N(r.economic_qty) : '',
      r.has_rule ? N(r.max_stock) : '',
      r.has_rule ? r.lead_time_days : '',
      r.has_rule && r.costing_method ? r.costing_method.code : '',
      r.preferred_supplier?.name_fr ?? '',
      r.is_active && r.has_rule ? 'Active' : 'Désactivée',
    ]);

    downloadCsv(`reorder-rules-${selectedNode?.code ?? 'node'}.csv`, header, lines);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-poppins font-bold text-2xl text-gray-900">Paramètres Stock / Réappro</h1>
        <button
          onClick={handleExport}
          disabled={tab !== 'list'}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          Exporter
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Paramétrage des règles de réapprovisionnement par couple node × SKU — les alertes de rupture s'affichent dans Niveaux de stock &gt; « Alertes rupture ».
      </p>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-4">
        {[
          { key: 'list', label: 'Liste des règles' },
          { key: 'bulk', label: 'Import en masse' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-[#E10600] text-[#E10600]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === 'list' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="appearance-none border rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-gray-800 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un SKU..."
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
            />
          </div>

          <div className="relative">
            <select
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className="appearance-none border rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
            >
              <option value="">Toutes familles</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.name_fr}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="ml-auto text-sm text-gray-500">
            {filteredRows.length} SKUs vendables sur {selectedNode?.code || '—'}
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'list' ? (
        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left border-b">
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Nom Produit</th>
                <th className="px-4 py-3 font-medium text-right">Prix TTC</th>
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
              {loading && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 className="inline animate-spin mr-2" size={16} /> Chargement...
                </td></tr>
              )}
              {!loading && filteredRows.map((r) => (
                <tr
                  key={r.sku_id}
                  onClick={() => setDrawerRow(r)}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-600">{r.sku?.article?.sku_code}</td>
                  <td className="px-4 py-3 text-gray-900">{r.sku?.article?.name_fr}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {r.price_ttc != null ? `${fmt(r.price_ttc)} MAD` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? fmt(r.safety_stock) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">{r.has_rule ? fmt(r.reorder_point) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? fmt(r.economic_qty) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? fmt(r.max_stock) : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.has_rule ? r.lead_time_days : '—'}</td>
                  <td className="px-4 py-3">
                    {r.has_rule && r.costing_method ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {r.costing_method.code}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.preferred_supplier?.name_fr ?? '—'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={!!r.is_active && r.has_rule}
                        onChange={(v) => handleToggleActive(r, v)}
                      />
                      <span className={`text-xs font-medium ${r.is_active && r.has_rule ? 'text-green-600' : 'text-gray-400'}`}>
                        {r.is_active && r.has_rule ? 'Active' : 'Désactivée'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filteredRows.length && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">Aucun SKU pour ce filtre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <BulkImportTab nodes={nodes} refs={refs} onSaved={loadRules} />
      )}

      <RuleDrawer
        open={!!drawerRow}
        row={drawerRow}
        refs={refs}
        nodeId={nodeId}
        nodeCode={selectedNode?.code}
        onClose={() => setDrawerRow(null)}
        onSaved={loadRules}
        onDeleted={loadRules}
      />
    </div>
  );
}