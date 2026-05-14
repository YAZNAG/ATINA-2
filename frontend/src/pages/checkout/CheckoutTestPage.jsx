/**
 * CheckoutTestPage — Super Admin
 * Wizard 5 étapes : Client → Panier → Livraison/Retrait → Paiement → Confirmation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  searchCustomers, getCustomerAddresses,
  getEligibleNodes, getAvailableDates,
  getDeliverySlots, calculateCart, createOrder,
  searchArticles, getCheckoutMeta,
} from '../../api/checkout.api';

// ── Utilitaires ───────────────────────────────────────────────────────────────
const fmt  = (v) => `${parseFloat(v ?? 0).toFixed(2)} MAD`;
const today = () => new Date().toISOString().split('T')[0];

const STEPS = ['Client', 'Panier', 'Livraison / Retrait', 'Paiement', 'Confirmation'];

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ current }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < current  ? 'bg-green-500 text-white' :
              i === current ? 'bg-indigo-600 text-white' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-indigo-700' : i < current ? 'text-green-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && <div className="h-px bg-gray-200 flex-1 mx-2" />}
        </div>
      ))}
    </div>
  );
}

// ── Composant recherche avec dropdown ─────────────────────────────────────────
function SearchDropdown({ placeholder, onSearch, results, onSelect, renderItem, value }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={value}
        onChange={e => { onSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="border rounded-lg px-3 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {results.map((item, i) => (
            <button key={i} type="button" onMouseDown={() => { onSelect(item); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b last:border-0 text-sm">
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutTestPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // ── État global du formulaire ──────────────────────────────────────────────
  const [customer, setCustomer]       = useState(null);
  const [cart, setCart]               = useState([]);
  const [deliveryType, setDeliveryType] = useState(null);   // {id, code, name_fr}
  const [address, setAddress]         = useState(null);
  const [node, setNode]               = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slot, setSlot]               = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [walletUsed, setWalletUsed]   = useState(0);
  const [totals, setTotals]           = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null);

  // ── Données chargées ───────────────────────────────────────────────────────
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearch, setCustomerSearch]   = useState('');
  const [articleResults, setArticleResults]   = useState([]);
  const [articleSearch, setArticleSearch]     = useState('');
  const [addresses, setAddresses]             = useState([]);
  const [eligibleNodes, setEligibleNodes]     = useState(null);
  const [availableDates, setAvailableDates]   = useState([]);
  const [slots, setSlots]                     = useState([]);
  const [meta, setMeta]                       = useState(null);

  // ── ÉTAPE 0 — Recherche client ─────────────────────────────────────────────
  const handleCustomerSearch = useCallback(async (q) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    const r = await searchCustomers(q);
    setCustomerResults(r.data.data ?? []);
  }, []);

  const selectCustomer = async (c) => {
    setCustomer(c);
    setCustomerSearch(`${c.name} — ${c.phone_number}`);
    setCustomerResults([]);
    const r = await getCustomerAddresses(c.id);
    setAddresses(r.data.data ?? []);
  };

  // ── ÉTAPE 1 — Panier ──────────────────────────────────────────────────────
  const handleArticleSearch = useCallback(async (q) => {
    setArticleSearch(q);
    if (q.length < 2) { setArticleResults([]); return; }
    const r = await searchArticles(q, 12);
    setArticleResults(r.data.data ?? []);
  }, []);

  const addToCart = (article) => {
    if (!article.sku_uuid) { toast.error('Cet article n\'a pas de SKU — vérifiez le catalogue'); return; }
    setCart(prev => {
      const exists = prev.find(i => i.sku_uuid === article.sku_uuid);
      if (exists) return prev.map(i => i.sku_uuid === article.sku_uuid ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        sku_uuid: article.sku_uuid,
        name_fr:  article.name_fr,
        price:    Number(article.price ?? 0),
        vat_rate: Number(article.vat_rate ?? 20),
        qty:      1,
      }];
    });
    setArticleSearch('');
    setArticleResults([]);
  };

  const removeFromCart = (sku) => setCart(prev => prev.filter(i => i.sku_uuid !== sku));
  const updateQty = (sku, qty) => setCart(prev => prev.map(i => i.sku_uuid === sku ? { ...i, qty: Math.max(1, qty) } : i));
  const cartItems = cart.map(i => ({ sku_id: i.sku_uuid, qty: i.qty }));
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // ── ÉTAPE 2 — Livraison/Retrait ───────────────────────────────────────────
  // Chargement du meta quand on entre à l'étape 2
  const loadMeta = async (node_id = null) => {
    const r = await getCheckoutMeta(node_id);
    setMeta(r.data.data);
  };

  useEffect(() => { if (step === 2 && !meta) loadMeta(); }, [step]);

  const selectDeliveryType = (dt) => {
    setDeliveryType(dt);
    setNode(null);
    setEligibleNodes(null);
    setSelectedDate('');
    setSlot(null);
    setSlots([]);
    setAvailableDates([]);
  };

  const handleFindNodes = async () => {
    if (!deliveryType) return;
    setLoading(true);
    try {
      if (deliveryType.code === 'home') {
        if (!address) { toast.error('Sélectionnez une adresse'); return; }
        const r = await getEligibleNodes({ address_id: address.id, cart_items: cartItems, delivery_type_code: 'home' });
        const data = r.data.data;
        setEligibleNodes(data);
        if (data?.best_node) {
          setNode(data.best_node);
          await loadAvailableDates(data.best_node.id);
        } else {
          toast.error('Aucun node éligible pour cette adresse');
        }
      } else {
        const r = await getEligibleNodes({ cart_items: cartItems, delivery_type_code: 'pickup' });
        const data = r.data.data;
        setEligibleNodes(data);
        if (data?.auto_selected) {
          setNode(data.auto_selected);
          await loadAvailableDates(data.auto_selected.id);
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur recherche nodes');
    } finally {
      setLoading(false);
    }
  };

  const selectNode = async (n) => {
    setNode(n);
    setSelectedDate('');
    setSlot(null);
    setSlots([]);
    await loadAvailableDates(n.id);
  };

  const loadAvailableDates = async (node_id) => {
    try {
      const r = await getAvailableDates({ node_id, delivery_type_code: deliveryType?.code ?? 'home', days_ahead: 14 });
      setAvailableDates(r.data.data ?? []);
    } catch { setAvailableDates([]); }
  };

  const handleDateSelect = async (dateStr) => {
    setSelectedDate(dateStr);
    setSlot(null);
    setSlots([]);
    if (!node) return;
    setLoading(true);
    try {
      const params = {
        node_id:            node.id,
        delivery_type_code: deliveryType?.code,
        date:               dateStr,
      };
      if (deliveryType?.code === 'home' && address) params.address_id = address.id;
      const r = await getDeliverySlots(params);
      setSlots(r.data.data?.slots ?? r.data.data?.all_slots ?? []);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur créneaux');
    } finally {
      setLoading(false);
    }
  };

  // ── ÉTAPE 3 — Paiement ────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 3 && node && !meta) loadMeta(node.id);
    if (step === 3 && node) loadMeta(node.id); // refresh with node context
  }, [step, node]);

  useEffect(() => {
    if (step === 3 && paymentMethod && node) handleCalculate();
  }, [step, paymentMethod, walletUsed]);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const r = await calculateCart({
        node_id:            node?.id,
        delivery_type_code: deliveryType?.code,
        cart_items:         cartItems,
        payment_method_code: paymentMethod?.code,
        wallet_used:        walletUsed,
        customer_id:        customer?.id,
      });
      setTotals(r.data.data);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur de calcul');
    } finally {
      setLoading(false);
    }
  };

  // Wallet max disponible
  const walletBalance = Number(customer?.wallet_balance ?? 0);
  const walletActive  = meta?.payment_methods?.some(pm => pm.code === 'wallet');

  // ── ÉTAPE 4 — Créer commande ───────────────────────────────────────────────
  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const r = await createOrder({
        customer_id:        customer?.id,
        address_id:         address?.id ?? null,
        delivery_type_code: deliveryType?.code,
        node_id:            node?.id,
        selected_slot_id:   slot?.id ?? null,
        payment_method_code: paymentMethod?.code,
        cart_items:         cartItems,
        wallet_used:        walletUsed,
      });
      setCreatedOrder(r.data.data);
      toast.success('Commande créée avec succès !');
      setStep(5);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur création commande');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 0) return !!customer;
    if (step === 1) return cart.length > 0;
    if (step === 2) return !!deliveryType && !!node;
    if (step === 3) return !!paymentMethod && !!totals;
    return false;
  };

  const next = () => { if (canAdvance()) setStep(s => s + 1); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const reset = () => {
    setStep(0); setCustomer(null); setCart([]); setDeliveryType(null);
    setAddress(null); setNode(null); setSelectedDate(''); setSlot(null);
    setPaymentMethod(null); setWalletUsed(0); setTotals(null);
    setCreatedOrder(null); setMeta(null); setCustomerSearch('');
    setAvailableDates([]); setSlots([]); setEligibleNodes(null);
  };

  // ── Indicateur en-tête ─────────────────────────────────────────────────────
  const Summary = () => (
    <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-5 text-xs text-indigo-700 flex flex-wrap gap-3">
      {customer   && <span>👤 {customer.name}</span>}
      {cart.length > 0 && <span>🛒 {cart.length} article(s) — {fmt(cartTotal)}</span>}
      {deliveryType && <span>{deliveryType.code === 'home' ? '🏠' : '🏪'} {deliveryType.name_fr}</span>}
      {node       && <span>📍 {node.name_fr}</span>}
      {selectedDate && <span>📅 {selectedDate}</span>}
      {slot       && <span>🕐 {slot.slot_start}–{slot.slot_end}</span>}
      {paymentMethod && <span>💳 {paymentMethod.name_fr}</span>}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Nouveau Checkout — Super Admin</h1>
        <p className="text-gray-400 text-sm">Parcours commande complet</p>
      </div>

      {step < 5 && <Stepper current={step} />}
      {step > 0 && step < 5 && <Summary />}

      <div className="bg-white rounded-2xl border shadow-sm p-6">

        {/* ── ÉTAPE 0 — CLIENT ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 text-base">Sélectionner le client</h2>
            <SearchDropdown
              placeholder="Rechercher par nom ou téléphone..."
              value={customerSearch}
              onSearch={handleCustomerSearch}
              results={customerResults}
              onSelect={selectCustomer}
              renderItem={c => (
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-gray-400 text-xs">{c.phone_country}{c.phone_number} — Wallet : {fmt(c.wallet_balance)}</p>
                </div>
              )}
            />
            {customer && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-indigo-900">{customer.name}</p>
                    <p className="text-indigo-600 text-sm">{customer.phone_country} {customer.phone_number}</p>
                    <p className="text-indigo-500 text-xs mt-0.5">Wallet : {fmt(customer.wallet_balance)} — Ville : {customer.city ?? '—'}</p>
                  </div>
                  <button onClick={() => { setCustomer(null); setCustomerSearch(''); }} className="text-indigo-300 hover:text-indigo-600 text-lg">✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 1 — PANIER ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 text-base">Construire le panier</h2>
            <SearchDropdown
              placeholder="Rechercher article (nom, SKU, EAN)..."
              value={articleSearch}
              onSearch={handleArticleSearch}
              results={articleResults}
              onSelect={addToCart}
              renderItem={a => (
                <div>
                  <p className="font-medium">{a.name_fr}</p>
                  <p className="text-gray-400 text-xs">{a.sku_code} — {fmt(a.price)} TTC — {a.sku_uuid ? '✓ SKU lié' : '⚠ pas de SKU'}</p>
                </div>
              )}
            />

            {cart.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400">Recherchez des articles ci-dessus pour les ajouter au panier</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.sku_uuid} className="flex items-center gap-3 border rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name_fr}</p>
                      <p className="text-xs text-gray-400">{fmt(item.price)} × {item.qty} = {fmt(item.price * item.qty)}</p>
                    </div>
                    <input type="number" value={item.qty} min={1}
                      onChange={e => updateQty(item.sku_uuid, parseInt(e.target.value) || 1)}
                      className="border rounded-lg w-16 text-center text-sm py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button onClick={() => removeFromCart(item.sku_uuid)} className="text-red-300 hover:text-red-500 text-xl leading-none w-6">✕</button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-500">Sous-total estimé</span>
                  <span className="font-semibold text-gray-800">{fmt(cartTotal)}</span>
                </div>
              </div>
            )}
            {cart.length === 0 && (
              <p className="text-xs text-orange-500 text-center">⚠ Le panier doit contenir au moins un article pour continuer</p>
            )}
          </div>
        )}

        {/* ── ÉTAPE 2 — LIVRAISON/RETRAIT ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-gray-800 text-base">Mode de livraison</h2>

            {/* Types de livraison (filtrés par node config si disponible) */}
            <div className="flex gap-3">
              {(meta?.delivery_types ?? []).map(dt => (
                <button key={dt.id} onClick={() => selectDeliveryType(dt)}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    deliveryType?.id === dt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}>
                  {dt.code === 'home' ? '🏠' : '🏪'} {dt.name_fr}
                </button>
              ))}
              {!meta && <p className="text-gray-400 text-sm">Chargement...</p>}
            </div>

            {/* Home → sélection adresse */}
            {deliveryType?.code === 'home' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Adresse de livraison</p>
                {addresses.length === 0 ? (
                  <p className="text-gray-400 text-sm bg-gray-50 rounded-xl p-3">Ce client n'a aucune adresse enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {addresses.map(a => (
                      <button key={a.id} onClick={() => setAddress(a)}
                        className={`w-full text-left rounded-xl border p-3 text-sm transition-all ${
                          address?.id === a.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                        }`}>
                        <p className="font-medium">{a.label ?? a.street_name ?? 'Adresse'}</p>
                        <p className="text-gray-400 text-xs">{a.street_name}, {a.city}{a.is_default ? ' ⭐ Défaut' : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bouton recherche nodes */}
            {deliveryType && (deliveryType.code === 'pickup' || address) && !node && (
              <button onClick={handleFindNodes} disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-medium text-sm transition-colors">
                {loading ? '⏳ Recherche en cours...' : '🔍 Trouver les nodes disponibles'}
              </button>
            )}

            {/* Nodes éligibles (pickup uniquement si plusieurs) */}
            {eligibleNodes && deliveryType?.code === 'pickup' && !eligibleNodes.auto_selected && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Sélectionnez un point de retrait</p>
                {eligibleNodes.eligible?.length === 0 && (
                  <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">Aucun node disponible pour ce panier</p>
                )}
                {eligibleNodes.eligible?.map(n => (
                  <button key={n.id} onClick={() => selectNode(n)}
                    className={`w-full text-left rounded-xl border p-3 text-sm transition-all ${
                      node?.id === n.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                    }`}>
                    <p className="font-medium">{n.name_fr}</p>
                    <p className="text-gray-400 text-xs">{n.city?.name_fr}{n.needs_backorder ? ' ⚠ backorder' : ''}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Node sélectionné */}
            {node && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <p className="font-medium text-green-800">
                  {deliveryType?.code === 'home' ? '✓ Node détecté automatiquement' : '✓ Node sélectionné'}
                </p>
                <p className="text-green-700 text-xs mt-0.5">{node.name_fr} — {node.city?.name_fr}</p>
                {node.distance_km != null && <p className="text-green-600 text-xs">Distance : {node.distance_km} km</p>}
              </div>
            )}

            {/* Sélection de date */}
            {node && availableDates.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Choisir une date</p>
                <div className="grid grid-cols-4 gap-2">
                  {availableDates.map(d => (
                    <button key={d.date} onClick={() => d.available && handleDateSelect(d.date)}
                      disabled={!d.available}
                      className={`py-2 px-1 rounded-lg border text-xs text-center transition-all ${
                        selectedDate === d.date ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold' :
                        d.available ? 'border-gray-200 hover:border-indigo-300 text-gray-700' :
                        'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}>
                      <p>{new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</p>
                      <p className="font-semibold">{new Date(d.date + 'T12:00:00').getDate()}</p>
                      {!d.available && <p className="text-gray-300 text-[10px]">{d.reason === 'closed' ? 'fermé' : d.reason === 'no_slots' ? 'aucun créneau' : 'complet'}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Créneaux */}
            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Choisir un créneau</p>
                {loading && <p className="text-gray-400 text-sm">Chargement des créneaux...</p>}
                {!loading && slots.length === 0 && (
                  <p className="text-gray-400 text-sm bg-gray-50 rounded-xl p-3">Aucun créneau disponible pour cette date</p>
                )}
                <div className="space-y-2">
                  {slots.map(s => (
                    <button key={s.id} onClick={() => !s.is_full && !s.is_past && setSlot(s)}
                      disabled={s.is_full || s.is_past}
                      className={`w-full text-left rounded-xl border p-3 text-sm transition-all ${
                        slot?.id === s.id ? 'border-indigo-500 bg-indigo-50' :
                        s.is_full || s.is_past ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' :
                        'border-gray-200 hover:border-indigo-300'
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{s.slot_start} – {s.slot_end}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.is_past ? 'bg-gray-100 text-gray-400' :
                          s.is_full ? 'bg-red-100 text-red-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {s.is_past ? 'Expiré' : s.is_full ? 'Complet' :
                           s.available_capacity != null ? `${s.available_capacity} places` : 'Disponible'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {!slot && slots.some(s => !s.is_full && !s.is_past) && (
                  <p className="text-xs text-orange-500 mt-1">⚠ Sélectionnez un créneau pour continuer</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 — PAIEMENT ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-gray-800 text-base">Méthode de paiement</h2>

            <div className="grid grid-cols-2 gap-3">
              {(meta?.payment_methods ?? []).map(pm => {
                const codBlocked = pm.code === 'cod' && pm.cod_max_amount > 0 && (totals?.total_ttc ?? cartTotal) > pm.cod_max_amount;
                return (
                  <button key={pm.id} onClick={() => !codBlocked && setPaymentMethod(pm)} disabled={codBlocked}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                      paymentMethod?.id === pm.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' :
                      codBlocked ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' :
                      'border-gray-200 text-gray-600 hover:border-indigo-300'
                    }`}>
                    <p>{pm.name_fr}</p>
                    <p className="text-xs font-normal text-gray-400">{pm.code}{codBlocked ? ` — max ${fmt(pm.cod_max_amount)}` : ''}</p>
                  </button>
                );
              })}
            </div>

            {/* Wallet */}
            {walletBalance > 0 && walletActive && (
              <div className="bg-blue-50 rounded-xl p-3">
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Utiliser le wallet ({fmt(walletBalance)} disponible)
                </label>
                <input type="range" min={0} max={walletBalance} step={1} value={walletUsed}
                  onChange={e => setWalletUsed(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0 MAD</span>
                  <span className="font-semibold text-indigo-600">{fmt(walletUsed)}</span>
                  <span>{fmt(walletBalance)}</span>
                </div>
              </div>
            )}

            {/* Totaux */}
            {loading && <p className="text-gray-400 text-sm">Calcul en cours...</p>}
            {totals && (
              <div className="bg-gray-50 rounded-xl border p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{fmt(totals.subtotal_ht)}</span></div>
                <div className="flex justify-between text-gray-500"><span>TVA</span><span>{fmt(totals.vat_amount)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Frais livraison</span><span>{fmt(totals.delivery_fee)}</span></div>
                {totals.wallet_used > 0 && <div className="flex justify-between text-green-600"><span>Wallet déduit</span><span>−{fmt(totals.wallet_used)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-1"><span>Total TTC</span><span className="text-indigo-700">{fmt(totals.total_ttc)}</span></div>
                {totals.cod_amount > 0 && <div className="flex justify-between text-orange-600 text-xs"><span>Montant à encaisser (COD)</span><span>{fmt(totals.cod_amount)}</span></div>}
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 4 — CONFIRMATION ────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 text-base">Récapitulatif de la commande</h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Client',     value: customer?.name },
                { label: 'Téléphone',  value: `${customer?.phone_country}${customer?.phone_number}` },
                { label: 'Livraison',  value: deliveryType?.name_fr },
                { label: 'Node',       value: node?.name_fr },
                address && { label: 'Adresse', value: `${address.street_name}, ${address.city}` },
                selectedDate && { label: 'Date', value: selectedDate },
                slot && { label: 'Créneau', value: `${slot.slot_start} – ${slot.slot_end}` },
                { label: 'Paiement',   value: paymentMethod?.name_fr },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800 text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Articles ({cart.length})</p>
              <div className="border rounded-xl divide-y">
                {cart.map(i => (
                  <div key={i.sku_uuid} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-gray-700">{i.name_fr} <span className="text-gray-400">× {i.qty}</span></span>
                    <span className="font-medium">{fmt(i.price * i.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            {totals && (
              <div className="bg-indigo-50 rounded-xl p-4 space-y-1.5 text-sm border border-indigo-100">
                <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{fmt(totals.subtotal_ht)}</span></div>
                <div className="flex justify-between text-gray-500"><span>TVA</span><span>{fmt(totals.vat_amount)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Frais livraison</span><span>{fmt(totals.delivery_fee)}</span></div>
                {totals.wallet_used > 0 && <div className="flex justify-between text-green-600"><span>Wallet</span><span>−{fmt(totals.wallet_used)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total TTC</span><span className="text-indigo-700">{fmt(totals.total_ttc)}</span></div>
              </div>
            )}

            <button onClick={handleCreateOrder} disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-base">
              {loading ? '⏳ Création en cours...' : '✓ Confirmer et créer la commande'}
            </button>
          </div>
        )}

        {/* ── RÉSULTAT ──────────────────────────────────────────────────── */}
        {step === 5 && createdOrder && (
          <div className="space-y-4 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="font-bold text-xl text-gray-900">Commande créée !</h2>
            <p className="text-gray-500 text-sm font-mono bg-gray-100 rounded-lg px-3 py-1 inline-block">
              #{createdOrder.id?.slice(-12).toUpperCase()}
            </p>

            <div className="grid grid-cols-2 gap-3 text-left text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Statut</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{createdOrder.status?.name_fr}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Total TTC</p>
                <p className="font-bold text-lg text-indigo-700">{fmt(createdOrder.total_ttc)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Node</p>
                <p className="font-medium">{createdOrder.node?.name_fr}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Livraison</p>
                <p className="font-medium">{createdOrder.delivery_type?.name_fr}</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-700 text-left space-y-1.5">
              <p>✓ Commande enregistrée</p>
              <p>✓ Stock réservé</p>
              <p>✓ Paiement pending créé</p>
              <p>✓ Historique enregistré</p>
              <p className="text-green-500 text-xs mt-2">→ La commande doit être confirmée avant d'être visible par les pickers</p>
            </div>

            <button onClick={reset}
              className="w-full border-2 border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              + Nouvelle commande
            </button>
          </div>
        )}
      </div>

      {/* Navigation bas */}
      {step < 5 && (
        <div className="flex justify-between mt-4 gap-3">
          <button onClick={back} disabled={step === 0}
            className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition-colors">
            ← Retour
          </button>
          {step < 4 ? (
            <button onClick={next} disabled={!canAdvance()}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors">
              {!canAdvance() && step === 1 ? 'Ajoutez des articles pour continuer' :
               !canAdvance() && step === 2 ? 'Sélectionnez un node pour continuer' :
               !canAdvance() && step === 3 ? 'Choisissez un mode de paiement' :
               'Suivant →'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
