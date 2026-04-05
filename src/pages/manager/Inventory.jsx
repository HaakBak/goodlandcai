import React, { useState, useEffect } from 'react';
import {
  getInventory,
  getSuppliers,
  saveSuppliers,
  getMenu,
  getRecipes,
  saveRecipe,
  addInventoryItem,
  updateInventoryItem,
  getUsageLogs,
  addHistoryLog,
  addUsageLog,
} from '../../services/mockDatabase';
import { showNotification, evaluateInventoryAlert, checkAllExpirations } from '../../services/notificationService';

// Helper function to get current user and role from session
const getCurrentUserInfo = () => {
  const username = sessionStorage.getItem('username') || 'Unknown';
  const userRole = sessionStorage.getItem('userRole') || 'Unknown';
  return { username, userRole };
};

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState('Inventory');
  const [inventorySubTab, setInventorySubTab] = useState('General');

  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [menu, setMenu] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [usageLogs, setUsageLogs] = useState([]);
  const [menuRecipeWarnings, setMenuRecipeWarnings] = useState([]);
  const [hasLoggedMissingRecipeWarning, setHasLoggedMissingRecipeWarning] = useState(false);

  const [search, setSearch] = useState('');
  // ✏️ EDIT: Button UI with separate sortType and sortDirection for clean interface
  const [sortType, setSortType] = useState('Quantity');
  const [sortDirection, setSortDirection] = useState('descending');

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [currentSupplier, setCurrentSupplier] = useState(null);
  const [showSupplierItemsModal, setShowSupplierItemsModal] = useState(false);
  const [selectedItemForSupplier, setSelectedItemForSupplier] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState('');

  const [addItemData, setAddItemData] = useState({
    name: '',
    stock: '',
    cost: '',
    type: 'Perishable',
    measurementUnit: 'g',
    measurementQty: '1000',
    lowStockThreshold: '5',
    expirationDate: '',
  });

  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    stock: '',
    cost: '',
    type: '',
    measurementUnit: '',
    measurementQty: '',
    openStock: '',
    lowStockThreshold: '',
    expirationDate: '',
  });

  const [selectedCategory, setSelectedCategory] = useState('Beverages');
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [currentRecipe, setCurrentRecipe] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');

  // PHASE 2.3 FIX: Add state for loading and error tracking
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(null);

  // PHASE 2.3 FIX: Helper to add timeout protection (30 second max per request)
  const fetchWithTimeout = (promise, timeoutMs = 30000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout - took longer than 30 seconds')), timeoutMs)
      ),
    ]);
  };

  // PHASE 2.3 FIX: Helper for retry logic with exponential backoff (500ms, 1s, 2s)
  const fetchWithRetry = async (fn, maxRetries = 3, backoffMs = 500) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchWithTimeout(fn(), 30000);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt - 1);
          console.log(`[Inventory] Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms for:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  };

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setIsLoadingData(true);
    setDataLoadError(null);

    try {
      // PHASE 2.3 FIX: Use Promise.allSettled instead of Promise.all
      // This allows us to handle both successes and failures gracefully
      const results = await Promise.allSettled([
        fetchWithRetry(() => getInventory()),
        fetchWithRetry(() => getSuppliers()),
        fetchWithRetry(() => getMenu()),
        fetchWithRetry(() => getRecipes()),
        fetchWithRetry(() => getUsageLogs()),
      ]);

      // PHASE 2.3 FIX: Process results with fallback values
      const invData = results[0].status === 'fulfilled' ? results[0].value : [];
      const supData = results[1].status === 'fulfilled' ? results[1].value : [];
      const menuData = results[2].status === 'fulfilled' ? results[2].value : [];
      const recipeData = results[3].status === 'fulfilled' ? results[3].value : {};
      const logData = results[4].status === 'fulfilled' ? results[4].value : [];

      // PHASE 2.3 FIX: Log any failures for debugging
      const failures = [
        { name: 'Inventory', status: results[0].status, error: results[0].reason },
        { name: 'Suppliers', status: results[1].status, error: results[1].reason },
        { name: 'Menu', status: results[2].status, error: results[2].reason },
        { name: 'Recipes', status: results[3].status, error: results[3].reason },
        { name: 'Usage Logs', status: results[4].status, error: results[4].reason },
      ].filter(r => r.status === 'rejected');

      if (failures.length > 0) {
        console.error('[Inventory] Data load failures:');
        failures.forEach(f => console.error(`  - ${f.name}: ${f.error?.message || 'Unknown error'}`));
        
        // PHASE 2.3 FIX: Show user-friendly error notification
        const failedNames = failures.map(f => f.name).join(', ');
        showNotification({
          message: `⚠️ Failed to load: ${failedNames}. Using cached data.`,
          type: 'warning',
          category: 'DATA_LOAD_ERROR',
          itemName: 'Data Load',
          severity: 'medium',
        });
        setDataLoadError(`${failures.length} data source(s) failed`);
      }

      // Update state with loaded or fallback data
      setInventory(invData);
      setSuppliers(supData);
      setMenu(menuData);
      setRecipes(recipeData);
      setUsageLogs(logData);

      const missingRecipeItems = menuData.filter((menuItem) => {
        const recipeRow = recipeData[menuItem.id];
        return !recipeRow || !Array.isArray(recipeRow.ingredients) || recipeRow.ingredients.length === 0;
      });
      setMenuRecipeWarnings(missingRecipeItems);

      if (missingRecipeItems.length > 0 && !hasLoggedMissingRecipeWarning) {
        const warningMessage = `⚠️ ${missingRecipeItems.length} menu item${missingRecipeItems.length === 1 ? '' : 's'} are missing recipes. Add recipes to ensure inventory forecasting.`;
        showNotification({
          message: warningMessage,
          type: 'warning',
          category: 'MISSING_RECIPE',
          itemName: 'Menu Recipe Check',
          severity: 'medium',
        });

        try {
          const now = new Date();
          const { username, userRole } = getCurrentUserInfo();
          await addHistoryLog({
            type: 'Missing Recipe Warning',
            description: `Missing recipes for menu item${missingRecipeItems.length === 1 ? '' : 's'}: ${missingRecipeItems.map(item => item.name).join(', ')}`,
            user_name: username,
            user: username,
            role: userRole,
            timestamp: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
          });
          setHasLoggedMissingRecipeWarning(true);
        } catch (error) {
          console.error('[Inventory] Failed to log missing recipe warning:', error);
        }
      }

      // Check expiration dates for all perishable items
      try {
        const expiredNotifications = checkAllExpirations(invData);
        if (expiredNotifications.length > 0) {
          console.log(`⏰ [Inventory Page] Found ${expiredNotifications.length} expired items`);
        }
      } catch (error) {
        console.error('[Inventory] Error checking expirations:', error);
      }
    } catch (error) {
      // PHASE 2.3 FIX: Catch-all error handler
      console.error('[Inventory] Unexpected error during data refresh:', error);
      setDataLoadError('Failed to load inventory data');
      showNotification({
        message: '❌ Error loading inventory data. Please try refreshing the page.',
        type: 'error',
        category: 'CRITICAL_ERROR',
        itemName: 'Inventory Load',
        severity: 'high',
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // ✏️ EDIT: Unified sort handler - toggles direction or switches type
  const handleSortChange = (newSortType) => {
    const isSameSort = newSortType === sortType;
    
    if (isSameSort) {
      // ✏️ EDIT: Toggle direction if clicking same button
      const toggledDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';
      setSortDirection(toggledDirection);
    } else {
      // ✏️ EDIT: Switch to new type and reset to descending
      setSortType(newSortType);
      setSortDirection('descending');
    }
  };

  // ✏️ EDIT: Convert UI state to original sortOrder values for backward compatibility
  const getSortOrderValue = () => {
    if (sortType === 'Quantity') {
      return sortDirection === 'ascending' ? 'least' : 'most';
    } else if (sortType === 'Date') {
      return sortDirection === 'ascending' ? 'oldest' : 'newest';
    }
    return null;
  };

  const sortOrder = getSortOrderValue();

  const handleAddSupplier = async () => {
    if (!supplierEmail.includes('@') || !supplierEmail.endsWith('.com')) {
      alert('Needs to be a valid email');
      setSupplierEmail('');
      return;
    }
    // Validate phone - only numbers allowed
    if (!/^\d+$/.test(supplierPhone.replace(/[^0-9]/g, ''))) {
      alert('Phone number must contain only numbers');
      return;
    }

    let updated;
    if (currentSupplier) {
      // Edit existing supplier
      updated = suppliers.map(sup =>
        sup.id === currentSupplier.id
          ? { ...sup, name: supplierName, email: supplierEmail, phone: supplierPhone, address: supplierAddress }
          : sup
      );
    } else {
      // Create new supplier
      const newSupplier = { id: crypto.randomUUID(), name: supplierName, email: supplierEmail, phone: supplierPhone, address: supplierAddress, items: [] };
      updated = [...suppliers, newSupplier];
    }

    await saveSuppliers(updated);
    setSuppliers(updated);
    setShowSupplierModal(false);
    setCurrentSupplier(null);
    setSupplierName('');
    setSupplierEmail('');
    setSupplierPhone('');
    setSupplierAddress('');
  };

  const handleDeleteSupplier = async (supplierId) => {
    if (window.confirm('Are you sure you want to delete this supplier? Items assigned to this supplier will not be deleted.')) {
      const updated = suppliers.filter(sup => sup.id !== supplierId);
      await saveSuppliers(updated);
      setSuppliers(updated);
      setCurrentSupplier(null);
    }
  };

  const handleAddItemToSupplier = async () => {
    if (!selectedItemForSupplier || !currentSupplier) return;
    
    // Check if item is already assigned to another supplier
    const itemAlreadyAssigned = suppliers.some(
      sup => sup.id !== currentSupplier.id && sup.items?.includes(selectedItemForSupplier)
    );
    
    if (itemAlreadyAssigned) {
      setNotificationMessage('This item is already assigned to another supplier');
      setTimeout(() => setNotificationMessage(''), 2000);
      return;
    }
    
    // Check if already in current supplier's items
    if (currentSupplier.items?.includes(selectedItemForSupplier)) {
      setNotificationMessage('This item is already assigned to this supplier');
      setTimeout(() => setNotificationMessage(''), 2000);
      return;
    }
    
    const updatedSuppliers = suppliers.map(sup => 
      sup.id === currentSupplier.id 
        ? { ...sup, items: [...(sup.items || []), selectedItemForSupplier] }
        : sup
    );
    
    await saveSuppliers(updatedSuppliers);
    setSuppliers(updatedSuppliers);
    setCurrentSupplier(updatedSuppliers.find(s => s.id === currentSupplier.id));
    setSelectedItemForSupplier(null);
  };

  const handleRemoveItemFromSupplier = async (itemId) => {
    if (!currentSupplier) return;
    
    const updatedSuppliers = suppliers.map(sup => 
      sup.id === currentSupplier.id 
        ? { ...sup, items: sup.items.filter(id => id !== itemId) }
        : sup
    );
    
    await saveSuppliers(updatedSuppliers);
    setSuppliers(updatedSuppliers);
    setCurrentSupplier(updatedSuppliers.find(s => s.id === currentSupplier.id));
  };

  const handleAddItemChange = (e) => {
    const { name, value } = e.target;
    setAddItemData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveNewItem = async () => {
    if (!addItemData.name || !addItemData.stock || !addItemData.cost) {
      alert('Please fill in all fields.');
      return;
    }

    // For perishable items, check if expiration date is provided
    if (addItemData.type === 'Perishable' && !addItemData.expirationDate) {
      alert('Please provide an expiration date for perishable items.');
      return;
    }

    const newItem = {
      name: addItemData.name,
      inStock: parseInt(addItemData.stock, 10),
      cost: parseFloat(addItemData.cost),
      type: addItemData.type,
      measurementUnit: addItemData.measurementUnit,
      measurementQty: parseInt(addItemData.measurementQty, 10) || 1,
      openStock: 0,
      lowStockThreshold: parseInt(addItemData.lowStockThreshold, 10) || 5,
      // Add expiration_date for perishable items only
      expirationDate: addItemData.type === 'Perishable' ? addItemData.expirationDate : null,
    };

    // DEBUG: Log the new item creation
    console.log('📝 [Adding New Inventory Item]', {
      name: newItem.name,
      stock: newItem.inStock,
      threshold: newItem.lowStockThreshold,
      type: newItem.type,
      expirationDate: newItem.expirationDate || 'N/A',
    });

    await addInventoryItem(newItem);
    
    // LOG USAGE: Record new item addition to usage logs
    try {
      await addUsageLog({
        user_id: sessionStorage.getItem('userId'),
        action: 'INVENTORY_ITEM_ADDED',
        details: {
          item_id: newItem.id,
          item_name: newItem.name,
          initial_stock: newItem.inStock,
          cost: newItem.cost,
          type: newItem.type,
          measurement_unit: newItem.measurementUnit,
          measurement_qty: newItem.measurementQty,
          low_stock_threshold: newItem.lowStockThreshold,
          expiration_date: newItem.expirationDate || null,
          change_reason: 'New inventory item created'
        }
      });
      console.log('✅ [Usage Log Created for New Item]', {
        item: newItem.name,
        initialStock: newItem.inStock
      });
    } catch (err) {
      console.warn('[Inventory] Could not log new item usage:', err);
      // Continue with process even if usage log fails
    }
    
    // CHECK: Evaluate if item should trigger an alert based on initial stock
    // This handles cases where a new item is added with stock already at/below threshold
    if (newItem.inStock <= newItem.lowStockThreshold) {
      if (newItem.inStock === 0) {
        // CRITICAL: Item is created with 0 stock (out of stock)
        showNotification({
          message: `⚠️ CRITICAL: New item "${newItem.name}" was created with OUT OF STOCK status!`,
          type: 'warning',
          category: 'CRITICAL',
          itemName: newItem.name,
          currentStock: 0,
          severity: 'high',
        });
        console.log('🚨 NEW ITEM CREATED OUT OF STOCK:', newItem.name);
      } else {
        // MINIMAL: Item is created with stock below threshold
        showNotification({
          message: `⚠️ MINIMAL ALERT: New item "${newItem.name}" created with low stock ${newItem.inStock} (threshold: ${newItem.lowStockThreshold})`,
          type: 'minimal',
          category: 'MINIMAL',
          itemName: newItem.name,
          currentStock: newItem.inStock,
          threshold: newItem.lowStockThreshold,
          severity: 'medium',
        });
        console.log('📉 NEW ITEM CREATED WITH LOW STOCK:', newItem.name);
      }
    }
    
    const now = new Date();
    const { username, userRole } = getCurrentUserInfo();
    
    // Build history description with expiration date if perishable
    let historyDescription = `Added inventory item: ${addItemData.name} (Stock: ${addItemData.stock}, Cost: ${addItemData.cost}, Type: ${addItemData.type}`;
    if (addItemData.type === 'Perishable' && addItemData.expirationDate) {
      historyDescription += `, Expires: ${addItemData.expirationDate}`;
    }
    historyDescription += ')';
    
    addHistoryLog({
      type: 'Inventory Change',
      description: historyDescription,
      user_name: username,
      user: username,
      role: userRole,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });
    
    await refreshData();
    handleClearNewItem();
  };

  const handleClearNewItem = () => {
    setAddItemData({
      name: '',
      stock: '',
      cost: '',
      type: 'Perishable',
      measurementUnit: 'g',
      measurementQty: '1000',
      lowStockThreshold: '5',
      expirationDate: '',
    });
  };

  const handleSelectForEdit = (item) => {
    setEditingItem(item);
    setEditFormData({
      name: item.name || '',
      stock: (item.inStock ?? '').toString(),
      cost: (item.cost ?? '').toString(),
      type: item.type || 'Perishable',
      measurementUnit: item.measurementUnit || 'g',
      measurementQty: (item.measurementQty ?? '').toString(),
      openStock: (item.openStock ?? '').toString(),
      lowStockThreshold: (item.lowStockThreshold ?? 5).toString(),
      expirationDate: item.expirationDate || '',
    });
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEditItem = async () => {
    if (!editingItem) return;

    // For perishable items, check if expiration date is provided
    if (editFormData.type === 'Perishable' && !editFormData.expirationDate) {
      alert('Please provide an expiration date for perishable items.');
      return;
    }

    // DEBUG: Store old stock value for comparison
    const oldStock = editingItem.inStock;
    const newStock = parseInt(editFormData.stock, 10) || 0;
    const newThreshold = parseInt(editFormData.lowStockThreshold, 10) || 5;
    const oldExpirationDate = editingItem.expirationDate;
    const newExpirationDate = editFormData.type === 'Perishable' ? editFormData.expirationDate : null;

    console.log('📝 [Editing Inventory Item]', {
      name: editFormData.name,
      oldStock,
      newStock,
      newThreshold,
      type: editFormData.type,
      oldExpiration: oldExpirationDate || 'N/A',
      newExpiration: newExpirationDate || 'N/A',
      stockChanged: oldStock !== newStock,
    });

    // CREATE the updated item object with new values
    const updatedItemData = {
      name: editFormData.name,
      inStock: newStock,
      cost: parseFloat(editFormData.cost) || 0,
      type: editFormData.type,
      measurementUnit: editFormData.measurementUnit,
      measurementQty: parseInt(editFormData.measurementQty, 10) || 1,
      openStock: parseInt(editFormData.openStock, 10) || 0,
      lowStockThreshold: newThreshold,
      // Add expiration_date for perishable items only
      expirationDate: newExpirationDate,
    };

    // UPDATE the item in database
    await updateInventoryItem(editingItem.id, updatedItemData);

    // LOG USAGE: Record inventory deduction to usage logs for audit trail
    if (oldStock !== newStock) {
      try {
        const stockChange = newStock - oldStock; // Negative if reduced, positive if increased
        await addUsageLog({
          user_id: sessionStorage.getItem('userId'),
          action: 'INVENTORY_ADJUSTMENT',
          details: {
            item_id: editingItem.id,
            item_name: editFormData.name,
            old_stock: oldStock,
            new_stock: newStock,
            change: stockChange,
            change_reason: 'Manual inventory adjustment via Inventory Editor',
            measurement_unit: editFormData.measurementUnit,
            measurement_qty: editFormData.measurementQty,
          }
        });
        console.log('✅ [Usage Log Created for Stock Adjustment]', {
          item: editFormData.name,
          oldStock,
          newStock,
          change: stockChange
        });
      } catch (err) {
        console.warn('[Inventory] Could not log usage:', err);
        // Continue with update even if usage log fails
      }
    }

    // ALERT LOGIC: Evaluate if the stock change should trigger an alert notification
    if (oldStock !== newStock) {
      console.log('🔄 [Stock Level Changed]', {
        item: editFormData.name,
        from: oldStock,
        to: newStock,
      });

      // Create a temporary item object for evaluation
      const tempItem = {
        inStock: newStock,
        lowStockThreshold: newThreshold,
      };

      // Use the evaluateInventoryAlert function to determine which alert (if any) to show
      // This handles CRITICAL (0 stock) and MINIMAL (below threshold) alerts
      evaluateInventoryAlert(tempItem, oldStock, editFormData.name);
    } else {
      // Stock hasn't changed, but threshold might have
      // Log the change for debugging
      if (editingItem.lowStockThreshold !== newThreshold) {
        console.log('⚙️ [Alert Threshold Changed]', {
          item: editFormData.name,
          oldThreshold: editingItem.lowStockThreshold,
          newThreshold,
        });
      }
    }

    // LOG the change to history
    const now = new Date();
    const { username, userRole } = getCurrentUserInfo();
    
    // Build history description with changes including expiration date
    let historyDescription = `Edited inventory item: ${editFormData.name}`;
    
    // Track stock changes
    if (oldStock !== newStock) {
      historyDescription += ` (Stock: ${oldStock} → ${newStock}`;
    } else {
      historyDescription += ` (Stock: ${newStock}`;
    }
    
    // Track cost changes
    if (editingItem.cost !== parseFloat(editFormData.cost)) {
      historyDescription += `, Cost: ${editingItem.cost} → ${editFormData.cost}`;
    }
    
    // Track expiration date changes
    if ((oldExpirationDate || newExpirationDate) && oldExpirationDate !== newExpirationDate) {
      historyDescription += `, Expires: ${oldExpirationDate || 'N/A'} → ${newExpirationDate || 'N/A'}`;
    } else if (newExpirationDate) {
      historyDescription += `, Expires: ${newExpirationDate}`;
    }
    
    historyDescription += ')';
    
    addHistoryLog({
      type: 'Inventory Change',
      description: historyDescription,
      user_name: username,
      user: username,
      role: userRole,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });

    await refreshData();
    setEditingItem(null);
    setEditFormData({
      name: '',
      stock: '',
      cost: '',
      type: '',
      measurementUnit: '',
      measurementQty: '',
      openStock: '',
      lowStockThreshold: '',
      expirationDate: '',
    });
  };

  const handleOpenAutoModal = (dish) => {
    const recipeRow = recipes[dish.id];
    setSelectedDish({ ...dish, recipeId: recipeRow?.id ?? null });
    setCurrentRecipe(recipeRow?.ingredients ?? []);
    setShowAutoModal(true);
    setRecipeSearch('');
  };

  const handleAddToRecipe = (inventoryItem) => {
    if (currentRecipe.find((r) => r.inventoryId === inventoryItem.id)) return;
    const defaultQty = inventoryItem.measurementUnit === 'pcs' ? 1 : 10;

    const newItem = {
      inventoryId: inventoryItem.id,
      name: inventoryItem.name,
      quantity: defaultQty,
    };
    setCurrentRecipe([...currentRecipe, newItem]);
  };

  const handleSetRecipeQuantity = (inventoryId, value) => {
    const newQty = parseFloat(value);
    if (isNaN(newQty)) return;

    setCurrentRecipe((prev) =>
      prev.map((item) =>
        item.inventoryId === inventoryId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const handleRemoveFromRecipe = (inventoryId) => {
    setCurrentRecipe((prev) => prev.filter((item) => item.inventoryId !== inventoryId));
  };

  const handleSaveRecipe = async () => {
    if (!selectedDish) return;
    
    // ✅ Validate that recipe has ingredients
    if (!currentRecipe || currentRecipe.length === 0) {
      alert('⚠️ Recipe must have at least one ingredient before saving!');
      return;
    }
    
    // ✅ Validate all ingredients have valid inventory IDs
    const invalidIngredients = currentRecipe.filter(ing => 
      !ing.inventoryId || 
      ing.inventoryId === 'ffffffff-ffff-ffff-ffff-ffffffffffff' ||
      ing.inventoryId === '' ||
      !ing.name ||
      ing.quantity <= 0
    );
    
    if (invalidIngredients.length > 0) {
      const invalidNames = invalidIngredients.map(i => i.name || 'Unknown Ingredient').join(', ');
      alert(`⚠️ Invalid ingredients found:\n${invalidNames}\n\nPlease remove these and re-add them properly from the inventory list.`);
      return;
    }
    
    const recipePayload = {
      id: selectedDish.recipeId || undefined,
      ingredients: currentRecipe,
    };
    
    try {
      await saveRecipe(selectedDish.id, recipePayload);
      
      const now = new Date();
      const { username, userRole } = getCurrentUserInfo();
      addHistoryLog({
        type: 'Recipe Change',
        description: `${selectedDish.recipeId ? 'Updated' : 'Created'} recipe for: ${selectedDish.name} (${currentRecipe.length} ingredients)`,
        user_name: username,
        user: username,
        role: userRole,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0]
      });
      
      console.log('[Inventory] ✅ Recipe saved for:', selectedDish.name);
      await refreshData();
      setShowAutoModal(false);
      setSelectedDish(null);
      setCurrentRecipe([]);
    } catch (error) {
      console.error('[Inventory] ❌ Failed to save recipe:', error);
      alert('❌ Failed to save recipe. Please try again.');
    }
  };

  // ✏️ EDIT: Original inline sorting logic using if-else chains (retains original function)
  const filteredInventory = inventory
    .filter((i) => i && i.name && i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'most') return b.inStock - a.inStock;
      if (sortOrder === 'least') return a.inStock - b.inStock;
      // ✏️ EDIT: Sort by createdAt - date when item was added to system
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // ✏️ EDIT: Sort by createdAt - oldest items first
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });

  // ✏️ EDIT: Original inline sorting logic for kitchen inventory
  const filteredKitchenInventory = inventory
    .filter((i) => i && i.name && i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'most') return b.openStock - a.openStock;
      if (sortOrder === 'least') return a.openStock - b.openStock;
      // ✏️ EDIT: Sort by createdAt - date when item was added to system
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // ✏️ EDIT: Sort by createdAt - oldest items first
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });

  // ✏️ EDIT: Original inline sorting logic for usage logs
  const filteredUsageLogs = usageLogs
    .filter((l) => l && l.itemName && l.itemName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'most') return b.quantityUsed - a.quantityUsed;
      if (sortOrder === 'least') return a.quantityUsed - b.quantityUsed;
      // ✏️ EDIT: Sort by timestamp - when usage was recorded in system
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const categories = ['Beverages', 'Main Dishes', 'Side Dish', 'Desserts'];
  const filteredMenuByCat = menu.filter(
    (m) => m.category === selectedCategory || (m.category === 'Main Dishes' && selectedCategory === 'Main Dish')
  );

  const modalInventoryList = inventory.filter(
    (i) =>
      i && i.name && i.name.toLowerCase().includes(recipeSearch.toLowerCase()) 
  );

  const editInventoryList = inventory.filter((i) =>
    i && i.name && i.name.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">Inventory Management</h1>
        <p className="text-gray-600">Manage stock, suppliers, and recipes</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full overflow-hidden flex shadow-lg">
          {['Inventory', 'Suppliers', 'Management'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                // ✏️ EDIT: Reset to default sort when changing tabs
                setSortType('Quantity');
                setSortDirection('descending');
                setSearch('');
              }}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-300 ${
                activeTab === tab 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Inventory' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => {
                  setInventorySubTab('General');
                  // ✏️ EDIT: Reset to default sort when changing subtabs
                  setSortType('Quantity');
                  setSortDirection('descending');
                  setSearch('');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  inventorySubTab === 'General'
                    ? 'bg-white shadow-md text-gray-900 transform scale-105'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                General
              </button>
              <button
                onClick={() => {
                  setInventorySubTab('Used');
                  // ✏️ EDIT: Reset to default sort when changing subtabs
                  setSortType('Quantity');
                  setSortDirection('descending');
                  setSearch('');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  inventorySubTab === 'Used'
                    ? 'bg-white shadow-md text-gray-900 transform scale-105'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
              >
                Used
              </button>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder={
                  inventorySubTab === 'General' ? 'Search packs...' : 'Search kitchen...'
                }
                className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-64 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {/* ✏️ EDIT: Clean button-based UI with original sorting function */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-gray-700 font-bold">
                  <span>Sort By:</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => handleSortChange('Quantity')}
                    className={`px-4 py-2 rounded-md font-bold transition-all ${
                      sortType === 'Quantity'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-transparent text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Quantity {sortType === 'Quantity' && (sortDirection === 'ascending' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => handleSortChange('Date')}
                    className={`px-4 py-2 rounded-md font-bold transition-all ${
                      sortType === 'Date'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-transparent text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {/* ✏️ EDIT: Changed label to "Added Date" for clarity */}
                    Added Date {sortType === 'Date' && (sortDirection === 'ascending' ? '↑' : '↓')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {menuRecipeWarnings.length > 0 && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-900 px-5 py-4 mb-4">
              <div className="font-semibold">Menu Recipe Warning</div>
              <div className="text-sm mt-1">
                {menuRecipeWarnings.length} menu item{menuRecipeWarnings.length === 1 ? '' : 's'} currently have no recipe assigned. Add recipes to these menu items to keep inventory forecasting accurate.
              </div>
            </div>
          )}

          {inventorySubTab === 'General' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm shadow-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-700">Item Name</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Packs</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Alert At</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Expiration Date</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Amount per Pack</th>
                    <th className="px-6 py-4 text-center font-semibold text-gray-700">Unit Cost</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Type</th>
                    <th className="px-6 py-4 font-semibold text-gray-700">Suppliers</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                      <td
                        className={`px-6 py-4 font-semibold text-center ${
                          item.inStock <= item.lowStockThreshold ? 'text-red-600 bg-red-50 rounded-lg' : ''
                        }`}
                      >
                        {item.inStock}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500 text-xs">
                        {item.lowStockThreshold}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700">
                        {item.expirationDate || ''}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {item.measurementQty} {item.measurementUnit}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-gray-800">{item.cost}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-2 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">
                          {suppliers
                            .filter(sup => sup.items?.includes(item.id))
                            .map(sup => sup.name)
                            .join(', ') || 'NA'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inventorySubTab === 'Used' && (
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Kitchen Stock (Open)</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm shadow-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 text-blue-900">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Item Name</th>
                        <th className="px-6 py-4 text-center font-semibold">Open Amount</th>
                        <th className="px-6 py-4 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKitchenInventory.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="px-6 py-4 font-medium">{item.name}</td>
                          <td className="px-6 py-4 font-semibold text-blue-700 text-center">
                            {item.openStock} {item.measurementUnit}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.openStock <= 0 ? (
                              <span className="text-xs bg-red-100 text-red-600 px-3 py-2 rounded-full font-semibold">
                                Empty
                              </span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-600 px-3 py-2 rounded-full font-semibold">
                                In Use
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Recent Usage History</h3>
                <div className="border rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-6 py-4">Item Name</th>
                        <th className="px-6 py-4 text-center">Quantity Deducted</th>
                        <th className="px-6 py-4">Unit</th>
                        <th className="px-6 py-4">Date/Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsageLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                            No usage logs found.
                          </td>
                        </tr>
                      ) : (
                        filteredUsageLogs.map((log) => (
                          <tr key={log.id} className="border-b last:border-b-0">
                            <td className="px-6 py-4 font-medium">{log.itemName}</td>
                            <td className="px-6 py-4 font-semibold text-red-600 text-center">
                              -{log.quantityUsed}
                            </td>
                            <td className="px-6 py-4">{log.unit}</td>
                            <td className="px-6 py-4 text-xs text-gray-600">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Suppliers' && (
        <div className="relative">
          <div className="flex flex-wrap gap-6 mb-6">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="w-72 border rounded-2xl p-6 flex flex-col justify-between bg-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div>
                  <div className="text-center font-semibold text-lg mb-2">{sup.name}</div>
                  <div className="text-sm text-gray-600 mb-2"><strong>Email:</strong> {sup.email}</div>
                  <div className="text-sm text-gray-600 mb-2"><strong>Phone:</strong> {sup.phone}</div>
                  <div className="text-sm text-gray-600 mb-4"><strong>Location:</strong> {sup.address}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentSupplier(sup);
                      setShowSupplierItemsModal(true);
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                  >
                    Items
                  </button>
                  <button
                    onClick={() => {
                      setCurrentSupplier(sup);
                      setSupplierName(sup.name);
                      setSupplierEmail(sup.email);
                      setSupplierPhone(sup.phone);
                      setSupplierAddress(sup.address);
                      setShowSupplierModal(true);
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSupplier(sup.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => {
                setCurrentSupplier(null);
                setSupplierName('');
                setSupplierEmail('');
                setSupplierPhone('');
                setSupplierAddress('');
                setShowSupplierModal(true);
              }}
              className="w-20 h-20 rounded-full bg-blue-600 text-white text-3xl flex items-center justify-center self-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
            >
              +
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Management' && (
        <div className="flex flex-col w-full pb-10 gap-12">
          <div className="w-full max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Add Inventory Item</h2>
            <div className="border rounded-xl p-8 bg-white shadow-lg">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-2">Item Name</label>
                  <input
                    name="name"
                    value={addItemData.name}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="e.g. Sugar, Flour, Milk"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Cost (Per Pack)</label>
                  <input
                    name="cost"
                    type="number"
                    value={addItemData.cost}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Stock (Packs)</label>
                  <input
                    name="stock"
                    type="number"
                    value={addItemData.stock}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="e.g. 10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Unit Type</label>
                  <select
                    name="measurementUnit"
                    value={addItemData.measurementUnit}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3 bg-white"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Amount per Pack</label>
                  <input
                    name="measurementQty"
                    type="number"
                    value={addItemData.measurementQty}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-red-600">
                    Alert Threshold (Packs)
                  </label>
                  <input
                    name="lowStockThreshold"
                    type="number"
                    value={addItemData.lowStockThreshold}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Category Type</label>
                  <select
                    name="type"
                    value={addItemData.type}
                    onChange={handleAddItemChange}
                    className="w-full border rounded-lg px-4 py-3 bg-white"
                  >
                    <option value="Perishable">Perishables</option>
                    <option value="Non-Perishable">Non-Perishables</option>
                    <option value="Supplies">Supplies</option>
                  </select>
                </div>
                
                {/* Expiration Date - Only show for Perishable items */}
                {addItemData.type === 'Perishable' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold mb-2 text-orange-900">
                      📅 Expiration Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      name="expirationDate"
                      type="date"
                      value={addItemData.expirationDate}
                      onChange={handleAddItemChange}
                      className="w-full border rounded-lg px-4 py-3"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-6 justify-center mt-6">
                <button
                  onClick={handleSaveNewItem}
                  className="bg-green-700 text-white px-10 py-3 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Save
                </button>
                <button
                  onClick={handleClearNewItem}
                  className="bg-red-600 text-white px-10 py-3 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          {/* Edit Inventory Item Section */}
          <div className="w-full max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Edit Inventory Item</h2>
            <div className="border rounded-xl p-8 bg-white shadow-lg flex flex-col md:flex-row gap-8 h-[500px]">
              <div className="w-full md:w-1/2 flex flex-col border-r md:pr-4">
                {editingItem ? (
                  <div className="flex flex-col h-full overflow-y-auto">
                    <div className="mb-3">
                      <div className="text-xs text-gray-500">Item Name</div>
                      <div className="text-xl font-semibold">{editingItem.name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Warehouse Stock (Packs)
                        </label>
                        <input
                          name="stock"
                          type="number"
                          value={editFormData.stock}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Cost</label>
                        <input
                          name="cost"
                          type="number"
                          value={editFormData.cost}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold mb-1">
                        Used Amount ({editFormData.measurementUnit})
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          name="openStock"
                          type="number"
                          value={editFormData.openStock}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm"
                        />
                        <span className="text-xs text-gray-600">
                          {editFormData.measurementUnit}
                        </span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold mb-1 text-red-600">
                        Alert Threshold (Packs)
                      </label>
                      <input
                        name="lowStockThreshold"
                        type="number"
                        value={editFormData.lowStockThreshold}
                        onChange={handleEditFormChange}
                        className="w-full border rounded p-2 text-sm"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold mb-1">
                        Pack Size ({editFormData.measurementUnit})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="measurementQty"
                          type="number"
                          value={editFormData.measurementQty}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm"
                        />
                        <select
                          name="measurementUnit"
                          value={editFormData.measurementUnit}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm bg-white"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                    </div>

                    {/* Expiration Date - Only for Perishable items */}
                    {editFormData.type === 'Perishable' && (
                      <div className="mb-3 bg-orange-50 border border-orange-200 rounded p-3">
                        <label className="block text-xs font-semibold mb-1 text-orange-900">
                          📅 Expiration Date <span className="text-red-600">*</span>
                        </label>
                        <input
                          name="expirationDate"
                          type="date"
                          value={editFormData.expirationDate}
                          onChange={handleEditFormChange}
                          className="w-full border rounded p-2 text-sm"
                          required
                        />
                      </div>
                    )}

                    <div className="mt-2 flex justify-center">
                      <button
                        onClick={handleSaveEditItem}
                        className="bg-green-700 text-white text-sm font-semibold py-2 px-10 rounded"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center">
                    Select an item from the list to edit its details.
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/2 flex flex-col">
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    className="w-full border rounded-full px-4 py-2 text-sm"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto border rounded-xl relative">
                  {editInventoryList.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                      No items found
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="p-2 border-b">Item Name</th>
                          <th className="p-2 text-center border-b">Warehouse</th>
                          <th className="p-2 text-center border-b">Kitchen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editInventoryList.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => handleSelectForEdit(item)}
                            className={`cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                              editingItem?.id === item.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <td className="p-2 font-medium">{item.name}</td>
                            <td
                              className={`p-2 text-center ${
                                item.inStock <= item.lowStockThreshold
                                  ? 'text-red-600 font-semibold'
                                  : ''
                              }`}
                            >
                              {item.inStock}
                            </td>
                            <td className="p-2 text-center text-blue-600">
                              {item.openStock} {item.measurementUnit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4 text-center">Automate Inventory</h2>
            <div className="flex justify-end mb-4">
              <select
                className="border rounded-full px-4 py-1 bg-white text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="border rounded-xl overflow-hidden bg-white">
              {filteredMenuByCat.length > 0 ? (
                filteredMenuByCat.map((dish) => {
                  const recipeRow = recipes[dish.id];
                  const hasRecipe = recipeRow && Array.isArray(recipeRow.ingredients) && recipeRow.ingredients.length > 0;
                  const ingredientCount = hasRecipe ? recipeRow.ingredients.length : 0;
                  return (
                    <div
                      key={dish.id}
                      className="flex justify-between items-center p-4 border-b last:border-b-0"
                    >
                      <span className="font-semibold text-sm w-1/3">{dish.name}</span>
                      <span className="text-xs text-gray-500 w-1/3 text-center">
                        {hasRecipe ? `${ingredientCount} Ingredients` : 'No Ingredients'}
                      </span>
                      <div className="w-1/3 flex justify-end">
                        <button
                          onClick={() => handleOpenAutoModal(dish)}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-xs font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
                        >
                          Edit Recipe
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No dishes found in this category.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-96 border shadow relative">
            <h3 className="text-lg mb-4 font-semibold text-center">{currentSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
            <h3 className="text-lg mb-2 font-semibold">Company Name</h3>
            <input
              className="w-full p-2 mb-3 border rounded text-sm"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Santos Co."
            />
            <h3 className="text-lg mb-2 font-semibold">Email</h3>
            <input
              className="w-full p-2 mb-3 border rounded text-sm"
              value={supplierEmail}
              onChange={(e) => setSupplierEmail(e.target.value)}
              placeholder="e.g. santos@gmail.com"
            />
            <h3 className="text-lg mb-2 font-semibold">Contact Number</h3>
            <input
              className="w-full p-2 mb-3 border rounded text-sm"
              value={supplierPhone}
              onChange={(e) => {
                // Only allow numbers and common phone formatting characters
                const value = e.target.value.replace(/[^\d\-\(\)\s]/g, '');
                setSupplierPhone(value);
              }}
              placeholder="e.g. (639) 123-4567"
            />
            <h3 className="text-lg mb-2 font-semibold">Location</h3>
            <input
              className="w-full p-2 mb-4 border rounded text-sm"
              value={supplierAddress}
              onChange={(e) => setSupplierAddress(e.target.value)}
              placeholder="e.g. Makati, Metro Manila"
            />
            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setCurrentSupplier(null);
                  setSupplierName('');
                  setSupplierEmail('');
                  setSupplierPhone('');
                  setSupplierAddress('');
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded text-sm font-semibold hover:bg-gray-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSupplier}
                className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-all"
              >
                {currentSupplier ? 'Update' : 'Add Supplier'}
              </button>
            </div>
            <button
              onClick={() => {
                setShowSupplierModal(false);
                setCurrentSupplier(null);
                setSupplierName('');
                setSupplierEmail('');
                setSupplierPhone('');
                setSupplierAddress('');
              }}
              className="absolute top-2 right-4 text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showAutoModal && selectedDish && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow w-[900px] h-[600px] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold">Edit Recipe: {selectedDish.name}</h3>
              <button
                onClick={() => setShowAutoModal(false)}
                className="text-lg text-gray-600 hover:text-red-500"
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/2 p-4 border-r flex flex-col bg-white">
                <div className="flex-1 overflow-y-auto space-y-2 text-sm">
                  {currentRecipe.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10 text-sm">
                      No ingredients added yet.
                    </div>
                  ) : (
                    currentRecipe.map((ing) => {
                      const originalItem = inventory.find((i) => i.id === ing.inventoryId);
                      const unit = originalItem ? originalItem.measurementUnit : '';
                      return (
                        <div
                          key={ing.inventoryId}
                          className="flex justify-between items-center border rounded p-2"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{ing.name}</span>
                            <span className="text-xs text-gray-500">Unit: {unit}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              className="w-20 border rounded p-1 text-right text-xs"
                              value={ing.quantity}
                              onChange={(e) =>
                                handleSetRecipeQuantity(ing.inventoryId, e.target.value)
                              }
                            />
                            <span className="text-xs font-semibold">{unit}</span>
                            <button
                              onClick={() => handleRemoveFromRecipe(ing.inventoryId)}
                              className="w-7 h-7 bg-red-100 text-red-600 rounded text-xs flex items-center justify-center border"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="mt-4 pt-4 border-t flex justify-center gap-4">
                  <button
                    onClick={handleSaveRecipe}
                    className="bg-green-700 text-white px-6 py-2 rounded text-sm font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowAutoModal(false)}
                    className="text-red-600 text-sm font-semibold"
                  >
                    Back
                  </button>
                </div>
              </div>

              <div className="w-1/2 p-4 bg-gray-50 flex flex-col">
                <div className="mb-3">
                  <h4 className="font-semibold mb-1 text-sm">Choose Inventory Item</h4>
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    className="w-full border rounded-full px-4 py-2 text-sm"
                    value={recipeSearch}
                    onChange={(e) => setRecipeSearch(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto border rounded bg-white relative text-sm">
                  {modalInventoryList.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                      No suitable food items found
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="p-2">Item Name</th>
                          <th className="p-2 text-center">Kitchen</th>
                          <th className="p-2 text-center"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalInventoryList.map((item) => (
                          <tr key={item.id} className="border-b last:border-b-0">
                            <td className="p-2">{item.name}</td>
                            <td className="p-2 text-center">
                              {item.openStock} {item.measurementUnit}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleAddToRecipe(item)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs"
                              >
                                Add
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Items Modal */}
      {showSupplierItemsModal && currentSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold mb-4">{currentSupplier.name} - Items</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Add Item to Supplier</label>
              <select
                value={selectedItemForSupplier || ''}
                onChange={(e) => setSelectedItemForSupplier(e.target.value || null)}
                className="w-full p-2 border rounded-lg mb-2"
              >
                <option value="">Select an item...</option>
                {inventory.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <button
                onClick={handleAddItemToSupplier}
                disabled={!selectedItemForSupplier}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-semibold transition-all"
              >
                Add Item
              </button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Current Items</h4>
              {currentSupplier.items && currentSupplier.items.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {currentSupplier.items.map(itemId => {
                    const item = inventory.find(i => i.id === itemId);
                    return (
                      <div key={itemId} className="flex justify-between items-center bg-gray-100 p-2 rounded-lg">
                        <span className="font-medium">{item?.name}</span>
                        <button
                          onClick={() => handleRemoveItemFromSupplier(itemId)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No items assigned yet</p>
              )}
            </div>

            <button
              onClick={() => setShowSupplierItemsModal(false)}
              className="w-full mt-4 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notification Popup */}
      {notificationMessage && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-[1000] animate-pulse">
          {notificationMessage}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;