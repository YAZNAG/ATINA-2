import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deleteNode, getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

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
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Nodes (entrepôts)</h1>
        <Link to="/nodes/new" className="btn-primary text-sm">
          <AddIcon />
          Ajouter un node
        </Link>
      </div>
      <div className="table-wrap">
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
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    <EditButton onClick={() => navigate(`/nodes/${n.id}/edit`)} />
                    <DeleteButton onClick={async () => {
                      if (!window.confirm('Supprimer ce node ?')) return;
                      try {
                        await deleteNode(n.id);
                        await load();
                        toast.success('Node supprimé');
                      } catch (err) { toast.error(getErrorMessage(err)); }
                    }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
