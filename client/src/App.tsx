import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';

// Pages
import Dashboard      from './pages/Dashboard';
import Products       from './pages/Products';
import ProductDetail  from './pages/ProductDetail';
import ProductNew     from './pages/ProductNew';
import Orders         from './pages/Orders';
import OrderDetail    from './pages/OrderDetail';
import Integrations   from './pages/Integrations';
import IntegrationDetail from './pages/IntegrationDetail';
import Inventory      from './pages/Inventory';
import Categories     from './pages/Categories';
import CategoryNew    from './pages/CategoryNew';
import CategoryDetail from './pages/CategoryDetail';
import Customers        from './pages/Customers';
import CustomerDetail   from './pages/CustomerDetail';
import Flows          from './pages/Flows';
import Logs           from './pages/Logs';
import Settings       from './pages/Settings';
import Account        from './pages/Account';
import Support        from './pages/Support';
import Training       from './pages/Training';
import Login          from './pages/Login';
import Operations     from './pages/Operations';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"         element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/dashboard"        element={<Dashboard />} />
          <Route path="/products"         element={<Products />} />
          <Route path="/products/new"     element={<ProductNew />} />
          <Route path="/products/:id"     element={<ProductDetail />} />
          <Route path="/orders"           element={<Orders />} />
          <Route path="/orders/:id"       element={<OrderDetail />} />
          <Route path="/integrations"     element={<Integrations />} />
          <Route path="/integrations/:slug" element={<IntegrationDetail />} />
          <Route path="/inventory"        element={<Inventory />} />
          <Route path="/categories"         element={<Categories />} />
          <Route path="/categories/new"   element={<CategoryNew />} />
          <Route path="/categories/:id"   element={<CategoryDetail />} />
          <Route path="/customers"          element={<Customers />} />
          <Route path="/customers/:key"   element={<CustomerDetail />} />
          <Route path="/flows"            element={<Flows />} />
          <Route path="/logs"             element={<Logs />} />
          <Route path="/operations"       element={<Operations />} />
          <Route path="/settings"         element={<Settings />} />
          <Route path="/account"          element={<Account />} />
          <Route path="/destek"           element={<Support />} />
          <Route path="/egitim"           element={<Training />} />
          <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
