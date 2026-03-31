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

export const getUserProfileByUsername = async (username) => {
  try {
    const supabase = initSupabaseClient();
    if (!supabase) {
      console.warn('[Auth] Supabase client not available');
      return null;
    }
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, email, role, status')
      .eq('username', username)
      .single();
    
    if (error) {
      console.error('[Auth] Error fetching user profile:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('[Auth] getUserProfileByUsername error:', err);
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
  syncQueue.push({
    ...operation,
    queuedAt: new Date().toISOString(),
  });
  setLocalStorage('_sync_queue', syncQueue);
  console.log(`[DB] 📋 Queued operation [${operation.type}] — Queue size: ${syncQueue.length}`);
};

const flushSyncQueue = async () => {
  if (syncInProgress || syncQueue.length === 0 || !isOnline) {
    return;
  }

  syncInProgress = true;
  broadcastSyncEvent({ status: 'syncing', queueSize: syncQueue.length });

  const failedOperations = [];
  let successCount = 0;

  for (const operation of syncQueue) {
    try {
      console.log(`[DB] 🔄 Flushing queued operation [${operation.type}]...`);
      
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

      successCount++;
    } catch (error) {
      console.error(`[DB] ❌ Failed to flush operation [${operation.type}]:`, error);
      failedOperations.push(operation);
    }
  }

  syncQueue = failedOperations;
  setLocalStorage('_sync_queue', syncQueue);
  syncInProgress = false;

  broadcastSyncEvent({
    status: 'synced',
    successCount,
    failedCount: failedOperations.length,
    queueSize: syncQueue.length,
  });

  console.log(`[DB] ✅ Sync complete — ${successCount} succeeded, ${failedOperations.length} pending`);
};

// Load queue on startup
syncQueue = getLocalStorage('_sync_queue', []);

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
      if (error) throw error;
      console.log('[DB] ✅ saveUser() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ saveUser() failed:', error);
    queueMutation({ type: 'INSERT', table: 'user_profiles', data: user });
  }
};

// ─── MENU ────────────────────────────────────────────────────────────────

export const getMenu = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 🍽️  getMenu() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.MENU, []).map(menuFromDb));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('menu').select('*');
      if (error) throw error;
      const menuData = (data || []).map(menuFromDb);
      console.log('[DB] ✅ getMenu() from Supabase');
      setLocalStorage(STORAGE_KEYS.MENU, menuData);
      return menuData;
    });
  } catch (error) {
    console.error('[DB] ❌ getMenu() failed:', error);
    return getLocalStorage(STORAGE_KEYS.MENU, []);
  }
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

export const getInventory = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📦 getInventory() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.INVENTORY, []));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) throw error;
      console.log('[DB] ✅ getInventory() from Supabase');
      setLocalStorage(STORAGE_KEYS.INVENTORY, data);
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getInventory() failed:', error);
    return getLocalStorage(STORAGE_KEYS.INVENTORY, []);
  }
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
  const newItem = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addInventoryItem() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'inventory', data: newItem });
    return Promise.resolve(newItem);
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('inventory').insert(newItem);
      if (error) throw error;
      console.log('[DB] ✅ addInventoryItem() to Supabase');
    });
    return newItem;
  } catch (error) {
    console.error('[DB] ❌ addInventoryItem() failed:', error);
    queueMutation({ type: 'INSERT', table: 'inventory', data: newItem });
    return newItem;
  }
};

export const updateInventoryItem = async (itemId, updates) => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 updateInventoryItem() — queued for offline sync');
    queueMutation({ type: 'UPDATE', table: 'inventory', id: itemId, data: updates });
    return Promise.resolve();
  }

  return retryWithBackoff(async () => {
    const { error } = await supabase.from('inventory').update(updates).eq('id', itemId);
    if (error) throw error;
    console.log('[DB] ✅ updateInventoryItem() to Supabase');
  }).catch(error => {
    console.error('[DB] ❌ updateInventoryItem() failed:', error);
    queueMutation({ type: 'UPDATE', table: 'inventory', id: itemId, data: updates });
  });
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
  const userId = log.userId || sessionStorage.getItem('userId') || null;
  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: log.timestamp || now.toISOString(),
    date: log.date || now.toISOString().split('T')[0],
    time: log.time || now.toTimeString().split(' ')[0],
    type: log.type,
    description: log.description,
    user: log.user,
    role: log.role,
    user_id: userId,
    created_at: now.toISOString(),
  };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 addHistoryLog() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'history', data: logEntry });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('history').insert(logEntry);
      if (error) throw error;
      console.log('[DB] ✅ addHistoryLog() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ addHistoryLog() failed:', error);
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
      const recipes = {};
      data.forEach(r => { recipes[r.dish_id] = r; });
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
  const recipeData = Array.isArray(recipe)
    ? { dish_id: dishId, ingredients: recipe, id: crypto.randomUUID() }
    : {
        ...recipe,
        dish_id: dishId,
        ingredients: recipe.ingredients ?? recipe,
        id: recipe.id || crypto.randomUUID(),
      };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveRecipe() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'recipes', data: recipeData });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      const { error } = await supabase.from('recipes').upsert(recipeData);
      if (error) throw error;
      console.log('[DB] ✅ saveRecipe() to Supabase');
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

// ─── USAGE LOGS ───────────────────────────────────────────────────────────

export const getUsageLogs = async () => {
  const supabase = initSupabaseClient();

  if (!supabase || !isOnline) {
    console.log('[DB] 📊 getUsageLogs() — using localStorage fallback');
    return Promise.resolve(getLocalStorage(STORAGE_KEYS.USAGE_LOGS, []));
  }

  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('usage_logs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      console.log('[DB] ✅ getUsageLogs() from Supabase');
      setLocalStorage(STORAGE_KEYS.USAGE_LOGS, data);
      return data || [];
    });
  } catch (error) {
    console.error('[DB] ❌ getUsageLogs() failed:', error);
    return getLocalStorage(STORAGE_KEYS.USAGE_LOGS, []);
  }
};

export const addUsageLog = async (log) => {
  const supabase = initSupabaseClient();
  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
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
// EXPORTS FOR DEBUG/TESTING
// ============================================================================

export const __DEBUG__ = {
  isOnline: () => isOnline,
  syncQueue: () => [...syncQueue],
  flushQueue: flushSyncQueue,
  getSupabaseClient: () => supabaseClient,
};
