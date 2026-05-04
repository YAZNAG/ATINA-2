import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getP0TableBySql } from '../../api/p0.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import P0GenericCrud from './P0GenericCrud';

export default function P0TablePage() {
  const { sql: sqlParam } = useParams();
  const { hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = hasPermission('dashboard.view');
  const canOpenList = (row) => {
    if (!row?.listPath) return false;
    if (!row.listPermission) return true;
    if (hasPermission(row.listPermission)) return true;
    const any = row.listPermissionAny;
    if (Array.isArray(any) && any.some((p) => hasPermission(p))) return true;
    return false;
  };

  useEffect(() => {
    if (!canView || !sqlParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getP0TableBySql(sqlParam);
        if (!cancelled) setData(res.data?.data ?? null);
      } catch (e) {
        if (!cancelled) toast.error(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, sqlParam]);

  if (!canView) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  const row = data?.table;

  if (loading) {
    return (
      <div className="page-shell max-w-6xl">
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="page-shell max-w-6xl">
        <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">
          ← Référentiel données
        </Link>
        <p className="text-gray-600 text-sm mt-4">Table introuvable ou hors registre.</p>
      </div>
    );
  }

  if (row.genericCrud === false) {
    return (
      <div className="page-shell max-w-3xl">
        <div className="page-header">
          <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">
            ← Référentiel données
          </Link>
          <h1 className="page-title mt-2">{row.labelFr}</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{row.sql}</p>
        </div>
        <div className="card mt-6 p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Cette table est gérée depuis un écran métier dédié (pas le formulaire générique).
          </p>
          <div className="flex flex-wrap gap-3">
            {row.listPath && canOpenList(row) ? (
              <Link to={row.listPath} className="btn-primary text-sm inline-flex items-center">
                Ouvrir l’écran dédié
              </Link>
            ) : null}
            <Link to="/p0/tables" className="btn-secondary text-sm inline-flex items-center">
              Retour
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header">
        <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">
          ← Référentiel données
        </Link>
        <h1 className="page-title mt-2">{row.labelFr}</h1>
        <p className="text-sm text-slate-500 mt-1">
          <span className="font-mono">{row.sql}</span>
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-mono text-xs">{row.model}</span>
        </p>
      </div>
      {sqlParam ? <P0GenericCrud sql={sqlParam} embedded /> : null}
    </div>
  );
}
