import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getP0Registry } from '../api/p0.api';

const Icon = ({ d, className = 'w-[18px] h-[18px]' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  picking: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  delivery: 'M3 7h11v10H3V7zm11 3h4l3 3v4h-7v-7zm-8 9a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z',
  customers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  staff: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  products: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  offers: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  stock: 'M4 6h16M4 6a2 2 0 012-2h12a2 2 0 012 2M4 6v12a2 2 0 002 2h12a2 2 0 002-2V6M9 10h6M9 14h6',
  warehouse: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  geo: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2',
  gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  payment: 'M3 10h18M7 15h2m4 0h4M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  wallet: 'M3 7a2 2 0 012-2h11a2 2 0 012 2v1h1a2 2 0 012 2v6a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm13 6h4M16 11v4',
  tables: 'M4 7h16M4 12h16M4 17h10',
  access: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  quality: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  hierarchy: 'M4 6h6M4 12h10M4 18h14M14 6h6',
  price: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  ruler: 'M4 7l3-3 13 13-3 3L4 7zm4 1l2 2m1-5l2 2m1 3l2 2',
  store: 'M3 9l1-5h16l1 5M3 9h18M3 9v11h18V9M9 20v-6h6v6',
  moves: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  supplier: 'M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  po: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  ticket: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  gift: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
  exchange: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  share: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm11 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  log: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  chevron: 'M19 9l-7 7-7-7',
  logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
};

const ANY = ['dashboard.view'];

/*
 * Structure = classeur « Atina Suivi 3108 », feuille UX : une section par « Section »
 * du classeur, une entrée par sous-module (les onglets sont dans chaque page).
 * Les écrans propres à l'application sont rangés dans la section métier la plus proche.
 */
const SECTIONS = [
  {
    title: 'Reporting / Supervision',
    items: [
      { label: 'KPI Overview',            path: '/dashboard',                   exact: true, anyPermissions: ['reporting.view', 'dashboard.view'], icon: ICONS.dashboard },
      { label: 'Distribution Stock',      path: '/reporting/stock-distribution', anyPermissions: ['reporting.view', 'dashboard.view'], icon: ICONS.chart },
    ],
  },
  {
    title: 'Commandes & Livraison',
    items: [
      { label: 'Commandes',               path: '/orders-mgmt',                 anyPermissions: ['orders.view', ...ANY], icon: ICONS.orders },
      { label: 'Créneaux de livraison',   path: '/orders/delivery-slots',       exact: true, anyPermissions: ['delivery_slots.view', ...ANY], icon: ICONS.calendar },
      {
        label: 'Tournées & Livreurs', key: 'tours', icon: ICONS.delivery,
        children: [
          { label: 'Tournées',            path: '/delivery/tours',              anyPermissions: ANY },
          { label: 'Commandes prêtes',    path: '/delivery/ready-orders',       anyPermissions: ANY },
          { label: 'Retraits en magasin', path: '/pickup/orders',               anyPermissions: ANY },
        ],
      },
    ],
  },
  {
    title: 'Préparation & Qualité',
    items: [
      { label: 'Préparation (Picking)',   path: '/picking/sessions',            anyPermissions: ['picking.read', ...ANY], icon: ICONS.picking },
      { label: 'Contrôles Qualité',       path: '/quality/checks',              anyPermissions: ['quality_checks.view', 'quality_checks.create'], icon: ICONS.quality },
    ],
  },
  {
    title: 'Master Data Produit',
    items: [
      { label: 'Produits (SKUs)',         path: '/catalog/skus',                permission: 'skus.view', icon: ICONS.products },
      { label: 'Marques',                 path: '/catalog/brands',              permission: 'brands.view', icon: ICONS.tag },
      { label: 'Hiérarchie Produit',      path: '/catalog/hierarchy',           anyPermissions: ['families.view', 'categories.view', 'sub_categories.view'], icon: ICONS.hierarchy },
      { label: 'Vendabilité & prix par node', path: '/stock/selling-rules',     anyPermissions: ['stock.manage', 'stock.view', ...ANY], icon: ICONS.price },
    ],
  },
  {
    title: 'Référence',
    items: [
      { label: 'Unités',                  path: '/reference/units',             exact: true, anyPermissions: ['units.view'], icon: ICONS.ruler },
    ],
  },
  {
    title: 'Master Data Géographie',
    items: [
      { label: 'Nœuds (Nodes)',           path: '/nodes',                       anyPermissions: ['nodes.view', ...ANY], icon: ICONS.store },
      { label: 'Région & Ville',          path: '/geo',                         exact: true, anyPermissions: ['regions.view', 'cities.view', ...ANY], icon: ICONS.geo },
    ],
  },
  {
    title: 'Inventaire',
    items: [
      { label: 'Niveaux de stock',        path: '/stock/levels',                anyPermissions: ['stock.manage', 'stock.view', ...ANY], icon: ICONS.stock },
      { label: 'Mouvements Stock',        path: '/stock/moves',                 anyPermissions: ['stock.manage', 'stock.view', ...ANY], icon: ICONS.moves },
      { label: 'Paramètres Stock (Réappro)', path: '/stock/reorder-rules',      anyPermissions: ['stock.manage', 'stock.view', ...ANY], icon: ICONS.refresh },
      { label: 'Comptage / Inventaire physique', path: '/stock/counts',         anyPermissions: ['stock_counts.view', 'stock_counts.manage'], icon: ICONS.clipboard },
      {
        label: 'Lots & seuils', key: 'stockExtra', icon: ICONS.box,
        children: [
          { label: 'Lots de stock',       path: '/stock/lots',                  anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: 'Seuils de stock',     path: '/stock/thresholds',            anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
        ],
      },
    ],
  },
  {
    title: 'Achats & Fournisseurs',
    items: [
      { label: 'Fournisseurs',            path: '/purchasing/suppliers',        anyPermissions: ['suppliers.view'], icon: ICONS.supplier },
      { label: 'Bons de commande',        path: '/purchasing/purchase-orders',  anyPermissions: ['purchase_orders.view'], icon: ICONS.po },
    ],
  },
  {
    title: 'Offres',
    items: [
      { label: 'Packs / Bundles',         path: '/offres/packs',                anyPermissions: ['packs.view', ...ANY], icon: ICONS.box },
      { label: 'Flash Sales',             path: '/offres/flash-sales',          anyPermissions: ['flash_sales.view', 'flash_sales.manage', ...ANY], icon: ICONS.offers },
      { label: 'Codes Promo',             path: '/offres/codes-promo',          anyPermissions: ['coupons.view', 'coupons.manage', ...ANY], icon: ICONS.ticket },
      { label: 'Gamification',            path: '/offres/gamification',         anyPermissions: ['games.view', 'games.manage'], icon: ICONS.gift },
      { label: 'Point Exchange',          path: '/offres/points-exchange',      anyPermissions: ['points_exchange.view', 'points_exchange.manage'], icon: ICONS.exchange },
      { label: 'Configuration des points', path: '/offres/points',              anyPermissions: ['points_rules.view', 'points_rules.manage', 'points_ledger.view'], icon: ICONS.star },
      { label: 'Parrainage',              path: '/offres/parrainage',           anyPermissions: ['referrals.view', 'referrals.manage'], icon: ICONS.share },
      { label: 'Autres promotions',       path: '/offres/promotions',           anyPermissions: ['flash_sales.view', 'flash_sales.manage', ...ANY], icon: ICONS.percent },
    ],
  },
  {
    title: 'Clients',
    items: [
      { label: 'Annuaire Clients',        path: '/customers',                   anyPermissions: ['customers.view', ...ANY], icon: ICONS.customers },
    ],
  },
  {
    title: 'Utilisateurs Internes',
    items: [
      { label: 'Pickers',                 path: '/staff/pickers',               anyPermissions: ['pickers.read', ...ANY], icon: ICONS.staff },
      { label: 'Drivers',                 path: '/staff/drivers',               anyPermissions: ['drivers.read', ...ANY], icon: ICONS.delivery },
    ],
  },
  {
    title: 'Entrepôt',
    items: [
      { label: 'Emplacements & Mapping',  path: '/warehouse',                   exact: true, permission: 'warehouse.view', icon: ICONS.warehouse },
      {
        label: 'Structure entrepôt', key: 'warehouseRef', icon: ICONS.gear,
        children: [
          { label: 'Zones de stockage',   path: '/warehouse/zones',             anyPermissions: ['warehouse.manage', ...ANY] },
          { label: 'Niveaux de rayonnage', path: '/warehouse/levels',           anyPermissions: ['warehouse.manage', ...ANY] },
        ],
      },
    ],
  },
  {
    title: 'Admin / Configuration',
    items: [
      {
        label: 'Rôles & Permissions', key: 'access', icon: ICONS.access,
        children: [
          { label: 'Rôles',                    path: '/access/roles',            permission: 'roles.view' },
          { label: 'Permissions',              path: '/access/permissions',      permission: 'permissions.view' },
          { label: 'Permissions par rôle',     path: '/access/role-permissions', permission: 'permissions.assign' },
        ],
      },
      { label: 'Comptes Back-Office',     path: '/users',                       permission: 'users.view', icon: ICONS.users },
      { label: 'App Configs & Méthodes de paiement', path: '/admin/settings', anyPermissions: ['app_configs.view', 'app_configs.manage'], icon: ICONS.sliders },
      { label: 'Log & Audit',             path: '/admin/audit',                 anyPermissions: ['audit_logs.view', 'notifications.view'], icon: ICONS.log },
      {
        label: 'Lookups', key: 'lookups', icon: ICONS.gear,
        children: [
          { label: 'Configuration par node', path: '/orders/node-config',        anyPermissions: ANY },
          { label: 'Statuts commande',       path: '/orders/statuses',           anyPermissions: ANY },
          { label: 'Statuts ligne commande', path: '/orders/item-statuses',      anyPermissions: ANY },
          { label: 'Statuts créneaux',       path: '/orders/slot-statuses',      anyPermissions: ANY },
          { label: 'Statuts picking',        path: '/picking/statuses',          anyPermissions: ANY },
          { label: 'Statuts articles picking', path: '/picking/item-statuses',   anyPermissions: ANY },
          { label: 'Types de livraison',     path: '/delivery/types',            anyPermissions: ANY },
          { label: 'Statuts paiement',       path: '/payment/statuses',          anyPermissions: ANY },
          { label: 'Méthodes de paiement',   path: '/payment/methods',           anyPermissions: ANY },
          { label: 'Types de mouvement',     path: '/stock/move-types',          anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: 'Statuts de stock',       path: '/stock/stock-statuses',      anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: "Types d'inventaire",     path: '/stock/inventory-types',     anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: 'Statuts inventaire',     path: '/stock/inventory-statuses',  anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: "Types d'écarts",         path: '/stock/inventory-gap-types', anyPermissions: ['stock.manage', 'stock.view', ...ANY] },
          { label: 'Types de nodes',         path: '/node-types',                anyPermissions: ['node_types.view', ...ANY] },
          { label: 'Références catalogue',   path: '/catalog/refs',              anyPermissions: ['brands.view', 'units.view', 'taxes.view', 'packaging_types.view', 'conservation_types.view'] },
          { label: 'Types de transactions wallet', path: '/wallet/txn-types',    anyPermissions: ANY },
        ],
      },
      // « Référentiel données » (tables P0) est injecté ici dynamiquement.
    ],
  },
];

const isPathActive = (pathname, path, exact) =>
  exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

function SingleLink({ item, active }) {
  return (
    <NavLink
      to={item.path}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
        active ? 'bg-red-600 text-white shadow-sm shadow-red-200' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      <Icon d={item.icon} className={`w-[18px] h-[18px] ${active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function Group({ item, links, pathname, open, onToggle, scrollable }) {
  const active = links.some((c) => isPathActive(pathname, c.path, c.exact));
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
          active ? 'text-red-700 bg-red-50' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
      >
        <Icon d={item.icon} className={`w-[18px] h-[18px] ${active ? 'text-red-600' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
        <span className="flex-1 text-left truncate">{item.label}</span>
        <Icon d={ICONS.chevron} className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className={`mt-1 mb-1 ml-[21px] pl-3 border-l border-zinc-200 space-y-0.5 ${
          scrollable ? 'max-h-[min(60vh,22rem)] overflow-y-auto pr-1' : ''
        }`}>
          {links.map((child) => {
            const childActive = isPathActive(pathname, child.path, child.exact);
            return (
              <li key={child.path}>
                <NavLink
                  to={child.path}
                  title={child.title ?? child.label}
                  className={`relative block pl-3 pr-2 py-1.5 rounded-md text-xs transition-colors truncate ${
                    childActive
                      ? 'text-red-700 font-semibold bg-red-50 before:absolute before:left-[-13px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-full before:bg-red-600'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  {child.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { hasPermission, user } = useAuth();
  const [openGroups, setOpenGroups] = useState({});
  const [p0Children, setP0Children] = useState([]);

  useEffect(() => {
    if (!hasPermission('dashboard.view')) { setP0Children([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await getP0Registry();
        const groups = res.data?.data?.groups ?? [];
        const kids = [];
        for (const g of groups) {
          for (const t of g.tables || []) {
            kids.push({ label: t.labelFr || t.sql, path: `/p0/tables/${encodeURIComponent(t.sql)}`, permission: 'dashboard.view', title: `${t.sql} - ${t.model}` });
          }
        }
        if (!cancelled) setP0Children(kids);
      } catch { if (!cancelled) setP0Children([]); }
    })();
    return () => { cancelled = true; };
  }, [hasPermission]);

  const canSee = (c) => (c.anyPermissions ? c.anyPermissions.some((p) => hasPermission(p)) : hasPermission(c.permission));

  // Sections visibles : filtre par permission, injection du référentiel P0.
  const sections = useMemo(() => {
    return SECTIONS.map((section) => {
      const items = section.items.flatMap((item) => {
        if (!item.children) return canSee(item) ? [item] : [];
        const children = item.children.filter(canSee);
        return children.length ? [{ ...item, children }] : [];
      });
      if (section.title === 'Admin / Configuration' && p0Children.length) {
        items.push({ label: 'Référentiel données', key: 'p0tables', icon: ICONS.tables, children: p0Children, scrollable: true });
      }
      return { ...section, items };
    }).filter((s) => s.items.length);
  }, [hasPermission, p0Children]);

  // Ouvre automatiquement le groupe qui contient la page courante.
  useEffect(() => {
    for (const s of sections) {
      for (const item of s.items) {
        if (item.children?.some((c) => isPathActive(pathname, c.path, c.exact))) {
          setOpenGroups((p) => (p[item.key] ? p : { ...p, [item.key]: true }));
        }
      }
    }
  }, [pathname, sections]);

  const toggle = (key) => setOpenGroups((p) => ({ ...p, [key]: !p[key] }));

  const initials = user?.full_name?.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const roleName = user?.roles?.[0]?.name;

  return (
    <aside className="w-64 h-screen sticky top-0 bg-white flex flex-col flex-shrink-0 border-r border-zinc-200">
      {/* Marque */}
      <div className="px-4 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-[18px] h-[18px] text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17 20a2 2 0 100-4 2 2 0 000 4zM9 20a2 2 0 100-4 2 2 0 000 4zM1 1h3l2.68 12.39a2 2 0 002 1.61h9.72a2 2 0 002-1.94l1.38-7.06H6" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-zinc-900 font-bold text-[15px] leading-tight tracking-tight truncate">El Herri</h1>
            <p className="text-zinc-400 text-[11px] font-medium">Management Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin] [scrollbar-color:#e4e4e7_transparent]">
        {sections.map((section, idx) => (
          <div key={section.title ?? 'top'} className={idx > 0 ? 'mt-5' : ''}>
            {section.title && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) =>
                item.children ? (
                  <Group
                    key={item.key}
                    item={item}
                    links={item.children}
                    pathname={pathname}
                    open={!!openGroups[item.key]}
                    onToggle={() => toggle(item.key)}
                    scrollable={item.scrollable}
                  />
                ) : (
                  <SingleLink key={item.path} item={item} active={isPathActive(pathname, item.path, item.exact)} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Utilisateur */}
      <div className="px-3 py-3 border-t border-zinc-100">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
            <span className="text-red-600 text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-zinc-800 text-xs font-semibold truncate">{user?.full_name}</p>
            <p className="text-zinc-400 text-[11px] truncate">{roleName || user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
