import { useCallback, useEffect, useState } from 'react';
import {
  createNode,
  updateNode,
  getActiveNodeTypes,
  getRegions,
} from '../../../api/locationNode.api';
import { useCascadeGeo } from './useCascadeGeo';
import Toggle from '../../../components/ui/Toggle';

const EMPTY_FORM = {
  code: '',
  node_type_id: '',
  name_fr: '',
  name_ar: '',
  region_id: '',
  city_id: '',
  phone_number: '',
  address: '',
  postal_code: '',
  timezone: 'Africa/Casablanca',
  lat: '',
  lng: '',
  max_daily_orders: '100',
  delivery_radius_km: '5',
  delivery_fee: '15',
  min_order_amount: '100',
  allow_customer_slot_selection: true,
  is_active: true,
};

const inputClass =
  'w-full h-8 px-3 text-xs text-gray-700 border border-gray-300 rounded-lg bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500';

function Field({ label, required = false, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>

      {children}
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="mb-3 border-b border-gray-100 pb-2">
      <h3 className="text-xs font-semibold text-gray-800">
        {children}
      </h3>
    </div>
  );
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export default function CreateNodeDrawer({
  editNode,
  onClose,
  onSaved,
  showToast,
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [nodeTypes, setNodeTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(editNode);

  const update = (name) => (event) => {
    const value = event.target.value;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetCity = useCallback(() => {
    setForm((previous) => (
      previous.city_id
        ? { ...previous, city_id: '' }
        : previous
    ));
  }, []);

  const { cities } = useCascadeGeo({
    regionId: form.region_id,
    onCityReset: resetCity,
  });

  useEffect(() => {
  if (!editNode) {
    setForm({ ...EMPTY_FORM });
    return;
  }

  setForm({
    ...EMPTY_FORM,

    code: editNode.code ?? '',

    node_type_id:
      editNode.node_type_id ??
      editNode.node_type?.id ??
      '',

    name_fr: editNode.name_fr ?? '',
    name_ar: editNode.name_ar ?? '',

    region_id:
      editNode.region_id ??
      editNode.region?.id ??
      '',

    city_id:
      editNode.city_id ??
      editNode.city?.id ??
      '',

    phone_number: editNode.phone_number ?? '',
    address: editNode.address ?? '',
    postal_code: editNode.postal_code ?? '',

    timezone:
      editNode.timezone ??
      'Africa/Casablanca',

    lat: editNode.lat ?? '',
    lng: editNode.lng ?? '',

    max_daily_orders:
      editNode.max_daily_orders ??
      '100',

    delivery_radius_km:
      editNode.delivery_radius_km ??
      '5',

    delivery_fee:
      editNode.delivery_fee ??
      '15',

    min_order_amount:
      editNode.min_order_amount ??
      '100',

    allow_customer_slot_selection:
      editNode.allow_customer_slot_selection ??
      true,

    is_active:
      editNode.is_active ??
      true,
  });
}, [editNode]);

  useEffect(() => {
    if (!form.node_type_id && nodeTypes.length) {
      const darkStore = nodeTypes.find((type) =>
        `${type.code ?? ''} ${type.name_fr ?? ''}`
          .toLowerCase()
          .includes('dark store')
      );

      setForm((previous) => ({
        ...previous,
        node_type_id: darkStore?.id ?? nodeTypes[0].id,
      }));
    }
  }, [nodeTypes, form.node_type_id]);

  useEffect(() => {
    if (!form.region_id && regions.length) {
      const casablancaRegion = regions.find((region) =>
        `${region.code ?? ''} ${region.name_fr ?? ''}`
          .toLowerCase()
          .includes('casablanca')
      );

      setForm((previous) => ({
        ...previous,
        region_id: casablancaRegion?.id ?? regions[0].id,
      }));
    }
  }, [regions, form.region_id]);

  useEffect(() => {
    if (!form.city_id && cities.length) {
      const casablanca = cities.find((city) =>
        `${city.code ?? ''} ${city.name_fr ?? ''}`
          .toLowerCase()
          .includes('casablanca')
      );

      setForm((previous) => ({
        ...previous,
        city_id: casablanca?.id ?? cities[0].id,
      }));
    }
  }, [cities, form.city_id]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.code.trim() ||
      !form.name_fr.trim() ||
      !form.node_type_id ||
      !form.city_id
    ) {
      showToast?.(
        'error',
        'Code, Nom FR, Type et Ville sont requis'
      );

      return;
    }

    setSaving(true);

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name_fr: form.name_fr.trim(),
        name_ar: form.name_ar.trim() || null,

        node_type_id: form.node_type_id,
        region_id: form.region_id || null,
        city_id: form.city_id,

        phone_number: form.phone_number.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        timezone: form.timezone.trim() || 'Africa/Casablanca',

        lat: numberOrNull(form.lat),
        lng: numberOrNull(form.lng),

        max_daily_orders: numberOrNull(form.max_daily_orders),
        delivery_radius_km: numberOrNull(form.delivery_radius_km),
        delivery_fee: numberOrNull(form.delivery_fee),
        min_order_amount: numberOrNull(form.min_order_amount),

        allow_customer_slot_selection:
          form.allow_customer_slot_selection,

        is_active: form.is_active,
      };

      const response = isEdit
  ? await updateNode(editNode.id, payload)
  : await createNode(payload);

showToast?.(
  'success',
  isEdit ? 'Nœud mis à jour' : 'Nœud créé'
);

      onSaved?.(response.data?.data);
    } catch (error) {
      showToast?.(
        'error',
        error?.response?.data?.message ||
          "Erreur lors de l'enregistrement"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Fiche Nœud
            </h2>

            <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-500">
              {isEdit ? 'Modifier' : 'Nouveau'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-2xl font-light leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <main className="flex-1 overflow-y-auto px-4 py-4">
            <section>
              <SectionTitle>
                Identité &amp; Localisation
              </SectionTitle>

              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <Field label="Code" required>
                  <input
                    className={`${inputClass} uppercase`}
                    value={form.code}
                    onChange={update('code')}
                    placeholder="DS-CASA-01"
                    required
                  />
                </Field>

                <Field label="Type" required>
                  <select
                    className={inputClass}
                    value={form.node_type_id}
                    onChange={update('node_type_id')}
                    required
                  >
                    <option value="">
                      Sélectionner
                    </option>

                    {nodeTypes.map((type) => (
                      <option
                        key={type.id}
                        value={type.id}
                      >
                        {type.name_fr}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Nom FR" required>
                  <input
                    className={inputClass}
                    value={form.name_fr}
                    onChange={update('name_fr')}
                    placeholder="Dark Store Casablanca"
                    required
                  />
                </Field>

                <Field label="Nom AR">
                  <input
                    dir="rtl"
                    className={inputClass}
                    value={form.name_ar}
                    onChange={update('name_ar')}
                  />
                </Field>

                <Field label="Ville" required>
                  <select
                    className={inputClass}
                    value={form.city_id}
                    onChange={update('city_id')}
                    required
                  >
                    <option value="">
                      Sélectionner
                    </option>

                    {cities.map((city) => (
                      <option
                        key={city.id}
                        value={city.id}
                      >
                        {city.name_fr}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Téléphone">
                  <input
                    className={inputClass}
                    value={form.phone_number}
                    onChange={update('phone_number')}
                    placeholder="+212 6..."
                  />
                </Field>

                <Field
                  label="Adresse"
                  className="col-span-2"
                >
                  <input
                    className={inputClass}
                    value={form.address}
                    onChange={update('address')}
                  />
                </Field>

                <Field label="Code postal">
                  <input
                    className={inputClass}
                    value={form.postal_code}
                    onChange={update('postal_code')}
                  />
                </Field>

                <Field label="Timezone">
                  <input
                    className={inputClass}
                    value={form.timezone}
                    onChange={update('timezone')}
                  />
                </Field>

                <Field label="Latitude">
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    className={inputClass}
                    value={form.lat}
                    onChange={update('lat')}
                  />
                </Field>

                <Field label="Longitude">
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    className={inputClass}
                    value={form.lng}
                    onChange={update('lng')}
                  />
                </Field>
              </div>
            </section>

            <section className="mt-5">
              <SectionTitle>
                Paramètres Opérationnels
              </SectionTitle>

              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <Field label="Capacité Max / Jour">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={form.max_daily_orders}
                    onChange={update('max_daily_orders')}
                  />
                </Field>

                <Field label="Rayon livraison (km)">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className={inputClass}
                    value={form.delivery_radius_km}
                    onChange={update('delivery_radius_km')}
                  />
                </Field>

                <Field label="Frais livraison (MAD)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={form.delivery_fee}
                    onChange={update('delivery_fee')}
                  />
                </Field>

                <Field label="Min. Commande (MAD)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    value={form.min_order_amount}
                    onChange={update('min_order_amount')}
                  />
                </Field>
              </div>
            </section>

            <section className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Sélection de créneaux client
                  </p>

                  <p className="mt-0.5 text-[10px] text-gray-500">
                    Permet aux clients de choisir un créneau à la commande
                  </p>
                </div>

                <Toggle
                  checked={form.allow_customer_slot_selection}
                  onChange={() =>
                    setForm((previous) => ({
                      ...previous,
                      allow_customer_slot_selection:
                        !previous.allow_customer_slot_selection,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                <div>
                  <p className="text-xs font-medium text-gray-800">
                    Nœud Actif
                  </p>

                  <p className="mt-0.5 text-[10px] text-gray-500">
                    Le nœud est opérationnel et visible
                  </p>
                </div>

                <Toggle
                  checked={form.is_active}
                  onChange={() =>
                    setForm((previous) => ({
                      ...previous,
                      is_active: !previous.is_active,
                    }))
                  }
                />
              </div>
            </section>
          </main>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-red-600 px-5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
  ? 'Enregistrement…'
  : isEdit
    ? 'Modifier'
    : 'Enregistrer'}
            </button>
          </footer>
        </form>
      </aside>
    </>
  );
}