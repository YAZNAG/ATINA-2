import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getP0Relations } from '../../api/p0.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function P0RelationsPage() {
  const { hasPermission } = useAuth();
  const [edges, setEdges] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  const canView = hasPermission('dashboard.view');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getP0Relations();
        const d = res.data?.data;
        if (!cancelled) {
          setEdges(d?.edges ?? []);
          setNote(d?.note ?? '');
        }
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

  return (
    <div className="page-shell max-w-5xl">
      <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">← Index tables P0</Link>
      <h1 className="page-title mt-2">Relations entre tables P0</h1>
      <p className="page-subtitle mt-1 max-w-3xl">
        Vue synthétique des clés étrangères documentées (commandes, paiements, stock, offres…). Clique sur une table
        pour ouvrir sa fiche avec CRUD.
      </p>
      {note ? (
        <p className="text-xs text-gray-500 mt-2 bg-gray-50 border border-gray-100 rounded-md px-3 py-2 max-w-3xl">
          {note}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="table-th">Table source</th>
                  <th className="table-th">Colonne FK</th>
                  <th className="table-th">Table cible</th>
                  <th className="table-th">Libellé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {edges.map((e, idx) => (
                  <tr key={`${e.fromSql}-${e.field}-${idx}`} className="hover:bg-gray-50/80">
                    <td className="table-td">
                      <Link
                        to={`/p0/tables/${encodeURIComponent(e.fromSql)}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {e.fromSql}
                      </Link>
                    </td>
                    <td className="table-td">
                      <code className="text-xs bg-slate-100 px-1 rounded">{e.field}</code>
                    </td>
                    <td className="table-td">
                      {e.toSql ? (
                        <Link
                          to={`/p0/tables/${encodeURIComponent(e.toSql)}`}
                          className="font-mono text-xs text-blue-600 hover:underline"
                        >
                          {e.toSql}
                        </Link>
                      ) : (
                        <span className="text-xs text-amber-800">hors registre P0</span>
                      )}
                    </td>
                    <td className="table-td text-gray-700 text-xs">{e.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 px-4 py-3 border-t border-gray-100">
            {edges.length} relation(s) listée(s).
          </p>
        </div>
      )}
    </div>
  );
}
