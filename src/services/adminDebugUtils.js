/**
 * Admin Debug Utilities
 * 
 * Use these functions in the browser console to debug admin user lookup issues:
 * 
 * window.__debugAdmin.verify()        - Check if admin exists
 * window.__debugAdmin.search()        - Search for specific user
 * window.__debugAdmin.getAllUsers()   - See all users in database
 */

import { verifyAdminUserInSupabase, getAdminUserProfile, getUserProfile, getSupabaseClient } from './databaseService';

export const adminDebugUtils = {
  /**
   * Verify admin exists in Supabase
   */
  verify: async () => {
    console.clear();
    console.log('%c🔍 Admin Verification Starting...', 'color: blue; font-size: 14px; font-weight: bold;');
    
    const result = await verifyAdminUserInSupabase();
    
    if (result.exists) {
      console.log('%c✅ Admin user FOUND in Supabase!', 'color: green; font-size: 14px; font-weight: bold;');
      console.table(result.user);
    } else {
      console.log('%c❌ Admin user NOT found in Supabase', 'color: red; font-size: 14px; font-weight: bold;');
      console.log('Error:', result.error);
    }
    
    if (result.allUsers && result.allUsers.length > 0) {
      console.log(`\n%c📋 All users in database (${result.allUsers.length}):`, 'color: blue; font-weight: bold;');
      console.table(result.allUsers);
    }
    
    return result;
  },

  /**
   * Search for a user by username or email
   */
  search: async (identifier) => {
    console.clear();
    console.log(`%c🔎 Searching for user: "${identifier}"`, 'color: blue; font-size: 14px; font-weight: bold;');
    
    const user = await getUserProfile(identifier);
    
    if (user) {
      console.log('%c✅ User FOUND!', 'color: green; font-size: 14px; font-weight: bold;');
      console.table(user);
    } else {
      console.log('%c❌ User NOT found', 'color: red; font-size: 14px; font-weight: bold;');
    }
    
    return user;
  },

  /**
   * Get all users from database
   */
  getAllUsers: async () => {
    console.clear();
    console.log('%c📋 Fetching all users from database...', 'color: blue; font-size: 14px; font-weight: bold;');
    
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not available');
        return [];
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('%c⚠️  No users found in database', 'color: orange; font-weight: bold;');
        return [];
      }

      console.log(`%c✅ Found ${data.length} users:`, 'color: green; font-weight: bold;');
      console.table(data);
      return data;
    } catch (err) {
      console.error('Error:', err);
      return [];
    }
  },

  /**
   * Test admin login lookup
   */
  testAdminLogin: async (username) => {
    console.clear();
    console.log(`%c🔐 Testing admin login for: "${username}"`, 'color: blue; font-size: 14px; font-weight: bold;');
    
    const adminUser = await getAdminUserProfile(username);
    
    if (adminUser) {
      console.log('%c✅ Admin lookup SUCCESSFUL!', 'color: green; font-size: 14px; font-weight: bold;');
      console.table(adminUser);
    } else {
      console.log('%c❌ Admin lookup FAILED', 'color: red; font-size: 14px; font-weight: bold;');
    }
    
    return adminUser;
  },

  /**
   * Show quick summary
   */
  summary: async () => {
    console.clear();
    console.log('%c═══ ADMIN DEBUG SUMMARY ═══', 'color: purple; font-size: 16px; font-weight: bold;');
    
    const adminCheck = await adminDebugUtils.verify();
    
    console.log('\n%c📝 Quick Commands:', 'color: blue; font-weight: bold;');
    console.log('  window.__debugAdmin.verify()        - Verify admin exists');
    console.log('  window.__debugAdmin.search("name")  - Search for user');
    console.log('  window.__debugAdmin.getAllUsers()   - See all users');
    console.log('  window.__debugAdmin.testAdminLogin("lukas") - Test admin login');
    
    return adminCheck;
  }
};

// Expose to window for easy console access (DEVELOPMENT ONLY)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__debugAdmin = adminDebugUtils;
  console.log('%c[DEBUG] Admin utilities available at window.__debugAdmin', 'color: green; font-style: italic;');
}

export default adminDebugUtils;
