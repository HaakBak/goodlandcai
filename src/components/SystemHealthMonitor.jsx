/**
 * SystemHealthMonitor.jsx
 * 
 * Real-time system health dashboard for administrators
 * Shows network, database, memory, and sync queue health status
 * 
 * Features:
 * - Real-time health status with color coding
 * - Component-level breakdown (network, database, memory, queue)
 * - Historical health trends
 * - One-click system recovery
 * - Automatic critical alerts
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import {
  getHealthStatus,
  onHealthChange,
  getHealthHistory,
  attemptRecovery,
  HEALTH_STATUS,
} from '../services/healthCheckService';

const SystemHealthMonitor = () => {
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    // Initial health check
    getHealthStatus().then(status => {
      setHealth(status);
      setLastUpdated(new Date().toISOString());
    });

    // Subscribe to health changes
    const unsubscribe = onHealthChange(newStatus => {
      setHealth(newStatus);
      setHistory(getHealthHistory());
      setLastUpdated(new Date().toISOString());
    });

    return () => unsubscribe();
  }, []);

  const handleRecovery = async () => {
    setIsRecovering(true);
    try {
      const newStatus = await attemptRecovery();
      setHealth(newStatus);
    } catch (err) {
      console.error('Recovery failed:', err);
    } finally {
      setIsRecovering(false);
    }
  };

  if (!health) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-gray-600">Loading system health...</p>
      </div>
    );
  }

  // Color coding helper
  const getStatusColor = (status) => {
    switch (status) {
      case HEALTH_STATUS.HEALTHY:
        return 'bg-green-50 border-green-200';
      case HEALTH_STATUS.DEGRADED:
        return 'bg-yellow-50 border-yellow-200';
      case HEALTH_STATUS.CRITICAL:
        return 'bg-red-50 border-red-200';
      case HEALTH_STATUS.OFFLINE:
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case HEALTH_STATUS.HEALTHY:
        return <CheckCircle size={24} className="text-green-600" />;
      case HEALTH_STATUS.DEGRADED:
        return <AlertTriangle size={24} className="text-yellow-600" />;
      case HEALTH_STATUS.CRITICAL:
        return <AlertCircle size={24} className="text-red-600" />;
      case HEALTH_STATUS.OFFLINE:
        return <AlertCircle size={24} className="text-gray-600" />;
      default:
        return <AlertCircle size={24} className="text-gray-600" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case HEALTH_STATUS.HEALTHY:
        return 'All Systems Operational';
      case HEALTH_STATUS.DEGRADED:
        return 'System Degraded';
      case HEALTH_STATUS.CRITICAL:
        return 'Critical Issues Detected';
      case HEALTH_STATUS.OFFLINE:
        return 'Offline Mode';
      default:
        return 'Unknown Status';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <div className={`border-2 rounded-lg p-6 ${getStatusColor(health.overall)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(health.overall)}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {getStatusText(health.overall)}
              </h2>
              <p className="text-sm text-gray-600">
                Last updated: {new Date(health.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          {health.overall !== HEALTH_STATUS.HEALTHY && (
            <button
              onClick={handleRecovery}
              disabled={isRecovering}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isRecovering ? 'animate-spin' : ''} />
              {isRecovering ? 'Recovering...' : 'Attempt Recovery'}
            </button>
          )}
        </div>

        {/* Warnings */}
        {health.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {health.warnings.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Component-Level Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Network Status */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            {health.components.network.isOnline ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Network</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Status:</span>{' '}
              <span className={health.components.network.isOnline ? 'text-green-600' : 'text-red-600'}>
                {health.components.network.isOnline ? 'Online' : 'Offline'}
              </span>
            </p>
          </div>
        </div>

        {/* Database Status */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            {health.components.database.isConnected ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Database</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Status:</span>{' '}
              <span className={health.components.database.isConnected ? 'text-green-600' : 'text-red-600'}>
                {health.components.database.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </p>
            {health.components.database.latency !== null && (
              <p className="text-gray-600">
                <span className="font-medium">Latency:</span> {health.components.database.latency.toFixed(0)}ms
              </p>
            )}
            {health.components.database.error && (
              <p className="text-red-600 text-xs">{health.components.database.error}</p>
            )}
          </div>
        </div>

        {/* Memory Status */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            {health.components.memory.pressure === 'low' ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : health.components.memory.pressure === 'medium' ? (
              <AlertTriangle size={20} className="text-yellow-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Memory</h3>
          </div>
          <div className="space-y-2 text-sm">
            {health.components.memory.usagePercent !== null && (
              <>
                <p className="text-gray-600">
                  <span className="font-medium">Usage:</span> {health.components.memory.usagePercent}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      health.components.memory.pressure === 'low'
                        ? 'bg-green-600'
                        : health.components.memory.pressure === 'medium'
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${health.components.memory.usagePercent}%` }}
                  />
                </div>
              </>
            )}
            {health.components.memory.warning && (
              <p className="text-yellow-600 text-xs">{health.components.memory.warning}</p>
            )}
          </div>
        </div>

        {/* Sync Queue Status */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            {health.components.syncQueue.isHealthy ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <h3 className="font-semibold text-gray-900">Sync Queue</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              <span className="font-medium">Pending:</span> {health.components.syncQueue.queueSize}
            </p>
            {health.components.syncQueue.failedOps > 0 && (
              <p className="text-red-600">
                <span className="font-medium">Failed:</span> {health.components.syncQueue.failedOps}
              </p>
            )}
            {health.components.syncQueue.isSyncing && (
              <p className="text-blue-600 text-xs">
                <span className="inline-block animate-spin mr-1">⟳</span> Syncing...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">DB Latency</p>
            <p className="text-2xl font-bold text-gray-900">
              {health.metrics.databaseLatency !== null ? `${health.metrics.databaseLatency.toFixed(0)}ms` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Memory Usage</p>
            <p className="text-2xl font-bold text-gray-900">
              {health.metrics.memoryUsage !== null ? `${health.metrics.memoryUsage}%` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Pending Ops</p>
            <p className="text-2xl font-bold text-gray-900">
              {health.metrics.pendingOperations}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Failed Ops</p>
            <p className="text-2xl font-bold text-red-600">
              {health.metrics.failedOperations}
            </p>
          </div>
        </div>
      </div>

      {/* Health History */}
      {history.length > 1 && (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-gray-900" />
            <h3 className="font-semibold text-gray-900">Health History</h3>
          </div>
          <div className="space-y-2">
            {history.slice(-10).reverse().map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  entry.status.overall === HEALTH_STATUS.HEALTHY
                    ? 'bg-green-100 text-green-800'
                    : entry.status.overall === HEALTH_STATUS.DEGRADED
                    ? 'bg-yellow-100 text-yellow-800'
                    : entry.status.overall === HEALTH_STATUS.CRITICAL
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {entry.status.overall.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemHealthMonitor;
