import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';

import {
  calculateCart,
  createOrder,
  getAvailableDates,
  getCheckoutMeta,
  getCustomerAddresses,
  getDeliverySlots,
  searchArticles,
  searchCustomers,
} from '../../api/checkout.api';


// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const STEPS = [
  {
    number: 1,
    key: 'customer',
    label: 'CLIENT',
  },
  {
    number: 2,
    key: 'node',
    label: 'NŒUD',
  },
  {
    number: 3,
    key: 'articles',
    label: 'ARTICLES',
  },
  {
    number: 4,
    key: 'address',
    label: 'ADRESSE',
  },
  {
    number: 5,
    key: 'slots',
    label: 'CRÉNEAUX',
  },
  {
    number: 6,
    key: 'confirmation',
    label: 'CONFIRMATION',
  },
];


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function money(value, currency = 'MAD') {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

function formatTime(value) {
  if (!value) return '';

  const match = String(value).match(
    /^(\d{1,2}):(\d{2})/
  );

  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return String(value);
}

function formatDateLabel(value) {
  if (!value) return '';

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDateShort(value) {
  if (!value) return '';

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function getCustomerPhone(customer) {
  return `${customer?.phone_country || ''}${
    customer?.phone_number || ''
  }`;
}

function getAddressLabel(address) {
  return [
    address?.address_line1,
    address?.address_line2,
    address?.address_line,
    address?.street,
    address?.city,
  ]
    .filter(Boolean)
    .join(', ');
}

function getArticlePrice(article) {
  return Number(
    article?.price ??
      article?.unit_price ??
      article?.price_ttc ??
      0
  );
}

function getArticleStock(article) {
  return (
    article?.available_stock ??
    article?.qty_available ??
    article?.stock ??
    null
  );
}

function getSlotLabel(slot) {
  const start = formatTime(slot.slot_start);
  const end = formatTime(slot.slot_end);

  if (start && end) {
    return `${start}–${end}`;
  }

  return slot.name_fr || 'Créneau';
}


// -----------------------------------------------------------------------------
// Stepper
// -----------------------------------------------------------------------------

function Stepper({ currentStep }) {
  return (
    <div className="grid grid-cols-6 border-b border-gray-100 bg-white px-4 py-4">
      {STEPS.map((step) => {
        const isCurrent = currentStep === step.number;
        const isCompleted = currentStep > step.number;

        return (
          <div
            key={step.key}
            className="relative flex flex-col items-center"
          >
            {step.number < STEPS.length && (
              <div
                className={`absolute left-1/2 top-4 h-px w-full ${
                  currentStep > step.number
                    ? 'bg-red-600'
                    : 'bg-gray-200'
                }`}
              />
            )}

            <div
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                isCurrent
                  ? 'border-red-600 bg-red-600 text-white ring-4 ring-red-100'
                  : isCompleted
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {isCompleted ? (
                <Check size={14} />
              ) : (
                step.number
              )}
            </div>

            <span
              className={`mt-2 text-center text-[10px] font-medium ${
                isCurrent || isCompleted
                  ? 'text-red-600'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function CreateOrderDrawer({
  open,
  nodes = [],
  onClose,
  onCreated,
}) {
  const [step, setStep] = useState(1);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Client
  const [customerSearch, setCustomerSearch] =
    useState('');
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] =
    useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  // Nœud
  const [selectedNode, setSelectedNode] =
    useState(null);
  const [checkoutMeta, setCheckoutMeta] =
    useState(null);
  const [deliveryTypeCode, setDeliveryTypeCode] =
    useState('home');

  // Articles
  const [articleSearch, setArticleSearch] =
    useState('');
  const [articles, setArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] =
    useState(false);
  const [cartItems, setCartItems] = useState([]);

  // Adresse
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] =
    useState(false);
  const [selectedAddress, setSelectedAddress] =
    useState(null);

  // Créneaux
  const [availableDates, setAvailableDates] =
    useState([]);
  const [datesLoading, setDatesLoading] =
    useState(false);
  const [selectedDate, setSelectedDate] =
    useState('');
  const [deliverySlots, setDeliverySlots] =
    useState([]);
  const [slotsLoading, setSlotsLoading] =
    useState(false);
  const [selectedSlot, setSelectedSlot] =
    useState(null);

  // Confirmation
  const [paymentMethodCode, setPaymentMethodCode] =
    useState('cod');
  const [notes, setNotes] = useState('');
  const [calculation, setCalculation] =
    useState(null);
  const [calculationLoading, setCalculationLoading] =
    useState(false);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const resetForm = useCallback(() => {
    setStep(1);
    setError(null);
    setLoading(false);
    setCreating(false);

    setCustomerSearch('');
    setCustomers([]);
    setCustomersLoading(false);
    setSelectedCustomer(null);

    setSelectedNode(null);
    setCheckoutMeta(null);
    setDeliveryTypeCode('home');

    setArticleSearch('');
    setArticles([]);
    setArticlesLoading(false);
    setCartItems([]);

    setAddresses([]);
    setAddressesLoading(false);
    setSelectedAddress(null);

    setAvailableDates([]);
    setDatesLoading(false);
    setSelectedDate('');

    setDeliverySlots([]);
    setSlotsLoading(false);
    setSelectedSlot(null);

    setPaymentMethodCode('cod');
    setNotes('');
    setCalculation(null);
    setCalculationLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------

  const cartPayload = useMemo(() => {
    return cartItems.map((item) => ({
      sku_id: item.sku_id,
      pack_id: item.pack_id || undefined,
      qty: Number(item.qty),
    }));
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return (
        sum +
        getArticlePrice(item.article) *
          Number(item.qty)
      );
    }, 0);
  }, [cartItems]);

  function addArticle(article) {
    const skuId =
      article.sku_uuid ||
      article.sku_id ||
      article.id;

    if (!skuId) {
      setError(
        'Cet article ne possède pas de SKU valide.'
      );
      return;
    }

    setCartItems((previous) => {
      const existing = previous.find(
        (item) => item.sku_id === skuId
      );

      if (existing) {
        return previous.map((item) =>
          item.sku_id === skuId
            ? {
                ...item,
                qty: Number(item.qty) + 1,
              }
            : item
        );
      }

      return [
        ...previous,
        {
          sku_id: skuId,
          qty: 1,
          article,
        },
      ];
    });
  }

  function updateArticleQuantity(skuId, quantity) {
    if (quantity <= 0) {
      setCartItems((previous) =>
        previous.filter(
          (item) => item.sku_id !== skuId
        )
      );
      return;
    }

    setCartItems((previous) =>
      previous.map((item) =>
        item.sku_id === skuId
          ? {
              ...item,
              qty: quantity,
            }
          : item
      )
    );
  }

  function removeArticle(skuId) {
    setCartItems((previous) =>
      previous.filter(
        (item) => item.sku_id !== skuId
      )
    );
  }

  function getCartQuantity(article) {
    const skuId =
      article.sku_uuid ||
      article.sku_id ||
      article.id;

    return (
      cartItems.find(
        (item) => item.sku_id === skuId
      )?.qty || 0
    );
  }

  // ---------------------------------------------------------------------------
  // Client search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open || step !== 1) return;

    const timeout = setTimeout(async () => {
      setCustomersLoading(true);

      try {
        const response = await searchCustomers(
          customerSearch
        );

        setCustomers(unwrap(response) || []);
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Erreur lors de la recherche des clients'
          )
        );
      } finally {
        setCustomersLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [open, step, customerSearch]);

  async function handleSelectCustomer(customer) {
    setSelectedCustomer(customer);
    setSelectedAddress(null);
    setAddresses([]);
    setError(null);

    setAddressesLoading(true);

    try {
      const response = await getCustomerAddresses(
        customer.id
      );

      setAddresses(unwrap(response) || []);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Erreur lors du chargement des adresses'
        )
      );
    } finally {
      setAddressesLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Checkout metadata
  // ---------------------------------------------------------------------------

  async function loadCheckoutMeta(nodeId) {
    if (!nodeId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getCheckoutMeta(nodeId);
      const meta = unwrap(response);

      setCheckoutMeta(meta);

      const deliveryTypes =
        meta?.delivery_types || [];

      const defaultDeliveryType =
        deliveryTypes.find(
          (type) => type.code === 'home'
        ) ||
        deliveryTypes[0];

      if (defaultDeliveryType) {
        setDeliveryTypeCode(
          defaultDeliveryType.code
        );
      }

      const paymentMethods =
        meta?.payment_methods || [];

      const defaultPaymentMethod =
        paymentMethods.find(
          (method) => method.code === 'cod'
        ) ||
        paymentMethods[0];

      if (defaultPaymentMethod) {
        setPaymentMethodCode(
          defaultPaymentMethod.code
        );
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Erreur lors du chargement des paramètres'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Article search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open || step !== 3) return;

    const timeout = setTimeout(async () => {
      setArticlesLoading(true);

      try {
        const response = await searchArticles(
          articleSearch,
          20
        );

        setArticles(unwrap(response) || []);
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Erreur lors de la recherche des articles'
          )
        );
      } finally {
        setArticlesLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [open, step, articleSearch]);

  // ---------------------------------------------------------------------------
  // Available dates
  // ---------------------------------------------------------------------------

  const loadAvailableDates = useCallback(async () => {
    if (!selectedNode?.id) return;

    setDatesLoading(true);
    setError(null);

    try {
      const response = await getAvailableDates({
        node_id: selectedNode.id,
        delivery_type_code: deliveryTypeCode,
        days_ahead: 14,
      });

      const dates = unwrap(response) || [];

      setAvailableDates(dates);

      const firstAvailableDate = dates.find(
        (date) => date.available
      );

      if (
        firstAvailableDate &&
        !selectedDate
      ) {
        setSelectedDate(
          firstAvailableDate.date
        );
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Erreur lors du chargement des jours disponibles'
        )
      );
    } finally {
      setDatesLoading(false);
    }
  }, [
    selectedNode,
    deliveryTypeCode,
    selectedDate,
  ]);

  useEffect(() => {
    if (!open || step !== 5) return;

    loadAvailableDates();
  }, [open, step, loadAvailableDates]);

  // ---------------------------------------------------------------------------
  // Delivery slots
  // ---------------------------------------------------------------------------

  const loadDeliverySlots = useCallback(
    async (date) => {
      if (!date || !selectedNode?.id) return;

      setSlotsLoading(true);
      setError(null);
      setSelectedSlot(null);

      try {
        const response = await getDeliverySlots({
          node_id: selectedNode.id,
          address_id: selectedAddress?.id,
          delivery_type_code: deliveryTypeCode,
          date,
          cart_items: JSON.stringify(
            cartPayload
          ),
        });

        const data = unwrap(response);

        setDeliverySlots(data?.slots || []);
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            'Erreur lors du chargement des créneaux'
          )
        );
        setDeliverySlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [
      selectedNode,
      selectedAddress,
      deliveryTypeCode,
      cartPayload,
    ]
  );

  useEffect(() => {
    if (
      !open ||
      step !== 5 ||
      !selectedDate
    ) {
      return;
    }

    loadDeliverySlots(selectedDate);
  }, [
    open,
    step,
    selectedDate,
    loadDeliverySlots,
  ]);

  function handleSelectDate(date) {
    if (!date.available) return;

    setSelectedDate(date.date);
    setSelectedSlot(null);
    setDeliverySlots([]);
  }

  // ---------------------------------------------------------------------------
  // Calculate order
  // ---------------------------------------------------------------------------

  const calculateOrder = useCallback(async () => {
    if (!selectedNode?.id || !cartPayload.length) {
      return;
    }

    setCalculationLoading(true);
    setError(null);

    try {
      const response = await calculateCart({
        node_id: selectedNode.id,
        delivery_type_code: deliveryTypeCode,
        cart_items: cartPayload,
        payment_method_code: paymentMethodCode,
        customer_id: selectedCustomer?.id,
      });

      setCalculation(unwrap(response));
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Erreur lors du calcul de la commande'
        )
      );
    } finally {
      setCalculationLoading(false);
    }
  }, [
    selectedNode,
    cartPayload,
    deliveryTypeCode,
    paymentMethodCode,
    selectedCustomer,
  ]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function canGoNext() {
    if (step === 1) {
      return Boolean(selectedCustomer);
    }

    if (step === 2) {
      return Boolean(selectedNode);
    }

    if (step === 3) {
      return cartItems.length > 0;
    }

    if (step === 4) {
      return Boolean(selectedAddress);
    }

    if (step === 5) {
      return Boolean(selectedDate && selectedSlot);
    }

    return false;
  }

  async function handleNext() {
    setError(null);

    if (!canGoNext()) {
      const messages = {
        1: 'Veuillez sélectionner un client.',
        2: 'Veuillez sélectionner un nœud.',
        3: 'Veuillez ajouter au moins un article.',
        4: 'Veuillez sélectionner une adresse.',
        5: 'Veuillez sélectionner un créneau.',
      };

      setError(messages[step]);
      return;
    }

    if (step === 2 && selectedNode) {
      await loadCheckoutMeta(selectedNode.id);
    }

    if (step === 5) {
      await calculateOrder();
    }

    setStep((previous) =>
      Math.min(previous + 1, 6)
    );
  }

  function handlePrevious() {
    setError(null);

    setStep((previous) =>
      Math.max(previous - 1, 1)
    );
  }

  // ---------------------------------------------------------------------------
  // Create order
  // ---------------------------------------------------------------------------

  async function handleCreateOrder() {
    if (
      !selectedCustomer ||
      !selectedNode ||
      !selectedAddress ||
      !selectedDate ||
      !selectedSlot ||
      !cartPayload.length
    ) {
      setError(
        'Certaines informations obligatoires sont manquantes.'
      );
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await createOrder({
        customer_id: selectedCustomer.id,
        address_id: selectedAddress.id,

        delivery_type_code: deliveryTypeCode,
        node_id: selectedNode.id,

        selected_slot_id: selectedSlot.id,
        date: selectedDate,

        payment_method_code: paymentMethodCode,
        cart_items: cartPayload,

        notes: notes.trim() || undefined,

        initial_status_code: 'PENDING',
      });

      const createdOrder = unwrap(response);

      await onCreated?.(createdOrder);
      onClose?.();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Erreur lors de la création de la commande'
        )
      );
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  function renderCustomerStep() {
    return (
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Rechercher un client existant
          </label>

          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={customerSearch}
              onChange={(event) =>
                setCustomerSearch(event.target.value)
              }
              placeholder="Téléphone ou nom..."
              autoFocus
              className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>

        {selectedCustomer && (
          <div className="rounded-lg border border-red-500 bg-red-50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <User size={17} />
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {selectedCustomer.name}
                  </div>

                  <div className="text-xs text-gray-500">
                    {getCustomerPhone(
                      selectedCustomer
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setAddresses([]);
                  setSelectedAddress(null);
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Changer
              </button>
            </div>
          </div>
        )}

        {!selectedCustomer && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {customersLoading && (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400">
                <Loader2
                  size={16}
                  className="animate-spin"
                />
                Recherche en cours…
              </div>
            )}

            {!customersLoading &&
              customers.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  Aucun client trouvé.
                </div>
              )}

            {!customersLoading &&
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() =>
                    handleSelectCustomer(customer)
                  }
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-red-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <User size={17} />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {customer.name}
                    </div>

                    <div className="text-xs text-gray-500">
                      {getCustomerPhone(customer)}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }

  function renderNodeStep() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MapPin size={17} className="text-red-600" />
          Sélectionner le nœud
        </div>

        {nodes.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Aucun nœud disponible.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {nodes.map((node) => {
            const isSelected =
              selectedNode?.id === node.id;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNode(node)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-red-600 bg-red-50 ring-1 ring-red-600'
                    : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-red-600">
                      {node.code}
                    </div>

                    <div className="mt-2 text-base font-medium text-gray-800">
                      {node.name_fr}
                    </div>

                    {node.city?.name_fr && (
                      <div className="mt-1 text-xs text-gray-500">
                        {node.city.name_fr}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

    function renderArticlesStep() {
    return (
      <div className="space-y-4">
        {/* Recherche article */}
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={articleSearch}
            onChange={(event) =>
              setArticleSearch(event.target.value)
            }
            placeholder="Rechercher un SKU par nom ou code..."
            autoFocus
            className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {/* Liste des articles */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {articlesLoading && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Recherche en cours…
            </div>
          )}

          {!articlesLoading &&
            articles.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Aucun article trouvé.
              </div>
            )}

          {!articlesLoading &&
            articles.map((article) => {
              const articleId =
                article.sku_uuid ||
                article.sku_id ||
                article.id;

              const quantity =
                getCartQuantity(article);

              const price = getArticlePrice(article);
              const stock = getArticleStock(article);

              const isOutOfStock =
                stock !== null &&
                Number(stock) <= 0;

              return (
                <div
                  key={articleId}
                  className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 pr-3">
                    <div className="truncate text-sm font-medium text-gray-800">
                      {article.name_fr}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {money(price)}

                      {stock !== null && (
                        <span
                          className={`ml-2 ${
                            isOutOfStock
                              ? 'text-red-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          · {stock} en stock
                        </span>
                      )}
                    </div>

                    {article.sku_code && (
                      <div className="mt-1 text-[11px] text-gray-400">
                        SKU : {article.sku_code}
                      </div>
                    )}
                  </div>

                  {quantity > 0 ? (
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateArticleQuantity(
                            articleId,
                            quantity - 1
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100"
                      >
                        <Minus size={15} />
                      </button>

                      <span className="w-5 text-center text-sm font-medium text-gray-800">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() =>
                          updateArticleQuantity(
                            articleId,
                            quantity + 1
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() =>
                        addArticle(article)
                      }
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
                        isOutOfStock
                          ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {isOutOfStock
                        ? 'Indisponible'
                        : 'Ajouter'}
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* Panier */}
        {cartItems.length > 0 && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-800">
              <span>
                Panier ({cartItems.length}{' '}
                article
                {cartItems.length > 1 ? 's' : ''})
              </span>

              <span>{money(cartTotal)}</span>
            </div>

            <div className="space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.sku_id}
                  className="flex items-center justify-between text-xs text-gray-600"
                >
                  <span>
                    {item.article?.name_fr} ×{' '}
                    {item.qty}
                  </span>

                  <button
                    type="button"
                    title="Supprimer l'article"
                    aria-label="Supprimer l'article"
                    onClick={() =>
                      removeArticle(item.sku_id)
                    }
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAddressStep() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MapPin
            size={17}
            className="text-red-600"
          />
          Adresse de livraison
        </div>

        {addressesLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Loader2
              size={16}
              className="animate-spin"
            />
            Chargement des adresses…
          </div>
        )}

        {!addressesLoading &&
          addresses.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Ce client ne possède aucune adresse.
            </div>
          )}

        <div className="space-y-3">
          {!addressesLoading &&
            addresses.map((address, index) => {
              const isSelected =
                selectedAddress?.id === address.id;

              return (
                <button
                  key={address.id || index}
                  type="button"
                  onClick={() =>
                    setSelectedAddress(address)
                  }
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-red-600 bg-red-50 ring-1 ring-red-600'
                      : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {address.label ||
                          address.name ||
                          (address.is_default
                            ? 'Domicile'
                            : 'Adresse')}
                      </div>

                      <div className="mt-2 text-sm text-gray-600">
                        {getAddressLabel(address)}
                      </div>

                      {address.note && (
                        <div className="mt-1 text-xs text-amber-600">
                          Note : {address.note}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    );
  }

  function renderSlotsStep() {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Clock3
              size={17}
              className="text-red-600"
            />
            Choisir un créneau
          </div>

          <span className="text-xs text-gray-400">
            {selectedNode?.code}
          </span>
        </div>

        {/* Jours disponibles */}
        <div>
          <div className="mb-2 text-xs font-medium text-gray-500">
            Jours disponibles
          </div>

          {datesLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Chargement des jours…
            </div>
          )}

          {!datesLoading &&
            availableDates.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Aucun jour disponible pour ce nœud.
              </div>
            )}

          {!datesLoading &&
            availableDates.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {availableDates.map((dateItem) => {
                  const isSelected =
                    selectedDate === dateItem.date;

                  return (
                    <button
                      key={dateItem.date}
                      type="button"
                      disabled={!dateItem.available}
                      onClick={() =>
                        handleSelectDate(dateItem)
                      }
                      className={`min-w-[92px] rounded-lg border px-3 py-2 text-center transition-colors ${
                        !dateItem.available
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                          : isSelected
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <CalendarDays
                        size={15}
                        className="mx-auto mb-1"
                      />

                      <div className="text-xs font-medium">
                        {formatDateLabel(
                          dateItem.date
                        )}
                      </div>

                      {!dateItem.available && (
                        <div className="mt-1 text-[10px]">
                          Fermé
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {/* Créneaux */}
        <div>
          <div className="mb-2 text-xs font-medium text-gray-500">
            Créneaux ouverts
          </div>

          {slotsLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2
                size={16}
                className="animate-spin"
              />
              Chargement des créneaux…
            </div>
          )}

          {!slotsLoading &&
            selectedDate &&
            deliverySlots.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
                Aucun créneau ouvert pour le{' '}
                {formatDateLabel(selectedDate)}.
              </div>
            )}

          {!slotsLoading &&
            deliverySlots.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {deliverySlots.map((slot) => {
                  const isSelected =
                    selectedSlot?.id === slot.id;

                  const capacity =
                    slot.available_capacity;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={
                        slot.is_full || slot.is_past
                      }
                      onClick={() =>
                        setSelectedSlot(slot)
                      }
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        slot.is_full || slot.is_past
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                          : isSelected
                            ? 'border-red-600 bg-red-50 text-red-600 ring-1 ring-red-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {getSlotLabel(slot)}
                        </span>

                        {isSelected && (
                          <Check size={16} />
                        )}
                      </div>

                      <div className="mt-1 text-xs opacity-70">
                        {slot.is_full
                          ? 'Complet'
                          : slot.is_past
                            ? 'Expiré'
                            : capacity !== null &&
                                capacity !== undefined
                              ? `${capacity} place${
                                  Number(capacity) > 1
                                    ? 's'
                                    : ''
                                } disponible${
                                  Number(capacity) > 1
                                    ? 's'
                                    : ''
                                }`
                              : 'Disponible'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {selectedSlot && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Créneau sélectionné :{' '}
            <strong>
              {formatDateShort(selectedDate)} —{' '}
              {getSlotLabel(selectedSlot)}
            </strong>
          </div>
        )}
      </div>
    );
  }

  function renderConfirmationStep() {
    const calculated = calculation || {};

    const subtotal =
      calculated.subtotal_ttc ??
      cartTotal;

    const deliveryFee =
      calculated.delivery_fee ?? 0;

    const discount =
      calculated.discount_amount ?? 0;

    const total =
      calculated.total_ttc ??
      subtotal + deliveryFee - discount;

    const paymentMethods =
      checkoutMeta?.payment_methods || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Check
            size={17}
            className="text-red-600"
          />
          Vérifier et confirmer la commande
        </div>

        {/* Client et nœud */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 text-xs text-gray-500">
              Client
            </div>

            <div className="text-sm font-medium text-gray-800">
              {selectedCustomer?.name}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              {getCustomerPhone(selectedCustomer)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 text-xs text-gray-500">
              Nœud
            </div>

            <div className="text-sm font-medium text-gray-800">
              {selectedNode?.name_fr}
            </div>

            <div className="mt-1 text-xs text-red-600">
              {selectedNode?.code}
            </div>
          </div>
        </div>

        {/* Adresse et créneau */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-xs text-gray-500">
                Adresse
              </div>

              <div className="text-sm text-gray-700">
                {getAddressLabel(selectedAddress)}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs text-gray-500">
                Créneau
              </div>

              <div className="text-sm font-medium text-gray-700">
                {formatDateShort(selectedDate)}
              </div>

              <div className="text-xs text-gray-500">
                {getSlotLabel(selectedSlot)}
              </div>
            </div>
          </div>
        </div>

        {/* Articles sélectionnés */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-3 py-3 text-xs text-gray-500">
            Articles
          </div>

          <div className="px-3">
            {cartItems.map((item) => (
              <div
                key={item.sku_id}
                className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0"
              >
                <div>
                  <div className="text-sm text-gray-800">
                    {item.article?.name_fr}
                  </div>

                  <div className="text-xs text-gray-500">
                    x{item.qty} ×{' '}
                    {money(
                      getArticlePrice(item.article)
                    )}
                  </div>
                </div>

                <div className="text-sm font-medium text-gray-700">
                  {money(
                    getArticlePrice(item.article) *
                      Number(item.qty)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mode de paiement */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
            <CreditCard size={14} />
            Mode de paiement
          </div>

          <div className="flex flex-wrap gap-2">
            {paymentMethods.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  setPaymentMethodCode('cod')
                }
                className={`rounded-lg border px-3 py-2 text-sm ${
                  paymentMethodCode === 'cod'
                    ? 'border-red-600 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                Paiement à la livraison
              </button>
            )}

            {paymentMethods.map((method) => {
              const isSelected =
                paymentMethodCode === method.code;

              return (
                <button
                  key={method.id || method.code}
                  type="button"
                  onClick={() =>
                    setPaymentMethodCode(method.code)
                  }
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'border-red-600 bg-red-50 text-red-600'
                      : 'border-gray-200 text-gray-600 hover:border-red-300'
                  }`}
                >
                  {method.name_fr || method.code}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note interne */}
        <div>
          <label
            htmlFor="order-notes"
            className="mb-2 block text-xs font-medium text-gray-600"
          >
            Note interne
          </label>

          <textarea
            id="order-notes"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={3}
            placeholder="Ajouter une note optionnelle..."
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {/* Total */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {calculationLoading && (
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
              <Loader2
                size={15}
                className="animate-spin"
              />
              Calcul du montant…
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Sous-total articles</span>
              <span>{money(subtotal)}</span>
            </div>

            <div className="flex justify-between text-gray-500">
              <span>Frais de livraison</span>
              <span>{money(deliveryFee)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Réduction</span>
                <span>-{money(discount)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-800">
              <span>Total TTC</span>
              <span>{money(total)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCurrentStep() {
    if (step === 1) {
      return renderCustomerStep();
    }

    if (step === 2) {
      return renderNodeStep();
    }

    if (step === 3) {
      return renderArticlesStep();
    }

    if (step === 4) {
      return renderAddressStep();
    }

    if (step === 5) {
      return renderSlotsStep();
    }

    return renderConfirmationStep();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer le drawer"
        onClick={() => {
          if (!creating) {
            onClose?.();
          }
        }}
        className="absolute inset-0 bg-black/40"
      />

      {/* Drawer */}
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[700px] flex-col bg-slate-50 shadow-2xl">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Créer une commande manuelle
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Étape {step} sur 6
              </p>
            </div>

            <button
              type="button"
              title="Fermer"
              aria-label="Fermer"
              disabled={creating}
              onClick={() => onClose?.()}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={21} />
            </button>
          </div>

          <Stepper currentStep={step} />
        </header>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {(loading || creating) && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <Loader2
                size={16}
                className="animate-spin"
              />

              {creating
                ? 'Création de la commande…'
                : 'Chargement…'}
            </div>
          )}

          {renderCurrentStep()}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-4">
          <button
            type="button"
            disabled={step === 1 || creating}
            onClick={handlePrevious}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            <ArrowLeft size={16} />
            Précédent
          </button>

          {step < 6 ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleNext}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                canGoNext()
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Suivant
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={
                creating || calculationLoading
              }
              onClick={handleCreateOrder}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating && (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              )}

              Créer la commande
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}