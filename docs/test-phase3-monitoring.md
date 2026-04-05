# Phase 3: Monitoring & Production Readiness — Testing & Implementation Guide

## Overview

Phase 3 adds comprehensive system health monitoring with real-time alerting and auto-recovery capabilities.

### Components Implemented

1. **healthCheckService.js** — Core health monitoring engine
   - Network connectivity checks
   - Database connectivity & latency
   - Memory pressure monitoring
   - Sync queue health tracking
   - Automatic recovery attempts
   - Health change notifications

2. **SystemHealthMonitor.jsx** — Admin dashboard component
   - Real-time health status display
   - Component-level breakdown (network, DB, memory, queue)
   - Historical trends
   - One-click recovery button
   - Critical alert indicators

3. **useHealthMonitoring.js** — React hooks
   - `useHealthMonitoring()` — Full monitoring hook with recovery
   - `useNetworkStatus()` — Simple network status tracking
   - `useMemoryMonitoring()` — Memory pressure monitoring

---

## Testing Guide

### Setup: Enable Health Monitoring in App

**Step 1: Import and initialize monitoring**

In `src/App.jsx` or main admin view, add:

```javascript
import { useHealthMonitoring } from './hooks/useHealthMonitoring';
import SystemHealthMonitor from './components/SystemHealthMonitor';

function AdminDashboard() {
  const { health, isCritical } = useHealthMonitoring({
    autoStart: true,
    checkInterval: 30000, // 30 seconds
    onCritical: (status) => {
      console.warn('🚨 CRITICAL SYSTEM STATUS', status);
      // Could show banner, send alert, etc.
    }
  });

  return (
    <div>
      {isCritical && (
        <div className="bg-red-100 border border-red-400 p-4 mb-4">
          ⚠️ System is experiencing critical issues. Check health status.
        </div>
      )}
      <SystemHealthMonitor />
    </div>
  );
}
```

**Step 2: Start monitoring globally**

In `src/main.jsx`, add after app initialization:

```javascript
import { startHealthMonitoring } from './services/healthCheckService';

// Start background health monitoring
startHealthMonitoring(30000); // Check every 30 seconds
```

---

## Test Scenarios

### Scenario 1: Network Connectivity Monitoring

**Goal**: Verify network status detection

**Steps**:
1. Open DevTools Network tab (F12)
2. Throttle to "Offline"
3. Monitor console for health check logs
4. Check `getHealthStatus()` result:
   ```javascript
   import { getHealthStatus } from './services/healthCheckService';
   const status = await getHealthStatus();
   console.log(status.components.network);
   // Expected: { isOnline: false, type: 'offline' }
   ```

**Expected Result**:
- ✅ Overall status changes to `OFFLINE`
- ✅ Network component shows `isOnline: false`
- ✅ Dashboard displays "Offline Mode" badge
- ✅ All warnings include network loss message

**Failure Case**:
- ❌ Status doesn't change to OFFLINE
- ❌ Network component shows `isOnline: true` when offline
- ❌ Dashboard doesn't update

---

### Scenario 2: Database Connectivity Monitoring

**Goal**: Verify Supabase connection health checks

**Steps**:
1. Application running and authenticated
2. Get database latency:
   ```javascript
   const health = await getHealthStatus();
   console.log({
     isConnected: health.components.database.isConnected,
     latency: health.components.database.latency,
   });
   ```
3. Monitor over time to see latency patterns

**Expected Result**:
- ✅ `isConnected: true` when online
- ✅ Latency values: 10-100ms (varies with network)
- ✅ Dashboard shows latency in metrics
- ✅ Green checkmark on database component

**Under Degraded Conditions** (simulate slow DB):
```javascript
// Simulate slow database with DevTools throttling
// Network → "Slow 3G"

const health = await getHealthStatus();
// Expected: latency > 500ms
// Status may degrade but should still show connected
```

---

### Scenario 3: Memory Pressure Monitoring

**Goal**: Verify memory usage detection

**Steps**:
1. Check memory info:
   ```javascript
   const health = await getHealthStatus();
   console.log(health.components.memory);
   // Expected: { usagePercent: 45, pressure: 'low', warning: null }
   ```

2. Create memory load (intentional):
   ```javascript
   // Hold large data in memory
   const bigArray = new Array(10000000).fill({ data: 'x'.repeat(100) });
   
   const health = await getHealthStatus();
   console.log(health.components.memory);
   // Expected: Higher usagePercent, increased pressure
   ```

3. Check dashboard memory component:
   - Progress bar updates
   - Pressure indicator changes color

**Expected Results**:
- ✅ Low memory (< 60%): `pressure: 'low'`, green indicator
- ✅ Medium memory (60-85%): `pressure: 'medium'`, yellow indicator, status degrades
- ✅ High memory (> 85%): `pressure: 'high'`, red indicator, status critical

**Test Memory Alert**:
```javascript
// Create intentional memory pressure
const leak = [];
for (let i = 0; i < 100; i++) {
  leak.push(new Array(1000000).fill(Math.random()));
}

const health = await getHealthStatus();
// Expected: usagePercent > 80, warning message shows
```

---

### Scenario 4: Sync Queue Health

**Goal**: Monitor queue for size and failures

**Steps**:
1. Create offline scenario (Network: "Offline")
2. Create multiple inventory items (10-20)
3. Check queue status:
   ```javascript
   const health = await getHealthStatus();
   console.log(health.components.syncQueue);
   // Expected: 
   // {
   //   queueSize: 15,
   //   failedOps: 0,
   //   isHealthy: true
   // }
   ```

4. Dashboard shows pending operations count

**Test Queue Warnings**:

**Large Queue** (50+ items):
```javascript
// Create 50+ items while offline
// Expected: Warning "Sync queue growing: 55 pending operations"
// Status: DEGRADED
```

**Failed Operations** (3+ failures):
```javascript
// Simulate failures: Block requests, retry, eventually fail
// Expected: Warning about failed operations
// Status: DEGRADED if too many failures
```

---

### Scenario 5: Automatic Recovery

**Goal**: Verify auto-recovery attempts

**Steps**:
1. Simulate degraded state:
   - Network throttled to "Slow 3G"
   - Create some offline operations
2. Check health status:
   ```javascript
   const health = await getHealthStatus();
   console.log(health.overall); // Should be 'degraded'
   ```

3. Click "Attempt Recovery" button on dashboard
4. Monitor console for recovery logs:
   ```
   [HealthCheck] 🔄 Attempting system recovery...
   [HealthCheck] Attempting database reconnection...
   [HealthCheck] ✅ Database reconnected
   ```

5. Check updated status:
   ```javascript
   const newHealth = await getHealthStatus();
   console.log(newHealth.overall); // Should be 'healthy' or improved
   ```

**Expected Results**:
- ✅ Recovery attempt logs appear
- ✅ Status improves (or stays same if issue persistent)
- ✅ Dashboard reflects new status
- ✅ Recovery button disables during attempt (shows spinner)

---

### Scenario 6: Health Change Notifications

**Goal**: Verify event subscriptions work correctly

**Steps**:
1. Subscribe to health changes:
   ```javascript
   import { onHealthChange } from './services/healthCheckService';
   
   const unsubscribe = onHealthChange((newStatus) => {
     console.log('📊 Health status changed:', {
       before: 'healthy',
       after: newStatus.overall
     });
   });
   ```

2. Trigger status change:
   - Go offline (Network: "Offline")
   - Or create memory load
   - Or generate queue failures

3. Watch console for callbacks firing

**Expected Results**:
- ✅ Callback fires immediately on change
- ✅ New status object passed correctly
- ✅ Multiple listeners work (if registered)
- ✅ Unsubscribe stops notifications

---

### Scenario 7: Complete System Degradation & Recovery

**Goal**: Full lifecycle test

**Steps**:

**Phase 1: Degrade System**
```javascript
// Simulate cascade of failures:
1. Network → Offline
2. Wait 5 seconds
3. Check status → OFFLINE
4. Create 20+ pending operations
5. Check status → still OFFLINE
6. Create memory load to 85%+
7. Check status → still OFFLINE (network is critical)
```

**Phase 2: Partial Recovery**
```
1. Network → "Slow 3G" (back online)
2. Wait 10 seconds
3. Check status → DEGRADED (network OK, queue large, memory high)
4. Click "Attempt Recovery"
5. Monitor logs for reconnection attempt
```

**Phase 3: Full Recovery**
```
1. Clear memory load (delete bigArray reference)
2. Wait for sync queue to process
3. Check status → HEALTHY
4. Dashboard shows all green
```

**Expected Timeline**:
- T=0s: Offline → Status OFFLINE
- T=5s: Back online → Status DEGRADED
- T=15s: After recovery attempt → Status improving
- T=30s: Queue cleared, memory released → Status HEALTHY

---

## Console Commands for Testing

### View Current Health

```javascript
import { getHealthStatus } from './services/healthCheckService';

const health = await getHealthStatus();
console.table({
  Overall: health.overall,
  Network: health.components.network.isOnline ? '✅' : '❌',
  Database: health.components.database.isConnected ? '✅' : '❌',
  Memory: health.components.memory.pressure,
  Queue: `${health.components.syncQueue.queueSize} pending`,
});
```

### Watch Health Changes in Real-Time

```javascript
import { onHealthChange } from './services/healthCheckService';

onHealthChange((status) => {
  console.log('%c📊 HEALTH STATUS CHANGED', 'color: blue; font-weight: bold', {
    overall: status.overall,
    timestamp: status.timestamp,
    warnings: status.warnings,
  });
});
```

### Manual Recovery Attempt

```javascript
import { attemptRecovery } from './services/healthCheckService';

const result = await attemptRecovery();
console.log('Recovery result:', result.overall);
```

### View Health History

```javascript
import { getHealthHistory } from './services/healthCheckService';

const history = getHealthHistory();
console.table(history.map(h => ({
  Time: new Date(h.timestamp).toLocaleTimeString(),
  Status: h.status.overall,
})));
```

### Get Last Status

```javascript
import { getLastHealthStatus } from './services/healthCheckService';

const lastStatus = getLastHealthStatus();
console.log('Last health status:', lastStatus);
```

---

## Performance Expectations

| Check | Duration | Frequency |
|-------|----------|-----------|
| **Network Check** | < 1ms | Every 30s |
| **Database Check** | 10-100ms | Every 30s |
| **Memory Check** | < 1ms | Every 30s |
| **Queue Check** | < 5ms | Every 30s |
| **Total Health Check** | 50-150ms | Every 30s |

**CPU Impact**: Negligible (150ms every 30s = 0.5% CPU max)  
**Memory Impact**: ~1KB history per check (50 checks = 50KB)  

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| **Network Detection** | ✅ | ✅ | ✅ | ✅ |
| **Memory API** | ✅ | ✅ | ⚠️ Limited | ✅ |
| **Supabase Health Check** | ✅ | ✅ | ✅ | ✅ |
| **Performance API** | ✅ | ✅ | ✅ | ✅ |

---

## Success Criteria

✅ **Phase 3.1 is complete when**:

1. Health monitoring captures all 4 components: network, database, memory, queue
2. Status reflects real system state (not just checks): HEALTHY → DEGRADED → CRITICAL
3. Health changes broadcast via `onHealthChange()` listeners
4. Recovery attempts work and improve status (if possible)
5. Dashboard displays all metrics with color coding
6. Memory monitoring doesn't cause memory leak (history bounded)
7. No performance impact: health check < 20ms on average
8. npm run build succeeds with no errors
9. Works offline (network detection) and online (full checks)
10. Hooks (`useHealthMonitoring`, `useNetworkStatus`, `useMemoryMonitoring`) work in components

---

## Production Deployment Checklist

**Before Deploying**:
- [ ] Test all 7 scenarios above
- [ ] Verify memory history bounded (max 50 entries)
- [ ] Confirm health checks don't block UI (async)
- [ ] Test on target browsers and devices
- [ ] Monitor health check CPU/memory impact
- [ ] Set up alerting for CRITICAL status
- [ ] Train admins to use recovery button
- [ ] Document health status meanings in help

**After Deployment**:
- [ ] Monitor health check success rate
- [ ] Track average latency to database
- [ ] Alert on persistent OFFLINE or CRITICAL status
- [ ] Review failed recovery attempts
- [ ] Periodically review health history for patterns
- [ ] Adjust check interval if needed (default: 30s)

---

## Next: Phase 3.2 (Optional)

Future enhancements:
- [ ] Health metrics export (CSV/JSON for analysis)
- [ ] Trending analysis (5-min, 1-hour, 24-hour averages)
- [ ] Predictive alerts (memory trending up → alert before critical)
- [ ] Integration with external monitoring (Datadog, New Relic)
- [ ] SLA tracking (uptime percentage, MTTR)
- [ ] Health-based rate limiting (reduce requests when degraded)
- [ ] Automated scaling recommendations

