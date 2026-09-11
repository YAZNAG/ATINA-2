/**
 * KPI Overview — écran d'accueil du back-office (Reporting / Supervision, US-092).
 * Onglets : Vue Globale | Commandes | Stock & Rupture | Préparation.
 * Filtres : période (jour / semaine / mois / dates), node, région, statut commande.
 * Lecture seule. Clic sur un KPI → écran opérationnel concerné.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Download, CalendarDays, Printer, ShoppingCart, Wallet, HandCoins, PackageX, Ban,
  ClipboardCheck, Timer, ShoppingBasket, AlertTriangle, Activity, ArrowRight, RotateCcw, Boxes, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getReportingFilters, getOverview, getOverviewOrders, getOverviewStock, getOverviewPreparation,
} from '../../api/reporting.api';
import {
  KpiCard, Tabs, LoadingBlock, ErrorBlock, EmptyBlock, Pagination, TrendBars, HBars, SectionCard, StateBadge,
  fmtInt, fmtMoney, fmtPct, fmtNum, fmtDec1, fmtCoverage, fmtDateTime, fmtDate, apiError, cleanParams, downloadCsv, statusHex,
} from './reportingShared';

const TABS = [
  { key: 'global', label: 'Vue Globale' },
  { key: 'orders', label: 'Commandes' },
  { key: 'stock', label: 'Stock & Rupture' },
  { key: 'preparation', label: 'Préparation' },
];

const PERIODS = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

const PERIOD_LABELS = { day: "Aujourd'hui", week: '7 derniers jours', month: '30 derniers jours' };

const LEVELS = [
  { value: 'all', label: 'Ruptures et alertes' },
  { value: 'rupture', label: 'Rupture (≤ 0)' },
  { value: 'alert', label: 'Alerte (≤ seuil de réappro)' },
];

const AUTO_REFRESH_MS = 60000;

const buildQuery = (params) => {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return qs ? `?${qs}` : '';
};

export default function KpiOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ period: 'day', from: '', to: '', node_id: '', region_id: '', status: '' });
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState({ from: '', to: '' });
  const [options, setOptions] = useState({ nodes: [], regions: [], order_statuses: [] });
  const [activeTab, setActiveTab] = useState('global');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Filtres propres à l'onglet Stock & Rupture
  const [stockLevel, setStockLevel] = useState('all');
  const [coverageThreshold, setCoverageThreshold] = useState('7');
  const [stockPage, setStockPage] = useState(1);

  // ── Données ────────────────────────────────────────────────────────────────
  const [data, setData] = useState({ global: null, orders: null, stock: null, preparation: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trendMetric, setTrendMetric] = useState('orders');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getReportingFilters()
      .then(({ data: res }) => setOptions(res.data || {}))
      .catch(() => {});
  }, []);

  const periodParams = useMemo(
    () => (filters.period === 'custom' ? { from: filters.from, to: filters.to } : { period: filters.period }),
    [filters.period, filters.from, filters.to],
  );

  const baseParams = useMemo(
    () => cleanParams({ ...periodParams, node_id: filters.node_id, region_id: filters.region_id, status: filters.status }),
    [periodParams, filters.node_id, filters.region_id, filters.status],
  );

  const stockParams = useMemo(
    () => cleanParams({
      node_id: filters.node_id,
      region_id: filters.region_id,
      level: stockLevel,
      coverage_threshold: coverageThreshold,
      page: stockPage,
      limit: 50,
    }),
    [filters.node_id, filters.region_id, stockLevel, coverageThreshold, stockPage],
  );

  const load = useCallback(async (tab = activeTab) => {
    setLoading(true);
    setError('');
    try {
      let payload;
      if (tab === 'global') payload = (await getOverview(baseParams)).data.data;
      else if (tab === 'orders') payload = (await getOverviewOrders(baseParams)).data.data;
      else if (tab === 'preparation') payload = (await getOverviewPreparation(baseParams)).data.data;
      else {
        const { data: res } = await getOverviewStock(stockParams);
        payload = { rows: res.data || [], pagination: res.pagination, meta: res.meta };
      }
      setData((d) => ({ ...d, [tab]: payload }));
      setLastUpdated(new Date());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, baseParams, stockParams]);

  // Léger délai pour éviter une rafale d'appels pendant la saisie des filtres.
  useEffect(() => {
    const t = setTimeout(() => load(activeTab), 250);
    return () => clearTimeout(t);
  }, [load, activeTab]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(() => load(activeTab), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [autoRefresh, load, activeTab]);

  useEffect(() => { setStockPage(1); }, [filters.node_id, filters.region_id, stockLevel, coverageThreshold]);

  // ── Helpers UI ─────────────────────────────────────────────────────────────
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

  const resetFilters = () => {
    setFilters({ period: 'day', from: '', to: '', node_id: '', region_id: '', status: '' });
    setCustomDraft({ from: '', to: '' });
    setCustomOpen(false);
  };

  const applyCustom = () => {
    if (!customDraft.from || !customDraft.to) { setError('Choisissez une date de début et une date de fin.'); return; }
    if (customDraft.from > customDraft.to) { setError('La date de début doit précéder la date de fin.'); return; }
    setFilters((f) => ({ ...f, period: 'custom', from: customDraft.from, to: customDraft.to }));
    setCustomOpen(false);
  };

  const periodLabel = filters.period === 'custom'
    ? `Du ${fmtDate(filters.from)} au ${fmtDate(filters.to)}`
    : PERIOD_LABELS[filters.period];

  const nodeLabel = (options.nodes || []).find((n) => n.id === filters.node_id);
  const regionLabel = (options.regions || []).find((r) => r.id === filters.region_id);
  const scopeLabel = [nodeLabel ? `${nodeLabel.code} — ${nodeLabel.name_fr}` : null, regionLabel ? regionLabel.name_fr : null]
    .filter(Boolean).join(' · ') || 'Tous les nodes';

  // Drill-down vers les écrans opérationnels (les écrans cibles peuvent lire ces paramètres d'URL).
  const drill = (path, extra = {}) => navigate(`${path}${buildQuery({ node_id: filters.node_id, ...extra })}`);
  const drillOrders = (extra = {}) => drill('/orders-mgmt', { status: filters.status, ...periodParams, ...extra });

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCsv = async () => {
    const d = data[activeTab];
    const stamp = filters.period === 'custom' ? `${filters.from}_${filters.to}` : filters.period;
    const header = [
      { title: `KPI Overview — ${TABS.find((t) => t.key === activeTab)?.label}`, rows: [['Période', periodLabel], ['Périmètre', scopeLabel]] },
    ];
    try {
      setExporting(true);
      if (activeTab === 'global' && d) {
        const k = d.kpis;
        downloadCsv(`kpi-vue-globale-${stamp}.csv`, [
          ...header,
          {
            title: 'Indicateurs',
            headers: ['Indicateur', 'Valeur'],
            rows: [
              ['Nb commandes', k.total_orders], ['CA TTC (hors annulées)', k.revenue_ttc], ['Panier moyen', k.avg_basket],
              ['CA COD encaissé', k.cod_collected], ['CA COD à encaisser', k.cod_pending], ["Taux d'annulation (%)", k.cancel_rate],
              ['Taux de préparation (%)', k.preparation_rate], ['Sessions de picking en cours', k.active_sessions],
              ['Sessions de picking en retard', k.late_sessions], ['SKU en rupture (node × SKU)', k.stock_ruptures],
              ['SKU distincts en rupture', k.stock_rupture_skus], ['Alertes sous seuil de réappro', k.stock_alerts],
            ],
          },
          { title: 'Répartition par statut', headers: ['Statut', 'Commandes', 'Montant TTC', 'Part (%)'], rows: d.by_status.map((s) => [s.name_fr, s.count, s.amount, s.share]) },
          { title: 'Tendance', headers: ['Période', 'Commandes', 'Annulées', 'CA TTC'], rows: d.trend.points.map((p) => [p.bucket, p.orders, p.cancelled, p.revenue]) },
        ]);
      } else if (activeTab === 'orders' && d) {
        const s = d.summary;
        downloadCsv(`kpi-commandes-${stamp}.csv`, [
          ...header,
          {
            title: 'Synthèse', headers: ['Indicateur', 'Valeur'],
            rows: [['Volume', s.total_orders], ['CA TTC', s.revenue_ttc], ['Panier moyen', s.avg_basket], ['Annulées', s.cancelled],
              ["Taux d'annulation (%)", s.cancel_rate], ['COD encaissé', s.cod_collected], ['COD à encaisser', s.cod_pending]],
          },
          { title: 'Répartition par statut', headers: ['Statut', 'Commandes', 'Montant TTC', 'Part (%)'], rows: d.by_status.map((x) => [x.name_fr, x.count, x.amount, x.share]) },
          { title: 'Par node', headers: ['Node', 'Nom', 'Commandes', 'CA TTC', 'Panier moyen', 'Annulées', "Taux d'annulation (%)", 'COD encaissé', 'COD à encaisser'],
            rows: d.by_node.map((n) => [n.node_code, n.node_name, n.orders, n.revenue, n.avg_basket, n.cancelled, n.cancel_rate, n.cod_collected, n.cod_pending]) },
          { title: 'Tendance', headers: ['Période', 'Commandes', 'Annulées', 'CA TTC'], rows: d.trend.points.map((p) => [p.bucket, p.orders, p.cancelled, p.revenue]) },
        ]);
      } else if (activeTab === 'stock') {
        const { data: res } = await getOverviewStock({ ...stockParams, page: 1, limit: 1000 });
        downloadCsv(`kpi-stock-rupture-${new Date().toISOString().slice(0, 10)}.csv`, [
          { title: 'KPI Overview — Stock & Rupture', rows: [['Périmètre', scopeLabel]] },
          {
            headers: ['Node', 'SKU', 'Désignation', 'Qté physique', 'Qté réservée', 'Qté disponible', 'Seuil de réappro', 'Ventes 30 j', 'Jours de couverture', 'État'],
            rows: (res.data || []).map((r) => [r.node_code, r.sku_code, r.sku_name, r.qty_physical, r.qty_reserved, r.qty_available,
              r.reorder_point, r.sold_30d, r.coverage_days === null ? '∞' : r.coverage_days, r.state === 'rupture' ? 'Rupture' : r.state === 'alert' ? 'Alerte' : 'OK']),
          },
        ]);
      } else if (activeTab === 'preparation' && d) {
        const s = d.summary;
        downloadCsv(`kpi-preparation-${stamp}.csv`, [
          ...header,
          {
            title: 'Synthèse', headers: ['Indicateur', 'Valeur'],
            rows: [['Taux de préparation (%)', s.preparation_rate], ['Sessions', s.total_sessions], ['Terminées', s.completed_sessions],
              ['En cours (temps réel)', s.active_sessions], ['En retard (temps réel)', s.late_sessions], ['Durée moyenne (min)', s.avg_duration_min], ['Erreurs', s.total_errors]],
          },
          { title: 'Sessions en cours', headers: ['Commande', 'Node', 'Préparateur', 'Statut', 'Démarrée', 'Écoulé (min)', 'Articles traités', 'Articles', 'En retard'],
            rows: d.active_sessions.map((x) => [x.order_ref, x.node_code, x.picker_name, x.status_name, fmtDateTime(x.started_at), x.elapsed_minutes, x.items_done, x.items_total, x.is_late ? 'Oui' : 'Non']) },
          { title: 'Par node', headers: ['Node', 'Sessions', 'Terminées', 'Annulées', 'En cours', 'Taux (%)', 'Durée moy. (min)', 'Erreurs'],
            rows: d.by_node.map((n) => [n.node_code, n.total, n.completed, n.cancelled, n.active, n.preparation_rate, n.avg_duration_min, n.errors]) },
        ]);
      }
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'export"));
    } finally {
      setExporting(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const current = data[activeTab];

  return (
    <div className="page-shell">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Reporting / Supervision</p>
          <h1 className="page-title">KPI Overview</h1>
          <p className="page-subtitle">
            Bonjour {user?.full_name || ''} — {periodLabel} · {scopeLabel}
            {lastUpdated ? ` · mis à jour à ${lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" className="btn-secondary" onClick={() => { setCustomDraft({ from: filters.from, to: filters.to }); setCustomOpen((o) => !o); }}>
            <CalendarDays className="h-4 w-4" /> Choisir la période
          </button>
          <button type="button" className="btn-secondary" onClick={() => load(activeTab)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
          </button>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={exporting || (!current && activeTab !== 'stock')}>
            <Download className="h-4 w-4" /> Exporter CSV
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()} title="Exporter en PDF via l'impression du navigateur">
            <Printer className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card !p-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
          <div>
            <span className="form-label">Période</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, period: p.key, from: '', to: '' }))}
                  className={`px-3 py-2 text-sm font-medium transition ${filters.period === p.key ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setCustomDraft({ from: filters.from, to: filters.to }); setCustomOpen(true); }}
                className={`border-l border-slate-300 px-3 py-2 text-sm font-medium transition ${filters.period === 'custom' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Dates
              </button>
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="form-label" htmlFor="kpi-region">Région</label>
            <select id="kpi-region" className="form-select" value={filters.region_id} onChange={(e) => setFilter('region_id', e.target.value)}>
              <option value="">Toutes les régions</option>
              {(options.regions || []).map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="form-label" htmlFor="kpi-node">Node</label>
            <select id="kpi-node" className="form-select" value={filters.node_id} onChange={(e) => setFilter('node_id', e.target.value)}>
              <option value="">Tous les nodes</option>
              {nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}{n.is_active ? '' : ' (inactif)'}</option>)}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="form-label" htmlFor="kpi-status">Statut commande</label>
            <select id="kpi-status" className="form-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Tous les statuts</option>
              {(options.order_statuses || []).map((s) => <option key={s.code} value={s.code}>{s.name_fr}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="form-checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Actualisation auto (60 s)
            </label>
            <button type="button" className="btn-secondary !px-3" onClick={resetFilters} title="Réinitialiser les filtres">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {customOpen && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-end">
            <div>
              <label className="form-label" htmlFor="kpi-from">Du</label>
              <input id="kpi-from" type="date" className="form-input" value={customDraft.from} onChange={(e) => setCustomDraft((d) => ({ ...d, from: e.target.value }))} />
            </div>
            <div>
              <label className="form-label" htmlFor="kpi-to">Au</label>
              <input id="kpi-to" type="date" className="form-input" value={customDraft.to} onChange={(e) => setCustomDraft((d) => ({ ...d, to: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary !bg-red-600 hover:!bg-red-700" onClick={applyCustom}>Appliquer</button>
              <button type="button" className="btn-secondary" onClick={() => setCustomOpen(false)}>Annuler</button>
            </div>
            <p className="text-xs text-slate-500 sm:ml-auto">Période maximale : 366 jours.</p>
          </div>
        )}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {error && <ErrorBlock message={error} onRetry={() => load(activeTab)} />}

      {!current && loading && <LoadingBlock />}

      {current && activeTab === 'global' && (
        <GlobalTab d={current} drill={drill} drillOrders={drillOrders} goTab={setActiveTab} />
      )}
      {current && activeTab === 'orders' && (
        <OrdersTab d={current} drillOrders={drillOrders} trendMetric={trendMetric} setTrendMetric={setTrendMetric} />
      )}
      {activeTab === 'stock' && (
        <StockTab
          d={current}
          loading={loading}
          level={stockLevel}
          setLevel={setStockLevel}
          threshold={coverageThreshold}
          setThreshold={setCoverageThreshold}
          onPage={setStockPage}
          drill={drill}
          navigate={navigate}
          filters={filters}
        />
      )}
      {current && activeTab === 'preparation' && (
        <PreparationTab d={current} drill={drill} navigate={navigate} />
      )}
    </div>
  );
}

// ── Vue Globale ──────────────────────────────────────────────────────────────
function GlobalTab({ d, drill, drillOrders, goTab }) {
  const k = d.kpis;
  const statusItems = (d.by_status || []).filter((s) => s.count > 0).map((s) => ({
    key: s.code, label: s.name_fr, value: s.count, sub: fmtMoney(s.amount), color: statusHex(s.color),
    onClick: () => drillOrders({ status: s.code }),
  }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Commandes" value={fmtInt(k.total_orders)} sub={`dont ${fmtInt(k.cancelled)} annulée(s)`} icon={ShoppingCart} tone="blue" onClick={() => drillOrders()} />
        <KpiCard label="CA COD encaissé" value={fmtMoney(k.cod_collected)} sub={`${fmtInt(k.cod_collected_orders)} commande(s) encaissée(s)`} icon={Wallet} tone="emerald" onClick={() => drillOrders()} />
        <KpiCard label="CA COD à encaisser" value={fmtMoney(k.cod_pending)} sub={`${fmtInt(k.cod_pending_orders)} commande(s) en attente`} icon={HandCoins} tone="amber" onClick={() => drillOrders()} />
        <KpiCard label="Taux de préparation" value={fmtPct(k.preparation_rate)} sub={`${fmtInt(k.completed_sessions)} / ${fmtInt(k.total_sessions)} session(s) terminée(s)`} icon={ClipboardCheck} tone="violet" onClick={() => drill('/picking/sessions')} />
        <KpiCard
          label="SKU en rupture"
          value={fmtInt(k.stock_ruptures)}
          sub={`${fmtInt(k.stock_rupture_skus)} SKU distinct(s) · ${fmtInt(k.stock_alerts)} alerte(s) sous seuil`}
          icon={PackageX}
          tone="red"
          onClick={() => drill('/stock/levels', { tab: 'alertes' })}
          title="Couples node × SKU dont la quantité disponible est ≤ 0"
        />
        <KpiCard label="Taux d'annulation" value={fmtPct(k.cancel_rate)} sub={`${fmtInt(k.cancelled)} commande(s) annulée(s)`} icon={Ban} tone="red" onClick={() => drillOrders({ status: 'cancelled' })} />
        <KpiCard label="Panier moyen" value={fmtMoney(k.avg_basket)} sub={`CA TTC ${fmtMoney(k.revenue_ttc)}`} icon={ShoppingBasket} tone="slate" onClick={() => goTab('orders')} />
        <KpiCard
          label="Sessions de picking"
          value={`${fmtInt(k.active_sessions)} en cours`}
          sub={`${fmtInt(k.late_sessions)} en retard (> ${fmtInt(k.late_threshold_minutes)} min ou créneau dépassé)`}
          icon={k.late_sessions > 0 ? AlertTriangle : Timer}
          tone={k.late_sessions > 0 ? 'amber' : 'slate'}
          onClick={() => drill('/picking/sessions')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Tendance des commandes"
          subtitle={d.trend.granularity === 'hour' ? 'Par heure' : d.trend.granularity === 'day' ? 'Par jour' : 'Par semaine'}
        >
          <TrendBars points={d.trend.points.map((p) => ({ label: p.label, value: p.orders, sub: fmtMoney(p.revenue) }))} />
        </SectionCard>
        <SectionCard title="Répartition par statut" subtitle="Clic → liste des commandes filtrée">
          {statusItems.length ? <HBars items={statusItems} /> : <EmptyBlock>Aucune commande sur la période.</EmptyBlock>}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Commandes ────────────────────────────────────────────────────────────────
function OrdersTab({ d, drillOrders, trendMetric, setTrendMetric }) {
  const s = d.summary;
  const statusItems = (d.by_status || []).filter((x) => x.count > 0).map((x) => ({
    key: x.code, label: x.name_fr, value: x.count, sub: `${fmtPct(x.share)} · ${fmtMoney(x.amount)}`, color: statusHex(x.color),
    onClick: () => drillOrders({ status: x.code }),
  }));
  const isRevenue = trendMetric === 'revenue';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Volume" value={fmtInt(s.total_orders)} sub={`${fmtInt(s.delivered)} livrée(s)`} icon={ShoppingCart} tone="blue" onClick={() => drillOrders()} />
        <KpiCard label="CA TTC" value={fmtMoney(s.revenue_ttc)} sub="Hors annulées / retournées" icon={Activity} tone="emerald" />
        <KpiCard label="Panier moyen" value={fmtMoney(s.avg_basket)} sub={`${fmtInt(s.valid_orders)} commande(s) valides`} icon={ShoppingBasket} />
        <KpiCard label="Annulations" value={fmtPct(s.cancel_rate)} sub={`${fmtInt(s.cancelled)} annulée(s)`} icon={Ban} tone="red" onClick={() => drillOrders({ status: 'cancelled' })} />
        <KpiCard label="COD encaissé" value={fmtMoney(s.cod_collected)} sub={`${fmtInt(s.cod_collected_orders)} commande(s)`} icon={Wallet} tone="emerald" />
        <KpiCard label="COD à encaisser" value={fmtMoney(s.cod_pending)} sub={`${fmtInt(s.cod_pending_orders)} commande(s)`} icon={HandCoins} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Tendance"
          subtitle={isRevenue ? 'CA TTC (hors annulées / retournées)' : 'Nombre de commandes'}
          actions={(
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs">
              <button type="button" onClick={() => setTrendMetric('orders')} className={`px-3 py-1.5 ${!isRevenue ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`}>Commandes</button>
              <button type="button" onClick={() => setTrendMetric('revenue')} className={`px-3 py-1.5 ${isRevenue ? 'bg-red-600 text-white' : 'bg-white text-slate-600'}`}>CA</button>
            </div>
          )}
        >
          <TrendBars
            points={d.trend.points.map((p) => ({ label: p.label, value: isRevenue ? p.revenue : p.orders, sub: isRevenue ? `${fmtInt(p.orders)} commande(s)` : fmtMoney(p.revenue) }))}
            valueFormatter={isRevenue ? fmtMoney : fmtInt}
            color={isRevenue ? '#059669' : '#dc2626'}
          />
        </SectionCard>
        <SectionCard title="Répartition par statut" subtitle="Clic → liste des commandes filtrée">
          {statusItems.length ? <HBars items={statusItems} /> : <EmptyBlock>Aucune commande sur la période.</EmptyBlock>}
        </SectionCard>
      </div>

      <SectionCard title="Performance par node" subtitle="Clic sur une ligne → commandes du node">
        {d.by_node.length === 0 ? <EmptyBlock>Aucune commande sur la période.</EmptyBlock> : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">Node</th>
                  <th className="table-th text-right">Commandes</th>
                  <th className="table-th text-right">CA TTC</th>
                  <th className="table-th text-right">Panier moyen</th>
                  <th className="table-th text-right">Annulées</th>
                  <th className="table-th text-right">COD encaissé</th>
                  <th className="table-th text-right">COD à encaisser</th>
                  <th className="table-th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.by_node.map((n) => (
                  <tr key={n.node_id} className="cursor-pointer hover:bg-slate-50" onClick={() => drillOrders({ node_id: n.node_id })}>
                    <td className="table-td"><span className="font-medium text-slate-800">{n.node_code}</span> <span className="text-slate-500">{n.node_name}</span></td>
                    <td className="table-td text-right">{fmtInt(n.orders)}</td>
                    <td className="table-td text-right">{fmtMoney(n.revenue)}</td>
                    <td className="table-td text-right">{fmtMoney(n.avg_basket)}</td>
                    <td className="table-td text-right">{fmtInt(n.cancelled)} <span className="text-xs text-slate-400">({fmtPct(n.cancel_rate)})</span></td>
                    <td className="table-td text-right">{fmtMoney(n.cod_collected)}</td>
                    <td className="table-td text-right">{fmtMoney(n.cod_pending)}</td>
                    <td className="table-td text-right"><ArrowRight className="inline h-4 w-4 text-slate-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Stock & Rupture ──────────────────────────────────────────────────────────
function StockTab({ d, loading, level, setLevel, threshold, setThreshold, onPage, drill, navigate, filters }) {
  const counts = d?.meta?.counts;
  const thr = d?.meta?.filters?.coverage_threshold ?? threshold;
  const goReorder = (row) => navigate(`/stock/reorder-rules${buildQuery({ node_id: row.node_id, sku_id: row.sku_id })}`);
  return (
    <div className="space-y-5">
      <div className="card !p-4 print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-[220px]">
            <label className="form-label" htmlFor="kpi-level">Seuil</label>
            <select id="kpi-level" className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label className="form-label" htmlFor="kpi-thr">Seuil de couverture (jours)</label>
            <input id="kpi-thr" type="number" min="0" step="1" className="form-input" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500 md:ml-auto md:max-w-md">
            Alerte = qté disponible ≤ seuil de réappro (règle active) ; rupture = qté disponible ≤ 0.
            Couverture = qté disponible / ventes moyennes par jour sur 30 jours (∞ si aucune vente).
          </p>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Ruptures (node × SKU)" value={fmtInt(counts.ruptures)} sub={`${fmtInt(counts.rupture_skus)} SKU distinct(s)`} icon={PackageX} tone="red" onClick={() => setLevel('rupture')} />
          <KpiCard label="Alertes sous seuil" value={fmtInt(counts.alerts)} sub={`${fmtInt(counts.alert_skus)} SKU distinct(s)`} icon={AlertTriangle} tone="amber" onClick={() => setLevel('alert')} />
          <KpiCard label={`Couverture ≤ ${fmtInt(thr)} j`} value={fmtInt(counts.below_threshold)} sub="Couples node × SKU (hors ∞)" icon={Clock} tone="violet" onClick={() => navigate(`/reporting/stock-distribution${buildQuery({ node_id: filters.node_id, region_id: filters.region_id, coverage_threshold: thr, tab: 'sku' })}`)} />
          <KpiCard label="Couples node × SKU suivis" value={fmtInt(counts.pairs)} sub="Voir la distribution stock" icon={Boxes} onClick={() => navigate(`/reporting/stock-distribution${buildQuery({ node_id: filters.node_id, region_id: filters.region_id })}`)} />
        </div>
      )}

      <SectionCard
        title="SKU en rupture et sous seuil"
        subtitle="Clic sur une ligne → Niveaux de stock (node × SKU)"
        actions={<button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => navigate('/stock/reorder-rules')}>Aller au réappro <ArrowRight className="h-3.5 w-3.5" /></button>}
      >
        {!d && loading ? <LoadingBlock /> : !d || d.rows.length === 0 ? (
          <EmptyBlock>Aucune rupture ni alerte pour les filtres sélectionnés.</EmptyBlock>
        ) : (
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
                    <th className="table-th text-right">Ventes / j</th>
                    <th className="table-th text-right">Couverture</th>
                    <th className="table-th">État</th>
                    <th className="table-th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.rows.map((r) => (
                    <tr
                      key={`${r.node_id}-${r.sku_id}`}
                      className={`cursor-pointer ${r.state === 'rupture' ? 'bg-red-50/60 hover:bg-red-50' : 'bg-amber-50/50 hover:bg-amber-50'}`}
                      onClick={() => drill('/stock/levels', { node_id: r.node_id, sku_id: r.sku_id })}
                    >
                      <td className="table-td whitespace-nowrap"><span className="font-medium">{r.node_code}</span></td>
                      <td className="table-td">
                        <div className="font-medium text-slate-800">{r.sku_code}</div>
                        <div className="text-xs text-slate-500">{r.sku_name}</div>
                      </td>
                      <td className="table-td text-right">{fmtNum(r.qty_physical)}</td>
                      <td className="table-td text-right">{fmtNum(r.qty_reserved)}</td>
                      <td className="table-td text-right font-semibold">{fmtNum(r.qty_available)}</td>
                      <td className="table-td text-right">{r.reorder_point === null ? <span className="text-xs text-slate-400">Aucune règle</span> : fmtNum(r.reorder_point)}</td>
                      <td className="table-td text-right">{fmtDec1(r.daily_sales)}</td>
                      <td className="table-td text-right">{fmtCoverage(r.coverage_days)}</td>
                      <td className="table-td"><StateBadge state={r.state} /></td>
                      <td className="table-td text-right">
                        <button type="button" className="btn-icon-edit whitespace-nowrap" onClick={(e) => { e.stopPropagation(); goReorder(r); }}>
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

// ── Préparation ──────────────────────────────────────────────────────────────
function PreparationTab({ d, drill, navigate }) {
  const s = d.summary;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Taux de préparation" value={fmtPct(s.preparation_rate)} sub="Terminées / non annulées" icon={ClipboardCheck} tone="violet" onClick={() => drill('/picking/sessions')} />
        <KpiCard label="Sessions" value={fmtInt(s.total_sessions)} sub={`${fmtInt(s.completed_sessions)} terminée(s) · ${fmtInt(s.cancelled_sessions)} annulée(s)`} icon={Activity} onClick={() => drill('/picking/sessions')} />
        <KpiCard label="En cours" value={fmtInt(s.active_sessions)} sub="Temps réel (ouvertes + en cours)" icon={Timer} tone="blue" onClick={() => drill('/picking/sessions', { status: 'in_progress' })} />
        <KpiCard label="En retard" value={fmtInt(s.late_sessions)} sub={`> ${fmtInt(s.late_threshold_minutes)} min ou créneau dépassé`} icon={AlertTriangle} tone={s.late_sessions > 0 ? 'red' : 'slate'} onClick={() => drill('/picking/sessions')} />
        <KpiCard label="Durée moyenne" value={s.avg_duration_min === null ? '—' : `${fmtDec1(s.avg_duration_min)} min`} sub="Démarrage → fin" icon={Clock} />
        <KpiCard label="Erreurs de picking" value={fmtInt(s.total_errors)} sub="Sur la période" icon={Ban} tone={s.total_errors > 0 ? 'amber' : 'slate'} />
      </div>

      <SectionCard title="Sessions en cours / en retard" subtitle="Temps réel — clic sur une ligne → détail de la session">
        {d.active_sessions.length === 0 ? <EmptyBlock>Aucune session de picking en cours.</EmptyBlock> : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">Commande</th>
                  <th className="table-th">Node</th>
                  <th className="table-th">Préparateur</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Démarrée</th>
                  <th className="table-th text-right">Écoulé</th>
                  <th className="table-th text-right">Articles</th>
                  <th className="table-th">Créneau</th>
                  <th className="table-th">Retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.active_sessions.map((x) => (
                  <tr key={x.id} className={`cursor-pointer ${x.is_late ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/picking/sessions/${x.id}`)}>
                    <td className="table-td font-mono text-xs">#{x.order_ref}</td>
                    <td className="table-td whitespace-nowrap">{x.node_code}</td>
                    <td className="table-td">{x.picker_name || <span className="text-slate-400">Non assigné</span>}</td>
                    <td className="table-td">{x.status_name}</td>
                    <td className="table-td whitespace-nowrap">{fmtDateTime(x.started_at)}</td>
                    <td className="table-td text-right whitespace-nowrap">{fmtInt(x.elapsed_minutes)} min</td>
                    <td className="table-td text-right">{fmtInt(x.items_done)} / {fmtInt(x.items_total)}</td>
                    <td className="table-td whitespace-nowrap">{x.slot_start ? fmtDateTime(x.slot_start) : '—'}</td>
                    <td className="table-td">
                      {x.is_late
                        ? <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">En retard</span>
                        : <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Dans les temps</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Préparation par node" subtitle="Sessions créées sur la période">
        {d.by_node.length === 0 ? <EmptyBlock>Aucune session sur la période.</EmptyBlock> : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-th">Node</th>
                  <th className="table-th text-right">Sessions</th>
                  <th className="table-th text-right">Terminées</th>
                  <th className="table-th text-right">Annulées</th>
                  <th className="table-th text-right">En cours</th>
                  <th className="table-th text-right">Taux</th>
                  <th className="table-th text-right">Durée moy.</th>
                  <th className="table-th text-right">Erreurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.by_node.map((n) => (
                  <tr key={n.node_id} className="cursor-pointer hover:bg-slate-50" onClick={() => drill('/picking/sessions', { node_id: n.node_id })}>
                    <td className="table-td"><span className="font-medium text-slate-800">{n.node_code}</span> <span className="text-slate-500">{n.node_name}</span></td>
                    <td className="table-td text-right">{fmtInt(n.total)}</td>
                    <td className="table-td text-right">{fmtInt(n.completed)}</td>
                    <td className="table-td text-right">{fmtInt(n.cancelled)}</td>
                    <td className="table-td text-right">{fmtInt(n.active)}</td>
                    <td className="table-td text-right">{fmtPct(n.preparation_rate)}</td>
                    <td className="table-td text-right">{n.avg_duration_min === null ? '—' : `${fmtDec1(n.avg_duration_min)} min`}</td>
                    <td className="table-td text-right">{fmtInt(n.errors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
