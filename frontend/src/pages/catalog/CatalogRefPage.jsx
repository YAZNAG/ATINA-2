import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

function imgSrc(p) {
  if (!p || !String(p).trim()) return null;
  const s = String(p).trim();
  return s.startsWith('http') ? s : s.startsWith('/') ? s : `/${s}`;
}

const STS = [{ v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }];

// ── entity configs ────────────────────────────────────────────────────────────

const ENTITIES = [
  {
    key: 'brands', label: 'Marques', hasStatus: true,
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    thumb: (r) => imgSrc(r.logo),
    accentChar: 'M',
    api: { list: (p) => catalog.getBrands(p), create: (d) => catalog.createBrand(d), update: (id, d) => catalog.updateBrand(id, d), remove: (id) => catalog.deleteBrand(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', dir: 'rtl' },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    fileField: 'logo',
    buildPayload: (form, file) => {
      const fd = new FormData();
      ['name_fr', 'name_ar', 'code', 'description_fr', 'description_ar', 'status'].forEach((k) => {
        if (form[k] !== '' && form[k] != null) fd.append(k, form[k]);
      });
      if (file) fd.append('logo', file);
      return fd;
    },
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Description', value: r.description_fr },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => r.code,
  },
  {
    key: 'units', label: 'Unités', hasStatus: true,
    icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    thumb: null,
    accentChar: 'U',
    api: { list: (p) => catalog.getUnits(p), create: (d) => catalog.createUnit(d), update: (id, d) => catalog.updateUnit(id, d), remove: (id) => catalog.deleteUnit(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'short_name_fr', label: 'Symbole (FR)' },
      { name: 'short_name_ar', label: 'Symbole (AR)', dir: 'rtl' },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    buildPayload: (form) => ({ ...form }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Symbole (FR)', value: r.short_name_fr },
      { label: 'Symbole (AR)', value: r.short_name_ar, dir: 'rtl' },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => r.short_name_fr || r.code,
  },
  {
    key: 'article-types', label: "Types d'article", hasStatus: true,
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    thumb: null,
    accentChar: 'T',
    api: { list: (p) => catalog.getArticleTypes(p), create: (d) => catalog.createArticleType(d), update: (id, d) => catalog.updateArticleType(id, d), remove: (id) => catalog.deleteArticleType(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', dir: 'rtl' },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    buildPayload: (form) => ({ ...form }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Description', value: r.description_fr },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => r.code,
  },
  {
    key: 'article-statuses', label: 'Statuts article', hasStatus: false,
    icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
    thumb: null,
    accentChar: 'S',
    colorField: 'color',
    api: { list: (p) => catalog.getArticleStatuses(p), create: (d) => catalog.createArticleStatus(d), update: (id, d) => catalog.updateArticleStatus(id, d), remove: (id) => catalog.deleteArticleStatus(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'color', label: 'Couleur', type: 'colorhex', placeholder: '#22c55e' },
    ],
    buildPayload: (form) => ({ ...form }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Couleur', value: r.color, colorSwatch: true },
    ],
    cardSub: (r) => r.code,
  },
  {
    key: 'taxes', label: 'TVA', hasStatus: true,
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    thumb: null,
    accentChar: '%',
    api: { list: (p) => catalog.getTaxes(p), create: (d) => catalog.createTax(d), update: (id, d) => catalog.updateTax(id, d), remove: (id) => catalog.deleteTax(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'rate', label: 'Taux (%)', type: 'number', req: true, step: '0.01', min: '0' },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    buildPayload: (form) => ({ ...form, rate: form.rate !== '' ? parseFloat(form.rate) : null }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Taux', value: r.rate != null ? `${r.rate}%` : null },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => r.rate != null ? `${r.rate}%` : r.code,
  },
  {
    key: 'packaging-types', label: 'Conditionnements', hasStatus: true,
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    thumb: null,
    accentChar: 'C',
    api: { list: (p) => catalog.getPackagingTypes(p), create: (d) => catalog.createPackagingType(d), update: (id, d) => catalog.updatePackagingType(id, d), remove: (id) => catalog.deletePackagingType(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'quantity', label: 'Quantité', type: 'number', min: '0' },
      { name: 'unit_id', label: 'Unité', type: 'select', loadOptions: async () => (await catalog.getUnitsList()).data.data ?? [], optLabel: (o) => `${o.name_fr} (${o.code})` },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    buildPayload: (form) => ({ ...form, quantity: form.quantity !== '' ? Number(form.quantity) : null, unit_id: form.unit_id || null }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'Quantité', value: r.quantity },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => r.quantity != null ? `Qté: ${r.quantity}` : r.code,
  },
  {
    key: 'conservation-types', label: 'Conservations', hasStatus: true,
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    thumb: null,
    accentChar: '°',
    api: { list: (p) => catalog.getConservationTypes(p), create: (d) => catalog.createConservationType(d), update: (id, d) => catalog.updateConservationType(id, d), remove: (id) => catalog.deleteConservationType(id) },
    fields: [
      { name: 'name_fr', label: 'Nom (FR)', req: true },
      { name: 'name_ar', label: 'Nom (AR)', dir: 'rtl' },
      { name: 'code', label: 'Code', req: true },
      { name: 'min_temperature', label: 'Température min (°C)', type: 'number' },
      { name: 'max_temperature', label: 'Température max (°C)', type: 'number' },
      { name: 'status', label: 'Statut', type: 'select', opts: STS },
    ],
    buildPayload: (form) => ({
      ...form,
      min_temperature: form.min_temperature !== '' ? Number(form.min_temperature) : null,
      max_temperature: form.max_temperature !== '' ? Number(form.max_temperature) : null,
    }),
    detailRows: (r) => [
      { label: 'Nom (AR)', value: r.name_ar, dir: 'rtl' },
      { label: 'Code', value: r.code, mono: true },
      { label: 'T° min', value: r.min_temperature != null ? `${r.min_temperature}°C` : null },
      { label: 'T° max', value: r.max_temperature != null ? `${r.max_temperature}°C` : null },
      { label: 'Statut', value: r.status, badge: true },
    ],
    cardSub: (r) => {
      if (r.min_temperature != null && r.max_temperature != null) return `${r.min_temperature}°C → ${r.max_temperature}°C`;
      return r.code;
    },
  },
];

// ── UI primitives ─────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const sel = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700';
const ta = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300 resize-none';

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

// ── Card Thumb ────────────────────────────────────────────────────────────────

function CardThumb({ entity, item }) {
  const [imgErr, setImgErr] = useState(false);
  const src = entity.thumb?.(item);

  if (entity.colorField && item[entity.colorField]) {
    return (
      <div
        className="w-14 h-14 rounded-2xl flex-shrink-0 shadow-sm border-2 border-white ring-2 ring-gray-100"
        style={{ backgroundColor: item[entity.colorField] }}
      />
    );
  }

  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={item.name_fr}
        onError={() => setImgErr(true)}
        className="w-14 h-14 rounded-2xl object-contain bg-white border border-gray-100 flex-shrink-0 shadow-sm p-1"
      />
    );
  }

  return (
    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center flex-shrink-0 shadow-sm">
      <span className="text-white font-bold text-xl">{entity.accentChar}</span>
    </div>
  );
}

// ── RefCard ───────────────────────────────────────────────────────────────────

function RefCard({ entity, item, onView, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <CardThumb entity={entity} item={item} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{item.name_fr}</h3>
            {item.name_ar && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{item.name_ar}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {item.code && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                  {item.code}
                </span>
              )}
              {entity.hasStatus && item.status && <StatusBadge status={item.status} />}
            </div>
          </div>
        </div>

        {entity.cardSub && (
          <p className="text-xs text-gray-400 font-medium truncate">
            {entity.cardSub(item)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => onView(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Détails
        </button>
        <button
          onClick={() => onEdit(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Modifier
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Suppr.
        </button>
      </div>
    </div>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ entity, item, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-500 rounded-t-2xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={entity.icon} />
              </svg>
            </div>
            <div>
              <p className="text-red-200 text-[11px] font-semibold uppercase tracking-widest">{entity.label}</p>
              <p className="text-white font-bold text-base leading-tight">{item.name_fr}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Logo / color preview */}
        {(entity.thumb?.(item) || entity.colorField) && (
          <div className="flex justify-center pt-6 pb-2">
            <CardThumb entity={entity} item={item} />
          </div>
        )}

        {/* Detail rows */}
        <div className="px-6 py-4 space-y-0">
          {entity.detailRows(item).map((row, i) => {
            const v = row.value;
            const isEmpty = v == null || v === '';
            return (
              <div key={i} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 min-w-[110px]">
                  {row.label}
                </span>
                <div className="text-right">
                  {isEmpty ? (
                    <span className="text-gray-300 text-sm">—</span>
                  ) : row.colorSwatch ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: v }} />
                      <span className="text-sm font-mono text-gray-700">{v}</span>
                    </div>
                  ) : row.badge ? (
                    <StatusBadge status={v} />
                  ) : (
                    <span className={`text-sm text-gray-800 ${row.mono ? 'font-mono' : ''}`} dir={row.dir}>
                      {String(v)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={() => { onClose(); onEdit(item); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
          >
            Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Supprimer</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">{item?.name_fr}</span> sera supprimé définitivement.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function buildEmpty(entity) {
  const f = {};
  for (const field of entity.fields) {
    if (field.type === 'select' && field.opts) f[field.name] = field.opts[0]?.v ?? '';
    else if (field.type === 'number') f[field.name] = '';
    else f[field.name] = '';
  }
  return f;
}

function RefDrawer({ entity, editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [dynOptions, setDynOptions] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    setFile(null);
    setFilePreview(null);
    if (fileRef.current) { URL.revokeObjectURL(fileRef.current); fileRef.current = null; }

    if (editItem) {
      const f = {};
      for (const field of entity.fields) {
        const v = editItem[field.name];
        f[field.name] = (v != null ? String(v) : '') ;
      }
      setForm(f);
    } else {
      setForm(buildEmpty(entity));
    }

    // Load dynamic select options
    const loadDyn = async () => {
      const opts = {};
      for (const field of entity.fields) {
        if (field.loadOptions) {
          try { opts[field.name] = await field.loadOptions(); } catch { opts[field.name] = []; }
        }
      }
      setDynOptions(opts);
    };
    loadDyn();
  }, [entity, editItem]);

  useEffect(() => () => {
    if (fileRef.current) URL.revokeObjectURL(fileRef.current);
  }, []);

  const hc = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0] ?? null;
    if (fileRef.current) { URL.revokeObjectURL(fileRef.current); fileRef.current = null; }
    setFile(f);
    if (f) { const u = URL.createObjectURL(f); fileRef.current = u; setFilePreview(u); }
    else setFilePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = entity.buildPayload(form, file);
      if (isEdit) await entity.api.update(editItem.id, payload);
      else await entity.api.create(payload);
      toast.success(isEdit ? 'Mis à jour' : 'Créé avec succès');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field) => {
    if (field.type === 'textarea') {
      return (
        <Fld key={field.name} label={field.label} req={field.req}>
          <textarea name={field.name} className={ta} rows={2} value={form[field.name] ?? ''} onChange={hc} dir={field.dir} placeholder={field.placeholder} />
        </Fld>
      );
    }
    if (field.type === 'select' && field.opts) {
      return (
        <Fld key={field.name} label={field.label} req={field.req}>
          <select name={field.name} className={sel} value={form[field.name] ?? ''} onChange={hc}>
            {field.opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </Fld>
      );
    }
    if (field.type === 'select' && field.loadOptions) {
      const opts = dynOptions[field.name] ?? [];
      return (
        <Fld key={field.name} label={field.label} req={field.req}>
          <select name={field.name} className={sel} value={form[field.name] ?? ''} onChange={hc}>
            <option value="">— Choisir —</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{field.optLabel(o)}</option>)}
          </select>
        </Fld>
      );
    }
    if (field.type === 'colorhex') {
      return (
        <Fld key={field.name} label={field.label} req={field.req}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form[field.name] || '#ef4444'}
              onChange={(e) => setForm((f) => ({ ...f, [field.name]: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              name={field.name}
              type="text"
              className={`${inp} flex-1`}
              value={form[field.name] ?? ''}
              onChange={hc}
              placeholder={field.placeholder ?? '#000000'}
            />
          </div>
        </Fld>
      );
    }
    return (
      <Fld key={field.name} label={field.label} req={field.req}>
        <input
          name={field.name}
          type={field.type === 'number' ? 'number' : 'text'}
          step={field.step}
          min={field.min}
          className={inp}
          value={form[field.name] ?? ''}
          onChange={hc}
          required={field.req}
          dir={field.dir}
          placeholder={field.placeholder}
        />
      </Fld>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-red-700 to-red-500">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={entity.icon} />
              </svg>
            </div>
            <div>
              <p className="text-red-200 text-[11px] font-semibold uppercase tracking-widest">
                {isEdit ? 'Modifier' : 'Nouveau'}
              </p>
              <h2 className="text-white font-bold text-lg leading-tight">{entity.label}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="ref-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {entity.fields.map((f) => renderField(f))}

          {/* File upload for brands */}
          {entity.fileField && (
            <Fld label="Logo">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center flex-shrink-0 overflow-hidden transition-colors ${filePreview || (editItem && entity.thumb(editItem)) ? 'border-transparent' : 'border-gray-200 group-hover:border-red-300 group-hover:bg-red-50'}`}>
                  {filePreview ? (
                    <img src={filePreview} alt="" className="w-full h-full object-contain rounded-xl" />
                  ) : editItem && entity.thumb(editItem) ? (
                    <img src={entity.thumb(editItem)} alt="" className="w-full h-full object-contain p-1 rounded-xl" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-500 group-hover:text-red-600 transition-colors">Choisir un fichier image…</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </Fld>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button type="submit" form="ref-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl transition-colors">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main shell (réutilisable : catalogue + types livraison, etc.) ─────────────

export function CatalogRefShell({
  entities = ENTITIES,
  defaultEntityKey = 'brands',
  pageTitle = 'Référentiels catalogue',
  pageSubtitle = 'Marques, unités, types et paramètres',
  showEntityTabs = true,
}) {
  const entityMap = useMemo(() => Object.fromEntries(entities.map((e) => [e.key, e])), [entities]);
  const [activeKey, setActiveKey] = useState(defaultEntityKey);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (entityMap[activeKey]) return;
    const k = entities[0]?.key;
    if (k) setActiveKey(k);
  }, [activeKey, entities, entityMap]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const entity = entityMap[activeKey];

  const load = useCallback(async () => {
    if (!entity) return;
    setLoading(true);
    try {
      const res = await entity.api.list({ all: true });
      setRows(res.data.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    setRows([]);
    setSearch('');
    setSearchInput('');
    setStatusFilter('all');
  }, [activeKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await entity.api.remove(deleting.id);
      toast.success('Supprimé');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!entity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Référentiel indisponible.
      </div>
    );
  }

  // Client-side filter
  const q = search.toLowerCase();
  const filtered = rows.filter((r) => {
    if (entity.hasStatus && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q && !(r.name_fr ?? '').toLowerCase().includes(q) && !(r.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {detail && (
        <DetailModal
          entity={entity}
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={(item) => { setDetail(null); setDrawer({ editItem: item }); }}
        />
      )}
      {deleting && (
        <DeleteModal
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
      {drawer && (
        <RefDrawer
          entity={entity}
          editItem={drawer.editItem}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          {/* Top */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <nav className="text-xs text-gray-400 mb-1.5">
                <Link to="/dashboard" className="hover:text-gray-600">Accueil</Link>
                <span className="text-gray-300 mx-1.5">/</span>
                <span className="text-red-600 font-semibold">{pageTitle}</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{pageSubtitle}</p>
            </div>
            <button
              onClick={() => setDrawer({ editItem: null })}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter
            </button>
          </div>

          {/* Entity tabs — horizontal scroll */}
          {showEntityTabs && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            {entities.map((e) => (
              <button
                key={e.key}
                onClick={() => setActiveKey(e.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  activeKey === e.key
                    ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={e.icon} />
                </svg>
                {e.label}
              </button>
            ))}
          </div>
          )}

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status filter */}
            {entity.hasStatus && (
              <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                {[
                  { v: 'all', l: 'Tous' },
                  { v: 'active', l: 'Actif' },
                  { v: 'inactive', l: 'Inactif' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setStatusFilter(opt.v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === opt.v
                        ? 'bg-white text-red-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <form
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 flex-1 min-w-0 max-w-xs"
            >
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0">
                Go
              </button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="px-2.5 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">
                  ✕
                </button>
              )}
            </form>

            <span className="text-xs text-gray-400 ml-auto">{filtered.length} élément{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={entity.icon} />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun élément</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || statusFilter !== 'all'
                  ? 'Essayez de modifier vos filtres.'
                  : 'Cliquez sur « Ajouter » pour créer le premier.'}
              </p>
            </div>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + Créer le premier
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <RefCard
                key={item.id}
                entity={entity}
                item={item}
                onView={(it) => setDetail(it)}
                onEdit={(it) => setDrawer({ editItem: it })}
                onDelete={(it) => setDeleting(it)}
              />
            ))}
            {/* Add new tile */}
            <button
              onClick={() => setDrawer({ editItem: null })}
              className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 transition-all flex flex-col items-center justify-center gap-3 p-8 text-red-400 hover:text-red-600 min-h-[160px]"
            >
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Ajouter</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CatalogRefPage() {
  return (
    <CatalogRefShell
      entities={ENTITIES}
      defaultEntityKey="brands"
      pageTitle="Référentiels catalogue"
      pageSubtitle="Marques, unités, types et paramètres"
      showEntityTabs
    />
  );
}
