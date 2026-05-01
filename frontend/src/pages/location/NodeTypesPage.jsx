import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deleteNodeType, getNodeTypes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';
import { useAuth } from '../../context/AuthContext';

export default function NodeTypesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);

  const load = async () => {
    const res = await getNodeTypes();
    setTypes(res.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Types de node</h1>
          <p className="page-subtitle">Liste des types logistiques.</p>
        </div>
        {hasPermission('node_types.create') && (
          <Link to="/node-types/new" className="btn-primary text-sm">
            <AddIcon />
            Nouveau type
          </Link>
        )}
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Code</th>
                <th className="table-th">Nom FR</th>
                <th className="table-th">Nom AR</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {types.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400 text-sm">
                    Aucun type
                  </td>
                </tr>
              ) : (
                types.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td">{t.code}</td>
                    <td className="table-td">{t.name_fr}</td>
                    <td className="table-td">{t.name_ar}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        {hasPermission('node_types.update') && (
                          <EditButton onClick={() => navigate(`/node-types/${t.id}/edit`)} />
                        )}
                        {hasPermission('node_types.delete') && (
                          <DeleteButton onClick={async () => {
                            if (!window.confirm(`Supprimer le type "${t.name_fr}" ?`)) return;
                            try {
                              await deleteNodeType(t.id);
                              toast.success('Type supprime');
                              load();
                            } catch (err) {
                              toast.error(getErrorMessage(err));
                            }
                          }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
