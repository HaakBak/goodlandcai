/**
 * useHealthMonitoring.js
 * 
 * React hook for system health monitoring
 * Handles subscribing to health changes and managing monitoring lifecycle
 * 
 * Usage:
 *   const { health, history, isRecovering, requestRecovery } = useHealthMonitoring();
 *   
 *   return (
 *     <div>
 *       <p>Status: {health?.overall}</p>
 *       {health?.warnings.map(w => <p>{w}</p>)}
 *     </div>
 *   );
 */

import { useEffect, useState, useCallback } from 'react';
import {
  getHealthStatus,
  onHealthChange,
  getHealthHistory,
  attemptRecovery,
  startHealthMonitoring,
  stopHealthMonitoring,
  getLastHealthStatus,
} from '../services/healthCheckService';

/**
 * Hook for monitoring system health
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoStart - Start monitoring on mount (default: true)
 * @param {number} options.checkInterval - Health check interval in ms (default: 30000)
 * @param {Function} options.onCritical - Callback when status becomes critical
 * @returns {Object} Health monitoring state and controls
 */
export const useHealthMonitoring = (options = {}) => {
  const { autoStart = true, checkInterval = 30000, onCritical = null } = options;
  
  const [health, setHealth] = useState(getLastHealthStatus());
  const [history, setHistory] = useState(getHealthHistory());
  const [isRecovering, setIsRecovering] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  // Handle recovery request
  const requestRecovery = useCallback(async () => {
    setIsRecovering(true);
    try {
      const newStatus = await attemptRecovery();
      setHealth(newStatus);
      return newStatus;
    } catch (err) {
      console.error('[useHealthMonitoring] Recovery failed:', err);
      throw err;
    } finally {
      setIsRecovering(false);
    }
  }, []);

  // Setup monitoring
  useEffect(() => {
    // Get initial health
    getHealthStatus().then(status => {
      setHealth(status);
      setHistory(getHealthHistory());
      
      // Check if critical
      if (status.overall === 'critical') {
        setIsCritical(true);
        if (onCritical) onCritical(status);
      }
    });

    // Subscribe to health changes
    const unsubscribe = onHealthChange(newStatus => {
      setHealth(newStatus);
      setHistory(getHealthHistory());
      
      // Alert on critical status
      const wasCritical = isCritical;
      const nowCritical = newStatus.overall === 'critical';
      
      if (nowCritical && !wasCritical) {
        setIsCritical(true);
        if (onCritical) onCritical(newStatus);
      } else if (!nowCritical && wasCritical) {
        setIsCritical(false);
      }
    });

    // Start continuous monitoring if requested
    if (autoStart) {
      startHealthMonitoring(checkInterval);
    }

    return () => {
      unsubscribe();
      if (autoStart) {
        stopHealthMonitoring();
      }
    };
  }, [autoStart, checkInterval, onCritical, isCritical]);

  return {
    health,
    history,
    isRecovering,
    isCritical,
    requestRecovery,
  };
};

/**
 * Hook for network status monitoring (simple)
 * @returns {Object} { isOnline: boolean, wasOnline: boolean }
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOnline, setWasOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setWasOnline(isOnline);
      setIsOnline(true);
    };

    const handleOffline = () => {
      setWasOnline(isOnline);
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  return { isOnline, wasOnline };
};

/**
 * Hook for memory monitoring
 * @returns {Object} { memoryUsage: number | null, pressure: string }
 */
export const useMemoryMonitoring = () => {
  const [memoryInfo, setMemoryInfo] = useState({
    usagePercent: null,
    pressure: 'unknown',
  });

  useEffect(() => {
    if (!performance.memory) {
      console.warn('[useMemoryMonitoring] Browser does not support memory API');
      return;
    }

    const checkMemory = () => {
      const { jsHeapSizeLimit, totalJSHeapSize } = performance.memory;
      const usagePercent = Math.round((totalJSHeapSize / jsHeapSizeLimit) * 100);
      
      let pressure = 'low';
      if (usagePercent > 85) pressure = 'high';
      else if (usagePercent > 70) pressure = 'medium';
      
      setMemoryInfo({
        usagePercent,
        pressure,
      });
    };

    // Check immediately
    checkMemory();

    // Check periodically
    const interval = setInterval(checkMemory, 10000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
};

export default useHealthMonitoring;
