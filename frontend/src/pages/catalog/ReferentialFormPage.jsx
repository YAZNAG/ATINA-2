import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { getEntityConfig } from './entityRegistry';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

function buildInitialForm(fields) {
  const f = {};
  for (const field of fields) {
    if (field.default !== undefined) f[field.name] = field.default;
    else if (field.type === 'number') f[field.name] = '';
    else if (field.type === 'select' && field.options) f[field.name] = field.options[0]?.value ?? '';
    else f[field.name] = '';
  }
  return f;
}

export default function ReferentialFormPage() {
  const { entitySlug, id } = useParams();
  const isEdit = Boolean(id);
  const cfg = getEntityConfig(entitySlug);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [selectOptions, setSelectOptions] = useState({});
  /** Cascade sous-catégories */
  const [uiFamilyId, setUiFamilyId] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);

  /** Marque : fichier logo (multipart) */
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState(null);
  const brandLogoRevokeRef = useRef(null);

  const [familyImageFile, setFamilyImageFile] = useState(null);
  const [familyIconFile, setFamilyIconFile] = useState(null);
  const [familyImagePreview, setFamilyImagePreview] = useState(null);
  const [familyIconPreview, setFamilyIconPreview] = useState(null);
  const familyImgRevokeRef = useRef(null);
  const familyIconRevokeRef = useRef(null);
  const [familyRemotePaths, setFamilyRemotePaths] = useState({ image_path: null, icon_path: null });

  const canSave = cfg && (isEdit ? hasPermission(cfg.permissions.update) : hasPermission(cfg.permissions.create));

  useEffect(() => {
    if (!cfg) {
      setFetching(false);
      return;
    }

    const load = async () => {
      setFetching(true);
      const initial = buildInitialForm(cfg.fields);
      try {
        const loaded = { ...initial };
        let row = null;

        for (const field of cfg.fields) {
          if (field.type === 'select' && field.loadOptions && !field.options) {
            const loaded = await field.loadOptions();
            const list = Array.isArray(loaded) ? loaded : (loaded?.data?.data ?? []);
            setSelectOptions((prev) => ({ ...prev, [field.name]: list }));
          }
        }

        if (cfg.special === 'subcategory') {
          const famRes = await catalog.getFamiliesList();
          setSelectOptions((prev) => ({ ...prev, _families: famRes.data.data }));
        }

        if (isEdit) {
          const res = await cfg.api.get(id);
          row = res.data.data;
          for (const field of cfg.fields) {
            if (row[field.name] !== undefined && row[field.name] !== null) {
              loaded[field.name] = row[field.name];
            }
          }
          if (cfg.special === 'subcategory') {
            const famId = row.category?.family?.id ?? row.category?.family_id;
            if (famId) {
              setUiFamilyId(String(famId));
              const cats = (await catalog.getCategoriesList(famId)).data.data;
              setCategoryOptions(cats);
            }
            loaded.category_id = row.category_id;
          }
        }

        setForm(loaded);
        setBrandLogoFile(null);
        if (brandLogoRevokeRef.current) {
          URL.revokeObjectURL(brandLogoRevokeRef.current);
          brandLogoRevokeRef.current = null;
        }
        setBrandLogoPreview(null);
        setFamilyImageFile(null);
        setFamilyIconFile(null);
        if (familyImgRevokeRef.current) {
          URL.revokeObjectURL(familyImgRevokeRef.current);
          familyImgRevokeRef.current = null;
        }
        if (familyIconRevokeRef.current) {
          URL.revokeObjectURL(familyIconRevokeRef.current);
          familyIconRevokeRef.current = null;
        }
        setFamilyImagePreview(null);
        setFamilyIconPreview(null);
        if (
          (cfg.special === 'family' || cfg.special === 'category' || cfg.special === 'subcategory')
          && isEdit && row
        ) {
          setFamilyRemotePaths({
            image_path: row.image_path ?? null,
            icon_path: row.icon_path ?? null,
          });
        } else {
          setFamilyRemotePaths({ image_path: null, icon_path: null });
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetching(false);
      }
    };

    load();
  }, [cfg, id, isEdit]);

  useEffect(() => {
    setBrandLogoFile(null);
    if (brandLogoRevokeRef.current) {
      URL.revokeObjectURL(brandLogoRevokeRef.current);
      brandLogoRevokeRef.current = null;
    }
    setBrandLogoPreview(null);
    setFamilyImageFile(null);
    setFamilyIconFile(null);
    if (familyImgRevokeRef.current) {
      URL.revokeObjectURL(familyImgRevokeRef.current);
      familyImgRevokeRef.current = null;
    }
    if (familyIconRevokeRef.current) {
      URL.revokeObjectURL(familyIconRevokeRef.current);
      familyIconRevokeRef.current = null;
    }
    setFamilyImagePreview(null);
    setFamilyIconPreview(null);
    setFamilyRemotePaths({ image_path: null, icon_path: null });
  }, [entitySlug]);

  useEffect(() => () => {
    if (brandLogoRevokeRef.current) URL.revokeObjectURL(brandLogoRevokeRef.current);
    if (familyImgRevokeRef.current) URL.revokeObjectURL(familyImgRevokeRef.current);
    if (familyIconRevokeRef.current) URL.revokeObjectURL(familyIconRevokeRef.current);
  }, []);

  useEffect(() => {
    if (!cfg || cfg.special !== 'subcategory' || !uiFamilyId) {
      if (cfg?.special === 'subcategory' && !uiFamilyId) setCategoryOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cats = (await catalog.getCategoriesList(uiFamilyId)).data.data;
        if (!cancelled) setCategoryOptions(cats);
      } catch {
        if (!cancelled) setCategoryOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [cfg, uiFamilyId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const normalizePayload = () => {
    const payload = { ...form };
    for (const field of cfg.fields) {
      if (field.type === 'number') {
        const v = payload[field.name];
        if (v === '' || v === undefined) payload[field.name] = null;
        else payload[field.name] = Number(v);
      }
      if (field.name === 'unit_id' && !payload.unit_id) payload.unit_id = null;
    }
    if (cfg.special === 'subcategory') {
      const cid = payload.category_id;
      if (cid === '' || cid === undefined || cid === null) {
        payload.category_id = null;
      } else {
        const n = Number(cid);
        payload.category_id = Number.isNaN(n) ? null : n;
      }
      delete payload._ui_family_id;
    }
    if (cfg.special === 'category') {
      const fid = payload.family_id;
      if (fid === '' || fid === undefined || fid === null) {
        payload.family_id = null;
      } else {
        const n = Number(fid);
        payload.family_id = Number.isNaN(n) ? null : n;
      }
    }
    return payload;
  };

  const buildBrandFormData = (payload) => {
    const fd = new FormData();
    const keys = ['name_fr', 'name_ar', 'code', 'status', 'description_fr', 'description_ar'];
    for (const key of keys) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      fd.append(key, typeof v === 'boolean' ? String(v) : String(v));
    }
    if (brandLogoFile) fd.append('logo', brandLogoFile);
    return fd;
  };

  const buildCatalogImageFormData = (payload) => {
    const fd = new FormData();
    let keys = [];
    if (cfg.special === 'family') {
      keys = ['name_fr', 'name_ar', 'code', 'description_fr', 'description_ar', 'status', 'sort_order'];
    } else if (cfg.special === 'category') {
      keys = ['name_fr', 'name_ar', 'code', 'family_id', 'description_fr', 'description_ar', 'status', 'sort_order'];
    } else if (cfg.special === 'subcategory') {
      keys = ['name_fr', 'name_ar', 'code', 'category_id', 'description_fr', 'description_ar', 'status', 'sort_order'];
    }
    for (const key of keys) {
      const v = payload[key];
      if (v === undefined || v === null) continue;
      fd.append(key, String(v));
    }
    if (familyImageFile) fd.append('image', familyImageFile);
    if (familyIconFile) fd.append('icon', familyIconFile);
    return fd;
  };

  const storagePreviewSrc = (p) => {
    if (!p) return null;
    const s = String(p).trim();
    return s.startsWith('http') ? s : (s.startsWith('/') ? s : `/${s}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cfg || !canSave) return;
    setLoading(true);
    try {
      const payload = normalizePayload();
      if (cfg.special === 'subcategory' && !isEdit && payload.category_id == null) {
        toast.error('Choisissez une famille, puis une catégorie.');
        setLoading(false);
        return;
      }
      if (cfg.special === 'category' && !isEdit && payload.family_id == null) {
        toast.error('Choisissez une famille.');
        setLoading(false);
        return;
      }
      let body = payload;
      if (cfg.special === 'brand') body = buildBrandFormData(payload);
      else if (cfg.special === 'family' || cfg.special === 'category' || cfg.special === 'subcategory') {
        body = buildCatalogImageFormData(payload);
      }

      if (isEdit) {
        await cfg.api.update(id, body);
        toast.success('Enregistrement mis à jour');
      } else {
        await cfg.api.create(body);
        toast.success('Créé avec succès');
      }
      navigate(`/catalog/ref/${entitySlug}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!cfg) {
    return (
      <div className="text-center py-12 text-gray-500">
        Référentiel inconnu. <Link to="/catalog" className="text-blue-600">Retour</Link>
      </div>
    );
  }

  if (!canSave) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const renderField = (field) => {
    if (cfg.special === 'subcategory' && field.name === 'category_id') {
      return (
        <div key="cat-block">
          <label className="form-label">Famille (pour filtrer les catégories)</label>
          <select
            className="form-input mb-4"
            value={uiFamilyId}
            onChange={(e) => {
              setUiFamilyId(e.target.value);
              setForm((f) => ({ ...f, category_id: '' }));
            }}
          >
            <option value="">— Choisir une famille —</option>
            {(selectOptions._families || []).map((o) => (
              <option key={o.id} value={o.id}>{o.name_fr}</option>
            ))}
          </select>
          <label className="form-label">{field.label} *</label>
          <select
            name="category_id"
            className="form-input"
            required
            value={form.category_id ?? ''}
            onChange={handleChange}
            disabled={!uiFamilyId}
          >
            <option value="">— Choisir une catégorie —</option>
            {categoryOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name_fr}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name}>
          <label className="form-label">{field.label}</label>
          <select
            name={field.name}
            className="form-input"
            value={form[field.name] ?? ''}
            onChange={handleChange}
            required={field.required}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'select' && field.loadOptions) {
      const opts = selectOptions[field.name] || [];
      return (
        <div key={field.name}>
          <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
          <select
            name={field.name}
            className="form-input"
            value={form[field.name] ?? ''}
            onChange={handleChange}
            required={field.required}
          >
            <option value="">{field.required ? `— Choisir —` : '—'}</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>{field.optionLabel(o)}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name}>
          <label className="form-label">{field.label}</label>
          <textarea
            name={field.name}
            className="form-input"
            rows={3}
            value={form[field.name] ?? ''}
            onChange={handleChange}
          />
        </div>
      );
    }

    return (
      <div key={field.name}>
        <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
        <input
          name={field.name}
          type={field.type === 'number' ? 'number' : 'text'}
          step={field.step}
          className="form-input"
          value={form[field.name] ?? ''}
          onChange={handleChange}
          required={field.required}
          placeholder={field.placeholder}
        />
      </div>
    );
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <Link to={`/catalog/ref/${entitySlug}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {cfg.label}
        </Link>
        <h1 className="text-lg font-semibold text-gray-800 mt-2">
          {isEdit ? 'Modifier' : 'Nouveau'} — {cfg.label}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {cfg.fields.map((field) => renderField(field))}
        {cfg.special === 'brand' && (
          <div className="space-y-2">
            <label className="form-label">Logo (fichier)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="form-input"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (brandLogoRevokeRef.current) {
                  URL.revokeObjectURL(brandLogoRevokeRef.current);
                  brandLogoRevokeRef.current = null;
                }
                setBrandLogoFile(f);
                if (f) {
                  const url = URL.createObjectURL(f);
                  brandLogoRevokeRef.current = url;
                  setBrandLogoPreview(url);
                } else {
                  setBrandLogoPreview(null);
                }
              }}
            />
            <p className="text-xs text-slate-500">
              Optionnel. Sinon utilisez l’URL du logo ou laissez vide.
            </p>
            {(brandLogoPreview || form.logo) && (
              <div className="flex items-center gap-3">
                {brandLogoPreview ? (
                  <img src={brandLogoPreview} alt="" className="h-16 w-16 object-contain rounded border border-slate-200 bg-white p-1" />
                ) : form.logo ? (
                  <img
                    src={form.logo.startsWith('/') ? form.logo : `/${form.logo}`}
                    alt=""
                    className="h-16 w-16 object-contain rounded border border-slate-200 bg-white p-1"
                  />
                ) : null}
              </div>
            )}
            <p className="text-xs text-slate-500">Enregistré sous storage/image/marque/&lt;id&gt;/logo.*</p>
          </div>
        )}
        {(cfg.special === 'family' || cfg.special === 'category' || cfg.special === 'subcategory') && (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <label className="form-label">Image (fichier)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="form-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (familyImgRevokeRef.current) {
                    URL.revokeObjectURL(familyImgRevokeRef.current);
                    familyImgRevokeRef.current = null;
                  }
                  setFamilyImageFile(f);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    familyImgRevokeRef.current = url;
                    setFamilyImagePreview(url);
                  } else {
                    setFamilyImagePreview(null);
                  }
                }}
              />
              <p className="text-xs text-slate-500">
                Fichier sur disque : storage/image/
                {cfg.special === 'family' ? 'famille' : cfg.special === 'category' ? 'categorie' : 'sous-categorie'}
                /&lt;id&gt;/image.* → image_path
              </p>
              {(familyImagePreview || familyRemotePaths.image_path) && (
                <img
                  src={familyImagePreview || storagePreviewSrc(familyRemotePaths.image_path)}
                  alt=""
                  className="h-20 w-20 rounded object-cover border border-slate-200 bg-white"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="form-label">Icône (fichier)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="form-input"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (familyIconRevokeRef.current) {
                    URL.revokeObjectURL(familyIconRevokeRef.current);
                    familyIconRevokeRef.current = null;
                  }
                  setFamilyIconFile(f);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    familyIconRevokeRef.current = url;
                    setFamilyIconPreview(url);
                  } else {
                    setFamilyIconPreview(null);
                  }
                }}
              />
              <p className="text-xs text-slate-500">
                Fichier sur disque : storage/image/
                {cfg.special === 'family' ? 'famille' : cfg.special === 'category' ? 'categorie' : 'sous-categorie'}
                /&lt;id&gt;/icon.* → icon_path
              </p>
              {(familyIconPreview || familyRemotePaths.icon_path) && (
                <img
                  src={familyIconPreview || storagePreviewSrc(familyRemotePaths.icon_path)}
                  alt=""
                  className="h-16 w-16 rounded object-contain border border-slate-200 bg-white p-1"
                />
              )}
            </div>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '…' : 'Enregistrer'}
          </button>
          <Link to={`/catalog/ref/${entitySlug}`} className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
