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
import ArticleDetailPage from '../pages/catalog/ArticleDetailPage';
import CatalogTaxonomyPage from '../pages/catalog/CatalogTaxonomyPage';
import CatalogRefPage from '../pages/catalog/CatalogRefPage';
import SkusPage from '../pages/catalog/SkusPage';
import SkuImagesPage from '../pages/catalog/SkuImagesPage';
import SkuImageFormPage from '../pages/catalog/SkuImageFormPage';
import GeoPage from '../pages/location/GeoPage';
import NodeTypesPage from '../pages/location/NodeTypesPage';
import NodeForm from '../pages/location/NodeForm';
import NodesPage from '../pages/location/NodesPage';
import NodeDetailPage from '../pages/location/NodeDetailPage';
import P0TablesHub from '../pages/p0/P0TablesHub';
import P0TablePage from '../pages/p0/P0TablePage';
import CustomerList from '../pages/customers/CustomerList';
import CustomerDetail from '../pages/customers/CustomerDetail';
import WarehousePage from '../pages/warehouse/WarehousePage';
import ZonesPage from '../pages/warehouse/ZonesPage';
import LevelsPage from '../pages/warehouse/LevelsPage';
import MoveTypesPage from '../pages/stock/MoveTypesPage';
import StockStatusesPage from '../pages/stock/StockStatusesPage';
import InventoryTypesPage from '../pages/stock/InventoryTypesPage';
import InventoryStatusesPage from '../pages/stock/InventoryStatusesPage';
import InventoryGapTypesPage from '../pages/stock/InventoryGapTypesPage';
import StockThresholdsPage from '../pages/stock/StockThresholdsPage';
import StockLevelsPage from '../pages/stock/StockLevelsPage';
import SellingRulesPage from '../pages/stock/SellingRulesPage';
import ReorderRulesPage from '../pages/stock/ReorderRulesPage';
import StockMovesPage   from '../pages/stock/StockMovesPage';
import StockLotsPage    from '../pages/stock/StockLotsPage';

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
          <Route path="/catalog/taxonomy" element={<CatalogTaxonomyPage />} />
          <Route path="/catalog/refs" element={<CatalogRefPage />} />
          <Route path="/catalog/articles" element={<ArticleList />} />
          <Route path="/catalog/articles/new" element={<ArticleForm />} />
          <Route path="/catalog/articles/:id/edit" element={<ArticleForm />} />
          <Route path="/catalog/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/catalog/skus" element={<SkusPage />} />
          <Route path="/catalog/sku-images/new" element={<SkuImageFormPage />} />
          <Route path="/catalog/sku-images/:id/edit" element={<SkuImageFormPage />} />
          <Route path="/catalog/sku-images" element={<SkuImagesPage />} />
          {/* Geography — GeoPage handles regions / provinces / cities drill-down */}
          <Route path="/geo" element={<GeoPage />} />
          <Route path="/geo/regions" element={<GeoPage />} />
          <Route path="/geo/provinces" element={<GeoPage />} />
          <Route path="/geo/cities" element={<GeoPage />} />
          {/* Node paramétrage */}
          <Route path="/node-types" element={<NodeTypesPage />} />
          {/* Nodes */}
          <Route path="/nodes" element={<NodesPage />} />
          <Route path="/nodes/:id" element={<NodeDetailPage />} />
          <Route path="/nodes/new" element={<NodeForm />} />
          <Route path="/nodes/:id/edit" element={<NodeForm />} />
          {/* Warehouse */}
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/warehouse/zones" element={<ZonesPage />} />
          <Route path="/warehouse/levels" element={<LevelsPage />} />
          {/* Stock paramétrage */}
          <Route path="/stock/move-types"       element={<MoveTypesPage />} />
          <Route path="/stock/stock-statuses"  element={<StockStatusesPage />} />
          <Route path="/stock/inventory-types" element={<InventoryTypesPage />} />
          <Route path="/stock/inventory-statuses"  element={<InventoryStatusesPage />} />
          <Route path="/stock/inventory-gap-types" element={<InventoryGapTypesPage />} />
          <Route path="/stock/thresholds"          element={<StockThresholdsPage />} />
          <Route path="/stock/levels"              element={<StockLevelsPage />} />
          <Route path="/stock/selling-rules"       element={<SellingRulesPage />} />
          <Route path="/stock/reorder-rules"      element={<ReorderRulesPage />} />
          <Route path="/stock/moves"               element={<StockMovesPage />} />
          <Route path="/stock/lots"                element={<StockLotsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
