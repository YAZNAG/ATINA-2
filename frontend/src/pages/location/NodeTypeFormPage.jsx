import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createNodeType, getNodeType, updateNodeType } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const initialForm = { code: '', name_fr: '', name_ar: '' };

export default function NodeTypeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const canSave = isEdit ? hasPermission('node_types.update') : hasPermission('node_types.create');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await getNodeType(id);
        setForm({ ...initialForm, ...res.data.data });
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetching(false);
      }
    })();
  }, [id, isEdit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      if (isEdit) await updateNodeType(id, form);
      else await createNodeType(form);
      toast.success(isEdit ? 'Type mis a jour' : 'Type cree');
      navigate('/node-types');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  if (!canSave) {
    return <div className="text-center py-12 text-red-600">Acces refuse.</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <Link to="/node-types" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Types node</Link>
        <h1 className="text-lg font-semibold text-gray-800 mt-2">{isEdit ? 'Modifier' : 'Nouveau'} type node</h1>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="form-label">Code *</label>
          <input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Nom FR *</label>
          <input className="form-input" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Nom AR *</label>
          <input className="form-input" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '...' : 'Enregistrer'}</button>
          <Link to="/node-types" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
