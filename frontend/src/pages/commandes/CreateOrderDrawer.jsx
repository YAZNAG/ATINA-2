import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, MapPin, Minus, Package,
  Plus, Search, ShoppingCart, Trash2, User, X,
} from 'lucide-react';

import {
  calculateCart, createCheckoutCustomer, createCustomerAddress, createOrder, getCheckoutCities,
  getCheckoutMeta, getCustomerAddresses, getNodeSlots, getNodeSummary, searchCustomers,
  searchNodeArticles, searchNodePacks,
} from '../../api/checkout.api';

// Création manuelle d'une commande (WF #27, US-106 / US-108) — fenêtre à onglets.
const TABS = [
  { key: 'customer', label: 'Client', icon: User },
  { key: 'node', label: 'Nœud', icon: MapPin },
  { key: 'articles', label: 'Articles', icon: Package },
  { key: 'address', label: 'Adresse', icon: MapPin },
  { key: 'slots', label: 'Créneaux', icon: CalendarDays },
  { key: 'confirmation', label: 'Confirmation', icon: Check },
];

const unwrap = (r) => r?.data?.data ?? r?.data ?? r;
const errMsg = (err, fallback) => err?.response?.data?.message || fallback;
const money = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const isPickupCode = (c) => ['pickup', 'in_store'].includes(String(c || '').toLowerCase());

function addressLabel(a) {
  return [[a.street_number, a.street_name].filter(Boolean).join(' '), a.quartier, a.city, a.postal_code].filter(Boolean).join(', ');
}
function dayLabel(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const EMPTY_CUSTOMER = { name: '', phone_country: '+212', phone_number: '', city_id: '' };
const EMPTY_ADDRESS = { label: '', street_number: '', street_name: '', quartier: '', city_id: '', postal_code: '', delivery_notes: '', recipient_name: '', phone: '' };

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>{children}</label>;
}
const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100';

export default function CreateOrderDrawer({ open, nodes = [], onClose, onCreated }) {
  const [tab, setTab] = useState('customer');
  const [error, setError] = useState(null);

  // Client
  const [customer, setCustomer] = useState(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [cities, setCities] = useState([]);

  // Nœud
  const [node, setNode] = useState(null);
  const [nodeSummary, setNodeSummary] = useState(null);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [deliveryTypeCode, setDeliveryTypeCode] = useState('home');

  // Articles
  const [artSearch, setArtSearch] = useState('');
  const [articles, setArticles] = useState([]);
  const [packs, setPacks] = useState([]);
  const [cart, setCart] = useState([]);

  // Adresse
  const [addresses, setAddresses] = useState([]);
  const [address, setAddress] = useState(null);
  const [newAddressOpen, setNewAddressOpen] = useState(false);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);

  // Créneaux
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);

  // Confirmation
  const [promoCode, setPromoCode] = useState('');
  const [notes, setNotes] = useState('');
  const [calc, setCalc] = useState(null);
  const [busy, setBusy] = useState(false);

  const isPickup = isPickupCode(deliveryTypeCode);

  // Réinitialisation à l'ouverture
  useEffect(() => {
    if (!open) return;
    setTab('customer'); setError(null); setCustomer(null); setCustSearch(''); setNewCustomerOpen(false); setNewCustomer(EMPTY_CUSTOMER);
    setNode(null); setNodeSummary(null); setDeliveryTypeCode('home'); setCart([]); setArticles([]); setPacks([]); setArtSearch('');
    setAddresses([]); setAddress(null); setNewAddressOpen(false); setNewAddress(EMPTY_ADDRESS);
    setSlots([]); setSlot(null); setPromoCode(''); setNotes(''); setCalc(null);
    getCheckoutCities('').then((r) => setCities(unwrap(r) || [])).catch(() => setCities([]));
  }, [open]);

  // Recherche client (nom / téléphone)
  useEffect(() => {
    if (!open || tab !== 'customer') return undefined;
    const t = setTimeout(() => {
      searchCustomers(custSearch.trim() || undefined).then((r) => setCustResults(unwrap(r) || [])).catch(() => setCustResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, tab, custSearch]);

  // Nœud : paramètres (frais, minimum, sélection de créneau) + types de livraison
  useEffect(() => {
    if (!node?.id) return;
    setNodeSummary(null);
    getNodeSummary(node.id).then((r) => setNodeSummary(unwrap(r))).catch((err) => setError(errMsg(err, 'Paramètres du nœud indisponibles')));
    getCheckoutMeta(node.id).then((r) => setDeliveryTypes(unwrap(r)?.delivery_types || [])).catch(() => setDeliveryTypes([]));
  }, [node?.id]);

  // Articles vendables sur le nœud + packs
  useEffect(() => {
    if (!open || !node?.id || tab !== 'articles') return undefined;
    const t = setTimeout(() => {
      searchNodeArticles({ node_id: node.id, search: artSearch.trim() || undefined, limit: 30 }).then((r) => setArticles(unwrap(r) || [])).catch(() => setArticles([]));
      searchNodePacks({ node_id: node.id, search: artSearch.trim() || undefined }).then((r) => setPacks(unwrap(r) || [])).catch(() => setPacks([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, node?.id, tab, artSearch]);

  // Adresses du client
  const loadAddresses = useCallback(() => {
    if (!customer?.id) return;
    getCustomerAddresses(customer.id).then((r) => {
      const list = unwrap(r) || [];
      setAddresses(list);
      setAddress((cur) => cur || list.find((a) => a.is_default) || list[0] || null);
    }).catch(() => setAddresses([]));
  }, [customer?.id]);
  useEffect(() => { if (tab === 'address') loadAddresses(); }, [tab, loadAddresses]);

  // Créneaux datés actifs du nœud (14 jours)
  useEffect(() => {
    if (!node?.id || tab !== 'slots') return;
    getNodeSlots({ node_id: node.id, days: 14 }).then((r) => setSlots(unwrap(r) || [])).catch(() => setSlots([]));
  }, [node?.id, tab]);

  const cartPayload = useMemo(() => cart.map((c) => (c.type === 'pack' ? { pack_id: c.id, qty: c.qty } : { sku_id: c.id, qty: c.qty })), [cart]);

  // Calcul serveur (onglet Confirmation)
  const recalc = useCallback(async () => {
    if (!node?.id || !cartPayload.length) return;
    setBusy(true);
    try {
      const r = await calculateCart({
        node_id: node.id, delivery_type_code: deliveryTypeCode, cart_items: cartPayload,
        payment_method_code: 'cod', customer_id: customer?.id, promo_code: promoCode.trim() || null, soft_minimum: true,
      });
      setCalc(unwrap(r));
      setError(null);
    } catch (err) {
      setCalc(null);
      setError(errMsg(err, 'Erreur lors du calcul de la commande'));
    } finally {
      setBusy(false);
    }
  }, [node?.id, deliveryTypeCode, cartPayload, customer?.id, promoCode]);

  useEffect(() => { if (tab === 'confirmation') recalc(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────
  function chooseNode(n) {
    if (node?.id === n.id) return;
    setNode(n); setCart([]); setSlot(null); setCalc(null);
  }

  function addToCart(item, type) {
    setCart((prev) => {
      const found = prev.find((c) => c.id === item.id && c.type === type);
      const max = type === 'pack' ? (item.remaining_cap ?? null) : (item.max_qty ?? null);
      if (found) {
        if (max != null && found.qty + 1 > max) { setError(`Quantité maximale atteinte pour « ${item.name_fr} » (${max}).`); return prev; }
        return prev.map((c) => (c === found ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { id: item.id, type, name: item.name_fr, price: Number(item.price || 0), qty: 1, max, backorder: type === 'sku' && Number(item.qty_available) <= 0 }];
    });
    setCalc(null);
  }

  function setQty(line, qty) {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (line.max != null && q > line.max) { setError(`Quantité maximale : ${line.max}.`); return; }
    setCart((prev) => (q === 0 ? prev.filter((c) => c !== line) : prev.map((c) => (c === line ? { ...c, qty: q } : c))));
    setCalc(null);
  }

  async function saveNewCustomer() {
    setBusy(true); setError(null);
    try {
      const c = unwrap(await createCheckoutCustomer({ ...newCustomer, city_id: newCustomer.city_id || undefined }));
      setCustomer(c); setNewCustomerOpen(false); setNewCustomer(EMPTY_CUSTOMER); setAddress(null); setAddresses([]);
    } catch (err) { setError(errMsg(err, 'Création du client impossible')); } finally { setBusy(false); }
  }

  async function saveNewAddress() {
    setBusy(true); setError(null);
    try {
      const a = unwrap(await createCustomerAddress(customer.id, newAddress));
      setNewAddressOpen(false); setNewAddress(EMPTY_ADDRESS); setAddress(a); loadAddresses();
    } catch (err) { setError(errMsg(err, "Création de l'adresse impossible")); } finally { setBusy(false); }
  }

  const tabIndex = TABS.findIndex((t) => t.key === tab);
  const tabValid = {
    customer: !!customer,
    node: !!node && !!nodeSummary,
    articles: cart.length > 0,
    address: isPickup || !!address,
    slots: true, // créneau facultatif à la création
    confirmation: !!calc && !calc.below_minimum,
  };
  const blockedMsg = {
    customer: 'Sélectionnez ou créez un client.',
    node: 'Sélectionnez le nœud qui prépare et livre.',
    articles: 'Ajoutez au moins un article.',
    address: 'Choisissez ou créez une adresse de livraison.',
  };

  function goTo(key) {
    const idx = TABS.findIndex((t) => t.key === key);
    for (let i = 0; i < idx; i += 1) {
      if (!tabValid[TABS[i].key]) { setError(blockedMsg[TABS[i].key] || null); setTab(TABS[i].key); return; }
    }
    setError(null);
    setTab(key);
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await createOrder({
        customer_id: customer.id,
        address_id: isPickup ? undefined : address?.id,
        delivery_type_code: deliveryTypeCode,
        node_id: node.id,
        selected_slot_id: slot?.id || undefined,
        payment_method_code: 'cod',
        cart_items: cartPayload,
        promo_code: promoCode.trim() || undefined,
        notes: notes.trim() || undefined,
        initial_status_code: 'pending',
      });
      await onCreated?.(unwrap(r));
      onClose?.();
    } catch (err) {
      setError(errMsg(err, 'Erreur lors de la création de la commande'));
    } finally {
      setBusy(false);
    }
  }

  const slotsByDay = useMemo(() => {
    const g = {};
    for (const s of slots) (g[s.date] = g[s.date] || []).push(s);
    return Object.entries(g);
  }, [slots]);

  if (!open) return null;

  // ── Rendu des onglets ──────────────────────────────────────────────────────
  const renderCustomer = () => (
    <div className="space-y-4">
      {customer && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span><Check size={14} className="mr-1 inline text-emerald-600" /><strong>{customer.name}</strong> — {customer.phone_country}{customer.phone_number}</span>
          <button type="button" onClick={() => setCustomer(null)} className="text-xs text-gray-500 hover:underline">Changer</button>
        </div>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Rechercher un client (nom ou téléphone)…" className={`${inputCls} pl-9`} />
      </div>
      <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
        {custResults.length === 0 && <div className="p-4 text-center text-sm text-gray-400">Aucun client trouvé.</div>}
        {custResults.map((c) => (
          <button key={c.id} type="button" disabled={!c.is_active} onClick={() => { setCustomer(c); setAddress(null); setAddresses([]); }}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 ${customer?.id === c.id ? 'bg-red-50' : ''}`}
          >
            <span><span className="font-medium text-gray-800">{c.name}</span> <span className="text-gray-400">{c.phone_country}{c.phone_number}</span></span>
            <span className="text-xs text-gray-400">{c.is_active ? (c.city || '') : 'Compte bloqué'}</span>
          </button>
        ))}
      </div>
      {!newCustomerOpen ? (
        <button type="button" onClick={() => setNewCustomerOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"><Plus size={14} /> Nouveau client</button>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold text-gray-700">Nouveau client</div>
          <Field label="Nom complet *"><input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className={inputCls} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Indicatif"><input value={newCustomer.phone_country} onChange={(e) => setNewCustomer({ ...newCustomer, phone_country: e.target.value })} className={inputCls} /></Field>
            <div className="col-span-2"><Field label="Téléphone *"><input value={newCustomer.phone_number} onChange={(e) => setNewCustomer({ ...newCustomer, phone_number: e.target.value })} placeholder="6XXXXXXXX" className={inputCls} /></Field></div>
          </div>
          <Field label="Ville">
            <select value={newCustomer.city_id} onChange={(e) => setNewCustomer({ ...newCustomer, city_id: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !newCustomer.name.trim() || !newCustomer.phone_number.trim()} onClick={saveNewCustomer} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Créer le client</button>
            <button type="button" onClick={() => setNewCustomerOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );

  const renderNode = () => (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Le nœud (dark store) prépare et livre la commande : il détermine le catalogue vendable, les créneaux, les frais de livraison et le montant minimum.</p>
      <div className="grid grid-cols-2 gap-2">
        {nodes.map((n) => (
          <button key={n.id} type="button" onClick={() => chooseNode(n)}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm ${node?.id === n.id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}
          >
            <div className="font-medium text-gray-800">{n.name_fr}</div>
            <div className="text-xs text-gray-400">{n.code}{n.city?.name_fr ? ` · ${n.city.name_fr}` : ''}</div>
          </button>
        ))}
        {nodes.length === 0 && <div className="col-span-2 rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Aucun nœud actif.</div>}
      </div>
      {node && !nodeSummary && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Paramètres du nœud…</div>}
      {nodeSummary && (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Frais de livraison</div><div className="font-semibold">{money(nodeSummary.delivery_fee)}</div></div>
          <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Montant minimum</div><div className="font-semibold">{money(nodeSummary.min_order_amount)}</div></div>
          <div className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">Sélection de créneau</div><div className="font-semibold">{nodeSummary.slot_selection_enabled ? 'Activée' : 'Désactivée'}</div></div>
        </div>
      )}
      {node && (
        <Field label="Mode de livraison">
          <div className="flex gap-2">
            {(deliveryTypes.length ? deliveryTypes : [{ code: 'home', name_fr: 'Livraison à domicile' }, { code: 'pickup', name_fr: 'Retrait magasin' }]).map((dt) => (
              <button key={dt.code} type="button" onClick={() => { setDeliveryTypeCode(dt.code); setCalc(null); }}
                className={`rounded-lg border px-3 py-1.5 text-sm ${deliveryTypeCode === dt.code ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200'}`}
              >{dt.name_fr || dt.code}</button>
            ))}
          </div>
        </Field>
      )}
      <p className="text-xs text-gray-400">Paiement à la livraison uniquement : aucun encaissement à la création.</p>
    </div>
  );

  const renderArticles = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={artSearch} onChange={(e) => setArtSearch(e.target.value)} placeholder={`Rechercher un produit ou un pack vendable sur ${node?.name_fr || 'le nœud'}…`} className={`${inputCls} pl-9`} />
      </div>
      <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
        {articles.length === 0 && packs.length === 0 && <div className="p-4 text-center text-sm text-gray-400">Aucun article trouvé.</div>}
        {packs.map((p) => (
          <div key={`p-${p.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium text-gray-800"><Package size={13} className="mr-1 inline text-violet-500" />{p.name_fr}</div>
              <div className="text-xs text-gray-400">{money(p.price)}{Number(p.original_price) > Number(p.price) ? <span className="ml-1 line-through">{money(p.original_price)}</span> : null}{p.remaining_cap != null ? ` · ${p.remaining_cap} restant(s)` : ''}</div>
              {p.refusal && <div className="text-xs text-rose-600">{p.refusal}</div>}
            </div>
            <button type="button" disabled={!!p.refusal} onClick={() => addToCart(p, 'pack')} className="rounded-md bg-red-600 p-1.5 text-white disabled:bg-gray-200 disabled:text-gray-400" aria-label="Ajouter"><Plus size={14} /></button>
          </div>
        ))}
        {articles.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium text-gray-800">{a.name_fr}</div>
              <div className="text-xs text-gray-400">{a.sku_code} · {money(a.price)} · dispo {a.qty_available}{a.is_backorderable ? ' · vente en rupture autorisée' : ''}</div>
              {a.refusal && <div className="text-xs text-rose-600">{a.refusal}</div>}
            </div>
            <button type="button" disabled={!!a.refusal} onClick={() => addToCart(a, 'sku')} className="rounded-md bg-red-600 p-1.5 text-white disabled:bg-gray-200 disabled:text-gray-400" aria-label="Ajouter"><Plus size={14} /></button>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700"><ShoppingCart size={15} /> Panier ({cart.length})</div>
        {cart.length === 0 ? <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Panier vide.</div> : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {cart.map((c) => (
              <div key={`${c.type}-${c.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800">{c.type === 'pack' && <Package size={12} className="mr-1 inline text-violet-500" />}{c.name}</div>
                  <div className="text-xs text-gray-400">{money(c.price)} / unité{c.backorder ? ' · en rupture (réappro.)' : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(c, c.qty - 1)} className="rounded border border-gray-200 p-1"><Minus size={12} /></button>
                  <input value={c.qty} onChange={(e) => setQty(c, e.target.value)} className="w-12 rounded border border-gray-200 px-1 py-0.5 text-center" />
                  <button type="button" onClick={() => setQty(c, c.qty + 1)} className="rounded border border-gray-200 p-1"><Plus size={12} /></button>
                  <button type="button" onClick={() => setQty(c, 0)} className="ml-1 rounded p-1 text-gray-400 hover:text-red-600" aria-label="Retirer"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAddress = () => (
    <div className="space-y-4">
      {isPickup ? <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">Retrait magasin : aucune adresse de livraison n'est nécessaire.</div> : (
        <>
          <div className="space-y-2">
            {addresses.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Ce client n'a aucune adresse enregistrée.</div>}
            {addresses.map((a) => (
              <button key={a.id} type="button" onClick={() => setAddress(a)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${address?.id === a.id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'}`}
              >
                <div className="font-medium text-gray-800">{a.label || 'Adresse'}{a.is_default ? <span className="ml-2 text-xs text-gray-400">(par défaut)</span> : null}</div>
                <div className="text-xs text-gray-500">{addressLabel(a)}</div>
              </button>
            ))}
          </div>
          {!newAddressOpen ? (
            <button type="button" onClick={() => setNewAddressOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"><Plus size={14} /> Nouvelle adresse</button>
          ) : (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-semibold text-gray-700">Nouvelle adresse (rattachée à une ville)</div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="N°"><input value={newAddress.street_number} onChange={(e) => setNewAddress({ ...newAddress, street_number: e.target.value })} className={inputCls} /></Field>
                <div className="col-span-2"><Field label="Rue / adresse *"><input value={newAddress.street_name} onChange={(e) => setNewAddress({ ...newAddress, street_name: e.target.value })} className={inputCls} /></Field></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quartier"><input value={newAddress.quartier} onChange={(e) => setNewAddress({ ...newAddress, quartier: e.target.value })} className={inputCls} /></Field>
                <Field label="Ville *">
                  <select value={newAddress.city_id} onChange={(e) => setNewAddress({ ...newAddress, city_id: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                  </select>
                </Field>
                <Field label="Code postal"><input value={newAddress.postal_code} onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })} className={inputCls} /></Field>
                <Field label="Libellé"><input value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} placeholder="Maison, bureau…" className={inputCls} /></Field>
                <Field label="Destinataire"><input value={newAddress.recipient_name} onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })} className={inputCls} /></Field>
                <Field label="Téléphone"><input value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Instructions de livraison"><textarea rows={2} value={newAddress.delivery_notes} onChange={(e) => setNewAddress({ ...newAddress, delivery_notes: e.target.value })} className={inputCls} /></Field>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !newAddress.street_name.trim() || !newAddress.city_id} onClick={saveNewAddress} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Enregistrer l'adresse</button>
                <button type="button" onClick={() => setNewAddressOpen(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">Annuler</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderSlots = () => (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Créneau facultatif à la création : il pourra être confirmé plus tard depuis l'onglet Créneaux de la commande. La capacité est affichée mais ne bloque pas.</p>
      {slot && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span><Check size={14} className="mr-1 inline text-emerald-600" />{dayLabel(slot.date)} · {slot.slot_start}–{slot.slot_end}</span>
          <button type="button" onClick={() => setSlot(null)} className="text-xs text-gray-500 hover:underline">Aucun créneau</button>
        </div>
      )}
      {slotsByDay.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">Aucun créneau daté actif sur les 14 prochains jours pour ce nœud.</div>}
      {slotsByDay.map(([day, list]) => (
        <div key={day}>
          <div className="mb-1.5 text-xs font-semibold capitalize text-gray-500">{dayLabel(day)}</div>
          <div className="grid grid-cols-3 gap-2">
            {list.map((s) => (
              <button key={s.id} type="button" disabled={s.is_past} onClick={() => setSlot(s)}
                className={`rounded-lg border px-2 py-2 text-left text-xs ${slot?.id === s.id ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'} disabled:opacity-40`}
              >
                <div className="font-semibold text-gray-800">{s.slot_start}–{s.slot_end}</div>
                {s.name_fr && <div className="text-gray-500">{s.name_fr}</div>}
                <div className={s.is_full ? 'text-rose-600' : 'text-gray-500'}>{s.reservations}/{s.max_orders}{s.is_full ? ' — complet' : ''}{s.is_past ? ' — passé' : ''}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {slot?.is_full && <div className="text-xs text-amber-700"><AlertTriangle size={13} className="mr-1 inline" />Créneau complet : l'affectation sera enregistrée malgré tout.</div>}
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-3 gap-y-1.5 rounded-lg border border-gray-200 bg-white p-3">
        <dt className="text-gray-500">Client</dt><dd className="col-span-2">{customer?.name} — {customer?.phone_country}{customer?.phone_number}</dd>
        <dt className="text-gray-500">Nœud</dt><dd className="col-span-2">{node?.name_fr}</dd>
        <dt className="text-gray-500">Livraison</dt><dd className="col-span-2">{isPickup ? 'Retrait magasin' : (address ? addressLabel(address) : '–')}</dd>
        <dt className="text-gray-500">Créneau</dt><dd className="col-span-2">{slot ? `${dayLabel(slot.date)} · ${slot.slot_start}–${slot.slot_end}` : 'À affecter plus tard'}</dd>
        <dt className="text-gray-500">Paiement</dt><dd className="col-span-2">À la livraison (aucun encaissement maintenant)</dd>
      </dl>
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Code promo"><input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Optionnel" className={inputCls} /></Field></div>
        <button type="button" onClick={recalc} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Appliquer</button>
      </div>
      {busy && !calc && <div className="flex items-center gap-2 text-gray-500"><Loader2 size={14} className="animate-spin" /> Calcul…</div>}
      {calc && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="divide-y divide-gray-100">
            {calc.items.map((it, i) => (
              <div key={i} className="flex justify-between py-1.5">
                <span className="text-gray-700">{it.name_fr} × {it.qty}{it.flash_sale_name ? <span className="ml-1 text-xs text-amber-600">({it.flash_sale_name})</span> : null}</span>
                <span>{money(it.line_total)}</span>
              </div>
            ))}
          </div>
          <dl className="mt-2 space-y-1 border-t border-gray-100 pt-2">
            <div className="flex justify-between text-gray-500"><dt>Sous-total</dt><dd>{money(calc.subtotal_ttc)}</dd></div>
            <div className="flex justify-between text-gray-500"><dt>Frais de livraison</dt><dd>{money(calc.delivery_fee)}</dd></div>
            {Number(calc.discount_amount) > 0 && <div className="flex justify-between text-emerald-600"><dt>Remise code promo</dt><dd>− {money(calc.discount_amount)}</dd></div>}
            <div className="flex justify-between text-base font-semibold"><dt>Total à encaisser à la livraison</dt><dd>{money(calc.total_ttc)}</dd></div>
          </dl>
          {calc.coupon_error && <div className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">Code promo : {calc.coupon_error}</div>}
          {calc.pack_error && <div className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-600">{calc.pack_error}</div>}
          {calc.below_minimum ? (
            <div className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-600">
              Montant minimum non atteint : {money(calc.min_order_amount)} requis sur le sous-total payé ({money(calc.paid_subtotal_ttc)}), il manque {money(calc.minimum_gap)}.
            </div>
          ) : calc.min_order_amount > 0 && (
            <div className="mt-2 text-xs text-emerald-600">Montant minimum ({money(calc.min_order_amount)}) atteint.</div>
          )}
        </div>
      )}
      <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Commande prise par téléphone…" /></Field>
    </div>
  );

  const RENDER = { customer: renderCustomer, node: renderNode, articles: renderArticles, address: renderAddress, slots: renderSlots, confirmation: renderConfirmation };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Créer une commande</h2>
            <p className="text-xs text-gray-500">Commande manuelle (ex. prise par téléphone) — paiement à la livraison</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </header>
        <nav className="flex overflow-x-auto border-b border-gray-100">
          {TABS.map((t, i) => (
            <button key={t.key} type="button" onClick={() => goTo(t.key)}
              className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium ${tab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < tabIndex && tabValid[t.key] ? 'bg-emerald-500 text-white' : tab === t.key ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {i < tabIndex && tabValid[t.key] ? <Check size={11} /> : i + 1}
              </span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
          {RENDER[tab]()}
        </div>
        <footer className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">Annuler</button>
          <div className="flex gap-2">
            {tabIndex > 0 && <button type="button" onClick={() => { setError(null); setTab(TABS[tabIndex - 1].key); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"><ChevronLeft size={15} /> Précédent</button>}
            {tab !== 'confirmation' ? (
              <button type="button" onClick={() => { if (!tabValid[tab]) { setError(blockedMsg[tab] || null); return; } goTo(TABS[tabIndex + 1].key); }} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Suivant <ChevronRight size={15} /></button>
            ) : (
              <button type="button" disabled={busy || !tabValid.confirmation} onClick={submit} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Valider la commande
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
