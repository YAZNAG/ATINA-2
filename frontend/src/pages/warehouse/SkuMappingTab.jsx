import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, Star, Trash2, Loader2, Download, Info, X } from 'lucide-react';
import {
  getSkuLocations, createSkuLocation, updateSkuLocation, deleteSkuLocation,
} from '../../api/warehouse.api';
import { getSkus } from '../../api/catalog.api';
import { getErrorMessage } from '../../utils/helpers';

const PAGE_LIMIT = 25;

const exportCsv = (filename, headers, rows) => {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = String.fromCharCode(0xfeff) + [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ── Modale « Mapper SKU » ─────────────────────────────────────────────────── */

function MapSkuModal({ node, locations, onClose, onSaved }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sku, setSku] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sku) return undefined;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await getSkus({ search: search.trim() || undefined, status: 'active', limit: 20 });
        setResults(data.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search, sku]);

  const activeLocations = locations.filter((l) => l.is_active);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sku) return toast.error('Sélectionnez un SKU');
    if (!locationId) return toast.error('Sélectionnez un emplacement');
    setSaving(true);
    try {
      await createSkuLocation({
        sku_id: sku.id,
        node_id: node.id,
        location_id: locationId,
        is_primary_location: isPrimary,
        is_active: true,
      });
      toast.success('SKU mappé à l\'emplacement');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Mapper un SKU</h2>
            <p className="mt-0.5 text-xs text-gray-400">Node {node.name_fr} — l'emplacement sert uniquement au picking.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form id="map-sku-form" onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">SKU <span className="text-red-500">*</span></label>
            {sku ? (
              <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{sku.name_fr}</p>
                  <p className="font-mono text-xs text-gray-500">{sku.sku_code}</p>
                </div>
                <button type="button" onClick={() => setSku(null)} className="text-xs font-semibold text-red-600 hover:underline">Changer</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, code SKU ou EAN…"
                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-100">
                  {searching ? (
                    <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                  ) : results.length === 0 ? (
                    <p className="py-6 text-center text-xs text-gray-400">Aucun SKU trouvé.</p>
                  ) : results.map((r) => (
                    <button key={r.id} type="button" onClick={() => setSku(r)}
                      className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-gray-50">
                      <span className="truncate text-sm text-gray-800">{r.name_fr}</span>
                      <span className="shrink-0 font-mono text-xs text-gray-400">{r.sku_code}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Emplacement <span className="text-red-500">*</span></label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">— Choisir un emplacement —</option>
              {activeLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}{l.zone?.name_fr ? ` · ${l.zone.name_fr}` : ''}{l.level?.name_fr ? ` · ${l.level.name_fr}` : ''}
                </option>
              ))}
            </select>
            {activeLocations.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Aucun emplacement actif sur ce node : créez-en dans l'onglet « Emplacements par node ».</p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="accent-red-600" />
            Emplacement principal de picking pour ce SKU sur ce node
          </label>
        </form>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
          <button type="submit" form="map-sku-form" disabled={saving}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Mapper'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Onglet « Mapping SKU→Emplacement » ──────────────────────────────────── */

export default function SkuMappingTab({ node, zones, locations, canManage, onChanged }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [primaryOnly, setPrimaryOnly] = useState('');
  const [modal, setModal] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => ({
    node_id: node.id,
    ...(search.trim() && { search: search.trim() }),
    ...(zoneId && { zone_id: zoneId }),
    ...(primaryOnly && { is_primary_location: primaryOnly }),
  }), [node.id, search, zoneId, primaryOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSkuLocations({ ...params, page, limit: PAGE_LIMIT });
      setRows(data.data || []);
      setTotal(data.pagination?.total ?? (data.data || []).length);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [params, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => { setPage(1); }, [search, zoneId, primaryOnly, node.id]);

  const pages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const togglePrimary = async (row) => {
    setBusyId(row.id);
    try {
      await updateSkuLocation(row.id, { is_primary_location: !row.is_primary_location });
      toast.success(row.is_primary_location ? 'Emplacement principal retiré' : 'Emplacement principal défini');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!confirmRemove) return;
    setBusyId(confirmRemove.id);
    try {
      await deleteSkuLocation(confirmRemove.id);
      toast.success('SKU retiré de l\'emplacement');
      setConfirmRemove(null);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await getSkuLocations({ ...params, all: true });
      const list = data.data || [];
      exportCsv(
        `mapping_sku_emplacement_${node.code}.csv`,
        ['Node', 'Code SKU', 'SKU', 'Emplacement', 'Zone', 'Niveau', 'Principal', 'Actif'],
        list.map((r) => [
          node.code, r.sku?.sku_code, r.sku?.name_fr, r.location?.label, r.location?.zone?.name_fr || '',
          r.location?.level?.name_fr || '', r.is_primary_location ? 'Oui' : 'Non', r.is_active ? 'Oui' : 'Non',
        ]),
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {modal && (
        <MapSkuModal
          node={node}
          locations={locations}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); load(); onChanged?.(); }}
        />
      )}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-gray-900">Retirer ce mapping ?</h3>
            <p className="mb-6 text-sm text-gray-500">
              Le SKU <b>{confirmRemove.sku?.sku_code}</b> ne sera plus associé à l'emplacement <b>{confirmRemove.location?.label}</b>.
              Le stock et la vendabilité ne sont pas impactés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={remove} disabled={busyId === confirmRemove.id}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {busyId === confirmRemove.id ? 'Retrait…' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un SKU (nom, code, EAN) ou un emplacement…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Toutes les zones</option>
          <option value="none">Sans zone</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name_fr}</option>)}
        </select>
        <select value={primaryOnly} onChange={(e) => setPrimaryOnly(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Principal et secondaires</option>
          <option value="true">Emplacements principaux</option>
          <option value="false">Emplacements secondaires</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting || total === 0}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exporter
          </button>
          {canManage && (
            <button onClick={() => setModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <Plus size={15} /> Mapper SKU
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Info size={13} /> Mapping optionnel, utilisé pour l'ordre de picking. Emplacement ≠ Disponibilité ≠ Vendabilité.
        </p>
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Emplacement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Niveau</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Principal</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="py-14 text-center"><Loader2 size={18} className="mx-auto animate-spin text-gray-400" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-14 text-center text-sm text-gray-400">
                    {search || zoneId || primaryOnly ? 'Aucun mapping ne correspond aux filtres.' : 'Aucun SKU mappé sur ce node.'}
                  </td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{r.sku?.name_fr || '—'}</p>
                      <p className="font-mono text-xs text-gray-400">{r.sku?.sku_code}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{r.location?.label}</td>
                    <td className="px-4 py-3 text-gray-600">{r.location?.zone?.name_fr || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.location?.level?.name_fr || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => canManage && togglePrimary(r)}
                        disabled={!canManage || busyId === r.id}
                        title={r.is_primary_location ? 'Emplacement principal' : 'Définir comme principal'}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
                          r.is_primary_location ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-300 hover:text-amber-500'
                        } disabled:cursor-default`}
                      >
                        {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={r.is_primary_location ? 'currentColor' : 'none'} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button onClick={() => setConfirmRemove(r)} title="Retirer"
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                          <Trash2 size={13} /> Retirer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              <span>{total} mapping{total > 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded-md px-2.5 py-1.5 font-medium hover:bg-gray-100 disabled:opacity-40">Précédent</button>
                <span>Page {page} / {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                  className="rounded-md px-2.5 py-1.5 font-medium hover:bg-gray-100 disabled:opacity-40">Suivant</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
