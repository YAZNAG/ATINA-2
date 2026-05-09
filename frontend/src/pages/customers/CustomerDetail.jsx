import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getCustomer, blockCustomer, unblockCustomer, deleteCustomer } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import CustomerShell from './CustomerShell';

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 min-w-[110px]">{label}</span>
      <div className="text-right min-w-0">{children ?? <span className="text-gray-300 text-sm">—</span>}</div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const canView = hasPermission('customers.view') || hasPermission('dashboard.view');
  const canUpdate = hasPermission('customers.update') || hasPermission('dashboard.view');
  const canDelete = hasPermission('customers.delete') || hasPermission('dashboard.view');

  const load = useCallback(async () => {
    if (!canView || !id) return;
    setLoading(true);
    try {
      const res = await getCustomer(id);
      setC(res.data?.data ?? null);
    } catch (e) {
      toast.error(getErrorMessage(e));
      setC(null);
    } finally {
      setLoading(false);
    }
  }, [id, canView]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    load();
  }, [canView, load]);

  const handleBlock = async () => {
    if (!window.confirm('Bloquer ce client ? Il ne pourra plus se connecter à l’application.')) return;
    setActing(true);
    try {
      await blockCustomer(id);
      toast.success('Client bloqué');
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setActing(false);
    }
  };

  const handleUnblock = async () => {
    setActing(true);
    try {
      await unblockCustomer(id);
      toast.success('Client débloqué');
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setActing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer (logiquement) le client « ${c.name} » ?`)) return;
    setActing(true);
    try {
      await deleteCustomer(id);
      toast.success('Client supprimé');
      navigate('/customers');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setActing(false);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600 text-sm py-16">
        Accès refusé.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-24 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
        <p className="text-sm text-gray-400">Chargement…</p>
      </div>
    );
  }

  if (!c) {
    return (
      <CustomerShell
        crumbLabel="Clients"
        crumbHref="/customers"
        breadcrumbTail="Introuvable"
        title="Client introuvable"
        pageSubtitle="Cet identifiant ne correspond à aucun enregistrement."
        contentClassName="max-w-3xl mx-auto"
      >
        <Link to="/customers" className="text-sm font-semibold text-red-600 hover:text-red-800">
          ← Retour à la liste
        </Link>
      </CustomerShell>
    );
  }

  const editBtn = canUpdate && !c.is_deleted && (
    <button
      type="button"
      onClick={() => navigate(`/customers/${id}/edit`)}
      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      Modifier
    </button>
  );

  return (
    <CustomerShell
      crumbLabel="Clients"
      crumbHref="/customers"
      breadcrumbTail={c.name}
      title={c.name}
      pageSubtitle="Fiche client — présentation type référentiel catalogue."
      headerRight={editBtn}
      contentClassName="max-w-3xl mx-auto"
    >
      {canUpdate && !c.is_deleted ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {c.is_active ? (
            <button type="button" disabled={acting} className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={handleBlock}>
              Bloquer
            </button>
          ) : (
            <button type="button" disabled={acting} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white" onClick={handleUnblock}>
              Débloquer
            </button>
          )}
          {canDelete ? (
            <button
              type="button"
              disabled={acting}
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
            >
              Supprimer (logique)
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-700 to-red-500 px-6 py-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-white font-bold text-lg">
            {(c.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-red-200 text-[11px] font-semibold uppercase tracking-widest">Client</p>
            <p className="text-white font-bold text-base leading-tight truncate max-w-[16rem] sm:max-w-none">{c.name}</p>
          </div>
        </div>

        <div className="px-6 py-4">
          <DetailRow label="Identifiant">
            <span className="text-sm font-mono text-gray-700 break-all">{c.id}</span>
          </DetailRow>
          <DetailRow label="Téléphone">
            <span className="text-sm text-gray-800">
              {c.phone_country} {c.phone_number}
            </span>
          </DetailRow>
          <DetailRow label="Vérif. tél.">{c.phone_verified_at ? formatDate(c.phone_verified_at) : 'Non'}</DetailRow>
          <DetailRow label="Langue">{c.preferred_lang}</DetailRow>
          <DetailRow label="Code parrain">
            <span className="text-sm font-mono text-gray-700">{c.referral_code}</span>
          </DetailRow>
          <DetailRow label="Parrain">{c.referred_by ? `${c.referred_by.name} (${c.referred_by.referral_code})` : '—'}</DetailRow>
          <DetailRow label="Wallet (MAD)">{String(c.wallet_balance)}</DetailRow>
          <DetailRow label="Points">{c.points_balance}</DetailRow>
          <DetailRow label="Points vie">{c.points_lifetime}</DetailRow>
          <DetailRow label="Ville">{c.city || '—'}</DetailRow>
          <DetailRow label="Lat / lng">{c.lat != null && c.lng != null ? `${c.lat}, ${c.lng}` : '—'}</DetailRow>
          <DetailRow label="Statut">
            {c.is_deleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">Supprimé</span>
            ) : c.is_active ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">Actif</span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">Bloqué</span>
            )}
          </DetailRow>
          <DetailRow label="Créé le">{formatDate(c.created_at)}</DetailRow>
          <DetailRow label="Mis à jour">{formatDate(c.updated_at)}</DetailRow>
          <DetailRow label="Commandes">{c._count ? `${c._count.orders} commandes, ${c._count.addresses} adresses` : '—'}</DetailRow>
        </div>

        <div className="px-6 pb-6 pt-2 flex gap-3 border-t border-gray-50">
          <Link to="/customers" className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 text-center transition-colors">
            Liste clients
          </Link>
          {canUpdate && !c.is_deleted ? (
            <button
              type="button"
              onClick={() => navigate(`/customers/${id}/edit`)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              Modifier
            </button>
          ) : null}
        </div>
      </div>
    </CustomerShell>
  );
}
