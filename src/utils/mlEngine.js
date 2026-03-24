/**
 * MACHINE LEARNING / ANALYTICS ENGINE
 * 
 * 1. Top Menu Dish Ranking (Frequency Count)
 * 2. Sales Forecasting (Holt-Winters Triple Exponential Smoothing)
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
    if (actuals[i] !== 0) {
      totalError += Math.abs((actuals[i] - forecasts[i]) / actuals[i]);
      count++;
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
  const n = data.length;
  if (n < seasonLength * 2) return data;

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
    forecast[i] = (smooth[i] + trend[i]) * seasonal[i - seasonLength + 1];
  }

  forecast[n] = (smooth[n - 1] + trend[n - 1]) * seasonal[n - seasonLength];
  return forecast;
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
    if (sales.length < 2) {
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

    const forecasts = holtWinters(quantities, seasonLength, alpha, beta, gamma);
    
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

    return {
      item: rec.item,
      dailyForecastDemand: dailyDemand,
      minStockLevel: parseFloat(minStock.toFixed(2)),
      maxStockLevel: parseFloat(maxStock.toFixed(2)),
      optimalOrderQuantity: parseFloat(optimalOrderQty.toFixed(2)),
      trend: rec.trend,
      confidence: rec.confidence,
      urgency: rec.priority,
      restockDate: rec.priority === 'HIGH' ? 'Today' : (rec.priority === 'MEDIUM' ? '2-3 Days' : '1 Week'),
      notes: `Based on ${rec.confidence.toFixed(1)}% confidence forecast with ${rec.trend} demand trend`
    };
  });

  return restockingPlan;
};

// --- LEGACY FUNCTION (for compatibility) ---
export const calculateESA = (transactions, alpha = 0.3) => {
  return calculateForecasting(transactions, 'monthly');
};