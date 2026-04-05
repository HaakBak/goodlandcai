 # 🎨 Visual Reference Guide - Notification System

## At a Glance

### The Two Alert Types

```
┌─────────────────────────────────────────────────────────────┐
│                      ALERT TYPE COMPARISON                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🚨 CRITICAL ALERT              ⚡ MINIMAL ALERT            │
│  ══════════════════              ════════════════           │
│                                                               │
│  Trigger:  Stock = 0             Stock < Threshold          │
│  Color:    🔴 RED                 🟠 ORANGE                 │
│  Icon:     ⚠️ (in red)            📉 (in orange)            │
│  Animation: Pulsing              Bouncing                   │
│  Duration:  6 seconds            4 seconds                  │
│  Severity:  HIGH/URGENT          MEDIUM/SOON               │
│                                                               │
│  ┌──────────────────────────┐   ┌──────────────────────────┐ │
│  │ 🚨 CRITICAL WARNING  ✕  │   │ ⚡ MINIMAL ALERT     ✕  │ │
│  │                          │   │                          │ │
│  │ ⚠️ CRITICAL:             │   │ ⚠️ MINIMAL ALERT:        │ │
│  │ [Item] - OUT OF STOCK!   │   │ [Item] now [X]           │ │
│  │                          │   │ (threshold: [Y])         │ │
│  │ 📅 [Date] 🕐 [Time]     │   │ 📅 [Date] 🕐 [Time]     │ │
│  └──────────────────────────┘   └──────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Stock Level State Machine

```
START
  │
  ├─ Stock above threshold?
  │  └─ YES → NORMAL (No notification)
  │
  └─ Stock at/below threshold?
     ├─ Stock = 0?
     │  └─ YES → 🚨 CRITICAL (Red notification, 6 sec)
     │
     └─ Stock > 0 & < Threshold?
        └─ YES → ⚡ MINIMAL (Orange notification, 4 sec)

From any state, if stock goes UP above threshold:
  └─ NO NOTIFICATION (but log ✅ recovery)
```

---

## Quick Test Scenarios

```
┌─────────────────────────────────────────────────────────────┐
│                    TEST #1: CRITICAL ALERT                   │
├─────────────────────────────────────────────────────────────┤
│ Location:  Manager → Inventory → General Tab                 │
│ Action:    Click EDIT → Set Packs to 0 → Save               │
│ Expected:  🔴 RED notification appears                       │
│            6 seconds duration                                │
│            Message: "CRITICAL: [Item] - OUT OF STOCK!"       │
│ Console:   Look for: 🚨 CRITICAL ALERT logs                 │
│ Status:    ✅ PASS if you see red alert with timestamp       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TEST #2: MINIMAL ALERT                    │
├─────────────────────────────────────────────────────────────┤
│ Location:  Manager → Inventory → General Tab                 │
│ Action:    Click EDIT → Set Packs < Alert At value → Save   │
│ Expected:  🟠 ORANGE notification appears                    │
│            4 seconds duration                                │
│            Message: "MINIMAL ALERT: [Item] now [X]..."       │
│ Console:   Look for: 📉 MINIMAL ALERT logs                  │
│ Status:    ✅ PASS if you see orange alert with timestamp    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  TEST #3: NO ALERT SCENARIO                  │
├─────────────────────────────────────────────────────────────┤
│ Location:  Manager → Inventory → General Tab                 │
│ Action:    Click EDIT → Set Packs > Alert At value → Save   │
│ Expected:  ❌NO notification appears                         │
│            Console shows evaluation logs only                │
│ Console:   Look for: 🔍 [Alert Evaluation] (no alert)       │
│ Status:    ✅ PASS if no toast appears                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Console Log Reference

```
What You'll See in DevTools Console (F12):

📝 = Item editing/creation started
├─ Shows: name, old stock, new stock, threshold

🔍 = System evaluating if alert needed
├─ Shows: Stock values being compared

🚨 = CRITICAL alert triggered (Out of stock)
📉 = MINIMAL alert triggered (Low stock)
├─ Shows severity and item affected

🔄 = Stock level changed
├─ Shows: previous value → new value

✅ = Stock recovered above threshold
├─ Shows: Item name (no popup, console only)

⚙️ = Alert threshold was modified
├─ Shows: old threshold → new threshold

📢 = Notification being dispatched to UI
├─ Shows: All notification details

🔔 = Toast notification received by component
├─ Shows: Toast displayed with timestamp
```

---

## Timestamp Format Reference

```
Displayed Format:
────────────────
📅 YYYY-MM-DD     (Example: 2026-03-04)
🕐 HH:MM:SS       (Example: 14:30:45)

In Code:
───────
timestamp: Date object               (Full timestamp)
date: "2026-03-04"                   (Just date)
time: "14:30:45"                     (Just time)

In History:
──────────
Full ISO format: "2026-03-04T14:30:45.123Z"
```

---

## Alert Notification Anatomy

```
┌────────────────────────────────────────────┐
│ [COLOR ICON] 🚨 CATEGORY NAME        [✕]  │
│                                            │
│ [EMOJI] MESSAGE TEXT WITH DETAILS          │
│                                            │
│ 📅 DATE  🕐 TIME                          │
└────────────────────────────────────────────┘

CRITICAL Example:
─────────────────
┌────────────────────────────────────────────┐
│ [RED ⚠️] 🚨 CRITICAL WARNING          [✕]  │
│                                            │
│ ⚠️ CRITICAL: Coffee Beans is OUT OF STOCK! │
│                                            │
│ 📅 2026-03-04  🕐 14:30:45                │
└────────────────────────────────────────────┘
(Red background, pulsing animation)

MINIMAL Example:
────────────────
┌────────────────────────────────────────────┐
│ [ORANGE 📉] ⚡ MINIMAL ALERT          [✕]  │
│                                            │
│ ⚠️ MINIMAL ALERT: Milk stock now 3         │
│    (threshold: 5)                          │
│                                            │
│ 📅 2026-03-04  🕐 14:30:45                │
└────────────────────────────────────────────┘
(Orange background, bouncing animation)
```

---

## System Flow Diagram

```
                    USER ACTION
                        │
                        ↓
            ┌──────────────────────┐
            │  Edit Inventory Item │
            │  Change stock value  │
            └──────────────────────┘
                        │
                        ↓
            ┌──────────────────────┐
            │ handleSaveEditItem() │  (in Inventory.jsx)
            │ Store: oldStock      │
            │ Get: newStock        │
            └──────────────────────┘
                        │
                        ↓
                 oldStock ≠ newStock?
                   /                \
                YES                NO
                 │                   │
                 ↓                   ↓
        ┌──────────────┐        No evaluation
        │   Evaluate   │        Log will show
        │  Alert Type  │        stock unchanged
        └──────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ↓                 ↓
    Stock = 0?       Stock < Threshold?
      / \              /    \
    YES NO           YES    NO
     │   │            │      │
     ↓   ↓            ↓      ↓
    🚨  ⚡           ⚡     ✅
    CR  MI           MI    EN
              ↓
        ┌──────────────────┐
        │ showNotification │
        └──────────────────┘
              │
              ↓
    ┌──────────────────────┐
    │ window.dispatchEvent │
    │  ('SHOW_TOAST')      │
    └──────────────────────┘
              │
              ↓
    ┌──────────────────────┐
    │ NotificationToast.jsx│
    │ Receive & Render     │
    └──────────────────────┘
              │
              ├─ CRITICAL → Red + Pulse + 6s
              └─ MINIMAL → Orange + Bounce + 4s
```

---

## Keyboard Shortcuts & Tips

```
To Open Developer Console:
  Windows/Linux: F12 or Ctrl+Shift+I
  Mac:           Cmd+Option+I

In Console, to find notification logs:
  Type: SHOW_TOAST
  Filters all related logs

Filter console by:
  🚨 CRITICAL logs
  📉 MINIMAL logs
  🔍 Evaluation logs
  📢 Dispatch logs
  🔔 Toast received
```

---

## Color Scheme Reference

```
CRITICAL Alert Colors:
  Background:    rgb(254, 226, 226)    #FEE2E2    bg-red-100
  Text:          rgb(127, 29, 29)      #7F1D1D    text-red-900
  Icon BG:       rgb(220, 38, 38)      #DC2626    bg-red-600
  Border:        rgb(248, 113, 113)    #F87171    border-red-400

MINIMAL Alert Colors:
  Background:    rgb(254, 243, 199)    #FEF3C7    bg-amber-100
  Text:          rgb(120, 53, 15)      #78350F    text-amber-900
  Icon BG:       rgb(217, 119, 6)      #D97706    bg-amber-600
  Border:        rgb(251, 191, 36)     #FBBF24    border-amber-400

Standard/INFO Colors:
  Background:    rgb(219, 234, 254)    #DBEAFE    bg-blue-100
  Text:          rgb(30, 58, 138)      #1E3A8A    text-blue-900
  Icon BG:       rgb(37, 99, 235)      #2563EB    bg-blue-600
  Border:        rgb(96, 165, 250)     #60A5FA    border-blue-400
```

---

## Animation Reference

```
CRITICAL Alert Animation:
  animate-pulse
  └─ Fades in/out continuously
     Creates blinking effect
     Draws attention immediately
     Suggests urgency

MINIMAL Alert Animation:
  animate-bounce
  └─ Bounces up and down
     Movement but less urgent
     Gets attention without fear
     Professional appearance

No animation:
  Static display for standard info
```

---

## File Reference Quick Link

```
Component:  src/components/NotificationToast.jsx
Service:    src/services/notificationService.js
Logic:      src/pages/manager/Inventory.jsx

Check Notification Flow:
  1. Edit item in Inventory.jsx
  2. Calls showNotification() from notificationService.js
  3. Renders in NotificationToast.jsx
  4. Auto-closes after set duration
```

---

## Emoji Legend

```
📝 = Writing/Creating
🔍 = Searching/Evaluating
🚨 = Critical/Urgent/Danger
📉 = Declining/Low
🔄 = Change/Update/Flow
✅ = Success/Recovery/Good
⚙️ = Settings/Configuration
📢 = Broadcasting/Sending
🔔 = Notification/Alert/Ringing
🎨 = Visual/Style/Color
💬 = Message/Speaking
⚠️ = Warning/Caution
🕐 = Time/Clock
📅 = Date/Calendar
```

---

## Decision Tree for Developers

```
Alert NOT showing?
  ├─ Check: Is stock value actually changing?
  │  └─ If no change, no alert (by design)
  │
  ├─ Check: Is NotificationToast in Layout.jsx?
  │  └─ It should be imported and rendered
  │
  ├─ Check: Does item have lowStockThreshold set?
  │  └─ Default is 5, can be customized
  │
  └─ Check: Open F12 console for logs
     └─ Look for 🔍 or 📢 logs

Alert showing but...
  ├─ Wrong type?
  │  └─ Check alert condition logic
  │
  ├─ Wrong color?
  │  └─ Check isCritical/isMinimal logic
  │
  ├─ Wrong duration?
  │  └─ Check duration if condition (6s vs 4s)
  │
  └─ Timestamp wrong?
     └─ Check system clock
```

---

## One-Page Cheat Sheet

| Component | What | Where |
|-----------|------|-------|
| **When to Use** | Stock changes cross threshold | Item edit/create |
| **Critical Trigger** | Stock = 0 | Immediate |
| **Minimal Trigger** | Stock < threshold | Immediate |
| **Critical Display** | Red, pulsing, 6 sec | Bottom-right |
| **Minimal Display** | Orange, bouncing, 4 sec | Bottom-right |
| **Console Prefix** | 🚨 or 📉 | F12 → Console |
| **Timestamp Format** | YYYY-MM-DD HH:MM:SS | On toast |
| **Manual Close** | Click ✕ button | Anytime |
| **History Log** | Full description | Admin → History |

---

## Quick Troubleshooting

```
Problem: No notification appears
Solution: Check console (F12) for logs
         - If logs appear: Notification triggered
         - If no logs: Stock didn't actually change

Problem: Wrong color notification
Solution: Check evaluated stock value
         - Red (CRITICAL): Stock should be 0
         - Orange (MINIMAL): Stock should be < threshold

Problem: Notification disappears too fast
Solution: Times are by design
         - 6s for CRITICAL (more time)
         - 4s for MINIMAL (standard)
         - Click ✕ to close manually

Problem: Timestamp is wrong
Solution: Check system clock
         - Notifications use system time
         - Format is always HH:MM:SS
```

---

**Keep this guide handy while testing! 📋**
