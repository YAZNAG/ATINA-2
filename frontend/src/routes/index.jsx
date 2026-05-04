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
import SkusPage from '../pages/catalog/SkusPage';
import SkuImagesPage from '../pages/catalog/SkuImagesPage';
import SkuImageFormPage from '../pages/catalog/SkuImageFormPage';
import GeoDashboard from '../pages/location/GeoDashboard';
import RegionsPage from '../pages/location/RegionsPage';
import ProvincesPage from '../pages/location/ProvincesPage';
import CitiesPage from '../pages/location/CitiesPage';
import RegionFormPage from '../pages/location/RegionFormPage';
import ProvinceFormPage from '../pages/location/ProvinceFormPage';
import CityFormPage from '../pages/location/CityFormPage';
import NodeTypesPage from '../pages/location/NodeTypesPage';
import NodeTypeFormPage from '../pages/location/NodeTypeFormPage';
import NodeList from '../pages/location/NodeList';
import NodeForm from '../pages/location/NodeForm';
import P0TablesHub from '../pages/p0/P0TablesHub';
import P0TablePage from '../pages/p0/P0TablePage';
import P0RelationsPage from '../pages/p0/P0RelationsPage';
import CustomerList from '../pages/customers/CustomerList';
import CustomerDetail from '../pages/customers/CustomerDetail';

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
          <Route path="/p0/tables" element={<P0TablesHub />} />
          <Route path="/p0/relations" element={<P0RelationsPage />} />
          <Route path="/p0/tables/:sql" element={<P0TablePage />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
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
          <Route path="/catalog/skus" element={<SkusPage />} />
          <Route path="/catalog/sku-images/new" element={<SkuImageFormPage />} />
          <Route path="/catalog/sku-images/:id/edit" element={<SkuImageFormPage />} />
          <Route path="/catalog/sku-images" element={<SkuImagesPage />} />
          <Route path="/geo" element={<GeoDashboard />} />
          <Route path="/geo/regions" element={<RegionsPage />} />
          <Route path="/geo/regions/new" element={<RegionFormPage />} />
          <Route path="/geo/regions/:id/edit" element={<RegionFormPage />} />
          <Route path="/geo/provinces" element={<ProvincesPage />} />
          <Route path="/geo/provinces/new" element={<ProvinceFormPage />} />
          <Route path="/geo/provinces/:id/edit" element={<ProvinceFormPage />} />
          <Route path="/geo/cities" element={<CitiesPage />} />
          <Route path="/geo/cities/new" element={<CityFormPage />} />
          <Route path="/geo/cities/:id/edit" element={<CityFormPage />} />
          <Route path="/node-types" element={<NodeTypesPage />} />
          <Route path="/node-types/new" element={<NodeTypeFormPage />} />
          <Route path="/node-types/:id/edit" element={<NodeTypeFormPage />} />
          <Route path="/nodes" element={<NodeList />} />
          <Route path="/nodes/new" element={<NodeForm />} />
          <Route path="/nodes/:id/edit" element={<NodeForm />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
