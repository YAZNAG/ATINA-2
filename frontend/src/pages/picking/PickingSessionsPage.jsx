import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { createPickingSession } from '../../api/picking.api';
import { getOrders } from '../../api/orders_mgmt.api';
import { getErrorMessage } from '../../utils/helpers';
import SessionsListTab from './SessionsListTab';
import SessionDetailPanel from './SessionDetailPanel';
import { orderRef } from './pickingUtils';

// Préparation (Picking) — onglets exacts du classeur.
const TABS = [
  { key: 'active',  label: 'Sessions en cours' },
  { key: 'detail',  label: 'Détail session & items' },
  { key: 'history', label: 'Historique' },
];

const LAST_KEY = 'picking.lastSessionId';
const readLast = () => { try { return sessionStorage.getItem(LAST_KEY); } catch { return null; } };
const writeLast = (id) => { try { sessionStorage.setItem(LAST_KEY, id); } catch { /* ignore */ } };

/**
 * Page « Préparation (Picking) ».
 * Routes : /picking/sessions (onglets liste, ?tab=history|detail) et /picking/sessions/:id (onglet détail).
 */
export default function PickingSessionsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = ['picking.update', 'dashboard.view'].some((c) => hasPermission(c));

  const tabParam = searchParams.get('tab');
  const activeTab = id ? 'detail' : (['history', 'detail'].includes(tabParam) ? tabParam : 'active');

  useEffect(() => { if (id) writeLast(id); }, [id]);

  const openSession = (sid) => { writeLast(sid); navigate(`/picking/sessions/${sid}`); };
  const goTab = (key) => {
    if (key === 'detail') {
      const last = id || readLast();
      navigate(last ? `/picking/sessions/${last}` : '/picking/sessions?tab=detail');
    } else {
      navigate(key === 'history' ? '/picking/sessions?tab=history' : '/picking/sessions');
    }
  };

  // Création manuelle d'une session (normalement automatique au passage de la commande en « picking »)
  const [showCreate, setShowCreate] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [creating, setCreating] = useState(false);
  const openCreate = async () => {
    setShowCreate(true); setOrderId('');
    try { const r = await getOrders({ status_code: 'picking', limit: 50 }); setOrders(r.data?.data ?? []); }
    catch { setOrders([]); }
  };
  const create = async () => {
    if (!orderId) { toast.error('Sélectionnez une commande'); return; }
    setCreating(true);
    try {
      const r = await createPickingSession({ order_id: orderId });
      toast.success('Session de préparation créée');
      setShowCreate(false);
      if (r.data?.data?.id) openSession(r.data.data.id);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCreating(false); }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Préparation (Picking)</h1>
          <p className="page-subtitle">Supervision des sessions de préparation des commandes par node et par picker.</p>
        </div>
        {canManage && (
          <button type="button" className="btn-danger" onClick={openCreate}><Plus size={16} />Nouvelle session</button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => goTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'active'  && <SessionsListTab key="active" mode="active" onOpen={openSession} />}
      {activeTab === 'history' && <SessionsListTab key="history" mode="history" onOpen={openSession} />}
      {activeTab === 'detail'  && <SessionDetailPanel sessionId={id || null} />}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="sm"
        title="Nouvelle session de préparation"
        subtitle="Commandes au statut « Picking »"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
            <button type="button" className="btn-danger" onClick={create} disabled={creating || !orderId}>{creating ? 'Création…' : 'Créer'}</button>
          </>
        )}
      >
        <label className="form-label">Commande</label>
        <select className="form-select" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">— Sélectionner une commande —</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{orderRef(o.id)} · {o.customer?.name ?? ''} · {Number(o.total_ttc ?? 0).toFixed(2)} MAD</option>
          ))}
        </select>
        {orders.length === 0 && <p className="mt-2 text-sm text-slate-400">Aucune commande au statut « Picking ».</p>}
      </Modal>
    </div>
  );
}
