import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Power, PowerOff, Trash2, MapPin } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getNode, updateNode, deleteNode } from '../../../api/locationNode.api';
import NodeInfoTab from './NodeInfoTab';
import NodeLocationTab from './NodeLocationTab';
import NodeHoursTab from './NodeHoursTab';

const TABS = [
  { key: 'info', label: 'Informations' },
  { key: 'location', label: 'Localisation' },
  { key: 'hours', label: 'Horaires' },
];

function StatusBadge({ item }) {
  if (item.is_deleted) {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimé</span>;
  }
  if (item.is_active) {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactif</span>;
}

export default function NodeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission('nodes.view');
  const canUpdate = hasPermission('nodes.update');
  const canDelete = hasPermission('nodes.delete');

  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchNode = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getNode(id);
      setNode(data.data || data);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement du node');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (canView) fetchNode(); }, [canView, fetchNode]);

  const toggleActive = async () => {
    setToggling(true);
    try {
      await updateNode(node.id, { is_active: !node.is_active });
      showToast('success', !node.is_active ? 'Node activé' : 'Node désactivé');
      fetchNode();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setToggling(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteNode(node.id);
      showToast('success', 'Node supprimé');
      navigate('/nodes');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  if (loading || !node) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  const isDeleted = Boolean(node.is_deleted);

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'}`}>
          {toast.message}
        </div>
      )}

      <button onClick={() => navigate('/nodes')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={16} />
        Retour aux nodes
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-poppins text-xl font-semibold text-neutral-900">{node.name_fr}</h1>
            <StatusBadge item={node} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-neutral-500">
            <span className="font-mono">{node.code}</span>
            <span>·</span>
            <span>{node.node_type?.name_fr || '—'}</span>
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {[node.city?.name_fr, node.region?.name_fr].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button onClick={toggleActive} disabled={toggling}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  node.is_active ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                }`}>
                {toggling ? <Loader2 size={14} className="animate-spin" /> : node.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                {node.is_active ? 'Actif' : 'Inactif'}
              </button>
            )}
            {canDelete && (
              <button onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-[#E10600]">
                <Trash2 size={14} />
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'text-[#E10600]' : 'text-neutral-500 hover:text-neutral-800'
            }`}>
            {t.label}
            {tab === t.key && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#E10600]" />}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {tab === 'info' && (
          <NodeInfoTab node={node} canUpdate={canUpdate && !isDeleted} onSaved={fetchNode} showToast={showToast} />
        )}
        {tab === 'location' && (
          <NodeLocationTab node={node} canUpdate={canUpdate && !isDeleted} onSaved={fetchNode} showToast={showToast} />
        )}
        {tab === 'hours' && (
          <NodeHoursTab node={node} canUpdate={canUpdate && !isDeleted} onSaved={fetchNode} showToast={showToast} />
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer ce node ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{node.name_fr}</span> passera au statut "Supprimé".
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(false)} disabled={deleting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Annuler</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}