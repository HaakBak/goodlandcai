const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const menuItems = [
  { id: 'menu-1', name: 'Iced Americano', category: 'Beverages', sizes: ['Small', 'Medium', 'Large'] },
  { id: 'menu-2', name: 'Espresso', category: 'Beverages', sizes: ['Single', 'Double'] },
  { id: 'menu-3', name: 'Cheeseburger', category: 'Main Dishes', sizes: ['Regular'] },
  { id: 'menu-4', name: 'French Fries', category: 'Side Dish', sizes: ['Regular'] },
  { id: 'menu-5', name: 'Chocolate Cake', category: 'Desserts', sizes: ['Slice'] },
];

const inventoryItems = [
  { id: 'inv-1', name: 'Coffee Beans', stock: 12500, unit: 'g', reorder_threshold: 2000, cost_per_unit: 0.03, lead_time_days: 2 },
  { id: 'inv-2', name: 'Milk', stock: 320, unit: 'L', reorder_threshold: 80, cost_per_unit: 0.8, lead_time_days: 1 },
  { id: 'inv-3', name: 'Sugar', stock: 6000, unit: 'g', reorder_threshold: 1200, cost_per_unit: 0.01, lead_time_days: 2 },
  { id: 'inv-4', name: 'Burger Patty', stock: 220, unit: 'pcs', reorder_threshold: 50, cost_per_unit: 0.9, lead_time_days: 2 },
  { id: 'inv-5', name: 'Burger Bun', stock: 260, unit: 'pcs', reorder_threshold: 60, cost_per_unit: 0.25, lead_time_days: 3 },
  { id: 'inv-6', name: 'Potatoes', stock: 18000, unit: 'g', reorder_threshold: 4000, cost_per_unit: 0.005, lead_time_days: 3 },
  { id: 'inv-7', name: 'Chocolate', stock: 5500, unit: 'g', reorder_threshold: 1000, cost_per_unit: 0.04, lead_time_days: 3 },
  { id: 'inv-8', name: 'Cream', stock: 120, unit: 'L', reorder_threshold: 30, cost_per_unit: 1.25, lead_time_days: 2 },
];

const recipeRows = [
  { dish_id: 'menu-1', dish_name: 'Iced Americano', ingredients: [
      { inventoryId: 'inv-1', name: 'Coffee Beans', quantity: 18 },
      { inventoryId: 'inv-3', name: 'Sugar', quantity: 8 },
      { inventoryId: 'inv-2', name: 'Milk', quantity: 30 }
    ]
  },
  { dish_id: 'menu-2', dish_name: 'Espresso', ingredients: [
      { inventoryId: 'inv-1', name: 'Coffee Beans', quantity: 10 },
      { inventoryId: 'inv-3', name: 'Sugar', quantity: 5 }
    ]
  },
  { dish_id: 'menu-3', dish_name: 'Cheeseburger', ingredients: [
      { inventoryId: 'inv-4', name: 'Burger Patty', quantity: 1 },
      { inventoryId: 'inv-5', name: 'Burger Bun', quantity: 1 },
      { inventoryId: 'inv-3', name: 'Sugar', quantity: 4 }
    ]
  },
  { dish_id: 'menu-4', dish_name: 'French Fries', ingredients: [
      { inventoryId: 'inv-6', name: 'Potatoes', quantity: 150 },
      { inventoryId: 'inv-3', name: 'Sugar', quantity: 2 }
    ]
  },
  { dish_id: 'menu-5', dish_name: 'Chocolate Cake', ingredients: [
      { inventoryId: 'inv-7', name: 'Chocolate', quantity: 50 },
      { inventoryId: 'inv-8', name: 'Cream', quantity: 20 },
      { inventoryId: 'inv-3', name: 'Sugar', quantity: 35 }
    ]
  },
];

const formatDate = (date) => date.toISOString();

const transactionsRows = [];
let currentOrder = 1;
const startDate = new Date('2023-01-01T08:00:00.000Z');
const endDate = new Date('2025-12-31T20:00:00.000Z');

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  const dailyOrders = 1 + Math.floor(Math.random() * 3);
  for (let j = 0; j < dailyOrders; j++) {
    const timestamp = new Date(d);
    timestamp.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
    const menuItem = menuItems[Math.floor(Math.random() * menuItems.length)];
    const menuQty = 1 + Math.floor(Math.random() * 3);
    const selectedSize = menuItem.sizes[Math.floor(Math.random() * menuItem.sizes.length)];
    const itemPrice = parseFloat((5 + Math.random() * 10).toFixed(2));
    const totalAmount = parseFloat((itemPrice * menuQty).toFixed(2));

    transactionsRows.push({
      transaction_id: `txn-${currentOrder}`,
      timestamp: formatDate(timestamp),
      order_number: currentOrder,
      menu_item_id: menuItem.id,
      menu_item_name: menuItem.name,
      quantity: menuQty,
      selected_size: selectedSize,
      item_price: itemPrice,
      total_amount: totalAmount,
      employee_id: `emp-${1 + (currentOrder % 5)}`,
      order_type: Math.random() > 0.5 ? 'Dine In' : 'Takeout'
    });
    currentOrder += 1;
  }
}

const transactionCsv = ['transaction_id,timestamp,order_number,menu_item_id,menu_item_name,quantity,selected_size,item_price,total_amount,employee_id,order_type']
  .concat(transactionsRows.map(row => [
    row.transaction_id,
    row.timestamp,
    row.order_number,
    row.menu_item_id,
    row.menu_item_name,
    row.quantity,
    row.selected_size,
    row.item_price,
    row.total_amount,
    row.employee_id,
    row.order_type
  ].join(',')))
  .join('\n');

const inventoryCsv = ['inventory_id,ingredient_name,current_stock,unit,reorder_threshold,cost_per_unit,lead_time_days']
  .concat(inventoryItems.map(item => [
    item.id,
    item.name,
    item.stock,
    item.unit,
    item.reorder_threshold,
    item.cost_per_unit,
    item.lead_time_days
  ].join(',')))
  .join('\n');

const recipeCsv = ['dish_id,dish_name,ingredient_id,ingredient_name,quantity,unit']
  .concat(recipeRows.flatMap(row => row.ingredients.map(ingredient => [
    row.dish_id,
    row.dish_name,
    ingredient.inventoryId,
    ingredient.name,
    ingredient.quantity,
    inventoryItems.find(item => item.id === ingredient.inventoryId)?.unit || 'unit'
  ].join(','))));

fs.writeFileSync(path.join(dataDir, 'transactions.csv'), transactionCsv);
fs.writeFileSync(path.join(dataDir, 'inventory.csv'), inventoryCsv);
fs.writeFileSync(path.join(dataDir, 'recipes.csv'), recipeCsv);

console.log('Synthetic data written to', dataDir);
