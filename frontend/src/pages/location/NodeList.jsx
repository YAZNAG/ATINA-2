import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deleteNode, getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

export default function NodeList() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    const res = await getNodes({ limit: 100 });
    setRows(res.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Nodes (entrepôts)</h1>
        <Link to="/nodes/new" className="btn-primary text-sm">+ Ajouter un node</Link>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-th">Code</th>
              <th className="table-th">Nom FR</th>
              <th className="table-th">Type</th>
              <th className="table-th">Ville</th>
              <th className="table-th">Actif</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td className="table-td">{n.code}</td>
                <td className="table-td">{n.name_fr}</td>
                <td className="table-td">{n.node_type?.name_fr}</td>
                <td className="table-td">{n.city?.name_fr}</td>
                <td className="table-td">{n.is_active ? 'Oui' : 'Non'}</td>
                <td className="table-td space-x-3">
                  <button className="text-blue-600" onClick={() => navigate(`/nodes/${n.id}/edit`)}>Modifier</button>
                  <button
                    className="text-red-500"
                    onClick={async () => {
                      if (!window.confirm('Supprimer ce node ?')) return;
                      try {
                        await deleteNode(n.id);
                        await load();
                        toast.success('Node supprimé');
                      } catch (err) { toast.error(getErrorMessage(err)); }
                    }}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
