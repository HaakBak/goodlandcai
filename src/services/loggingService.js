/**
 * loggingService.js
 * 
 * Combined logging utility for console logs and database history entries
 * Features:
 * - Sensitive data redaction (safe mode)
 * - Environment-based verbosity control
 * - Unified wrapper for console and DB logging
 * - Toggle debug/safe modes at runtime
 * - Category-based log separation (SYSTEM_OPERATION vs BUSINESS_OPERATION)
 * 
 * Usage:
 *   import { logger } from '@/services/loggingService'
 *   
 *   // Console logging with redaction
 *   logger.console('[Auth]', { userId: '550e8400...', email: 'user@email' }, true);
 *   
 *   // Database logging with category
 *   logger.db(logEntry, 'SYSTEM_OPERATION');
 * 
 * Environment Variables:
 *   VITE_DEBUG_MODE=true|false        - Turn logging on/off
 *   VITE_SAFE_MODE=true|false         - Redact sensitive data
 *   VITE_LOG_LEVEL=debug|info|warn    - Verbosity level
 */

import { addHistoryLog } from './databaseService';

// ============================================================================
// CONFIGURATION & STATE
// ============================================================================

const DEVELOPMENT = import.meta.env.MODE === 'development';
const PRODUCTION = import.meta.env.MODE === 'production';

// Default settings: OFF for production (safe), ON for development
let DEBUG_MODE = DEVELOPMENT;
let SAFE_MODE = PRODUCTION; // Auto-ON in production to protect data
let LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'info';

// Track all logs to memory for debugging/analysis
let logMemory = [];
const MAX_MEMORY_LOGS = 500; // Prevent unbounded memory growth

// ============================================================================
// LOG LEVEL DEFINITIONS
// ============================================================================

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const getCurrentLogLevel = () => LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;

// ============================================================================
// SENSITIVE FIELDS TO REDACT
// ============================================================================

const SENSITIVE_FIELDS = [
  'userId',
  'user_id',
  'id',
  'password',
  'password_hash',
  'email',
  'authToken',
  'sessionToken',
  'supabaseSessionToken',
  'accessToken',
  'refreshToken',
];

const SENSITIVE_PATTERNS = {
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+1|\d{3}[-.]?\d{3}[-.]?\d{4})/g,
};

// ============================================================================
// DATA REDACTION UTILITY
// ============================================================================

/**
 * Recursively redact sensitive data from an object
 * @param {*} data - Data to redact
 * @param {boolean} isSafeMode - Whether to redact sensitive fields
 * @returns {*} Redacted copy of data
 */
const redactData = (data, isSafeMode = true) => {
  if (!isSafeMode) return data; // Don't redact in unsafe mode
  if (data === null || data === undefined) return data;

  // Handle primitive types
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Redact by pattern
      let redacted = data
        .replace(SENSITIVE_PATTERNS.uuid, '***')
        .replace(SENSITIVE_PATTERNS.email, '***@***.***')
        .replace(SENSITIVE_PATTERNS.phone, '***-****');
      return redacted;
    }
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactData(item, isSafeMode));
  }

  // Handle objects
  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      // Field is sensitive - redact completely
      redacted[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively redact nested objects
      redacted[key] = redactData(value, isSafeMode);
    } else {
      // Regular field - keep as is
      redacted[key] = value;
    }
  }

  return redacted;
};

// ============================================================================
// CONSOLE LOGGING WRAPPER
// ============================================================================

/**
 * Log to console with optional redaction
 * @param {string} label - Log label (e.g., '[Auth]', '[DB]')
 * @param {*} data - Data to log
 * @param {boolean} isSensitive - Whether to redact sensitive fields
 * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
 */
const consoleLog = (label, data, isSensitive = false, level = 'info') => {
  // Check if this log level should be shown
  if (LOG_LEVELS[level] < getCurrentLogLevel()) {
    return; // Skip this log
  }

  // Check if debug mode is enabled
  if (!DEBUG_MODE) {
    return; // Logging disabled
  }

  // Redact if needed
  const safeData = isSensitive ? redactData(data, SAFE_MODE) : data;

  // Log to console with appropriate method
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[method](label, safeData);

  // Track in memory
  logMemory.push({
    timestamp: new Date().toISOString(),
    level,
    label,
    data: safeData,
  });

  // Prevent unbounded memory growth
  if (logMemory.length > MAX_MEMORY_LOGS) {
    logMemory = logMemory.slice(-MAX_MEMORY_LOGS);
  }
};

// ============================================================================
// DATABASE LOGGING WRAPPER
// ============================================================================

/**
 * Log to database history table with category
 * @param {Object} logEntry - Log entry object with type, description, etc.
 * @param {string} category - 'SYSTEM_OPERATION' or 'BUSINESS_OPERATION'
 */
const dbLog = async (logEntry, category = 'SYSTEM_OPERATION') => {
  if (!DEBUG_MODE) {
    return; // Logging disabled
  }

  // Validate category
  if (!['SYSTEM_OPERATION', 'BUSINESS_OPERATION'].includes(category)) {
    console.warn(
      '[Logging] Invalid category. Use SYSTEM_OPERATION or BUSINESS_OPERATION'
    );
    return;
  }

  try {
    // Redact sensitive fields if in safe mode
    const safeEntry = SAFE_MODE ? redactData(logEntry, true) : logEntry;

    // Add category to log entry
    const entryWithCategory = {
      ...safeEntry,
      log_category: category,
    };

    // Log to console first (for debugging)
    consoleLog(
      `[DB] 📝 Adding history log [${safeEntry.type}]`,
      { category, ...safeEntry },
      true,
      'debug'
    );

    // Call database function to add history
    await addHistoryLog(entryWithCategory);

    // Log success
    consoleLog(
      `[DB] ✅ History logged [${safeEntry.type}]`,
      { category },
      false,
      'debug'
    );
  } catch (error) {
    // Log error
    consoleLog(
      `[DB] ❌ Failed to log to database: ${error.message}`,
      { category, entry: logEntry },
      false,
      'error'
    );
  }
};

// ============================================================================
// PUBLIC API - Logger Instance
// ============================================================================

export const logger = {
  /**
   * Console logging wrapper
   * @param {string} label - Log label
   * @param {*} data - Data to log
   * @param {boolean} isSensitive - Whether to redact (default: false)
   * @param {string} level - Log level (default: 'info')
   */
  console: (label, data, isSensitive = false, level = 'info') => {
    consoleLog(label, data, isSensitive, level);
  },

  /**
   * Database logging wrapper
   * @param {Object} logEntry - Log entry with type, description, etc.
   * @param {string} category - 'SYSTEM_OPERATION' or 'BUSINESS_OPERATION'
   */
  db: async (logEntry, category = 'SYSTEM_OPERATION') => {
    await dbLog(logEntry, category);
  },

  /**
   * Get memory of all logged messages (for debugging)
   * @returns {Array} Array of log entries
   */
  getMemory: () => logMemory,

  /**
   * Clear log memory
   */
  clearMemory: () => {
    logMemory = [];
  },

  /**
   * Set debug mode at runtime
   * @param {boolean} enabled - Enable/disable debug logging
   */
  setDebugMode: (enabled) => {
    DEBUG_MODE = enabled;
    console.log(`[Logging] Debug mode ${enabled ? 'ON ✅' : 'OFF ⛔'}`);
  },

  /**
   * Set safe mode at runtime (redact sensitive data)
   * @param {boolean} enabled - Enable/disable safe mode
   */
  setSafeMode: (enabled) => {
    SAFE_MODE = enabled;
    console.log(`[Logging] Safe mode ${enabled ? 'ON 🔒' : 'OFF ⚠️'}`);
  },

  /**
   * Set log level at runtime
   * @param {string} level - 'debug', 'info', 'warn', 'error'
   */
  setLogLevel: (level) => {
    if (!LOG_LEVELS[level]) {
      console.error(`[Logging] Invalid log level: ${level}`);
      return;
    }
    LOG_LEVEL = level;
    console.log(`[Logging] Log level set to: ${level}`);
  },

  /**
   * Get current log configuration
   * @returns {Object} Configuration state
   */
  getConfig: () => ({
    debugMode: DEBUG_MODE,
    safeMode: SAFE_MODE,
    logLevel: LOG_LEVEL,
    environment: DEVELOPMENT ? 'development' : 'production',
    memorySize: logMemory.length,
  }),

  /**
   * Export logs to JSON for analysis
   * @returns {Object} JSON export of all logs
   */
  exportLogs: () => ({
    metadata: {
      timestamp: new Date().toISOString(),
      environment: DEVELOPMENT ? 'development' : 'production',
      config: logger.getConfig(),
      totalLogs: logMemory.length,
    },
    logs: logMemory,
  }),
};

// ============================================================================
// GLOBAL ACCESS FOR DEBUGGING
// ============================================================================

// Make logger available in browser console for debugging
if (typeof window !== 'undefined') {
  window.__logging = logger;
  console.log(
    '[Logging] Logger available at window.__logging (use window.__logging.getConfig() to check settings)'
  );
}

// ============================================================================
// AUTO-CONFIGURE FOR ENVIRONMENT
// ============================================================================

if (PRODUCTION) {
  // Production defaults
  logger.setDebugMode(false); // OFF - don't spam logs in production
  logger.setSafeMode(true); // ON - always redact sensitive data
  logger.setLogLevel('warn'); // Only warn and error
  console.info(
    '[Logging] Production mode detected: Debug OFF, Safe mode ON, Level: WARN'
  );
} else {
  // Development defaults
  logger.setDebugMode(true); // ON - see all logs for debugging
  logger.setSafeMode(false); // OFF - show full data for debugging
  logger.setLogLevel('debug'); // All logs
  console.info(
    '[Logging] Development mode detected: Debug ON, Safe mode OFF, Level: DEBUG'
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default logger;
