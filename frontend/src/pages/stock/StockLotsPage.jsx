import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockLots, getStockLotAlerts, createStockLot, deleteStockLot } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

const PATHS = {
  box:      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  chevron:  'M19 9l-7 7-7-7',
  filter:   'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  plus:     'M12 4v16m8-8H4',
  x:        'M6 18L18 6M6 6l12 12',
  check:    'M5 13l4 4L19 7',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  clock:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  fifo:     'M4 6h16M4 12h8m-8 6h16',
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

function getLotStatus(lot) {
  const remaining = Number(lot.qty_remaining);
  if (remaining <= 0) return 'EXHAUSTED';
  if (!lot.expiry_date) return 'NORMAL';
  const days = daysUntil(lot.expiry_date);
  if (days < 0)   return 'EXPIRED';
  if (days <= 30) return 'EXPIRING';
  return 'NORMAL';
}

const LOT_STATUS = {
  NORMAL:   { label: 'Actif',           badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', row: '' },
  EXPIRING: { label: 'Expire bientôt',  badge: 'bg-orange-100 text-orange-700 border border-orange-200',   dot: 'bg-orange-500', row: 'bg-orange-50/30' },
  EXPIRED:  { label: 'Expiré',          badge: 'bg-red-100 text-red-700 border border-red-200',            dot: 'bg-red-500',    row: 'bg-red-50/30' },
  EXHAUSTED:{ label: 'Épuisé',          badge: 'bg-slate-100 text-slate-400 border border-slate-200',      dot: 'bg-slate-300',  row: 'opacity-60' },
};

const TABS = [
  { key: 'ALL',      label: 'Tous' },
  { key: 'NORMAL',   label: 'Actifs' },
  { key: 'EXPIRING', label: 'Expire bientôt' },
  { key: 'EXPIRED',  label: 'Expirés' },
  { key: 'EXHAUSTED',label: 'Épuisés' },
];

function exportCSV(rows) {
  const headers = ['N° Lot','Code SKU','Article','Entrepôt','Qté initiale','Qté restante','Coût unitaire (MAD)','Date réception','Date expiration','Jours restants','Statut'];
  const lines = rows.map((l) => {
    const art  = l.sku?.article;
    const days = daysUntil(l.expiry_date);
    return [
      l.lot_number ?? '',
      art?.sku_code ?? '',
      art?.name_fr ?? '',
      l.node?.name_fr ?? '',
      Number(l.qty_initial),
      Number(l.qty_remaining),
      Number(l.cost_unit),
      fmtDate(l.received_at) ?? '',
      fmtDate(l.expiry_date) ?? '',
      days != null ? days : '',
      LOT_STATUS[getLotStatus(l)]?.label ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'lots_stock.csv'; a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = { sku_id: '', node_id: '', qty_initial: '', cost_unit: '', lot_number: '', expiry_date: '' };

export default function StockLotsPage() {
  const [nodes, setNodes]           = useState([]);
  const [nodeId, setNodeId]         = useState('');
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [alerts, setAlerts]         = useState(null);

  const [tab, setTab]               = useState('ALL');
  const [search, setSearch]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage]             = useState(1);
  const pageSize                    = 20;

  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError]   = useState('');

  useEffect(() => {
    getNodes({ all: true }).then((r) => setNodes(r.data?.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async (nid = nodeId) => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (nid) params.node_id = nid;
      const [res, alertRes] = await Promise.all([
        getStockLots(params),
        nid ? getStockLotAlerts(nid) : Promise.resolve(null),
      ]);
      setRows(res.data?.data ?? []);
      setAlerts(alertRes?.data?.data ?? null);
      setPage(1);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur de chargement');
    } finally { setLoading(false); }
  }, [nodeId]);

  const handleNodeChange = (id) => {
    setNodeId(id); setTab('ALL'); setSearch(''); setPage(1);
    load(id);
  };

  // Enrich with status
  const enriched = useMemo(() => rows.map((r) => ({ ...r, _status: getLotStatus(r) })), [rows]);

  // Filtered
  const filtered = useMemo(() => {
    let list = enriched;
    if (tab !== 'ALL') list = list.filter((r) => r._status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const a = r.sku?.article;
        return r.lot_number?.toLowerCase().includes(q)
          || a?.name_fr?.toLowerCase().includes(q)
          || a?.sku_code?.toLowerCase().includes(q)
          || a?.ean13?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [enriched, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);
  const tabCount   = (key) => key === 'ALL' ? enriched.length : enriched.filter((r) => r._status === key).length;

  const handleFormSave = async () => {
    setFormSaving(true); setFormError('');
    try {
      await createStockLot({
        ...form,
        qty_initial: Number(form.qty_initial),
        cost_unit:   Number(form.cost_unit),
        expiry_date: form.expiry_date || null,
        node_id:     form.node_id || nodeId || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setFormError(e.response?.data?.message ?? 'Erreur lors de la création');
    } finally { setFormSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce lot ? (Soft delete — il sera marqué supprimé)')) return;
    try { await deleteStockLot(id); await load(); }
    catch (e) { alert(e.response?.data?.message ?? 'Erreur'); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.box} className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Gestion des lots de stock</h1>
              <p className="text-sm text-slate-500">Traçabilité FIFO — coûts unitaires — dates d'expiration</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={nodeId} onChange={(e) => handleNodeChange(e.target.value)}
                className="appearance-none border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer">
                <option value="">— Tous les entrepôts —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
              </select>
              <Icon d={PATHS.chevron} className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={() => load()} disabled={loading}
              className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
              <Icon d={PATHS.refresh} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {rows.length > 0 && (
              <button onClick={() => exportCSV(filtered)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                <Icon d={PATHS.download} className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <button onClick={() => { setForm({ ...EMPTY_FORM, node_id: nodeId }); setFormError(''); setShowForm(true); }}
              className="flex items-center gap-2 bg-amber-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-amber-600 transition">
              <Icon d={PATHS.plus} className="w-3.5 h-3.5" />
              Nouveau lot
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

      {/* Alertes */}
      {alerts && (alerts.expired > 0 || alerts.expiring_soon > 0 || alerts.exhausted > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {alerts.expired > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon d={PATHS.alert} className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">{alerts.expired} lot{alerts.expired > 1 ? 's' : ''} expiré{alerts.expired > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-500">Action requise — ne pas vendre</p>
              </div>
            </div>
          )}
          {alerts.expiring_soon > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon d={PATHS.clock} className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-700">{alerts.expiring_soon} lot{alerts.expiring_soon > 1 ? 's' : ''} expire bientôt</p>
                <p className="text-xs text-orange-500">Dans les 30 prochains jours</p>
              </div>
            </div>
          )}
          {alerts.exhausted > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon d={PATHS.box} className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-600">{alerts.exhausted} lot{alerts.exhausted > 1 ? 's' : ''} épuisé{alerts.exhausted > 1 ? 's' : ''}</p>
                <p className="text-xs text-slate-400">Quantité restante = 0</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal création lot */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Créer un nouveau lot</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                <Icon d={PATHS.x} className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Node */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Entrepôt <span className="text-red-500">*</span></label>
                <select value={form.node_id} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">— Sélectionner —</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
                </select>
              </div>
              {/* SKU ID */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ID SKU <span className="text-red-500">*</span></label>
                <input type="text" value={form.sku_id} onChange={(e) => setForm((f) => ({ ...f, sku_id: e.target.value }))}
                  placeholder="UUID du SKU"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              {/* Numéro lot + Qté + Coût */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">N° de lot</label>
                  <input type="text" value={form.lot_number} onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
                    placeholder="ex. LOT-2025-001"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Qté initiale <span className="text-red-500">*</span></label>
                  <input type="number" min="0.001" step="0.001" value={form.qty_initial} onChange={(e) => setForm((f) => ({ ...f, qty_initial: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Coût unitaire (MAD) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.cost_unit} onChange={(e) => setForm((f) => ({ ...f, cost_unit: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              {/* Expiry date */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date d'expiration</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <p className="text-xs text-slate-400 mt-1">Laisser vide si le produit n'expire pas</p>
              </div>
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{formError}</div>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} disabled={formSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={handleFormSave} disabled={formSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50">
                <Icon d={formSaving ? PATHS.refresh : PATHS.check} className={`w-4 h-4 ${formSaving ? 'animate-spin' : ''}`} />
                {formSaving ? 'Création…' : 'Créer le lot'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3">
          <div className="relative flex-1">
            <Icon d={PATHS.search} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Rechercher par n° de lot, article, code SKU…"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          {/* Tabs */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map((t) => {
              const cnt = tabCount(t.key);
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t.label}
                  {cnt > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.key ? 'bg-white/20' : 'bg-slate-200'}`}>{cnt}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* FIFO hint */}
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
          <Icon d={PATHS.fifo} className="w-3.5 h-3.5 flex-shrink-0" />
          Consommation FIFO — les lots les plus anciens sont consommés en premier. Les lots expirés sont bloqués à la vente.
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Icon d={PATHS.refresh} className="w-7 h-7 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">
                    N° de lot
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Identifiant du lot</div>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Article / SKU
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Produit du lot</div>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Entrepôt
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Emplacement physique</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Qté initiale
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Au moment de la réception</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Qté restante
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Disponible dans ce lot</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Coût unitaire
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Prix d'achat par unité</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Valeur restante
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Coût × qté restante</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Date de réception
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Arrivée en stock</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Date d'expiration
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">DLC / DLUO du lot</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">Statut</th>
                  <th className="text-center px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((lot) => {
                  const art      = lot.sku?.article;
                  const img      = lot.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
                  const status   = lot._status;
                  const stCfg    = LOT_STATUS[status];
                  const qtyInit  = Number(lot.qty_initial);
                  const qtyLeft  = Number(lot.qty_remaining);
                  const pct      = qtyInit > 0 ? Math.min(100, (qtyLeft / qtyInit) * 100) : 0;
                  const cost     = Number(lot.cost_unit);
                  const value    = (qtyLeft * cost).toFixed(2);
                  const days     = daysUntil(lot.expiry_date);
                  return (
                    <tr key={lot.id} className={`hover:bg-slate-50/80 transition-colors ${stCfg.row}`}>
                      {/* Lot number */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                          {lot.lot_number ?? <span className="italic text-amber-400">Auto</span>}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{lot.id.slice(0, 8)}…</p>
                      </td>
                      {/* Article */}
                      <td className="px-3 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                            {img
                              ? <img src={img} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-slate-300"><Icon d={PATHS.box} className="w-3 h-3" /></div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{art?.name_fr ?? '—'}</p>
                            <p className="text-xs text-slate-400">{art?.sku_code}</p>
                          </div>
                        </div>
                      </td>
                      {/* Entrepôt */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-slate-700">{lot.node?.name_fr ?? '—'}</span>
                        <p className="text-[10px] text-slate-400">{lot.node?.code}</p>
                      </td>
                      {/* Qté initiale */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-medium tabular-nums text-slate-600">{qtyInit.toLocaleString('fr-FR')}</span>
                      </td>
                      {/* Qté restante + barre */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-bold tabular-nums ${qtyLeft <= 0 ? 'text-slate-400' : status === 'EXPIRED' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {qtyLeft.toLocaleString('fr-FR')}
                        </span>
                        <div className="w-16 mx-auto mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${status === 'EXPIRED' ? 'bg-red-400' : status === 'EXPIRING' ? 'bg-orange-400' : 'bg-emerald-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{pct.toFixed(0)}%</p>
                      </td>
                      {/* Coût unitaire */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-medium tabular-nums text-slate-700">{cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                      </td>
                      {/* Valeur restante */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold tabular-nums text-indigo-700">{Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                      </td>
                      {/* Date réception */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="text-xs text-slate-600">{fmtDate(lot.received_at)}</span>
                      </td>
                      {/* Date expiration */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {lot.expiry_date ? (
                          <div>
                            <span className={`text-xs font-medium ${status === 'EXPIRED' ? 'text-red-600' : status === 'EXPIRING' ? 'text-orange-600' : 'text-slate-600'}`}>
                              {fmtDate(lot.expiry_date)}
                            </span>
                            {days != null && (
                              <p className={`text-[10px] mt-0.5 ${days < 0 ? 'text-red-500' : days <= 30 ? 'text-orange-500' : 'text-slate-400'}`}>
                                {days < 0 ? `Expiré il y a ${Math.abs(days)} j` : `Dans ${days} j`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">Aucune DLC</span>
                        )}
                      </td>
                      {/* Statut */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${stCfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stCfg.dot}`} />
                          {stCfg.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => handleDelete(lot.id)} title="Supprimer ce lot"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                          <Icon d={PATHS.trash} className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} className="text-center py-16 text-slate-400">
                      <Icon d={PATHS.box} className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Aucun lot trouvé</p>
                      <p className="text-xs mt-1">Sélectionnez un entrepôt ou créez votre premier lot</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {filtered.length > 0
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} sur ${filtered.length} lot${filtered.length > 1 ? 's' : ''}`
              : '0 lot'}
            {rows.length !== filtered.length && ` (${rows.length} au total)`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                ‹ Préc.
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 5)              p = i + 1;
                else if (page <= 3)               p = i + 1;
                else if (page >= totalPages - 2)  p = totalPages - 4 + i;
                else                              p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition ${page === p ? 'bg-amber-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                Suiv. ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
