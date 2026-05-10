import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCustomers, blockCustomer, unblockCustomer, deleteCustomer } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  plus:     'M12 4v16m8-8H4',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  eye:      'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  edit:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  pin:      'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  lock:     'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock:   'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  trash:    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check:    'M5 13l4 4L19 7',
  wallet:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  users:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

function StatusBadge({ c }) {
  if (c.is_deleted) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Supprimé</span>;
  if (!c.is_active)  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Bloqué</span>;
  return               <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif</span>;
}

const FILTERS_INIT = { search: '', city: '', preferred_lang: '', is_active: '', phone_verified: '', has_wallet_balance: '', scope: 'active' };

export default function CustomerList() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('customers.update') || hasPermission('dashboard.view');
  const canCreate = hasPermission('customers.create') || hasPermission('dashboard.view');
  const canDelete = hasPermission('customers.delete') || hasPermission('dashboard.view');

  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({});
  const [filters, setFilters] = useState(FILTERS_INIT);
  const [searchInput, setSearchInput] = useState('');
  const [applied, setApplied] = useState(FILTERS_INIT);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, verified: 0, wallet: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (applied.scope === 'deleted') params.is_deleted = 'true';
      else if (applied.scope !== 'all') params.is_deleted = 'false';
      else params.is_deleted = 'all';
      if (applied.search)           params.search        = applied.search;
      if (applied.city)             params.city          = applied.city;
      if (applied.preferred_lang)   params.preferred_lang = applied.preferred_lang;
      if (applied.is_active)        params.is_active      = applied.is_active;
      if (applied.phone_verified)   params.phone_verified = applied.phone_verified;
      if (applied.has_wallet_balance) params.has_wallet_balance = 'true';

      const res = await getCustomers(params);
      const d = res.data?.data;
      setItems(d?.items ?? []);
      const pg = d?.pagination;
      if (pg) { setTotal(pg.total ?? 0); setTotalPages(pg.totalPages ?? 0); }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, applied]);

  // Load stats once on mount
  const loadStats = useCallback(async () => {
    try {
      const [all, active, blocked, verified, wallet] = await Promise.all([
        getCustomers({ limit: 1, is_deleted: 'false' }),
        getCustomers({ limit: 1, is_deleted: 'false', is_active: 'true' }),
        getCustomers({ limit: 1, is_deleted: 'false', is_active: 'false' }),
        getCustomers({ limit: 1, is_deleted: 'false', phone_verified: 'true' }),
        getCustomers({ limit: 1, is_deleted: 'false', has_wallet_balance: 'true' }),
      ]);
      setStats({
        total:    all.data?.data?.pagination?.total    ?? 0,
        active:   active.data?.data?.pagination?.total ?? 0,
        blocked:  blocked.data?.data?.pagination?.total ?? 0,
        verified: verified.data?.data?.pagination?.total ?? 0,
        wallet:   wallet.data?.data?.pagination?.total ?? 0,
      });
    } catch { /* ignore stats errors */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const applySearch = (e) => {
    e?.preventDefault();
    setApplied(a => ({ ...a, search: searchInput.trim() }));
    setPage(1);
  };

  const patchFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setApplied(a => ({ ...a, [key]: val }));
    setPage(1);
  };

  const reset = () => { setFilters(FILTERS_INIT); setApplied(FILTERS_INIT); setSearchInput(''); setPage(1); };

  const act = async (id, fn, successMsg) => {
    setActing(a => ({ ...a, [id]: true }));
    try { await fn(id); toast.success(successMsg); load(); loadStats(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(a => ({ ...a, [id]: false })); }
  };

  const STAT_CARDS = [
    { label: 'Total',    value: stats.total,    color: 'bg-gray-50 border-gray-200 text-gray-700'        },
    { label: 'Actifs',   value: stats.active,   color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Bloqués',  value: stats.blocked,  color: 'bg-amber-50 border-amber-200 text-amber-700'      },
    { label: 'OTP ✓',   value: stats.verified, color: 'bg-blue-50 border-blue-200 text-blue-700'          },
    { label: 'Wallet>0', value: stats.wallet,   color: 'bg-violet-50 border-violet-200 text-violet-700'   },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
              <p className="text-sm text-gray-400 mt-0.5">Gestion des clients application mobile</p>
            </div>
            {canCreate && (
              <button onClick={() => navigate('/customers/new')}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau client
              </button>
            )}
          </div>

          {/* Scope + search */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{v:'active',l:'Actifs'},{v:'deleted',l:'Supprimés'},{v:'all',l:'Tous'}].map(o => (
                <button key={o.v} onClick={() => patchFilter('scope', o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${filters.scope === o.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <form onSubmit={applySearch} className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Nom, téléphone, code parrainage…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
              </div>
              <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">Go</button>
              {applied.search && <button type="button" onClick={() => { setSearchInput(''); setApplied(a => ({ ...a, search: '' })); setPage(1); }} className="px-2 py-2 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50">✕</button>}
            </form>
            <span className="text-xs text-gray-400 ml-auto">{total} client{total !== 1 ? 's' : ''}</span>
          </div>

          {/* Inline filters */}
          <div className="flex flex-wrap gap-2 items-end">
            {[
              { key: 'is_active',         label: 'Statut',    opts: [{v:'',l:'Tous'},{v:'true',l:'Actif'},{v:'false',l:'Bloqué'}] },
              { key: 'preferred_lang',    label: 'Langue',    opts: [{v:'',l:'Toutes'},{v:'fr',l:'FR'},{v:'ar',l:'AR'}] },
              { key: 'phone_verified',    label: 'OTP',       opts: [{v:'',l:'—'},{v:'true',l:'Vérifié'},{v:'false',l:'Non vérifié'}] },
              { key: 'has_wallet_balance',label: 'Wallet',    opts: [{v:'',l:'Tous'},{v:'true',l:'> 0'}] },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{f.label}</label>
                <select value={filters[f.key]} onChange={e => patchFilter(f.key, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white">
                  {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Ville</label>
              <input value={filters.city} onChange={e => patchFilter('city', e.target.value)}
                placeholder="Rabat…" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white w-28" />
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 mt-4">Réinitialiser</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex flex-wrap gap-3">
          {STAT_CARDS.map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <Icon d={SVG.users} className="w-10 h-10 text-red-200" />
            </div>
            <p className="text-gray-600 font-semibold">Aucun client</p>
            <p className="text-gray-400 text-sm">Modifiez les filtres ou créez un premier client</p>
            {canCreate && (
              <button onClick={() => navigate('/customers/new')} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Icon d={SVG.plus} className="w-4 h-4" />Créer un client
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Téléphone</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">OTP</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Langue</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ville</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Wallet</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Créé le</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(c => {
                    const initial = (c.name || '?').charAt(0).toUpperCase();
                    const isActing = acting[c.id];
                    return (
                      <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors group ${c.is_deleted ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                              c.is_deleted ? 'bg-gray-400' : c.is_active ? 'bg-gradient-to-br from-red-600 to-red-500' : 'bg-amber-500'
                            }`}>{initial}</div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                              <p className="text-[11px] font-mono text-gray-400 truncate">{c.referral_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-700">{c.phone_country} {c.phone_number}</td>
                        <td className="px-4 py-3.5 text-center">
                          {c.phone_verified_at
                            ? <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-100 mx-auto"><Icon d={SVG.check} className="w-3 h-3 text-emerald-600" /></span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{c.preferred_lang}</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs">{c.city || '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-xs font-bold ${Number(c.wallet_balance) > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
                            {Number(c.wallet_balance).toFixed(2)} <span className="font-normal">DH</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-xs font-bold ${c.points_balance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{c.points_balance}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge c={c} /></td>
                        <td className="px-4 py-3.5 text-right text-xs text-gray-400">{formatDate(c.created_at)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link to={`/customers/${c.id}`} title="Voir détails"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                              <Icon d={SVG.eye} className="w-4 h-4" />
                            </Link>
                            {canUpdate && !c.is_deleted && (
                              <Link to={`/customers/${c.id}/edit`} title="Modifier"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg">
                                <Icon d={SVG.edit} className="w-4 h-4" />
                              </Link>
                            )}
                            <Link to={`/customers/${c.id}/addresses`} title="Adresses"
                              className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg">
                              <Icon d={SVG.pin} className="w-4 h-4" />
                            </Link>
                            {canUpdate && !c.is_deleted && (
                              c.is_active
                                ? <button disabled={isActing} title="Bloquer" onClick={() => act(c.id, blockCustomer, 'Client bloqué')} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-40">
                                    <Icon d={SVG.lock} className="w-4 h-4" />
                                  </button>
                                : <button disabled={isActing} title="Débloquer" onClick={() => act(c.id, unblockCustomer, 'Client débloqué')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-40">
                                    <Icon d={SVG.unlock} className="w-4 h-4" />
                                  </button>
                            )}
                            {canDelete && !c.is_deleted && (
                              <button disabled={isActing} title="Supprimer"
                                onClick={() => { if (window.confirm(`Supprimer « ${c.name} » ?`)) act(c.id, deleteCustomer, 'Client supprimé'); }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40">
                                <Icon d={SVG.trash} className="w-4 h-4" />
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">Page {page} / {totalPages} · {total} clients</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Précédent</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={pg} onClick={() => setPage(pg)} className={`px-3 py-1.5 text-xs rounded-lg border ${page === pg ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 hover:bg-gray-50'}`}>{pg}</button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Suivant →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
