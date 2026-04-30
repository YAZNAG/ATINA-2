import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { createNodeType, getNodeTypes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const init = { code: '', name_fr: '', name_ar: '' };

export default function NodeTypesPage() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(init);

  const load = async () => {
    const res = await getNodeTypes();
    setTypes(res.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-semibold">Types de node</h1>
      <form
        className="card grid md:grid-cols-4 gap-3 items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createNodeType(form);
            setForm(init);
            await load();
            toast.success('Type ajouté');
          } catch (err) { toast.error(getErrorMessage(err)); }
        }}
      >
        <div><label className="form-label">Code</label><input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
        <div><label className="form-label">Nom FR</label><input className="form-input" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} required /></div>
        <div><label className="form-label">Nom AR</label><input className="form-input" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required /></div>
        <button className="btn-primary">Ajouter</button>
      </form>
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr><th className="table-th">Code</th><th className="table-th">Nom FR</th><th className="table-th">Nom AR</th></tr></thead>
          <tbody>{types.map((t) => <tr key={t.id}><td className="table-td">{t.code}</td><td className="table-td">{t.name_fr}</td><td className="table-td">{t.name_ar}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
