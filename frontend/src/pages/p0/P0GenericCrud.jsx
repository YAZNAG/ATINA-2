import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getP0CrudMeta,
  getP0RefOptions,
  p0CrudCreate,
  p0CrudDelete,
  p0CrudList,
  p0CrudUpdate,
} from '../../api/p0.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

function formatCell(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80) + (JSON.stringify(v).length > 80 ? '…' : '');
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function inferColumns(rows, metaFields, primaryKey) {
  const keys = new Set();
  (metaFields || []).forEach((f) => {
    if (f?.name) keys.add(f.name);
  });
  rows.slice(0, 100).forEach((r) => {
    if (r && typeof r === 'object') Object.keys(r).forEach((k) => keys.add(k));
  });
  const all = [...keys].sort();
  const pk = primaryKey || 'id';
  if (all.includes(pk)) return [pk, ...all.filter((k) => k !== pk)];
  return all;
}

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildPayload(fields, formValues, mode) {
  const payload = {};
  for (const f of fields) {
    if (f.readonly) continue;
    if (mode === 'create' && f.hideOnCreate) continue;
    if (mode === 'edit' && f.isPrimaryKey) continue;
    let v = formValues[f.name];
    if (f.kind === 'boolean') {
      payload[f.name] = v === true || v === 'true';
      continue;
    }
    if (f.kind === 'number') {
      if (v === '' || v === undefined) {
        if (f.nullable) payload[f.name] = null;
        continue;
      }
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`Nombre invalide : ${f.name}`);
      payload[f.name] = n;
      continue;
    }
    if (f.kind === 'datetime') {
      payload[f.name] = v ? fromDatetimeLocal(v) : f.nullable ? null : undefined;
      if (payload[f.name] === undefined) delete payload[f.name];
      continue;
    }
    if (f.kind === 'json') {
      if (!v || !String(v).trim()) {
        if (f.nullable) payload[f.name] = null;
        continue;
      }
      try {
        payload[f.name] = JSON.parse(v);
      } catch {
        throw new Error(`JSON invalide pour ${f.name}`);
      }
      continue;
    }
    if (v === '' || v === undefined || v === null) {
      if (f.nullable) payload[f.name] = null;
      continue;
    }
    payload[f.name] = v;
  }
  return payload;
}

function primaryKeyNameFromApi(pk) {
  if (pk && typeof pk === 'object' && pk.name) return pk.name;
  if (typeof pk === 'string') return pk;
  return 'id';
}

export default function P0GenericCrud({ sql, embedded = false }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [jsonDraft, setJsonDraft] = useState('{}');
  const [jsonMode, setJsonMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metaFields, setMetaFields] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [formValues, setFormValues] = useState({});
  const [refCache, setRefCache] = useState({});
  const [primaryKey, setPrimaryKey] = useState('id');

  const columns = useMemo(() => inferColumns(items, metaFields, primaryKey), [items, metaFields, primaryKey]);

  const reload = useCallback(async () => {
    if (!sql) return;
    setLoading(true);
    try {
      const res = await p0CrudList(sql, { page, limit: 25 });
      const body = res.data?.data;
      setItems(body?.items ?? []);
      setPrimaryKey(primaryKeyNameFromApi(body?.primaryKey));
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

  useEffect(() => {
    let cancelled = false;
    if (!sql) return () => {};
    (async () => {
      setMetaLoading(true);
      try {
        const res = await getP0CrudMeta(sql);
        const fields = res.data?.data?.fields ?? [];
        if (!cancelled) setMetaFields(fields);
        if (!cancelled) setPrimaryKey(primaryKeyNameFromApi(res.data?.data?.primaryKey));
      } catch (e) {
        if (!cancelled) {
          toast.error(getErrorMessage(e));
          setMetaFields([]);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sql]);

  useEffect(() => {
    setRefCache({});
  }, [sql]);

  const loadRefsForFields = async (fields) => {
    const fks = fields.filter((f) => f.kind === 'fk' && f.refSql);
    const updates = {};
    await Promise.all(
      fks.map(async (f) => {
        try {
          const res = await getP0RefOptions(f.refSql);
          updates[f.refSql] = res.data?.data?.options ?? [];
        } catch {
          updates[f.refSql] = [];
        }
      })
    );
    setRefCache((prev) => ({ ...prev, ...updates }));
  };

  const initForm = (mode, row) => {
    const v = {};
    for (const f of metaFields) {
      if (f.readonly) continue;
      if (mode === 'create' && f.hideOnCreate) continue;
      if (mode === 'edit' && row && Object.prototype.hasOwnProperty.call(row, f.name)) {
        const val = row[f.name];
        if (f.kind === 'boolean') v[f.name] = Boolean(val);
        else if (f.kind === 'number') v[f.name] = val === null || val === undefined ? '' : String(val);
        else if (f.kind === 'datetime') v[f.name] = toDatetimeLocal(val);
        else if (f.kind === 'json') v[f.name] = val == null ? '{}' : JSON.stringify(val, null, 2);
        else v[f.name] = val === null || val === undefined ? '' : String(val);
      } else {
        if (f.kind === 'boolean') v[f.name] = false;
        else if (f.kind === 'json') v[f.name] = '{}';
        else v[f.name] = '';
      }
    }
    setFormValues(v);
  };

  const openCreate = async () => {
    setJsonDraft('{}');
    setJsonMode(false);
    setModal({ mode: 'create' });
    await loadRefsForFields(metaFields);
    initForm('create', null);
  };

  const openEdit = async (row) => {
    const copy = { ...row };
    delete copy[primaryKey];
    setJsonDraft(JSON.stringify(copy, null, 2));
    setJsonMode(false);
    setModal({ mode: 'edit', id: row[primaryKey] });
    await loadRefsForFields(metaFields);
    initForm('edit', row);
  };

  const closeModal = () => {
    setModal(null);
    setJsonDraft('{}');
    setJsonMode(false);
  };

  const submitModal = async () => {
    setSaving(true);
    try {
      let data;
      if (jsonMode) {
        try {
          data = JSON.parse(jsonDraft || '{}');
        } catch {
          toast.error('JSON invalide.');
          setSaving(false);
          return;
        }
      } else {
        data = buildPayload(metaFields, formValues, modal.mode);
      }

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
      const msg = e.message && e.message.startsWith('JSON') ? e.message : getErrorMessage(e);
      toast.error(msg);
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

  const formFieldList = useMemo(
    () => metaFields.filter((f) => !f.readonly && !(modal?.mode === 'create' && f.hideOnCreate)),
    [metaFields, modal]
  );

  return (
    <div
      id="p0-crud-section"
      className={`card p-4 sm:p-6 scroll-mt-24 ${embedded ? 'mt-4' : 'mt-8 shadow-sm'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Données</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">Formulaire guidé ou mode JSON pour les cas avancés.</p>
          {metaLoading ? (
            <p className="text-xs text-amber-700 mt-2">Chargement du schéma des champs…</p>
          ) : null}
        </div>
        <button type="button" className="btn-primary text-sm" onClick={openCreate} disabled={metaLoading}>
          Ajouter
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
                  items.map((row, idx) => (
                    <tr key={String(row[primaryKey] ?? idx)} className="hover:bg-gray-50/80">
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
                          onClick={() => handleDelete(row[primaryKey])}
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
        <Modal
          open
          onClose={closeModal}
          title={modal.mode === 'create' ? 'Nouvelle ligne' : 'Modifier la ligne'}
          subtitle={modal.mode === 'edit' ? String(modal.id) : undefined}
          size="md"
          headerRight={
            <>
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={jsonMode}
                  onChange={(e) => setJsonMode(e.target.checked)}
                />
                JSON
              </label>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Fermer"
                onClick={closeModal}
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </>
          }
          footer={
            <>
              <button type="button" className="btn-secondary text-sm min-w-[6.5rem]" onClick={closeModal}>
                Annuler
              </button>
              <button type="button" className="btn-primary text-sm min-w-[6.5rem]" disabled={saving} onClick={submitModal}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {jsonMode ? (
            <div className="space-y-2">
              <label className="form-label text-slate-600">Corps JSON</label>
              <textarea
                className="form-textarea min-h-[240px] font-mono text-xs bg-slate-50/80"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {formFieldList.map((f) => {
                const pkLocked = modal.mode === 'edit' && f.isPrimaryKey;
                return (
                  <div key={f.name} className="space-y-1.5">
                    <label className="form-label text-slate-700">
                      <span className="font-mono text-xs tracking-wide text-slate-800">{f.name}</span>
                      {pkLocked ? (
                        <span className="text-slate-400 font-normal"> — clé primaire</span>
                      ) : f.nullable ? (
                        <span className="text-slate-400 font-normal"> — optionnel</span>
                      ) : (
                        <span className="text-rose-600 font-normal"> *</span>
                      )}
                      {f.refModel ? (
                        <span className="text-slate-400 font-normal text-xs"> → {f.refModel}</span>
                      ) : null}
                    </label>
                    {f.kind === 'boolean' ? (
                      <label
                        className={`inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 transition-colors ${
                          pkLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          disabled={pkLocked}
                          checked={Boolean(formValues[f.name])}
                          onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.checked }))}
                        />
                        <span className="text-sm text-slate-700">Activé</span>
                      </label>
                    ) : f.kind === 'fk' && f.refSql ? (
                      <select
                        className="form-select"
                        disabled={pkLocked}
                        value={formValues[f.name] ?? ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      >
                        <option value="">Choisir…</option>
                        {(refCache[f.refSql] || []).map((o) => (
                          <option key={String(o.id)} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.kind === 'fk' && !f.refSql ? (
                      <input
                        className="form-input font-mono text-xs"
                        disabled={pkLocked}
                        placeholder="Identifiant (référence hors liste)"
                        value={formValues[f.name] ?? ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    ) : f.kind === 'number' ? (
                      <input
                        type="number"
                        step="any"
                        className="form-input tabular-nums"
                        disabled={pkLocked}
                        value={formValues[f.name] ?? ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    ) : f.kind === 'datetime' ? (
                      <input
                        type="datetime-local"
                        className="form-input"
                        disabled={pkLocked}
                        value={formValues[f.name] ?? ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    ) : f.kind === 'json' ? (
                      <textarea
                        className="form-textarea min-h-[100px] font-mono text-xs"
                        disabled={pkLocked}
                        value={formValues[f.name] ?? '{}'}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                        spellCheck={false}
                      />
                    ) : (
                      <input
                        className={`form-input ${f.name === 'code' || f.name.endsWith('_id') ? 'font-mono text-xs' : ''}`}
                        disabled={pkLocked}
                        value={formValues[f.name] ?? ''}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
