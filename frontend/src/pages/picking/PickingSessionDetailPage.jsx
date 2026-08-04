import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPickingSession, startSession, completeSession, cancelSession, assignPicker, pickItem, substituteItem, outOfStockItem, getPickers } from '../../api/picking.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  back:    'M10 19l-7-7m0 0l7-7m-7 7h18',
  box:     'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  scan:    'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3a2 2 0 00-2 2v10a2 2 0 002 2h4a2 2 0 002-2V10a2 2 0 00-2-2H5zm14 0h-2a2 2 0 00-2 2v10a2 2 0 002 2h4a2 2 0 002-2V10a2 2 0 00-2-2h-2zM9 5H7a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2z',
  check:   'M5 13l4 4L19 7',
  x:       'M6 18L18 6M6 6l12 12',
  swap:    'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  warn:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  play:    'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  done:    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  cancel:  'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  user:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  pin:     'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const STATUS_COLOR = {
  open:        'bg-gray-100 text-gray-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-red-100 text-red-700',
};
const ITEM_COLOR = {
  pending:      'bg-gray-100 text-gray-600',
  picked:       'bg-emerald-100 text-emerald-700',
  substituted:  'bg-blue-100 text-blue-700',
  out_of_stock: 'bg-red-100 text-red-700',
};

function Badge({ code, name_fr, map }) {
  const cls = map[code] ?? 'bg-gray-100 text-gray-600';
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{name_fr}</span>;
}

// ── Scan input component ────────────────────────────────────────────────────────
function ScanModal({ item, onClose, onConfirm }) {
  const [ean, setEan]  = useState('');
  const [qty, setQty]  = useState(Number(item.qty_expected));
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const name = item.order_item?.sku?.article?.name_fr ?? 'Article';
  const expectedEan = item.order_item?.sku?.article?.ean13;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Scanner l'article</p>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{name}</h3>
            {expectedEan && <p className="text-xs font-mono text-gray-400 mt-0.5">EAN attendu : {expectedEan}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <Icon d={SVG.x} className="w-5 h-5" />
          </button>
        </div>

        {/* EAN scan input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Code EAN scanné</label>
          <input ref={ref} value={ean} onChange={e => setEan(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onConfirm({ ean, qty })}
            placeholder="Scannez ou saisissez l'EAN..."
            className="w-full px-4 py-3 text-lg font-mono border-2 border-violet-300 rounded-xl focus:outline-none focus:border-violet-500 bg-violet-50" />
        </div>

        {/* Qty */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Quantité préparée <span className="normal-case text-gray-400 font-normal">(attendue: {item.qty_expected})</span>
          </label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(0, q - 1))} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xl font-bold flex items-center justify-center">−</button>
            <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} min="0"
              className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:border-violet-500" />
            <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xl font-bold flex items-center justify-center">+</button>
          </div>
        </div>

        <button onClick={() => onConfirm({ ean, qty })}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-xl flex items-center justify-center gap-2">
          <Icon d={SVG.check} className="w-5 h-5" />Confirmer le picking
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PickingSessionDetailPage() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [pickers, setPickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState({});
  const [scanItem, setScanItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPickingSession(id);
      const s = r.data?.data;
      setSession(s);
      if (s?.node?.id) {
        getPickers({ node_id: s.node.id }).then(pr => setPickers(pr.data?.data ?? [])).catch(() => {});
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, msg) => {
    setActing(a => ({ ...a, [key]: true }));
    try { await fn(); toast.success(msg); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(a => ({ ...a, [key]: false })); }
  };

  const handleScan = async ({ ean, qty }) => {
    if (!scanItem) return;
    setScanItem(null);
    act(`pick-${scanItem.id}`, () => pickItem(scanItem.id, { scanned_ean: ean || undefined, qty_picked: qty }), 'Article préparé ✓');
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>;
  if (!session) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Session introuvable</div>;

  const statusCode     = session.status?.code;
  const isActive       = ['open', 'in_progress'].includes(statusCode);
  const itemsPickable  = statusCode === 'in_progress';
  const isCompleted    = statusCode === 'completed';
  const pendingItems   = session.items?.filter(i => i.status?.code === 'pending') ?? [];
  const progress       = session.items?.length ? Math.round(((session.items.length - pendingItems.length) / session.items.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {scanItem && <ScanModal item={scanItem} onClose={() => setScanItem(null)} onConfirm={handleScan} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link to="/picking/sessions" className="hover:text-violet-600 flex items-center gap-1">
              <Icon d={SVG.back} className="w-3.5 h-3.5" />Sessions
            </Link>
            <span>›</span>
            <span className="text-gray-700 font-mono font-medium">PSK-{id.slice(0,8).toUpperCase()}</span>
          </div>

          <div className="flex items-start justify-between gap-4 pb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${STATUS_COLOR[statusCode] ?? 'bg-gray-100 text-gray-700'}`}>
                  {session.status?.name_fr}
                </span>
                {session.error_count > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                    <Icon d={SVG.warn} className="w-3.5 h-3.5" />{session.error_count} erreur{session.error_count > 1 ? 's' : ''} scan
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                <span className="font-mono font-semibold text-blue-600">ORD-{session.order_id?.slice(0,8).toUpperCase()}</span>
                {' '} · {session.order?.customer?.name}
                {' '} · {Number(session.order?.total_ttc ?? 0).toFixed(2)} MAD
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                <span><Icon d={SVG.pin} className="w-3 h-3 inline mr-0.5" />{session.node?.code}</span>
                <span><Icon d={SVG.user} className="w-3 h-3 inline mr-0.5" />{session.picker?.name ?? 'Non assigné'}</span>
                {session.started_at && <span>Démarré {formatDate(session.started_at)}</span>}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {statusCode === 'open' && (
                <button onClick={() => act('start', () => startSession(id, {}), 'Session démarrée')} disabled={acting.start}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                  <Icon d={SVG.play} className="w-4 h-4" />Démarrer
                </button>
              )}
              {statusCode === 'in_progress' && pendingItems.length === 0 && (
                <button onClick={() => act('complete', () => completeSession(id), 'Picking terminé — commande Prête ✓')} disabled={acting.complete}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                  <Icon d={SVG.done} className="w-4 h-4" />Terminer
                </button>
              )}
              {isActive && (
                <button onClick={() => { if (window.confirm('Annuler cette session ?')) act('cancel', () => cancelSession(id), 'Session annulée'); }} disabled={acting.cancel}
                  className="flex items-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50">
                  <Icon d={SVG.cancel} className="w-4 h-4" />Annuler
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {session.items?.length > 0 && (
            <div className="pb-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>{session.items.length - pendingItems.length}/{session.items.length} articles traités</span>
                <span className="font-bold text-violet-600">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-violet-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items grid */}
      <div className="px-6 py-5">
        {/* Picker assign (if not assigned) */}
        {isActive && !session.picker && pickers.length > 0 && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Icon d={SVG.warn} className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-800 flex-1">Session non assignée</span>
            <select onChange={e => act('assign', () => assignPicker(id, e.target.value), 'Picker affecté')}
              className="text-sm border border-amber-300 rounded-lg px-2 py-1 bg-white focus:outline-none">
              <option value="">Affecter un picker</option>
              {pickers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

          {statusCode === 'open' && (
            <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-800">
              Démarrez la session pour activer le scan et les actions sur les articles.
            </div>
          )}
          <p className="text-center py-12 text-gray-400">Aucun article dans cette session</p>
        ) : (
          <div className="space-y-3">
            {/* Pending first */}
            {pendingItems.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{pendingItems.length} article{pendingItems.length > 1 ? 's' : ''} en attente</p>
                {pendingItems.map(item => <ItemCard key={item.id} item={item} isActive={itemsPickable} onScan={() => setScanItem(item)} onSubstitute={() => act(`sub-${item.id}`, () => substituteItem(item.id), 'Substitution enregistrée')} onOos={() => act(`oos-${item.id}`, () => outOfStockItem(item.id), 'Rupture enregistrée')} acting={acting} />)}
              </>
            )}

            {/* Done items */}
            {session.items.filter(i => i.status?.code !== 'pending').length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-5">Articles traités</p>
                {session.items.filter(i => i.status?.code !== 'pending').map(item =>
                  <ItemCard key={item.id} item={item} isActive={false} onScan={() => {}} onSubstitute={() => {}} onOos={() => {}} acting={{}} />
                )}
              </>
            )}
          </div>
        )
      </div>
    </div>
  );
}

function ItemCard({ item, isActive, onScan, onSubstitute, onOos, acting }) {
  const name     = item.order_item?.sku?.article?.name_fr ?? 'Article inconnu';
  const skuCode  = item.order_item?.sku?.article?.sku_code ?? '';
  const ean      = item.order_item?.sku?.article?.ean13;
  const loc      = item.location;
  const isPending = item.status?.code === 'pending';
  const isPicked  = item.status?.code === 'picked';
  const key       = item.id;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
      isPicked ? 'border-emerald-200 opacity-75' :
      item.status?.code === 'out_of_stock' ? 'border-red-200 opacity-60' :
      item.status?.code === 'substituted' ? 'border-blue-200 opacity-75' :
      'border-gray-100 hover:border-violet-200'
    }`}>
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isPending ? 'bg-violet-50' : isPicked ? 'bg-emerald-50' : 'bg-gray-50'
        }`}>
          <Icon d={SVG.box} className={`w-5 h-5 ${isPicked ? 'text-emerald-600' : 'text-gray-400'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
              <p className="text-[11px] font-mono text-gray-400">{skuCode}</p>
              {ean && <p className="text-[11px] font-mono text-gray-400">EAN: {ean}</p>}
              {loc && (
                <p className="text-xs text-blue-600 font-semibold mt-1">
                  <Icon d={SVG.pin} className="w-3 h-3 inline mr-0.5" />
                  {loc.aisle && `Allée ${loc.aisle}`} {loc.shelf && `· Rayon ${loc.shelf}`}
                </p>
              )}
            </div>
            <Badge code={item.status?.code} name_fr={item.status?.name_fr} map={ITEM_COLOR} />
          </div>

          {/* Qty progress */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400">Attendu:</span>
              <span className="font-bold text-gray-800">{item.qty_expected}</span>
            </div>
            {item.qty_picked > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400">Préparé:</span>
                <span className={`font-bold ${item.qty_picked >= item.qty_expected ? 'text-emerald-600' : 'text-amber-600'}`}>{item.qty_picked}</span>
              </div>
            )}
            {item.scanned_ean && <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ {item.scanned_ean}</span>}
          </div>

          {/* Actions — only for pending items and active sessions */}
          {isActive && isPending && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={onScan} disabled={acting[`pick-${key}`]}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                <Icon d={SVG.scan} className="w-3.5 h-3.5" />Scanner / Picker
              </button>
              <button onClick={onSubstitute} disabled={acting[`sub-${key}`]}
                className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-50 disabled:opacity-50">
                <Icon d={SVG.swap} className="w-3.5 h-3.5" />Substituer
              </button>
              <button onClick={onOos} disabled={acting[`oos-${key}`]}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50">
                <Icon d={SVG.warn} className="w-3.5 h-3.5" />Rupture
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
