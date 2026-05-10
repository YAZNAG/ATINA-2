import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCheckoutMeta, getDeliverySlots, getEligibleNodes, createOrder } from '../../api/checkout.api';
import { getCustomers, getAddresses } from '../../api/customers.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  home:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  store:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  truck:   'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  pin:     'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  clock:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  card:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  cart:    'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  plus:    'M12 4v16m8-8H4',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  check:   'M5 13l4 4L19 7',
  warn:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  order:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const STEPS = [
  { n: 1, label: 'Client' },
  { n: 2, label: 'Livraison' },
  { n: 3, label: 'Panier' },
  { n: 4, label: 'Paiement' },
  { n: 5, label: 'Confirmer' },
];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              current > s.n ? 'bg-emerald-600 border-emerald-600 text-white' :
              current === s.n ? 'bg-red-600 border-red-600 text-white' :
              'bg-white border-gray-300 text-gray-400'
            }`}>
              {current > s.n ? <Icon d={SVG.check} className="w-4 h-4" /> : s.n}
            </div>
            <p className={`text-[11px] font-semibold mt-1 whitespace-nowrap ${current === s.n ? 'text-red-600' : current > s.n ? 'text-emerald-600' : 'text-gray-400'}`}>{s.label}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-5 ${current > s.n ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          )}
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

export default function CheckoutPage() {
  const navigate = useNavigate();

  // Meta
  const [meta, setMeta] = useState({ delivery_types: [], payment_methods: [] });

  // State per step
  const [step, setStep]   = useState(1);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addresses, setAddresses]   = useState([]);
  const [selectedAddress, setSelectedAddress]   = useState(null);
  const [deliveryTypeId, setDeliveryTypeId]     = useState('');
  const [deliveryDate, setDeliveryDate]         = useState(new Date().toISOString().split('T')[0]);
  const [slotsData, setSlotsData] = useState(null);     // result from getDeliverySlots
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedPickupNode, setSelectedPickupNode] = useState(null);
  const [cartItems, setCartItems] = useState([{ sku_id: '', qty: 1, unit_price: 0, vat_rate: 20 }]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // Load meta on mount
  useEffect(() => {
    getCheckoutMeta().then(r => {
      setMeta(r.data?.data ?? {});
      const cod = r.data?.data?.payment_methods?.find(p => p.code === 'cod');
      if (cod) setPaymentMethodId(cod.id);
      const home = r.data?.data?.delivery_types?.find(d => d.code === 'home');
      if (home) setDeliveryTypeId(home.id);
    }).catch(() => {});
  }, []);

  // Load customers with search
  useEffect(() => {
    const timer = setTimeout(() => {
      getCustomers({ search: customerSearch, limit: 20, is_deleted: 'false' })
        .then(r => setCustomers(r.data?.data?.items ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Load addresses when customer selected
  useEffect(() => {
    if (!selectedCustomer) { setAddresses([]); return; }
    getAddresses(selectedCustomer.id).then(r => {
      const addrs = r.data?.data ?? [];
      setAddresses(addrs);
      const def = addrs.find(a => a.is_default) ?? addrs[0];
      if (def) setSelectedAddress(def);
    }).catch(() => {});
  }, [selectedCustomer]);

  // Reload slots when address/type/date changes
  const loadSlots = useCallback(async () => {
    if (!deliveryTypeId) return;
    const delivType = meta.delivery_types?.find(d => d.id === deliveryTypeId);
    if (!delivType) return;
    if (delivType.code === 'home' && !selectedAddress) return;

    setLoading(true);
    try {
      const params = {
        delivery_type_id: deliveryTypeId,
        date: deliveryDate,
        ...(selectedAddress && { address_id: selectedAddress.id }),
        cart_items: JSON.stringify(cartItems.filter(i => i.sku_id)),
      };
      const res = await getDeliverySlots(params);
      setSlotsData(res.data?.data ?? null);
      setSelectedSlot(null);
      setSelectedPickupNode(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [deliveryTypeId, selectedAddress, deliveryDate, meta.delivery_types]);

  useEffect(() => { if (step === 2) loadSlots(); }, [step, loadSlots]);

  const currentDelivType = meta.delivery_types?.find(d => d.id === deliveryTypeId);

  // Cart helpers
  const updateCartItem = (i, field, val) => setCartItems(items => items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const removeCartItem = (i) => setCartItems(items => items.filter((_, idx) => idx !== i));
  const addCartItem    = () => setCartItems(items => [...items, { sku_id: '', qty: 1, unit_price: 0, vat_rate: 20 }]);

  const cartTotal = cartItems.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_price || 0), 0);

  // Confirm order
  const handleConfirm = async () => {
    if (!selectedCustomer) return toast.error('Client requis');
    if (!deliveryTypeId)   return toast.error('Type de livraison requis');
    if (!cartItems.some(i => i.sku_id || i.pack_id)) return toast.error('Panier vide — ajoutez au moins un article');

    setCreating(true);
    try {
      const node_id = selectedPickupNode?.id ?? slotsData?.node?.id;
      const res = await createOrder({
        customer_id:       selectedCustomer.id,
        address_id:        selectedAddress?.id ?? null,
        delivery_type_id:  deliveryTypeId,
        node_id:           node_id ?? undefined,
        selected_slot_id:  selectedSlot?.id ?? null,
        payment_method_id: paymentMethodId || null,
        cart_items:        cartItems.filter(i => i.sku_id || i.pack_id),
        notes,
      });
      setCreatedOrder(res.data?.data);
      setStep(5);
      toast.success('Commande créée avec succès !');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setCreating(false); }
  };

  // ── STEP 5 — Success ─────────────────────────────────────────────────────────
  if (step === 5 && createdOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <Icon d={SVG.check} className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Commande créée !</h1>
          <p className="text-sm text-gray-500 mb-6">La commande a été transmise au node de préparation.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">N° commande</span><span className="font-mono font-bold text-gray-800 text-xs">{createdOrder.id?.slice(0, 8)}…</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-semibold text-amber-600">{createdOrder.status?.name_fr ?? 'En attente'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Node</span><span className="font-semibold">{createdOrder.node?.name_fr ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total TTC</span><span className="font-bold text-gray-900">{Number(createdOrder.total_ttc).toFixed(2)} MAD</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setCreatedOrder(null); setSelectedCustomer(null); setSelectedAddress(null); setSlotsData(null); setCartItems([{ sku_id: '', qty: 1, unit_price: 0, vat_rate: 20 }]); }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
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
          <p className="text-sm text-gray-400 mt-0.5">Le node est sélectionné automatiquement selon l'adresse pour une livraison à domicile</p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl">
        <StepBar current={step} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* STEP 1 — Client & Adresse */}
            {step === 1 && (
              <>
                <Card title="Client" icon={SVG.cart}>
                  <div className="mb-3">
                    <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Rechercher client par nom / téléphone…"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customers.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setSelectedAddress(null); }}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedCustomer?.id === c.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                        <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{c.phone_country} {c.phone_number}</p>
                      </button>
                    ))}
                    {customers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Aucun client</p>}
                  </div>
                </Card>

                {selectedCustomer && (
                  <Card title="Adresse de livraison" icon={SVG.pin}>
                    {addresses.length === 0 ? (
                      <p className="text-sm text-gray-400">Ce client n'a pas d'adresses enregistrées</p>
                    ) : (
                      <div className="space-y-2">
                        {addresses.filter(a => !a.is_deleted).map(addr => (
                          <button key={addr.id} onClick={() => setSelectedAddress(addr)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedAddress?.id === addr.id ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              {addr.label && <span className="text-xs font-semibold text-gray-500 uppercase">{addr.label}</span>}
                              {addr.is_default && <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Par défaut</span>}
                            </div>
                            <p className="text-sm font-medium text-gray-800">{addr.street_number && `${addr.street_number} `}{addr.street_name}</p>
                            <p className="text-xs text-gray-500">{addr.postal_code && `${addr.postal_code} `}{addr.city}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                <button onClick={() => setStep(2)} disabled={!selectedCustomer}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl transition-colors">
                  Continuer → Livraison
                </button>
              </>
            )}

            {/* STEP 2 — Type livraison + node + créneaux */}
            {step === 2 && (
              <>
                <Card title="Type de livraison" icon={SVG.truck}>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {meta.delivery_types?.map(dt => (
                      <button key={dt.id} onClick={() => { setDeliveryTypeId(dt.id); setSlotsData(null); setSelectedSlot(null); setSelectedPickupNode(null); }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${deliveryTypeId === dt.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <Icon d={dt.code === 'home' ? SVG.home : SVG.store} className={`w-6 h-6 mb-2 ${deliveryTypeId === dt.id ? 'text-red-600' : 'text-gray-400'}`} />
                        <p className="font-semibold text-sm text-gray-800">{dt.name_fr}</p>
                        <p className="text-[11px] text-gray-400">{dt.code === 'home' ? 'Node auto-sélectionné' : 'Vous choisissez le node'}</p>
                      </button>
                    ))}
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date de livraison souhaitée</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>

                  <button onClick={loadSlots} disabled={loading || !deliveryTypeId}
                    className="w-full py-2.5 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-40">
                    {loading ? 'Recherche des créneaux…' : 'Chercher les créneaux disponibles'}
                  </button>
                </Card>

                {/* Home delivery result */}
                {slotsData && currentDelivType?.code === 'home' && (
                  <Card title="Node sélectionné automatiquement" icon={SVG.node}>
                    {!slotsData.node ? (
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <Icon d={SVG.warn} className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-amber-800">{slotsData.message ?? 'Aucun node disponible'}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Vérifiez que des nodes actifs couvrent la ville de l'adresse et ont des créneaux configurés</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <Icon d={SVG.node} className="w-5 h-5 text-emerald-700" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-emerald-800">{slotsData.node.name_fr}</p>
                            <p className="text-xs text-emerald-600">{slotsData.node.city?.name_fr}{slotsData.node.distance_km ? ` · ${slotsData.node.distance_km} km` : ''}</p>
                          </div>
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Auto ✓</span>
                        </div>

                        {slotsData.slots?.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-3">Aucun créneau disponible pour cette date</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {slotsData.slots?.map(s => (
                              <button key={s.id} onClick={() => setSelectedSlot(s)}
                                className={`p-3 rounded-xl border-2 text-left transition-all ${selectedSlot?.id === s.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <div className="flex items-center gap-1 mb-1">
                                  <Icon d={SVG.clock} className="w-3.5 h-3.5 text-gray-500" />
                                  <span className="text-xs font-mono font-semibold text-gray-700">{s.slot_start} – {s.slot_end}</span>
                                </div>
                                <p className="text-[11px] text-gray-600 truncate">{s.name_fr}</p>
                                {s.available_capacity !== null && (
                                  <p className="text-[10px] text-emerald-600 mt-0.5">{s.available_capacity} place{s.available_capacity > 1 ? 's' : ''}</p>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                )}

                {/* Pickup result */}
                {slotsData && currentDelivType?.code === 'pickup' && (
                  <Card title="Choisir un node de retrait" icon={SVG.store}>
                    {!slotsData.pickup_nodes?.length ? (
                      <p className="text-sm text-gray-500">Aucun node pickup disponible</p>
                    ) : (
                      <div className="space-y-3">
                        {slotsData.pickup_nodes.map(n => (
                          <div key={n.id} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPickupNode?.id === n.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => { setSelectedPickupNode(n); setSelectedSlot(null); }}>
                            <p className="font-bold text-gray-900 text-sm">{n.name_fr}</p>
                            <p className="text-xs text-gray-500 mb-2">{n.city?.name_fr}</p>
                            {selectedPickupNode?.id === n.id && n.slots?.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {n.slots.filter(s => !s.is_full).map(s => (
                                  <button key={s.id} onClick={e => { e.stopPropagation(); setSelectedSlot(s); }}
                                    className={`p-2 rounded-lg border text-left text-xs transition-all ${selectedSlot?.id === s.id ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <span className="font-mono">{s.slot_start}–{s.slot_end}</span>
                                    <span className="text-gray-500 ml-1">({DAYS[s.day_of_week]})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(3)} disabled={!deliveryTypeId || (currentDelivType?.code === 'home' && !slotsData?.node) || (currentDelivType?.code === 'pickup' && !selectedPickupNode)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    Continuer → Panier
                  </button>
                </div>
              </>
            )}

            {/* STEP 3 — Panier */}
            {step === 3 && (
              <>
                <Card title="Articles du panier" icon={SVG.cart}>
                  <div className="space-y-3">
                    {cartItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="col-span-5">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-0.5">SKU ID</label>
                          <input value={item.sku_id} onChange={e => updateCartItem(i, 'sku_id', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400" placeholder="UUID sku" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-0.5">Qté</label>
                          <input type="number" min="1" value={item.qty} onChange={e => updateCartItem(i, 'qty', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400" />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-0.5">Prix TTC</label>
                          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateCartItem(i, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400" />
                        </div>
                        <div className="col-span-2 flex items-end justify-end pb-0.5">
                          {cartItems.length > 1 && (
                            <button onClick={() => removeCartItem(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                              <Icon d={SVG.trash} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={addCartItem} className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 hover:border-red-300 text-gray-500 hover:text-red-600 text-sm font-semibold rounded-xl transition-colors">
                    <Icon d={SVG.plus} className="w-4 h-4" />Ajouter un article
                  </button>
                </Card>

                <Card title="Notes commande" icon={SVG.order}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Instructions spéciales, remarques…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" />
                </Card>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={() => setStep(4)} disabled={!cartItems.some(i => i.sku_id)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    Continuer → Paiement
                  </button>
                </div>
              </>
            )}

            {/* STEP 4 — Paiement */}
            {step === 4 && (
              <>
                <Card title="Méthode de paiement" icon={SVG.card}>
                  <div className="space-y-2">
                    {meta.payment_methods?.map(pm => (
                      <button key={pm.id} onClick={() => setPaymentMethodId(pm.id)}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${paymentMethodId === pm.id ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-3">
                          <Icon d={SVG.card} className={`w-5 h-5 ${paymentMethodId === pm.id ? 'text-red-600' : 'text-gray-400'}`} />
                          <div>
                            <p className="font-semibold text-sm text-gray-800">{pm.name_fr}</p>
                            <p className="text-[11px] font-mono text-gray-400">{pm.code}</p>
                          </div>
                          {paymentMethodId === pm.id && <Icon d={SVG.check} className="w-5 h-5 text-red-600 ml-auto" />}
                        </div>
                      </button>
                    ))}
                    {!meta.payment_methods?.length && <p className="text-sm text-gray-400">Aucune méthode de paiement active</p>}
                  </div>
                </Card>

                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">← Retour</button>
                  <button onClick={handleConfirm} disabled={creating}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl">
                    {creating ? 'Création en cours…' : 'Confirmer la commande →'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Summary sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-900 text-sm">Récapitulatif</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Icon d={SVG.cart} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-gray-500 text-xs">Client</p><p className="font-semibold text-gray-800">{selectedCustomer?.name ?? '—'}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon d={SVG.pin} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-gray-500 text-xs">Adresse</p><p className="font-semibold text-gray-800 text-xs">{selectedAddress ? `${selectedAddress.street_name}, ${selectedAddress.city}` : '—'}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Icon d={SVG.truck} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div><p className="text-gray-500 text-xs">Livraison</p><p className="font-semibold text-gray-800">{currentDelivType?.name_fr ?? '—'}</p></div>
                </div>
                {(slotsData?.node || selectedPickupNode) && (
                  <div className="flex items-start gap-2">
                    <Icon d={SVG.node} className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div><p className="text-gray-500 text-xs">Node</p><p className="font-semibold text-emerald-700 text-xs">{slotsData?.node?.name_fr ?? selectedPickupNode?.name_fr}</p></div>
                  </div>
                )}
                {selectedSlot && (
                  <div className="flex items-start gap-2">
                    <Icon d={SVG.clock} className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div><p className="text-gray-500 text-xs">Créneau</p><p className="font-semibold text-gray-800 text-xs">{deliveryDate} · {selectedSlot.slot_start}–{selectedSlot.slot_end}</p></div>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{cartItems.filter(i => i.sku_id).length} article{cartItems.filter(i => i.sku_id).length !== 1 ? 's' : ''}</span>
                  <span className="font-bold text-gray-900">{cartTotal.toFixed(2)} MAD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
