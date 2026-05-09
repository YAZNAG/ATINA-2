import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { getP0TableBySql } from '../../api/p0.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import P0GenericCrud from '../p0/P0GenericCrud';
import { slugToSql, isAllowedDeliverySlug, DELIVERY_PARAM_ITEMS } from './deliveryParamConfig';

export default function DeliveryLookupPage() {
  const { slug } = useParams();
  const { hasPermission } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = ['dashboard.view', 'stock.view', 'stock.manage'].some((p) => hasPermission(p));
  const sql = slug && isAllowedDeliverySlug(slug) ? slugToSql(slug) : null;
  const navLabel = DELIVERY_PARAM_ITEMS.find((x) => x.slug === slug)?.label ?? row?.labelFr ?? 'Réglage';

  useEffect(() => {
    if (!canView || !sql) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getP0TableBySql(sql);
        if (!cancelled) setRow(res.data?.data?.table ?? null);
      } catch (e) {
        if (!cancelled) toast.error(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, sql]);

  if (!slug || !isAllowedDeliverySlug(slug)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!canView) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600 text-sm">Accès refusé.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-10">
        <p className="text-gray-600 text-sm">Table introuvable ou hors registre.</p>
        <Link to="/delivery/order-statuses" className="text-sm text-red-600 font-medium mt-4 inline-block">
          ← Retour paramétrage livraison
        </Link>
      </div>
    );
  }

  if (row.genericCrud === false) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-10 max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900">{row.labelFr}</h1>
        <p className="text-sm text-gray-500 mt-2">Cette table n’est pas éditable via cet écran.</p>
        <Link to="/delivery/order-statuses" className="text-sm text-red-600 font-medium mt-6 inline-block">
          ← Paramétrage livraison
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <nav className="text-xs text-gray-400 mb-2 flex flex-wrap items-center gap-1.5">
            <Link to="/dashboard" className="hover:text-gray-600">Accueil</Link>
            <span className="text-gray-300">/</span>
            <span className="text-red-600 font-semibold">Paramétrage livraison</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-600">{navLabel}</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">{row.labelFr}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Référentiel livraison & commandes — même principe que le paramétrage stock.
          </p>
          <p className="text-xs text-slate-400 mt-2 font-mono">{row.sql}</p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto">
        <P0GenericCrud sql={sql} embedded />
      </div>
    </div>
  );
}
