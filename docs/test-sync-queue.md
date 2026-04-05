# Phase 2.4: Unbounded Sync Queue — Testing Guide

## Overview
Phase 2.4 adds critical bounds and limits to the offline sync queue in `databaseService.js`:
- **MAX_SYNC_QUEUE_SIZE = 100** — Queue never exceeds 100 operations
- **MAX_RETRIES_PER_OPERATION = 3** — Operations retry max 3 times, then marked failed
- **OPERATION_TIMEOUT_MS = 30000** — Each sync operation times out after 30 seconds
- **Failed Operation Tracking** — Permanently failed ops marked and exposed for monitoring

## Architecture Overview

### Before Phase 2.4
```
Problem:
- Queue size unbounded → potential memory leak
- Retry logic: "keep trying forever" → operations never give up
- No timeout protection → hanging operations block sync queue
- Failed ops just accumulated without visibility
```

### After Phase 2.4
```
Solution:
- Queue max 100 ops → drops oldest if exceeded
- Retry max 3x per operation → marks as failed after 3 attempts
- 30s timeout per operation → prevents hanging
- Failed operations exposed via getSyncQueueStatus() for monitoring
```

---

## Testing Strategy

### Setup: Enable Logging & Monitoring

**Step 1: Enable Logging in Browser Console**
```javascript
// In browser DevTools Console (F12)
window.__logging.setDebugMode(true);
```

**Step 2: Monitor Sync Queue Status**
```javascript
// Check queue status anytime
window.__logging?.getSyncQueueStatus?.();

// Sample output:
{
  isOnline: true,
  isSyncing: false,
  queueSize: 2,
  maxQueueSize: 100,
  queueUsage: "2/100",
  pendingOperations: 2,
  failedOperations: 0,
  retryingOperations: 1,
  maxRetriesPerOp: 3,
  operationTimeoutMs: 30000,
  operations: [
    {
      type: "INSERT",
      table: "transactions",
      queuedAt: "2024-04-04T15:30:45.123Z",
      retryCount: 1,
      failed: false,
      lastError: "Network error",
      lastAttempt: "2024-04-04T15:30:50.456Z"
    }
  ]
}
```

---

## Test Scenarios

### Scenario 1: Queue Size Limit (Test MAX_SYNC_QUEUE_SIZE)

**Goal**: Verify queue drops oldest operation when size exceeds 100

**Steps**:
1. Open DevTools Network tab (F12 → Network)
2. Search for "api.supabase.co" to find Supabase requests
3. **Throttle network** to Slow 3G (or offline)
   - DevTools → Network tab → Throttling: "Slow 3G" or "Offline"
4. Go to **Manager → Inventory**
5. Create 150+ inventory items rapidly (create in batches of 10)
   - Button: "Add New Item" (or use bulk import if available)
   - Do this ~15 times to build up 150+ items
6. Check queue status:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   ```

**Expected Result**:
- ✅ Queue size never exceeds 100 (shows `queueUsage: "100/100"`)
- ✅ Console logs: 50+ "Dropped oldest operation" warnings (for items 101-150)
- ✅ Oldest 50 items are lost (acceptable tradeoff for queue overflow)
- ✅ Most recent 100 items retained

**Failure Case**:
- ❌ Queue grows to 150+ items → not enforcing size limit
- ❌ No warnings about dropped items

---

### Scenario 2: Retry Limit (Test MAX_RETRIES_PER_OPERATION)

**Goal**: Verify operations fail & get marked after 3 retry attempts

**Steps**:
1. Open DevTools Network tab (F12 → Network)
2. **Simulate intermittent network failure** (DevTools → Network → Throttling: "Offline")
3. Go to **Manager → Inventory**
4. Create 1-2 inventory items while offline
5. **Observe queue**:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   // Note: retryCount should be 0, failed: false
   ```
6. Wait 10 seconds, check again
7. **Go online** (Throttling: "No throttling")
8. Check queue status immediately after:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   ```

**Expected Result (Single Sync Attempt)**:
- ✅ When online, sync kicks off automatically
- ✅ First attempt: `retryCount: 0 → 1` in console: "retry 1/3"
- ✅ If still fails, continues: "retry 2/3", "retry 3/3"
- ✅ After 3 failed attempts: `failed: true, failedAt: "timestamp"`
- ✅ Console shows: "❌ Operation exceeded max retries (3). Marked as failed."
- ✅ Operations in queue marked with `failed: true`

**Failure Case**:
- ❌ Operations retry 4+ times (not enforcing max)
- ❌ Operations never get marked as `failed: true`

---

### Scenario 3: Operation Timeout (Test OPERATION_TIMEOUT_MS)

**Goal**: Verify operations timeout at 30 seconds

**Steps**:
1. Open DevTools Network tab (F12 → Network)
2. **Block all requests**:
   - Go to Network → Request blocking
   - Right-click any Supabase API request → "Block request URL"
   - Block all URLs matching `*.supabase.co/*`
3. Go to **Manager → Inventory**
4. Create 1 item while requests are blocked (will hang)
5. Open Console and monitor:
   ```javascript
   // Watch for timeout errors
   // Should see: "Operation timeout (30000ms exceeded)"
   ```
6. **Measure time** from creation to timeout notification
7. Check queue after timeout:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   ```

**Expected Result**:
- ✅ After ~30 seconds, operation fails with "Operation timeout (30000ms exceeded)"
- ✅ Console shows: "⚠️  Operation [INSERT] failed (attempt 1/3): Operation timeout..."
- ✅ Operation retries triggered automatically (retry 1/3, 2/3, 3/3)
- ✅ After 3 retries over 30+s, marked as failed
- ⏱️ **Total time**: ~30s (first attempt) + ~30s (retry 2) + ~30s (retry 3) = ~90 seconds until marked failed

**Failure Case**:
- ❌ Operation hangs indefinitely (no timeout error)
- ❌ No "Operation timeout" message in console

---

### Scenario 4: Failed Operation Visibility (Test getSyncQueueStatus)

**Goal**: Verify failed operations are visible & don't retry indefinitely

**Steps**:
1. From Scenario 3 (above), after 3 timeouts, check queue:
   ```javascript
   const status = window.__logging?.getSyncQueueStatus?.();
   console.table(status.operations);
   ```
2. Look for operation with:
   - `failed: true`
   - `failedAt: "timestamp"`
   - `retryCount: 3`
   - `lastError: "Operation timeout (30000ms exceeded)"`

**Expected Result**:
- ✅ Failed operation visible in `operations` array
- ✅ `failedOperations` count increases
- ✅ Failed operation NOT retried on next sync attempt
- ✅ User sees notification: "Failed to sync inventory. Contact admin."

**Failure Case**:
- ❌ Failed operation not in list
- ❌ Failed operation still shows `retryCount: 0` (metadata lost)
- ❌ Failed operation retried on next sync (infinite retry)

---

### Scenario 5: Partial Sync Success (Mixed Success & Failure)

**Goal**: Verify some operations succeed while others fail

**Steps**:
1. Create offline scenario:
   - Network → Throttling: "Offline"
   - Go to **Manager → Inventory**
   - Create 3 items while offline
2. Check queue:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   // Should show: queueSize: 3, pendingOperations: 3
   ```
3. **Selectively unblock** one endpoint:
   - Network → Request blocking
   - Unblock only `POST .../rest/v1/inventory` (allow INSERT)
   - Keep other endpoints blocked
4. Go online (Throttling: "No throttling")
5. Watch sync progress in console
6. After sync attempt, check:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   ```

**Expected Result**:
- ✅ 3 items attempt to sync
- ✅ Inventory items succeed (1-3 inserted successfully)
- ✅ Console shows: "✅ Sync complete — 3 succeeded, 0 failed or pending"
- ✅ Final queue shows: `queueSize: 0, pendingOperations: 0`

**Alternative: Partial Failure**:
If you block transactions but not inventory:
- ✅ Inventory INSERTs succeed
- ✅ Transaction INSERTs fail (blocked)
- ✅ Console shows: "⚠️  Sync complete — X succeeded, Y failed or pending"
- ✅ Failed transactions remain in queue with `retryCount: 1`

---

### Scenario 6: Queue Persistence (Test localStorage)

**Goal**: Verify queue persists across page refresh

**Steps**:
1. Create offline scenario (Network: "Offline")
2. Go to **Manager → Inventory**
3. Create 3 items while offline
4. Check queue:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   // Should show: queueSize: 3
   ```
5. **Refresh page** (F5 or Cmd+R)
6. After reload, immediately check:
   ```javascript
   window.__logging?.getSyncQueueStatus?.();
   // Should show: queueSize: 3 (same items!)
   ```
7. Go online (Throttling: "No throttling")
8. Watch sync happen automatically

**Expected Result**:
- ✅ Queue persists after refresh (3 items still there)
- ✅ Console on startup: "ℹ️  Loaded 3 operations from localStorage (3 pending, 0 failed)"
- ✅ Auto-sync triggers when online
- ✅ Items sync successfully

**Failure Case**:
- ❌ Queue lost after refresh (shows 0 items)
- ❌ Startup console doesn't show "Loaded N operations"

---

### Scenario 7: Sync Event Notifications

**Goal**: Verify users see appropriate notifications during sync

**Steps**:
1. Create 2-3 items offline (Network: "Offline")
2. Watch notification area (bottom-right corner)
3. Go online
4. Watch for notifications:

**Expected Notifications**:
- ✅ "Network restored — flushing sync queue" (when going online)
- ✅ "Syncing..." or progress indicator (during sync)
- ✅ "All changes synced" or "3 items synced successfully" (on completion)
- ✅ If failures: "Failed to sync 1 item. Retrying..." notification

**Monitor in Code**:
```javascript
// Listen to sync events
window.__logging?.onSync?.((event) => {
  console.log('[Sync Event]', event);
});

// Sample events:
// { status: 'syncing', queueSize: 3 }
// { status: 'synced', successCount: 3, failedCount: 0, queueSize: 0 }
// { status: 'queue-warning', message: 'Sync queue exceeded limit...' }
// { status: 'operation-failed', operationType: 'INSERT', reason: 'Max retries exceeded' }
```

---

## Console Monitoring Checklist

### During Offline Period
```javascript
// Verify operation is queued
window.__logging?.getSyncQueueStatus?.();
// Expected: queueSize increases, retryCount: 0, failed: false
```

### On Reconnect
```javascript
// Watch sync progress in console logs
// Expected: [DB] 🔄 Flushing [INSERT] (retry 0/3)...
// Expected: [DB] ✅ Sync complete — 1 succeeded, 0 failed or pending
```

### On Failure
```javascript
// Check failed operations
window.__logging?.getSyncQueueStatus?.();
// Expected: failedOperations: 1, operations[0].failed: true
```

---

## Performance Expectations

| Scenario | Expected Duration | Notes |
|----------|-------------------|-------|
| **Single INSERT offline to sync** | 1-3 seconds | Fast network, immediate sync |
| **Retry with exponential backoff** | ~8 seconds total | 3 attempts: 1s + 2s + 4s delays |
| **Full queue (100 items) sync** | 15-30 seconds | Depends on network speed |
| **Operation timeout** | ~30 seconds per attempt | 3 attempts = ~90 seconds |
| **Queue size enforcement (drop oldest)** | Immediate | Happens when 101st item queued |

---

## Success Criteria

✅ **Phase 2.4 is complete when**:
1. Queue never exceeds 100 items (size limit enforced)
2. Operations retry max 3 times (then marked failed)
3. Operations timeout at 30 seconds (no hanging)
4. Failed operations visible via `getSyncQueueStatus()`
5. Queue persists to localStorage across refresh
6. Users see notifications for sync status
7. Partial failures handled gracefully (some sync, some fail)
8. npm run build succeeds with no errors
9. No memory leaks (same heap size after 50+ queue operations)

---

## Debugging Commands

### Full Queue Inspection
```javascript
const status = window.__logging?.getSyncQueueStatus?.();
console.table(status.operations);
```

### Count by Status
```javascript
const status = window.__logging?.getSyncQueueStatus?.();
console.log({
  pending: status.pendingOperations,
  failed: status.failedOperations,
  retrying: status.retryingOperations,
  total: status.queueSize
});
```

### Clear Failed Operations (Admin Only)
```javascript
// WARNING: Do not use casually. Clears permanently failed ops.
// For testing only.
window.localStorage.setItem('_sync_queue', JSON.stringify(
  JSON.parse(window.localStorage.getItem('_sync_queue') || '[]')
    .filter(op => !op.failed)
));
console.log('Cleared failed operations. Refresh page.');
```

### Watch Sync Events in Real-Time
```javascript
// Listen to all sync events
window.__logging?.onSync?.((event) => {
  console.log('%c[SYNC EVENT]', 'color: blue; font-weight: bold', event);
});
```

---

## Known Limitations

1. **Queue size limit**: Oldest operations dropped without retry — data loss if queue overwhelmed
   - **Mitigation**: Monitor queue size, implement client-side rate limiting
   - **Threshold**: 100 items = ~1MB max queue in localStorage

2. **Retry limit**: After 3 attempts, operation permanently marked failed
   - **Mitigation**: Admin dashboard can monitor failed operations
   - **Recovery**: Manual trigger to retry failed operations (future feature)

3. **Timeout**: Hard 30-second limit per operation
   - **Mitigation**: Operations split into smaller units for faster execution
   - **Future**: Configurable timeout per operation type

4. **localStorage size limit**: Browsers typically allow 5-10MB per domain
   - **At risk**: If queue approaches 100MB of data (unlikely)
   - **Mitigation**: Each operation ~10KB, so 100 items ≈ 1MB (safe)

---

## Files Modified

- `src/services/databaseService.js` — 5 critical changes:
  1. Added bounds constants (lines ~75)
  2. Modified `queueMutation()` with size enforcement
  3. Added `executeOperationWithTimeout()` with 30s timeout
  4. Modified `flushSyncQueue()` with retry counting & failure marking
  5. Added `getSyncQueueStatus()` export for monitoring

## Related Documentation

- [Phase 2.3: Promise Error Handling](./test-promise-handling.md) — Network timeout/retry at HTTP level
- [Phase 2.2: Memory Optimization](./README.md) — Heap memory management
- [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) — Offline-first architecture
