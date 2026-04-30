import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function ArticleList() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await catalog.getArticles({
          page,
          limit: 20,
          ...(searchFilter.trim() ? { search: searchFilter.trim() } : {}),
        });
        if (cancelled) return;
        const body = res.data;
        setRows(body.data ?? []);
        setPagination(body.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 });
      } catch (err) {
        if (!cancelled) {
          toast.error(getErrorMessage(err));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, searchFilter, refreshKey]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchFilter(searchInput);
    setPage(1);
  };

  if (!hasPermission('articles.view')) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link to="/catalog" className="text-sm text-gray-500 hover:text-gray-700">← Catalogue</Link>
          <h1 className="text-lg font-semibold text-gray-800 mt-1">Articles</h1>
          <p className="text-sm text-gray-500">SKU, taxonomie et référentiels — tout paramétré via listes API.</p>
        </div>
        {hasPermission('articles.create') && (
          <Link to="/catalog/articles/new" className="btn-primary text-sm text-center">
            + Nouvel article
          </Link>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <input
          type="search"
          className="form-input text-sm flex-1"
          placeholder="SKU, nom, code-barres…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-secondary text-sm">Rechercher</button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">SKU</th>
                  <th className="table-th">Nom (FR)</th>
                  <th className="table-th">Famille</th>
                  <th className="table-th">Catégorie</th>
                  <th className="table-th">Marque</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Créé</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">Aucun article</td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="table-td font-mono text-xs">{a.sku}</td>
                      <td className="table-td font-medium text-gray-900">{a.name_fr}</td>
                      <td className="table-td text-gray-600">{a.family?.name_fr ?? '—'}</td>
                      <td className="table-td text-gray-600">{a.category?.name_fr ?? '—'}</td>
                      <td className="table-td text-gray-600">{a.brand?.name_fr ?? '—'}</td>
                      <td className="table-td">
                        <span className={a.is_active ? 'badge-active' : 'badge-inactive'}>
                          {a.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="table-td text-gray-500">{formatDate(a.created_at)}</td>
                      <td className="table-td">
                        <div className="flex gap-2">
                          {hasPermission('articles.update') && (
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-700 font-medium"
                              onClick={() => navigate(`/catalog/articles/${a.id}/edit`)}
                            >
                              Modifier
                            </button>
                          )}
                          {hasPermission('articles.delete') && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-600 font-medium"
                              onClick={async () => {
                                if (!window.confirm(`Supprimer l’article ${a.sku} ?`)) return;
                                try {
                                  await catalog.deleteArticle(a.id);
                                  toast.success('Article supprimé');
                                  setRefreshKey((k) => k + 1);
                                } catch (err) {
                                  toast.error(getErrorMessage(err));
                                }
                              }}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t flex justify-between text-sm text-gray-600">
              <span>Page {pagination.page} / {pagination.pages}</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs py-1 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Préc.</button>
                <button type="button" className="btn-secondary text-xs py-1 px-2" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suiv.</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
