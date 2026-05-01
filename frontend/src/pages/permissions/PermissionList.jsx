import { useState, useEffect } from 'react';
import { getPermissions } from '../../api/permissions.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const MODULE_COLORS = {
  users: 'bg-blue-100 text-blue-700',
  roles: 'bg-purple-100 text-purple-700',
  permissions: 'bg-green-100 text-green-700',
  dashboard: 'bg-orange-100 text-orange-700',
};

const getModuleColor = (module) => MODULE_COLORS[module] || 'bg-gray-100 text-gray-700';

export default function PermissionList() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPermissions()
      .then((res) => setGroups(res.data.data))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const total = Object.values(groups).reduce((acc, perms) => acc + perms.length, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">
          Permissions <span className="text-slate-400 font-normal">({total})</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {Object.entries(groups).map(([module, perms]) => (
          <div key={module} className="table-wrap">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getModuleColor(module)}`}>
                  {module}
                </span>
              </div>
              <span className="text-xs text-gray-400">{perms.length} permissions</span>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">Nom</th>
                  <th className="table-th">Code</th>
                  <th className="table-th">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {perms.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-medium text-gray-800">{p.name}</td>
                    <td className="table-td">
                      <code className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                        {p.code}
                      </code>
                    </td>
                    <td className="table-td text-gray-500">{p.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
