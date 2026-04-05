/**
 * healthCheckService.js
 * 
 * System health monitoring for POS application
 * Tracks key metrics: network status, database connectivity, queue health, memory usage
 * 
 * Features:
 * - Real-time system health status
 * - Component-level health checks
 * - Memory pressure monitoring
 * - Database connectivity verification
 * - Sync queue status tracking
 * - Automatic error recovery
 * 
 * Usage:
 *   import { getHealthStatus, registerHealthCheck } from '@/services/healthCheckService'
 *   
 *   // Get overall health status
 *   const health = await getHealthStatus();
 *   
 *   // Listen to health changes
 *   onHealthChange((newStatus) => {
 *     if (newStatus.overall !== 'healthy') {
 *       alertUser('System degraded');
 *     }
 *   });
 */

import { getSupabaseClient, getSyncQueueStatus } from './databaseService';
import { getOfflineModeStatus } from '../hooks/useOfflineMode';

// ============================================================================
// HEALTH STATUS DEFINITIONS
// ============================================================================

export const HEALTH_STATUS = {
  HEALTHY: 'healthy',       // All systems operational
  DEGRADED: 'degraded',     // Some systems impaired, operational
  CRITICAL: 'critical',     // Major system failures, reduced functionality
  OFFLINE: 'offline',       // No network connectivity
};

// ============================================================================
// HEALTH CHECK REGISTRY & STATE
// ============================================================================

let healthCheckListeners = [];
let lastHealthStatus = null;
let healthCheckHistory = [];
const MAX_HISTORY = 50; // Track last 50 health check results

const registerHealthChangeListener = (callback) => {
  healthCheckListeners.push(callback);
  return () => {
    healthCheckListeners = healthCheckListeners.filter(cb => cb !== callback);
  };
};

const broadcastHealthChange = (newStatus) => {
  lastHealthStatus = newStatus;
  healthCheckHistory.push({
    timestamp: new Date().toISOString(),
    status: newStatus,
  });
  
  if (healthCheckHistory.length > MAX_HISTORY) {
    healthCheckHistory = healthCheckHistory.slice(-MAX_HISTORY);
  }
  
  healthCheckListeners.forEach(callback => {
    try {
      callback(newStatus);
    } catch (err) {
      console.error('[HealthCheck] Error in listener callback:', err);
    }
  });
};

// ============================================================================
// INDIVIDUAL COMPONENT HEALTH CHECKS
// ============================================================================

/**
 * Check database connectivity via Supabase
 * @returns {Object} { isConnected: boolean, latency: number, error?: string }
 */
const checkDatabaseHealth = async () => {
  const startTime = performance.now();
  
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return {
        isConnected: false,
        latency: 0,
        error: 'Supabase client unavailable',
      };
    }
    
    // Quick health check via session validation
    const { data: { session }, error } = await supabase.auth.getSession();
    const latency = performance.now() - startTime;
    
    if (error) {
      return {
        isConnected: false,
        latency,
        error: error.message,
      };
    }
    
    return {
      isConnected: true,
      latency,
      error: null,
    };
  } catch (err) {
    const latency = performance.now() - startTime;
    return {
      isConnected: false,
      latency,
      error: err.message,
    };
  }
};

/**
 * Check memory pressure
 * @returns {Object} { usagePercent: number, pressure: 'low'|'medium'|'high', warning?: string }
 */
const checkMemoryHealth = () => {
  try {
    if (!performance.memory) {
      return {
        usagePercent: null,
        pressure: 'unknown',
        warning: 'Memory monitoring unavailable (not supported in this browser)',
      };
    }
    
    const { jsHeapSizeLimit, totalJSHeapSize } = performance.memory;
    const usagePercent = (totalJSHeapSize / jsHeapSizeLimit) * 100;
    
    let pressure = 'low';
    let warning = null;
    
    if (usagePercent > 90) {
      pressure = 'high';
      warning = `Critical memory usage: ${Math.round(usagePercent)}%`;
    } else if (usagePercent > 75) {
      pressure = 'medium';
      warning = `High memory usage: ${Math.round(usagePercent)}%`;
    } else if (usagePercent > 60) {
      pressure = 'medium';
    }
    
    return {
      usagePercent: Math.round(usagePercent),
      pressure,
      warning,
    };
  } catch (err) {
    return {
      usagePercent: null,
      pressure: 'unknown',
      error: err.message,
    };
  }
};

/**
 * Check sync queue health
 * @returns {Object} { queueSize: number, failedOps: number, isHealthy: boolean, warning?: string }
 */
const checkSyncQueueHealth = () => {
  try {
    const status = getSyncQueueStatus?.();
    
    if (!status) {
      return {
        queueSize: 0,
        failedOps: 0,
        isHealthy: true,
        warning: 'Sync queue status unavailable',
      };
    }
    
    let warning = null;
    let isHealthy = true;
    
    // Queue size concerns
    if (status.queueSize > 80) {
      warning = `Sync queue large: ${status.queueSize} pending operations`;
      isHealthy = false;
    } else if (status.queueSize > 50) {
      warning = `Sync queue growing: ${status.queueSize} pending operations`;
    }
    
    // Failed operations concerns
    if (status.failedOperations > 10) {
      warning = `Many failed sync operations: ${status.failedOperations}`;
      isHealthy = false;
    } else if (status.failedOperations > 0 && !warning) {
      warning = `Sync has ${status.failedOperations} failed operations`;
    }
    
    return {
      queueSize: status.queueSize,
      failedOps: status.failedOperations,
      isHealthy,
      warning,
      isSyncing: status.isSyncing,
    };
  } catch (err) {
    return {
      queueSize: 0,
      failedOps: 0,
      isHealthy: true,
      error: err.message,
    };
  }
};

/**
 * Check network connectivity
 * @returns {Object} { isOnline: boolean, type: 'online'|'offline' }
 */
const checkNetworkHealth = () => {
  return {
    isOnline: navigator.onLine,
    type: navigator.onLine ? 'online' : 'offline',
  };
};

// ============================================================================
// COMPOSITE HEALTH STATUS
// ============================================================================

/**
 * Aggregate all health checks into overall status
 * @returns {Object} Comprehensive health status object
 */
export const getHealthStatus = async () => {
  const timestamp = new Date().toISOString();
  
  // Run all health checks in parallel
  const [
    networkHealth,
    databaseHealth,
    memoryHealth,
    queueHealth,
  ] = await Promise.all([
    Promise.resolve(checkNetworkHealth()),
    checkDatabaseHealth(),
    Promise.resolve(checkMemoryHealth()),
    Promise.resolve(checkSyncQueueHealth()),
  ]);
  
  // Determine overall health status
  let overallStatus = HEALTH_STATUS.HEALTHY;
  const warnings = [];
  
  // Network is critical
  if (!networkHealth.isOnline) {
    overallStatus = HEALTH_STATUS.OFFLINE;
    warnings.push('Network connectivity lost');
  }
  
  // Database issues should degrade status
  if (!databaseHealth.isConnected && networkHealth.isOnline) {
    if (overallStatus !== HEALTH_STATUS.OFFLINE) {
      overallStatus = HEALTH_STATUS.DEGRADED;
    }
    warnings.push(`Database unreachable: ${databaseHealth.error}`);
  }
  
  // Memory pressure
  if (memoryHealth.pressure === 'high') {
    overallStatus = HEALTH_STATUS.CRITICAL;
    warnings.push(memoryHealth.warning);
  } else if (memoryHealth.pressure === 'medium' && overallStatus === HEALTH_STATUS.HEALTHY) {
    overallStatus = HEALTH_STATUS.DEGRADED;
    if (memoryHealth.warning) warnings.push(memoryHealth.warning);
  }
  
  // Queue health
  if (!queueHealth.isHealthy) {
    if (overallStatus === HEALTH_STATUS.HEALTHY) {
      overallStatus = HEALTH_STATUS.DEGRADED;
    }
    if (queueHealth.warning) warnings.push(queueHealth.warning);
  }
  
  const compositeStatus = {
    timestamp,
    overall: overallStatus,
    components: {
      network: networkHealth,
      database: databaseHealth,
      memory: memoryHealth,
      syncQueue: queueHealth,
    },
    warnings,
    metrics: {
      databaseLatency: databaseHealth.latency || null,
      memoryUsage: memoryHealth.usagePercent || null,
      pendingOperations: queueHealth.queueSize || 0,
      failedOperations: queueHealth.failedOps || 0,
    },
  };
  
  // Notify listeners if status changed
  if (!lastHealthStatus || lastHealthStatus.overall !== compositeStatus.overall) {
    broadcastHealthChange(compositeStatus);
  }
  
  return compositeStatus;
};

// ============================================================================
// CONTINUOUS MONITORING
// ============================================================================

let healthCheckInterval = null;
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

/**
 * Start continuous health monitoring
 * @param {number} intervalMs - Check interval in milliseconds (default: 30s)
 */
export const startHealthMonitoring = (intervalMs = HEALTH_CHECK_INTERVAL_MS) => {
  if (healthCheckInterval) {
    console.log('[HealthCheck] Monitoring already started');
    return;
  }
  
  console.log('[HealthCheck] ✅ Starting continuous health monitoring');
  
  // Run initial check
  getHealthStatus();
  
  // Schedule periodic checks
  healthCheckInterval = setInterval(() => {
    getHealthStatus().catch(err => {
      console.error('[HealthCheck] Error during scheduled health check:', err);
    });
  }, intervalMs);
};

/**
 * Stop continuous health monitoring
 */
export const stopHealthMonitoring = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[HealthCheck] ⛔ Stopped health monitoring');
  }
};

/**
 * Get health check history
 * @returns {Array} Array of health status snapshots
 */
export const getHealthHistory = () => {
  return [...healthCheckHistory];
};

/**
 * Register callback for health status changes
 * @param {Function} callback - Function called when health status changes
 * @returns {Function} Unsubscribe function
 */
export const onHealthChange = (callback) => {
  return registerHealthChangeListener(callback);
};

/**
 * Get last recorded health status
 * @returns {Object|null} Last health status or null if never checked
 */
export const getLastHealthStatus = () => {
  return lastHealthStatus;
};

// ============================================================================
// RECOVERY & AUTO-REMEDIATION
// ============================================================================

/**
 * Attempt to recover from degraded/critical status
 * @returns {Promise<Object>} New health status after recovery attempt
 */
export const attemptRecovery = async () => {
  console.log('[HealthCheck] 🔄 Attempting system recovery...');
  
  const currentStatus = await getHealthStatus();
  
  // If offline, can't do much except wait for network
  if (currentStatus.overall === HEALTH_STATUS.OFFLINE) {
    console.log('[HealthCheck] System offline - waiting for network restoration');
    return currentStatus;
  }
  
  // Try to reconnect to database if disconnected
  if (!currentStatus.components.database.isConnected) {
    console.log('[HealthCheck] Attempting database reconnection...');
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[HealthCheck] ✅ Database reconnected');
        }
      } catch (err) {
        console.warn('[HealthCheck] Database reconnection failed:', err.message);
      }
    }
  }
  
  // Re-check health after recovery attempts
  const updatedStatus = await getHealthStatus();
  
  if (updatedStatus.overall !== currentStatus.overall) {
    console.log('[HealthCheck] Recovery successful - status improved', {
      before: currentStatus.overall,
      after: updatedStatus.overall,
    });
  }
  
  return updatedStatus;
};

// ============================================================================
// MONITORING STATE EXPORT
// ============================================================================

export const HealthCheckService = {
  getHealthStatus,
  startHealthMonitoring,
  stopHealthMonitoring,
  getHealthHistory,
  onHealthChange,
  getLastHealthStatus,
  attemptRecovery,
  HEALTH_STATUS,
};

// Export public API
export default HealthCheckService;
