const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const menuIds = {
  'menu-1': '11111111-1111-1111-1111-111111111111',
  'menu-2': '22222222-2222-2222-2222-222222222222',
  'menu-3': '33333333-3333-3333-3333-333333333333',
  'menu-4': '44444444-4444-4444-4444-444444444444',
  'menu-5': '55555555-5555-5555-5555-555555555555'
};

const inventoryIds = {
  'inv-1': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'inv-2': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'inv-3': 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'inv-4': 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'inv-5': 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'inv-6': 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'inv-7': '11112222-3333-4444-5555-666677778888',
  'inv-8': '99999999-8888-7777-6666-555544443333'
};

const userIds = {
  'emp-1': '00000000-0000-0000-0000-000000000001',
  'emp-2': '00000000-0000-0000-0000-000000000002',
  'emp-3': '00000000-0000-0000-0000-000000000003',
  'emp-4': '00000000-0000-0000-0000-000000000004',
  'emp-5': '00000000-0000-0000-0000-000000000005'
};

const menuItems = [
  {
    id: menuIds['menu-1'],
    name: 'Iced Americano',
    description: 'Chilled espresso with crisp water and light sweetener.',
    category: 'Beverages',
    base_price: 6.20,
    basePrice: 6.2,
    vat_fee: 0.74,
    VAT_fee: 0.74,
    totalPrice: 6.94,
    in_stock: true,
    hasSizes: true,
    has_sizes: true,
    image_url: '',
    sizes: {
      Small: { basePrice: 5.20, VAT_fee: 0.62, totalPrice: 5.82 },
      Medium: { basePrice: 6.20, VAT_fee: 0.74, totalPrice: 6.94 },
      Large: { basePrice: 7.20, VAT_fee: 0.86, totalPrice: 8.06 }
    }
  },
  {
    id: menuIds['menu-2'],
    name: 'Espresso',
    description: 'Rich espresso shot served hot.',
    category: 'Beverages',
    base_price: 5.00,
    basePrice: 5.0,
    vat_fee: 0.60,
    VAT_fee: 0.6,
    totalPrice: 5.6,
    in_stock: true,
    hasSizes: true,
    has_sizes: true,
    image_url: '',
    sizes: {
      Single: { basePrice: 5.0, VAT_fee: 0.6, totalPrice: 5.6 },
      Double: { basePrice: 7.5, VAT_fee: 0.9, totalPrice: 8.4 }
    }
  },
  {
    id: menuIds['menu-3'],
    name: 'Cheeseburger',
    description: 'Classic cheeseburger with lettuce, tomato, and cheese.',
    category: 'Main Dishes',
    base_price: 12.50,
    basePrice: 12.5,
    vat_fee: 1.50,
    VAT_fee: 1.5,
    totalPrice: 14.0,
    in_stock: true,
    hasSizes: false,
    has_sizes: false,
    image_url: '',
    sizes: null
  },
  {
    id: menuIds['menu-4'],
    name: 'French Fries',
    description: 'Crispy golden fries served hot.',
    category: 'Side Dish',
    base_price: 7.00,
    basePrice: 7.0,
    vat_fee: 0.84,
    VAT_fee: 0.84,
    totalPrice: 7.84,
    in_stock: true,
    hasSizes: false,
    has_sizes: false,
    image_url: '',
    sizes: null
  },
  {
    id: menuIds['menu-5'],
    name: 'Chocolate Cake',
    description: 'Rich chocolate cake slice with creamy frosting.',
    category: 'Desserts',
    base_price: 10.50,
    basePrice: 10.5,
    vat_fee: 1.26,
    VAT_fee: 1.26,
    totalPrice: 11.76,
    in_stock: true,
    hasSizes: false,
    has_sizes: false,
    image_url: '',
    sizes: null
  }
];

const inventoryItems = [
  {
    id: inventoryIds['inv-1'],
    name: 'Coffee Beans',
    category: 'Ingredients',
    in_stock: 12500,
    reorder_level: 2000,
    unit: 'g',
    cost: 0.03,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 12500,
    reorderLevel: 2000,
    measurementUnit: 'g',
    measurementQty: 1000,
    openStock: 12500,
    lowStockThreshold: 2000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-2'],
    name: 'Milk',
    category: 'Ingredients',
    in_stock: 320,
    reorder_level: 80,
    unit: 'L',
    cost: 0.8,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 320,
    reorderLevel: 80,
    measurementUnit: 'L',
    measurementQty: 1,
    openStock: 320,
    lowStockThreshold: 80,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-3'],
    name: 'Sugar',
    category: 'Ingredients',
    in_stock: 6000,
    reorder_level: 1200,
    unit: 'g',
    cost: 0.01,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 6000,
    reorderLevel: 1200,
    measurementUnit: 'g',
    measurementQty: 1000,
    openStock: 6000,
    lowStockThreshold: 1200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-4'],
    name: 'Burger Patty',
    category: 'Ingredients',
    in_stock: 220,
    reorder_level: 50,
    unit: 'pcs',
    cost: 0.9,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 220,
    reorderLevel: 50,
    measurementUnit: 'pcs',
    measurementQty: 1,
    openStock: 220,
    lowStockThreshold: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-5'],
    name: 'Burger Bun',
    category: 'Ingredients',
    in_stock: 260,
    reorder_level: 60,
    unit: 'pcs',
    cost: 0.25,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 260,
    reorderLevel: 60,
    measurementUnit: 'pcs',
    measurementQty: 1,
    openStock: 260,
    lowStockThreshold: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-6'],
    name: 'Potatoes',
    category: 'Ingredients',
    in_stock: 18000,
    reorder_level: 4000,
    unit: 'g',
    cost: 0.005,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 18000,
    reorderLevel: 4000,
    measurementUnit: 'g',
    measurementQty: 1000,
    openStock: 18000,
    lowStockThreshold: 4000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-7'],
    name: 'Chocolate',
    category: 'Ingredients',
    in_stock: 5500,
    reorder_level: 1000,
    unit: 'g',
    cost: 0.04,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 5500,
    reorderLevel: 1000,
    measurementUnit: 'g',
    measurementQty: 1000,
    openStock: 5500,
    lowStockThreshold: 1000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: inventoryIds['inv-8'],
    name: 'Cream',
    category: 'Ingredients',
    in_stock: 120,
    reorder_level: 30,
    unit: 'L',
    cost: 1.25,
    type: 'Perishable',
    expiration_date: '',
    expirationDate: '',
    inStock: 120,
    reorderLevel: 30,
    measurementUnit: 'L',
    measurementQty: 1,
    openStock: 120,
    lowStockThreshold: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const userProfiles = [
  { id: userIds['emp-1'], username: 'emp-1', password_hash: 'SUPABASE_AUTH', email: 'emp1@goodlandcafe.local', phone: '', role: 'Employee', status: 'active' },
  { id: userIds['emp-2'], username: 'emp-2', password_hash: 'SUPABASE_AUTH', email: 'emp2@goodlandcafe.local', phone: '', role: 'Employee', status: 'active' },
  { id: userIds['emp-3'], username: 'emp-3', password_hash: 'SUPABASE_AUTH', email: 'emp3@goodlandcafe.local', phone: '', role: 'Employee', status: 'active' },
  { id: userIds['emp-4'], username: 'emp-4', password_hash: 'SUPABASE_AUTH', email: 'emp4@goodlandcafe.local', phone: '', role: 'Employee', status: 'active' },
  { id: userIds['emp-5'], username: 'emp-5', password_hash: 'SUPABASE_AUTH', email: 'emp5@goodlandcafe.local', phone: '', role: 'Employee', status: 'active' }
];

const recipesData = [
  {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
    dish_id: menuIds['menu-1'],
    ingredients: [
      { inventoryId: inventoryIds['inv-1'], name: 'Coffee Beans', quantity: 18 },
      { inventoryId: inventoryIds['inv-3'], name: 'Sugar', quantity: 8 },
      { inventoryId: inventoryIds['inv-2'], name: 'Milk', quantity: 30 }
    ],
    steps: 'Brew espresso; combine with water, ice, and sweetener.',
    prep_time: 5,
    cooking_time: 0
  },
  {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002',
    dish_id: menuIds['menu-2'],
    ingredients: [
      { inventoryId: inventoryIds['inv-1'], name: 'Coffee Beans', quantity: 10 },
      { inventoryId: inventoryIds['inv-3'], name: 'Sugar', quantity: 5 }
    ],
    steps: 'Pull espresso shot and serve immediately.',
    prep_time: 3,
    cooking_time: 0
  },
  {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003',
    dish_id: menuIds['menu-3'],
    ingredients: [
      { inventoryId: inventoryIds['inv-4'], name: 'Burger Patty', quantity: 1 },
      { inventoryId: inventoryIds['inv-5'], name: 'Burger Bun', quantity: 1 },
      { inventoryId: inventoryIds['inv-3'], name: 'Sugar', quantity: 4 }
    ],
    steps: 'Grill patty, assemble burger with bun and toppings.',
    prep_time: 10,
    cooking_time: 7
  },
  {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0004',
    dish_id: menuIds['menu-4'],
    ingredients: [
      { inventoryId: inventoryIds['inv-6'], name: 'Potatoes', quantity: 150 },
      { inventoryId: inventoryIds['inv-3'], name: 'Sugar', quantity: 2 }
    ],
    steps: 'Cut potatoes, fry until golden brown, season lightly.',
    prep_time: 8,
    cooking_time: 10
  },
  {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0005',
    dish_id: menuIds['menu-5'],
    ingredients: [
      { inventoryId: inventoryIds['inv-7'], name: 'Chocolate', quantity: 50 },
      { inventoryId: inventoryIds['inv-8'], name: 'Cream', quantity: 20 },
      { inventoryId: inventoryIds['inv-3'], name: 'Sugar', quantity: 35 }
    ],
    steps: 'Bake cake layers and frost with cream and chocolate ganache.',
    prep_time: 30,
    cooking_time: 20
  }
];

const serializeCsvField = (value) => {
  if (value === null || value === undefined) return '\\N';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return String(raw);
};

const writeCsv = (filePath, header, rows) => {
  const lines = [header.join(','), ...rows.map(row => row.map(serializeCsvField).join(','))];
  fs.writeFileSync(path.join(dataDir, filePath), lines.join('\n'));
};

writeCsv('menu.csv', ['id','name','description','category','base_price','basePrice','vat_fee','VAT_fee','totalPrice','in_stock','hasSizes','has_sizes','image_url','sizes','created_at','updated_at'],
  menuItems.map(item => [
    item.id,
    item.name,
    item.description,
    item.category,
    item.base_price,
    item.basePrice,
    item.vat_fee,
    item.VAT_fee,
    item.totalPrice,
    item.in_stock,
    item.hasSizes,
    item.has_sizes,
    item.image_url,
    item.sizes !== null ? JSON.stringify(item.sizes) : null,
    new Date().toISOString(),
    new Date().toISOString()
  ]));

writeCsv('inventory.csv', ['id','name','category','in_stock','reorder_level','unit','cost','type','expiration_date','expirationDate','inStock','reorderLevel','measurementUnit','measurementQty','openStock','lowStockThreshold','created_at','updated_at'],
  inventoryItems.map(item => [
    item.id,
    item.name,
    item.category,
    item.in_stock,
    item.reorder_level,
    item.unit,
    item.cost,
    item.type,
    item.expiration_date || null,
    item.expirationDate || null,
    item.inStock,
    item.reorderLevel,
    item.measurementUnit,
    item.measurementQty,
    item.openStock,
    item.lowStockThreshold,
    item.created_at,
    item.updated_at
  ]));

writeCsv('user_profiles.csv', ['id','username','password_hash','email','phone','role','status','created_at','updated_at'],
  userProfiles.map(u => [
    u.id,
    u.username,
    u.password_hash,
    u.email,
    u.phone,
    u.role,
    u.status,
    new Date().toISOString(),
    new Date().toISOString()
  ]));

writeCsv('recipes.csv', ['id','dish_id','ingredients','steps','prep_time','cooking_time','created_at','updated_at'],
  recipesData.map(r => [
    r.id,
    r.dish_id,
    JSON.stringify(r.ingredients),
    r.steps,
    r.prep_time,
    r.cooking_time,
    new Date().toISOString(),
    new Date().toISOString()
  ]));

const oldTransactions = fs.readFileSync(path.join(dataDir, 'transactions.csv'), 'utf8');
const transactionLines = oldTransactions.trim().split(/\r?\n/);
const headers = transactionLines[0].split(',');
const newTransactions = transactionLines.slice(1).map(line => {
  const values = line.split(',');
  const row = headers.reduce((acc, header, idx) => {
    acc[header] = values[idx];
    return acc;
  }, {});
  const menuUuid = menuIds[row.menu_item_id];
  const menuItem = menuItems.find(item => item.id === menuUuid);
  const selectedSize = row.selected_size && row.selected_size !== 'null' ? row.selected_size : '';
  const itemObject = {
    menuItem: {
      id: menuUuid,
      name: row.menu_item_name,
      category: menuItem ? menuItem.category : 'Unknown',
      basePrice: menuItem ? menuItem.basePrice : 0,
      VAT_fee: menuItem ? menuItem.VAT_fee : 0,
      totalPrice: menuItem ? menuItem.totalPrice : Number(row.item_price),
      hasSizes: menuItem ? menuItem.hasSizes : false,
      sizes: menuItem ? menuItem.sizes : null
    },
    quantity: Number(row.quantity),
    selectedSize: selectedSize || null
  };
  return {
    id: `66666666-6666-6666-6666-${String(Math.floor(Math.random() * 1000000)).padStart(12, '0')}`,
    user_id: userIds[row.employee_id] || userIds['emp-1'],
    order_number: Number(row.order_number),
    items: [itemObject],
    base_amount: Number(row.total_amount),
    discount_type: 'None',
    discount_amount: 0,
    vat_portion: 0,
    service_fee: 0,
    total_amount: Number(row.total_amount),
    cash_provided: Number(row.total_amount),
    change: 0,
    type: row.order_type,
    time_ordered: row.timestamp.substring(11),
    timestamp: row.timestamp,
    status: 'completed',
    employee_id: row.employee_id,
    created_at: row.timestamp,
    updated_at: row.timestamp
  };
});

writeCsv('transactions.csv', ['id','user_id','order_number','items','base_amount','discount_type','discount_amount','vat_portion','service_fee','total_amount','cash_provided','change','type','time_ordered','timestamp','status','employee_id','created_at','updated_at'],
  newTransactions.map(row => [
    row.id,
    row.user_id,
    row.order_number,
    JSON.stringify(row.items),
    row.base_amount,
    row.discount_type,
    row.discount_amount,
    row.vat_portion,
    row.service_fee,
    row.total_amount,
    row.cash_provided,
    row.change,
    row.type,
    row.time_ordered,
    row.timestamp,
    row.status,
    row.employee_id,
    row.created_at,
    row.updated_at
  ]));

console.log('Aligned CSV files written to data/');
