# Production Operations Guide - POS System

**Last Updated**: April 4, 2026  
**Version**: 1.0 (Phase 3.1)  
**Audience**: Operations, Deployment, Debugging

---

## Table of Contents

1. [Quick Start & Dashboards](#quick-start--dashboards)
2. [Debugging After Deployment](#debugging-after-deployment)
3. [Editing & Updating After Deployment](#editing--updating-after-deployment)
4. [Package Management](#package-management)
5. [Monitoring & Alerts](#monitoring--alerts)
6. [Troubleshooting Workflows](#troubleshooting-workflows)
7. [Common Issues & Solutions](#common-issues--solutions)
8. [Emergency Procedures](#emergency-procedures)

---

## Quick Start & Dashboards

### Access Admin Dashboard (Phase 3.1)

**URL**: `http://yourapp.com/admin`

**Components**:
1. **System Health Monitor** (New)
   - Real-time status: HEALTHY / DEGRADED / CRITICAL / OFFLINE
   - Component breakdown: Network, Database, Memory, Sync Queue
   - Warnings list
   - Key metrics: DB Latency, Memory Usage, Pending Operations, Failed Operations
   - One-click "Attempt Recovery" button

2. **Admin View** (Phase 1)
   - User management
   - History logs with filters
   - Manual access to system operations

### Browser Console Debug Access

**Available in Production** (if VITE_DEBUG_MODE=true in .env):

```javascript
// Get current health status
const status = await window.__logging?.getHealthStatus?.();
console.log('System Health:', status);

// Get health history (last 50 checks)
const history = window.__logging?.getHealthHistory?.();
console.log('Health Timeline:', history);

// Check sync queue status
const queue = await window.__logging?.getSyncQueueStatus?.();
console.log('Queue Status:', queue);

// Get current user info
const user = {
  role: sessionStorage.getItem('userRole'),
  username: sessionStorage.getItem('username'),
  userId: sessionStorage.getItem('userId'),
};
console.log('Current User:', user);

// Monitor real-time health changes
window.__logging?.onHealthChange?.((status) => {
  console.log('Health Changed:', status);
});
```

---

## Debugging After Deployment

### 1. Enable Debug Mode

**In Production .env**:
```env
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

**Rebuild & Redeploy**:
```bash
npm install
npm run build
# Deploy dist/ folder
```

### 2. Check Browser Console (DevTools)

**Open DevTools**: Press `F12` in browser

**Locations**:
- **Console Tab**: All logs with [prefix] tags:
  - `[Auth]` — Authentication events
  - `[DB]` — Database/Supabase events
  - `[Route]` — Route access validation
  - `[HealthCheck]` — System health monitoring
  - `[Sync]` — Offline queue sync events
  
- **Network Tab**: All HTTP requests to Supabase
  - Filter by: `headers`, Supabase URL contains auth tokens (encrypted)
  
- **Application Tab** → **Storage**:
  - **Session Storage**: Current user session
  - **Local Storage**: Offline queue snapshots

### 3. Monitor Logs in Real-Time

**Dashboard Method** (Recommended):
1. Open Admin Dashboard: `/admin`
2. View SystemHealthMonitor component
3. Watch status update every 30 seconds
4. Click component cards for detailed logs

**Console Method**:
```javascript
// Show only health-related logs
window.__logging?.registerHealthChangeListener?.((status) => {
  if (status.overall !== 'healthy') {
    console.warn('⚠️  System Health Degradation:', status);
  }
});
```

### 4. Analyze Health Check Output

**Example Healthy Status**:
```javascript
{
  overall: 'healthy',
  timestamp: '2026-04-04T12:34:56.789Z',
  components: {
    network: { isOnline: true },
    database: { isConnected: true, latency: 145 },
    memory: { usagePercent: 32, pressure: 'low' },
    syncQueue: { pending: 2, failed: 0, size: 2 }
  },
  warnings: [],
  metrics: {
    databaseLatency: 145,
    memoryUsage: 32,
    pendingOperations: 2,
    failedOperations: 0
  }
}
```

**Example Degraded Status**:
```javascript
{
  overall: 'degraded',
  components: {
    database: { isConnected: true, latency: 2500 },  // ⚠️ High latency
    syncQueue: { pending: 75, failed: 5 }            // ⚠️ High queue
  },
  warnings: [
    'Database latency high: 2500ms (threshold: 1000ms)',
    'Sync queue building up: 75 operations pending'
  ]
}
```

### 5. Check Specific Component Logs

**Database Connection**:
```javascript
const status = await window.__logging?.getHealthStatus?.();
console.log('DB Latency:', status.metrics.databaseLatency, 'ms');
console.log('Connected:', status.components.database.isConnected);
```

**Memory Pressure**:
```javascript
const status = await window.__logging?.getHealthStatus?.();
console.log('Memory Usage:', status.metrics.memoryUsage + '%');
console.log('Pressure Level:', status.components.memory.pressure);
// LOW: < 60%, MEDIUM: 60-85%, HIGH: > 85%
```

**Sync Queue**:
```javascript
const queue = await window.__logging?.getSyncQueueStatus?.();
console.log('Pending:', queue.pendingOperations);
console.log('Failed:', queue.failedOperations);
console.log('Max:', queue.maxQueueSize);
console.log('Operations:', queue.operations.slice(0, 3)); // First 3
```

---

## Editing & Updating After Deployment

### Scenario 1: Fix a Bug in Source Code

**Required**: You have access to source repository

**Steps**:
```bash
# 1. Pull latest code
git pull origin main

# 2. Make changes to file (e.g., src/pages/Login.jsx)
# ... edit and save file ...

# 3. Verify changes locally
npm run dev
# Test in browser at http://localhost:5173

# 4. Build for production
npm run build
# Creates optimized dist/ folder

# 5. Deploy dist/ to production server
# (Depends on hosting: Vercel, Netlify, AWS, etc.)
```

**What You CAN'T Do After Deployment**:
- ❌ Edit files directly on production server (files are compiled)
- ❌ Add new npm packages without rebuilding
- ❌ Change code without recompiling and redeploying

### Scenario 2: Change Configuration Values

**Environment Variables** (.env):
```env
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
VITE_API_TIMEOUT=30000
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
```

**To Update**:
```bash
# 1. Edit .env file
nano .env  # or use text editor

# 2. Update variable value
VITE_LOG_LEVEL=info  # change from debug

# 3. Rebuild
npm run build

# 4. Redeploy dist/
```

### Scenario 3: Update Business Logic Config

**File**: `src/config/appConfig.js`

**Safe to Update** (environment variables):
- Service fees
- Business info (name, address, phone)
- Timeouts
- Feature flags

**NOT Safe to Hardcode** (already removed):
- ❌ Admin passwords
- ❌ API keys (use .env)
- ❌ Database credentials (use .env)

**Example Change**:
```javascript
// BEFORE
serviceFeeDineIn: Number(ENV.VITE_SERVICE_FEE_DINEIN) || 0.1,

// AFTER (with new env var)
serviceFeeDineIn: Number(ENV.VITE_SERVICE_FEE_DINEIN) || 0.15,

// Then update .env
VITE_SERVICE_FEE_DINEIN=0.15
```

---

## Package Management

### 1. Check Current Packages

```bash
npm list
# Shows all installed packages and versions
```

### 2. Update Single Package

```bash
# Update to specific version
npm install lodash@4.17.21

# Update to latest
npm install lodash@latest

# Note: Must rebuild after any package change
npm run build
```

### 3. Fix Vulnerabilities

```bash
# Check for vulnerabilities
npm audit
# Shows list of issues

# Auto-fix most issues
npm audit fix

# Review changes
git diff package-lock.json

# Rebuild
npm run build

# Test thoroughly before deploying
npm run dev
```

### 4. Add New Package (With Caution)

```bash
# Add package
npm install new-package

# Test it works
npm run dev

# Ensure it builds
npm run build

# Review size impact
# Note yarn/npm output showing bundle size change
```

**Caution**: Adding large packages can increase bundle size. Check:
```bash
npm run build
# Output shows: "dist/assets/index-XXXX.js - X kB"
```

### 5. Rollback Bad Package Update

```bash
# Restore previous package versions
git checkout package.json package-lock.json

# Reinstall
npm install

# Rebuild
npm run build
```

---

## Monitoring & Alerts

### 1. Real-Time Health Monitoring (Phase 3.1)

**Dashboard**: Admin → System Health Monitor

**What It Checks Every 30 Seconds**:
- ✅ Network connectivity (navigator.onLine)
- ✅ Database latency (Supabase auth.getSession)
- ✅ Memory usage (performance.memory API)
- ✅ Sync queue size (localStorage queue)

**Status Levels**:
| Level | Color | Meaning | Action |
|-------|-------|---------|--------|
| HEALTHY | 🟢 Green | All systems OK | None needed |
| DEGRADED | 🟡 Yellow | Some issues | Monitor, can continue |
| CRITICAL | 🔴 Red | Major failures | Investigate, consider recovery |
| OFFLINE | ⚪ Gray | No network | Wait for network restore |

### 2. Set Up External Monitoring (Recommended for Phase 3.2)

**Option A: Sentry (Error Tracking)**
```bash
npm install @sentry/react
```

```javascript
// src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://your-sentry-dsn@sentry.io/project",
  environment: "production",
  tracesSampleRate: 1.0,
});
```

**Option B: DataDog (APM)**
```bash
npm install @datadog/browser-rum
```

**Option C: Simple Logging Service**
```javascript
// Send health metrics to backend
setInterval(() => {
  const health = await getHealthStatus();
  fetch('/api/health-metrics', {
    method: 'POST',
    body: JSON.stringify(health)
  });
}, 60000); // Every minute
```

### 3. Alert Thresholds

**Set alerts when**:
- Database latency > 2000ms (2 seconds)
- Memory usage > 85%
- Sync queue > 80 items
- Network offline > 5 minutes
- Failed operations > 10 in queue

### 4. Daily Health Check Routine

```
08:00 AM - Start monitoring dashboard
  □ Check overall status: HEALTHY?
  □ Check DB latency: < 300ms?
  □ Check memory: < 60%?
  □ Check queue: no failed ops?

Periodically (every 30 min)
  □ Glance at SystemHealthMonitor
  □ Note any DEGRADED or CRITICAL statuses

End of day
  □ Export health history
  □ Check error logs in Supabase
  □ Review any warnings
```

---

## Troubleshooting Workflows

### Workflow 1: "App is Slow"

```
1. DIAGNOSE
   ├─ Open Admin Dashboard
   ├─ Check "Memory" usage
   │  └─ If > 80%: MEMORY ISSUE
   ├─ Check "Database" latency
   │  └─ If > 1000ms: DATABASE ISSUE
   └─ Check "Sync Queue" size
      └─ If > 50 pending: QUEUE ISSUE

2. IF MEMORY ISSUE
   ├─ Check browser console: many listeners? timers?
   ├─ Try "Attempt Recovery" button
   ├─ Reload page (F5)
   ├─ If persists: Restart application server

3. IF DATABASE ISSUE
   ├─ Check Supabase dashboard status
   ├─ Try "Attempt Recovery" button
   ├─ Check network latency: ping database
   ├─ If Supabase down: Wait for restoration

4. IF QUEUE ISSUE
   ├─ Check if offline mode active
   ├─ Verify network connection (Offline checkbox in DevTools)
   ├─ Try "Attempt Recovery" button
   ├─ Queue will sync when network restored
```

### Workflow 2: "Login Not Working"

```
1. DIAGNOSE
   ├─ Open browser DevTools (F12)
   ├─ Go to Application tab
   ├─ Check Session Storage:
   │  └─ userRole, username, userId present?
   ├─ Go to Network tab
   ├─ Try login again
   ├─ Watch for request to Supabase auth
   │  └─ If RED status: Auth failed
   │  └─ If GREEN: Success (but page didn't redirect?)

2. IF AUTH REQUEST FAILS
   ├─ Check error message in console
   ├─ Verify Supabase configured correctly:
   │  └─ VITE_SUPABASE_URL set?
   │  └─ VITE_SUPABASE_ANON_KEY set?
   ├─ Check if user exists in Supabase users table
   ├─ Try with admin account (known to work)

3. IF REQUEST SUCCEEDS BUT NO REDIRECT
   ├─ Check console for route errors
   ├─ Verify sessionStorage populated:
   │  └─ Open DevTools > Application > Session Storage
   │  └─ Should show: userRole, username, userId, supabaseSessionToken
   ├─ Check if user role matches login button (Employee vs Manager)
   └─ Try page refresh (F5)

4. IF EMAIL NOT RECOGNIZED
   ├─ Verify email entered correctly
   ├─ Check if using @goodlandcafe.local (WRONG)
   │  └─ System should use real email addresses
   └─ Check Supabase users table for email
```

### Workflow 3: "Can't Access Protected Page"

```
1. DIAGNOSE
   ├─ You're on page /manager/dashboard
   ├─ See "Access Denied" error?
   ├─ OR redirected to login?

2. CHECK SESSION
   ├─ Open DevTools > Application > Session Storage
   ├─ Is userRole set to "Manager"?
   │  ├─ YES: Session OK
   │  └─ NO: Not logged in, go to WORKFLOW 2 (Login)

3. CHECK ROUTE RULES
   ├─ What role are you trying to access?
   │  ├─ /admin → requires "Administrator"
   │  ├─ /manager → requires "Manager"
   │  └─ /employee → requires "Employee"
   ├─ Check sessionStorage > userRole
   ├─ Does it match? If not: Wrong login button used

4. IF ROLES MISMATCH
   ├─ Logout completely:
   │  └─ DevTools > Application > Storage > Clear All
   │  └─ Or: Open Admin > Login Sidebar > Logout
   ├─ Log back in with correct role button
   ├─ Verify sessionStorage has correct userRole

5. IF STILL BLOCKED
   ├─ Check Supabase user_profiles table:
   │  └─ Does user row have correct role?
   │  └─ Is role exactly: "Employee", "Manager", or "Administrator"?
   └─ If mismatch: Update Supabase directly
```

### Workflow 4: "Offline Queue Has Failed Operations"

```
1. DIAGNOSE
   ├─ Open Admin Dashboard
   ├─ Check "Sync Queue" component
   ├─ See red "Failed: X operations"?

2. UNDERSTAND FAILURES
   ├─ Click on failed operations
   ├─ Note error message (if visible)
   ├─ Check in console:
   │  └─ > window.__logging?.getSyncQueueStatus?.()
   │  └─ Look at queue.operations array
   │  └─ Failed ops tagged with failed=true, error={message}

3. REASONS FOR FAILURES
   ├─ Network timeout (30s limit)
   │  └─ Operation too slow, marked as failed
   ├─ Permission error (RLS blocked)
   │  └─ User doesn't have role for operation
   ├─ Validation error (invalid data)
   │  └─ Data format doesn't match schema
   └─ Database error (Supabase error)
      └─ Check Supabase error logs

4. RECOVERY OPTIONS
   ├─ Option A: Auto-Recovery
   │  ├─ Click "Attempt Recovery" button
   │  ├─ Wait 10 seconds
   │  ├─ Retry failed operations
   │  └─ Check if status improves
   │
   ├─ Option B: Manual Retry
   │  ├─ Fix root cause (see REASONS above)
   │  ├─ Refresh page (F5)
   │  └─ Try operation again
   │
   └─ Option C: Clear Queue (Last Resort)
      ├─ Open DevTools > Application > Local Storage
      ├─ Find key: _sync_queue
      ├─ Delete it
      ├─ Refresh page
      ⚠️ WARNING: Deletes pending operations, data loss possible
```

### Workflow 5: "Database Connection Lost"

```
1. DIAGNOSE
   ├─ Admin Dashboard shows "OFFLINE" status
   ├─ OR: Can't save transactions, getting "network error"

2. CHECK NETWORK
   ├─ Open DevTools > Network tab
   ├─ Look for requests to Supabase (supabase.co domain)
   ├─ Are they failing? (RED status, 0 bytes)
   │  ├─ YES: Network lost
   │  └─ NO: Database issue
   │
   ├─ Try this command:
   │  └─ In DevTools Console:
   │  └─ > fetch('https://www.google.com').then(r=>alert('Online')).catch(e=>alert('Offline'))
   │  └─ If offline: Internet down
   │  └─ If online: Database unreachable

3. IF INTERNET DOWN
   ├─ Check your WiFi/Ethernet connection
   ├─ Restart router
   ├─ App will auto-reconnect when network restored
   └─ Offline queue will sync automatically

4. IF INTERNET OK BUT DATABASE DOWN
   ├─ Check Supabase status page (https://status.supabase.com)
   ├─ Is there a service outage?
   │  ├─ YES: Wait for restoration (all users affected)
   │  └─ NO: Check if credentials are correct
   │  └─ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   │
   ├─ Try connecting to different Supabase endpoint
   ├─ Contact Supabase support if persistent

5. WHILE OFFLINE
   ├─ App switches to offline mode
   ├─ Data saved to localStorage + sync queue
   ├─ Operations queued (shown in dashboard)
   ├─ When network restored:
   │  └─ Auto-sync triggers
   │  └─ Queue processed
   │  └─ Status returns to HEALTHY
```

---

## Common Issues & Solutions

### Issue 1: High Memory Usage (85%+)

**Symptoms**: 
- Page gets slow
- Admin Dashboard shows yellow/red memory indicator
- Browser tab becomes unresponsive

**Causes**:
- Too many event listeners not cleaned up
- Large data objects in memory
- Memory leak in component re-renders

**Solutions**:
```javascript
// 1. IMMEDIATE: Click "Attempt Recovery" button
// This triggers garbage collection and health check reset

// 2. RELOAD: Refresh the page (F5)
// This clears all in-memory data and resets

// 3. DEBUG: Check what's using memory
> performance.memory
{
  jsHeapSizeLimit: 2261534592,  // Max heap
  totalJSHeapSize: 1898292224,  // Currently used
  jsHeapSizeUsed: 1234567890,   // Actually used (rest is overhead)
}

// Calculate percentage: (jsHeapSizeUsed / jsHeapSizeLimit) * 100

// 4. LONG-TERM: Profile in DevTools
// DevTools > Memory > Take heap snapshot
// Compare two snapshots to find leaks
```

---

### Issue 2: Sync Queue Building Up (50+ Operations)

**Symptoms**:
- Pending transactions not completing
- Queue size keeps growing
- Dashboard shows yellow/red queue indicator

**Causes**:
- Network connectivity issues
- Database latency (operations timing out)
- User creating operations faster than sync completes

**Solutions**:
```javascript
// 1. Check queue details
> await window.__logging?.getSyncQueueStatus?.()
// Look at:
// - pendingOperations: How many waiting?
// - failedOperations: How many failed?
// - operations[]: Details of each operation

// 2. If FAILED operations > 0:
// These won't retry, need manual cleanup
// Click "Attempt Recovery" or reload page

// 3. If PENDING operations > 0:
// These will sync when network/db recovers
// Click "Attempt Recovery" to trigger immediate retry

// 4. Monitor queue draining:
// Health check runs every 30s
// Queue should decrease if network OK
// If stuck: Network issue, not queue issue
```

---

### Issue 3: High Database Latency (>2000ms)

**Symptoms**:
- Requests take a long time
- Dashboard shows "DB Latency: 2500ms"
- Operations timeout and fail

**Causes**:
- Supabase server overloaded
- Network latency to Supabase server
- Inefficient database queries
- Concurrent user load spike

**Solutions**:
```javascript
// 1. CHECK SUPABASE STATUS
// https://status.supabase.com
// Any ongoing incidents?

// 2. CHECK NETWORK LATENCY
// Open DevTools > Network tab
// Look at requests to supabase.co
// Note "Time" column (total request time)
// Compare to baseline (should be ~100-300ms)

// 3. TEMPORARY WORKAROUND
// Increase timeout in .env
VITE_API_TIMEOUT=60000  // 60 seconds instead of 30

// 4. SCALE SUPABASE
// If persistent high latency:
// - Upgrade Supabase plan (more resources)
// - Add database indexes for slow queries
// - Optimize queries (reduce data fetched)

// 5. LOCAL TESTING
// Try database query directly in Supabase dashboard
// If slow there too: Supabase issue
// If fast there: Query routing/environment issue
```

---

### Issue 4: "Unauthorized" Errors After Logout

**Symptoms**:
- Logout shows "Session Cleared"
- But still getting 401/403 errors
- OR can still access pages without re-login

**Causes**:
- Session tokens not fully cleared (FIXED in Phase 3 security update)
- Supabase token still valid
- Route guard not re-checking permissions

**Solutions**:
```javascript
// 1. VERIFY SESSION CLEARED
> sessionStorage
// Should be EMPTY after logout
// If you see any keys: Logout didn't work

// 2. FORCE LOGOUT
// Method A (Browser)
F12 > Application > Storage > Clear All > Refresh

// Method B (Developer Code)
> clearUserSession()  // From databaseService
> sessionStorage.clear()
> location.href = '/'

// 3. MANUAL TEST
> sessionStorage.getItem('userRole')
// Should return: null (after logout)
// If returns "Manager" etc: Session not cleared
```

---

### Issue 5: Can't Create New Transaction/Inventory Item

**Symptoms**:
- Click "Save" button
- Nothing happens, or error in console
- Operation disappears from queue

**Causes**:
- Invalid data format
- Permission denied (RLS blocking)
- Offline mode preventing save
- Network timeout

**Solutions**:
```javascript
// 1. CHECK FORM VALIDATION
// Fill all required fields
// Check for error message on form

// 2. CHECK PERMISSIONS
> sessionStorage.getItem('userRole')
// What role? Check if operation requires different role

// 3. CHECK NETWORK
// DevTools > Network tab
// Trigger save action
// Does request appear? Is it RED (failed)?
// Check status code (403=forbidden, 408=timeout, 500=server error)

// 4. CHECK OFFLINE MODE
// Admin Dashboard > Network component
// Is it showing "OFFLINE"?
// If yes: Offline mode, operation queued (expected)

// 5. DEBUG IN CONSOLE
> await getHealthStatus()
// Check database.isConnected
// Check overall status

// 6. TEST DIFFERENT DATA
// Try creating simple transaction (minimal fields)
// If works: Complex validation failing
// If fails: System issue
```

---

## Emergency Procedures

### Scenario: Complete System Failure (CRITICAL)

**WARNING**: All users showing errors, nothing works

```
STEP 1: DIAGNOSE (1 minute)
├─ Check DevTools > Console
│  └─ Error messages? What are they?
├─ Check DevTools > Network
│  └─ Requests succeeding or failing?
├─ Check Health Dashboard
│  └─ Overall status: CRITICAL or OFFLINE?
└─ Check Supabase status page
   └─ Any outages reported?

STEP 2: IMMEDIATE ACTIONS (2 minutes)
├─ Tell users to refresh page (F5)
│  └─ Might clear temporary issues
├─ Check if it's your infrastructure:
│  └─ Is website loading at all?
│  └─ Can you access /login page?
│  └─ OR: Getting white screen/error?

STEP 3: IF CODEBASE ISSUE (5 minutes)
├─ Last thing deployed?
├─ Rollback to previous version:
│  └─ git revert HEAD
│  └─ npm install
│  └─ npm run build
│  └─ Redeploy dist/
├─ Check build errors:
│  └─ npm run build
│  └─ Any errors during compilation?

STEP 4: IF SUPABASE DOWN (5+ minutes)
├─ Check https://status.supabase.com
├─ If outage: Wait for restoration, nothing you can do
├─ Tell users "System maintenance in progress"
├─ Estimate recovery time if provided

STEP 5: IF DATABASE CORRUPTED (30+ minutes)
├─ Check Supabase logs for errors
├─ Check if specific table is broken
├─ Can you query other tables?
├─ If one table damaged:
│  └─ Run migration script (Phase 1)
│  └─ scripts/supabase-schema.sql
│  └─ Contact Supabase support
```

### Scenario: High Load / Performance Degradation

```
STEP 1: REDUCE LOAD (Immediate)
├─ If traffic spike from bot/DDoS:
│  ├─ Enable WAF (Web Application Firewall) if available
│  ├─ Implement rate limiting
│  └─ Contact hosting provider for DDoS mitigation
├─ If legitimate traffic spike:
│  ├─ Load balance across multiple servers
│  ├─ Upgrade server resources
│  └─ Cache frequently accessed data

STEP 2: MONITOR CLOSELY
├─ Watch Admin Dashboard
├─ Check if latencies drop
├─ Monitor memory and CPU usage

STEP 3: SCALE DATABASE (if needed)
├─ Supabase dashboard > Settings > Upgrade Plan
├─ More compute resources reduces latency
└─ Can take 5-30 minutes
```

### Scenario: Data Loss / Corruption

```
⚠️ CRITICAL: Do not make changes without backup plan

STEP 1: ASSESS DAMAGE
├─ What data lost/corrupted?
├─ How many rows affected?
├─ When did it happen?

STEP 2: CHECK BACKUPS
├─ Supabase automatically backs up daily
├─ Go to Supabase dashboard > Backups
├─ Can restore from previous point-in-time

STEP 3: PARTIAL RECOVERY
├─ If sync queue has uncommitted operations:
│  └─ They might restore data
│  └─ Check localStorage _sync_queue
└─ Operations logs might have history
   └─ Check history table

STEP 4: RESTORE FROM BACKUP
├─ Supabase dashboard > Backups
├─ Select backup date
├─ Restore (creates new database)
├─ Verify data looks correct
└─ Might lose data after backup point

STEP 5: NOTIFY USERS
├─ "System experienced data loss"
├─ "Restored from backup, some recent changes lost"
├─ "Please re-enter data from [time] onwards"
```

### Scenario: Stuck / Unresponsive App

```
STEP 1: TRY BASIC RECOVERY (1 minute)
├─ Refresh page: F5
├─ Hard refresh: Ctrl+F5 (clear cache)
├─ Close tab completely, reopen URL
└─ Try in Incognito/Private mode (no extensions)

STEP 2: CLEAR LOCAL DATA (2 minutes)
├─ DevTools > Application > Clear All
├─ Logout, then login again
├─ Try operation again

STEP 3: IF STILL STUCK (5+ minutes)
├─ Check Admin Dashboard > System Health
│  └─ Is any component CRITICAL or OFFLINE?
├─ Run recovery:
│  └─ Admin Dashboard > "Attempt Recovery" button
│  └─ Wait 10 seconds
│  └─ Refresh page
└─ Check browser console for errors
   └─ Any repeated error messages?

STEP 4: IF APP NOT LOADING AT ALL
├─ Check if website is down:
│  └─ Try from different network (phone hotspot)
│  └─ Try from different device
├─ Check Supabase status
├─ Check hosting provider status
└─ Restart application server if you control it
```

---

## Support & Escalation

### When to Contact Supabase Support
- Database not responding
- RLS rules not working
- Data corruption
- Scheduled maintenance
- Need to restore from backup

### When to Contact Hosting Provider (Vercel/Netlify/AWS)
- Website not loading
- 5XX server errors
- Deployment failures
- Infrastructure issues

### When to Review Your Code
- Logic errors (wrong conditions)
- Permissions issues (RLS rules)
- Memory leaks
- Network timeout settings too low

---

## Checklists

### Daily Operational Checklist
- [ ] Website loading correctly
- [ ] Admin can login
- [ ] Admin Dashboard shows HEALTHY status
- [ ] No critical errors in console
- [ ] Supabase status page shows "All Systems Operational"
- [ ] Backups running (check Supabase dashboard)
- [ ] No stuck transactions in sync queue

### Weekly Operational Checklist
- [ ] Review error logs in Supabase
- [ ] Check for any degradation patterns
- [ ] Verify all user roles can login to their sections
- [ ] Test password reset workflow
- [ ] Export and archive health metrics
- [ ] Review any monitoring alerts

### Monthly Operational Checklist
- [ ] Upgrade security patches: `npm audit fix`
- [ ] Rebuild and redeploy
- [ ] Test disaster recovery procedure
- [ ] Review and update security settings
- [ ] Capacity planning (monitor trends)
- [ ] Schedule any maintenance windows

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-04 | Initial release (Phase 3.1) |

---

**Archived in**: [ARCHIVED_OPERATIONS_GUIDES](/ARCHIVED_OPERATIONS_GUIDES)
