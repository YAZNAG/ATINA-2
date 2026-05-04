import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getP0Registry } from '../../api/p0.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function P0TablesHub() {
  const { hasPermission } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const canView = hasPermission('dashboard.view');
  const canOpenList = (row) => {
    if (!row.listPath) return false;
    if (!row.listPermission) return true;
    if (hasPermission(row.listPermission)) return true;
    const any = row.listPermissionAny;
    if (Array.isArray(any) && any.some((p) => hasPermission(p))) return true;
    return false;
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getP0Registry();
        if (!cancelled) setPayload(res.data?.data ?? null);
      } catch (e) {
        if (!cancelled) toast.error(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  if (!canView) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  const groups = payload?.groups ?? [];

  return (
    <div className="page-shell max-w-4xl">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Tableau de bord</Link>
          <h1 className="page-title mt-1">Référentiel données</h1>
          <p className="page-subtitle mt-1 max-w-3xl">Choisissez une table pour gérer ses enregistrements.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6 mt-6">
          {groups.map((g) => (
            <section key={g.id} className="card overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <h2 className="font-semibold text-gray-900">{g.titleFr}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{g.tables.length} table(s)</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {g.tables.map((row) => (
                  <li
                    key={`${g.id}-${row.sql}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/p0/tables/${encodeURIComponent(row.sql)}`}
                        className="group inline-flex flex-wrap items-baseline gap-x-2 gap-y-1"
                      >
                        <code className="text-sm bg-slate-100 text-slate-900 px-2 py-0.5 rounded group-hover:bg-blue-100 group-hover:text-blue-900">
                          {row.sql}
                        </code>
                        <span className="text-xs font-mono text-gray-500">{row.model}</span>
                        <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Ouvrir →
                        </span>
                      </Link>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{row.labelFr}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4 text-sm flex-wrap justify-end">
                      <Link
                        to={`/p0/tables/${encodeURIComponent(row.sql)}`}
                        className="inline-flex items-center rounded-md bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 shadow-sm hover:bg-blue-700 whitespace-nowrap"
                      >
                        Ouvrir
                      </Link>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-gray-400 block">Lignes</span>
                        {row.countError ? (
                          <span className="text-xs text-amber-600 font-mono" title={row.countError}>
                            —
                          </span>
                        ) : (
                          <span className="font-mono text-gray-900 tabular-nums">{row.rowCount ?? 0}</span>
                        )}
                      </div>
                      {row.listPath && canOpenList(row) ? (
                        <Link
                          to={row.listPath}
                          className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Liste
                        </Link>
                      ) : row.listPath ? (
                        <span className="text-xs text-gray-300" title={`Permission : ${row.listPermission || ''}`}>
                          —
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
