import { addNotification, getNotifications } from './mockDatabase';

const recentNotificationKeys = new Set();
const buildNotificationKey = (note) => `${note.message}|${note.category}|${note.itemName}|${note.date}`;

/**
 * Notification Service
 * Handles inventory alert notifications with categorization and timestamp tracking
 *
 * Notification Types:
 * - MINIMAL: Item stock level has dropped to/below the alert threshold
 * - CRITICAL: Item stock has reached 0 (out of stock)
 * - EXPIRATION: Item has reached or exceeded expiration date
 */

/**
 * Create and dispatch a notification through the SHOW_TOAST event
 * @param {Object} notificationData - The notification data
 * @param {string} notificationData.message - The notification message
 * @param {string} notificationData.type - 'minimal' or 'warning' (used for styling)
 * @param {string} notificationData.category - Alert category: 'MINIMAL' or 'CRITICAL'
 * @param {string} notificationData.itemName - Name of the inventory item
 * @param {number} notificationData.currentStock - Current stock level
 * @param {number} notificationData.threshold - Alert threshold value (if applicable)
 * @param {Date} notificationData.timestamp - Timestamp when alert occurred
 */
export const showNotification = (notificationData) => {
  // Get current date and time
  const now = new Date();

  // Create the notification with full details
  const notification = {
    ...notificationData,
    timestamp: notificationData.timestamp || now,
    date: (notificationData.timestamp || now).toISOString().split('T')[0],
    time: (notificationData.timestamp || now).toTimeString().split(' ')[0],
    id: crypto.randomUUID(),
  };

  const notificationKey = buildNotificationKey(notification);
  if (recentNotificationKeys.has(notificationKey)) {
    console.log('🟡 [Notification Skipped] duplicate toast detected');
    return notification;
  }
  recentNotificationKeys.add(notificationKey);

  // Dispatch custom event that NotificationToast component is listening for
  const event = new CustomEvent('SHOW_TOAST', { detail: notification });
  window.dispatchEvent(event);

  console.log('📢 [Notification Dispatched]', {
    category: notification.category,
    item: notification.itemName,
    stock: notification.currentStock,
    threshold: notification.threshold,
    time: notification.time,
    date: notification.date,
  });

  const persistNotification = async () => {
    try {
      const existingNotifications = await getNotifications();
      const duplicate = existingNotifications.some((note) => buildNotificationKey(note) === notificationKey);
      if (duplicate) {
        console.log('🟡 [Notification Skipped] duplicate detected, not persisting');
        return;
      }
      await addNotification(notification);
    } catch (error) {
      console.error('[Notification] Failed to persist notification:', error);
    }
  };

  persistNotification();

  return notification;
};

/**
 * Evaluate inventory item and create appropriate notification if needed
 * This function compares old and new stock levels to determine which alert to trigger
 *
 * @param {Object} item - The inventory item to evaluate
 * @param {number} oldStock - The previous stock level
 * @param {string} itemName - Name of the item
 * @returns {Object|null} - The notification object if one was created, null otherwise
 */
export const evaluateInventoryAlert = (item, oldStock, itemName) => {
  let notification = null;

  // DEBUG: Log the evaluation process
  console.log('🔍 [Alert Evaluation]', {
    item: itemName,
    oldStock,
    newStock: item.inStock,
    threshold: item.lowStockThreshold,
  });

  // CRITICAL: Check if stock reached 0 (out of stock)
  if (item.inStock === 0 && oldStock > 0) {
    notification = showNotification({
      message: `⚠️ CRITICAL: "${itemName}" is OUT OF STOCK!`,
      type: 'warning',
      category: 'CRITICAL',
      itemName,
      currentStock: 0,
      severity: 'high',
    });

    console.log('🚨 CRITICAL ALERT - Item out of stock:', itemName);
    return notification;
  }

  // MINIMAL: Check if stock fell below or reached threshold (but not zero)
  if (
    item.inStock > 0 &&
    item.inStock <= item.lowStockThreshold &&
    oldStock > item.lowStockThreshold
  ) {
    notification = showNotification({
      message: `⚠️ MINIMAL ALERT: "${itemName}" stock is now ${item.inStock} (threshold: ${item.lowStockThreshold})`,
      type: 'minimal',
      category: 'MINIMAL',
      itemName,
      currentStock: item.inStock,
      threshold: item.lowStockThreshold,
      severity: 'medium',
    });

    console.log('📉 MINIMAL ALERT - Low stock:', itemName, `(${item.inStock}/${item.lowStockThreshold})`);
    return notification;
  }

  // RECOVERY: Check if stock recovered from below threshold
  if (
    item.inStock > item.lowStockThreshold &&
    oldStock <= item.lowStockThreshold
  ) {
    console.log('✅ Stock recovered for:', itemName);
  }

  return null;
};

/**
 * Check if an inventory item has expired
 * @param {Object} item - The inventory item with expirationDate field
 * @returns {boolean} - true if item has expired (today or before), false otherwise
 */
export const isItemExpired = (item) => {
  if (!item.expirationDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for date-only comparison
  
  const expirationDate = new Date(item.expirationDate + 'T00:00:00'); // Parse date string
  
  return expirationDate < today || expirationDate.getTime() === today.getTime();
};

/**
 * Check if an inventory item is expiring soon (within X days)
 * @param {Object} item - The inventory item with expirationDate field
 * @param {number} daysThreshold - Number of days until expiration to trigger alert (default: 3)
 * @returns {boolean} - true if item will expire within threshold, false otherwise
 */
export const isItemExpiringsoon = (item, daysThreshold = 3) => {
  if (!item.expirationDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expirationDate = new Date(item.expirationDate + 'T00:00:00');
  const daysUntilExpiration = Math.floor((expirationDate - today) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiration >= 0 && daysUntilExpiration <= daysThreshold;
};

/**
 * Create expiration notification for items that have expired
 * @param {Object} item - The inventory item to check
 * @returns {Object|null} - The notification object if one was created, null otherwise
 */
export const checkItemExpiration = (item) => {
  if (!item || !item.expirationDate) return null;

  // DEBUG: Log expiration check
  const today = new Date().toISOString().split('T')[0];
  console.log('📅 [Expiration Check]', {
    item: item.name,
    expirationDate: item.expirationDate,
    today,
    isExpired: isItemExpired(item),
  });

  // CHECK: If item has expired
  if (isItemExpired(item)) {
    const notification = showNotification({
      message: `🚨 EXPIRED: "${item.name}" has expired as of ${item.expirationDate}`,
      type: 'warning',
      category: 'EXPIRATION',
      itemName: item.name,
      expirationDate: item.expirationDate,
      severity: 'critical',
    });

    console.log('⏰ EXPIRATION ALERT - Item expired:', item.name, `(${item.expirationDate})`);
    return notification;
  }

  return null;
};

/**
 * Check expiration status for all inventory items and create notifications for expired items
 * Typically run periodically (e.g., when manager opens inventory page)
 * @param {Array} inventoryItems - Array of inventory items to check
 * @returns {Array} - Array of notifications created
 */
export const checkAllExpirations = (inventoryItems) => {
  if (!Array.isArray(inventoryItems)) {
    console.warn('[Notification] checkAllExpirations received non-array input');
    return [];
  }

  const notifications = [];
  const expiredItems = [];

  inventoryItems.forEach(item => {
    if (item.type === 'Perishable' && item.expirationDate) {
      const notification = checkItemExpiration(item);
      if (notification) {
        notifications.push(notification);
        expiredItems.push(item.name);
      }
    }
  });

  if (expiredItems.length > 0) {
    console.log('📦 [Expiration Summary]', {
      totalExpired: expiredItems.length,
      items: expiredItems,
    });
  }

  return notifications;
};
