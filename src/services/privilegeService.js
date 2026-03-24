/**
 * Privilege/Access Control Service
 * Manages role-based access control (RBAC) for different sections of the application
 * 
 * Role Hierarchy:
 * - Administrator: Can access /admin routes only
 * - Manager: Can access /manager routes only
 * - Employee: Can access /employee routes only
 * 
 * This service prevents unauthorized access to protected routes
 */

/**
 * Get the current user's role from sessionStorage
 * @returns {string|null} - The role ('Administrator', 'Manager', 'Employee') or null if not logged in
 */
export const getUserRole = () => {
  // SECURITY CHECK: Retrieve user role from unified sessionStorage keys
  const userRole = sessionStorage.getItem('userRole');

  console.log('🔐 [Access Check - Current User]', {
    userRole
  });

  // Return the unified role if it exists - this is the source of truth
  if (userRole) {
    return userRole;
  }
  
  return null;
};

/**
 * Check if user has privilege to access a specific route/section
 * @param {string} requiredRole - The role required to access ('Administrator', 'Manager', 'Employee')
 * @returns {boolean} - True if user has access, false otherwise
 */
export const hasAccessPrivilege = (requiredRole) => {
  const userRole = getUserRole();

  console.log('🔍 [Permission Check]', {
    userRole,
    requiredRole,
    hasAccess: userRole === requiredRole,
  });

  // Access rules: User must match the required role exactly
  if (!userRole) {
    console.log('🚫 [Access Denied]', { reason: 'No user logged in' });
    return false;
  }

  // Check if user's role matches required role
  const hasAccess = userRole === requiredRole;

  if (!hasAccess) {
    console.log('🚫 [Access Denied]', {
      userRole,
      requiredRole,
      reason: `${userRole} role cannot access ${requiredRole} section`,
    });
  } else {
    console.log('✅ [Access Granted]', { userRole, resource: requiredRole });
  }

  return hasAccess;
};

/**
 * Get access rules for a specific role
 * @param {string} role - The user's role
 * @returns {Object} - Object with allowed routes for that role
 */
export const getRoleAccessRules = (role) => {
  // SECURITY: Define what each role can access
  const accessRules = {
    Administrator: {
      canAccess: ['/admin'],
      cannotAccess: ['/manager', '/employee'],
      label: ['Administrator', 'admin'] ,
      description: 'Can access Administrator section only',
    },
    Manager: {
      canAccess: ['/manager'],
      cannotAccess: ['/admin', '/employee'],
      label: ['Manager', 'manager'] , 
      description: 'Can access Manager section only',
    },
    Employee: {
      canAccess: ['/employee'],
      cannotAccess: ['/admin', '/manager'],
      label: 'Employee',
      description: 'Can access Employee section only',
    },
  };

  console.log('📋 [Access Rules for Role]', { role, rules: accessRules[role] });
  return accessRules[role] || null;
};

/**
 * Check if a route path requires authentication and role
 * @param {string} pathname - The route path
 * @returns {string|null} - The required role ('Administrator', 'Manager', 'Employee') or null if public
 */
export const getRequiredRoleForPath = (pathname) => {
  // SECURITY: Define which routes require which roles
  const protectedRoutes = {
    '/admin': ['Administrator', 'admin'],
    '/admin/history':['Administrator', 'admin'],
    '/manager': ['Manager', 'manager'],
    '/manager/dashboard': ['Manager', 'manager'],
    '/manager/inventory': ['Manager', 'manager'],
    '/manager/posm': ['Manager', 'manager'],
    '/employee': 'Employee',
    '/employee/pos': 'Employee',
    '/employee/orders': 'Employee',
  };

  const requiredRole = protectedRoutes[pathname] || null;

  console.log('🛡️ [Route Protection Check]', {
    pathname,
    requiredRole: requiredRole || 'Public (no auth needed)',
  });

  return requiredRole;
};

/**
 * Validate if a user can access a specific pathname
 * @param {string} pathname - The route path user is trying to access
 * @returns {Object} - { hasAccess: boolean, userRole: string, requiredRole: string, message: string }
 */
export const validatePathAccess = (pathname) => {
  const userRole = getUserRole();
  const requiredRole = getRequiredRoleForPath(pathname);

  // If no role is required, path is public
  if (!requiredRole) {
    console.log('🟢 [Public Route Access Allowed]', { pathname });
    return {
      hasAccess: true,
      userRole,
      requiredRole,
      message: 'Public route - no authentication required',
    };
  }

  // If no user is logged in
  if (!userRole) {
    console.log('🔴 [Access Denied - Not Logged In]', { pathname });
    return {
      hasAccess: false,
      userRole: null,
      requiredRole,
      message: 'Please log in to access this page',
    };
  }

  // Check if user's role matches required role
  const hasAccess = Array.isArray(requiredRole) ? requiredRole.includes(userRole) : userRole === requiredRole;

  console.log(
    hasAccess ? '🟢 [Access Granted]' : '🔴 [Access Denied - Insufficient Privileges]',
    {
      pathname,
      userRole,
      requiredRole,
    }
  );

  return {
    hasAccess,
    userRole,
    requiredRole,
    message: hasAccess
      ? `${userRole} has access to this page`
      : `${userRole} cannot access ${requiredRole} section. Access denied.`,
  };
};

/**
 * Logout user and clear all role/auth data
 */
export const clearUserSession = () => {
  console.log('🔓 [Session Cleared - User Logout]');
  // Clear all old format keys for backward compatibility
  sessionStorage.removeItem('adminUsername');
  sessionStorage.removeItem('managerUsername');
  sessionStorage.removeItem('managerRole');
  sessionStorage.removeItem('employeeUsername');
  // Clear new unified keys
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('username');
};
