import { useCallback, useEffect, useMemo, useState } from 'react';
import { p0CrudCreate, p0CrudDelete, p0CrudList, p0CrudUpdate } from '../../api/p0.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80) + (JSON.stringify(v).length > 80 ? '…' : '');
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function inferColumns(rows) {
  const keys = new Set();
  rows.slice(0, 100).forEach((r) => {
    if (r && typeof r === 'object') Object.keys(r).forEach((k) => keys.add(k));
  });
  const rest = [...keys].filter((k) => k !== 'id').sort();
  const cols = ['id', ...rest];
  return cols.slice(0, 9);
}

export default function P0GenericCrud({ sql }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [jsonDraft, setJsonDraft] = useState('{}');
  const [saving, setSaving] = useState(false);

  const columns = useMemo(() => inferColumns(items), [items]);

  const reload = useCallback(async () => {
    if (!sql) return;
    setLoading(true);
    try {
      const res = await p0CrudList(sql, { page, limit: 25 });
      const body = res.data?.data;
      setItems(body?.items ?? []);
      setPagination(body?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (e) {
      toast.error(getErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sql, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openCreate = () => {
    setJsonDraft('{}');
    setModal({ mode: 'create' });
  };

  const openEdit = (row) => {
    const { id: _id, ...rest } = row;
    setJsonDraft(JSON.stringify(rest, null, 2));
    setModal({ mode: 'edit', id: row.id });
  };

  const closeModal = () => {
    setModal(null);
    setJsonDraft('{}');
  };

  const submitModal = async () => {
    let data;
    try {
      data = JSON.parse(jsonDraft || '{}');
    } catch {
      toast.error('JSON invalide.');
      return;
    }
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await p0CrudCreate(sql, data);
        toast.success('Ligne créée');
        closeModal();
        if (page !== 1) setPage(1);
        else await reload();
      } else {
        await p0CrudUpdate(sql, modal.id, data);
        toast.success('Ligne mise à jour');
        closeModal();
        await reload();
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Supprimer la ligne ${id} ?`)) return;
    try {
      await p0CrudDelete(sql, id);
      toast.success('Supprimé');
      await reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="card mt-8 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Données — CRUD</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Liste paginée ; création / édition via <strong>JSON</strong> (champs scalaires ou relations Prisma comme{' '}
            <code className="text-[10px] bg-gray-100 px-1 rounded">connect</code>). Les erreurs Prisma (FK, unique…)
            s’affichent en toast.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={openCreate}>
          + Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs sm:text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  {columns.map((c) => (
                    <th key={c} className="table-th whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="table-th w-32 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="table-td text-center text-gray-400 py-10">
                      Aucune ligne (ou table absente / erreur Prisma).
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/80">
                      {columns.map((c) => (
                        <td key={c} className="table-td align-top max-w-[14rem] truncate" title={formatCell(row[c])}>
                          {formatCell(row[c])}
                        </td>
                      ))}
                      <td className="table-td text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline font-medium"
                          onClick={() => openEdit(row)}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline font-medium"
                          onClick={() => handleDelete(row.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
              <span>
                Page {pagination.page} / {pagination.totalPages} — {pagination.total} ligne(s)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary py-1 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Précédent
                </button>
                <button
                  type="button"
                  className="btn-secondary py-1 px-2 text-xs"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-3">{pagination.total} ligne(s) au total.</p>
          )}
        </>
      )}

      {modal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">
                {modal.mode === 'create' ? 'Nouvelle ligne' : `Modifier ${modal.id}`}
              </h3>
              <button type="button" className="text-gray-400 hover:text-gray-700 text-xl leading-none" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1">Corps JSON (Prisma create / update)</label>
              <textarea
                className="w-full min-h-[240px] font-mono text-xs border border-gray-200 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={closeModal}>
                Annuler
              </button>
              <button type="button" className="btn-primary text-sm" disabled={saving} onClick={submitModal}>
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
