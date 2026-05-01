import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getEntityConfig } from './entityRegistry';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

export default function ReferentialListPage() {
  const { entitySlug } = useParams();
  const navigate = useNavigate();
  const cfg = getEntityConfig(entitySlug);
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQ = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchQ);

  useEffect(() => {
    setSearchInput(searchQ);
  }, [searchQ]);

  const fetchData = useCallback(async () => {
    if (!cfg) return;
    setLoading(true);
    try {
      const params = { page, limit: 15, ...(searchQ.trim() ? { search: searchQ.trim() } : {}) };
      const res = await cfg.api.list(params);
      const body = res.data;
      setRows(body.data ?? []);
      setPagination(body.pagination ?? { total: 0, page: 1, limit: 15, pages: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg, page, searchQ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!cfg) {
    return (
      <div className="text-center py-12 text-gray-500">
        Référentiel inconnu. <Link to="/catalog" className="text-blue-600">Retour</Link>
      </div>
    );
  }

  if (!hasPermission(cfg.permissions.view)) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  const tableCell = (col, row) => {
    if (col.render) return col.render(row);
    const v = row[col.key];
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (searchInput.trim()) next.set('search', searchInput.trim());
    next.set('page', '1');
    setSearchParams(next);
  };

  const goPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link to="/catalog" className="text-sm text-gray-500 hover:text-gray-700">← Catalogue</Link>
          <h1 className="page-title mt-1">{cfg.label}</h1>
          <p className="page-subtitle">{cfg.description}</p>
        </div>
        {hasPermission(cfg.permissions.create) && (
          <Link to={`/catalog/ref/${entitySlug}/new`} className="btn-primary text-sm text-center">
            <AddIcon />
            Nouveau
          </Link>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <input
          type="search"
          className="form-input text-sm"
          placeholder="Rechercher…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-secondary text-sm">Filtrer</button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {cfg.columns.map((col) => (
                    <th key={col.key} className="table-th">{col.label}</th>
                  ))}
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={cfg.columns.length + 1} className="text-center py-12 text-gray-400 text-sm">
                      Aucun enregistrement
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {cfg.columns.map((col) => (
                        <td key={col.key} className="table-td text-gray-700">{tableCell(col, row)}</td>
                      ))}
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {hasPermission(cfg.permissions.update) && (
                            <EditButton
                              onClick={() => navigate(`/catalog/ref/${entitySlug}/${row.id}/edit`)}
                            />
                          )}
                          {hasPermission(cfg.permissions.delete) && (
                            <DeleteButton onClick={async () => {
                              if (!window.confirm('Supprimer cet enregistrement ?')) return;
                              try {
                                await cfg.api.remove(row.id);
                                toast.success('Supprimé');
                                fetchData();
                              } catch (err) {
                                toast.error(getErrorMessage(err));
                              }
                            }}
                            />
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
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {pagination.page} / {pagination.pages} ({pagination.total} éléments)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1 px-2"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1 px-2"
                  disabled={page >= pagination.pages}
                  onClick={() => goPage(page + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
