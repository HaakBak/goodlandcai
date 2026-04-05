# Drink Sizes Feature Implementation

## Overview
This document describes the implementation of optional drink sizes (Small, Medium, Large) for beverages in the POS system with a flip-card hover animation and integration across the POS and POSM interfaces.

## Changes Made

### 1. Database Schema Updates (`src/services/mockDatabase.js`)

All beverages in `INITIAL_MENU` now include:
- **hasSizes**: Boolean flag to enable/disable size selection for drinks
- **sizes**: Object containing size configurations with basePrice, VAT_fee, and totalPrice

**Updated Beverages with Sizes:**
- Espresso (id: 1)
- Double Espresso (id: 2)
- Cappuccino (id: 3)
- Mocha (id: 4)
- Iced Coffee (id: 5)

**Size Configuration Example:**
```javascript
sizes: {
  Small: { basePrice: 75, VAT_fee: 9, totalPrice: 84 },
  Medium: { basePrice: 85, VAT_fee: 10.2, totalPrice: 95.2 },
  Large: { basePrice: 100, VAT_fee: 12, totalPrice: 112 }
}
```

### 2. POS Page Updates (`src/pages/employee/POS.jsx`)

#### State Management
- Added `hoveredItemId` state to track which menu item is being hovered for flip-card animation
- Existing cart state already supports size tracking via `selectedSize` property

#### Function Updates

**removeFromCart()** - Now properly handles items with different sizes:
```javascript
const removeFromCart = (itemId, selectedSize = null) => {
  setCart(prev => prev.filter(i => !(i.menuItem.id === itemId && i.selectedSize === selectedSize)));
};
```

**updateQuantity()** - Updated to track size dimension:
```javascript
const updateQuantity = (itemId, delta, selectedSize = null) => {
  // Now respects both itemId and selectedSize when updating quantities
};
```

#### Menu Grid Implementation
- **Removed** the duplicate/broken grid sections
- **Implemented** a single, unified menu grid with proper flip-card animation
- **Grid Features:**
  - Uses CSS 3D transforms (`transformStyle: 'preserve-3d'`, `transform: 'rotateY'`)
  - Smooth 500ms transition for flip animation
  - Front card displays: item name, price, "Hover for sizes" hint (if applicable)
  - Back card (for sized items): product name + size buttons with prices
  - Non-sized items: clickable to add directly to cart
  - Sized items: click size button on hover to add with selected size

#### Cart Display Updates
- Shows selected size for each cart item below the item name
- Each cart item tracked by unique key: `${itemId}-${selectedSize || 'default'}`
- Size information passed to quantity update and remove functions

### 3. POSM Manager Updates (`src/pages/manager/POSM.jsx`)

The POSM already had complete functionality for managing drink sizes. Features:

#### Drink Size Management (Beverages only)
- **Enable Drink Sizes checkbox**: Appears only for beverages (category === 'Beverages')
- **Auto-calculation**: When enabled, calculates suggested prices for S/M/L:
  - Small: 80% of base price
  - Medium: 100% of base price
  - Large: 120% of base price
- **Manual adjustment**: Manager can override calculated prices
- **VAT calculation**: Automatic 12% VAT calculation for each size
- **Visual indicator**: "MULTI-SIZE" badge on items with sizes enabled

#### Size Configuration
For each size (Small, Medium, Large), the system stores:
- Base price (in Philippine Peso)
- VAT fee (automatically calculated at 12%)
- Total price (base + VAT)

#### Update Flow
1. Manager edits a beverage in POSM
2. Checks "Enable Drink Sizes" checkbox
3. Adjusts individual size prices as needed
4. Saves changes
5. Changes immediately reflected in POS interface

## How It Works

### Employee Side (POS)
1. Employee navigates to POS menu
2. Sees beverages with optional sizes
3. **To add item with sizes:**
   - Hovers over drink (card flips with animation)
   - Sees Small, Medium, Large buttons with prices
   - Clicks preferred size button
   - Item added to cart with selected size
4. **To add item without sizes:**
   - Clicks item directly
   - Item added to cart
5. Cart displays selected size below item name
6. Can adjust quantities, delete, or checkout

### Manager Side (POSM)
1. Manager navigates to "Beverages" category
2. Clicks "EDIT" on a beverage
3. Checks "Enable Drink Sizes" checkbox
4. Configures prices for Small, Medium, Large
5. Saves changes
6. Changes sync to POS interface in real-time

## Database Persistence

All changes are persisted via localStorage:
- Menu configurations saved to `pos_menu` key
- Size data stored in `sizes` object within each menu item
- Transaction records now include `selectedSize` for each cart item
- Size information maintained through order confirmation and receipt generation

## File Structure

```
src/
├── services/
│   └── mockDatabase.js          (Schema with sizes)
├── pages/
│   ├── employee/
│   │   └── POS.jsx              (Flip-card UI, size selection)
│   └── manager/
│       └── POSM.jsx             (Size management UI - already implemented)
```

## Testing Checklist

- [ ] Load POS page - all beverages with sizes display correctly
- [ ] Hover over beverage - card flips smoothly
- [ ] Click size button - item added to cart with correct size and price
- [ ] Cart shows size information for each item
- [ ] Adjust quantities - works correctly per size variant
- [ ] Delete item - removes only that size variant
- [ ] Checkout displays correct pricing with size info
- [ ] POSM - enable/disable sizes for beverages
- [ ] POSM - adjust size prices - changes reflect in POS
- [ ] Add new beverage - can enable sizes during creation
- [ ] LocalStorage persistence - changes survive page refresh

## API/Function Reference

### public Types and Interfaces

**MenuItem with Sizes:**
```javascript
{
  id: string,
  name: string,
  basePrice: number,
  VAT_fee: number,
  totalPrice: number,
  category: string,
  hasSizes: boolean,
  sizes?: {
    Small: { basePrice, VAT_fee, totalPrice },
    Medium: { basePrice, VAT_fee, totalPrice },
    Large: { basePrice, VAT_fee, totalPrice }
  }
}
```

**Cart Item with Size:**
```javascript
{
  menuItem: MenuItem,
  quantity: number,
  selectedSize?: string ('Small' | 'Medium' | 'Large' | null)
}
```

## Future Enhancements

1. Add more size options (Extra-Large, etc.)
2. Custom size pricing per location
3. Size analytics in dashboard
4. Nutritional information per size
5. Size-specific modifiers (extra shots, milk options for coffee)
6. Size-based inventory tracking
