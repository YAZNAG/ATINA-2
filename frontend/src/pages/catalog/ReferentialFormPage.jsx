import { useState, useEffect } from 'react';
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
          const row = res.data.data;
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
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetching(false);
      }
    };

    load();
  }, [cfg, id, isEdit]);

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

  const handleImageToBase64 = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((f) => ({ ...f, image_base64: reader.result }));
      }
    };
    reader.onerror = () => {
      toast.error('Erreur de lecture image');
    };
    reader.readAsDataURL(file);
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
      delete payload._ui_family_id;
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cfg || !canSave) return;
    setLoading(true);
    try {
      const payload = normalizePayload();
      if (isEdit) {
        await cfg.api.update(id, payload);
        toast.success('Enregistrement mis à jour');
      } else {
        await cfg.api.create(payload);
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
    if (field.name === 'image_base64') {
      return (
        <div key={field.name} className="space-y-2">
          <label className="form-label">Image</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="form-input"
            onChange={handleImageToBase64}
          />
          {form.image_base64 ? (
            <img
              src={form.image_base64}
              alt="preview"
              className="h-24 w-24 rounded object-cover border border-gray-200"
            />
          ) : null}
        </div>
      );
    }

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
