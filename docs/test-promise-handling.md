# Phase 2.3: Promise Error Handling - Test Scenarios

## How to Test

### Test 1: Normal Operation (All Requests Succeed)
1. Open the Inventory page
2. Observe data loads normally without errors
3. Check browser console for no error messages
4. Verify all 5 data sources populated:
   - Inventory table shows items
   - Suppliers section shows suppliers
   - Recipes are loaded
   - Usage logs appear if available
5. **Expected**: ✅ All data loaded successfully, no error notifications

---

### Test 2: Simulate Network Timeout
1. Open DevTools (F12) → Network tab
2. Apply "Throttling": Network → "Offline" or "Slow 3G"
3. Refresh the Inventory page
4. Wait for requests to exceed 30 seconds
5. **Expected**: 
   - ✅ Request timeout error appears
   - ✅ Retry happens automatically (up to 3 times)
   - ✅ Browser console shows: `[Inventory] Request timeout`
   - ✅ If all retries fail: shows warning notification
   - ✅ Graceful fallback with empty data

---

### Test 3: Simulate Partial Failure
1. Open DevTools → Network tab
2. Select one request type to block:
   - Right-click on `/getSuppliers` → "Block request URL"
3. Refresh Inventory page
4. **Expected**:
   - ✅ Suppliers requests fail
   - ✅ Other 4 data sources load successfully
   - ✅ Warning notification: `"⚠️ Failed to load: Suppliers. Using cached data."`
   - ✅ Suppliers section is empty/default
   - ✅ Console shows: `[Inventory] Data load failures: - Suppliers: ...`

---

### Test 4: Verify Retry Logic with Exponential Backoff
1. Add a 2-3 second delay to one request:
   - DevTools → Network → Throttling → Custom profile with latency
2. Make Inventory requests
3. Watch browser console for retry messages
4. **Expected**:
   - ✅ First attempt fails/times out
   - ✅ Console: `[Inventory] Retry attempt 2/3 in 500ms for: ...`
   - ✅ Waits 500ms, retries
   - ✅ If still fails → Console: `[Inventory] Retry attempt 3/3 in 1000ms for: ...`
   - ✅ Waits 1000ms, final attempt
   - ✅ If all fail, shows graceful error

---

### Test 5: Multiple Concurrent Failures
1. Block multiple request types:
   - Network → Block `getInventory`
   - Network → Block `getRecipes`
2. Refresh Inventory page
3. **Expected**:
   - ✅ Both sources fail
   - ✅ Warning notification shows: `"⚠️ Failed to load: Inventory, Recipes. Using cached data."`
   - ✅ Console logs: `[Inventory] Data load failures:` with both failures
   - ✅ Other 3 data sources (Suppliers, Menu, Logs) load successfully
   - ✅ Graceful partial data display

---

### Test 6: Verify Loading State Management
1. Open DevTools → Network → Throttling → Slow 3G
2. Open Inventory page and watch console
3. **Expected**:
   - ✅ Immediately: `setIsLoadingData(true)` (not visible in UI, but tracked)
   - ✅ During request: `isLoadingData = true`
   - ✅ After success/failure: `setIsLoadingData(false)` in finally block
   - ✅ This prevents multiple simultaneous refresh attempts

---

### Test 7: Error Notification System
1. Force an error by blocking a request
2. Refresh Inventory page
3. **Expected notification**:
   - ✅ Shows warning toast: `"⚠️ Failed to load: [source]. Using cached data."`
   - ✅ Type: 'warning', severity: 'medium'
   - ✅ Category: 'DATA_LOAD_ERROR'
   - ✅ Automatically disappears after 5 seconds (per notification service)

---

### Test 8: Catch-All Error Handler
1. Simulate a critical error in refreshData:
   - Manually trigger an exception in the try block
2. Refresh Inventory page
3. **Expected**:
   - ✅ Shows error notification: `"❌ Error loading inventory data. Please try refreshing the page."`
   - ✅ Console error: `[Inventory] Unexpected error during data refresh: ...`
   - ✅ Type: 'error', severity: 'high'
   - ✅ Data loadError state set: `"Failed to load inventory data"`

---

## Performance Expectations

### Request Timing
- **Normal (Good Network)**: ~500ms - 2s (all 5 requests in parallel)
- **Slow Network (3G)**: ~3s - 8s (with optional retries)
- **Timeout**: 30s max per request (before retry)
- **With 1 Retry**: ~30.5s (initial 30s timeout + 500ms backoff + retry)

### Resource Usage
- **Network**: 5 simultaneous fetch requests (Promise.allSettled parallelizes)
- **Memory**: Minimal (handles failures without accumulating data)
- **CPU**: Low (retry backoff prevents busy-waiting)

---

## Monitoring

### Browser Console Logs
```
✅ Success:
(No error logs)

⚠️ Timeout/Retry:
[Inventory] Retry attempt 2/3 in 500ms for: Request timeout...
[Inventory] Retry attempt 3/3 in 1000ms for: Request timeout...

❌ Partial Failure:
[Inventory] Data load failures:
  - Suppliers: Fetch failed: 404 Not Found

💥 Complete Failure:
[Inventory] Unexpected error during data refresh: TypeError: ...
```

### State Tracking
```javascript
// In browser console:
// Check loading state
window.__logging?.getMemory()?.filter(log => log.includes('isLoadingData'))

// Check error state
window.__logging?.getMemory()?.filter(log => log.includes('dataLoadError'))
```

---

## Success Criteria

✅ Timeout protection working (30s max per request)  
✅ Retry logic working (up to 3 attempts with exponential backoff)  
✅ Promise.allSettled handling mixed results correctly  
✅ Graceful fallback values (empty arrays/objects) on failure  
✅ User-friendly error notifications displayed  
✅ Console logging showing what failed and why  
✅ Loading state managed properly (no multiple simultaneous refreshes)  
✅ Partial data loads successfully (only affected sources show errors)  
✅ No application crashes on network failures  
✅ Build compiles without errors  

---

## Related Files

- [src/pages/manager/Inventory.jsx](src/pages/manager/Inventory.jsx) — Promise error handling
- [src/services/notificationService.js](src/services/notificationService.js) — Error notifications
- [src/services/loggingService.js](src/services/loggingService.js) — Debug logging

