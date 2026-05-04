import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import P0GenericCrud from '../p0/P0GenericCrud';

export default function CustomerList() {
  const { hasPermission } = useAuth();

  const canManage = hasPermission('customers.view') || hasPermission('dashboard.view');

  if (!canManage) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  return (
    <div className="page-shell max-w-7xl">
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Tableau de bord
          </Link>
          <h1 className="page-title mt-1">Clients</h1>
        </div>
      </div>

      <P0GenericCrud sql="customers" embedded />
    </div>
  );
}
