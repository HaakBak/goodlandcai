
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
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
import { getSupabaseClient } from './services/databaseService';
import { getUserRole, clearUserSession } from './services/privilegeService';

// Import debug utilities for development console access only
if (import.meta.env.DEV) {
  import('./services/adminDebugUtils');   // Admin user debugging
  import('./services/loggingService');    // Global logging control
}

/**
 * App Component - Main Router Configuration
 * 
 * SECURITY: Route Structure with Role-Based Access Control
 * - Public routes: /, /access-denied
 * - Protected routes: Employee, Manager, Admin sections with explicit role requirements
 * - Each protected route uses ProtectedRoute wrapper for access validation
 * - Session validation on app startup ensures user is authenticated
 * - ErrorBoundary wraps all routes for graceful error handling
 */
function App() {
  const [isSessionValid, setIsSessionValid] = useState(null); // null = checking, true/false = result
  
  // SECURITY: Validate session on app startup
  useEffect(() => {
    const validateSession = async () => {
      try {
        const userRole = getUserRole();
        const supabase = getSupabaseClient();
        
        // If user has role but no Supabase client, clear session (security)
        if (userRole && !supabase) {
          console.warn('[App] ⚠️  User role found but Supabase client unavailable. Clearing session.');
          clearUserSession();
          setIsSessionValid(false);
          return;
        }
        
        // Check if user has valid Supabase session
        if (supabase) {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[App] 🔴 Session validation error:', error);
            clearUserSession();
            setIsSessionValid(false);
            return;
          }
          
          if (session && userRole) {
            console.log('[App] ✅ Session valid - User authenticated', { userRole });
            setIsSessionValid(true);
          } else if (!session && userRole) {
            console.warn('[App] ⚠️  Supabase session missing but userRole present. Clearing session.');
            clearUserSession();
            setIsSessionValid(false);
          } else {
            console.log('[App] 🔓 No session - User not logged in');
            setIsSessionValid(true); // Allow public routes (login page)
          }
        } else {
          // Supabase not available (offline mode) - trust sessionStorage
          console.log('[App] 📴 Offline mode - trusting sessionStorage');
          setIsSessionValid(true);
        }
      } catch (err) {
        console.error('[App] 🔴 Unexpected error during session validation:', err);
        clearUserSession();
        setIsSessionValid(false);
      }
    };
    
    validateSession();
  }, []);
  
  // Show loading state while validating session
  if (isSessionValid === null) {
    return (
      <div className="w-full flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Validating session...</p>
        </div>
      </div>
    );
  }

  console.log('🚀 [App Initialized - Route Configuration Loaded]');

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;
