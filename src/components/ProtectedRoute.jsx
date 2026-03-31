import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { validatePathAccess } from '../services/privilegeService';
import { addHistoryLog } from '../services/databaseService';

/**
 * ProtectedRoute Component
 * 
 * This component acts as middleware to check if a user has the required role to access a route.
 * If the user doesn't have access, they're redirected to an AccessDenied page.
 * 
 * SECURITY: Prevents unauthorized access based on user role
 * - Administrators can only access /admin routes
 * - Managers can only access /manager routes
 * - Employees can only access /employee routes
 * 
 * @param {Object} props
 * @param {React.Component} props.element - The component to render if access is allowed
 * @param {string} props.requiredRole - The role required to access ('Administrator', 'Manager', 'Employee')
 * @returns {React.Component} - Either the protected component or AccessDenied page
 */
const ProtectedRoute = ({ element, requiredRole }) => {
  // SECURITY CHECK: Validate user access using location pathname
  const currentPath = window.location.pathname;
  
  const accessValidation = validatePathAccess(currentPath);
  const hasLoggedUnauthorizedAccess = useRef(false);

  useEffect(() => {
    if (accessValidation.hasAccess || hasLoggedUnauthorizedAccess.current) return;

    hasLoggedUnauthorizedAccess.current = true;
    const username = sessionStorage.getItem('username') || 'Unknown';
    const role = sessionStorage.getItem('userRole') || 'Unauthenticated';
    const now = new Date();
    const timestamp = now.toISOString();
    const date = timestamp.split('T')[0];
    const time = now.toTimeString().split(' ')[0];

    addHistoryLog({
      type: 'Unauthorized Route Access',
      description: `Unauthorized access attempt to ${currentPath} by ${username} (${role})`,
      user: username,
      role,
      timestamp,
      date,
      time,
    }).catch((error) => console.warn('[ProtectedRoute] Failed to log unauthorized access', error));
  }, [accessValidation.hasAccess, currentPath]);

  // Log access decision
  console.log('🛡️ [Protected Route Validation]', {
    route: currentPath,
    requiredRole,
    validation: accessValidation,
  });

  // If user doesn't have access, redirect to AccessDenied
  if (!accessValidation.hasAccess) {
    console.log('❌ [Redirecting to AccessDenied]', {
      from: currentPath,
      userRole: accessValidation.userRole,
      required: accessValidation.requiredRole,
    });
    return <Navigate to="/access-denied" replace />;
  }

  // User has access - render the component
  console.log('✅ [Route Access Granted]', { route: currentPath, userRole: accessValidation.userRole });
  return element;
};

export default ProtectedRoute;
