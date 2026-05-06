import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getLevels, createLevel, updateLevel, deleteLevel } from '../../api/warehouse.api';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

const EMPTY = { code: '', name_fr: '', name_ar: '', sort_order: '', is_active: true };

function LevelModal({ level, onClose, onSaved }) {
  const [form, setForm] = useState(level ? { ...level, sort_order: String(level.sort_order ?? '') } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const isEdit = !!level;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom FR requis');
    setSaving(true);
    try {
      const payload = { ...form, sort_order: form.sort_order !== '' ? Number(form.sort_order) : undefined };
      if (isEdit) await updateLevel(level.id, payload);
      else await createLevel(payload);
      toast.success(isEdit ? 'Niveau mis à jour' : 'Niveau créé');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-body">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {isEdit ? 'Modifier le niveau' : 'Nouveau niveau'}
          </h2>
          <form id="level-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Code <span className="text-red-500">*</span></label>
                <input className="form-input" value={form.code} onChange={(e) => set('code', e.target.value.toLowerCase())} placeholder="top" />
              </div>
              <div>
                <label className="form-label">Ordre d'affichage</label>
                <input className="form-input" type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} placeholder="1" />
              </div>
            </div>
            <div>
              <label className="form-label">Nom (FR) <span className="text-red-500">*</span></label>
              <input className="form-input" value={form.name_fr} onChange={(e) => set('name_fr', e.target.value)} placeholder="Haut" />
            </div>
            <div>
              <label className="form-label">Nom (AR)</label>
              <input className="form-input" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} dir="rtl" placeholder="أعلى" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
              Actif
            </label>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Annuler</button>
          <button type="submit" form="level-form" className="btn-primary text-sm" disabled={saving}>
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LevelsPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null);

  const canManage = hasPermission('warehouse.manage');
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, ...(search.trim() ? { search: search.trim() } : {}) };
      const res = await getLevels(params);
      setRows(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer le niveau "${row.name_fr}" ?`)) return;
    try {
      await deleteLevel(row.id);
      toast.success('Niveau supprimé');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Niveaux de rayonnage</h1>
          <p className="page-subtitle">Haut, milieu, bas, etc.</p>
        </div>
        {canManage && (
          <button className="btn-primary text-sm" onClick={() => setModal({ level: null })}>
            <AddIcon /> Nouveau niveau
          </button>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <input
          type="search"
          className="form-input text-sm"
          placeholder="Rechercher…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-secondary text-sm">Filtrer</button>
        {search && (
          <button type="button" className="btn-secondary text-sm" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            Effacer
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-th">Ordre</th>
                  <th className="table-th">Code</th>
                  <th className="table-th">Nom FR</th>
                  <th className="table-th">Nom AR</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Aucun niveau</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td text-gray-400 text-sm">{row.sort_order ?? '—'}</td>
                    <td className="table-td font-mono text-xs font-semibold text-gray-700">{row.code}</td>
                    <td className="table-td text-gray-700">{row.name_fr}</td>
                    <td className="table-td text-gray-700 text-right" dir="rtl">{row.name_ar || '—'}</td>
                    <td className="table-td">
                      <span className={row.is_active ? 'badge-active' : 'badge-inactive'}>
                        {row.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5">
                        {canManage && <EditButton onClick={() => setModal({ level: row })} />}
                        {canManage && <DeleteButton onClick={() => handleDelete(row)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
              <span>Page {page} / {pages} ({total} éléments)</span>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs py-1 px-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
                <button className="btn-secondary text-xs py-1 px-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <LevelModal
          level={modal.level}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
