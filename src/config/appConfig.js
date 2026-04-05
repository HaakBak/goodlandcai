// src/config/appConfig.js
// Centralized app configuration with environment variable resolution.
// 
// SECURITY NOTE: Only PUBLIC values should be exposed to frontend.
// NEVER expose:
// - Passwords or authentication credentials
// - Private API keys (email, payment backend secrets)
// - Database credentials
// - Admin account credentials
// 
// Safe to expose (public information):
// - Supabase ANON_KEY (Supabase handles token-level security)
// - Analytics IDs (already public)
// - Payment PUBLIC_KEY (meant for client-side)
// - Business info (public metadata)
// - Sentry DSN (for error tracking, already public)

const ENV = import.meta.env;

// Private helper function to safely load environment values
const loadEnv = () => ({
  mode: ENV.MODE,
  appEnv: ENV.VITE_APP_ENV,
  appName: ENV.VITE_APP_NAME,
  appVersion: ENV.VITE_APP_VERSION,
  debugMode: ENV.VITE_DEBUG_MODE,
  logLevel: ENV.VITE_LOG_LEVEL,
  apiBaseUrl: ENV.VITE_API_BASE_URL,
  apiTimeout: Number(ENV.VITE_API_TIMEOUT),
  supabaseUrl: ENV.VITE_SUPABASE_URL,
  supabaseAnonKey: ENV.VITE_SUPABASE_ANON_KEY,
  // SECURITY: Public metrics only (not private keys)
  paymentPublicKey: ENV.VITE_PAYMENT_PUBLIC_KEY,
  analyticsId: ENV.VITE_ANALYTICS_ID,
  sentryDsn: ENV.VITE_SENTRY_DSN,
  businessTin: ENV.VITE_BUSINESS_TIN,
  businessName: ENV.VITE_BUSINESS_NAME,
  businessStatus: ENV.VITE_BUSINESS_STATUS,
  businessAddress: ENV.VITE_BUSINESS_ADDRESS,
  businessPhone: ENV.VITE_BUSINESS_PHONE,
  serviceFeeDineIn: Number(ENV.VITE_SERVICE_FEE_DINEIN),
  serviceFeeTakeout: Number(ENV.VITE_SERVICE_FEE_TAKEOUT),
  adminUsername: ENV.VITE_ADMIN_USERNAME, // Identifier only, NOT credentials
});

const config = loadEnv();

export const ENV_VALUES = {
  MODE: config.mode,
  APP_ENV: config.appEnv,
  APP_NAME: config.appName,
  APP_VERSION: config.appVersion,
  DEBUG_MODE: config.debugMode,
  LOG_LEVEL: config.logLevel,
};

export const API_CONFIG = {
  BASE_URL: config.apiBaseUrl,
  TIMEOUT: config.apiTimeout,
};

export const SUPABASE_CONFIG = {
  URL: config.supabaseUrl,
  ANON_KEY: config.supabaseAnonKey,
};

// SECURITY: Only public/safe values exposed
export const EXTRA_KEYS = {
  PAYMENT_PUBLIC_KEY: config.paymentPublicKey, // Safe: public key
  ANALYTICS_ID: config.analyticsId,             // Safe: public ID
  SENTRY_DSN: config.sentryDsn,                 // Safe: error tracking
  // REMOVED: EMAIL_API_KEY (backend-only, never expose to frontend)
};

export const BUSINESS_DEFAULT_INFO = {
  tin: config.businessTin,
  name: config.businessName,
  status: config.businessStatus,
  address: config.businessAddress,
  phone: config.businessPhone,
};

export const SERVICE_FEES_DEFAULTS = {
  dineIn: config.serviceFeeDineIn,
  takeout: config.serviceFeeTakeout,
};

export const STORAGE_KEYS = {
  MENU: 'pos_menu',
  INVENTORY: 'pos_inventory',
  TRANSACTIONS: 'pos_transactions',
  BUSINESS_INFO: 'pos_business_info',
  NOTIFICATIONS: 'pos_notifications',
  SUPPLIERS: 'pos_suppliers',
  RECIPES: 'pos_recipes',
  USAGE_LOGS: 'pos_usage_logs',
  SERVICE_FEES: 'pos_service_fees',
  USERS: 'pos_users',
  HISTORY: 'pos_history',
};

// SECURITY: Default user for offline/mock mode - NO PASSWORD STORED
// In production: Always authenticate against Supabase
// Admin credentials are managed in Supabase and never exposed to frontend
export const ADMIN_DEFAULT_USER = {
  id: 'admin-id',
  username: config.adminUsername || 'admin',
  role: 'Administrator',
  // REMOVED: email, password (never expose credentials in frontend)
  // Frontend should authenticate against Supabase, not hardcoded credentials
};

// ============================================================================
// OFFLINE-FIRST & SYNC CONFIGURATION
// ============================================================================

export const SYNC_CONFIG = {
  OFFLINE_MODE_ENABLED: true, // Default: true
  SYNC_RETRY_INTERVAL: 5000, // 5 seconds
  SYNC_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  EXPONENTIAL_BACKOFF_BASE: 1000, // 1 second
};
