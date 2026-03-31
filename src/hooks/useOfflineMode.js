/**
 * useOfflineMode Hook
 * 
 * Detects network status and syncing state.
 * Allows UI components to show "Offline", "Syncing...", "Synced" badges.
 * 
 * Usage:
 *   const { isOnline, syncStatus } = useOfflineMode();
 *   return <div>{isOnline ? '✅ Online' : '📴 Offline'}</div>
 */

import { useState, useEffect } from 'react';
import { onSync } from '../services/databaseService';

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error'
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    // Track network status
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Track sync events from databaseService
    const unsubscribe = onSync((event) => {
      if (event.status === 'online') {
        setIsOnline(true);
        setSyncStatus('idle');
      } else if (event.status === 'offline') {
        setIsOnline(false);
        setSyncStatus('idle');
      } else if (event.status === 'syncing') {
        setSyncStatus('syncing');
        setQueueSize(event.queueSize || 0);
      } else if (event.status === 'synced') {
        setSyncStatus('synced');
        setQueueSize(event.queueSize || 0);
        // Reset to idle after 2 seconds
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    syncStatus,
    queueSize,
    isSyncing: syncStatus === 'syncing',
    isSynced: syncStatus === 'synced',
    isIdle: syncStatus === 'idle',
  };
};
