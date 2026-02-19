/**
 * MACHINE LEARNING / ANALYTICS ENGINE
 * 
 * 1. Top Menu Dish Ranking (Frequency Count)
 * 2. Sales Forecasting (Exponential Smoothing)
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

  return ranking;
};

/**
 * Calculates Exponential Smoothing Average (ESA) for sales trends.
 * Formula: S_t = alpha * X_t + (1 - alpha) * S_{t-1}
 * 
 * @param {Array} transactions - List of transactions
 * @param {Number} alpha - Smoothing factor (0 < alpha < 1). Higher = more weight to recent data.
 * @returns {Array} - Array of objects { time, actual, forecast }
 */
export const calculateESA = (transactions, alpha = 0.3) => {
  // 1. Aggregate sales by a time index (e.g., simple sequence 1, 2, 3 based on transaction order for this demo)
  // In a real app, we would group by Hour or Day. Here we group by "Order Index" or specific time buckets.
  
  // Let's create a time-series based on the order of transactions to simulate "Time"
  // extracting value (Total Amount)
  const seriesData = transactions.map((t, index) => ({
    time: index + 1,
    value: t.totalAmount
  }));

  const result = [];
  let previousForecast = seriesData.length > 0 ? seriesData[0].value : 0;

  seriesData.forEach((point, index) => {
    const actual = point.value;
    let forecast;

    if (index === 0) {
      forecast = actual; // Initialize
    } else {
      forecast = (alpha * actual) + ((1 - alpha) * previousForecast);
    }

    result.push({
      time: `T${point.time}`, // Label T1, T2...
      actual: actual,
      forecast: parseFloat(forecast.toFixed(2))
    });

    previousForecast = forecast;
  });

  return result;
};


//Revise entire model application