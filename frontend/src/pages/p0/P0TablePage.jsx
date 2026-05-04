import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getP0RelationsForTable, getP0TableBySql } from '../../api/p0.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import P0GenericCrud from './P0GenericCrud';

export default function P0TablePage() {
  const { sql: sqlParam } = useParams();
  const { hasPermission } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relEdges, setRelEdges] = useState([]);

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

  useEffect(() => {
    if (!canView || !sqlParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getP0RelationsForTable(sqlParam);
        if (!cancelled) setRelEdges(res.data?.data?.edges ?? []);
      } catch {
        if (!cancelled) setRelEdges([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, sqlParam]);

  if (!canView) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  const group = data?.group;
  const row = data?.table;

  return (
    <div className={`page-shell ${row?.genericCrud !== false ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div className="page-header">
        <div>
          <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">
            ← Index tables P0
          </Link>
          <h1 className="page-title mt-2">
            {row ? (
              <>
                Table <code className="text-base bg-slate-100 text-slate-800 px-2 py-0.5 rounded">{row.sql}</code>
              </>
            ) : (
              'Table P0'
            )}
          </h1>
          {group && (
            <p className="text-sm text-gray-500 mt-1">
              Groupe : <span className="text-gray-700">{group.titleFr}</span>
            </p>
          )}
          {row && row.genericCrud !== false ? (
            <a
              href="#p0-crud-section"
              className="inline-flex mt-3 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-100"
            >
              Aller au CRUD (lignes, formulaire) ↓
            </a>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : !row ? (
        <p className="text-gray-600 text-sm mt-4">Table introuvable ou hors registre P0.</p>
      ) : (
        <div className="card mt-6 p-6 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Modèle Prisma</dt>
              <dd className="mt-1 font-mono text-gray-900">{row.model}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Table SQL</dt>
              <dd className="mt-1">
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{row.sql}</code>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Lignes (count)</dt>
              <dd className="mt-1 font-mono text-gray-900">
                {row.countError ? (
                  <span className="text-amber-600 text-xs" title={row.countError}>
                    —
                  </span>
                ) : (
                  row.rowCount ?? 0
                )}
              </dd>
            </div>
          </dl>
          <div>
            <h2 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h2>
            <p className="text-gray-800 text-sm leading-relaxed">{row.labelFr}</p>
          </div>
          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3">
            {row.listPath && canOpenList(row) ? (
              <Link to={row.listPath} className="btn-primary text-sm inline-flex items-center">
                Ouvrir la liste back-office
              </Link>
            ) : null}
            <Link to="/p0/tables" className="btn-secondary text-sm inline-flex items-center">
              Retour à l’index
            </Link>
          </div>
          {row.countError && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Compteur indisponible : {row.countError}. Vérifie que la table existe (
              <code className="text-[10px]">npx prisma db push</code>).
            </p>
          )}
          {row.genericCrud === false && (
            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              CRUD générique désactivé pour cette table. Utilise l’écran métier dédié si disponible.
            </p>
          )}
        </div>
      )}

      {row && relEdges.length > 0 ? (
        <div className="card mt-6 p-5 border-l-4 border-l-indigo-500">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Relations (FK documentées)</h2>
          <p className="text-xs text-gray-500 mb-3">
            Liens logiques entre cette table et le reste du modèle P0. Les tables hors registre (nodes, skus…) sont
            indiquées sans lien.
          </p>
          <ul className="space-y-2 text-sm">
            {relEdges.map((e, idx) => (
              <li key={`${e.fromSql}-${e.field}-${idx}`} className="flex flex-wrap items-baseline gap-x-2 text-gray-700">
                <span className="font-mono text-xs text-gray-500">{e.fromSql}</span>
                <code className="text-xs bg-gray-100 px-1 rounded">.{e.field}</code>
                <span className="text-gray-400">→</span>
                {e.toSql ? (
                  <Link to={`/p0/tables/${encodeURIComponent(e.toSql)}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {e.toSql}
                  </Link>
                ) : (
                  <span className="text-amber-800 text-xs">hors registre P0 / catalogue</span>
                )}
                <span className="text-gray-500 text-xs">— {e.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row && row.genericCrud !== false && sqlParam ? <P0GenericCrud sql={sqlParam} /> : null}
    </div>
  );
}
