import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton } from '../../components/ui/CrudActions';

export default function SkusPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await catalog.getSkus({ page: 1, limit: 100 });
      const body = res.data;
      setRows(body.data ?? []);
      setPagination(body.pagination ?? { total: 0, page: 1, limit: 50, pages: 0 });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createSku = async () => {
    try {
      await catalog.createSku();
      toast.success('SKU créé');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link to="/catalog" className="text-sm text-gray-500 hover:text-gray-700">← Catalogue</Link>
          <h1 className="page-title mt-1">SKU</h1>
          <p className="page-subtitle">Identifiants UUID (`skus`). Créez un SKU puis ajoutez des images.</p>
        </div>
        {hasPermission('skus.create') && (
          <button type="button" onClick={createSku} className="btn-primary text-sm text-center">
            <AddIcon />
            Nouveau SKU
          </button>
        )}
      </div>

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
                  <th className="table-th">ID</th>
                  <th className="table-th">Créé le</th>
                  <th className="table-th">Nb images</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400 text-sm">Aucun SKU</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-td font-mono text-xs">{r.id}</td>
                      <td className="table-td text-sm">
                        {r.created_at ? new Date(r.created_at).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="table-td">{r._count?.images ?? '—'}</td>
                      <td className="table-td">
                        {hasPermission('skus.delete') && (
                          <DeleteButton
                            onClick={async () => {
                              if (!window.confirm('Supprimer ce SKU et toutes ses images ?')) return;
                              try {
                                await catalog.deleteSku(r.id);
                                toast.success('SKU supprimé');
                                load();
                              } catch (err) {
                                toast.error(getErrorMessage(err));
                              }
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {pagination.total > 0 && (
            <p className="text-xs text-gray-500 px-4 py-2">{pagination.total} SKU</p>
          )}
        </div>
      )}
    </div>
  );
}
