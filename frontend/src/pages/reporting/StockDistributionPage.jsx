/**
 * Distribution Stock (Reporting / Supervision — US-042, US-048, US-096, US-113).
 * Onglets : Couverture par Node | Couverture par SKU | Ruptures & Alertes.
 * Filtres : région, node, famille, catégorie, marque, seuil de couverture, recherche SKU.
 * Vue tableau ou heatmap node × SKU. Lecture seule.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, Download, LayoutGrid, Table2, Search, RotateCcw, ArrowRight, PackageX, AlertTriangle, Clock, Boxes,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import {
  getReportingFilters, getCoverageByNode, getCoverageBySku, getStockAlerts, getStockMatrix, getStockDetail,
} from '../../api/reporting.api';
import {
  KpiCard, Tabs, LoadingBlock, ErrorBlock, EmptyBlock, Pagination, SectionCard, StateBadge, heatColor,
  fmtInt, fmtNum, fmtDec1, fmtPct, fmtCoverage, fmtDateTime, apiError, cleanParams, downloadCsv,
} from './reportingShared';

const TABS = [
  { key: 'node', label: 'Couverture par Node' },
  { key: 'sku', label: 'Couverture par SKU' },
  { key: 'alerts', label: 'Ruptures & Alertes' },
];

const SKU_SORTS = [
  { value: 'coverage', label: 'Couverture croissante' },
  { value: 'ruptures', label: 'Ruptures d\'abord' },
  { value: 'sold', label: 'Ventes 30 j décroissantes' },
  { value: 'rotation', label: 'Rotation décroissante' },
  { value: 'available', label: 'Disponible croissant' },
  { value: 'code', label: 'Code SKU' },
];

const LEVELS = [
  { value: 'all', label: 'Ruptures et alertes' },
  { value: 'rupture', label: 'Rupture (≤ 0)' },
  { value: 'alert', label: 'Alerte (≤ seuil de réappro)' },
];

const EMPTY_FILTERS = { region_id: '', node_id: '', family_id: '', category_id: '', brand_id: '', search: '', coverage_threshold: '7' };

const buildQuery = (params) => {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return qs ? `?${qs}` : '';
};

const stateLabel = (s) => (s === 'rupture' ? 'Rupture' : s === 'alert' ? 'Alerte' : 'OK');

export default function StockDistributionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canView = hasPermission('reporting.view') || hasPermission('dashboard.view');

  const initialTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'node';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView] = useState('table'); // table | heatmap
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    region_id: searchParams.get('region_id') || '',
    node_id: searchParams.get('node_id') || '',
    coverage_threshold: searchParams.get('coverage_threshold') || '7',
  }));
  const [searchDraft, setSearchDraft] = useState('');
  const [options, setOptions] = useState({ nodes: [], regions: [], families: [], categories: [], brands: [] });

  // Paramètres propres aux onglets
  const [skuSort, setSkuSort] = useState('coverage');
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [level, setLevel] = useState('all');
  const [coverageMax, setCoverageMax] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Détail SKU × Node
  const [detailTarget, setDetailTarget] = useState(null); // { sku_id, node_id? }
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!canView) return;
    getReportingFilters().then(({ data: res }) => setOptions(res.data || {})).catch(() => {});
  }, [canView]);

  // Recherche SKU différée
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchDraft.trim() ? f : { ...f, search: searchDraft.trim() })), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => { setPage(1); }, [filters, activeTab, view, skuSort, onlyBelow, level, coverageMax]);

  const commonParams = useMemo(() => cleanParams(filters), [filters]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      if (view === 'heatmap' && activeTab !== 'alerts') {
        const { data: res } = await getStockMatrix({ ...commonParams, page, limit: 25, sort: activeTab === 'sku' ? skuSort : 'ruptures' });
        const nodeRes = activeTab === 'node' ? (await getCoverageByNode(commonParams)).data.data : null;
        setData({ kind: 'matrix', ...res.data, nodeCoverage: nodeRes });
      } else if (activeTab === 'node') {
        const { data: res } = await getCoverageByNode(commonParams);
        setData({ kind: 'node', ...res.data });
      } else if (activeTab === 'sku') {
        const { data: res } = await getCoverageBySku({ ...commonParams, sort: skuSort, only_below: onlyBelow ? 1 : '', page, limit: 50 });
        setData({ kind: 'sku', rows: res.data || [], pagination: res.pagination, meta: res.meta });
      } else {
        const { data: res } = await getStockAlerts({ ...commonParams, level, coverage_max: coverageMax, page, limit: 50 });
        setData({ kind: 'alerts', rows: res.data || [], pagination: res.pagination, meta: res.meta });
      }
    } catch (err) {
      setError(apiError(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, view, activeTab, commonParams, page, skuSort, onlyBelow, level, coverageMax]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // Détail
  useEffect(() => {
    if (!detailTarget) return;
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    getStockDetail(cleanParams({ sku_id: detailTarget.sku_id, node_id: detailTarget.node_id, coverage_threshold: filters.coverage_threshold }))
      .then(({ data: res }) => setDetail(res.data))
      .catch((err) => setDetailError(apiError(err)))
      .finally(() => setDetailLoading(false));
  }, [detailTarget, filters.coverage_threshold]);

  const nodeOptions = useMemo(
    () => (options.nodes || []).filter((n) => !filters.region_id || n.region_id === filters.region_id),
    [options.nodes, filters.region_id],
  );

  const setFilter = (key, value) => setFilters((f) => {
    const next = { ...f, [key]: value };
    if (key === 'region_id' && value && f.node_id) {
      const node = (options.nodes || []).find((n) => n.id === f.node_id);
      if (node && node.region_id !== value) next.node_id = '';
    }
    return next;
  });

  const resetFilters = () => { setFilters(EMPTY_FILTERS); setSearchDraft(''); };

  const threshold = Number(filters.coverage_threshold) || 0;
  const goReorder = (row) => navigate(`/stock/reorder-rules${buildQuery({ node_id: row?.node_id, sku_id: row?.sku_id })}`);
  const openNode = (nodeId) => { setFilters((f) => ({ ...f, node_id: nodeId })); setActiveTab('sku'); setView('table'); };

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportCsv = async () => {
    const date = new Date().toISOString().slice(0, 10);
    setExporting(true);
    try {
      if (view === 'heatmap' && activeTab !== 'alerts' && data?.kind === 'matrix') {
        const cellMap = new Map(data.cells.map((c) => [`${c.sku_id}|${c.node_id}`, c]));
        downloadCsv(`distribution-heatmap-${date}.csv`, [{
          title: 'Distribution Stock — heatmap node × SKU (qté disponible / jours de couverture)',
          headers: ['SKU', 'Désignation', ...data.nodes.map((n) => n.node_code)],
          rows: data.skus.map((s) => [s.sku_code, s.sku_name, ...data.nodes.map((n) => {
            const c = cellMap.get(`${s.sku_id}|${n.node_id}`);
            return c ? `${c.qty_available} / ${c.coverage_days === null ? '∞' : c.coverage_days} j (${stateLabel(c.state)})` : '';
          })]),
        }]);
      } else if (activeTab === 'node' && data?.kind === 'node') {
        downloadCsv(`couverture-par-node-${date}.csv`, [{
          title: `Couverture par Node — seuil ${filters.coverage_threshold} j`,
          headers: ['Node', 'Nom', 'Région', 'Nb SKU', 'Disponibilité (%)', 'Qté physique', 'Qté réservée', 'Qté disponible', 'Ventes 30 j', 'Ventes / j', 'Jours de couverture', 'Ruptures', 'Alertes', 'Sous seuil de couverture'],
          rows: data.rows.map((r) => [r.node_code, r.node_name, r.region_name, r.sku_count, r.availability_rate, r.qty_physical, r.qty_reserved, r.qty_available,
            r.sold_30d, r.daily_sales, r.coverage_days === null ? (r.sku_count ? '∞' : '') : r.coverage_days, r.ruptures, r.alerts, r.below_threshold]),
        }]);
      } else if (activeTab === 'sku') {
        const { data: res } = await getCoverageBySku({ ...commonParams, sort: skuSort, only_below: onlyBelow ? 1 : '', page: 1, limit: 500 });
        downloadCsv(`couverture-par-sku-${date}.csv`, [{
          title: `Couverture par SKU — seuil ${filters.coverage_threshold} j`,
          headers: ['SKU', 'Désignation', 'Famille', 'Catégorie', 'Marque', 'Nb nodes', 'Disponibilité (%)', 'Qté physique', 'Qté réservée', 'Qté disponible', 'Ventes 30 j', 'Ventes / j', 'Jours de couverture', 'Rotation 30 j', 'Ruptures', 'Alertes'],
          rows: (res.data || []).map((r) => [r.sku_code, r.sku_name, r.family_name, r.category_name, r.brand_name, r.node_count, r.availability_rate,
            r.qty_physical, r.qty_reserved, r.qty_available, r.sold_30d, r.daily_sales, r.coverage_days === null ? '∞' : r.coverage_days, r.rotation, r.ruptures, r.alerts]),
        }]);
      } else if (activeTab === 'alerts') {
        const { data: res } = await getStockAlerts({ ...commonParams, level, coverage_max: coverageMax, page: 1, limit: 1000 });
        downloadCsv(`ruptures-alertes-${date}.csv`, [{
          title: 'Ruptures & Alertes',
          headers: ['Node', 'SKU', 'Désignation', 'Qté physique', 'Qté réservée', 'Qté disponible', 'Seuil de réappro', 'Stock de sécurité', 'Ventes / j', 'Jours de couverture', 'État'],
          rows: (res.data || []).map((r) => [r.node_code, r.sku_code, r.sku_name, r.qty_physical, r.qty_reserved, r.qty_available, r.reorder_point,
            r.safety_stock, r.daily_sales, r.coverage_days === null ? '∞' : r.coverage_days, stateLabel(r.state)]),
        }]);
      }
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'export"));
    } finally {
      setExporting(false);
    }
  };

  if (!canView) {
    return (
      <div className="page-shell">
        <ErrorBlock message="Accès refusé : la permission « reporting.view » ou « dashboard.view » est requise." />
      </div>
    );
  }

  const heatmapAvailable = activeTab !== 'alerts';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Reporting / Supervision</p>
          <h1 className="page-title">Distribution Stock</h1>
          <p className="page-subtitle">Répartition et couverture du stock par node et par SKU pour anticiper les ruptures (ventes moyennes sur 30 jours).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {heatmapAvailable && (
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
              <button type="button" onClick={() => setView('table')} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${view === 'table' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                <Table2 className="h-4 w-4" /> Tableau
              </button>
              <button type="button" onClick={() => setView('heatmap')} className={`inline-flex items-center gap-1.5 border-l border-slate-300 px-3 py-2 text-sm font-medium ${view === 'heatmap' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                <LayoutGrid className="h-4 w-4" /> Heatmap
              </button>
            </div>
          )}
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
          </button>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={exporting || !data}>
            <Download className="h-4 w-4" /> Exporter
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card !p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <div>
            <label className="form-label" htmlFor="sd-region">Région</label>
            <select id="sd-region" className="form-select" value={filters.region_id} onChange={(e) => setFilter('region_id', e.target.value)}>
              <option value="">Toutes</option>
              {(options.regions || []).map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sd-node">Node</label>
            <select id="sd-node" className="form-select" value={filters.node_id} onChange={(e) => setFilter('node_id', e.target.value)}>
              <option value="">Tous</option>
              {nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sd-family">Famille</label>
            <select id="sd-family" className="form-select" value={filters.family_id} onChange={(e) => setFilter('family_id', e.target.value)}>
              <option value="">Toutes</option>
              {(options.families || []).map((f) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sd-category">Catégorie</label>
            <select id="sd-category" className="form-select" value={filters.category_id} onChange={(e) => setFilter('category_id', e.target.value)}>
              <option value="">Toutes</option>
              {(options.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sd-brand">Marque</label>
            <select id="sd-brand" className="form-select" value={filters.brand_id} onChange={(e) => setFilter('brand_id', e.target.value)}>
              <option value="">Toutes</option>
              {(options.brands || []).map((b) => <option key={b.id} value={b.id}>{b.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="sd-thr">Seuil de couverture (j)</label>
            <input id="sd-thr" type="number" min="0" step="1" className="form-input" value={filters.coverage_threshold} onChange={(e) => setFilter('coverage_threshold', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="sd-search">Recherche SKU</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="sd-search" className="form-input pl-9" placeholder="Code, nom FR/AR, EAN…" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
              </div>
              <button type="button" className="btn-secondary !px-3" onClick={resetFilters} title="Réinitialiser les filtres">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={(k) => { setActiveTab(k); setData(null); }} />

      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && loading && <LoadingBlock />}

      {data?.kind === 'matrix' && view === 'heatmap' && activeTab !== 'alerts' && (
        <HeatmapView
          d={data}
          threshold={threshold}
          onCell={(c, s, n) => setDetailTarget({ sku_id: s.sku_id, node_id: n.node_id })}
          onSku={(s) => setDetailTarget({ sku_id: s.sku_id })}
          onNode={openNode}
          onPage={setPage}
          showNodeCoverage={activeTab === 'node'}
        />
      )}

      {data?.kind === 'node' && view === 'table' && activeTab === 'node' && (
        <NodeTable d={data} threshold={threshold} onNode={openNode} />
      )}

      {data?.kind === 'sku' && view === 'table' && activeTab === 'sku' && (
        <SectionCard
          title="Couverture par SKU"
          subtitle="Clic sur un SKU → détail SKU × Node (niveaux + mouvements)"
          actions={(
            <>
              <select className="form-select !w-auto !py-1.5 text-xs" value={skuSort} onChange={(e) => setSkuSort(e.target.value)} aria-label="Tri">
                {SKU_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" className="form-checkbox" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
                Uniquement couverture ≤ {fmtInt(threshold)} j
              </label>
            </>
          )}
        >
          {data.rows.length === 0 ? <EmptyBlock /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="table-th">SKU</th>
                      <th className="table-th">Famille / Catégorie / Marque</th>
                      <th className="table-th text-right">Nodes</th>
                      <th className="table-th text-right">Disponibilité</th>
                      <th className="table-th text-right">Physique</th>
                      <th className="table-th text-right">Réservée</th>
                      <th className="table-th text-right">Disponible</th>
                      <th className="table-th text-right">Ventes 30 j</th>
                      <th className="table-th text-right">Couverture</th>
                      <th className="table-th text-right">Rotation</th>
                      <th className="table-th text-right">Ruptures / Alertes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((r) => {
                      const low = r.coverage_days !== null && r.coverage_days <= threshold;
                      return (
                        <tr key={r.sku_id} className={`cursor-pointer ${r.ruptures > 0 ? 'bg-red-50/40 hover:bg-red-50' : low ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}`} onClick={() => setDetailTarget({ sku_id: r.sku_id, node_id: filters.node_id || undefined })}>
                          <td className="table-td">
                            <div className="font-medium text-slate-800">{r.sku_code}</div>
                            <div className="text-xs text-slate-500">{r.sku_name}</div>
                            {r.sku_name_ar ? <div className="text-xs text-slate-400" dir="rtl">{r.sku_name_ar}</div> : null}
                          </td>
                          <td className="table-td text-xs text-slate-500">{[r.family_name, r.category_name, r.brand_name].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="table-td text-right">{fmtInt(r.node_count)}</td>
                          <td className="table-td text-right">{fmtPct(r.availability_rate)}</td>
                          <td className="table-td text-right">{fmtNum(r.qty_physical)}</td>
                          <td className="table-td text-right">{fmtNum(r.qty_reserved)}</td>
                          <td className="table-td text-right font-semibold">{fmtNum(r.qty_available)}</td>
                          <td className="table-td text-right">{fmtNum(r.sold_30d)}</td>
                          <td className={`table-td text-right font-medium ${low ? 'text-amber-700' : ''}`}>{fmtCoverage(r.coverage_days)}</td>
                          <td className="table-td text-right">{r.rotation === null ? '—' : fmtDec1(r.rotation)}</td>
                          <td className="table-td text-right">
                            <span className={r.ruptures ? 'font-semibold text-red-600' : 'text-slate-400'}>{fmtInt(r.ruptures)}</span>
                            {' / '}
                            <span className={r.alerts ? 'font-semibold text-amber-600' : 'text-slate-400'}>{fmtInt(r.alerts)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination pagination={data.pagination} onPage={setPage} />
            </>
          )}
        </SectionCard>
      )}

      {data?.kind === 'alerts' && activeTab === 'alerts' && (
        <AlertsView
          d={data}
          level={level}
          setLevel={setLevel}
          coverageMax={coverageMax}
          setCoverageMax={setCoverageMax}
          onRow={(r) => setDetailTarget({ sku_id: r.sku_id, node_id: r.node_id })}
          onReorder={goReorder}
          onPage={setPage}
        />
      )}

      <DetailModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        loading={detailLoading}
        error={detailError}
        detail={detail}
        target={detailTarget}
        onAllNodes={() => setDetailTarget((t) => ({ sku_id: t.sku_id }))}
        onNode={(nodeId) => setDetailTarget((t) => ({ sku_id: t.sku_id, node_id: nodeId }))}
        onReorder={goReorder}
        onLevels={(row) => navigate(`/stock/levels${buildQuery({ node_id: row.node_id, sku_id: row.sku_id })}`)}
      />
    </div>
  );
}

// ── Couverture par Node (tableau) ────────────────────────────────────────────
function NodeTable({ d, threshold, onNode }) {
  const t = d.totals;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Couples node × SKU" value={fmtInt(t.sku_count)} sub={`Disponible total ${fmtNum(t.qty_available)}`} icon={Boxes} />
        <KpiCard label="Ruptures" value={fmtInt(t.ruptures)} sub="Qté disponible ≤ 0" icon={PackageX} tone="red" />
        <KpiCard label="Alertes sous seuil" value={fmtInt(t.alerts)} sub="Qté disponible ≤ seuil de réappro" icon={AlertTriangle} tone="amber" />
        <KpiCard label={`Couverture ≤ ${fmtInt(threshold)} j`} value={fmtInt(t.below_threshold)} sub="Couples node × SKU (hors ∞)" icon={Clock} tone="violet" />
      </div>
      <SectionCard title="Couverture par Node" subtitle="Clic sur un node → couverture par SKU de ce node">
        {d.rows.length === 0 ? <EmptyBlock>Aucun node pour les filtres sélectionnés.</EmptyBlock> : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">Node</th>
                  <th className="table-th">Région</th>
                  <th className="table-th text-right">Nb SKU</th>
                  <th className="table-th text-right">Disponibilité</th>
                  <th className="table-th text-right">Physique</th>
                  <th className="table-th text-right">Réservée</th>
                  <th className="table-th text-right">Disponible</th>
                  <th className="table-th text-right">Ventes / j</th>
                  <th className="table-th text-right">Couverture</th>
                  <th className="table-th text-right">Ruptures</th>
                  <th className="table-th text-right">Alertes</th>
                  <th className="table-th text-right">≤ {fmtInt(threshold)} j</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.rows.map((r) => {
                  const low = r.coverage_days !== null && r.coverage_days <= threshold;
                  return (
                    <tr key={r.node_id} className="cursor-pointer hover:bg-slate-50" onClick={() => onNode(r.node_id)}>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{r.node_code}</div>
                        <div className="text-xs text-slate-500">{r.node_name}</div>
                      </td>
                      <td className="table-td text-sm text-slate-600">{r.region_name || '—'}</td>
                      <td className="table-td text-right">{fmtInt(r.sku_count)}</td>
                      <td className="table-td text-right">{fmtPct(r.availability_rate)}</td>
                      <td className="table-td text-right">{fmtNum(r.qty_physical)}</td>
                      <td className="table-td text-right">{fmtNum(r.qty_reserved)}</td>
                      <td className="table-td text-right font-semibold">{fmtNum(r.qty_available)}</td>
                      <td className="table-td text-right">{fmtDec1(r.daily_sales)}</td>
                      <td className={`table-td text-right font-medium ${low ? 'text-amber-700' : ''}`}>{r.sku_count ? fmtCoverage(r.coverage_days) : '—'}</td>
                      <td className={`table-td text-right ${r.ruptures ? 'font-semibold text-red-600' : ''}`}>{fmtInt(r.ruptures)}</td>
                      <td className={`table-td text-right ${r.alerts ? 'font-semibold text-amber-600' : ''}`}>{fmtInt(r.alerts)}</td>
                      <td className="table-td text-right">{fmtInt(r.below_threshold)}</td>
                      <td className="table-td text-right"><ArrowRight className="inline h-4 w-4 text-slate-400" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Heatmap node × SKU ───────────────────────────────────────────────────────
function HeatmapView({ d, threshold, onCell, onSku, onNode, onPage, showNodeCoverage }) {
  const cellMap = useMemo(() => new Map(d.cells.map((c) => [`${c.sku_id}|${c.node_id}`, c])), [d.cells]);
  const nodeCov = useMemo(() => new Map((d.nodeCoverage?.rows || []).map((r) => [r.node_id, r])), [d.nodeCoverage]);
  return (
    <SectionCard
      title="Heatmap node × SKU"
      subtitle="Valeur = qté disponible, couleur = état / jours de couverture. Clic sur une cellule → détail SKU × Node ; clic sur un node → SKU du node."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        {[
          { label: 'Rupture', c: { state: 'rupture' } },
          { label: 'Alerte (≤ seuil réappro)', c: { state: 'alert' } },
          { label: `Couverture ≤ ${threshold} j`, c: { state: 'ok', coverage_days: threshold } },
          { label: `≤ ${threshold * 2} j`, c: { state: 'ok', coverage_days: threshold * 2 } },
          { label: `> ${threshold * 2} j`, c: { state: 'ok', coverage_days: threshold * 2 + 1 } },
          { label: 'Aucune vente (∞)', c: { state: 'ok', coverage_days: null } },
          { label: 'Non référencé', c: null },
        ].map((l) => {
          const col = heatColor(l.c, threshold);
          return (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: col.bg, border: '1px solid #e2e8f0' }} /> {l.label}
            </span>
          );
        })}
      </div>
      {d.skus.length === 0 ? <EmptyBlock /> : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-xs font-semibold text-slate-500">SKU \ Node</th>
                  {d.nodes.map((n) => {
                    const cov = nodeCov.get(n.node_id);
                    const col = cov ? heatColor({ state: cov.ruptures > 0 && cov.skus_available === 0 ? 'rupture' : 'ok', coverage_days: cov.coverage_days }, threshold) : null;
                    return (
                      <th key={n.node_id} className="min-w-[88px] px-1 py-1 text-center">
                        <button type="button" onClick={() => onNode(n.node_id)} className="w-full rounded-md px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" title={`${n.node_name} — voir les SKU du node`}>
                          {n.node_code}
                        </button>
                        {showNodeCoverage && cov ? (
                          <div className="mt-0.5 rounded px-1 text-[10px] font-medium" style={{ backgroundColor: col.bg, color: col.fg }}>
                            {cov.sku_count ? fmtCoverage(cov.coverage_days) : '—'}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {d.skus.map((s) => (
                  <tr key={s.sku_id}>
                    <td className="sticky left-0 z-10 bg-white px-2 py-1">
                      <button type="button" onClick={() => onSku(s)} className="text-left">
                        <div className="text-xs font-medium text-slate-800 hover:text-red-700">{s.sku_code}</div>
                        <div className="max-w-[180px] truncate text-[11px] text-slate-500">{s.sku_name}</div>
                      </button>
                    </td>
                    {d.nodes.map((n) => {
                      const c = cellMap.get(`${s.sku_id}|${n.node_id}`);
                      const col = heatColor(c, threshold);
                      return (
                        <td key={n.node_id} className="p-0">
                          <button
                            type="button"
                            disabled={!c}
                            onClick={() => c && onCell(c, s, n)}
                            className="h-11 w-full rounded-md px-1 text-center text-xs font-semibold transition hover:opacity-80 disabled:cursor-default"
                            style={{ backgroundColor: col.bg, color: col.fg }}
                            title={c ? `${s.sku_code} @ ${n.node_code} — dispo ${c.qty_available}, seuil ${c.reorder_point ?? '—'}, couverture ${fmtCoverage(c.coverage_days)}` : 'Non référencé sur ce node'}
                          >
                            {c ? (
                              <>
                                <div>{fmtNum(c.qty_available)}</div>
                                <div className="text-[10px] font-normal opacity-90">{fmtCoverage(c.coverage_days)}</div>
                              </>
                            ) : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={d.pagination} onPage={onPage} />
        </>
      )}
    </SectionCard>
  );
}

// ── Ruptures & Alertes ───────────────────────────────────────────────────────
function AlertsView({ d, level, setLevel, coverageMax, setCoverageMax, onRow, onReorder, onPage }) {
  const counts = d.meta?.counts || {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ruptures (node × SKU)" value={fmtInt(counts.ruptures)} sub={`${fmtInt(counts.rupture_skus)} SKU distinct(s)`} icon={PackageX} tone="red" onClick={() => setLevel('rupture')} />
        <KpiCard label="Alertes sous seuil" value={fmtInt(counts.alerts)} sub={`${fmtInt(counts.alert_skus)} SKU distinct(s)`} icon={AlertTriangle} tone="amber" onClick={() => setLevel('alert')} />
        <KpiCard label="Couverture ≤ seuil" value={fmtInt(counts.below_threshold)} sub={`Seuil : ${fmtInt(d.meta?.filters?.coverage_threshold)} j`} icon={Clock} tone="violet" />
        <KpiCard label="Couples suivis" value={fmtInt(counts.pairs)} sub="Node × SKU (stock ou règle active)" icon={Boxes} />
      </div>

      <SectionCard
        title="Ruptures & Alertes"
        subtitle="Lecture seule. Clic sur une ligne → détail SKU × Node ; « Aller au réappro » → Paramètres Stock (réappro) filtré."
        actions={(
          <>
            <select className="form-select !w-auto !py-1.5 text-xs" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Seuil">
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <input
              type="number"
              min="0"
              step="1"
              className="form-input !w-40 !py-1.5 text-xs"
              placeholder="Couverture max (j)"
              value={coverageMax}
              onChange={(e) => setCoverageMax(e.target.value)}
              aria-label="Couverture maximale en jours"
            />
            <button type="button" className="btn-primary !bg-red-600 !py-1.5 text-xs hover:!bg-red-700" onClick={() => onReorder(null)}>
              Aller au réappro <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      >
        {d.rows.length === 0 ? <EmptyBlock>Aucune rupture ni alerte pour les filtres sélectionnés.</EmptyBlock> : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="table-th">Node</th>
                    <th className="table-th">SKU</th>
                    <th className="table-th text-right">Physique</th>
                    <th className="table-th text-right">Réservée</th>
                    <th className="table-th text-right">Disponible</th>
                    <th className="table-th text-right">Seuil réappro</th>
                    <th className="table-th text-right">Stock sécurité</th>
                    <th className="table-th text-right">Ventes / j</th>
                    <th className="table-th text-right">Couverture</th>
                    <th className="table-th">État</th>
                    <th className="table-th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.rows.map((r) => (
                    <tr key={`${r.node_id}-${r.sku_id}`} className={`cursor-pointer ${r.state === 'rupture' ? 'bg-red-50/60 hover:bg-red-50' : 'bg-amber-50/50 hover:bg-amber-50'}`} onClick={() => onRow(r)}>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{r.node_code}</div>
                        <div className="text-xs text-slate-500">{r.region_name || ''}</div>
                      </td>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{r.sku_code}</div>
                        <div className="text-xs text-slate-500">{r.sku_name}</div>
                      </td>
                      <td className="table-td text-right">{fmtNum(r.qty_physical)}</td>
                      <td className="table-td text-right">{fmtNum(r.qty_reserved)}</td>
                      <td className="table-td text-right font-semibold">{fmtNum(r.qty_available)}</td>
                      <td className="table-td text-right">{r.reorder_point === null ? <span className="text-xs text-slate-400">Aucune règle</span> : fmtNum(r.reorder_point)}</td>
                      <td className="table-td text-right">{r.safety_stock === null ? '—' : fmtNum(r.safety_stock)}</td>
                      <td className="table-td text-right">{fmtDec1(r.daily_sales)}</td>
                      <td className="table-td text-right">{fmtCoverage(r.coverage_days)}</td>
                      <td className="table-td"><StateBadge state={r.state} /></td>
                      <td className="table-td text-right">
                        <button type="button" className="btn-icon-edit whitespace-nowrap" onClick={(e) => { e.stopPropagation(); onReorder(r); }}>
                          Aller au réappro
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={d.pagination} onPage={onPage} />
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ── Détail SKU × Node ────────────────────────────────────────────────────────
function DetailModal({ open, onClose, loading, error, detail, target, onAllNodes, onNode, onReorder, onLevels }) {
  const sku = detail?.sku;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={sku ? `${sku.sku_code} — ${sku.name_fr}` : 'Détail SKU × Node'}
      subtitle={sku ? [sku.family_name, sku.category_name, sku.brand_name, sku.ean13 ? `EAN ${sku.ean13}` : null].filter(Boolean).join(' · ') : ''}
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}
    >
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {detail && (
        <div className="space-y-5">
          {sku?.name_ar ? <p className="text-sm text-slate-500" dir="rtl">{sku.name_ar}</p> : null}
          {target?.node_id ? (
            <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={onAllNodes}>Voir tous les nodes pour ce SKU</button>
          ) : null}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Niveaux de stock par node</h4>
            {detail.levels.length === 0 ? <EmptyBlock>Aucun niveau de stock ni règle de réappro pour ce SKU.</EmptyBlock> : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="table-th">Node</th>
                      <th className="table-th text-right">Physique</th>
                      <th className="table-th text-right">Réservée</th>
                      <th className="table-th text-right">Disponible</th>
                      <th className="table-th text-right">Seuil réappro</th>
                      <th className="table-th text-right">Qté éco.</th>
                      <th className="table-th text-right">Ventes 30 j</th>
                      <th className="table-th text-right">Couverture</th>
                      <th className="table-th">État</th>
                      <th className="table-th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.levels.map((l) => (
                      <tr key={l.node_id} className={l.state === 'rupture' ? 'bg-red-50/60' : l.state === 'alert' ? 'bg-amber-50/50' : ''}>
                        <td className="table-td">
                          <button type="button" className="font-medium text-slate-800 hover:text-red-700" onClick={() => onNode(l.node_id)} title="Filtrer les mouvements sur ce node">
                            {l.node_code}
                          </button>
                          <div className="text-xs text-slate-500">{l.node_name}</div>
                        </td>
                        <td className="table-td text-right">{fmtNum(l.qty_physical)}</td>
                        <td className="table-td text-right">{fmtNum(l.qty_reserved)}</td>
                        <td className="table-td text-right font-semibold">{fmtNum(l.qty_available)}</td>
                        <td className="table-td text-right">{l.reorder_point === null ? <span className="text-xs text-slate-400">Aucune règle</span> : fmtNum(l.reorder_point)}</td>
                        <td className="table-td text-right">{l.economic_qty === null ? '—' : fmtNum(l.economic_qty)}</td>
                        <td className="table-td text-right">{fmtNum(l.sold_30d)}</td>
                        <td className="table-td text-right">{fmtCoverage(l.coverage_days)}</td>
                        <td className="table-td"><StateBadge state={l.state} /></td>
                        <td className="table-td whitespace-nowrap text-right">
                          <button type="button" className="btn-icon-edit mr-1" onClick={() => onLevels(l)}>Niveaux</button>
                          <button type="button" className="btn-icon-add" onClick={() => onReorder(l)}>Réappro</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">
              Derniers mouvements {target?.node_id ? '(node sélectionné)' : '(tous nodes)'}
            </h4>
            {detail.moves.length === 0 ? <EmptyBlock>Aucun mouvement de stock.</EmptyBlock> : (
              <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="table-th">Date</th>
                      <th className="table-th">Node</th>
                      <th className="table-th">Type</th>
                      <th className="table-th text-right">Quantité</th>
                      <th className="table-th">Référence</th>
                      <th className="table-th">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.moves.map((m) => (
                      <tr key={m.id}>
                        <td className="table-td whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                        <td className="table-td">{m.node_code}</td>
                        <td className="table-td">{m.move_type_name || m.move_type_code || '—'}</td>
                        <td className={`table-td text-right font-semibold ${m.qty_delta < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {m.qty_delta > 0 ? '+' : ''}{fmtNum(m.qty_delta)}
                        </td>
                        <td className="table-td text-xs">{m.reference || '—'}</td>
                        <td className="table-td text-xs">{m.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
