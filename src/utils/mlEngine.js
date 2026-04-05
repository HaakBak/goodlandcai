/**
 * MACHINE LEARNING / ANALYTICS ENGINE
 * 
 * 1. Top Menu Dish Ranking (Frequency Count)
 * 2. Inventory Forecasting (Holt-Winters Triple Exponential Smoothing)
 * 3. Daily, Monthly, Yearly forecasting for inventory planning
 */

/** 
 * Calculates the top selling items for a specific category based on transaction history.
 * @param {Array} transactions - List of transactions from DB
 * @param {String} category - Category to filter by (e.g., 'Beverages')
 * @returns {Array} - Sorted array of objects { name, count }
 */
export const calculateCategoryRanking = (transactions, category) => {
  const itemCounts = {};

  transactions.forEach(t => {
    if (t.items && Array.isArray(t.items)) {
      t.items.forEach(orderItem => {
        // Filter by category
        if (orderItem.menuItem && orderItem.menuItem.category === category) {
          const name = orderItem.menuItem.name;
          // Add quantity purchased
          itemCounts[name] = (itemCounts[name] || 0) + orderItem.quantity;
        }
      });
    }
  });

  // Convert to array and sort
  const ranking = Object.keys(itemCounts).map(name => ({
    name,
    count: itemCounts[name]
  }));

  // Sort descending by count
  ranking.sort((a, b) => b.count - a.count);

  return ranking.slice(0, 5); // Top 5 items
};

const parseCsvRow = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeTransaction = (tx) => {
  const parsed = {
    ...tx,
    id: tx.id || tx.transaction_id || tx.order_number || null,
    timestamp: tx.timestamp || tx.created_at || tx.time_ordered || null,
    totalAmount: tx.total_amount !== undefined ? parseNumber(tx.total_amount) : parseNumber(tx.totalAmount || tx.total),
    items: Array.isArray(tx.items) ? tx.items : ([]),
    status: tx.status || tx.state || null,
  };

  if (typeof parsed.items === 'string' && parsed.items.trim()) {
    try {
      parsed.items = JSON.parse(parsed.items);
    } catch (error) {
      parsed.items = [];
    }
  }

  if (Array.isArray(parsed.items)) {
    parsed.items = parsed.items.map(orderItem => {
      const normalizedOrder = {
        ...orderItem,
        quantity: parseNumber(orderItem.quantity),
      };

      if (normalizedOrder.menuItem && typeof normalizedOrder.menuItem === 'object') {
        normalizedOrder.menuItem = {
          ...normalizedOrder.menuItem,
          basePrice: parseNumber(normalizedOrder.menuItem.basePrice),
          VAT_fee: parseNumber(normalizedOrder.menuItem.VAT_fee),
          totalPrice: parseNumber(normalizedOrder.menuItem.totalPrice),
        };
      }

      return normalizedOrder;
    });
  }

  return parsed;
};

export const parseCsvTransactions = (rawCsv) => {
  if (!rawCsv || typeof rawCsv !== 'string') return [];

  const lines = rawCsv.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]).map(header => header.trim());

  return lines.slice(1).map(line => {
    const values = parseCsvRow(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });

    return normalizeTransaction(row);
  });
};

export const mergeTransactions = (historicalTransactions = [], currentTransactions = []) => {
  const baseline = Array.isArray(historicalTransactions)
    ? historicalTransactions.map(normalizeTransaction)
    : [];
  const live = Array.isArray(currentTransactions)
    ? currentTransactions.map(normalizeTransaction)
    : [];

  const mergedMap = new Map();
  baseline.forEach(tx => {
    if (tx.id) mergedMap.set(tx.id, tx);
  });
  live.forEach(tx => {
    if (tx.id) mergedMap.set(tx.id, tx);
  });

  return Array.from(mergedMap.values()).sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime() || 0;
    const bTime = new Date(b.timestamp).getTime() || 0;
    return aTime - bTime;
  });
};

// --- TIME HELPERS ---

const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfMonth = (date) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateLabel = (date, period) => {
  if (period === 'daily') {
    // Return Hour (e.g., 2 PM)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  } else if (period === 'monthly') {
    // Return Day (e.g., Nov 12)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // Return Month (e.g., Jan 2024)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
};

// --- AGGREGATION ---

/**
 * Groups raw transaction data into time buckets for forecasting.
 * @param transactions Raw DB transactions
 * @param period 'daily' | 'monthly' | 'yearly'
 */
const aggregateSales = (transactions, period) => {
  const now = new Date();
  let startDate = new Date();
  let buckets = new Map(); // timestamp -> total amount

  // 1. Determine Date Range & Initialize Buckets (Zero-filling)
  if (period === 'daily') {
    // Past 24 hours or "Today" from 00:00 to 23:59
    startDate = getStartOfDay(now);
    // Initialize hours 0 to 23
    for (let i = 0; i <= 23; i++) {
        const d = new Date(startDate);
        d.setHours(i);
        buckets.set(d.getTime(), 0);
    }
  } else if (period === 'monthly') {
    // Past 30 Days
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0,0,0,0);
    
    for (let i = 0; i <= 30; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        buckets.set(d.getTime(), 0);
    }
  } else {
    // Past 12 Months
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 11);
    startDate.setDate(1);
    startDate.setHours(0,0,0,0);
    
    for (let i = 0; i < 12; i++) {
        const d = new Date(startDate);
        d.setMonth(startDate.getMonth() + i);
        buckets.set(d.getTime(), 0);
    }
  }

  // 2. Fill Buckets with Transaction Data
  transactions.forEach(t => {
    const tDate = new Date(t.timestamp);
    if (tDate >= startDate && tDate <= now) {
      let bucketKey = 0;

      if (period === 'daily') {
        const b = new Date(tDate);
        b.setMinutes(0, 0, 0); // Floor to hour
        bucketKey = b.getTime();
      } else if (period === 'monthly') {
        const b = new Date(tDate);
        b.setHours(0,0,0,0); // Floor to day
        bucketKey = b.getTime();
      } else {
        const b = new Date(tDate);
        b.setDate(1); 
        b.setHours(0,0,0,0); // Floor to month
        bucketKey = b.getTime();
      }

      const currentVal = buckets.get(bucketKey) || 0;
      buckets.set(bucketKey, currentVal + t.totalAmount);
    }
  });

  // 3. Convert Map to Array and Sort
  return Array.from(buckets.entries())
    .map(([time, value]) => ({
      time,
      value,
      label: formatDateLabel(new Date(time), period)
    }))
    .sort((a, b) => a.time - b.time);
};

// --- FORECASTING ALGORITHMS ---

/**
 * Calculates Mean Absolute Percentage Error (MAPE)
 * Lower is better. Good for model evaluation.
 */
export const calculateMAPE = (actuals, forecasts) => {
  let totalError = 0;
  let count = 0;
  for (let i = 0; i < actuals.length; i++) {
    // PHASE 2.1 FIX: Validate forecasts[i] exists and is finite
    if (actuals[i] !== 0 && i < forecasts.length && Number.isFinite(forecasts[i])) {
      const error = Math.abs((actuals[i] - forecasts[i]) / actuals[i]);
      if (Number.isFinite(error)) {
        totalError += error;
        count++;
      }
    }
  }
  return count > 0 ? (totalError / count) * 100 : 0;
};

/**
 * HOLT-WINTERS (Triple Exponential Smoothing)
 * Best for data with trend and seasonality.
 * Parameters tuned for different periods:
 * - Daily: Higher alpha for responsiveness to recent changes
 * - Monthly: Medium alpha for balanced trend/seasonality
 * - Yearly: Lower alpha to smooth out noise
 */
export const holtWinters = (data, seasonLength, alpha = 0.3, beta = 0.1, gamma = 0.3) => {
  try {
    const n = data.length;
    
    // PHASE 2.1 FIX: Minimum 7 data points required
    if (n < 7) {
      const forecast = new Array(n + 1);
      const avgValue = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
      for (let i = 0; i <= n; i++) {
        forecast[i] = Number.isFinite(avgValue) ? avgValue : 0;
      }
      return forecast;
    }

    if (n < seasonLength * 2) {
      const forecast = new Array(n + 1);
      const avgValue = data.reduce((a, b) => a + b, 0) / data.length;
      for (let i = 0; i <= n; i++) {
        forecast[i] = Number.isFinite(avgValue) ? avgValue : 0;
      }
      return forecast;
    }

    const smooth = new Array(n);
    const trend = new Array(n);
    const seasonal = new Array(n);
    const forecast = new Array(n + 1);

    // Initial smoothing level
    let sum = 0;
    for (let i = 0; i < seasonLength; i++) sum += data[i];
    smooth[seasonLength - 1] = sum / seasonLength;

    // Initial trend
    let trendSum = 0;
    for (let i = 0; i < seasonLength; i++) {
      trendSum += (data[i + seasonLength] - data[i]) / seasonLength;
    }
    trend[seasonLength - 1] = trendSum / seasonLength;

    // Initial seasonal factors
    for (let i = 0; i < seasonLength; i++) {
      seasonal[i] = data[i] / smooth[seasonLength - 1];
    }

    // Triple exponential smoothing
    for (let i = seasonLength; i < n; i++) {
      smooth[i] = alpha * (data[i] / seasonal[i - seasonLength]) + (1 - alpha) * (smooth[i - 1] + trend[i - 1]);
      trend[i] = beta * (smooth[i] - smooth[i - 1]) + (1 - beta) * trend[i - 1];
      seasonal[i] = gamma * (data[i] / smooth[i]) + (1 - gamma) * seasonal[i - seasonLength];
      
      // PHASE 2.1 FIX: Bounds check before seasonal array access
      const seasonalIdx = i - seasonLength + 1;
      if (seasonalIdx >= 0 && seasonalIdx < seasonal.length) {
        forecast[i] = (smooth[i] + trend[i]) * seasonal[seasonalIdx];
      } else {
        forecast[i] = smooth[i] + trend[i];
      }
    }

    // PHASE 2.1 FIX: Final forecast with bounds check
    const finalIdx = n - seasonLength;
    if (finalIdx >= 0 && finalIdx < seasonal.length) {
      forecast[n] = (smooth[n - 1] + trend[n - 1]) * seasonal[finalIdx];
    } else {
      forecast[n] = smooth[n - 1] + trend[n - 1];
    }

    // PHASE 2.1 FIX: Validate all values for NaN/Infinity
    const avgFallback = data.reduce((a, b) => a + b, 0) / data.length;
    for (let i = 0; i < forecast.length; i++) {
      if (!Number.isFinite(forecast[i])) {
        forecast[i] = Number.isFinite(avgFallback) ? avgFallback : 0;
      }
    }

    return forecast;
  } catch (error) {
    // PHASE 2.1 FIX: Fallback on any error
    console.error('[mlEngine] holtWinters error:', error);
    const n = data.length;
    const forecast = new Array(n + 1);
    const avgValue = data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
    for (let i = 0; i <= n; i++) {
      forecast[i] = Number.isFinite(avgValue) ? avgValue : 0;
    }
    return forecast;
  }
};

/**
 * Simple Exponential Smoothing
 * Used when data has no clear seasonality
 */
const simpleExponentialSmoothing = (data, alpha = 0.3) => {
  const forecasts = [];
  let previousForecast = data.length > 0 ? data[0] : 0;
  forecasts.push(previousForecast);
  
  for (let i = 1; i < data.length; i++) {
    const f = (alpha * data[i - 1]) + ((1 - alpha) * previousForecast);
    forecasts.push(f);
    previousForecast = f;
  }
  
  const nextF = (alpha * data[data.length - 1]) + ((1 - alpha) * previousForecast);
  forecasts.push(nextF);
  
  return forecasts;
};

// --- MAIN FORECASTING FUNCTION ---

/**
 * Calculates sales forecast for inventory planning
 * Automatically selects best algorithm based on period
 * @param {Array} transactions - Raw transactions from DB
 * @param {String} period - 'daily' | 'monthly' | 'yearly'
 * @returns {Object} - { data: [...], mape, nextForecast }
 */
export const calculateForecasting = (transactions, period = 'monthly') => {
  if (!transactions || transactions.length === 0) {
    return { data: [], mape: 0, nextForecast: 0 };
  }

  const aggregated = aggregateSales(transactions, period);
  const actuals = aggregated.map(p => p.value);
  const result = [];
  let forecasts = [];
  let seasonLength = 1;

  // Select algorithm and parameters based on period
  if (period === 'daily') {
    // For daily: seasonLength = 6 hours (business hours repeating)
    seasonLength = 6;
    const alpha = 0.4; // Higher for responsiveness
    const beta = 0.15;
    const gamma = 0.25;
    forecasts = holtWinters(actuals, seasonLength, alpha, beta, gamma);
  } else if (period === 'monthly') {
    // For monthly: seasonLength = 7 days (weekly pattern)
    seasonLength = 7;
    const alpha = 0.3;
    const beta = 0.1;
    const gamma = 0.3;
    forecasts = holtWinters(actuals, seasonLength, alpha, beta, gamma);
  } else {
    // For yearly: seasonLength = 3 months (quarterly pattern)
    seasonLength = 3;
    const alpha = 0.2; // Lower for smoothing
    const beta = 0.08;
    const gamma = 0.25;
    forecasts = holtWinters(actuals, seasonLength, alpha, beta, gamma);
  }

  // Build result data
  aggregated.forEach((point, index) => {
    result.push({
      label: point.label,
      timestamp: point.time,
      actual: parseFloat(point.value.toFixed(2)),
      forecast: parseFloat((forecasts[index] || 0).toFixed(2))
    });
  });

  // Add next period forecast
  if (result.length > 0) {
    const lastItem = result[result.length - 1];
    let nextLabel = "Next";
    let nextTimestamp = lastItem.timestamp;
    
    if (period === 'daily') {
      nextLabel = "Next Hr";
      nextTimestamp += 3600000; // +1 hour
    } else if (period === 'monthly') {
      nextLabel = "Next Day";
      nextTimestamp += 86400000; // +1 day
    } else {
      nextLabel = "Next Mth";
      nextTimestamp += 2592000000; // +30 days
    }

    result.push({
      label: nextLabel,
      timestamp: nextTimestamp,
      actual: 0,
      forecast: parseFloat((forecasts[actuals.length] || 0).toFixed(2))
    });
  }

  const mape = calculateMAPE(actuals, forecasts.slice(0, actuals.length));
  const nextForecast = forecasts[actuals.length] || 0;

  return { data: result, mape: parseFloat(mape.toFixed(2)), nextForecast: parseFloat(nextForecast.toFixed(2)) };
};

// --- ITEM-LEVEL FORECASTING (For Inventory Prediction) ---

/**
 * Extracts item-level sales data from transactions
 * @param {Array} transactions - Raw transaction data
 * @param {String} period - 'daily' | 'monthly' | 'yearly'
 * @returns {Map} - itemName -> [{ time, quantity, timestamp }]
 */
const extractItemSales = (transactions, period) => {
  const itemSales = new Map(); // itemName -> array of sales
  const now = new Date();
  let startDate = new Date();

  // Determine date range
  if (period === 'daily') {
    startDate = getStartOfDay(now);
  } else if (period === 'monthly') {
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0,0,0,0);
  } else {
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 11);
    startDate.setDate(1);
    startDate.setHours(0,0,0,0);
  }

  // Extract item quantities from transactions
  transactions.forEach(t => {
    const tDate = new Date(t.timestamp);
    if (tDate >= startDate && tDate <= now && t.items && Array.isArray(t.items)) {
      t.items.forEach(orderItem => {
        const itemName = orderItem.menuItem?.name || 'Unknown Item';
        const quantity = orderItem.quantity || 1;

        if (!itemSales.has(itemName)) {
          itemSales.set(itemName, []);
        }

        itemSales.get(itemName).push({
          time: tDate,
          quantity,
          timestamp: t.timestamp
        });
      });
    }
  });

  return itemSales;
};

/**
 * Aggregates item quantities into time buckets for forecasting
 * @param {Array} itemSales - Array of individual item sales
 * @param {String} period - 'daily' | 'monthly' | 'yearly'
 * @returns {Array} - [{label, time, quantity}]
 */
const aggregateItemQuantities = (itemSales, period) => {
  const now = new Date();
  let startDate = new Date();
  let buckets = new Map(); // timestamp -> total quantity

  // Initialize buckets
  if (period === 'daily') {
    startDate = getStartOfDay(now);
    for (let i = 0; i <= 23; i++) {
      const d = new Date(startDate);
      d.setHours(i);
      buckets.set(d.getTime(), 0);
    }
  } else if (period === 'monthly') {
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0,0,0,0);
    
    for (let i = 0; i <= 30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      buckets.set(d.getTime(), 0);
    }
  } else {
    startDate = new Date();
    startDate.setMonth(now.getMonth() - 11);
    startDate.setDate(1);
    startDate.setHours(0,0,0,0);
    
    for (let i = 0; i < 12; i++) {
      const d = new Date(startDate);
      d.setMonth(startDate.getMonth() + i);
      buckets.set(d.getTime(), 0);
    }
  }

  // Fill buckets
  itemSales.forEach(sale => {
    const saleDate = new Date(sale.time);
    let bucketKey = 0;

    if (period === 'daily') {
      const b = new Date(saleDate);
      b.setMinutes(0, 0, 0);
      bucketKey = b.getTime();
    } else if (period === 'monthly') {
      const b = new Date(saleDate);
      b.setHours(0,0,0,0);
      bucketKey = b.getTime();
    } else {
      const b = new Date(saleDate);
      b.setDate(1);
      b.setHours(0,0,0,0);
      bucketKey = b.getTime();
    }

    const current = buckets.get(bucketKey) || 0;
    buckets.set(bucketKey, current + sale.quantity);
  });

  return Array.from(buckets.entries())
    .map(([time, quantity]) => ({
      time,
      quantity,
      label: formatDateLabel(new Date(time), period)
    }))
    .sort((a, b) => a.time - b.time);
};

/**
 * Forecasts item demand with high confidence
 * Specifically tuned for item quantities (less volatile than revenue)
 * @param {Array} transactions - Raw transactions
 * @param {String} period - 'daily' | 'monthly' | 'yearly'
 * @returns {Object} - { byItem: {itemName: forecast}, totalForecast, recommendations }
 */
export const calculateItemForecast = (transactions, period = 'monthly') => {
  if (!transactions || transactions.length === 0) {
    return { 
      byItem: {}, 
      totalForecast: 0, 
      recommendations: [],
      confidence: 0 
    };
  }

  const itemSales = extractItemSales(transactions, period);
  const byItem = {};
  const recommendations = [];
  let totalForecast = 0;
  let validItems = 0;

  // Forecast for each item
  itemSales.forEach((sales, itemName) => {
    // PHASE 2.1 FIX: Require 7+ data points for reliable forecasting
    if (sales.length < 7) {
      // Not enough data
      byItem[itemName] = {
        historicalAvg: sales.reduce((sum, s) => sum + s.quantity, 0) / sales.length || 0,
        forecast: 0,
        accuracy: 0,
        recommendation: 'Insufficient data'
      };
      return;
    }

    // Aggregate quantities
    const aggregated = aggregateItemQuantities(sales, period);
    const quantities = aggregated.map(a => a.quantity);

    // Forecast using Holt-Winters with item-specific tuning (lower noise sensitivity)
    let seasonLength = Math.max(3, Math.floor(quantities.length / 4));
    const alpha = 0.35; // Slightly higher than revenue for item specificity
    const beta = 0.12;
    const gamma = 0.28;

    // PHASE 2.1 FIX: Add try-catch for forecast calculation
    let forecasts;
    try {
      forecasts = holtWinters(quantities, seasonLength, alpha, beta, gamma);
    } catch (error) {
      console.error(`[mlEngine] Item forecast error for ${itemName}:`, error);
      byItem[itemName] = {
        historicalAvg: 0,
        forecast: 0,
        accuracy: 0,
        recommendation: 'Forecast calculation failed'
      };
      return;
    }
    
    // Calculate statistics
    const avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avgQuantity, 2), 0) / quantities.length;
    const stdDev = Math.sqrt(variance);
    
    // MAPE for accuracy
    const mape = calculateMAPE(quantities, forecasts.slice(0, quantities.length));
    const accuracy = Math.max(0, 100 - mape);

    const nextForecast = forecasts[quantities.length] || 0;
    const confidence = accuracy; // Confidence = accuracy %

    byItem[itemName] = {
      historicalAvg: parseFloat(avgQuantity.toFixed(2)),
      historicalStdDev: parseFloat(stdDev.toFixed(2)),
      forecast: parseFloat(nextForecast.toFixed(2)),
      mape: parseFloat(mape.toFixed(2)),
      accuracy: parseFloat(accuracy.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(2))
    };

    // Recommendation logic
    const trend = quantities[quantities.length - 1] - (quantities[quantities.length - 2] || quantities[0]);
    const trendDirection = trend > stdDev ? 'increasing' : (trend < -stdDev ? 'decreasing' : 'stable');

    if (accuracy >= 90) {
      recommendations.push({
        item: itemName,
        forecast: parseFloat(nextForecast.toFixed(2)),
        trend: trendDirection,
        priority: trendDirection === 'increasing' ? 'HIGH' : 'MEDIUM',
        confidence,
        reason: `${accuracy.toFixed(1)}% confidence - ${trendDirection} demand`
      });
      validItems++;
      totalForecast += nextForecast;
    }
  });

  // Sort recommendations by priority
  recommendations.sort((a, b) => {
    const priorityMap = { 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return priorityMap[a.priority] - priorityMap[b.priority];
  });

  return {
    byItem,
    totalForecast: parseFloat(totalForecast.toFixed(2)),
    recommendations: recommendations.slice(0, 10), // Top 10 items
    confidence: parseFloat((recommendations.length > 0 ? recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length : 0).toFixed(2)),
    period
  };
};

const getRecipeIngredientList = (recipe) => {
  if (!recipe) return [];
  if (Array.isArray(recipe)) return recipe;
  if (Array.isArray(recipe.ingredients)) return recipe.ingredients;
  return [];
};

const extractIngredientUsage = (transactions, recipes, period) => {
  const ingredientUsage = new Map();
  const now = new Date();
  let startDate = new Date();

  if (period === 'daily') {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === 'weekly') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  transactions.forEach((t) => {
    const timestamp = t.timestamp || t.created_at;
    const tDate = new Date(timestamp);
    if (isNaN(tDate.getTime()) || tDate < startDate || tDate > now) return;

    if (!t.items || !Array.isArray(t.items)) return;

    t.items.forEach((orderItem) => {
      const quantity = parseFloat(orderItem.quantity || 1) || 1;
      const menuItemId = orderItem.menuItem?.id || orderItem.menuItem?.dish_id;
      const recipe = recipes?.[menuItemId] || null;
      const ingredientList = getRecipeIngredientList(recipe);

      ingredientList.forEach((ingredient) => {
        const ingredientName =
          ingredient.name || ingredient.item || ingredient.inventoryId || 'Unknown Ingredient';
        const ingredientQty = parseFloat(
          ingredient.quantity ?? ingredient.qty ?? ingredient.amount ?? 1
        );
        const usedQuantity = (isNaN(ingredientQty) ? 1 : ingredientQty) * quantity;

        if (!ingredientUsage.has(ingredientName)) {
          ingredientUsage.set(ingredientName, []);
        }

        ingredientUsage.get(ingredientName).push({
          time: tDate,
          quantity: usedQuantity,
          timestamp,
        });
      });
    });
  });

  return ingredientUsage;
};

const aggregateIngredientUsage = (usageData, period) => {
  const now = new Date();
  let startDate = new Date();
  const buckets = new Map();

  if (period === 'daily') {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (let i = 0; i <= 23; i++) {
      const d = new Date(startDate);
      d.setHours(i, 0, 0, 0);
      buckets.set(d.getTime(), 0);
    }
  } else if (period === 'weekly') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    for (let i = 0; i <= 6; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);
      buckets.set(d.getTime(), 0);
    }
  } else {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (let i = 0; i <= 29; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      d.setHours(0, 0, 0, 0);
      buckets.set(d.getTime(), 0);
    }
  }

  usageData.forEach((usage) => {
    const usageDate = new Date(usage.time);
    if (isNaN(usageDate.getTime()) || usageDate < startDate || usageDate > now) return;

    let bucketKey;
    if (period === 'daily') {
      const b = new Date(usageDate);
      b.setMinutes(0, 0, 0);
      bucketKey = b.getTime();
    } else {
      const b = new Date(usageDate);
      b.setHours(0, 0, 0, 0);
      bucketKey = b.getTime();
    }

    const current = buckets.get(bucketKey) || 0;
    buckets.set(bucketKey, current + (parseFloat(usage.quantity) || 0));
  });

  return Array.from(buckets.entries())
    .map(([time, quantity]) => ({
      time,
      quantity,
      label: formatDateLabel(new Date(time), period === 'daily' ? 'daily' : 'monthly'),
    }))
    .sort((a, b) => a.time - b.time);
};

const getCurrentStockLevel = (ingredientName, inventory) => {
  if (!Array.isArray(inventory)) return 0;
  const inventoryItem = inventory.find((item) => {
    const candidate = item.name || item.item || '';
    return candidate.toLowerCase() === ingredientName.toLowerCase();
  });
  return inventoryItem ? parseFloat(inventoryItem.in_stock || inventoryItem.stock || inventoryItem.quantity || 0) : 0;
};

const getPeriodDays = (period) => {
  switch (period) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    default:
      return 7;
  }
};

const calculateReorderPoint = (avgUsage, period) => {
  const dailyUsage = avgUsage / Math.max(1, getPeriodDays(period));
  return dailyUsage * 7;
};

const calculateUrgency = (daysUntilDepletion, reorderPoint, forecast) => {
  if (daysUntilDepletion <= 1) return 'CRITICAL';
  if (daysUntilDepletion <= 3) return 'HIGH';
  if (daysUntilDepletion <= 7 || forecast > reorderPoint) return 'MEDIUM';
  return 'LOW';
};

export const forecastIngredientDemand = (transactions, recipes, currentInventory = [], period = 'weekly') => {
  if (!transactions || transactions.length === 0 || !recipes) {
    return {
      ingredientDemand: {},
      recommendations: [],
      totalForecast: 0,
      confidence: 0,
      period,
    };
  }

  const ingredientUsage = extractIngredientUsage(transactions, recipes, period);
  const ingredientDemand = {};
  const recommendations = [];
  let totalForecast = 0;

  ingredientUsage.forEach((usageRecords, ingredientName) => {
    const aggregated = aggregateIngredientUsage(usageRecords, period);
    const quantities = aggregated.map((entry) => entry.quantity);
    const avgUsage = quantities.length > 0 ? quantities.reduce((sum, value) => sum + value, 0) / quantities.length : 0;
    const currentStock = getCurrentStockLevel(ingredientName, currentInventory);
    const reorderPoint = calculateReorderPoint(avgUsage, period);
    const daysUntilDepletion = currentStock > 0
      ? Math.max(0, Math.floor(currentStock / Math.max(1, avgUsage / getPeriodDays(period))))
      : 0;

    const safetyStockBase = parseFloat((avgUsage * 0.2).toFixed(2));
    // PHASE 2.1 FIX: Require 7+ data points for ingredient forecasting
    if (quantities.length < 7) {
      ingredientDemand[ingredientName] = {
        historicalAvg: parseFloat(avgUsage.toFixed(2)),
        forecast: 0,
        safetyStock: safetyStockBase,
        mape: 0,
        accuracy: 0,
        confidence: 0,
        currentStock: parseFloat(currentStock.toFixed(2)),
        reorderPoint: parseFloat(reorderPoint.toFixed(2)),
        daysUntilDepletion,
        recommendedOrder: parseFloat(safetyStockBase.toFixed(2)),
        trend: 'stable',
        priority: 'LOW',
      };
      return;
    }

    const seasonLength = Math.max(3, Math.floor(quantities.length / 4));
    // PHASE 2.1 FIX: Add try-catch for ingredient forecast calculation
    let forecasts;
    try {
      forecasts = holtWinters(quantities, seasonLength, 0.35, 0.12, 0.28);
    } catch (error) {
      console.error(`[mlEngine] Ingredient forecast error for ${ingredientName}:`, error);
      ingredientDemand[ingredientName] = {
        historicalAvg: parseFloat(avgUsage.toFixed(2)),
        forecast: 0,
        safetyStock: 0,
        mape: 0,
        accuracy: 0,
        confidence: 0,
        currentStock: parseFloat(currentStock.toFixed(2)),
        reorderPoint: parseFloat(reorderPoint.toFixed(2)),
        daysUntilDepletion,
        recommendedOrder: 0,
        trend: 'stable',
        priority: 'LOW',
      };
      return;
    }
    const mape = calculateMAPE(quantities, forecasts.slice(0, quantities.length));
    const accuracy = Math.max(0, 100 - mape);
    const nextForecast = parseFloat((forecasts[quantities.length] || 0).toFixed(2));
    const safetyStock = parseFloat((nextForecast * 0.2).toFixed(2));
    const recommendedOrder = parseFloat((nextForecast + safetyStock).toFixed(2));
    const urgency = calculateUrgency(daysUntilDepletion, reorderPoint, nextForecast);
    const trendValue = quantities[quantities.length - 1] - (quantities[quantities.length - 2] || quantities[0] || 0);
    const trend = trendValue > 0 ? 'increasing' : trendValue < 0 ? 'decreasing' : 'stable';
    const priority = urgency;

    ingredientDemand[ingredientName] = {
      historicalAvg: parseFloat(avgUsage.toFixed(2)),
      forecast: nextForecast,
      safetyStock,
      mape: parseFloat(mape.toFixed(2)),
      accuracy: parseFloat(accuracy.toFixed(2)),
      confidence: parseFloat(accuracy.toFixed(2)),
      currentStock: parseFloat(currentStock.toFixed(2)),
      reorderPoint: parseFloat(reorderPoint.toFixed(2)),
      daysUntilDepletion,
      recommendedOrder,
      trend,
      priority,
    };

    recommendations.push({
      item: ingredientName,
      forecast: nextForecast,
      safetyStock,
      confidence: parseFloat(accuracy.toFixed(2)),
      currentStock: parseFloat(currentStock.toFixed(2)),
      reorderPoint: parseFloat(reorderPoint.toFixed(2)),
      daysUntilDepletion,
      recommendedOrder,
      urgency,
      trend,
      priority,
      reason: `${accuracy.toFixed(1)}% confidence - ${urgency} priority`,
    });

    totalForecast += nextForecast;
  });

  return {
    ingredientDemand,
    recommendations,
    totalForecast: parseFloat(totalForecast.toFixed(2)),
    confidence: parseFloat((recommendations.length > 0
      ? recommendations.reduce((sum, item) => sum + item.confidence, 0) / recommendations.length
      : 0).toFixed(2)),
    period,
  };
};

/**
 * Calculates inventory replenishment needs based on forecasted demand
 * Helps determine what items need to be restocked
 * @param {Object} itemForecast - Result from calculateItemForecast
 * @param {Object} currentInventory - Current inventory status
 * @param {Object} params - { minStockDays: 2, maxStockDays: 7 }
 * @returns {Array} - Restocking recommendations with urgency levels
 */
export const calculateRestockingNeeds = (itemForecast, currentInventory, params = {}) => {
  const { minStockDays = 2, maxStockDays = 7 } = params;
  
  const restockingPlan = itemForecast.recommendations.map(rec => {
    const dailyDemand = rec.forecast;
    const minStock = dailyDemand * minStockDays;
    const maxStock = dailyDemand * maxStockDays;
    const optimalOrderQty = maxStock * 1.1; // 10% buffer
    const priority = rec.priority || rec.urgency || 'LOW';
    const trend = rec.trend || 'stable';

    return {
      item: rec.item,
      dailyForecastDemand: dailyDemand,
      minStockLevel: parseFloat(minStock.toFixed(2)),
      maxStockLevel: parseFloat(maxStock.toFixed(2)),
      optimalOrderQuantity: parseFloat(optimalOrderQty.toFixed(2)),
      trend,
      confidence: rec.confidence,
      urgency: priority,
      restockDate: priority === 'HIGH' ? 'Today' : (priority === 'MEDIUM' ? '2-3 Days' : '1 Week'),
      notes: `Based on ${rec.confidence.toFixed(1)}% confidence forecast with ${trend} demand trend`
    };
  });

  return restockingPlan;
};

// --- LEGACY FUNCTION (for compatibility) ---
export const calculateESA = (transactions, alpha = 0.3) => {
  return calculateForecasting(transactions, 'monthly');
};