import logo from '/src/assets/logo.png';

const INITIAL_MENU = [
  { 
    id: '1', 
    name: 'Espresso', 
    basePrice: 85, 
    VAT_fee: 10.2, 
    totalPrice: 95.2, 
    category: 'Beverages',
    hasSizes: true,
    sizes: {
      Small: { basePrice: 75, VAT_fee: 9, totalPrice: 84 },
      Medium: { basePrice: 85, VAT_fee: 10.2, totalPrice: 95.2 },
      Large: { basePrice: 100, VAT_fee: 12, totalPrice: 112 }
    }
  },
  { 
    id: '2', 
    name: 'Double Espresso', 
    basePrice: 105, 
    VAT_fee: 12.6, 
    totalPrice: 117.6, 
    category: 'Beverages',
    hasSizes: true,
    sizes: {
      Small: { basePrice: 95, VAT_fee: 11.4, totalPrice: 106.4 },
      Medium: { basePrice: 105, VAT_fee: 12.6, totalPrice: 117.6 },
      Large: { basePrice: 125, VAT_fee: 15, totalPrice: 140 }
    }
  },
  { 
    id: '3', 
    name: 'Cappuccino', 
    basePrice: 125, 
    VAT_fee: 15, 
    totalPrice: 140, 
    category: 'Beverages',
    hasSizes: true,
    sizes: {
      Small: { basePrice: 110, VAT_fee: 13.2, totalPrice: 123.2 },
      Medium: { basePrice: 125, VAT_fee: 15, totalPrice: 140 },
      Large: { basePrice: 145, VAT_fee: 17.4, totalPrice: 162.4 }
    }
  },
  { 
    id: '4', 
    name: 'Mocha', 
    basePrice: 135, 
    VAT_fee: 16.2, 
    totalPrice: 151.2, 
    category: 'Beverages',
    hasSizes: true,
    sizes: {
      Small: { basePrice: 120, VAT_fee: 14.4, totalPrice: 134.4 },
      Medium: { basePrice: 135, VAT_fee: 16.2, totalPrice: 151.2 },
      Large: { basePrice: 155, VAT_fee: 18.6, totalPrice: 173.6 }
    }
  },
  { 
    id: '5', 
    name: 'Iced Coffee', 
    basePrice: 115, 
    VAT_fee: 13.8, 
    totalPrice: 128.8, 
    category: 'Beverages',
    hasSizes: true,
    sizes: {
      Small: { basePrice: 100, VAT_fee: 12, totalPrice: 112 },
      Medium: { basePrice: 115, VAT_fee: 13.8, totalPrice: 128.8 },
      Large: { basePrice: 135, VAT_fee: 16.2, totalPrice: 151.2 }
    }
  },
  { id: '9', name: 'Grilled Chicken Breast', basePrice: 295, VAT_fee: 35.4, totalPrice: 330.4, category: 'Main Dishes' },
  { id: '10', name: 'Beef Burger', basePrice: 245, VAT_fee: 29.4, totalPrice: 274.4, category: 'Main Dishes' },
  { id: '16', name: 'Coleslaw', basePrice: 45, VAT_fee: 5.4, totalPrice: 50.4, category: 'Side Dish' },
  { id: '18', name: 'Brownie', basePrice: 95, VAT_fee: 11.4, totalPrice: 106.4, category: 'Desserts' },
];

const INITIAL_INVENTORY = [
  { id: '1', name: 'Coffee Beans', inStock: 10, cost: 365, type: 'Perishable', measurementUnit: 'g', measurementQty: 1000, openStock: 500, createdAt: new Date().toISOString() },
  { id: '2', name: 'Milk - Fresh', inStock: 20, cost: 166, type: 'Perishable', measurementUnit: 'ml', measurementQty: 1000, openStock: 200, createdAt: new Date().toISOString() }
];

const INITIAL_BUSINESS_INFO = {
  tin: "908-767-876-000",
  name: "GoodLand Cafe",
  status: "VAT_Reg",
  address: "Cariño Street, Baguio City",
  phone: "(239) 555-0298",
  logoUrl: logo,
};

const INITIAL_SUPPLIERS = [
  { id: '1', name: 'Premium Coffee Co.', email: 'contact@premiumcoffee.com', phone: '(639) 123-4567', address: 'Makati, Metro Manila', items: [] },
  { id: '2', name: 'Fresh Dairy Ltd.', email: 'orders@freshdairy.com', phone: '(639) 234-5678', address: 'Laguna, Philippines', items: [] }
];

const INITIAL_SERVICE_FEES = {
  dineIn: 3,
  takeout: 5
};

const INITIAL_RECIPES = {};

const INITIAL_USAGE_LOGS = [];

const KEYS = {
  MENU: 'pos_menu',
  INVENTORY: 'pos_inventory',
  TRANSACTIONS: 'pos_transactions',
  BUSINESS_INFO: 'pos_business_info',
  NOTIFICATIONS: 'pos_notifications',
  SUPPLIERS: 'pos_suppliers',
  RECIPES: 'pos_recipes',
  USAGE_LOGS: 'pos_usage_logs',
  SERVICE_FEES: 'pos_service_fees',
  USERS: 'pos_users',
  HISTORY: 'pos_history',
};

const INITIAL_USERS = [
  { id: 'admin-id', username: 'admin', email: 'admin@goodland.com', password: 'admin', role: 'admin' }
];



const getLocalStorage = (key, initial) => {
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { return initial; }
  }
  return initial;
};

const setLocalStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getUsers = async () => {
  return Promise.resolve(getLocalStorage(KEYS.USERS, INITIAL_USERS));
};

export const saveUser = async (user) => {
  const users = await getUsers();
  users.push(user);
  setLocalStorage(KEYS.USERS, users);
};

export const getHistory = async () => {
  return Promise.resolve(getLocalStorage(KEYS.HISTORY, []));
};

export const addHistoryLog = async (log) => {
  let history = await getHistory();
  if (!Array.isArray(history)) {
    history = [];
  }
  const now = new Date();
  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: log.timestamp || now.toISOString(),
    date: log.date || now.toISOString().split('T')[0],
    time: log.time || now.toTimeString().split(' ')[0],
    type: log.type,
    description: log.description,
    user: log.user
  };
  history.unshift(logEntry);
  setLocalStorage(KEYS.HISTORY, history);
};

export const getMenu = () => Promise.resolve(getLocalStorage(KEYS.MENU, INITIAL_MENU));
export const saveMenu = (menu) => Promise.resolve(setLocalStorage(KEYS.MENU, menu));
export const resetMenu = () => Promise.resolve(setLocalStorage(KEYS.MENU, INITIAL_MENU));

export const getInventory = () => Promise.resolve(getLocalStorage(KEYS.INVENTORY, INITIAL_INVENTORY));
export const saveInventory = (items) => Promise.resolve(setLocalStorage(KEYS.INVENTORY, items));

export const getTransactions = () => Promise.resolve(getLocalStorage(KEYS.TRANSACTIONS, []));
export const saveTransaction = (transaction) => {
  const current = getLocalStorage(KEYS.TRANSACTIONS, []);
  current.push(transaction);
  setLocalStorage(KEYS.TRANSACTIONS, current);
  return Promise.resolve();
};

export const updateTransactionStatus = (transactionId, newStatus = 'Yes') => {
  const current = getLocalStorage(KEYS.TRANSACTIONS, []);
  const updated = current.map(t => t.id === transactionId ? { ...t, status: newStatus } : t);
  setLocalStorage(KEYS.TRANSACTIONS, updated);
  return Promise.resolve();
};

export const getBusinessInfo = () => Promise.resolve(getLocalStorage(KEYS.BUSINESS_INFO, INITIAL_BUSINESS_INFO));
export const saveBusinessInfo = (info) => Promise.resolve(setLocalStorage(KEYS.BUSINESS_INFO, info));

export const getNotifications = () => Promise.resolve(getLocalStorage(KEYS.NOTIFICATIONS, []));
export const addNotification = (note) => {
  const current = getLocalStorage(KEYS.NOTIFICATIONS, []);
  current.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...note });
  setLocalStorage(KEYS.NOTIFICATIONS, current);
};

// Suppliers
export const getSuppliers = () => Promise.resolve(getLocalStorage(KEYS.SUPPLIERS, INITIAL_SUPPLIERS));
export const saveSuppliers = (suppliers) => Promise.resolve(setLocalStorage(KEYS.SUPPLIERS, suppliers));

// Recipes
export const getRecipes = () => Promise.resolve(getLocalStorage(KEYS.RECIPES, INITIAL_RECIPES));
export const saveRecipe = (dishId, recipe) => {
  const current = getLocalStorage(KEYS.RECIPES, {});
  current[dishId] = recipe;
  setLocalStorage(KEYS.RECIPES, current);
  return Promise.resolve();
};

// Inventory Management
export const addInventoryItem = (item) => {
  const current = getLocalStorage(KEYS.INVENTORY, INITIAL_INVENTORY);
  const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  current.push(newItem);
  setLocalStorage(KEYS.INVENTORY, current);
  return Promise.resolve(newItem);
};

export const updateInventoryItem = (itemId, updates) => {
  const current = getLocalStorage(KEYS.INVENTORY, INITIAL_INVENTORY);
  const updatedInventory = current.map(item => item.id === itemId ? { ...item, ...updates } : item);
  setLocalStorage(KEYS.INVENTORY, updatedInventory);
  return Promise.resolve();
};

// Usage Logs
export const getUsageLogs = () => Promise.resolve(getLocalStorage(KEYS.USAGE_LOGS, INITIAL_USAGE_LOGS));
export const addUsageLog = (log) => {
  const current = getLocalStorage(KEYS.USAGE_LOGS, []);
  current.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...log });
  setLocalStorage(KEYS.USAGE_LOGS, current);
  return Promise.resolve();
};

// Service Fees
export const getServiceFees = () => Promise.resolve(getLocalStorage(KEYS.SERVICE_FEES, INITIAL_SERVICE_FEES));
export const saveServiceFees = (fees) => Promise.resolve(setLocalStorage(KEYS.SERVICE_FEES, fees));
