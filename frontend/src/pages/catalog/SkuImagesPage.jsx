import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

function trunc(v, n = 48) {
  if (v == null || String(v).trim() === '') return '—';
  const s = String(v);
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

export default function SkuImagesPage() {
  const navigate = useNavigate();
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
    setLoading(true);
    try {
      const params = { page, limit: 15, ...(searchQ.trim() ? { search: searchQ.trim() } : {}) };
      const res = await catalog.getSkuImages(params);
      const body = res.data;
      setRows(body.data ?? []);
      setPagination(body.pagination ?? { total: 0, page: 1, limit: 15, pages: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <h1 className="page-title mt-1">Images SKU</h1>
          <p className="page-subtitle">Données sku_images : URL, alts, image principale, ordre.</p>
        </div>
        {hasPermission('sku_images.create') && (
          <Link to="/catalog/sku-images/new" className="btn-primary text-sm text-center">
            <AddIcon />
            Nouvelle image
          </Link>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <input
          type="search"
          className="form-input text-sm"
          placeholder="Rechercher (URL, alt…)…"
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
                  <th className="table-th">Aperçu</th>
                  <th className="table-th">SKU id</th>
                  <th className="table-th">URL</th>
                  <th className="table-th">Alt FR</th>
                  <th className="table-th">Alt AR</th>
                  <th className="table-th">Principal</th>
                  <th className="table-th">Ordre</th>
                  <th className="table-th">Créé le</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                      Aucune image SKU
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-td">
                        {row.url ? (
                          <img
                            src={row.url}
                            alt=""
                            className="h-10 w-10 object-contain rounded border border-gray-100 bg-white"
                            loading="lazy"
                          />
                        ) : '—'}
                      </td>
                      <td className="table-td font-mono text-xs">{trunc(row.sku_id, 12)}</td>
                      <td className="table-td text-sm text-gray-600 max-w-[12rem]" title={row.url}>{trunc(row.url, 40)}</td>
                      <td className="table-td text-sm">{trunc(row.alt_fr, 24)}</td>
                      <td className="table-td text-sm" dir="rtl">{trunc(row.alt_ar, 24)}</td>
                      <td className="table-td">
                        <span className={row.is_primary ? 'badge-active' : 'badge-inactive'}>
                          {row.is_primary ? 'Oui' : 'Non'}
                        </span>
                      </td>
                      <td className="table-td">{row.sort_order}</td>
                      <td className="table-td text-sm text-gray-500">
                        {row.created_at ? new Date(row.created_at).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {hasPermission('sku_images.update') && (
                            <EditButton onClick={() => navigate(`/catalog/sku-images/${row.id}/edit`)} />
                          )}
                          {hasPermission('sku_images.delete') && (
                            <DeleteButton
                              onClick={async () => {
                                if (!window.confirm('Supprimer cette image ?')) return;
                                try {
                                  await catalog.deleteSkuImage(row.id);
                                  toast.success('Supprimée');
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
                Page {pagination.page} / {pagination.pages} ({pagination.total} lignes)
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
