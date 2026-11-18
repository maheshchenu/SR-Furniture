
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";

import Dashboard from "./pages/Dashboard";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import CustomerDues from "./pages/CustomerDues";
import ManufacturerPayments from "./pages/ManufacturerPayments";
import AdminLogin from "./pages/AdminLogin";

import { getAdminToken } from "./services/api";

// Protected Admin Routes
function ProtectedRoute() {
  const token = getAdminToken();

  return token ? <Outlet /> : <Navigate to="/" replace />;
}

function App() {
  const isAuthenticated = Boolean(getAdminToken());

  return (
    <BrowserRouter>
      <Routes>

        {/* Root URL: Login or Dashboard */}
        <Route
          path="/"
          element={
            isAuthenticated ? <DashboardLayout /> : <AdminLogin />
          }
        >
          <Route index element={<Dashboard />} />

          <Route
            element={<ProtectedRoute />}
          >
            <Route path="categories" element={<Categories />} />
            <Route path="products" element={<Products />} />
            <Route path="sales" element={<Sales />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports" element={<Reports />} />
            <Route path="customer-dues" element={<CustomerDues />} />
            <Route
              path="manufacturer-payments"
              element={<ManufacturerPayments />}
            />
          </Route>
        </Route>

        {/* Old Login URL redirects to Root */}
        <Route
          path="/login"
          element={<Navigate to="/" replace />}
        />

        {/* Invalid URL */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
