import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomers } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function CustomerList() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const canView = hasPermission('customers.view') || hasPermission('dashboard.view');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getCustomers({
          page,
          limit: 25,
          q: q.trim() || undefined,
          includeDeleted: includeDeleted ? '1' : undefined,
        });
        const body = res.data?.data;
        if (!cancelled) {
          setItems(body?.items ?? []);
          setPagination(body?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
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
  }, [canView, page, q, includeDeleted]);

  if (!canView) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  return (
    <div className="page-shell max-w-7xl">
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link to="/p0/tables" className="text-sm text-gray-500 hover:text-gray-700">← Tables P0</Link>
          <h1 className="page-title mt-1">
            Clients (app) <span className="text-slate-400 font-normal">({pagination.total})</span>
          </h1>
          <p className="page-subtitle mt-1 max-w-2xl">
            Table <code className="text-xs bg-gray-100 px-1 rounded">customers</code> — comptes mobile, wallet MAD,
            points, parrainage.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Recherche nom, téléphone, code parrain…"
          className="input-base max-w-md flex-1 min-w-[200px]"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
          />
          Inclure supprimés
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-th">Nom</th>
                    <th className="table-th">Téléphone</th>
                    <th className="table-th">Langue</th>
                    <th className="table-th">Parrainage</th>
                    <th className="table-th text-right">Wallet (MAD)</th>
                    <th className="table-th text-right">Points</th>
                    <th className="table-th">Ville</th>
                    <th className="table-th">Statut</th>
                    <th className="table-th">Créé</th>
                    <th className="table-th w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-gray-400">
                        Aucun client
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/80">
                        <td className="table-td font-medium text-gray-900">{c.name}</td>
                        <td className="table-td text-gray-600 whitespace-nowrap">
                          {c.phone_country} {c.phone_number}
                          {c.phone_verified_at ? (
                            <span className="ml-1 text-emerald-600" title="Téléphone vérifié">✓</span>
                          ) : null}
                        </td>
                        <td className="table-td uppercase text-xs text-gray-500">{c.preferred_lang}</td>
                        <td className="table-td">
                          <code className="text-xs bg-slate-100 px-1 rounded">{c.referral_code}</code>
                        </td>
                        <td className="table-td text-right font-mono text-gray-800">{String(c.wallet_balance)}</td>
                        <td className="table-td text-right font-mono text-gray-800">{c.points_balance}</td>
                        <td className="table-td text-gray-600">{c.city || '—'}</td>
                        <td className="table-td">
                          {!c.is_active ? (
                            <span className="badge-inactive">Bloqué</span>
                          ) : c.is_deleted ? (
                            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Supprimé</span>
                          ) : (
                            <span className="badge-active">Actif</span>
                          )}
                        </td>
                        <td className="table-td text-gray-500 whitespace-nowrap">{formatDate(c.created_at)}</td>
                        <td className="table-td">
                          <Link to={`/customers/${c.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                            Détail
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Page {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
