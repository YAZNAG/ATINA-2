import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getCheckoutMeta, searchArticles, searchCustomers,
  getCustomerAddresses, getEligibleNodes, getAvailableDates,
  getDeliverySlots, calculateCart, createOrder,
} from '../../api/checkout.api';

// ── Icônes SVG ────────────────────────────────────────────────────────────────
const SVG = {
  home:   'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  store:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  pin:    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  card:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  cart:   'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check:  'M5 13l4 4L19 7',
  warn:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  user:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

// ── Stepper — 5 étapes dans le bon ordre ──────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Client' },
  { n: 2, label: 'Panier' },
  { n: 3, label: 'Livraison' },
  { n: 4, label: 'Paiement' },
  { n: 5, label: 'Confirmation' },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              current > s.n ? 'bg-emerald-600 border-emerald-600 text-white' :
              current === s.n ? 'bg-red-600 border-red-600 text-white' :
              'bg-white border-gray-300 text-gray-400'}`}>
              {current > s.n ? <Icon d={SVG.check} className="w-4 h-4" /> : s.n}
            </div>
            <p className={`text-[11px] font-semibold mt-1 whitespace-nowrap ${current === s.n ? 'text-red-600' : current > s.n ? 'text-emerald-600' : 'text-gray-400'}`}>{s.label}</p>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-5 ${current > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  );
}

function Card({ title, icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
            <Icon d={icon} className="w-4 h-4 text-red-600" />
          </div>
          <h2 className="font-bold text-gray-900">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Recherche article avec debounce ───────────────────────────────────────────
function ArticleSearchDropdown({ onSelect }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await searchArticles(query.trim(), 15);
        setResults(res.data?.data ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSelect = (a) => { onSelect(a); setQuery(''); setResults([]); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
        <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher par nom, SKU ou EAN…"
          className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.map(a => (
            <button key={a.id} type="button" onMouseDown={() => handleSelect(a)}
              className="w-full text-left px-4 py-3 hover:bg-red-50 border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.name_fr}</p>
                  <p className="text-[11px] font-mono text-gray-400">{a.sku_code} {!a.sku_uuid && '⚠ pas de SKU logistique'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold">{Number(a.price ?? 0).toFixed(2)} <span className="text-xs font-normal text-gray-500">MAD</span></p>
                  <p className="text-[10px] text-gray-400">TVA {a.vat_rate}%</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && !loading && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center text-sm text-gray-400">Aucun article trouvé</div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();

  // ── État global ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState({ delivery_types: [], payment_methods: [] });

  // Étape 1 — Client
  const [customerSearch,   setCustomerSearch]   = useState('');
  const [customerResults,  setCustomerResults]  = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addresses,        setAddresses]        = useState([]);
  const [selectedAddress,  setSelectedAddress]  = useState(null);

  // Étape 2 — Panier
  const [cartItems, setCartItems] = useState([]);
  const [notes,     setNotes]     = useState('');

  // Étape 3 — Livraison
  const [deliveryType,      setDeliveryType]     = useState(null);
  const [eligibleNodes,     setEligibleNodes]    = useState(null);
  const [selectedNode,      setSelectedNode]     = useState(null);
  const [availableDates,    setAvailableDates]   = useState([]);
  const [selectedDate,      setSelectedDate]     = useState('');
  const [slots,             setSlots]            = useState([]);
  const [selectedSlot,      setSelectedSlot]     = useState(null);
  const [loadingNodes,      setLoadingNodes]     = useState(false);
  const [loadingSlots,      setLoadingSlots]     = useState(false);

  // Étape 4 — Paiement
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [walletUsed,    setWalletUsed]    = useState(0);
  const [totals,        setTotals]        = useState(null);
  const [loadingTotals, setLoadingTotals] = useState(false);

  // Étape 5 — Résultat
  const [creating,      setCreating]      = useState(false);
  const [createdOrder,  setCreatedOrder]  = useState(null);

  // ── Chargement meta initial (sans node) ───────────────────────────────────
  useEffect(() => {
    getCheckoutMeta().then(r => setMeta(r.data?.data ?? {})).catch(() => {});
  }, []);

  // Rechargement meta avec node pour filtrer paiements
  const reloadMetaWithNode = useCallback(async (node_id) => {
    try {
      const r = await getCheckoutMeta(node_id);
      setMeta(r.data?.data ?? {});
    } catch { /* ignore */ }
  }, []);

  // ── Étape 1 — Recherche client ─────────────────────────────────────────────
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await searchCustomers(customerSearch);
        setCustomerResults(r.data?.data ?? []);
      } catch { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  const selectCustomer = async (c) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    try {
      const r = await getCustomerAddresses(c.id);
      const addrs = (r.data?.data ?? []).filter(a => !a.is_deleted);
      setAddresses(addrs);
      const def = addrs.find(a => a.is_default) ?? addrs[0] ?? null;
      setSelectedAddress(def);
    } catch { setAddresses([]); }
  };

  // ── Étape 2 — Panier ──────────────────────────────────────────────────────
  const addArticle = (a) => {
    if (!a.sku_uuid) { toast.error('Cet article n\'a pas de SKU logistique lié'); return; }
    setCartItems(prev => {
      const ex = prev.find(i => i.sku_id === a.sku_uuid);
      if (ex) return prev.map(i => i.sku_id === a.sku_uuid ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { sku_id: a.sku_uuid, sku_code: a.sku_code, name_fr: a.name_fr, qty: 1, unit_price: Number(a.price ?? 0), vat_rate: Number(a.vat_rate ?? 20) }];
    });
  };

  const updateQty   = (i, qty)   => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, Number(qty) || 1) } : it));
  const updatePrice = (i, price) => setCartItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: Number(price) || 0 } : it));
  const removeItem  = (i)        => setCartItems(prev => prev.filter((_, idx) => idx !== i));

  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const cartCount = cartItems.length;

  // ── Étape 3 — Livraison ───────────────────────────────────────────────────
  const selectDeliveryType = (dt) => {
    setDeliveryType(dt);
    setEligibleNodes(null);
    setSelectedNode(null);
    setAvailableDates([]);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlot(null);
  };

  const handleFindNodes = async () => {
    if (!deliveryType) return;
    setLoadingNodes(true);
    try {
      if (deliveryType.code === 'home') {
        if (!selectedAddress) { toast.error('Sélectionnez une adresse'); return; }
        const r = await getEligibleNodes({
          address_id:         selectedAddress.id,
          cart_items:         cartItems.map(i => ({ sku_id: i.sku_id, qty: i.qty })),
          delivery_type_code: 'home',
        });
        const data = r.data.data;
        setEligibleNodes(data);
        if (data?.best_node) {
          await selectNode(data.best_node);
        } else {
          toast.error('Aucun node éligible pour cette adresse');
        }
      } else {
        const r = await getEligibleNodes({
          cart_items:         cartItems.map(i => ({ sku_id: i.sku_id, qty: i.qty })),
          delivery_type_code: 'pickup',
        });
        const data = r.data.data;
        setEligibleNodes(data);
        if (data?.auto_selected) {
          await selectNode(data.auto_selected);
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur lors de la recherche des nodes');
    } finally {
      setLoadingNodes(false);
    }
  };

  const selectNode = async (n) => {
    setSelectedNode(n);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlot(null);
    await reloadMetaWithNode(n.id);
    // Charger les dates disponibles
    try {
      const r = await getAvailableDates({ node_id: n.id, delivery_type_code: deliveryType?.code ?? 'home', days_ahead: 14 });
      setAvailableDates(r.data.data ?? []);
    } catch { setAvailableDates([]); }
  };

  const handleDateSelect = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setSlots([]);
    if (!selectedNode || !deliveryType) return;
    setLoadingSlots(true);
    try {
      const params = { node_id: selectedNode.id, delivery_type_code: deliveryType.code, date: dateStr };
      if (deliveryType.code === 'home' && selectedAddress) params.address_id = selectedAddress.id;
      const r = await getDeliverySlots(params);
      setSlots(r.data.data?.slots ?? r.data.data?.all_slots ?? []);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur chargement créneaux');
    } finally {
      setLoadingSlots(false);
    }
  };

  // ── Étape 4 — Paiement ────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 4 && paymentMethod && selectedNode) handleCalculate();
  }, [step, paymentMethod, walletUsed]);

  const handleCalculate = async () => {
    setLoadingTotals(true);
    try {
      const r = await calculateCart({
        node_id:            selectedNode?.id,
        delivery_type_code: deliveryType?.code,
        cart_items:         cartItems.map(i => ({ sku_id: i.sku_id, qty: i.qty })),
        payment_method_code: paymentMethod?.code,
        wallet_used:        walletUsed,
        customer_id:        selectedCustomer?.id,
      });
      setTotals(r.data.data);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur de calcul');
    } finally {
      setLoadingTotals(false);
    }
  };

  const walletBalance = Number(selectedCustomer?.wallet_balance ?? 0);
  const isMethodDisabled = (pm) => {
    if (pm.code === 'wallet') return walletBalance <= 0;
    if (pm.code === 'cod' && pm.cod_max_amount > 0) return (totals?.total_ttc ?? cartTotal) > pm.cod_max_amount;
    return false;
  };
  const methodDisabledReason = (pm) => {
    if (pm.code === 'wallet' && walletBalance <= 0) return 'Wallet vide';
    if (pm.code === 'cod' && pm.cod_max_amount > 0 && (totals?.total_ttc ?? cartTotal) > pm.cod_max_amount)
      return `Total dépasse le max COD (${pm.cod_max_amount} MAD)`;
    return null;
  };

  // ── Créer la commande ─────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!selectedCustomer)  return toast.error('Client requis');
    if (cartCount === 0)    return toast.error('Panier vide');
    if (!selectedNode)      return toast.error('Node non sélectionné');
    if (!deliveryType)      return toast.error('Type de livraison requis');
    if (!paymentMethod)     return toast.error('Méthode de paiement requise');

    setCreating(true);
    try {
      const r = await createOrder({
        customer_id:        selectedCustomer.id,
        address_id:         selectedAddress?.id ?? null,
        delivery_type_code: deliveryType.code,
        node_id:            selectedNode.id,
        selected_slot_id:   selectedSlot?.id ?? null,
        payment_method_code: paymentMethod.code,
        cart_items:         cartItems.map(i => ({ sku_id: i.sku_id, qty: i.qty })),
        wallet_used:        walletUsed,
        notes,
      });
      setCreatedOrder(r.data?.data);
      setStep(5);
      toast.success('Commande créée avec succès !');
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur création commande', { duration: 6000 });
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setStep(1); setSelectedCustomer(null); setCustomerSearch(''); setAddresses([]);
    setSelectedAddress(null); setCartItems([]); setNotes(''); setDeliveryType(null);
    setSelectedNode(null); setEligibleNodes(null); setAvailableDates([]); setSelectedDate('');
    setSlots([]); setSelectedSlot(null); setPaymentMethod(null); setWalletUsed(0);
    setTotals(null); setCreatedOrder(null); setMeta({ delivery_types: [], payment_methods: [] });
    getCheckoutMeta().then(r => setMeta(r.data?.data ?? {})).catch(() => {});
  };

  // ── Sidebar récap ─────────────────────────────────────────────────────────
  const Sidebar = () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
      <h3 className="font-bold text-gray-900 text-sm mb-4">Récapitulatif</h3>
      <div className="space-y-3 text-sm">
        {selectedCustomer && (
          <div className="flex items-start gap-2">
            <Icon d={SVG.user} className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-400">Client</p><p className="font-semibold text-gray-800">{selectedCustomer.name}</p></div>
          </div>
        )}
        {selectedAddress && (
          <div className="flex items-start gap-2">
            <Icon d={SVG.pin} className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-400">Adresse</p><p className="font-semibold text-gray-800 text-xs">{selectedAddress.street_name}, {selectedAddress.city}</p></div>
          </div>
        )}
        {deliveryType && (
          <div className="flex items-start gap-2">
            <Icon d={deliveryType.code === 'home' ? SVG.home : SVG.store} className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-400">Livraison</p><p className="font-semibold text-gray-800">{deliveryType.name_fr}</p></div>
          </div>
        )}
        {selectedNode && (
          <div className="flex items-start gap-2">
            <Icon d={SVG.node} className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-400">Node</p><p className="font-semibold text-emerald-700 text-xs">{selectedNode.name_fr}</p></div>
          </div>
        )}
        {selectedSlot && (
          <div className="flex items-start gap-2">
            <Icon d={SVG.clock} className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-xs text-gray-400">Créneau</p><p className="font-semibold text-gray-800 text-xs">{selectedDate} · {selectedSlot.slot_start}–{selectedSlot.slot_end}</p></div>
          </div>
        )}
      </div>
      {cartCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
          {cartItems.map((it, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-600 truncate flex-1 mr-2">{it.qty}× {it.name_fr}</span>
              <span className="font-semibold text-gray-800 shrink-0">{(it.qty * it.unit_price).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
            <span className="text-sm font-bold text-gray-700">{totals ? 'Total TTC' : 'Sous-total estimé'}</span>
            <span className="text-sm font-bold text-gray-900">{(totals?.total_ttc ?? cartTotal).toFixed(2)} MAD</span>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>Commandes</span><span>›</span><span className="text-red-600 font-medium">Nouveau checkout</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Créer une commande</h1>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl">
        {step < 5 && <StepBar current={step} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            {/* ── ÉTAPE 1 — CLIENT ──────────────────────────────────────── */}
            {step === 1 && (
              <>
                <Card title="Sélectionner un client" icon={SVG.user}>
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Nom ou téléphone…"
                    className="w-full px-3 py-2.5 mb-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {customerResults.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedCustomer?.id === c.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{c.phone_country} {c.phone_number}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Wallet: <strong className="text-violet-700">{Number(c.wallet_balance ?? 0).toFixed(2)} MAD</strong></p>
                      </button>
                    ))}
                    {customerSearch.length >= 2 && customerResults.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">Aucun client trouvé</p>
                    )}
                  </div>
                </Card>

                {selectedCustomer && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-800">{selectedCustomer.name}</p>
                      <p className="text-xs text-emerald-600">{selectedCustomer.phone_country} {selectedCustomer.phone_number} — Wallet: {Number(selectedCustomer.wallet_balance ?? 0).toFixed(2)} MAD</p>
                    </div>
                    <Icon d={SVG.check} className="w-5 h-5 text-emerald-600" />
                  </div>
                )}

                <button onClick={() => setStep(2)} disabled={!selectedCustomer}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                  Continuer → Panier
                </button>
              </>
            )}

            {/* ── ÉTAPE 2 — PANIER ──────────────────────────────────────── */}
            {step === 2 && (
              <>
                <Card title="Articles du panier" icon={SVG.cart}>
                  <div className="mb-4">
                    <ArticleSearchDropdown onSelect={addArticle} />
                    <p className="text-[11px] text-gray-400 mt-1.5">Tapez au moins 2 caractères pour rechercher</p>
                  </div>

                  {cartCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 border-2 border-dashed border-gray-200 rounded-xl">
                      <Icon d={SVG.cart} className="w-10 h-10 text-gray-200" />
                      <p className="text-sm text-gray-400">Panier vide</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        <span className="col-span-5">Article</span><span className="col-span-2 text-center">Qté</span>
                        <span className="col-span-2 text-right">Prix</span><span className="col-span-2 text-right">Total</span><span className="col-span-1" />
                      </div>
                      {cartItems.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="col-span-5">
                            <p className="text-sm font-semibold text-gray-800 truncate">{item.name_fr}</p>
                            <p className="text-[10px] font-mono text-gray-400">TVA {item.vat_rate}%</p>
                          </div>
                          <div className="col-span-2 flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(i, item.qty - 1)} disabled={item.qty <= 1}
                              className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-100 disabled:opacity-40">−</button>
                            <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                            <button onClick={() => updateQty(i, item.qty + 1)}
                              className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-100">+</button>
                          </div>
                          <div className="col-span-2 text-right">
                            <input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={e => updatePrice(i, e.target.value)}
                              className="w-full px-2 py-1 text-xs text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 font-mono" />
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-sm font-bold text-gray-900">{(item.qty * item.unit_price).toFixed(2)}</span>
                            <span className="text-[10px] text-gray-400 block">MAD</span>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg">
                              <Icon d={SVG.trash} className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl mt-2">
                        <span className="text-sm text-gray-400">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                        <p className="text-xl font-bold text-white">{cartTotal.toFixed(2)} <span className="text-sm font-normal text-gray-400">MAD</span></p>
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Notes" icon={SVG.cart}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Instructions spéciales…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                </Card>

                {cartCount === 0 && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Icon d={SVG.warn} className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-800">Ajoutez au moins un article pour continuer vers la livraison</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(3)} disabled={cartCount === 0}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    {cartCount === 0 ? 'Panier vide' : 'Continuer → Livraison'}
                  </button>
                </div>
              </>
            )}

            {/* ── ÉTAPE 3 — LIVRAISON/RETRAIT ───────────────────────────── */}
            {step === 3 && (
              <>
                <Card title="Type de livraison" icon={deliveryType?.code === 'pickup' ? SVG.store : SVG.home}>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {(meta.delivery_types ?? []).map(dt => (
                      <button key={dt.id} onClick={() => selectDeliveryType(dt)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${deliveryType?.id === dt.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon d={dt.code === 'home' ? SVG.home : SVG.store} className={`w-6 h-6 mb-2 ${deliveryType?.id === dt.id ? 'text-red-600' : 'text-gray-400'}`} />
                        <p className="font-semibold text-sm">{dt.name_fr}</p>
                        <p className="text-[11px] text-gray-400">{dt.code === 'home' ? 'Node auto-sélectionné' : 'Choisir un node'}</p>
                      </button>
                    ))}
                  </div>

                  {/* Adresse — home seulement */}
                  {deliveryType?.code === 'home' && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adresse de livraison</p>
                      {addresses.length === 0 ? (
                        <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-3">Aucune adresse pour ce client</p>
                      ) : (
                        <div className="space-y-2">
                          {addresses.map(a => (
                            <button key={a.id} onClick={() => setSelectedAddress(a)}
                              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedAddress?.id === a.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:bg-gray-50'}`}>
                              <p className="text-sm font-medium text-gray-800">{a.street_name}</p>
                              <p className="text-xs text-gray-500">{a.city}{a.is_default ? ' · Par défaut' : ''}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bouton recherche nodes */}
                  {deliveryType && (deliveryType.code === 'pickup' || selectedAddress) && !selectedNode && (
                    <button onClick={handleFindNodes} disabled={loadingNodes}
                      className="w-full py-2.5 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-40">
                      {loadingNodes ? 'Recherche en cours…' : '🔍 Trouver les nodes disponibles'}
                    </button>
                  )}

                  {/* Pickup — liste de choix si plusieurs nodes */}
                  {eligibleNodes && deliveryType?.code === 'pickup' && !eligibleNodes.auto_selected && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Points de retrait éligibles</p>
                      {eligibleNodes.eligible?.length === 0 && (
                        <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">Aucun node disponible pour ce panier</p>
                      )}
                      {eligibleNodes.eligible?.map(n => (
                        <button key={n.id} onClick={() => selectNode(n)}
                          className={`w-full text-left rounded-xl border p-3 text-sm transition-all ${selectedNode?.id === n.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="font-medium">{n.name_fr}</p>
                          <p className="text-gray-400 text-xs">{n.city?.name_fr}{n.needs_backorder ? ' · ⚠ backorder' : ''}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Node sélectionné */}
                  {selectedNode && (
                    <div className="mt-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <Icon d={SVG.node} className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-emerald-800">{selectedNode.name_fr}</p>
                        <p className="text-xs text-emerald-600">{selectedNode.city?.name_fr}{selectedNode.distance_km ? ` · ${selectedNode.distance_km} km` : ''}</p>
                      </div>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {deliveryType.code === 'home' ? 'Auto ✓' : 'Sélectionné ✓'}
                      </span>
                    </div>
                  )}
                </Card>

                {/* Calendrier des dates */}
                {selectedNode && availableDates.length > 0 && (
                  <Card title="Date de livraison" icon={SVG.clock}>
                    <div className="grid grid-cols-7 gap-1.5">
                      {availableDates.map(d => (
                        <button key={d.date} onClick={() => d.available && handleDateSelect(d.date)}
                          disabled={!d.available}
                          title={d.reason ? (d.reason === 'closed' ? 'Fermé' : d.reason === 'no_slots' ? 'Aucun créneau' : d.reason === 'capacity_reached' ? 'Complet' : d.reason) : ''}
                          className={`py-2 px-1 rounded-xl text-xs text-center transition-all ${
                            selectedDate === d.date ? 'bg-red-600 text-white font-bold' :
                            d.available ? 'bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-700' :
                            'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
                          }`}>
                          <p className="font-medium">{new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</p>
                          <p className="font-bold text-sm mt-0.5">{new Date(d.date + 'T12:00:00').getDate()}</p>
                        </button>
                      ))}
                    </div>
                    {!selectedDate && <p className="text-xs text-amber-600 mt-3">Sélectionnez une date pour voir les créneaux</p>}
                  </Card>
                )}

                {/* Créneaux */}
                {selectedDate && (
                  <Card title="Créneaux disponibles" icon={SVG.clock}>
                    {loadingSlots && <p className="text-sm text-gray-400">Chargement des créneaux…</p>}
                    {!loadingSlots && slots.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">Aucun créneau disponible ce jour</p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map(s => (
                        <button key={s.id} onClick={() => !s.is_full && !s.is_past && setSelectedSlot(s)}
                          disabled={s.is_full || s.is_past}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            selectedSlot?.id === s.id ? 'border-red-500 bg-red-50' :
                            s.is_full || s.is_past ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' :
                            'border-gray-200 hover:border-red-300'
                          }`}>
                          <p className="text-xs font-bold font-mono text-gray-700">{s.slot_start}–{s.slot_end}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{s.is_past ? 'Expiré' : s.is_full ? 'Complet' : s.available_capacity != null ? `${s.available_capacity} place${s.available_capacity > 1 ? 's' : ''}` : 'Disponible'}</p>
                        </button>
                      ))}
                    </div>
                    {slots.length > 0 && !selectedSlot && (
                      <p className="text-xs text-amber-500 mt-3">Le créneau est optionnel</p>
                    )}
                  </Card>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(4)} disabled={!selectedNode || !selectedSlot}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    {!selectedNode ? 'Sélectionnez un node' : !selectedSlot ? 'Sélectionnez un créneau' : 'Continuer → Paiement'}
                  </button>
                </div>
              </>
            )}

            {/* ── ÉTAPE 4 — PAIEMENT ────────────────────────────────────── */}
            {step === 4 && (
              <>
                <Card title="Méthode de paiement" icon={SVG.card}>
                  {!(meta.payment_methods?.length) ? (
                    <p className="text-sm text-gray-400">Aucune méthode active pour ce node</p>
                  ) : (
                    <div className="space-y-2">
                      {meta.payment_methods.map(pm => {
                        const disabled = isMethodDisabled(pm);
                        const reason   = methodDisabledReason(pm);
                        return (
                          <button key={pm.id} onClick={() => !disabled && setPaymentMethod(pm)} disabled={disabled}
                            className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all ${
                              disabled ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' :
                              paymentMethod?.id === pm.id ? 'border-red-500 bg-red-50' :
                              'border-gray-200 hover:border-gray-300'
                            }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${disabled ? 'bg-gray-100' : pm.code === 'cod' ? 'bg-emerald-50' : pm.code === 'wallet' ? 'bg-violet-50' : 'bg-amber-50'}`}>
                                {disabled ? <Icon d={SVG.lock} className="w-5 h-5 text-gray-400" /> : <Icon d={pm.code === 'wallet' ? SVG.wallet : SVG.card} className={`w-5 h-5 ${pm.code === 'cod' ? 'text-emerald-600' : pm.code === 'wallet' ? 'text-violet-600' : 'text-amber-600'}`} />}
                              </div>
                              <div className="flex-1">
                                <p className={`font-semibold text-sm ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>{pm.name_fr}</p>
                                {reason ? <p className="text-xs text-red-500 mt-0.5">{reason}</p> : <p className="text-[11px] font-mono text-gray-400">{pm.code}</p>}
                              </div>
                              {!disabled && paymentMethod?.id === pm.id && <Icon d={SVG.check} className="w-5 h-5 text-red-600 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Wallet slider */}
                  {walletBalance > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Utiliser le wallet ({walletBalance.toFixed(2)} MAD)</p>
                      <input type="range" min={0} max={walletBalance} step={1} value={walletUsed}
                        onChange={e => setWalletUsed(parseFloat(e.target.value))}
                        className="w-full accent-red-600" />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0 MAD</span>
                        <span className="font-semibold text-red-600">{walletUsed.toFixed(2)} MAD déduit</span>
                        <span>{walletBalance.toFixed(2)} MAD</span>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Totaux calculés backend */}
                {loadingTotals && <p className="text-sm text-gray-400 text-center py-2">Calcul en cours…</p>}
                {totals && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 text-sm mb-3">Détail du total</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{Number(totals.subtotal_ht).toFixed(2)} MAD</span></div>
                      <div className="flex justify-between text-gray-500"><span>TVA</span><span>{Number(totals.vat_amount).toFixed(2)} MAD</span></div>
                      <div className="flex justify-between text-gray-500"><span>Frais livraison</span><span>{Number(totals.delivery_fee).toFixed(2)} MAD</span></div>
                      {totals.wallet_used > 0 && <div className="flex justify-between text-violet-600"><span>Wallet déduit</span><span>−{Number(totals.wallet_used).toFixed(2)} MAD</span></div>}
                      <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
                        <span>Total TTC</span><span className="text-red-700">{Number(totals.total_ttc).toFixed(2)} MAD</span>
                      </div>
                      {totals.cod_amount > 0 && paymentMethod?.code === 'cod' && (
                        <div className="flex justify-between text-emerald-600 text-xs border-t pt-2">
                          <span>Montant à encaisser (COD)</span><span>{Number(totals.cod_amount).toFixed(2)} MAD</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={handleCreateOrder} disabled={creating || !paymentMethod}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    {creating ? 'Création…' : `Confirmer — ${(totals?.total_ttc ?? cartTotal).toFixed(2)} MAD`}
                  </button>
                </div>
              </>
            )}

            {/* ── ÉTAPE 5 — CONFIRMATION ────────────────────────────────── */}
            {step === 5 && createdOrder && (
              <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <Icon d={SVG.check} className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Commande créée !</h1>
                <p className="text-sm text-gray-500 mb-6">Transmise au node de préparation</p>
                <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">N°</span><span className="font-mono text-xs font-bold">{createdOrder.id?.slice(-12).toUpperCase()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-semibold text-amber-600">{createdOrder.status?.name_fr ?? 'En attente'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Node</span><span className="font-semibold">{createdOrder.node?.name_fr ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total TTC</span><span className="font-bold text-gray-900">{Number(createdOrder.total_ttc).toFixed(2)} MAD</span></div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-700 text-left space-y-1 mb-6">
                  <p>✓ Stock réservé</p>
                  <p>✓ Paiement pending créé</p>
                  <p>✓ Historique enregistré</p>
                  <p className="text-emerald-500 mt-1">→ Confirmez la commande pour la rendre visible aux pickers</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
                    Nouvelle commande
                  </button>
                  <button onClick={() => navigate('/orders-mgmt')} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
                    Gérer les commandes
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar récap ─────────────────────────────────────────── */}
          {step < 5 && (
            <div className="space-y-4">
              <Sidebar />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
