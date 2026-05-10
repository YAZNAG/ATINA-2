import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCustomer, createCustomer, updateCustomer } from '../../api/customers.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  back:  'M10 19l-7-7m0 0l7-7m-7 7h18',
  user:  'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  save:  'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  info:  'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300 transition-colors';
const sel = `${inp} cursor-pointer`;

function Fld({ label, req, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const EMPTY_CREATE = { phone_country: '+212', phone_number: '', name: '', preferred_lang: 'fr', city: '', referred_by_id: '' };
const EMPTY_EDIT   = { name: '', preferred_lang: 'fr', city: '', lat: '', lng: '', is_active: true };

export default function CustomerForm() {
  const { id }   = useParams();
  const isEdit   = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm]     = useState(isEdit ? EMPTY_EDIT : EMPTY_CREATE);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    if (!isEdit) { setFetching(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await getCustomer(id);
        const c = res.data?.data;
        if (!c || cancelled) return;
        setCustomer(c);
        setForm({
          name:         c.name         ?? '',
          preferred_lang: c.preferred_lang === 'ar' ? 'ar' : 'fr',
          city:         c.city         ?? '',
          lat:          c.lat  != null  ? String(c.lat)  : '',
          lng:          c.lng  != null  ? String(c.lng)  : '',
          is_active:    c.is_active !== false,
        });
      } catch (err) { if (!cancelled) toast.error(getErrorMessage(err)); }
      finally       { if (!cancelled) setFetching(false); }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const hc = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateCustomer(id, {
          name:         form.name.trim(),
          preferred_lang: form.preferred_lang,
          city:         form.city.trim() || null,
          lat:          form.lat  === '' ? null : Number(form.lat),
          lng:          form.lng  === '' ? null : Number(form.lng),
          is_active:    form.is_active,
        });
        toast.success('Client mis à jour');
        navigate(`/customers/${id}`);
      } else {
        const payload = {
          phone_country: form.phone_country.trim() || '+212',
          phone_number:  form.phone_number.trim(),
          name:          form.name.trim(),
          preferred_lang: form.preferred_lang,
          city:          form.city.trim() || undefined,
        };
        if (form.referred_by_id.trim()) payload.referred_by_id = form.referred_by_id.trim();
        const res = await createCustomer(payload);
        const created = res.data?.data;
        toast.success('Client créé');
        navigate(created?.id ? `/customers/${created.id}` : '/customers');
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  if (fetching) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link to="/customers" className="hover:text-red-600 transition-colors flex items-center gap-1">
              <Icon d={SVG.back} className="w-3.5 h-3.5" />Clients
            </Link>
            <span>›</span>
            {isEdit && customer && <><Link to={`/customers/${id}`} className="hover:text-red-600">{customer.name}</Link><span>›</span></>}
            <span className="text-gray-700 font-medium">{isEdit ? 'Modifier' : 'Nouveau client'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Modifier le client' : 'Nouveau client'}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isEdit ? 'Modifiez les informations du profil client' : 'Créer un compte client depuis le back-office'}
          </p>
        </div>
      </div>

      <div className="px-6 py-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Identity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                <Icon d={SVG.user} className="w-4 h-4 text-red-600" />
              </div>
              <h2 className="font-bold text-gray-900">Identité</h2>
            </div>

            <Fld label="Nom complet" req>
              <input name="name" className={inp} value={form.name} onChange={hc} required maxLength={150} placeholder="Yassine Benali" />
            </Fld>

            {!isEdit && (
              <div className="grid grid-cols-3 gap-3">
                <Fld label="Indicatif">
                  <select name="phone_country" className={sel} value={form.phone_country} onChange={hc}>
                    <option value="+212">+212 (MA)</option>
                    <option value="+33">+33 (FR)</option>
                    <option value="+213">+213 (DZ)</option>
                    <option value="+216">+216 (TN)</option>
                  </select>
                </Fld>
                <div className="col-span-2">
                  <Fld label="Numéro de téléphone" req hint="Format local : 0612345678 → on stocke 612345678">
                    <input name="phone_number" className={`${inp} font-mono`} value={form.phone_number} onChange={hc}
                      required maxLength={15} placeholder="612345678" />
                  </Fld>
                </div>
              </div>
            )}

            {isEdit && customer && (
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600">
                <Icon d={SVG.phone} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{customer.phone_country} {customer.phone_number}</span>
                <span className="mx-1 text-gray-300">·</span>
                <span className="font-mono text-xs text-gray-500">{customer.referral_code}</span>
                <span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Préférences</h2>
            <div className="grid grid-cols-2 gap-4">
              <Fld label="Langue préférée">
                <select name="preferred_lang" className={sel} value={form.preferred_lang} onChange={hc}>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="ar">🇲🇦 العربية</option>
                </select>
              </Fld>
              <Fld label="Ville">
                <input name="city" className={inp} value={form.city} onChange={hc} maxLength={100} placeholder="Rabat" />
              </Fld>
            </div>

            {isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Latitude" hint="ex: 33.573110">
                  <input name="lat" className={`${inp} font-mono text-xs`} value={form.lat} onChange={hc} placeholder="33.573110" />
                </Fld>
                <Fld label="Longitude" hint="ex: -7.589843">
                  <input name="lng" className={`${inp} font-mono text-xs`} value={form.lng} onChange={hc} placeholder="-7.589843" />
                </Fld>
              </div>
            )}
          </div>

          {/* Referral (create only) */}
          {!isEdit && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-start gap-2">
                <h2 className="font-bold text-gray-900">Parrainage</h2>
                <span className="text-xs text-gray-400 mt-0.5">(optionnel)</span>
              </div>
              <Fld label="ID du parrain" hint="UUID du client qui a parrainé ce nouveau client">
                <input name="referred_by_id" className={`${inp} font-mono text-xs`} value={form.referred_by_id} onChange={hc}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </Fld>
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <Icon d={SVG.info} className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Le code de parrainage est généré automatiquement. Le wallet et les points démarrent à 0.</p>
              </div>
            </div>
          )}

          {/* Active toggle (edit only) */}
          {isEdit && (
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${form.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div>
                <p className={`text-sm font-semibold ${form.is_active ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {form.is_active ? 'Compte actif' : 'Compte bloqué'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {form.is_active ? 'Le client peut se connecter à l\'application' : 'Le client ne peut pas se connecter'}
                </p>
              </div>
              <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-amber-400'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-6' : ''}`} />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <Link to={isEdit ? `/customers/${id}` : '/customers'}
              className="flex-1 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 text-center transition-colors">
              Annuler
            </Link>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl transition-colors">
              <Icon d={SVG.save} className="w-4 h-4" />
              {loading ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
