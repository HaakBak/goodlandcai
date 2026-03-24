/**
 * Notification Service
 * Handles inventory alert notifications with categorization and timestamp tracking
 *
 * Notification Types:
 * - MINIMAL: Item stock level has dropped to/below the alert threshold
 * - CRITICAL: Item stock has reached 0 (out of stock)
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
