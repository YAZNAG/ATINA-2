import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, Loader2, Plus, Trash2, X } from 'lucide-react';
import { getOrdersMeta } from '../../api/orders_mgmt.api';
import { bulkCreateDeliverySlots, getDeliverySlots } from '../../api/orders.api';
import SlotFormPanel from './SlotFormModal';
import { downloadCsv } from './csv';

// Calendrier des créneaux datés par nœud (WF #24, US-034 à US-038).
const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const MAX_VISIBLE = 3;
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const todayKey = () => { const n = new Date(); return keyOf(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
const EMPTY_RANGE = { slot_start: '09:00', slot_end: '11:00', max_orders: '20', name_fr: '', name_ar: '' };

function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array((first.getUTCDay() + 6) % 7).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function DeliverySlotsPage() {
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() + 1 }; });
  const [statusFilter, setStatusFilter] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [activeDay, setActiveDay] = useState(null);

  // Ajout en masse : sélection de dates + plages
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [ranges, setRanges] = useState([{ ...EMPTY_RANGE }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrdersMeta().then((r) => {
      const list = r.data?.data?.nodes || [];
      setNodes(list);
      if (list.length) setNodeId((cur) => cur || list[0].id);
    }).catch((err) => setError(err?.response?.data?.message || 'Impossible de charger les nœuds'));
  }, []);

  const monthKey = `${cursor.year}-${pad(cursor.month)}`;
  const load = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await getDeliverySlots({ node_id: nodeId, month: monthKey, all: 'true', is_active: statusFilter || undefined });
      setSlots(r.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des créneaux');
    } finally {
      setLoading(false);
    }
  }, [nodeId, monthKey, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const g = {};
    for (const s of slots) (g[s.date] = g[s.date] || []).push(s);
    return g;
  }, [slots]);

  const weeks = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const node = nodes.find((n) => n.id === nodeId);
  const tKey = todayKey();

  const goMonth = (delta) => setCursor((p) => {
    let m = p.month + delta; let y = p.year;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    return { year: y, month: m };
  });

  function clickDay(key) {
    if (bulkMode) {
      if (key < tKey) return;
      setSelectedDates((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key].sort()));
    } else {
      setActiveDay(key);
    }
  }

  async function saveBulk() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const r = await bulkCreateDeliverySlots({
        node_id: nodeId,
        dates: selectedDates,
        ranges: ranges.map((x) => ({ ...x, max_orders: Number(x.max_orders) })),
      });
      const res = r.data?.data || {};
      setNotice(`${res.created} créneau(x) créé(s)${res.skipped?.length ? ` — ${res.skipped.length} ignoré(s) car déjà existant(s)` : ''}.`);
      setBulkMode(false);
      setSelectedDates([]);
      setRanges([{ ...EMPTY_RANGE }]);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la création des créneaux');
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    downloadCsv(`creneaux-${node?.code || 'node'}-${monthKey}.csv`,
      ['Nœud', 'Date', 'Début', 'Fin', 'Nom FR', 'Nom AR', 'Capacité max', 'Réservations', 'Places restantes', 'Préférences client', 'Statut'],
      slots.map((s) => [node?.name_fr || '', s.date, s.slot_start, s.slot_end, s.name_fr || '', s.name_ar || '', s.max_orders, s.reservations,
        s.remaining ?? '', s.preferences?.total ?? 0, s.is_active ? 'Actif' : 'Inactif']));
  }

  const setRange = (i, k, v) => setRanges((prev) => prev.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Créneaux de livraison</h1>
            <p className="text-xs text-gray-500">Calendrier daté par nœud — capacité, réservations et préférences client (lecture seule).</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={!slots.length} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"><Download size={15} /> Exporter</button>
            <button type="button" onClick={() => { setBulkMode((v) => !v); setSelectedDates([]); }} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${bulkMode ? 'border border-red-300 bg-red-50 text-red-600' : 'bg-red-600 text-white hover:bg-red-700'}`}>
              {bulkMode ? <><X size={15} /> Quitter l'ajout</> : <><CalendarPlus size={15} /> Ajouter des créneaux</>}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-3">
          <select value={nodeId} onChange={(e) => { setNodeId(e.target.value); setSelectedDates([]); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.code ? `${n.code} — ${n.name_fr}` : n.name_fr}</option>)}
          </select>
          {node && <span className={`rounded-md px-2 py-1 text-xs ${node.slot_selection_enabled === false ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>Sélection client {node.slot_selection_enabled === false ? 'désactivée' : 'activée'}</span>}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => goMonth(-1)} className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Mois précédent"><ChevronLeft size={16} /></button>
            <span className="min-w-[140px] text-center text-sm font-medium capitalize">{new Date(cursor.year, cursor.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => goMonth(1)} className="rounded-md p-1.5 hover:bg-gray-100" aria-label="Mois suivant"><ChevronRight size={16} /></button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
          {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
        </div>

        {error && <div className="mx-6 mt-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>}
        {notice && <div className="mx-6 mt-3 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</div>}

        {bulkMode && (
          <div className="mx-6 mt-4 space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-4">
            <div className="text-sm text-gray-700">
              <strong>1.</strong> Cliquez sur les dates du calendrier ({selectedDates.length} sélectionnée(s)) —
              <strong> 2.</strong> définissez les plages horaires et la capacité — <strong>3.</strong> Enregistrer.
            </div>
            {selectedDates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs text-gray-700 shadow-sm">
                    {new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    <button type="button" onClick={() => setSelectedDates((p) => p.filter((x) => x !== d))} aria-label="Retirer"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {ranges.map((r, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 text-xs">
                  <label>Début<input type="time" value={r.slot_start} onChange={(e) => setRange(i, 'slot_start', e.target.value)} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
                  <label>Fin<input type="time" value={r.slot_end} onChange={(e) => setRange(i, 'slot_end', e.target.value)} className="mt-0.5 block rounded border border-gray-200 px-2 py-1" /></label>
                  <label>Capacité max<input type="number" min={0} value={r.max_orders} onChange={(e) => setRange(i, 'max_orders', e.target.value)} className="mt-0.5 block w-24 rounded border border-gray-200 px-2 py-1" /></label>
                  <label>Nom FR (optionnel)<input value={r.name_fr} onChange={(e) => setRange(i, 'name_fr', e.target.value)} placeholder="Matin" className="mt-0.5 block w-32 rounded border border-gray-200 px-2 py-1" /></label>
                  <label>Nom AR (optionnel)<input dir="rtl" value={r.name_ar} onChange={(e) => setRange(i, 'name_ar', e.target.value)} className="mt-0.5 block w-32 rounded border border-gray-200 px-2 py-1" /></label>
                  {ranges.length > 1 && <button type="button" onClick={() => setRanges((p) => p.filter((_, j) => j !== i))} className="rounded p-1.5 text-gray-400 hover:text-red-600" aria-label="Retirer la plage"><Trash2 size={14} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setRanges((p) => [...p, { ...EMPTY_RANGE }])} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><Plus size={12} /> Ajouter une plage</button>
            </div>
            <button type="button" disabled={saving || !selectedDates.length} onClick={saveBulk} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer ({selectedDates.length * ranges.length} créneau(x))
            </button>
          </div>
        )}

        <div className="p-6">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
            {WEEKDAYS.map((w) => <div key={w} className="bg-gray-50 py-2 text-center text-xs font-semibold text-gray-500">{w}</div>)}
            {weeks.flat().map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[110px] bg-gray-50/60" />;
              const key = keyOf(cursor.year, cursor.month, day);
              const list = byDay[key] || [];
              const selected = selectedDates.includes(key);
              const past = key < tKey;
              return (
                <button key={i} type="button" onClick={() => clickDay(key)}
                  className={`min-h-[110px] bg-white p-1.5 text-left align-top hover:bg-red-50/40 ${selected ? 'ring-2 ring-inset ring-red-500' : ''} ${past ? 'opacity-70' : ''}`}
                >
                  <div className={`mb-1 text-xs font-semibold ${key === tKey ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white' : 'text-gray-600'}`}>{day}</div>
                  {list.slice(0, MAX_VISIBLE).map((s) => (
                    <div key={s.id} className={`mb-0.5 truncate rounded px-1 py-0.5 text-[10px] ${!s.is_active ? 'bg-gray-100 text-gray-400 line-through' : s.is_full ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}
                      title={`${s.slot_start}–${s.slot_end}${s.name_fr ? ` ${s.name_fr}` : ''} · ${s.reservations}/${s.max_orders} réservé(s) · ${s.preferences?.total || 0} préférence(s)`}
                    >
                      {s.slot_start}–{s.slot_end} · {s.reservations}/{s.max_orders}{s.preferences?.total ? ` · ♥${s.preferences.total}` : ''}
                    </div>
                  ))}
                  {list.length > MAX_VISIBLE && <div className="text-[10px] text-gray-400">+{list.length - MAX_VISIBLE} autre(s)</div>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-400">Format : plage · réservations/capacité · ♥ préférences client. Vert = places disponibles, rouge = complet, barré = inactif.</p>
        </div>
      </div>

      {activeDay && (
        <SlotFormPanel
          nodeId={nodeId}
          nodeLabel={node ? (node.code || node.name_fr) : ''}
          dateKey={activeDay}
          onClose={() => setActiveDay(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
