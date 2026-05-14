import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getSession, startSession, completeSession,
  pickItem, outOfStock, substituteItem,
} from '../../api/pickerPortal.api';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => v
  ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const StatusBadge = ({ code, label }) => {
  const colors = {
    pending:     'bg-gray-100 text-gray-600',
    picked:      'bg-green-100 text-green-700',
    substituted: 'bg-blue-100 text-blue-700',
    out_of_stock:'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[code] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
};

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, sessionStatus, onAction }) {
  const [ean, setEan]         = useState('');
  const [qty, setQty]         = useState(Number(item.qty_expected));
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  const article = item.order_item?.sku?.article;
  const isPending   = item.status?.code === 'pending';
  const canInteract = sessionStatus === 'in_progress' && isPending;

  const handle = async (action) => {
    setLoading(true);
    try {
      await onAction(action, item.id, { scanned_ean: ean || undefined, qty_picked: qty });
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{article?.name_fr ?? 'Article'}</p>
          <p className="text-gray-400 text-xs">EAN : {article?.ean13 ?? '—'}</p>
          {item.location && (
            <p className="text-indigo-600 text-xs mt-0.5">
              📍 {item.location.label ?? `${item.location.aisle ?? ''}${item.location.shelf ?? ''}`}
            </p>
          )}
        </div>
        <StatusBadge code={item.status?.code} label={item.status?.name_fr} />
      </div>

      <div className="flex gap-4 text-xs text-gray-500 mb-3">
        <span>Attendu : <strong>{Number(item.qty_expected)}</strong></span>
        <span>Prélevé : <strong>{Number(item.qty_picked)}</strong></span>
        {item.scanned_ean && <span>Scanné : {item.scanned_ean}</span>}
      </div>

      {canInteract && (
        open ? (
          <div className="space-y-2 border-t pt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={ean}
                onChange={e => setEan(e.target.value)}
                placeholder="EAN scanné"
                className="border rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="number"
                value={qty}
                min={0.001}
                step={0.001}
                onChange={e => setQty(parseFloat(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handle('pick')}
                disabled={loading}
                className="flex-1 bg-green-600 text-white text-xs py-2 rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                ✓ Prélevé
              </button>
              <button
                onClick={() => handle('out_of_stock')}
                disabled={loading}
                className="flex-1 bg-red-100 text-red-700 text-xs py-2 rounded-lg hover:bg-red-200 disabled:opacity-60"
              >
                Rupture
              </button>
              <button
                onClick={() => handle('substitute')}
                disabled={loading}
                className="flex-1 bg-blue-100 text-blue-700 text-xs py-2 rounded-lg hover:bg-blue-200 disabled:opacity-60"
              >
                Substituer
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 text-xs px-2 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="w-full border border-indigo-300 text-indigo-600 text-xs py-2 rounded-lg hover:bg-indigo-50"
          >
            Traiter cet article
          </button>
        )
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [session,    setSession]  = useState(null);
  const [loading,    setLoading]  = useState(true);
  const [actionLoad, setActionLoad] = useState(false);

  const load = () => {
    getSession(sessionId)
      .then(res => setSession(res.data.data))
      .catch(() => toast.error('Session introuvable'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [sessionId]);

  const handleStart = async () => {
    setActionLoad(true);
    try {
      const res = await startSession(sessionId);
      setSession(res.data.data);
      toast.success('Session démarrée');
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Erreur');
    } finally {
      setActionLoad(false);
    }
  };

  const handleComplete = async () => {
    setActionLoad(true);
    try {
      const res = await completeSession(sessionId);
      setSession(res.data.data);
      toast.success('Préparation terminée — commande prête !');
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Erreur');
    } finally {
      setActionLoad(false);
    }
  };

  const handleItemAction = async (action, itemId, { scanned_ean, qty_picked }) => {
    try {
      let res;
      if (action === 'pick')         res = await pickItem(itemId, { scanned_ean, qty_picked });
      else if (action === 'out_of_stock') res = await outOfStock(itemId);
      else if (action === 'substitute')  res = await substituteItem(itemId, { qty_picked });
      setSession(res.data.data);
      toast.success(action === 'pick' ? 'Article prélevé' : action === 'out_of_stock' ? 'Rupture déclarée' : 'Article substitué');
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'Erreur');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;
  if (!session) return null;

  const items        = session.items ?? [];
  const pendingCount = items.filter(i => i.status?.code === 'pending').length;
  const doneCount    = items.filter(i => i.status?.code !== 'pending').length;
  const statusCode   = session.status?.code;

  return (
    <div className="space-y-5">
      {/* En-tête session */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs text-gray-400">Commande</p>
            <p className="font-bold text-gray-900">#{session.order?.id?.slice(-8).toUpperCase()}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            statusCode === 'in_progress' ? 'bg-amber-100 text-amber-700' :
            statusCode === 'completed'   ? 'bg-green-100 text-green-700' :
            statusCode === 'open'        ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {session.status?.name_fr}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div><span className="text-gray-400">Client</span><br />{session.order?.customer?.name ?? '—'}</div>
          <div><span className="text-gray-400">Démarré</span><br />{fmt(session.started_at)}</div>
          <div><span className="text-gray-400">Erreurs EAN</span><br />{session.error_count ?? 0}</div>
          <div><span className="text-gray-400">Terminé</span><br />{fmt(session.completed_at)}</div>
        </div>

        {/* Barre de progression */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{doneCount} / {items.length} articles traités</span>
            <span>{items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all"
              style={{ width: `${items.length > 0 ? (doneCount / items.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      {statusCode === 'open' && (
        <button
          onClick={handleStart}
          disabled={actionLoad}
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
        >
          {actionLoad ? '...' : '▶ Démarrer la préparation'}
        </button>
      )}
      {statusCode === 'in_progress' && pendingCount === 0 && (
        <button
          onClick={handleComplete}
          disabled={actionLoad}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-60"
        >
          {actionLoad ? '...' : '✓ Terminer la préparation'}
        </button>
      )}
      {statusCode === 'in_progress' && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {pendingCount} article(s) en attente — traitez-les pour pouvoir terminer
        </div>
      )}

      {/* Liste des articles */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Articles ({items.length})
        </h2>
        {items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            sessionStatus={statusCode}
            onAction={handleItemAction}
          />
        ))}
      </div>
    </div>
  );
}
