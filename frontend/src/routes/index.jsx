import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/dashboard/Dashboard';
import UserList from '../pages/users/UserList';
import UserForm from '../pages/users/UserForm';
import RoleList from '../pages/roles/RoleList';
import RoleForm from '../pages/roles/RoleForm';
import PermissionList from '../pages/permissions/PermissionList';
import CatalogDashboard from '../pages/catalog/CatalogDashboard';
import ReferentialListPage from '../pages/catalog/ReferentialListPage';
import ReferentialFormPage from '../pages/catalog/ReferentialFormPage';
import ArticleList from '../pages/catalog/ArticleList';
import ArticleForm from '../pages/catalog/ArticleForm';

export default function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<UserList />} />
          <Route path="/users/new" element={<UserForm />} />
          <Route path="/users/:id/edit" element={<UserForm />} />
          <Route path="/roles" element={<RoleList />} />
          <Route path="/roles/new" element={<RoleForm />} />
          <Route path="/roles/:id/edit" element={<RoleForm />} />
          <Route path="/permissions" element={<PermissionList />} />
          <Route path="/catalog" element={<CatalogDashboard />} />
          <Route path="/catalog/ref/:entitySlug/new" element={<ReferentialFormPage />} />
          <Route path="/catalog/ref/:entitySlug/:id/edit" element={<ReferentialFormPage />} />
          <Route path="/catalog/ref/:entitySlug" element={<ReferentialListPage />} />
          <Route path="/catalog/articles" element={<ArticleList />} />
          <Route path="/catalog/articles/new" element={<ArticleForm />} />
          <Route path="/catalog/articles/:id/edit" element={<ArticleForm />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
