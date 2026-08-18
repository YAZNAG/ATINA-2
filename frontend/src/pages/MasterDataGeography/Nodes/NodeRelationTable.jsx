import { Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function NodeRelationTable({ fetchFn, columns, emptyLabel, viewAllHref, viewAllLabel }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await fetchFn();
    const list = Array.isArray(result) ? result : (result?.data || []);
    setRows(list);
  } catch (err) {
    setError(err?.response?.data?.message || 'Erreur lors du chargement');
  } finally {
    setLoading(false);
  }
}, [fetchFn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      {viewAllHref && (
        <div className="mb-3 flex justify-end">
          <Link to={viewAllHref} className="text-xs font-medium text-[#E10600] hover:underline">
            {viewAllLabel || 'Voir tout →'}
          </Link>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={columns.length} className="py-10 text-center"><Loader2 size={18} className="mx-auto animate-spin text-neutral-400" /></td></tr>
            ) : error ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-sm text-[#E10600]">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-sm text-neutral-400">{emptyLabel}</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-neutral-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-sm text-neutral-700">
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}