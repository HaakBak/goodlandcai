// src/config/appConfig.js
// Centralized app configuration with environment variable resolution.
// Sensitive values loaded internally from .env; exported values do not expose environment source.

const ENV = import.meta.env;

// Private helper function to safely load environment values
const loadEnv = () => ({
  mode: ENV.MODE || 'development',
  appEnv: ENV.VITE_APP_ENV || 'development',
  appName: ENV.VITE_APP_NAME || 'GoodLand Cafe',
  appVersion: ENV.VITE_APP_VERSION || '1.0.0',
  debugMode: ENV.VITE_DEBUG_MODE === 'true',
  logLevel: ENV.VITE_LOG_LEVEL ,
  apiBaseUrl: ENV.VITE_API_BASE_URL,
  apiTimeout: Number(ENV.VITE_API_TIMEOUT || 30000),
  supabaseUrl: ENV.VITE_SUPABASE_URL || '',
  supabaseAnonKey: ENV.VITE_SUPABASE_ANON_KEY || '',
  emailApiKey: ENV.VITE_EMAIL_API_KEY || '',
  paymentPublicKey: ENV.VITE_PAYMENT_PUBLIC_KEY || '',
  analyticsId: ENV.VITE_ANALYTICS_ID || '',
  sentryDsn: ENV.VITE_SENTRY_DSN || '',
  businessTin: ENV.VITE_BUSINESS_TIN || '908-767-876-000',
  businessName: ENV.VITE_BUSINESS_NAME || 'GoodLand Cafe',
  businessStatus: ENV.VITE_BUSINESS_STATUS || 'VAT_Reg',
  businessAddress: ENV.VITE_BUSINESS_ADDRESS || 'Cariño Street, Baguio City',
  businessPhone: ENV.VITE_BUSINESS_PHONE || '(239) 555-0298',
  serviceFeeDineIn: Number(ENV.VITE_SERVICE_FEE_DINEIN) || 3,
  serviceFeeTakeout: Number(ENV.VITE_SERVICE_FEE_TAKEOUT) || 5,
  adminUsername: ENV.VITE_ADMIN_USERNAME,
  adminEmail: ENV.VITE_ADMIN_EMAIL,
  adminPassword: ENV.VITE_ADMIN_PASSWORD,
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

export const EXTRA_KEYS = {
  EMAIL_API_KEY: config.emailApiKey,
  PAYMENT_PUBLIC_KEY: config.paymentPublicKey,
  ANALYTICS_ID: config.analyticsId,
  SENTRY_DSN: config.sentryDsn,
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

export const ADMIN_DEFAULT_USER = {
  id: 'admin-id',
  username: config.adminUsername,
  email: config.adminEmail,
  password: config.adminPassword,
  role: 'Administrator',
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
