import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCustomer } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

function Field({ label, children }) {
  return (
    <div className="py-2 border-b border-gray-100 sm:grid sm:grid-cols-3 sm:gap-3">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-gray-900 break-all">{children ?? '—'}</dd>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const [c, setC] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = hasPermission('customers.view') || hasPermission('dashboard.view');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getCustomer(id);
        if (!cancelled) setC(res.data?.data ?? null);
      } catch (e) {
        if (!cancelled) toast.error(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, canView]);

  if (!canView) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="page-shell">
        <Link to="/customers" className="text-sm text-gray-500 hover:text-gray-700">← Liste clients</Link>
        <p className="mt-4 text-gray-600">Client introuvable.</p>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-3xl">
      <Link to="/customers" className="text-sm text-gray-500 hover:text-gray-700">← Liste clients</Link>
      <h1 className="page-title mt-2">{c.name}</h1>
      <p className="text-xs text-gray-500 font-mono mt-1">{c.id}</p>

      <div className="card mt-6 p-4 sm:p-6">
        <dl className="divide-y divide-gray-100">
          <Field label="Téléphone">{`${c.phone_country} ${c.phone_number}`}</Field>
          <Field label="Téléphone vérifié le">{c.phone_verified_at ? formatDate(c.phone_verified_at) : 'Non'}</Field>
          <Field label="Langue">{c.preferred_lang}</Field>
          <Field label="Code parrainage">{c.referral_code}</Field>
          <Field label="Parrain (si applicable)">
            {c.referred_by
              ? `${c.referred_by.name} (${c.referred_by.referral_code})`
              : '—'}
          </Field>
          <Field label="Wallet (MAD)">{String(c.wallet_balance)}</Field>
          <Field label="Points">{c.points_balance}</Field>
          <Field label="Points vie">{c.points_lifetime}</Field>
          <Field label="Ville">{c.city}</Field>
          <Field label="Lat / Lng">{c.lat != null && c.lng != null ? `${c.lat}, ${c.lng}` : '—'}</Field>
          <Field label="Actif (compte)">{c.is_active ? 'Oui' : 'Non (bloqué)'}</Field>
          <Field label="Suppression logique">{c.is_deleted ? `Oui — ${c.deleted_at ? formatDate(c.deleted_at) : ''}` : 'Non'}</Field>
          <Field label="Créé le">{formatDate(c.created_at)}</Field>
          <Field label="Mis à jour">{formatDate(c.updated_at)}</Field>
          <Field label="Commandes / adresses">
            {c._count ? `${c._count.orders} commandes, ${c._count.addresses} adresses` : '—'}
          </Field>
        </dl>
      </div>
    </div>
  );
}
