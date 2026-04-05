# GoodLand Cafe POS System - Supabase Integration Guide

**Version**: 1.0.0  
**Date**: March 24, 2026  
**Status**: Implementation Complete ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation & Setup](#installation--setup)
5. [Configuration](#configuration)
6. [Database Schema](#database-schema)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

This guide explains how the GoodLand Cafe POS system now integrates with **Supabase** while maintaining **offline-first** functionality.

### Key Features

- ✅ **Supabase-First**: Cloud database as primary storage
- ✅ **Offline-First**: System works offline; auto-syncs when network reconnects
- ✅ **Sync Queue**: Queues mutations offline; replays them online
- ✅ **Real-Time Status**: UI shows "Online", "Offline", "Syncing...", "Synced" badges
- ✅ **Error Handling**: Graceful fallback to offline mode on connection failures
- ✅ **Backward Compatible**: All existing imports and function signatures unchanged
- ✅ **RBAC Enforced**: Row-Level Security at database level

---

## Architecture

### System Design

```
┌────────────────────────────────────────────┐
│        React Components (POS, Dashboard)   │
└────────────────┬───────────────────────────┘
                 │
         ┌───────▼─────────┐
         │ databaseService │  ← Core abstraction layer
         │  (21 functions) │
         └───┬──────────┬──┘
             │          │
        ┌────▼──┐   ┌──▼─────┐
        │Supabase◄─►│Sync Queue
        │(Cloud) │  │(Offline)
        └────┬──┐   └──┬─────┐
             │  └──────┘   │
             │             │
        ┌────▼─────────────▼──┐
        │ localStorage Cache   │
        │ (Temporary Storage)  │
        └──────────────────────┘
```

### Data Flow

**Online Mode**:
```
Component → databaseService → Try Supabase → Cache locally → Return
```

**Offline Mode**:
```
Component → databaseService → Fail Supabase → Queue change → Cache locally → Return
                               ↓
                          (On reconnect)
                               ↓
                        Flush queue to Supabase
```

---

## Prerequisites

- Node.js 16+
- npm 8+
- Supabase account (https://supabase.com)
- Supabase project created

---

## Installation & Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Choose organization → enter project name → set strong password
4. Select region (closest to your users)
5. Wait for project to be created (≈2 minutes)

### Step 2: Run SQL Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire SQL schema from [SQL Schema](#database-schema) below
4. Paste and run (press Ctrl+Enter or click ▶ Run)
5. Verify all 11 tables created in **Table Editor**

### Step 3: Get Supabase Credentials

1. Go to **Settings → API**
2. Copy **Project URL** → set as `VITE_SUPABASE_URL`
3. Copy **Anon Key** → set as `VITE_SUPABASE_ANON_KEY`

### Step 4: Configure .env

1. Open `.env` in project root
2. Update:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   VITE_OFFLINE_MODE=true
   ```
3. Save

### Step 5: Install Dependencies

```bash
npm install
```

### Step 6: Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5174` (default).

---

## Configuration

### Environment Variables

| Variable | Example | Required | Purpose |
|----------|---------|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | ✅ Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbG...` | ✅ Yes | Supabase anonymous key |
| `VITE_OFFLINE_MODE` | `true` | ❌ No (default: true) | Enable offline-first mode |
| `VITE_ADMIN_USERNAME` | `admin` | ❌ No | Admin login username |
| `VITE_ADMIN_PASSWORD` | `****` | ❌ No | Admin login password |
| `VITE_BUSINESS_TIN` | `908-767-876-000` | ❌ No | Business TIN |
| `VITE_DEBUG_MODE` | `true` | ❌ No | Console logging (dev only) |

### Sync Configuration

Edit `src/config/appConfig.js` to adjust sync behavior:

```javascript
export const SYNC_CONFIG = {
  OFFLINE_MODE_ENABLED: true,        // Allow offline → online sync
  SYNC_RETRY_INTERVAL: 5000,         // Wait 5s before retry
  MAX_RETRIES: 3,                    // Max retry attempts
  EXPONENTIAL_BACKOFF_BASE: 1000,    // 1s, then 2s, 4s, 8s...
};
```

---

## Database Schema

### Overview (11 Tables)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `user_profiles` | User accounts + roles | id, username, role, phone |
| `menu` | Menu items + prices | id, name, base_price, vat_fee, category |
| `inventory` | Stock management | id, name, in_stock, cost, type |
| `transactions` | Sales records | id, user_id, items, total, status |
| `history` | Audit logs | id, user_id, type, description, timestamp |
| `business_info` | Business details | id, tin, name, status, address, phone |
| `suppliers` | Vendor management | id, name, email, phone, address |
| `recipes` | Dish recipes | id, dish_id, ingredients, steps |
| `notifications` | System alerts | id, user_id, message, category, seen |
| `usage_logs` | Activity tracking | id, user_id, action, timestamp |
| `service_fees` | Transaction fees | id, dine_in, takeout |

### SQL Schema

Copy and run this in Supabase SQL Editor:

```sql
-- See full schema in scripts/supabase-schema.sql
-- Includes 11 tables with RLS policies and indexes
```

### Row-Level Security (RLS) Policies

All tables have RLS enabled. Key policies:

- **Employees**: See only own transactions/history
- **Managers**: See team data only
- **Admins**: See all data
- **Public data** (menu, fees): Visible to all
- **Modifications**: Restricted by role

---

## Testing

### Manual Testing Workflow

#### 1. Test Supabase Connection Online

```javascript
// Browser console
dc = window.__DEBUG__ || import('databaseService')
dc.getSupabaseClient()  // Should return Supabase client
```

#### 2. Test Offline Mode

1. Open dev tools (F12) → Network tab
2. Throttle to "Offline"
3. Try creating a transaction
4. Check console: `[DB] 📥 saveTransaction() — queued for offline sync`
5. Check localStorage: open `_sync_queue` key
6. Go back online
7. Check console: `[DB] 🔄 Flushing queued operation...`

#### 3. Test All 21 Database Functions

```bash
npm run test  # (if tests available)
```

Or manually via components:
- Employee POS: `getMenu`, `saveTransaction`
- Manager Inventory: `getInventory`, `updateInventoryItem`
- Admin Dashboard: `getHistory`, `clearHistory`

#### 4. Test RBAC

- Log in as Employee → verify `/manager` routes blocked
- Log in as Manager → verify can see team data only
- Log in as Admin → verify access to all sections

#### 5. Test PDF Generation (Offline & Online)

- Generate receipt offline
- Go online
- Verify receipt displays correctly

---

## Troubleshooting

### Build Fails: "Module not found: @supabase/supabase-js"

**Solution**: Install missing dependency
```bash
npm install @supabase/supabase-js
```

### Connection Error: "CORS blocked"

**Cause**: Supabase URL or key incorrect  
**Solution**:
1. Go to Supabase → Settings → API
2. Verify URL and key in `.env`
3. Restart dev server: `npm run dev`

### Offline Mode Not Working

**Check**:
1. Open DevTools → localStorage
2. Search for `_sync_queue` key
3. If missing: offline mode disabled in `.env` (`VITE_OFFLINE_MODE=false`)
4. If present but not syncing: check network tab for errors

**Solution**: Set `VITE_OFFLINE_MODE=true` in `.env`

### "RLS violation" Error When Logging In

**Cause**: User role not set in Supabase  
**Solution**:
1. Go to Supabase → Table Editor → `user_profiles`
2. Verify user has a `role` (Employee, Manager, Administrator)
3. Set role for logged-in user ID

### Sync Queue Growing & Not Flushing

**Cause**: Supabase unreachable  
**Solution**:
1. Check network tab for failed requests
2. Verify `VITE_SUPABASE_URL` is correct
3. Restart app
4. If persists: check Supabase status (supabase.com/status)

### "Cannot read property 'onSync' of undefined"

**Cause**: databaseService not imported  
**Solution**: Add import:
```javascript
import { onSync } from '@/services/databaseService';
```

### Performance: Build Size >500KB

**Note**: This is expected (Supabase client + libraries)  
If deploying:
```bash
npm run build
ls -lh dist/assets/  # Check bundle sizes
```

---

## FAQ

### Q: Will offline data be lost?

**A**: No. Offline changes are queued in localStorage and synced to Supabase when network reconnects. The app shows "Syncing..." during this process.

### Q: Can multiple users work simultaneously?

**A**: Yes. Each user has their own offline queue. Supabase RLS ensures users only see their own data.

### Q: Is my data safe?

**A**: Yes:
- Supabase uses PostgreSQL encryption
- RLS policies enforce database-level permissions
- `.env` is not committed (add to `.gitignore`)
- Passwords are hashed server-side

### Q: How do I reset all data?

**A**: 
1. Delete Supabase project tables
2. Re-run SQL schema
3. Clear localStorage: `localStorage.clear()` in DevTools

### Q: Can I use Supabase Auth for login?

**A**: Yes, planned for Phase 4 (authentication rework). For now, use custom login.

### Q: How do I debug offline/sync issues?

**A**: Enable debug logging:
```env
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

Then check browser console for `[DB]` prefixed logs.

### Q: What if Supabase goes down?

**A**: App automatically falls back to offline mode. Users can continue working offline, and data syncs automatically when Supabase is back online.

---

## Support

For issues or questions:
1. Check browser console for `[DB]` error logs
2. Review this guide's Troubleshooting section
3. Check Supabase documentation: https://supabase.com/docs
4. Contact support with console logs and `.env` setup (remove secrets)

---

## Changelog

### Version 1.0.0 (March 24, 2026)

✅ Supabase infrastructure setup  
✅ Database abstraction layer (databaseService)  
✅ Offline-first sync engine  
✅ Error handling (ErrorBoundary)  
✅ UI sync status badges  
✅ Complete SQL schema with RLS  
✅ Backward compatibility (all 21 functions)  

Planned:
- 🔄 Supabase Auth integration
- 🔄 Real-time data listeners
- 🔄 Admin user management UI
