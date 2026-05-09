import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import CustomerShell, { catalogInputClass, catalogSelectClass } from './CustomerShell';
import { getCustomer, createCustomer, updateCustomer } from '../../api/customers.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const emptyCreate = {
  phone_country: '+212',
  phone_number: '',
  name: '',
  preferred_lang: 'fr',
  city: '',
  referred_by_id: '',
};

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
        {req ? <span className="text-red-500 ml-1">*</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function CustomerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyCreate);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) {
      setFetchingData(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getCustomer(id);
        const c = res.data?.data;
        if (!c || cancelled) return;
        setForm({
          phone_country: c.phone_country || '+212',
          phone_number: c.phone_number || '',
          name: c.name || '',
          preferred_lang: c.preferred_lang === 'ar' ? 'ar' : 'fr',
          city: c.city || '',
          referred_by_id: '',
          referral_code: c.referral_code || '',
          lat: c.lat != null ? String(c.lat) : '',
          lng: c.lng != null ? String(c.lng) : '',
          is_active: c.is_active !== false,
        });
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err));
      } finally {
        if (!cancelled) setFetchingData(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          preferred_lang: form.preferred_lang,
          city: form.city.trim() === '' ? null : form.city.trim(),
          lat: form.lat === '' || form.lat == null ? null : Number(form.lat),
          lng: form.lng === '' || form.lng == null ? null : Number(form.lng),
          is_active: form.is_active,
        };
        await updateCustomer(id, payload);
        toast.success('Client mis à jour');
        navigate(`/customers/${id}`);
      } else {
        const payload = {
          phone_country: (form.phone_country || '+212').trim(),
          phone_number: form.phone_number.trim(),
          name: form.name.trim(),
          preferred_lang: form.preferred_lang,
          city: form.city.trim() === '' ? undefined : form.city.trim(),
        };
        const ref = (form.referred_by_id || '').trim();
        if (ref) payload.referred_by_id = ref;
        const res = await createCustomer(payload);
        const created = res.data?.data;
        toast.success('Client créé');
        navigate(created?.id ? `/customers/${created.id}` : '/customers');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-24 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
        <p className="text-sm text-gray-400">Chargement…</p>
      </div>
    );
  }

  const shellTitle = isEdit ? 'Modifier le client' : 'Nouveau client';

  return (
    <CustomerShell
      crumbLabel="Clients"
      crumbHref="/customers"
      breadcrumbTail={isEdit ? 'Modification' : 'Création'}
      title={shellTitle}
      pageSubtitle={isEdit ? 'Formulaire aligné sur les tiroirs référentiels catalogue.' : 'Création back-office — champs obligatoires marqués *.'}
      contentClassName="max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isEdit && (
          <div className="px-6 pt-6 pb-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <span className="font-semibold text-gray-700">Téléphone : </span>
              {form.phone_country} {form.phone_number}
              <span className="mx-2 text-gray-300">|</span>
              <span className="font-semibold text-gray-700">Parrainage : </span>
              <span className="font-mono text-xs">{form.referral_code || '—'}</span>
            </div>
          </div>
        )}

        <div className="px-6 py-6 space-y-4">
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Fld label="Indicatif">
                <input name="phone_country" className={catalogInputClass} value={form.phone_country} onChange={handleChange} maxLength={5} />
              </Fld>
              <Fld label="Numéro" req>
                <input name="phone_number" className={catalogInputClass} value={form.phone_number} onChange={handleChange} required maxLength={15} />
              </Fld>
            </div>
          )}
          <Fld label="Nom" req>
            <input name="name" className={catalogInputClass} value={form.name} onChange={handleChange} required maxLength={150} />
          </Fld>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Fld label="Langue">
              <select name="preferred_lang" className={catalogSelectClass} value={form.preferred_lang} onChange={handleChange}>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </Fld>
            <Fld label="Ville">
              <input name="city" className={catalogInputClass} value={form.city} onChange={handleChange} maxLength={100} />
            </Fld>
          </div>
          {!isEdit && (
            <Fld label="ID parrain (optionnel)">
              <input name="referred_by_id" className={`${catalogInputClass} font-mono text-xs`} value={form.referred_by_id} onChange={handleChange} placeholder="UUID" />
            </Fld>
          )}
          {isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Fld label="Latitude">
                <input name="lat" className={`${catalogInputClass} font-mono text-xs`} value={form.lat} onChange={handleChange} placeholder="ex. 33.5731" />
              </Fld>
              <Fld label="Longitude">
                <input name="lng" className={`${catalogInputClass} font-mono text-xs`} value={form.lng} onChange={handleChange} placeholder="ex. -7.5898" />
              </Fld>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input type="checkbox" name="is_active" checked={!!form.is_active} onChange={handleChange} className="rounded text-red-600" />
                  Compte actif (non bloqué)
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Link
            to={isEdit ? `/customers/${id}` : '/customers'}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 text-center transition-colors"
          >
            Annuler
          </Link>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl transition-colors">
            {loading ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </form>
    </CustomerShell>
  );
}
