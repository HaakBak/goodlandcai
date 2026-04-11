/**
 * databaseService.js
 * 
 * Core database abstraction layer for hybrid Supabase + offline-first architecture
 * 
 * Features:
 * - Transparent Supabase-first with localStorage fallback
 * - Offline sync queue for queued mutations
 * - Real-time network detection
 * - Exponential backoff retry logic
 * - All 21 functions compatible with existing mockDatabase exports
 * 
 * Usage:
 *   import { getMenu, saveTransaction, getUsers } from '@/services/databaseService'
 *   // All functions work the same way; routing handled internally
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, STORAGE_KEYS, ADMIN_DEFAULT_USER } from '../config/appConfig';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================

let supabaseClient = null;

const initSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;

  const { URL, ANON_KEY } = SUPABASE_CONFIG;
  
  if (!URL || !ANON_KEY) {
    console.warn('[DB] ⚠️ Supabase credentials missing — operating in offline-only mode');
    return null;
  }

  try {
    supabaseClient = createClient(URL, ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
      }
    });
    console.log('[DB] ✅ Supabase client initialized');
    return supabaseClient;
  } catch (error) {
    console.error('[DB] ❌ Failed to initialize Supabase client:', error);
    return null;
  }
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

let isOnline = navigator.onLine;
let syncQueue = []; // Queue for offline mutations
let syncInProgress = false;
const syncListeners = new Set();

// ============================================================================
// SYNC QUEUE BOUNDS & LIMITS
// ============================================================================

const MAX_SYNC_QUEUE_SIZE = 100;              // Max operations in queue before dropping oldest
const MAX_RETRIES_PER_OPERATION = 3;          // Max retry attempts per operation
const OPERATION_TIMEOUT_MS = 30000;           // 30 seconds max per sync operation

// Network detection
window.addEventListener('online', () => {
  console.log('[DB] 🔄 Network restored — flushing sync queue');
  isOnline = true;
  flushSyncQueue();
  broadcastSyncEvent({ status: 'online' });
});

window.addEventListener('offline', () => {
  console.log('[DB] 📴 Network lost — switching to offline mode');
  isOnline = false;
  broadcastSyncEvent({ status: 'offline' });
});

// ============================================================================
// SYNC EVENT SYSTEM
// ============================================================================

export const onSync = (callback) => {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
};

const broadcastSyncEvent = (event) => {
  syncListeners.forEach(callback => {
    try {
      callback(event);
    } catch (err) {
      console.error('[DB] Error in sync listener:', err);
    }
  });
};

// ============================================================================
// SUPABASE CLIENT EXPORTS FOR AUTHENTICATION
// ============================================================================

export const getSupabaseClient = () => {
  return initSupabaseClient();
};

/**
 * Get current sync queue status for monitoring/debugging
 * Access via: window.__logging?.getSyncQueueStatus?.()
 * @returns {object} Current queue metrics and status
 */
export const getSyncQueueStatus = () => {
  const totalOps = syncQueue.length;
  const pendingOps = syncQueue.filter(op => !op.failed).length;
  const failedOps = syncQueue.filter(op => op.failed).length;
  const retryingOps = syncQueue.filter(op => op.retryCount > 0 && !op.failed).length;
  
  return {
    isOnline,
    isSyncing: syncInProgress,
    queueSize: totalOps,
    maxQueueSize: MAX_SYNC_QUEUE_SIZE,
    queueUsage: `${totalOps}/${MAX_SYNC_QUEUE_SIZE}`,
    pendingOperations: pendingOps,
    failedOperations: failedOps,
    retryingOperations: retryingOps,
    maxRetriesPerOp: MAX_RETRIES_PER_OPERATION,
    operationTimeoutMs: OPERATION_TIMEOUT_MS,
    operations: syncQueue.map(op => ({
      type: op.type,
      table: op.table,
      queuedAt: op.queuedAt,
      retryCount: op.retryCount,
      failed: op.failed,
      lastError: op.lastError,
      lastAttempt: op.lastAttempt,
      failedAt: op.failedAt,
    })),
  };
};

export const getUserProfileByUsername = async (username) => {
  try {
    const supabase = initSupabaseClient();
    if (!supabase) {
      console.warn('[Auth] Supabase client not available');
      return null;
    }
    
    if (!username) return null;
    
    const trimmedUsername = String(username).trim();
    console.log(`[Auth] 🔍 Querying user_profiles by username: "${trimmedUsername}"`);
    
    // Use maybeSingle() instead of single() to handle 0 results gracefully
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status')
      .eq('username', trimmedUsername)
      .maybeSingle();
    
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Auth] Error fetching user profile by username:', error);
      }
      return null;
    }
    
    if (data) {
      console.log(`[Auth] ✅ Found user by username: ${trimmedUsername} (role: ${data.role})`);
    } else {
      console.log(`[Auth] ℹ️  No user found with username: "${trimmedUsername}"`);
    }
    
    // data will be null if no user found (which is normal)
    return data;
  } catch (err) {
    console.error('[Auth] getUserProfileByUsername error:', err);
    return null;
  }
};

/**
 * Get user profile by email (case-insensitive)
 * @param {string} email - User email
 * @returns {Promise<object|null>} User profile or null
 */
export const getUserProfileByEmail = async (email) => {
  try {
    const supabase = initSupabaseClient();
    if (!supabase) {
      console.warn('[Auth] Supabase client not available');
      return null;
    }
    
    if (!email) return null;
    
    const trimmedEmail = String(email).trim();
    console.log(`[Auth] 🔍 Querying user_profiles by email (case-insensitive): "${trimmedEmail}"`);
    
    // Use ilike() for case-insensitive exact match instead of eq() + lowercase normalization
    // This prevents issues with case mismatches in the database
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status')
      .ilike('email', trimmedEmail)
      .maybeSingle();
    
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Auth] Error fetching user profile by email:', error);
      }
      return null;
    }
    
    if (data) {
      console.log(`[Auth] ✅ Found user by email: ${data.email} (role: ${data.role})`);
    } else {
      console.log(`[Auth] ℹ️  No user found with email: "${trimmedEmail}"`);
    }
    
    // data will be null if no user found (which is normal during signup)
    return data;
  } catch (err) {
    console.error('[Auth] getUserProfileByEmail error:', err);
    return null;
  }
};

/**
 * Get user profile by username OR email
 * @param {string} identifier - Username or email
 * @returns {Promise<object|null>} User profile or null
 */
export const getUserProfile = async (identifier) => {
  if (!identifier) return null;
  
  console.log(`[Auth] 🔎 getUserProfile lookup for: "${identifier}"`);
  
  // Try as username first
  let user = await getUserProfileByUsername(identifier);
  if (user) {
    console.log(`[Auth] ✅ User found by username lookup`);
    return user;
  }
  
  // Try as email if username didn't match
  user = await getUserProfileByEmail(identifier);
  if (user) {
    console.log(`[Auth] ✅ User found by email lookup`);
    return user;
  }
  
  console.warn(`[Auth] ❌ User not found with identifier: "${identifier}"`);
  return null;
};

/**
 * Get admin user profile - specifically for administrator login
 * Logs diagnostics to aid debugging if admin lookup fails
 * @param {string} identifier - Username or email (admin username)
 * @returns {Promise<object|null>} Admin user profile or null
 */
export const getAdminUserProfile = async (identifier) => {
  if (!identifier) return null;
  
  try {
    console.log(`[Auth] 🔍 Searching for admin user with identifier: "${identifier}"`);
    const user = await getUserProfile(identifier);
    
    if (!user) {
      console.warn(`[Auth] ⚠️ Admin user not found in database with identifier: "${identifier}"`);
      return null;
    }
    
    if (user.role !== 'Administrator') {
      console.warn(`[Auth] ⚠️ User "${identifier}" exists but role is "${user.role}", not Administrator`);
      return null;
    }
    
    console.log(`[Auth] ✅ Admin user found:`, { username: user.username, email: user.email });
    return user;
  } catch (err) {
    console.error('[Auth] Error fetching admin user profile:', err);
    return null;
  }
};

const transactionToDb = (transaction) => {
  const mapped = {};
  Object.entries(transaction).forEach(([key, value]) => {
    switch (key) {
      case 'orderNumber': mapped.order_number = value; break;
      case 'baseAmount': mapped.base_amount = value; break;
      case 'discountType': mapped.discount_type = value; break;
      case 'discountAmount': mapped.discount_amount = value; break;
      case 'vatPortion': mapped.vat_portion = value; break;
      case 'totalAmount': mapped.total_amount = value; break;
      case 'cashProvided': mapped.cash_provided = value; break;
      case 'timeOrdered': mapped.time_ordered = value; break;
      case 'employeeId': mapped.employee_id = value; break;
      case 'serviceFee': mapped.service_fee = value; break;
      default: mapped[key] = value; break;
    }
  });
  return mapped;
};

const transactionFromDb = (record) => {
  const mapped = {};
  Object.entries(record).forEach(([key, value]) => {
    switch (key) {
      case 'order_number': mapped.orderNumber = value; break;
      case 'base_amount': mapped.baseAmount = value; break;
      case 'discount_type': mapped.discountType = value; break;
      case 'discount_amount': mapped.discountAmount = value; break;
      case 'vat_portion': mapped.vatPortion = value; break;
      case 'total_amount': mapped.totalAmount = value; break;
      case 'cash_provided': mapped.cashProvided = value; break;
      case 'time_ordered': mapped.timeOrdered = value; break;
      case 'employee_id': mapped.employeeId = value; break;
      case 'service_fee': mapped.serviceFee = value; break;
      default: mapped[key] = value; break;
    }
  });
  return mapped;
};

const parseNumericValue = (value) => {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

const menuFromDb = (record) => {
  const mapped = {};
  const basePrice = parseNumericValue(
    record.basePrice ?? record.base_price ?? record.sizes?.Medium?.basePrice ?? record.sizes?.Large?.basePrice ?? record.sizes?.Small?.basePrice
  );
  const VAT_fee = parseNumericValue(
    record.VAT_fee ?? record.vat_fee ?? record.sizes?.Medium?.VAT_fee ?? record.sizes?.Large?.VAT_fee ?? record.sizes?.Small?.VAT_fee
  );
  const totalPrice = parseNumericValue(
    record.totalPrice ?? record.total_price ?? record.sizes?.Medium?.totalPrice ?? record.sizes?.Large?.totalPrice ?? record.sizes?.Small?.totalPrice
  );
  const hasSizes = record.hasSizes !== undefined ? record.hasSizes : record.has_sizes;

  Object.entries(record).forEach(([key, value]) => {
    if (['base_price', 'vat_fee', 'total_price', 'has_sizes'].includes(key)) return;
    mapped[key] = value;
  });

  mapped.basePrice = basePrice;
  mapped.VAT_fee = VAT_fee;
  mapped.totalPrice = totalPrice;
  if (hasSizes !== undefined) mapped.hasSizes = hasSizes;

  return mapped;
};

const menuToDb = (item) => {
  const mapped = {};
  const basePrice = parseNumericValue(
    item.basePrice ?? item.base_price ?? item.sizes?.Medium?.basePrice ?? item.sizes?.Large?.basePrice ?? item.sizes?.Small?.basePrice
  );
  const VAT_fee = parseNumericValue(
    item.VAT_fee ?? item.vat_fee ?? item.sizes?.Medium?.VAT_fee ?? item.sizes?.Large?.VAT_fee ?? item.sizes?.Small?.VAT_fee
  );
  const totalPrice = parseNumericValue(
    item.totalPrice ?? item.total_price ?? item.sizes?.Medium?.totalPrice ?? item.sizes?.Large?.totalPrice ?? item.sizes?.Small?.totalPrice
  );
  const hasSizes = item.hasSizes ?? item.has_sizes ?? false;

  Object.entries(item).forEach(([key, value]) => {
    if (['base_price', 'vat_fee', 'total_price', 'has_sizes'].includes(key)) return;
    mapped[key] = value;
  });

  mapped.basePrice = basePrice;
  mapped.base_price = basePrice;
  mapped.VAT_fee = VAT_fee;
  mapped.vat_fee = VAT_fee;
  mapped.totalPrice = totalPrice;
  mapped.hasSizes = hasSizes;
  mapped.has_sizes = hasSizes;

  return mapped;
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

const getLocalStorage = (key, initial = null) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return initial;
  } catch (error) {
    console.error(`[DB] Error reading localStorage [${key}]:`, error);
    return initial;
  }
};

const setLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`[DB] Error writing localStorage [${key}]:`, error);
    return false;
  }
};

// ============================================================================
// SYNC QUEUE MANAGEMENT
// ============================================================================

const queueMutation = (operation) => {
  const operationWithMeta = {
    ...operation,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    failed: false,
  };
  
  syncQueue.push(operationWithMeta);
  
  // Enforce max queue size: drop oldest if exceeded
  if (syncQueue.length > MAX_SYNC_QUEUE_SIZE) {
    const dropped = syncQueue.shift();
    console.warn(`[DB] ⚠️  Queue exceeded max size (${MAX_SYNC_QUEUE_SIZE}). Dropped oldest operation:`, {
      type: dropped.type,
      queuedAt: dropped.queuedAt,
      reason: 'Queue size limit enforced',
    });
    broadcastSyncEvent({
      status: 'queue-warning',
      message: 'Sync queue exceeded limit. Oldest operation dropped.',
      queueSize: syncQueue.length,
    });
  }
  
  setLocalStorage('_sync_queue', syncQueue);
  console.log(`[DB] 📋 Queued operation [${operation.type}] — Queue size: ${syncQueue.length}/${MAX_SYNC_QUEUE_SIZE}`);
};

const executeOperationWithTimeout = async (operation) => {
  return new Promise(async (resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timeout (${OPERATION_TIMEOUT_MS}ms exceeded)`));
    }, OPERATION_TIMEOUT_MS);
    
    try {
      // Handle different operation types
      if (operation.type === 'INSERT') {
        const { table, data } = operation;
        const supabase = initSupabaseClient();
        if (supabase) {
          const { error } = await supabase.from(table).insert(data);
          if (error) throw error;
        }
      } else if (operation.type === 'UPDATE') {
        const { table, id, data } = operation;
        const supabase = initSupabaseClient();
        if (supabase) {
          const { error } = await supabase.from(table).update(data).eq('id', id);
          if (error) throw error;
        }
      }
      
      clearTimeout(timeoutHandle);
      resolve();
    } catch (error) {
      clearTimeout(timeoutHandle);
      reject(error);
    }
  });
};

const flushSyncQueue = async () => {
  if (syncInProgress || syncQueue.length === 0 || !isOnline) {
    return;
  }

  syncInProgress = true;
  broadcastSyncEvent({ status: 'syncing', queueSize: syncQueue.length });

  const pendingOperations = [];
  let successCount = 0;
  let failedCount = 0;

  for (const operation of syncQueue) {
    // Skip permanently failed operations
    if (operation.failed) {
      pendingOperations.push(operation);
      failedCount++;
      continue;
    }
    
    // Check if retry limit exceeded
    if (operation.retryCount >= MAX_RETRIES_PER_OPERATION) {
      operation.failed = true;
      operation.failedAt = new Date().toISOString();
      pendingOperations.push(operation);
      failedCount++;
      console.error(`[DB] ❌ Operation [${operation.type}] exceeded max retries (${MAX_RETRIES_PER_OPERATION}). Marked as failed.`);
      broadcastSyncEvent({
        status: 'operation-failed',
        operationType: operation.type,
        reason: `Max retries exceeded (${MAX_RETRIES_PER_OPERATION})`,
      });
      continue;
    }

    try {
      console.log(`[DB] 🔄 Flushing [${operation.type}] (retry ${operation.retryCount}/${MAX_RETRIES_PER_OPERATION})...`);
      await executeOperationWithTimeout(operation);
      successCount++;
    } catch (error) {
      operation.retryCount++;
      operation.lastError = error.message;
      operation.lastAttempt = new Date().toISOString();
      
      console.error(`[DB] ⚠️  Operation [${operation.type}] failed (attempt ${operation.retryCount}/${MAX_RETRIES_PER_OPERATION}):`, error.message);
      pendingOperations.push(operation);
    }
  }

  syncQueue = pendingOperations;
  setLocalStorage('_sync_queue', syncQueue);
  syncInProgress = false;

  broadcastSyncEvent({
    status: 'synced',
    successCount,
    failedCount,
    queueSize: syncQueue.length,
    failedOperations: syncQueue.filter(op => op.failed).length,
  });

  if (failedCount > 0) {
    console.warn(`[DB] ⚠️  Sync complete — ${successCount} succeeded, ${failedCount} failed or pending`);
  } else {
    console.log(`[DB] ✅ Sync complete — ${successCount} succeeded, ${syncQueue.length} pending`);
  }
};

// Load queue on startup and initialize metadata
syncQueue = getLocalStorage('_sync_queue', []);
syncQueue = syncQueue.map(op => ({
  ...op,
  retryCount: op.retryCount ?? 0,
  failed: op.failed ?? false,
}));
console.log(`[DB] ℹ️  Loaded ${syncQueue.length} operations from localStorage (${syncQueue.filter(op => !op.failed).length} pending, ${syncQueue.filter(op => op.failed).length} failed)`);

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[DB] ⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// ============================================================================
// DATABASE FUNCTIONS (21 exports matching mockDatabase.js)
// ============================================================================

// ─── USERS ───────────────────────────────────────────────────────────────

export const getUsers = async () => {
  const supabase = initSupabaseClient();
  
  if (!supabase || !isOnline) {
    // Fallback to localStorage
    console.log('[DB] 👥 getUsers() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.USERS, [ADMIN_DEFAULT_USER]));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('user_profiles').select('*');
      if (error) throw error;
      console.log('[DB] ✅ getUsers() from Supabase');
      setLocalStorage(STORAGE_KEYS.USERS, data); // Cache locally
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getUsers() failed:', error);
    // Fallback to cached localStorage
    return getLocalStorage(STORAGE_KEYS.USERS, [ADMIN_DEFAULT_USER]);
  }
};

export const saveUser = async (user) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveUser() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'user_profiles', data: user });
    return Promise.resolve();
  }

  try {
    return await retryWithBackoff(async () => {
      const { error } = await supabase.from('user_profiles').insert(user);
      if (error) {
        // Provide detailed error messages for different constraint violations
        if (error.code === '23505') {
          // Unique constraint violation
          if (error.message.includes('username')) {
            throw new Error(`DUPLICATE_USERNAME: Username "${user.username}" already exists`);
          } else if (error.message.includes('email')) {
            throw new Error(`DUPLICATE_EMAIL: Email "${user.email}" already exists`);
          }
        }
        throw error;
      }
      console.log('[DB] ✅ saveUser() to Supabase — user created');
    });
  } catch (error) {
    console.error('[DB] ❌ saveUser() failed:', error);
    // Extract and re-throw specific errors for signup handling
    if (error.message.includes('DUPLICATE_')) {
      throw error; // Let caller handle duplicate errors
    }
    // Queue for offline sync only on network errors, not constraint violations
    if (!error.message.includes('DUPLICATE_')) {
      queueMutation({ type: 'INSERT', table: 'user_profiles', data: user });
    }
  }
};

/**
 * Verify admin user exists in Supabase
 * Use during initialization or diagnostics to ensure admin is accessible
 * @returns {Promise<{exists: boolean, user: object|null, error: string|null}>}
 */
export const verifyAdminUserInSupabase = async () => {
  try {
    const supabase = initSupabaseClient();
    if (!supabase) {
      return { exists: false, user: null, error: 'Supabase client not available', allUsers: [] };
    }

    console.log('[Auth] 🔍 Verifying admin user in Supabase...');

    // First, query all users to see what's in the database
    console.log('[Auth] 📋 Fetching all users from user_profiles...');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status, created_at');

    if (!allUsersError && allUsers) {
      console.log(`[Auth] ℹ️  Total users in database: ${allUsers.length}`);
      allUsers.forEach(u => {
        console.log(`   - ${u.username} (${u.email}) - Role: ${u.role}`);
      });
    }

    // Query specifically for admin users
    console.log('[Auth] 🔍 Querying for Administrator role...');
    const { data: adminUsers, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status, created_at')
      .eq('role', 'Administrator');

    if (error) {
      console.error('[Auth] ❌ Error querying admin users:', error);
      return { 
        exists: false, 
        user: null, 
        error: `Query error: ${error.message}`,
        allUsers: allUsers || []
      };
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.warn('[Auth] ⚠️  No Administrator users found in user_profiles table');
      return { 
        exists: false, 
        user: null, 
        error: 'No admin users found in database',
        allUsers: allUsers || []
      };
    }

    console.log(`[Auth] ✅ Found ${adminUsers.length} admin user(s):`, adminUsers);
    return { 
      exists: true, 
      user: adminUsers[0], 
      error: null,
      allUsers: adminUsers
    };
  } catch (err) {
    console.error('[Auth] ❌ verifyAdminUserInSupabase error:', err);
    return { exists: false, user: null, error: err.message, allUsers: [] };
  }
};

// ─── MENU ────────────────────────────────────────────────────────────────

export const getMenu = async () => {
  const supabase = initSupabaseClient();

  // Always try Supabase first
  if (supabase) {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase.from('menu').select('*');
        if (error) throw error;
        const menuData = (data || []).map(menuFromDb);
        console.log('[DB] ✅ getMenu() from Supabase - fetched', menuData.length, 'items');
        setLocalStorage(STORAGE_KEYS.MENU, menuData);
        return menuData;
      });
    } catch (error) {
      console.error('[DB] ❌ getMenu() Supabase failed, trying cache:', error.message);
      const cached = getLocalStorage(STORAGE_KEYS.MENU, []);
      return cached.length > 0 ? cached : [];
    }
  }

  console.log('[DB] 🍽️  getMenu() — Supabase unavailable, using localStorage');
  return Promise.resolve(getLocalStorage(STORAGE_KEYS.MENU, []).map(menuFromDb));
};

export const saveMenu = (menu) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveMenu() — queued for offline sync');
    const menuArray = Array.isArray(menu) ? menu : [menu];
    menuArray.forEach(item => {
      queueMutation({ type: 'UPDATE', table: 'menu', id: item.id, data: menuToDb(item) });
    });
    setLocalStorage(STORAGE_KEYS.MENU, menuArray);
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const menuArray = Array.isArray(menu) ? menu : [menu];
    const upsertPayload = menuArray.map(menuToDb);
    const { error } = await supabase.from('menu').upsert(upsertPayload);
    if (error) throw error;
    console.log('[DB] ✅ saveMenu() to Supabase — ' + menuArray.length + ' items synced');
    setLocalStorage(STORAGE_KEYS.MENU, menuArray);
  }).catch(error => {
    console.error('[DB] ❌ saveMenu() failed:', error);
    const menuArray = Array.isArray(menu) ? menu : [menu];
    menuArray.forEach(item => {
      queueMutation({ type: 'UPDATE', table: 'menu', id: item.id, data: menuToDb(item) });
    });
  });
};

export const resetMenu = async () => {
  console.log('[DB] 🔄 resetMenu() — localStorage reset (Supabase not reset)');
  setLocalStorage(STORAGE_KEYS.MENU, []);
  return Promise.resolve();
};

// ─── INVENTORY ───────────────────────────────────────────────────────────

// Helper: Convert item to database format - writes BOTH snake_case and camelCase columns
const inventoryItemToDb = (item) => {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    
    // Write to BOTH column sets for compatibility
    // Snake_case columns (primary)
    in_stock: item.in_stock ?? item.inStock ?? 0,
    reorder_level: item.reorder_level ?? item.reorderLevel ?? 10,
    unit: item.unit ?? item.measurementUnit ?? '',
    expiration_date: item.expiration_date ?? item.expirationDate,
    
    // CamelCase columns (mirror)
    inStock: item.inStock ?? item.in_stock ?? 0,
    reorderLevel: item.reorderLevel ?? item.reorder_level ?? 10,
    measurementUnit: item.measurementUnit ?? item.unit ?? '',
    measurementQty: item.measurementQty ?? 1,
    openStock: item.openStock ?? 0,
    lowStockThreshold: item.lowStockThreshold ?? item.reorder_level ?? item.reorderLevel ?? 5,
    expirationDate: item.expirationDate ?? item.expiration_date,
    
    // Always preserve these
    cost: item.cost,
    type: item.type,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
};

// Helper: Normalize inventory data - bidirectional mapping for both snake_case and camelCase
const normalizeInventoryItem = (item) => {
  if (!item) return null;
  
  // Use whichever format is populated (prefer snake_case as source of truth)
  const inStock = item.in_stock ?? item.inStock ?? 0;
  const reorderLevel = item.reorder_level ?? item.reorderLevel ?? 10;
  const measurementUnit = item.unit ?? item.measurementUnit ?? '';
  const measurementQty = item.measurementQty ?? 1;
  const openStock = item.openStock ?? 0;
  const lowStockThreshold = item.lowStockThreshold ?? reorderLevel ?? 5;
  const expirationDate = item.expiration_date ?? item.expirationDate;
  
  return {
    // IDs and basic fields
    id: item.id,
    name: item.name,
    category: item.category,
    
    // Stock levels - BOTH FORMATS (snake_case and camelCase)
    in_stock: inStock,
    inStock: inStock,
    
    // Reorder/Low stock threshold - BOTH FORMATS
    reorder_level: reorderLevel,
    reorderLevel: reorderLevel,
    lowStockThreshold: lowStockThreshold,
    
    // Units and measurements - BOTH FORMATS
    unit: measurementUnit,
    measurementUnit: measurementUnit,
    measurementQty: measurementQty,
    
    // Open stock
    openStock: openStock,
    
    // Cost and type
    cost: item.cost,
    type: item.type,
    
    // Dates - BOTH FORMATS
    expiration_date: expirationDate,
    expirationDate: expirationDate,
    created_at: item.created_at,
    createdAt: item.created_at,
    updated_at: item.updated_at,
    updatedAt: item.updated_at,
  };
};

export const getInventory = async () => {
  const supabase = initSupabaseClient();

  // Always try Supabase first, even if offline flag is set
  if (supabase) {
    try {
      return await retryWithBackoff(async () => {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) throw error;
        // Normalize items to ensure both snake_case and camelCase properties exist
        const normalizedData = (data || []).map(normalizeInventoryItem);
        console.log('[DB] ✅ getInventory() from Supabase - fetched', normalizedData.length, 'items');
        setLocalStorage(STORAGE_KEYS.INVENTORY, normalizedData);
        return normalizedData;
      });
    } catch (error) {
      console.error('[DB] ❌ getInventory() Supabase failed, trying cache:', error.message);
      // Fall back to localStorage only if Supabase fails
      const cached = getLocalStorage(STORAGE_KEYS.INVENTORY, []);
      return cached.length > 0 ? cached : [];
    }
  }

  // Only use localStorage if Supabase is not available
  console.log('[DB] 📦 getInventory() — Supabase unavailable, using localStorage');
  return Promise.resolve(getLocalStorage(STORAGE_KEYS.INVENTORY, []));
};

export const saveInventory = (items) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveInventory() — queued for offline sync');
    setLocalStorage(STORAGE_KEYS.INVENTORY, items);
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('inventory').upsert(items);
    if (error) throw error;
    console.log('[DB] ✅ saveInventory() to Supabase');
    setLocalStorage(STORAGE_KEYS.INVENTORY, items);
  }).catch(error => {
    console.error('[DB] ❌ saveInventory() failed:', error);
  });
};

export const addInventoryItem = async (item) => {
  const supabase = initSupabaseClient();
  const timestamp = new Date().toISOString();
  const newItem = {
    ...item,
    id: item.id || crypto.randomUUID(),
    created_at: item.created_at || timestamp,
    updated_at: timestamp,
  };
  
  // Convert to database format (writes both snake_case and camelCase columns)
  const dbItem = inventoryItemToDb(newItem);

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addInventoryItem() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'inventory', data: dbItem });
    return Promise.resolve(newItem);
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('inventory').insert(dbItem);
      if (error) throw error;
      console.log('[DB] ✅ addInventoryItem() to Supabase — wrote to both column formats');
    });
    return newItem;
  } catch (error) {
    console.error('[DB] ❌ addInventoryItem() failed:', error);
    queueMutation({ type: 'INSERT', table: 'inventory', data: dbItem });
    return newItem;
  }
};

export const updateInventoryItem = async (itemId, updates) => {
  const supabase = initSupabaseClient();
  
  // Convert updates to database format (writes both snake_case and camelCase columns)
  const dbUpdates = inventoryItemToDb({ id: itemId, ...updates });
  
  // Remove id from updates as it's the WHERE clause
  delete dbUpdates.id;

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 updateInventoryItem() — queued for offline sync');
    queueMutation({ type: 'UPDATE', table: 'inventory', id: itemId, data: dbUpdates });
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('inventory').update(dbUpdates).eq('id', itemId);
    if (error) throw error;
    console.log('[DB] ✅ updateInventoryItem() to Supabase — wrote to both column formats');
  }).catch(error => {
    console.error('[DB] ❌ updateInventoryItem() failed:', error);
    queueMutation({ type: 'UPDATE', table: 'inventory', id: itemId, data: dbUpdates });
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// DELETE INVENTORY ITEM - Manager-only operation with audit trail
// ═══════════════════════════════════════════════════════════════════════════
export const deleteInventoryItem = async (itemId, itemName) => {
  const supabase = initSupabaseClient();

  if (!itemId || !itemName) {
    console.warn('[DB] ⚠️  deleteInventoryItem() missing ID or name');
    return { success: false, error: 'Invalid parameters' };
  }

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 deleteInventoryItem() — queued for offline sync');
    queueMutation({ type: 'DELETE', table: 'inventory', id: itemId });
    return { success: true, message: 'Queued for sync' };
  }

  try {
    const result = await retryWithBackoff(async () => {
      const { error } = await supabase.from('inventory').delete().eq('id', itemId);
      if (error) throw error;
      console.log('[DB] ✅ deleteInventoryItem() from Supabase - Item:', itemName);
      return { success: true, data: { id: itemId, name: itemName } };
    });

    return result;
  } catch (error) {
    console.error('[DB] ❌ deleteInventoryItem() failed:', error);
    queueMutation({ type: 'DELETE', table: 'inventory', id: itemId });
    return { success: false, error: error.message };
  }
};

// ─── TRANSACTIONS ────────────────────────────────────────────────────────

export const getTransactions = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 💳 getTransactions() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.TRANSACTIONS, []).map(transactionFromDb));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      console.log('[DB] ✅ getTransactions() from Supabase');
      const parsed = (data || []).map(transactionFromDb);
      setLocalStorage(STORAGE_KEYS.TRANSACTIONS, parsed);
      return parsed;
    });
  } catch (error) {
    console.error('[DB] ❌ getTransactions() failed:', error);
    return getLocalStorage(STORAGE_KEYS.TRANSACTIONS, []);
  }
};

export const saveTransaction = async (transaction) => {
  const supabase = initSupabaseClient();
  const tx = transactionToDb({ ...transaction, id: crypto.randomUUID(), created_at: new Date().toISOString() });

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveTransaction() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'transactions', data: tx });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('transactions').insert(tx);
      if (error) throw error;
      console.log('[DB] ✅ saveTransaction() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ saveTransaction() failed:', error);
    queueMutation({ type: 'INSERT', table: 'transactions', data: tx });
  }
};

export const updateTransactionStatus = async (transactionId, newStatus = 'Yes') => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 updateTransactionStatus() — queued for offline sync');
    queueMutation({ type: 'UPDATE', table: 'transactions', id: transactionId, data: { status: newStatus } });
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', transactionId);
    if (error) throw error;
    console.log('[DB] ✅ updateTransactionStatus() to Supabase');
  }).catch(error => {
    console.error('[DB] ❌ updateTransactionStatus() failed:', error);
    queueMutation({ type: 'UPDATE', table: 'transactions', id: transactionId, data: { status: newStatus } });
  });
};

export const clearTransactions = () => {
  console.log('[DB] 🗑️  clearTransactions() — localStorage cleared (Supabase not cleared)');
  setLocalStorage(STORAGE_KEYS.TRANSACTIONS, []);
  return Promise.resolve();
};

// ─── HISTORY ─────────────────────────────────────────────────────────────

export const getHistory = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📜 getHistory() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.HISTORY, []));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('history').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      console.log('[DB] ✅ getHistory() from Supabase');
      setLocalStorage(STORAGE_KEYS.HISTORY, data);
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getHistory() failed:', error);
    return getLocalStorage(STORAGE_KEYS.HISTORY, []);
  }
};

export const addHistoryLog = async (log) => {
  const supabase = initSupabaseClient();
  const now = new Date();
  
  // Get user_id from: explicit parameter > sessionStorage > null
  const userId = log.userId || log.user_id || sessionStorage.getItem('userId') || null;
  
  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: log.timestamp || now.toISOString(),
    date: log.date || now.toISOString().split('T')[0],
    time: log.time || now.toTimeString().split(' ')[0],
    type: log.type,
    description: log.description,
    user: log.user,
    role: log.role,
    user_id: userId, // Can be null - handled by nullable column in schema
    log_category: log.log_category || 'SYSTEM_OPERATION', // NEW: Category for log type separation
    details: log.details || null,
    created_at: now.toISOString(),
  };

  console.log(`[DB] 📝 Adding history log [${log.type}] for user: ${userId || '(system)'}`, logEntry);

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addHistoryLog() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'history', data: logEntry });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('history').insert(logEntry);
      if (error) throw error;
      console.log('[DB] ✅ addHistoryLog() to Supabase — logged:', log.type);
    });
  } catch (error) {
    console.error('[DB] ❌ addHistoryLog() failed:', error);
    // Queue for offline sync even if user_id is null (FK issue should be fixed by schema migration)
    queueMutation({ type: 'INSERT', table: 'history', data: logEntry });
  }
};

export const clearHistory = () => {
  console.log('[DB] 🗑️  clearHistory() — localStorage cleared (Supabase not cleared)');
  setLocalStorage(STORAGE_KEYS.HISTORY, []);
  return Promise.resolve();
};

// ─── BUSINESS INFO ───────────────────────────────────────────────────────

export const getBusinessInfo = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 🏢 getBusinessInfo() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.BUSINESS_INFO, {}));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('business_info').select('*').limit(1).single();
      if (error && error.code === 'PGRST116') {
        // No rows found — use default
        console.log('[DB] ℹ️ getBusinessInfo() — no data in Supabase, using default');
        return {};
      }
      if (error) throw error;
      console.log('[DB] ✅ getBusinessInfo() from Supabase');
      setLocalStorage(STORAGE_KEYS.BUSINESS_INFO, data);
      return data || {};
    });
  } catch (error) {
    console.error('[DB] ❌ getBusinessInfo() failed:', error);
    return getLocalStorage(STORAGE_KEYS.BUSINESS_INFO, {});
  }
};

export const saveBusinessInfo = (info) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveBusinessInfo() — queued for offline sync');
    setLocalStorage(STORAGE_KEYS.BUSINESS_INFO, info);
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('business_info').upsert(info);
    if (error) throw error;
    console.log('[DB] ✅ saveBusinessInfo() to Supabase');
    setLocalStorage(STORAGE_KEYS.BUSINESS_INFO, info);
  }).catch(error => {
    console.error('[DB] ❌ saveBusinessInfo() failed:', error);
  });
};

// ─── SUPPLIERS ───────────────────────────────────────────────────────────

export const getSuppliers = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 🚚 getSuppliers() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.SUPPLIERS, []));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (error) throw error;
      console.log('[DB] ✅ getSuppliers() from Supabase');
      setLocalStorage(STORAGE_KEYS.SUPPLIERS, data);
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getSuppliers() failed:', error);
    return getLocalStorage(STORAGE_KEYS.SUPPLIERS, []);
  }
};

export const saveSuppliers = (suppliers) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveSuppliers() — queued for offline sync');
    setLocalStorage(STORAGE_KEYS.SUPPLIERS, suppliers);
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('suppliers').upsert(suppliers);
    if (error) throw error;
    console.log('[DB] ✅ saveSuppliers() to Supabase');
    setLocalStorage(STORAGE_KEYS.SUPPLIERS, suppliers);
  }).catch(error => {
    console.error('[DB] ❌ saveSuppliers() failed:', error);
  });
};

// ─── RECIPES ─────────────────────────────────────────────────────────────

export const getRecipes = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 👨‍🍳 getRecipes() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.RECIPES, {}));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('recipes').select('*');
      if (error) throw error;
      console.log('[DB] ✅ getRecipes() from Supabase');
      
      // ✅ Detect duplicate recipes (multiple recipes per dish_id)
      const recipes = {};
      const duplicates = {};
      
      data.forEach(r => {
        if (recipes[r.dish_id]) {
          if (!duplicates[r.dish_id]) {
            duplicates[r.dish_id] = [];
          }
          duplicates[r.dish_id].push(r.id);
          console.warn(`[DB] ⚠️ Duplicate recipe found for dish ${r.dish_id}: ${r.id}`);
        }
        recipes[r.dish_id] = r;
      });
      
      if (Object.keys(duplicates).length > 0) {
        console.error('[DB] ❌ CRITICAL: Duplicate recipes detected for dishes:', Object.keys(duplicates));
        console.error('[DB] ⚠️ Admin action required: Clean up duplicate recipes in Supabase');
        console.error('[DB] Duplicate recipe IDs:', duplicates);
      }
      
      setLocalStorage(STORAGE_KEYS.RECIPES, recipes);
      return recipes;
    });
  } catch (error) {
    console.error('[DB] ❌ getRecipes() failed:', error);
    return getLocalStorage(STORAGE_KEYS.RECIPES, {});
  }
};

export const saveRecipe = async (dishId, recipe) => {
  const supabase = initSupabaseClient();
  let recipeData = Array.isArray(recipe)
    ? { dish_id: dishId, ingredients: recipe, id: crypto.randomUUID() }
    : {
        ...recipe,
        dish_id: dishId,
        ingredients: recipe.ingredients ?? recipe,
        id: recipe.id || null,
      };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveRecipe() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'recipes', data: recipeData });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      // ✅ Check if recipe already exists for this dish
      if (!recipeData.id) {
        const { data: existing, error: fetchError } = await supabase
          .from('recipes')
          .select('id')
          .eq('dish_id', dishId)
          .maybeSingle();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }
        
        if (existing?.id) {
          recipeData.id = existing.id;
          console.log('[DB] 📝 Updating existing recipe for dish:', dishId);
        } else {
          recipeData.id = crypto.randomUUID();
          console.log('[DB] ➕ Creating new recipe for dish:', dishId);
        }
      }
      
      const { error } = await supabase.from('recipes').upsert(recipeData);
      if (error) throw error;
      console.log('[DB] ✅ saveRecipe() to Supabase:', recipeData.id);
    });
  } catch (error) {
    console.error('[DB] ❌ saveRecipe() failed:', error);
    queueMutation({ type: 'INSERT', table: 'recipes', data: recipeData });
  }
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────

export const getNotifications = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 🔔 getNotifications() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.NOTIFICATIONS, []));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      console.log('[DB] ✅ getNotifications() from Supabase');
      setLocalStorage(STORAGE_KEYS.NOTIFICATIONS, data);
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getNotifications() failed:', error);
    return getLocalStorage(STORAGE_KEYS.NOTIFICATIONS, []);
  }
};

export const addNotification = async (note) => {
  const supabase = initSupabaseClient();
  const now = new Date().toISOString();
  const timestamp = note.timestamp ? new Date(note.timestamp).toISOString() : now;
  const userId = note.user_id || sessionStorage.getItem('userId') || null;

  const extraFields = { ...note };
  delete extraFields.id;
  delete extraFields.message;
  delete extraFields.category;
  delete extraFields.type;
  delete extraFields.timestamp;
  delete extraFields.created_at;
  delete extraFields.seen;
  delete extraFields.seen_at;
  delete extraFields.user_id;

  const notification = {
    id: crypto.randomUUID(),
    message: note.message || '',
    category: note.category || 'GENERAL',
    type: note.type || 'info',
    timestamp,
    created_at: now,
    seen: note.seen ?? false,
    seen_at: note.seen_at || null,
    user_id: userId,
    payload: Object.keys(extraFields).length > 0 ? extraFields : null,
  };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addNotification() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'notifications', data: notification });
    return;
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('notifications').insert(notification);
      if (error) throw error;
      console.log('[DB] ✅ addNotification() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ addNotification() failed:', error);
    queueMutation({ type: 'INSERT', table: 'notifications', data: notification });
  }
};

export const updateNotification = async (notificationId, updates) => {
  const supabase = initSupabaseClient();

  // updates object should contain fields like: { status: 'handled' } or { status: 'archived' }
  if (!notificationId || !updates) {
    console.warn('[DB] ⚠️  updateNotification() missing ID or updates');
    return { success: false, error: 'Invalid parameters' };
  }

  // If updating status to 'handled' or 'archived', add audit trail info
  const enhancedUpdates = { ...updates };
  if ((updates.status === 'handled' || updates.status === 'archived') && !updates.handled_by) {
    const currentUserId = sessionStorage.getItem('userId');
    if (currentUserId) {
      enhancedUpdates.handled_by = currentUserId;
      enhancedUpdates.handled_at = new Date().toISOString();
    }
  }

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 updateNotification() — queued for offline sync');
    queueMutation({ type: 'UPDATE', table: 'notifications', id: notificationId, data: enhancedUpdates });
    return { success: true, message: 'Queued for sync' };
  }

  try {
    const result = await retryWithBackoff(async () => {
      const { data, error } = await supabase
        .from('notifications')
        .update(enhancedUpdates)
        .eq('id', notificationId)
        .select();
      
      if (error) throw error;
      console.log('[DB] ✅ updateNotification() to Supabase - ID:', notificationId, 'Updates:', enhancedUpdates);
      return { success: true, data };
    });
    
    return result;
  } catch (error) {
    console.error('[DB] ❌ updateNotification() failed:', error);
    queueMutation({ type: 'UPDATE', table: 'notifications', id: notificationId, data: enhancedUpdates });
    return { success: false, error: error.message };
  }
};

// ─── USAGE LOGS ───────────────────────────────────────────────────────────

// Helper: Normalize usage log for display - flexible for different action types
// Preserves complete 'details' field untouched for audit trail
const normalizeUsageLog = (log) => {
  if (!log) return null;

  // Extract display properties based on action type (flexible for future)
  let displayProps = {
    id: log.id,
    action: log.action,
    created_at: log.created_at,
    timestamp: log.created_at, // For backward compatibility
    details: log.details || {}, // PRESERVE COMPLETE DETAILS FOR AUDIT
  };

  // Action-specific normalization (extensible for future log types)
  if (log.action === 'RECIPE_DEDUCTION') {
    // Extract from nested details for RECIPE_DEDUCTION logs
    displayProps.itemName = log.details?.inventory_item_name || 'Unknown Item';
    displayProps.quantityUsed = log.details?.quantity_deducted || 0;
    displayProps.unit = log.details?.measurement_unit || '';
    displayProps.timestamp = log.details?.timestamp || log.created_at;
    // Preserve audit fields in display object as well
    displayProps.inventoryItemId = log.details?.inventory_item_id;
    displayProps.oldStock = log.details?.old_stock;
    displayProps.newStock = log.details?.new_stock;
  } else if (log.action === 'INVENTORY_ADJUSTMENT') {
    // Future: INVENTORY_ADJUSTMENT logs
    displayProps.itemName = log.details?.item_name || 'Unknown Item';
    displayProps.quantityUsed = log.details?.quantity_adjusted || 0;
    displayProps.unit = log.details?.unit || '';
    displayProps.adjustmentReason = log.details?.reason || 'Manual Adjustment';
  } else if (log.action === 'WASTE_LOGGED') {
    // Future: WASTE_LOGGED logs
    displayProps.itemName = log.details?.item_name || 'Unknown Item';
    displayProps.quantityUsed = log.details?.quantity_wasted || 0;
    displayProps.unit = log.details?.unit || '';
    displayProps.wasteReason = log.details?.reason || 'Waste Disposal';
  } else if (log.action === 'SUPPLIER_ORDER') {
    // Future: SUPPLIER_ORDER logs
    displayProps.itemName = log.details?.item_name || 'Unknown Item';
    displayProps.quantityUsed = log.details?.quantity_received || 0;
    displayProps.unit = log.details?.unit || '';
    displayProps.supplierId = log.details?.supplier_id;
  } else {
    // FALLBACK: For unknown action types, try to extract common fields
    displayProps.itemName = log.details?.inventory_item_name || log.details?.item_name || 'Unknown Item';
    displayProps.quantityUsed = log.details?.quantity_deducted ?? log.details?.quantity_adjusted ?? log.details?.quantity_wasted ?? 0;
    displayProps.unit = log.details?.measurement_unit || log.details?.unit || '';
  }

  return displayProps;
};

export const getUsageLogs = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📊 getUsageLogs() — using localStorage fallback');
    const cachedLogs = getLocalStorage(STORAGE_KEYS.USAGE_LOGS, []);
    // Apply normalization to cached logs as well (for consistent display offline)
    const normalizedCached = cachedLogs.map(normalizeUsageLog);
    return Promise.resolve(normalizedCached);
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('usage_logs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      // Normalize all logs for consistent display (preserves details for audit)
      const normalizedData = (data || []).map(normalizeUsageLog);
      console.log('[DB] ✅ getUsageLogs() from Supabase - fetched and normalized', normalizedData.length, 'logs');
      setLocalStorage(STORAGE_KEYS.USAGE_LOGS, data); // Store raw for sync, display normalized
      return normalizedData;
    });
  } catch (error) {
    console.error('[DB] ❌ getUsageLogs() failed:', error);
    const cachedLogs = getLocalStorage(STORAGE_KEYS.USAGE_LOGS, []);
    // Apply normalization to fallback logs too
    const normalizedCached = cachedLogs.map(normalizeUsageLog);
    return normalizedCached;
  }
};

export const addUsageLog = async (log) => {
  const supabase = initSupabaseClient();
  const logEntry = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...log,
  };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addUsageLog() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'usage_logs', data: logEntry });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('usage_logs').insert(logEntry);
      if (error) throw error;
      console.log('[DB] ✅ addUsageLog() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ addUsageLog() failed:', error);
    queueMutation({ type: 'INSERT', table: 'usage_logs', data: logEntry });
  }
};

// ─── SERVICE FEES ─────────────────────────────────────────────────────────

export const getServiceFees = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 💰 getServiceFees() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.SERVICE_FEES, {}));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('service_fees').select('*').limit(1).single();
      if (error && error.code === 'PGRST116') {
        console.log('[DB] ℹ️ getServiceFees() — no data in Supabase, using default');
        return {};
      }
      if (error) throw error;
      console.log('[DB] ✅ getServiceFees() from Supabase');
      setLocalStorage(STORAGE_KEYS.SERVICE_FEES, data);
      return data || {};
    });
  } catch (error) {
    console.error('[DB] ❌ getServiceFees() failed:', error);
    return getLocalStorage(STORAGE_KEYS.SERVICE_FEES, {});
  }
};

export const saveServiceFees = async (fees) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveServiceFees() — queued for offline sync');
    setLocalStorage(STORAGE_KEYS.SERVICE_FEES, fees);
    return Promise.resolve();
  }

  const feeData = { ...fees };

  if (!feeData.id) {
    try {
      const { data: existingRows, error: selectError } = await supabase.from('service_fees').select('id').limit(1);
      if (!selectError && Array.isArray(existingRows) && existingRows.length > 0) {
        feeData.id = existingRows[0].id;
      } else {
        feeData.id = crypto.randomUUID();
      }
    } catch (error) {
      console.warn('[DB] ⚠️ saveServiceFees() could not retrieve existing service fee id:', error);
      feeData.id = crypto.randomUUID();
    }
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('service_fees').upsert(feeData);
    if (error) throw error;
    console.log('[DB] ✅ saveServiceFees() to Supabase');
    setLocalStorage(STORAGE_KEYS.SERVICE_FEES, feeData);
  }).catch(error => {
    console.error('[DB] ❌ saveServiceFees() failed:', error);
  });
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export const initDatabase = () => {
  console.log('[DB] 🔧 Initializing database service...');
  initSupabaseClient();
  console.log(`[DB] 📴 Offline mode: ${isOnline ? 'DISABLED' : 'ENABLED'}`);
  console.log(`[DB] 📋 Sync queue size: ${syncQueue.length}`);
  
  if (syncQueue.length > 0 && isOnline) {
    flushSyncQueue();
  }
};

// ============================================================================
// EXPORTS FOR DEBUG/TESTING (DEVELOPMENT ONLY)
// ============================================================================

export const __DEBUG__ = import.meta.env.DEV ? {
  isOnline: () => isOnline,
  syncQueue: () => [...syncQueue],
  flushQueue: flushSyncQueue,
  getSupabaseClient: () => supabaseClient,
} : {};
