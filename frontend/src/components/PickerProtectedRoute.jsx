import { Navigate, Outlet } from 'react-router-dom';
import { usePickerAuth } from '../context/PickerAuthContext';

export default function PickerProtectedRoute() {
  const { isAuthenticated, loading } = usePickerAuth();

  // Pendant le chargement initial du contexte, on bloque sans rediriger
  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/picker/login" replace />;

  return <Outlet />;
}
