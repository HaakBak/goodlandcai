import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { validatePathAccess } from '../services/privilegeService';
import { addHistoryLog, getSupabaseClient } from '../services/databaseService';

/**
 * ProtectedRoute Component
 * 
 * This component acts as middleware to check if a user has the required role to access a route.
 * If the user doesn't have access, they're redirected to an AccessDenied page.
 * 
 * SECURITY: Multi-layer protection
 * - Prevents unauthorized access based on user role
 * - Validates Supabase session exists (not just sessionStorage)
 * - Administrators can only access /admin routes
 * - Managers can only access /manager routes
 * - Employees can only access /employee routes
 * - Logs unauthorized access attempts
 * 
 * @param {Object} props
 * @param {React.Component} props.element - The component to render if access is allowed
 * @param {string} props.requiredRole - The role required to access ('Administrator', 'Manager', 'Employee')
 * @returns {React.Component} - Either the protected component or AccessDenied page
 */
const ProtectedRoute = ({ element, requiredRole }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [hasValidAccess, setHasValidAccess] = useState(false);
  const currentPath = window.location.pathname;
  const hasLoggedUnauthorizedAccess = useRef(false);

  useEffect(() => {
    const validateAccess = async () => {
      try {
        // SECURITY CHECK 1: Validate user role access using pathname
        const pathValidation = validatePathAccess(currentPath);
        
        // SECURITY CHECK 2: Verify Supabase session exists (not just sessionStorage)
        const supabase = getSupabaseClient();
        let sessionValid = false;
        
        if (supabase) {
          try {
            const { data: { session }, error } = await supabase.auth.getSession();
            sessionValid = session !== null && !error;
            
            if (!sessionValid && pathValidation.hasAccess) {
              console.warn('[ProtectedRoute] ⚠️  Path validation passed but Supabase session invalid', {
                path: currentPath,
                hasSupabaseSession: !!session,
                error,
              });
            }
          } catch (err) {
            console.warn('[ProtectedRoute] ⚠️  Could not verify Supabase session:', err);
            // In offline mode, allow if path validation passes
            sessionValid = true;
          }
        } else {
          // No Supabase client (offline mode) - trust path validation
          sessionValid = true;
        }
        
        // Access granted if both checks pass
        const finalAccess = pathValidation.hasAccess && sessionValid;
        setHasValidAccess(finalAccess);
        
        // Log unauthorized access attempts
        if (!finalAccess && !hasLoggedUnauthorizedAccess.current) {
          hasLoggedUnauthorizedAccess.current = true;
          const username = sessionStorage.getItem('username') || 'Unknown';
          const role = sessionStorage.getItem('userRole') || 'Unauthenticated';
          const now = new Date();
          const timestamp = now.toISOString();
          const date = timestamp.split('T')[0];
          const time = now.toTimeString().split(' ')[0];
          
          const reason = !pathValidation.hasAccess 
            ? `Role mismatch: ${role} cannot access ${currentPath}`
            : 'Session invalid (Supabase session missing)';

          addHistoryLog({
            type: 'Unauthorized Route Access',
            description: `Unauthorized access attempt to ${currentPath} by ${username} (${role}). Reason: ${reason}`,
            user: username,
            role,
            timestamp,
            date,
            time,
          }).catch((error) => console.warn('[ProtectedRoute] Failed to log unauthorized access', error));
        }
        
        // Log access decision
        console.log('🛡️ [Protected Route Validation]', {
          route: currentPath,
          requiredRole,
          pathValidation,
          supabaseSessionValid: sessionValid,
          finalAccess,
        });
      } catch (err) {
        console.error('[ProtectedRoute] Error during access validation:', err);
        setHasValidAccess(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateAccess();
  }, [currentPath, requiredRole]);

  // Show loading state while validating
  if (isValidating) {
    return (
      <div className="w-full flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-600 text-sm font-medium">Validating access...</p>
        </div>
      </div>
    );
  }

  // If user doesn't have access, redirect to AccessDenied
  if (!hasValidAccess) {
    console.log('❌ [Redirecting to AccessDenied]', {
      from: currentPath,
      requiredRole,
    });
    return <Navigate to="/access-denied" replace />;
  }

  // User has access - render the component
  console.log('✅ [Route Access Granted]', { route: currentPath, requiredRole });
  return element;
};

export default ProtectedRoute;
