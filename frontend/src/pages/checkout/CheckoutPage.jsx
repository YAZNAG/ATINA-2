import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCheckoutMeta, getDeliverySlots, createOrder, searchArticles } from '../../api/checkout.api';
import { getCustomers, getAddresses } from '../../api/customers.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  home:   'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  store:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  truck:  'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  pin:    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  card:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  cart:   'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  plus:   'M12 4v16m8-8H4',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check:  'M5 13l4 4L19 7',
  warn:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  order:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  star:   'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const STEPS = [{ n: 1, label: 'Client' }, { n: 2, label: 'Livraison' }, { n: 3, label: 'Panier' }, { n: 4, label: 'Paiement' }];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
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

// ── Article search + select ────────────────────────────────────────────────────
function ArticleSearchDropdown({ onSelect }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await searchArticles({ search: query, limit: 15 });
        setResults(res.data?.data ?? []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSelect = (article) => {
    onSelect(article);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) setOpen(false); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Rechercher un article par nom ou code SKU…"
          className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.map(a => (
            <button key={a.id} type="button" onMouseDown={() => handleSelect(a)}
              className="w-full text-left px-4 py-3 hover:bg-red-50 border-b border-gray-50 last:border-0 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{a.name_fr}</p>
                  <p className="text-[11px] font-mono text-gray-400">{a.sku_code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{Number(a.price).toFixed(2)} <span className="text-xs font-normal text-gray-500">MAD</span></p>
                  <p className="text-[10px] text-gray-400">TVA {a.vat_rate}%</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && !loading && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-center text-sm text-gray-400">
          Aucun article trouvé
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ delivery_types: [], payment_methods: [] });
  const [step, setStep] = useState(1);

  // Step 1 — client & address
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Step 2 — delivery
  const [deliveryTypeId, setDeliveryTypeId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotsData, setSlotsData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedPickupNode, setSelectedPickupNode] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 3 — cart
  const [cartItems, setCartItems] = useState([]);
  const [notes, setNotes] = useState('');

  // Step 4 — payment
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getCheckoutMeta().then(r => {
      const d = r.data?.data ?? {};
      setMeta(d);
      const cod = d.payment_methods?.find(p => p.code === 'cod');
      if (cod) setPaymentMethodId(cod.id);
      const home = d.delivery_types?.find(t => t.code === 'home');
      if (home) setDeliveryTypeId(home.id);
    }).catch(() => {});
  }, []);

  // ── Load customers with search ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      getCustomers({ search: customerSearch, limit: 20, is_deleted: 'false' })
        .then(r => setCustomers(r.data?.data?.items ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // ── Load addresses when customer selected ─────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) { setAddresses([]); setSelectedAddress(null); return; }
    getAddresses(selectedCustomer.id).then(r => {
      const addrs = (r.data?.data ?? []).filter(a => !a.is_deleted);
      setAddresses(addrs);
      const def = addrs.find(a => a.is_default) ?? addrs[0];
      if (def) setSelectedAddress(def);
    }).catch(() => {});
  }, [selectedCustomer]);

  // ── Delivery slots ─────────────────────────────────────────────────────────
  const loadSlots = useCallback(async () => {
    if (!deliveryTypeId) return;
    const delivType = meta.delivery_types?.find(d => d.id === deliveryTypeId);
    if (delivType?.code === 'home' && !selectedAddress) return;
    setLoadingSlots(true);
    try {
      const params = {
        delivery_type_id: deliveryTypeId,
        date: deliveryDate,
        ...(selectedAddress && { address_id: selectedAddress.id }),
        cart_items: JSON.stringify(cartItems.filter(i => i.sku_id)),
      };
      const res = await getDeliverySlots(params);
      setSlotsData(res.data?.data ?? null);
      setSelectedSlot(null); setSelectedPickupNode(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoadingSlots(false); }
  }, [deliveryTypeId, selectedAddress, deliveryDate, meta.delivery_types, cartItems]);

  useEffect(() => { if (step === 2) loadSlots(); }, [step, loadSlots]);

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addArticle = (article) => {
    if (!article.sku_uuid) return toast.error('Cet article n\'a pas de SKU logistique lié');
    const existing = cartItems.find(i => i.sku_id === article.sku_uuid);
    if (existing) {
      setCartItems(items => items.map(i => i.sku_id === article.sku_uuid ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCartItems(items => [...items, {
        sku_id:      article.sku_uuid,
        sku_code:    article.sku_code,
        name_fr:     article.name_fr,
        qty:         1,
        unit_price:  Number(article.price),
        vat_rate:    Number(article.vat_rate),
      }]);
    }
  };

  const updateQty        = (i, qty) => setCartItems(items => items.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, Number(qty) || 1) } : it));
  const updatePrice      = (i, price) => setCartItems(items => items.map((it, idx) => idx === i ? { ...it, unit_price: Number(price) || 0 } : it));
  const removeItem       = (i) => setCartItems(items => items.filter((_, idx) => idx !== i));

  const cartTotal        = cartItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const cartLines        = cartItems.length;

  // ── Payment method eligibility ─────────────────────────────────────────────
  const walletBalance    = Number(selectedCustomer?.wallet_balance ?? 0);
  const pointsBalance    = Number(selectedCustomer?.points_balance ?? 0);

  const isMethodDisabled = (pm) => {
    if (pm.code === 'wallet') return walletBalance < cartTotal || walletBalance <= 0;
    if (pm.code === 'mixed')  return walletBalance <= 0;
    return false; // cod always enabled
  };

  const methodDisabledReason = (pm) => {
    if (pm.code === 'wallet') {
      if (walletBalance <= 0) return 'Wallet vide (0.00 MAD)';
      if (walletBalance < cartTotal) return `Solde insuffisant — wallet: ${walletBalance.toFixed(2)} MAD / total: ${cartTotal.toFixed(2)} MAD`;
    }
    if (pm.code === 'mixed' && walletBalance <= 0) return 'Wallet vide — paiement mixte impossible';
    return null;
  };

  const currentDelivType = meta.delivery_types?.find(d => d.id === deliveryTypeId);

  // ── Create order ───────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    // Frontend validations
    if (!selectedCustomer) return toast.error('Sélectionnez un client');
    if (!deliveryTypeId)   return toast.error('Sélectionnez un type de livraison');
    if (cartLines === 0)   return toast.error('Panier vide — ajoutez au moins un article');
    if (!paymentMethodId)  return toast.error('Sélectionnez une méthode de paiement');

    const delivType = meta.delivery_types?.find(d => d.id === deliveryTypeId);

    if (delivType?.code === 'home') {
      if (!selectedAddress) return toast.error('Sélectionnez une adresse de livraison');
      if (!slotsData?.node) return toast.error('Aucun node disponible pour cette adresse — vérifiez l\'étape Livraison');
    }
    if (delivType?.code === 'pickup' && !selectedPickupNode) {
      return toast.error('Sélectionnez un node de retrait');
    }

    // node_id explicitement envoyé — le backend l'utilise directement sans re-run
    const node_id = slotsData?.node?.id ?? selectedPickupNode?.id ?? null;
    if (!node_id) return toast.error('Aucun node sélectionné — revenez à l\'étape Livraison');

    setCreating(true);
    try {
      const res = await createOrder({
        customer_id:       selectedCustomer.id,
        address_id:        selectedAddress?.id ?? null,
        delivery_type_id:  deliveryTypeId,
        node_id,
        selected_slot_id:  selectedSlot?.id ?? null,
        payment_method_id: paymentMethodId,
        cart_items:        cartItems,
        notes,
      });
      setCreatedOrder(res.data?.data);
      toast.success('Commande créée avec succès !');
    } catch (err) {
      const msg = err?.response?.data?.message ?? getErrorMessage(err);
      toast.error(msg, { duration: 6000 });
    }
    finally { setCreating(false); }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (createdOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <Icon d={SVG.check} className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Commande créée !</h1>
          <p className="text-sm text-gray-500 mb-6">Transmise au node de préparation</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">N°</span><span className="font-mono text-xs font-bold">{createdOrder.id?.slice(0, 8)}…</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-semibold text-amber-600">{createdOrder.status?.name_fr ?? 'En attente'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Node</span><span className="font-semibold">{createdOrder.node?.name_fr ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total TTC</span><span className="font-bold text-gray-900">{Number(createdOrder.total_ttc).toFixed(2)} MAD</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setCreatedOrder(null); setStep(1); setSelectedCustomer(null); setSelectedAddress(null); setSlotsData(null); setCartItems([]); }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
              Nouvelle commande
            </button>
            <button onClick={() => navigate('/customers')} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
              Retour clients
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <StepBar current={step} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            {/* ── STEP 1 — Client & Adresse ───────────────────────────────── */}
            {step === 1 && (
              <>
                <Card title="Sélectionner un client" icon={SVG.cart}>
                  <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Nom, téléphone…"
                    className="w-full px-3 py-2.5 mb-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {customers.map(c => (
                      <button key={c.id} onClick={() => setSelectedCustomer(c)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedCustomer?.id === c.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{c.phone_country} {c.phone_number}</p>
                        <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                          <span>Wallet: <strong className="text-violet-700">{Number(c.wallet_balance ?? 0).toFixed(2)} MAD</strong></span>
                          <span>Points: <strong className="text-amber-600">{c.points_balance ?? 0}</strong></span>
                        </div>
                      </button>
                    ))}
                    {customers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun client</p>}
                  </div>
                </Card>

                {selectedCustomer && (
                  <Card title="Adresse de livraison" icon={SVG.pin}>
                    {addresses.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune adresse enregistrée</p>
                    ) : (
                      <div className="space-y-2">
                        {addresses.map(a => (
                          <button key={a.id} onClick={() => setSelectedAddress(a)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedAddress?.id === a.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              {a.label && <span className="text-xs font-semibold text-gray-500 uppercase">{a.label}</span>}
                              {a.is_default && <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Par défaut</span>}
                            </div>
                            <p className="text-sm font-medium text-gray-800">{a.street_number && `${a.street_number} `}{a.street_name}</p>
                            <p className="text-xs text-gray-500">{a.postal_code && `${a.postal_code} `}{a.city}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                <button onClick={() => setStep(2)} disabled={!selectedCustomer}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                  Continuer → Livraison
                </button>
              </>
            )}

            {/* ── STEP 2 — Livraison & créneaux ───────────────────────────── */}
            {step === 2 && (
              <>
                <Card title="Type de livraison" icon={SVG.truck}>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {meta.delivery_types?.map(dt => (
                      <button key={dt.id} onClick={() => { setDeliveryTypeId(dt.id); setSlotsData(null); }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${deliveryTypeId === dt.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon d={dt.code === 'home' ? SVG.home : SVG.store} className={`w-6 h-6 mb-2 ${deliveryTypeId === dt.id ? 'text-red-600' : 'text-gray-400'}`} />
                        <p className="font-semibold text-sm">{dt.name_fr}</p>
                        <p className="text-[11px] text-gray-400">{dt.code === 'home' ? 'Node auto-sélectionné' : 'Vous choisissez le node'}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date souhaitée</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <button onClick={loadSlots} disabled={loadingSlots || !deliveryTypeId}
                    className="w-full py-2.5 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-40">
                    {loadingSlots ? 'Recherche…' : 'Chercher les créneaux disponibles'}
                  </button>
                </Card>

                {/* Home node + slots */}
                {slotsData && currentDelivType?.code === 'home' && (
                  <Card title="Node sélectionné automatiquement" icon={SVG.node}>
                    {!slotsData.node ? (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <Icon d={SVG.warn} className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">{slotsData.message ?? 'Aucun node disponible'}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Vérifiez les nodes actifs et leurs créneaux</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                          <Icon d={SVG.node} className="w-5 h-5 text-emerald-600" />
                          <div className="flex-1">
                            <p className="font-bold text-emerald-800">{slotsData.node.name_fr}</p>
                            <p className="text-xs text-emerald-600">{slotsData.node.city?.name_fr}{slotsData.node.distance_km ? ` · ${slotsData.node.distance_km} km` : ''}</p>
                          </div>
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Auto ✓</span>
                        </div>
                        {!slotsData.slots?.length ? (
                          <p className="text-sm text-gray-500 text-center py-3">Aucun créneau disponible cette date</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {slotsData.slots.map(s => (
                              <button key={s.id} onClick={() => setSelectedSlot(s)}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${selectedSlot?.id === s.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <div className="flex items-center gap-1 mb-1">
                                  <Icon d={SVG.clock} className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs font-mono font-bold text-gray-700">{s.slot_start}–{s.slot_end}</span>
                                </div>
                                <p className="text-[11px] text-gray-600">{s.name_fr}</p>
                                {s.available_capacity !== null && <p className="text-[10px] text-emerald-600 mt-0.5">{s.available_capacity} place{s.available_capacity > 1 ? 's' : ''}</p>}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )}

                {/* Pickup nodes */}
                {slotsData && currentDelivType?.code === 'pickup' && (
                  <Card title="Choisir un node de retrait" icon={SVG.store}>
                    <div className="space-y-3">
                      {slotsData.pickup_nodes?.map(n => (
                        <div key={n.id} onClick={() => { setSelectedPickupNode(n); setSelectedSlot(null); }}
                          className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPickupNode?.id === n.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="font-bold text-sm">{n.name_fr}</p>
                          <p className="text-xs text-gray-500 mb-2">{n.city?.name_fr}</p>
                          {selectedPickupNode?.id === n.id && n.slots?.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              {n.slots.filter(s => !s.is_full).map(s => (
                                <button key={s.id} type="button" onClick={e => { e.stopPropagation(); setSelectedSlot(s); }}
                                  className={`p-2 rounded-lg border text-xs transition-all ${selectedSlot?.id === s.id ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                  <span className="font-mono">{s.slot_start}–{s.slot_end}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(3)}
                    disabled={!deliveryTypeId || (currentDelivType?.code === 'home' && !slotsData?.node) || (currentDelivType?.code === 'pickup' && !selectedPickupNode)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    Continuer → Panier
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3 — Panier ──────────────────────────────────────────── */}
            {step === 3 && (
              <>
                <Card title="Articles du panier" icon={SVG.cart}>
                  {/* Article search */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ajouter un article</label>
                    <ArticleSearchDropdown onSelect={addArticle} />
                    <p className="text-[11px] text-gray-400 mt-1.5">Tapez le nom ou le code SKU — prix et TVA auto-remplis depuis le catalogue</p>
                  </div>

                  {/* Cart table */}
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 border-2 border-dashed border-gray-200 rounded-xl">
                      <Icon d={SVG.cart} className="w-10 h-10 text-gray-200" />
                      <p className="text-sm text-gray-400">Panier vide — cherchez un article ci-dessus</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        <span className="col-span-5">Article</span>
                        <span className="col-span-2 text-center">Qté</span>
                        <span className="col-span-2 text-right">Prix TTC</span>
                        <span className="col-span-2 text-right">Sous-total</span>
                        <span className="col-span-1" />
                      </div>
                      {cartItems.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="col-span-5">
                            <p className="text-sm font-semibold text-gray-800 truncate">{item.name_fr}</p>
                            <p className="text-[11px] font-mono text-gray-400">{item.sku_code}</p>
                            <p className="text-[10px] text-gray-400">TVA {item.vat_rate}%</p>
                          </div>
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateQty(i, item.qty - 1)} disabled={item.qty <= 1}
                                className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-100 disabled:opacity-40">−</button>
                              <span className="w-8 text-center text-sm font-bold text-gray-800">{item.qty}</span>
                              <button onClick={() => updateQty(i, item.qty + 1)}
                                className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-100">+</button>
                            </div>
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

                      {/* Total */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-xl mt-2">
                        <div className="text-sm text-gray-400">{cartLines} article{cartLines > 1 ? 's' : ''}</div>
                        <div className="text-right">
                          <span className="text-xs text-gray-400">Total TTC</span>
                          <p className="text-xl font-bold text-white">{cartTotal.toFixed(2)} <span className="text-sm font-normal text-gray-400">MAD</span></p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                <Card title="Notes" icon={SVG.order}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Instructions spéciales…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                </Card>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(4)} disabled={cartLines === 0}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    Continuer → Paiement
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 4 — Paiement ────────────────────────────────────────── */}
            {step === 4 && (
              <>
                {/* Customer balance summary */}
                {selectedCustomer && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Soldes du client — {selectedCustomer.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`rounded-xl border p-4 ${walletBalance >= cartTotal ? 'bg-violet-50 border-violet-200' : walletBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon d={SVG.wallet} className={`w-4 h-4 ${walletBalance > 0 ? 'text-violet-600' : 'text-gray-400'}`} />
                          <span className="text-xs font-semibold text-gray-500 uppercase">Wallet</span>
                        </div>
                        <p className={`text-xl font-bold ${walletBalance >= cartTotal ? 'text-violet-700' : walletBalance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                          {walletBalance.toFixed(2)} <span className="text-sm font-normal">MAD</span>
                        </p>
                        {walletBalance > 0 && walletBalance < cartTotal && (
                          <p className="text-[10px] text-amber-600 mt-1">Insuffisant (besoin: {cartTotal.toFixed(2)} MAD)</p>
                        )}
                        {walletBalance === 0 && <p className="text-[10px] text-gray-400 mt-1">Wallet vide</p>}
                        {walletBalance >= cartTotal && cartTotal > 0 && <p className="text-[10px] text-violet-600 mt-1">✓ Suffisant pour cette commande</p>}
                      </div>
                      <div className={`rounded-xl border p-4 ${pointsBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon d={SVG.star} className={`w-4 h-4 ${pointsBalance > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
                          <span className="text-xs font-semibold text-gray-500 uppercase">Points</span>
                        </div>
                        <p className={`text-xl font-bold ${pointsBalance > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                          {pointsBalance} <span className="text-sm font-normal">pts</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">{pointsBalance === 0 ? 'Aucun point' : `≈ ${(pointsBalance / 100).toFixed(2)} MAD`}</p>
                      </div>
                    </div>
                  </div>
                )}

                <Card title="Méthode de paiement" icon={SVG.card}>
                  {!meta.payment_methods?.length ? (
                    <p className="text-sm text-gray-400">Aucune méthode de paiement active</p>
                  ) : (
                    <div className="space-y-2">
                      {meta.payment_methods.map(pm => {
                        const disabled = isMethodDisabled(pm);
                        const reason   = methodDisabledReason(pm);
                        return (
                          <button key={pm.id}
                            onClick={() => !disabled && setPaymentMethodId(pm.id)}
                            disabled={disabled}
                            className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all ${
                              disabled ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' :
                              paymentMethodId === pm.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${disabled ? 'bg-gray-100' : pm.code === 'cod' ? 'bg-emerald-50' : pm.code === 'wallet' ? 'bg-violet-50' : 'bg-amber-50'}`}>
                                {disabled
                                  ? <Icon d={SVG.lock} className="w-5 h-5 text-gray-400" />
                                  : <Icon d={pm.code === 'wallet' ? SVG.wallet : SVG.card} className={`w-5 h-5 ${pm.code === 'cod' ? 'text-emerald-600' : pm.code === 'wallet' ? 'text-violet-600' : 'text-amber-600'}`} />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${disabled ? 'text-gray-400' : 'text-gray-800'}`}>{pm.name_fr}</p>
                                {reason
                                  ? <p className="text-xs text-red-500 mt-0.5">{reason}</p>
                                  : pm.code === 'wallet' && walletBalance >= cartTotal
                                    ? <p className="text-xs text-violet-600 mt-0.5">Solde disponible : {walletBalance.toFixed(2)} MAD</p>
                                    : <p className="text-[11px] font-mono text-gray-400">{pm.code}</p>
                                }
                              </div>
                              {!disabled && paymentMethodId === pm.id && <Icon d={SVG.check} className="w-5 h-5 text-red-600 flex-shrink-0" />}
                              {disabled && <Icon d={SVG.lock} className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={handleConfirm} disabled={creating || !paymentMethodId}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    {creating ? 'Création…' : `Confirmer — ${cartTotal.toFixed(2)} MAD`}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Récap sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-24">
              <h3 className="font-bold text-gray-900 text-sm mb-4">Récapitulatif</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon d={SVG.cart} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs text-gray-400">Client</p><p className="font-semibold text-gray-800">{selectedCustomer?.name ?? '—'}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon d={SVG.pin} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs text-gray-400">Adresse</p><p className="font-semibold text-gray-800 text-xs">{selectedAddress ? `${selectedAddress.street_name}, ${selectedAddress.city}` : '—'}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon d={SVG.truck} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-xs text-gray-400">Livraison</p><p className="font-semibold text-gray-800">{currentDelivType?.name_fr ?? '—'}</p></div>
                </div>
                {(slotsData?.node || selectedPickupNode) && (
                  <div className="flex items-start gap-2">
                    <Icon d={SVG.node} className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div><p className="text-xs text-gray-400">Node</p><p className="font-semibold text-emerald-700 text-xs">{slotsData?.node?.name_fr ?? selectedPickupNode?.name_fr}</p></div>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex items-start gap-2">
                    <Icon d={SVG.clock} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div><p className="text-xs text-gray-400">Créneau</p><p className="font-semibold text-gray-800 text-xs">{deliveryDate} · {selectedSlot.slot_start}–{selectedSlot.slot_end}</p></div>
                  </div>
                )}
              </div>
              {cartLines > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
                  {cartItems.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600 truncate flex-1 mr-2">{it.qty}× {it.name_fr}</span>
                      <span className="font-semibold text-gray-800 flex-shrink-0">{(it.qty * it.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-100 mt-2">
                    <span className="text-sm font-bold text-gray-700">Total TTC</span>
                    <span className="text-sm font-bold text-gray-900">{cartTotal.toFixed(2)} MAD</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
