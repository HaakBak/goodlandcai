
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import POS from './pages/employee/POS';
import Orders from './pages/employee/Orders';
import Dashboard from './pages/manager/Dashboard';
import InventoryPage from './pages/manager/Inventory';
import POSM from './pages/manager/POSM';
import AdminView from './pages/admin/AdminView';

{/* Navigation between each pages */}
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Employee Routes */}
        <Route path="/employee" element={<Layout />}>
          <Route path="pos" element={<POS />} />
          <Route path="orders" element={<Orders />} />
        </Route>

        {/* Manager Routes */}
        <Route path="/manager" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="posm" element={<POSM />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<Layout />}>
          <Route index element={<AdminView />} />
          <Route path="history" element={<AdminView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
