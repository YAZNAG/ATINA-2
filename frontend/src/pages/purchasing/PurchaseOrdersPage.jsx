import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Eye, PackageCheck, Lock, List, FileText, FilePlus2, Truck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPurchasingLookups, getPurchaseOrders, getSuppliers } from '../../api/purchasing.api';
import PoDetailTab from './PoDetailTab';
import PoNewTab from './PoNewTab';
import PoReceptionTab from './PoReceptionTab';
import {
  useToast, TabBar, PoStatusPill, Spinner, Pagination, inputCls, btnPrimary, btnSecondary, iconBtn,
} from './components/PurchasingUi';
import { errMsg, fmtMoney, fmtDate, todayIso, downloadCsv, csvNum } from './purchasingUtils';

const TABS = [
  { key: 'list', label: 'Liste des BC', icon: List },
  { key: 'detail', label: 'Détail BC & lignes', icon: FileText },
  { key: 'new', label: 'Nouveau BC', icon: FilePlus2 },
  { key: 'reception', label: 'Réception', icon: PackageCheck },
];

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const perms = {
    view: hasPermission('purchase_orders.view'),
    create: hasPermission('purchase_orders.create'),
    update: hasPermission('purchase_orders.update'),
    receive: hasPermission('purchase_orders.receive'),
    suppliers: hasPermission('suppliers.view'),
  };
  const { show: toast, node: toastNode } = useToast();

  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'list';
  const poId = params.get('id') || '';

  const setQuery = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === undefined || v === '' ? next.delete(k) : next.set(k, v)));
    setParams(next);
  }, [params, setParams]);

  const goTab = useCallback((key, id) => setQuery({ tab: key, ...(id !== undefined ? { id } : {}) }), [setQuery]);

  // ——— Référentiels ———
  const [lookups, setLookups] = useState({ statuses: [], nodes: [], suppliers: [] });
  const [allSuppliers, setAllSuppliers] = useState([]);
  useEffect(() => {
    if (!perms.view) return;
    getPurchasingLookups().then(({ data }) => setLookups(data.data || { statuses: [], nodes: [], suppliers: [] }))
      .catch((err) => toast('error', errMsg(err, 'Chargement des référentiels impossible')));
    getSuppliers({ all: true }).then(({ data }) => setAllSuppliers(data.data || [])).catch(() => setAllSuppliers([]));
  }, [perms.view, toast]);

  // ——— Liste ———
  const [filters, setFilters] = useState(() => ({
    supplier_id: params.get('supplier_id') || '',
    node_id: params.get('node_id') || '',
    status: params.get('status') || '',
    sku_id: params.get('sku_id') || '',
    date_from: '',
    date_to: '',
    search: '',
  }));
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [listVersion, setListVersion] = useState(0);

  const apiFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  const loadList = useCallback(async () => {
    if (!perms.view) return;
    setLoading(true);
    try {
      const { data } = await getPurchaseOrders({ ...apiFilters, page, limit: 20 });
      setRows(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      toast('error', errMsg(err, 'Chargement des bons de commande impossible'));
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms.view, JSON.stringify(apiFilters), page, listVersion, toast]);

  useEffect(() => {
    if (tab !== 'list') return undefined;
    const t = setTimeout(loadList, filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadList, tab, filters.search]);
  useEffect(() => { setPage(1); }, [JSON.stringify(apiFilters)]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const refreshList = () => setListVersion((v) => v + 1);

  const exportCsv = async () => {
    try {
      const { data } = await getPurchaseOrders({ ...apiFilters, all: true });
      downloadCsv(`bons_de_commande_${todayIso()}.csv`,
        ['Référence', 'Fournisseur', 'Node', 'Statut', 'Créé le', 'Livraison prévue', 'Reçu le', 'Nb lignes', 'Total HT (MAD)', 'Créé par', 'Notes'],
        (data.data || []).map((po) => [
          po.reference, po.supplier?.name_fr, po.node?.name_fr, po.status?.name_fr, fmtDate(po.created_at), fmtDate(po.expected_at),
          po.received_at ? fmtDate(po.received_at) : '', po.items_count, csvNum(po.total_ht), po.created_by_name || '', po.notes || '',
        ]));
    } catch (err) {
      toast('error', errMsg(err, 'Export impossible'));
    }
  };

  if (!perms.view) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page (permission purchase_orders.view requise).</p>
      </div>
    );
  }

  const skuFilterLabel = filters.sku_id ? 'SKU filtré' : '';

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toastNode}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Bons de commande</h1>
          <p className="mt-1 text-sm text-neutral-500">Commandes d'approvisionnement fournisseurs : création, validation, suivi et réception en stock.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perms.suppliers && (
            <button type="button" className={btnSecondary} onClick={() => navigate('/purchasing/suppliers')}><Truck size={16} /> Fournisseurs</button>
          )}
          {perms.create && (
            <button type="button" className={btnPrimary} onClick={() => goTab('new')}><Plus size={16} /> Nouveau BC</button>
          )}
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={(k) => goTab(k)} />

      {tab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={filters.search} onChange={setFilter('search')} placeholder="Référence, fournisseur, notes…" className={`${inputCls} py-2.5 pl-9`} />
            </div>
            <select value={filters.supplier_id} onChange={setFilter('supplier_id')} className={`${inputCls} w-auto py-2.5`}>
              <option value="">Tous les fournisseurs</option>
              {(allSuppliers.length ? allSuppliers.filter((s) => s.status !== 'deleted') : lookups.suppliers).map((s) => (
                <option key={s.id} value={s.id}>{s.name_fr}</option>
              ))}
            </select>
            <select value={filters.node_id} onChange={setFilter('node_id')} className={`${inputCls} w-auto py-2.5`}>
              <option value="">Tous les nodes</option>
              {lookups.nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
            </select>
            <select value={filters.status} onChange={setFilter('status')} className={`${inputCls} w-auto py-2.5`}>
              <option value="">Tous les statuts</option>
              <option value="draft,sent,in_transit,partially_received">En cours (non soldés)</option>
              {lookups.statuses.map((s) => <option key={s.code} value={s.code}>{s.name_fr}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              Du <input type="date" value={filters.date_from} onChange={setFilter('date_from')} className={`${inputCls} w-auto py-2`} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              au <input type="date" value={filters.date_to} onChange={setFilter('date_to')} className={`${inputCls} w-auto py-2`} />
            </label>
            <button type="button" className={btnSecondary} onClick={exportCsv}><Download size={16} /> Exporter</button>
          </div>
          {skuFilterLabel && (
            <button type="button" onClick={() => setFilters((f) => ({ ...f, sku_id: '' }))} className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-3 py-1 text-xs text-neutral-700">
              BC contenant le SKU sélectionné <X size={12} />
            </button>
          )}

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Node</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Créé le</th>
                  <th className="px-4 py-3 font-medium">Livraison prévue</th>
                  <th className="px-4 py-3 font-medium text-right">Lignes</th>
                  <th className="px-4 py-3 font-medium text-right">Total HT</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr><td colSpan={9}><Spinner /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-400">Aucun bon de commande pour ces filtres.</td></tr>
                ) : rows.map((po) => {
                  const late = po.expected_at && po.expected_at < todayIso() && ['sent', 'in_transit', 'partially_received'].includes(po.status?.code);
                  return (
                    <tr key={po.id} className="cursor-pointer transition hover:bg-neutral-50" onClick={() => goTab('detail', po.id)}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-800">{po.reference}</td>
                      <td className="px-4 py-3 text-neutral-700">{po.supplier?.name_fr}</td>
                      <td className="px-4 py-3 text-neutral-600">{po.node?.name_fr}</td>
                      <td className="px-4 py-3"><PoStatusPill status={po.status} /></td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{fmtDate(po.created_at)}</td>
                      <td className={`px-4 py-3 text-xs ${late ? 'font-semibold text-[#E10600]' : 'text-neutral-500'}`}>
                        {fmtDate(po.expected_at)}{late ? ' · en retard' : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{po.items_count}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">{fmtMoney(po.total_ht)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button type="button" className={iconBtn} title="Détail" onClick={() => goTab('detail', po.id)}><Eye size={16} /></button>
                          {perms.receive && po.can_receive && (
                            <button type="button" className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50" title="Réceptionner" onClick={() => goTab('reception', po.id)}>
                              <PackageCheck size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPage={setPage} />
        </div>
      )}

      {tab === 'detail' && (
        <PoDetailTab
          key={poId || 'none'}
          poId={poId}
          lookups={lookups}
          perms={perms}
          toast={toast}
          goTab={goTab}
          onChanged={refreshList}
        />
      )}

      {tab === 'new' && (
        <PoNewTab
          lookups={lookups}
          perms={perms}
          toast={toast}
          initialSupplierId={params.get('supplier_id') || ''}
          onCreated={(po) => { refreshList(); goTab('detail', po.id); }}
          onCancel={() => goTab('list')}
        />
      )}

      {tab === 'reception' && (
        <PoReceptionTab
          key={poId || 'none'}
          poId={poId}
          perms={perms}
          toast={toast}
          onSelect={(id) => goTab('reception', id)}
          onDone={(po) => { refreshList(); goTab('detail', po.id); }}
        />
      )}
    </div>
  );
}
