import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Download, Loader2, Save, Ban, ScanLine, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, RefreshCw, ArrowRight, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import {
  getStockCountRefs, getStockCounts, getStockCount, createStockCount,
  saveStockCountLines, validateStockCount, cancelStockCount,
} from '../../api/stockCounts.api';
import {
  N, fmtQty, fmtSigned, formatDateTime, downloadCsv, asList, apiError, todayStamp,
} from './inventaireUtils';

// Comptage / Inventaire physique — WF#5, US-043, US-044.
// Session : Nouveau comptage → saisie des quantités comptées (sauvegarde partielle,
// auto-save 30 s) → écart = compté − théorique → Validation = 1 ajustement
// (stock_moves adjustment_in / adjustment_out) par écart non nul.

const TABS = [
  { key: 'sessions',   label: 'Sessions de comptage' },
  { key: 'saisie',     label: 'Détail & saisie écarts' },
  { key: 'validation', label: 'Validation' },
];

const STATUS = {
  open:      { label: 'Ouverte',  className: 'bg-blue-100 text-blue-700' },
  validated: { label: 'Validée',  className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulée',  className: 'bg-gray-100 text-gray-500' },
};

const AUTO_SAVE_MS = 30000;
const PAGE_SIZE = 20;

const selectCls = 'border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none';
const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]';

const StatusBadge = ({ status }) => {
  const cfg = STATUS[status] ?? STATUS.open;
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
};

const scopeLabel = (s) => {
  if (s?.zone) return `Zone ${s.zone.code ?? ''} ${s.zone.name_fr ?? ''}`.trim();
  if (s?.category) return `Catégorie ${s.category.name_fr ?? ''}`.trim();
  return 'Tout le node';
};

const locationLabel = (loc) => {
  if (!loc) return null;
  const parts = [`Allée ${loc.aisle}`, `Rayon ${loc.shelf}`, loc.level ? `Niv. ${loc.level.code}` : null].filter(Boolean);
  return { label: loc.label, parts: parts.join(' • ') };
};

const gapClass = (g) => (g === null || g === undefined ? 'text-gray-300' : g > 0 ? 'text-green-600' : g < 0 ? 'text-red-600' : 'text-gray-500');

const Kpi = ({ label, value, tone }) => {
  const tones = { default: 'text-gray-900', blue: 'text-blue-600', amber: 'text-amber-600', red: 'text-red-600', green: 'text-green-600' };
  return (
    <div className="bg-white border rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${tones[tone] ?? tones.default}`}>{value}</p>
    </div>
  );
};

// ─── Modal « Nouveau comptage » ─────────────────────────────────────────────

function NewCountModal({ open, onClose, refs, onCreated }) {
  const [nodeId, setNodeId] = useState('');
  const [scope, setScope] = useState('node'); // node | zone | category
  const [zoneId, setZoneId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeUnlocated, setIncludeUnlocated] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setNodeId(''); setScope('node'); setZoneId(''); setCategoryId(''); setIncludeUnlocated(false); setNotes(''); setError(''); }
  }, [open]);

  const submit = async () => {
    setError('');
    if (!nodeId) return setError('Le node est obligatoire.');
    if (scope === 'zone' && !zoneId) return setError('Choisissez une zone.');
    if (scope === 'category' && !categoryId) return setError('Choisissez une catégorie.');
    setSaving(true);
    try {
      const res = await createStockCount({
        node_id: nodeId,
        zone_id: scope === 'zone' ? zoneId : null,
        category_id: scope === 'category' ? categoryId : null,
        ...(scope === 'zone' ? { include_unlocated: includeUnlocated } : {}),
        notes: notes.trim() || null,
      });
      const session = res?.data?.data;
      toast.success(`Liste de comptage générée (${session?.lines?.length ?? 0} ligne(s))`);
      onCreated(session);
    } catch (err) {
      setError(apiError(err, 'Erreur lors de la création de la session.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouveau comptage"
      subtitle="Génère la liste des SKU du périmètre, triée par emplacement (allée > rayon > niveau)"
      size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary inline-flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Générer liste de comptage
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="form-label">Node <span className="text-red-600">*</span></label>
          <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className="form-select">
            <option value="">Sélectionnez un node...</option>
            {(refs.nodes || []).map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Périmètre</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'node', label: 'Tout le node' },
              { key: 'zone', label: 'Une zone' },
              { key: 'category', label: 'Une catégorie' },
            ].map((o) => (
              <button key={o.key} type="button" onClick={() => setScope(o.key)} className={`px-4 py-2 rounded-lg text-sm font-medium border ${scope === o.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {scope === 'zone' && (
          <div>
            <label className="form-label">Zone <span className="text-red-600">*</span></label>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="form-select">
              <option value="">Choisir une zone...</option>
              {(refs.zones || []).map((z) => <option key={z.id} value={z.id}>{z.code} — {z.name_fr}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Seuls les SKU affectés à un emplacement de cette zone (Entrepôt &gt; Emplacements) sont comptés.</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnlocated}
                onChange={(e) => setIncludeUnlocated(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span>
                Inclure les SKU sans emplacement
                <span className="block text-xs text-gray-400">SKU en stock sur ce node sans aucun emplacement affecté : ajoutés en fin de liste.</span>
              </span>
            </label>
          </div>
        )}
        {scope === 'category' && (
          <div>
            <label className="form-label">Catégorie <span className="text-red-600">*</span></label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="form-select">
              <option value="">Choisir une catégorie...</option>
              {(refs.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="form-label">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="form-textarea" placeholder="Équipe, consignes... (facultatif)" />
        </div>
        <p className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
          La quantité théorique de chaque ligne est le stock physique au moment de la génération. Un SKU déjà présent dans une session ouverte du même node est refusé.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StockCountPage() {
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('stock_counts.manage');

  const [activeTab, setActiveTab] = useState('sessions');
  const [refs, setRefs] = useState({ nodes: [], zones: [], categories: [] });

  // Liste des sessions
  const [nodeFilter, setNodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refSearch, setRefSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showNew, setShowNew] = useState(false);

  // Session courante
  const [sessionId, setSessionId] = useState(searchParams.get('session') || null);
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [edits, setEdits] = useState({}); // { [lineId]: { qty_counted?, note? } }
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lineFilter, setLineFilter] = useState('all'); // all | gaps | uncounted
  const [scan, setScan] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const inputRefs = useRef({});
  const editsRef = useRef(edits);
  editsRef.current = edits;

  useEffect(() => {
    getStockCountRefs().then((res) => setRefs(res?.data?.data || { nodes: [], zones: [], categories: [] })).catch(() => {});
    if (searchParams.get('session')) setActiveTab('saisie');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Liste ──
  const loadSessions = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res = await getStockCounts({
        page, limit: PAGE_SIZE,
        ...(nodeFilter ? { node_id: nodeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        ...(refSearch.trim() ? { search: refSearch.trim() } : {}),
      });
      setSessions(asList(res));
      setPagination(res?.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setListError(apiError(err, 'Erreur lors du chargement des sessions.'));
      setSessions([]);
    } finally {
      setListLoading(false);
    }
  }, [page, nodeFilter, statusFilter, dateFrom, dateTo, refSearch]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Session ──
  const loadSession = useCallback(async (id) => {
    if (!id) { setSession(null); return; }
    setSessionLoading(true);
    setSessionError('');
    try {
      const res = await getStockCount(id);
      setSession(res?.data?.data ?? null);
    } catch (err) {
      setSessionError(apiError(err, 'Session introuvable.'));
      setSession(null);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => { setEdits({}); setValidationResult(null); loadSession(sessionId); }, [sessionId, loadSession]);

  const isOpen = session?.status === 'open';
  const editable = isOpen && canManage;
  const dirtyCount = Object.keys(edits).length;

  const openSession = (id, tab = 'saisie') => {
    if (dirtyCount && id !== sessionId && !window.confirm('Des saisies ne sont pas enregistrées. Changer de session quand même ?')) return;
    setSessionId(id);
    setActiveTab(tab);
  };

  // Lignes avec valeurs saisies (non enregistrées) fusionnées
  const lines = useMemo(() => (session?.lines || []).map((l) => {
    const e = edits[l.id];
    const counted = e && 'qty_counted' in e ? (e.qty_counted === '' ? null : Number(e.qty_counted)) : l.qty_counted;
    const note = e && 'note' in e ? e.note : (l.note ?? '');
    const validCount = counted === null || (Number.isFinite(counted) && counted >= 0);
    const gap = counted === null || !Number.isFinite(counted) ? null : Math.round((counted - N(l.qty_theoretical)) * 1000) / 1000;
    return { ...l, _counted: counted, _countedRaw: e && 'qty_counted' in e ? e.qty_counted : (l.qty_counted ?? ''), _note: note, _gap: gap, _invalid: !validCount, _dirty: !!e };
  }), [session, edits]);

  const summary = useMemo(() => {
    let counted = 0; let withGap = 0; let plus = 0; let minus = 0;
    lines.forEach((l) => {
      if (l._gap === null) return;
      counted += 1;
      if (l._gap !== 0) { withGap += 1; if (l._gap > 0) plus += l._gap; else minus += l._gap; }
    });
    const r = (v) => Math.round(v * 1000) / 1000;
    return { total: lines.length, counted, uncounted: lines.length - counted, withGap, plus: r(plus), minus: r(minus), net: r(plus + minus) };
  }, [lines]);

  const visibleLines = useMemo(() => {
    if (lineFilter === 'gaps') return lines.filter((l) => l._gap !== null && l._gap !== 0);
    if (lineFilter === 'uncounted') return lines.filter((l) => l._gap === null);
    return lines;
  }, [lines, lineFilter]);

  const setEdit = (lineId, field, value) => {
    setEdits((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] || {}), [field]: value } }));
  };

  // ── Sauvegarde (manuelle + auto-save 30 s) ──
  const save = useCallback(async ({ silent = false } = {}) => {
    const current = editsRef.current;
    const ids = Object.keys(current);
    if (!ids.length || !sessionId) return true;
    const payload = ids.map((id) => ({ id, ...current[id] }));
    const bad = payload.find((l) => 'qty_counted' in l && l.qty_counted !== '' && l.qty_counted !== null && (!Number.isFinite(Number(l.qty_counted)) || Number(l.qty_counted) < 0));
    if (bad) { if (!silent) toast.error('Quantité comptée invalide (nombre ≥ 0 attendu).'); return false; }
    setSaving(true);
    try {
      const res = await saveStockCountLines(sessionId, payload.map((l) => ({
        id: l.id,
        ...('qty_counted' in l ? { qty_counted: l.qty_counted === '' ? null : Number(l.qty_counted) } : {}),
        ...('note' in l ? { note: l.note } : {}),
      })));
      const updated = res?.data?.data?.session;
      // On ne retire que les saisies envoyées (l'utilisateur a pu continuer à taper)
      setEdits((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { if (JSON.stringify(prev[id]) === JSON.stringify(current[id])) delete next[id]; });
        return next;
      });
      if (updated) setSession(updated);
      setLastSavedAt(new Date());
      if (!silent) toast.success(`${payload.length} ligne(s) enregistrée(s)`);
      return true;
    } catch (err) {
      if (!silent) toast.error(apiError(err, "Erreur lors de l'enregistrement."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!editable) return undefined;
    const t = setInterval(() => { if (Object.keys(editsRef.current).length) save({ silent: true }); }, AUTO_SAVE_MS);
    return () => clearInterval(t);
  }, [editable, save]);

  // ── Scan / recherche EAN ──
  const handleScan = (e) => {
    e.preventDefault();
    const q = scan.trim().toLowerCase();
    if (!q) return;
    const found = lines.find((l) => l.sku?.ean13 === scan.trim())
      || lines.find((l) => l.sku?.sku_code?.toLowerCase() === q)
      || lines.find((l) => l.sku?.sku_code?.toLowerCase().includes(q) || l.sku?.name_fr?.toLowerCase().includes(q));
    if (!found) { toast.error('Aucune ligne de cette session ne correspond.'); return; }
    if (lineFilter !== 'all' && !visibleLines.includes(found)) setLineFilter('all');
    setTimeout(() => {
      const el = inputRefs.current[found.id];
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); el.select?.(); }
    }, 50);
    setScan('');
  };

  // ── Annulation / validation ──
  const handleCancel = async () => {
    const reason = window.prompt("Motif d'annulation de la session (facultatif) :", '');
    if (reason === null) return;
    try {
      const res = await cancelStockCount(sessionId, reason);
      setSession(res?.data?.data ?? null);
      setEdits({});
      toast.success('Session annulée');
      loadSessions();
    } catch (err) {
      toast.error(apiError(err, "Erreur lors de l'annulation."));
    }
  };

  const handleValidate = async () => {
    if (summary.counted === 0) { toast.error('Aucune quantité comptée.'); return; }
    const msg = `Valider le comptage ${session.reference} ?\n\n`
      + `${summary.withGap} écart(s) → ${summary.withGap} mouvement(s) d'ajustement.\n`
      + (summary.uncounted ? `${summary.uncounted} ligne(s) non comptée(s) seront ignorées (stock inchangé).\n` : '')
      + '\nCette action est définitive (mouvements append-only).';
    if (!window.confirm(msg)) return;
    setValidating(true);
    try {
      const ok = await save({ silent: false });
      if (!ok) return;
      const res = await validateStockCount(sessionId);
      const data = res?.data?.data;
      setValidationResult(data);
      if (data?.session) setSession(data.session);
      toast.success(res?.data?.message || 'Comptage validé');
      loadSessions();
    } catch (err) {
      toast.error(apiError(err, 'Erreur lors de la validation.'));
    } finally {
      setValidating(false);
    }
  };

  // ── Exports ──
  const exportSessions = () => {
    downloadCsv(`sessions-comptage-${todayStamp()}.csv`,
      ['Référence', 'Node', 'Périmètre', 'Statut', 'Lignes', 'Comptées', 'Avec écart', 'Écart net', 'Créée le', 'Créée par', 'Validée le', 'Validée par'],
      sessions.map((s) => [
        s.reference, s.node?.code, scopeLabel(s), STATUS[s.status]?.label, s.summary?.lines_total, s.summary?.lines_counted,
        s.summary?.lines_with_gap, s.summary?.gap_net, formatDateTime(s.created_at), s.created_by_user?.full_name ?? '',
        s.validated_at ? formatDateTime(s.validated_at) : '', s.validated_by_user?.full_name ?? '',
      ]));
  };

  const exportLines = () => {
    if (!session) return;
    downloadCsv(`comptage-${session.reference}.csv`,
      ['#', 'Emplacement', 'SKU', 'EAN', 'Produit', 'Qté théorique', 'Qté comptée', 'Écart', 'Note'],
      lines.map((l) => [
        l.position, l.location?.label ?? '', l.sku?.sku_code, l.sku?.ean13 ?? '', l.sku?.name_fr,
        N(l.qty_theoretical), l._counted ?? '', l._gap ?? '', l._note ?? '',
      ]));
  };

  // ── Rendus ──
  const sessionHeader = session && (
    <div className="bg-white border rounded-xl p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-poppins font-bold text-lg text-gray-900">{session.reference}</h2>
          <StatusBadge status={session.status} />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          <span className="text-[#E10600] font-medium">{session.node?.code}</span> — {session.node?.name_fr} • {scopeLabel(session)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Créée le {formatDateTime(session.created_at)}{session.created_by_user ? ` par ${session.created_by_user.full_name}` : ''}
          {session.validated_at && ` • Validée le ${formatDateTime(session.validated_at)}${session.validated_by_user ? ` par ${session.validated_by_user.full_name}` : ''}`}
        </p>
        {session.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{session.notes}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => loadSession(sessionId)} title="Recharger" className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><RefreshCw size={15} /></button>
        <button onClick={exportLines} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"><Download size={15} /> Exporter</button>
        {editable && (
          <button onClick={handleCancel} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"><Ban size={15} /> Annuler la session</button>
        )}
      </div>
    </div>
  );

  const noSession = (
    <div className="border rounded-xl bg-white py-20 text-center">
      <ClipboardList size={36} className="mx-auto text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">Sélectionnez une session dans « Sessions de comptage »{canManage ? ' ou lancez un nouveau comptage' : ''}.</p>
      {canManage && (
        <button onClick={() => setShowNew(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]"><Plus size={15} /> Nouveau comptage</button>
      )}
    </div>
  );

  const sessionState = (() => {
    if (!sessionId) return noSession;
    if (sessionLoading && !session) return <div className="py-16 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</div>;
    if (sessionError) return <div className="py-16 text-center text-red-600">{sessionError}</div>;
    return null;
  })();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-gray-900">Comptage / Inventaire physique</h1>
          <p className="text-sm text-gray-500 mt-1">Réconcilier le stock théorique et le stock réel : les écarts validés génèrent des ajustements de stock.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]">
            <Plus size={16} /> Nouveau comptage
          </button>
        )}
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
            {t.key !== 'sessions' && session && <span className="ml-1.5 text-xs text-gray-400">({session.reference})</span>}
          </button>
        ))}
      </div>

      {/* ─── Sessions de comptage ─── */}
      {activeTab === 'sessions' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={nodeFilter} onChange={(e) => { setNodeFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Tous les nodes</option>
              {(refs.nodes || []).map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Tous statuts</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={selectCls} aria-label="Du" title="Créée à partir du" />
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={selectCls} aria-label="Au" title="Créée jusqu'au" />
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={refSearch} onChange={(e) => { setRefSearch(e.target.value); setPage(1); }} placeholder="Référence..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-44 focus:ring-2 focus:ring-[#E10600] outline-none" />
            </div>
            <button onClick={exportSessions} disabled={!sessions.length} className="ml-auto flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Download size={15} /> Exporter</button>
          </div>

          <div className="border rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-b">
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Node</th>
                  <th className="px-4 py-3 font-medium">Périmètre</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Comptées</th>
                  <th className="px-4 py-3 font-medium text-right">Écarts</th>
                  <th className="px-4 py-3 font-medium text-right">Écart net</th>
                  <th className="px-4 py-3 font-medium">Créée</th>
                  <th className="px-4 py-3 font-medium">Validée</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</td></tr>}
                {!listLoading && listError && <tr><td colSpan={9} className="px-4 py-10 text-center text-red-600">{listError}</td></tr>}
                {!listLoading && !listError && sessions.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Aucune session de comptage pour ces filtres.</td></tr>
                )}
                {!listLoading && !listError && sessions.map((s) => (
                  <tr key={s.id} onClick={() => openSession(s.id)} className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${s.id === sessionId ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.reference}</td>
                    <td className="px-4 py-3 text-[#E10600] font-medium">{s.node?.code}</td>
                    <td className="px-4 py-3 text-gray-600">{scopeLabel(s)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-right">{s.summary?.lines_counted ?? 0} / {s.summary?.lines_total ?? 0}</td>
                    <td className="px-4 py-3 text-right">{s.summary?.lines_with_gap ? <span className="text-amber-600 font-medium">{s.summary.lines_with_gap}</span> : '0'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${gapClass(s.summary?.gap_net)}`}>{fmtSigned(s.summary?.gap_net)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(s.created_at)}<span className="block text-xs text-gray-400">{s.created_by_user?.full_name ?? ''}</span></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.validated_at ? formatDateTime(s.validated_at) : '—'}<span className="block text-xs text-gray-400">{s.validated_by_user?.full_name ?? ''}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{pagination.total ?? 0} session(s)</span>
            {(pagination.pages ?? 1) > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded border disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span>Page {page} / {pagination.pages}</span>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded border disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Détail & saisie écarts ─── */}
      {activeTab === 'saisie' && (sessionState || (session && (
        <>
          {sessionHeader}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Lignes" value={summary.total} />
            <Kpi label="Comptées" value={summary.counted} tone="blue" />
            <Kpi label="Restant à compter" value={summary.uncounted} tone={summary.uncounted ? 'amber' : 'green'} />
            <Kpi label="Lignes avec écart" value={summary.withGap} tone={summary.withGap ? 'red' : 'default'} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            {isOpen && (
              <form onSubmit={handleScan} className="relative">
                <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scanner un EAN ou taper un code SKU + Entrée" className="pl-9 pr-3 py-2 border rounded-lg text-sm w-80 focus:ring-2 focus:ring-[#E10600] outline-none" />
              </form>
            )}
            <div className="flex gap-2">
              {[
                { key: 'all', label: `Toutes (${summary.total})` },
                { key: 'gaps', label: `Voir les écarts (${summary.withGap})` },
                { key: 'uncounted', label: `Non comptées (${summary.uncounted})` },
              ].map((f) => (
                <button key={f.key} onClick={() => setLineFilter(f.key)} className={`px-3 py-2 text-sm rounded-lg font-medium ${lineFilter === f.key ? 'bg-[#E10600] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{f.label}</button>
              ))}
            </div>
            {editable && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {saving ? 'Enregistrement...' : dirtyCount ? `${dirtyCount} saisie(s) non enregistrée(s) — auto-save 30 s` : lastSavedAt ? `Enregistré à ${lastSavedAt.toLocaleTimeString('fr-FR')}` : 'Aucune modification'}
                </span>
                <button onClick={() => save()} disabled={saving || !dirtyCount} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500] disabled:opacity-50">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
                </button>
              </div>
            )}
          </div>

          {!isOpen && <p className="mb-3 text-sm text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">Session {STATUS[session.status]?.label.toLowerCase()} : lecture seule.</p>}
          {isOpen && !canManage && <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Lecture seule : la permission « stock_counts.manage » est requise pour saisir.</p>}

          <div className="border rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-b">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Emplacement</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">Produit</th>
                  <th className="px-3 py-3 font-medium text-right">Qté théorique</th>
                  <th className="px-3 py-3 font-medium text-right w-36">Qté comptée</th>
                  <th className="px-3 py-3 font-medium text-right">Écart</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Aucune ligne pour ce filtre.</td></tr>}
                {visibleLines.map((l) => {
                  const loc = locationLabel(l.location);
                  return (
                    <tr key={l.id} className={`border-b last:border-0 ${l._dirty ? 'bg-yellow-50/60' : ''}`}>
                      <td className="px-3 py-2 text-gray-400">{l.position}</td>
                      <td className="px-3 py-2">
                        {loc ? <><span className="font-medium text-gray-800">{loc.label}</span><span className="block text-xs text-gray-400">{loc.parts}</span></> : <span className="text-xs italic text-gray-400">Sans emplacement</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700"><span className="font-medium">{l.sku?.sku_code}</span>{l.sku?.ean13 && <span className="block text-xs text-gray-400">{l.sku.ean13}</span>}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {l.sku?.name_fr}
                        {l.stock_changed && (
                          <span className="ml-1 inline-flex items-center gap-1 text-xs text-amber-600" title={`Stock physique actuel : ${fmtQty(l.qty_physical_current)} (modifié depuis la génération)`}>
                            <AlertTriangle size={12} /> stock modifié
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtQty(l.qty_theoretical)}</td>
                      <td className="px-3 py-2 text-right">
                        {editable ? (
                          <input
                            ref={(el) => { inputRefs.current[l.id] = el; }}
                            type="number"
                            min="0"
                            step="any"
                            value={l._countedRaw ?? ''}
                            onChange={(e) => setEdit(l.id, 'qty_counted', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const idx = visibleLines.findIndex((x) => x.id === l.id);
                                const next = visibleLines[idx + 1];
                                if (next) inputRefs.current[next.id]?.focus();
                              }
                            }}
                            className={`${inputCls} text-right ${l._invalid ? 'border-red-400' : ''}`}
                            placeholder="—"
                          />
                        ) : (
                          <span className="font-medium">{l._counted === null ? '—' : fmtQty(l._counted)}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${gapClass(l._gap)}`}>{l._gap === null ? '—' : fmtSigned(l._gap)}</td>
                      <td className="px-3 py-2 min-w-[160px]">
                        {editable
                          ? <input value={l._note ?? ''} onChange={(e) => setEdit(l.id, 'note', e.target.value)} className={inputCls} placeholder="Recompté, casse..." />
                          : <span className="text-gray-500 text-xs">{l._note || '—'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">Écart = qté comptée − qté théorique (stock physique à la génération). Entrée = ligne suivante.</p>
            <button onClick={() => setActiveTab('validation')} className="inline-flex items-center gap-1 text-sm font-medium text-[#E10600] hover:underline">
              Passer à la validation <ArrowRight size={14} />
            </button>
          </div>
        </>
      )))}

      {/* ─── Validation ─── */}
      {activeTab === 'validation' && (sessionState || (session && (
        <>
          {sessionHeader}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <Kpi label="Lignes" value={summary.total} />
            <Kpi label="Comptées" value={summary.counted} tone="blue" />
            <Kpi label="Non comptées" value={summary.uncounted} tone={summary.uncounted ? 'amber' : 'default'} />
            <Kpi label="Avec écart" value={summary.withGap} tone={summary.withGap ? 'red' : 'default'} />
            <Kpi label="Écarts +" value={fmtSigned(summary.plus)} tone="green" />
            <Kpi label="Écarts −" value={fmtQty(summary.minus)} tone="red" />
            <Kpi label="Écart net" value={fmtSigned(summary.net)} tone={summary.net < 0 ? 'red' : summary.net > 0 ? 'green' : 'default'} />
          </div>

          {isOpen && dirtyCount > 0 && (
            <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {dirtyCount} saisie(s) non enregistrée(s) : elles seront enregistrées avant la validation.
            </p>
          )}
          {isOpen && summary.uncounted > 0 && (
            <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {summary.uncounted} ligne(s) non comptée(s) : elles seront ignorées (aucun ajustement, stock inchangé).
            </p>
          )}

          <div className="border rounded-xl overflow-x-auto bg-white mb-4">
            <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">
              Récapitulatif des écarts {isOpen ? '— ajustements qui seront générés' : ''}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b">
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium">Produit</th>
                  <th className="px-4 py-2.5 font-medium text-right">Théorique</th>
                  <th className="px-4 py-2.5 font-medium text-right">Compté</th>
                  <th className="px-4 py-2.5 font-medium text-right">Écart</th>
                  <th className="px-4 py-2.5 font-medium">Ajustement</th>
                  <th className="px-4 py-2.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.filter((l) => l._gap).length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun écart {summary.counted ? '(toutes les lignes comptées correspondent au théorique)' : ''}.</td></tr>
                )}
                {lines.filter((l) => l._gap).map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{l.sku?.sku_code}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {l.sku?.name_fr}
                      {l.stock_changed && <span className="block text-xs text-amber-600">Stock actuel {fmtQty(l.qty_physical_current)} ≠ théorique : l'écart sera appliqué au stock actuel</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(l.qty_theoretical)}</td>
                    <td className="px-4 py-2.5 text-right">{fmtQty(l._counted)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${gapClass(l._gap)}`}>{fmtSigned(l._gap)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${l._gap > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {l._gap > 0 ? 'Ajustement entrée' : 'Ajustement sortie'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{l._note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validationResult && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
              <p className="font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> Comptage validé : {validationResult.adjustments_count} ajustement(s) généré(s)</p>
              <p className="mt-1">{validationResult.lines_counted} ligne(s) comptée(s), {validationResult.lines_uncounted} ignorée(s).</p>
              {validationResult.warnings?.length > 0 && (
                <p className="mt-1 text-amber-700">{validationResult.warnings.length} SKU dont le stock avait bougé depuis la génération : l'écart a été appliqué au stock courant.</p>
              )}
            </div>
          )}

          <div className="bg-white border rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {isOpen
                ? "La validation crée un mouvement d'ajustement (append-only) par écart non nul et met à jour le stock physique, le disponible et la date de dernier comptage."
                : `Session ${STATUS[session.status]?.label.toLowerCase()}${session.validated_at ? ` le ${formatDateTime(session.validated_at)}` : ''} — aucune action possible.`}
            </p>
            {editable && (
              <button onClick={handleValidate} disabled={validating || summary.counted === 0} className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500] disabled:opacity-50">
                {validating ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Valider (génère ajustement)
              </button>
            )}
          </div>
        </>
      )))}

      <NewCountModal
        open={showNew}
        onClose={() => setShowNew(false)}
        refs={refs}
        onCreated={(s) => {
          setShowNew(false);
          loadSessions();
          if (s?.id) { setSessionId(s.id); setSession(s); setActiveTab('saisie'); }
        }}
      />
    </div>
  );
}
