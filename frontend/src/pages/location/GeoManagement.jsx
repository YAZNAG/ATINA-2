import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';
import {
  createCity,
  createProvince,
  createRegion,
  getCities,
  getProvinces,
  getRegions,
  updateCity,
  updateProvince,
  updateRegion,
} from '../../api/locationNode.api';

const regionInit = { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', is_active: true };
const provinceInit = { region_id: '', code: '', name_fr: '', name_ar: '', is_active: true };
const cityInit = { province_id: '', code: '', name_fr: '', name_ar: '', postal_code: '', is_active: true };

export default function GeoManagement() {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [regionForm, setRegionForm] = useState(regionInit);
  const [provinceForm, setProvinceForm] = useState(provinceInit);
  const [cityForm, setCityForm] = useState(cityInit);

  const loadRegions = async () => {
    const res = await getRegions({ limit: 100 });
    setRegions(res.data.data || []);
  };
  const loadProvinces = async (regionId) => {
    const res = await getProvinces({ region_id: regionId || undefined, limit: 200 });
    setProvinces(res.data.data || []);
  };
  const loadCities = async (provinceId) => {
    const res = await getCities({ province_id: provinceId || undefined, limit: 300 });
    setCities(res.data.data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadRegions();
      } catch (err) { toast.error(getErrorMessage(err)); }
    })();
  }, []);

  useEffect(() => {
    loadProvinces(selectedRegion).catch((err) => toast.error(getErrorMessage(err)));
  }, [selectedRegion]);

  useEffect(() => {
    loadCities(selectedProvince).catch((err) => toast.error(getErrorMessage(err)));
  }, [selectedProvince]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Gestion géographique</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <section className="card space-y-3">
          <h2 className="font-medium">Régions</h2>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (regionForm.id) await updateRegion(regionForm.id, regionForm);
                else await createRegion(regionForm);
                setRegionForm(regionInit);
                await loadRegions();
                toast.success('Région enregistrée');
              } catch (err) { toast.error(getErrorMessage(err)); }
            }}
          >
            <input className="form-input" placeholder="Code" value={regionForm.code} onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })} required />
            <input className="form-input" placeholder="Nom FR" value={regionForm.name_fr} onChange={(e) => setRegionForm({ ...regionForm, name_fr: e.target.value })} required />
            <input className="form-input" placeholder="Nom AR" value={regionForm.name_ar} onChange={(e) => setRegionForm({ ...regionForm, name_ar: e.target.value })} required />
            <button className="btn-primary w-full">{regionForm.id ? 'Mettre à jour' : 'Ajouter'}</button>
          </form>
          <div className="max-h-72 overflow-auto border rounded">
            {regions.map((r) => (
              <button key={r.id} className={`w-full text-left px-3 py-2 border-b ${selectedRegion === r.id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedRegion(r.id); setRegionForm(r); setProvinceForm({ ...provinceInit, region_id: r.id }); }}>
                <div className="font-medium">{r.name_fr}</div>
                <div className="text-xs text-gray-500">{r.code}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Provinces</h2>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (provinceForm.id) await updateProvince(provinceForm.id, provinceForm);
                else await createProvince(provinceForm);
                setProvinceForm({ ...provinceInit, region_id: selectedRegion || '' });
                await loadProvinces(selectedRegion);
                toast.success('Province enregistrée');
              } catch (err) { toast.error(getErrorMessage(err)); }
            }}
          >
            <select className="form-input" value={provinceForm.region_id} onChange={(e) => setProvinceForm({ ...provinceForm, region_id: e.target.value })} required>
              <option value="">Région</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
            </select>
            <input className="form-input" placeholder="Code" value={provinceForm.code} onChange={(e) => setProvinceForm({ ...provinceForm, code: e.target.value })} required />
            <input className="form-input" placeholder="Nom FR" value={provinceForm.name_fr} onChange={(e) => setProvinceForm({ ...provinceForm, name_fr: e.target.value })} required />
            <input className="form-input" placeholder="Nom AR" value={provinceForm.name_ar} onChange={(e) => setProvinceForm({ ...provinceForm, name_ar: e.target.value })} required />
            <button className="btn-primary w-full">{provinceForm.id ? 'Mettre à jour' : 'Ajouter'}</button>
          </form>
          <div className="max-h-72 overflow-auto border rounded">
            {provinces.map((p) => (
              <button key={p.id} className={`w-full text-left px-3 py-2 border-b ${selectedProvince === p.id ? 'bg-blue-50' : ''}`} onClick={() => { setSelectedProvince(p.id); setProvinceForm(p); setCityForm({ ...cityInit, province_id: p.id }); }}>
                <div className="font-medium">{p.name_fr}</div>
                <div className="text-xs text-gray-500">{p.code}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-medium">Villes</h2>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (cityForm.id) await updateCity(cityForm.id, cityForm);
                else await createCity(cityForm);
                setCityForm({ ...cityInit, province_id: selectedProvince || '' });
                await loadCities(selectedProvince);
                toast.success('Ville enregistrée');
              } catch (err) { toast.error(getErrorMessage(err)); }
            }}
          >
            <select className="form-input" value={cityForm.province_id} onChange={(e) => setCityForm({ ...cityForm, province_id: e.target.value })} required>
              <option value="">Province</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
            </select>
            <input className="form-input" placeholder="Code" value={cityForm.code} onChange={(e) => setCityForm({ ...cityForm, code: e.target.value })} required />
            <input className="form-input" placeholder="Nom FR" value={cityForm.name_fr} onChange={(e) => setCityForm({ ...cityForm, name_fr: e.target.value })} required />
            <input className="form-input" placeholder="Nom AR" value={cityForm.name_ar} onChange={(e) => setCityForm({ ...cityForm, name_ar: e.target.value })} required />
            <input className="form-input" placeholder="Code postal" value={cityForm.postal_code} onChange={(e) => setCityForm({ ...cityForm, postal_code: e.target.value })} />
            <button className="btn-primary w-full">{cityForm.id ? 'Mettre à jour' : 'Ajouter'}</button>
          </form>
          <div className="max-h-72 overflow-auto border rounded">
            {cities.map((c) => (
              <button key={c.id} className="w-full text-left px-3 py-2 border-b" onClick={() => setCityForm(c)}>
                <div className="font-medium">{c.name_fr}</div>
                <div className="text-xs text-gray-500">{c.code} {c.postal_code ? `• ${c.postal_code}` : ''}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
