
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import POS from './pages/employee/POS';
import Orders from './pages/employee/Orders';
import Dashboard from './pages/manager/Dashboard';
import InventoryPage from './pages/manager/Inventory';
import POSM from './pages/manager/POSM';
import ManagerHistory from './pages/manager/History';
import AdminView from './pages/admin/AdminView';
import ProtectedRoute from './components/ProtectedRoute';
import AccessDenied from './pages/AccessDenied';

/**
 * App Component - Main Router Configuration
 * 
 * SECURITY: Route Structure with Role-Based Access Control
 * - Public routes: /, /access-denied
 * - Protected routes: Employee, Manager, Admin sections with explicit role requirements
 * - Each protected route uses ProtectedRoute wrapper for access validation
 */
function App() {
  console.log('🚀 [App Initialized - Route Configuration Loaded]');

  return (
    <BrowserRouter>
      <Routes>
        {/* 🔓 PUBLIC ROUTES - No authentication required */}
        <Route path="/" element={<Login />} />
        <Route path="/access-denied" element={<AccessDenied />} />

        {/* 🔐 PROTECTED EMPLOYEE ROUTES - Requires 'Employee' role */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute
              element={<Layout />}
              requiredRole="Employee"
            />
          }
        >
          <Route
            path="pos"
            element={
              <ProtectedRoute
                element={<POS />}
                requiredRole="Employee"
              />
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute
                element={<Orders />}
                requiredRole="Employee"
              />
            }
          />
        </Route>

        {/* 🔐 PROTECTED MANAGER ROUTES - Requires 'Manager' role */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute
              element={<Layout />}
              requiredRole="Manager"
            />
          }
        >
          <Route
            path="dashboard"
            element={
              <ProtectedRoute
                element={<Dashboard />}
                requiredRole="Manager"
              />
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute
                element={<InventoryPage />}
                requiredRole="Manager"
              />
            }
          />
          <Route
            path="posm"
            element={
              <ProtectedRoute
                element={<POSM />}
                requiredRole="Manager"
              />
            }
          />
          <Route
            path="history"
            element={
              <ProtectedRoute
                element={<ManagerHistory />}
                requiredRole="Manager"
              />
            }
          />
        </Route>

        {/* 🔐 PROTECTED ADMIN ROUTES - Requires 'Administrator' role */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              element={<Layout />}
              requiredRole="Administrator"
            />
          }
        >
          <Route
            index
            element={
              <ProtectedRoute
                element={<AdminView />}
                requiredRole="Administrator"
              />
            }
          />
          <Route
            path="history"
            element={
              <ProtectedRoute
                element={<AdminView />}
                requiredRole="Administrator"
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
