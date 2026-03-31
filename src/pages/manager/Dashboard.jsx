import React, { useEffect, useState } from 'react';
import { getTransactions, getNotifications, getInventory, getRecipes } from '../../services/mockDatabase';
import { checkAllExpirations } from '../../services/notificationService';
import rawTransactionsCsv from '../../../data/transactions.csv?raw';
import { calculateCategoryRanking, calculateItemForecast, calculateRestockingNeeds, forecastIngredientDemand, mergeTransactions, parseCsvTransactions } from '../../utils/mlEngine';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [inventory, setInventory] = useState([]);
  
  // Metrics - daily orders and sales tracking
  const [todaysOrders, setTodaysOrders] = useState(0);
  const [dailySales, setDailySales] = useState(0);
  
  // Ranking Chart State
  const [rankingData, setRankingData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Beverages');

  // Forecasting State
  const [forecastPeriod, setForecastPeriod] = useState('monthly');
  const [forecastData, setForecastData] = useState([]);
  const [forecastMAPE, setForecastMAPE] = useState(0);
  const [nextPeriodForecast, setNextPeriodForecast] = useState(0);
  
  // Item Forecast & Restocking State
  const [itemForecast, setItemForecast] = useState(null);
  const [restockingPlan, setRestockingPlan] = useState([]);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const dedupeNotifications = (notes) => {
      const seen = new Set();
      return notes.filter((note) => {
        const key = `${note.message}|${note.category}|${note.itemName}|${note.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const loadData = async () => {
        const [data, notifs, inventoryData, recipeData] = await Promise.all([
          getTransactions(),
          getNotifications(),
          getInventory(),
          getRecipes(),
        ]);

        const historicalTransactions = parseCsvTransactions(rawTransactionsCsv);
        const mergedTx = mergeTransactions(historicalTransactions, data);

        setTransactions(mergedTx);
        setNotifications(dedupeNotifications(notifs).slice(0, 5));
        setInventory(inventoryData);
        setRecipes(recipeData);

        // Load daily metrics (orders completed & total sales) - automatically resets at midnight
        const today = new Date().toISOString().split('T')[0];
        const todaysTransactions = mergedTx.filter(t => t.timestamp && t.timestamp.startsWith(today));
        const completedOrders = todaysTransactions.length;
        const dailySales = todaysTransactions.reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);
        setTodaysOrders(completedOrders);
        setDailySales(dailySales);

        // Check expiration dates for all perishable items
        try {
          const expiredNotifications = checkAllExpirations(inventoryData);
          console.log(`📦 [Manager Dashboard] Checked ${inventoryData.length} items, found ${expiredNotifications.length} expired`);
        } catch (error) {
          console.error('[Dashboard] Error checking expirations:', error);
        }
    };
    loadData();

    // Listen for new toasts to update list immediately
    const handleUpdate = async (event) => {
        if (event?.detail) {
            setNotifications(prev => dedupeNotifications([event.detail, ...prev]).slice(0, 5));
        }

        try {
            const n = await getNotifications();
            setNotifications(dedupeNotifications(n).slice(0, 5));
        } catch (error) {
            console.error('[Dashboard] Failed to refresh notifications on toast event:', error);
        }
    };
    window.addEventListener('SHOW_TOAST', handleUpdate);
    return () => window.removeEventListener('SHOW_TOAST', handleUpdate);

  }, []);

  

  // Update Ranking Chart when category or transactions change
  useEffect(() => {
    if (transactions.length > 0) {
        const ranked = calculateCategoryRanking(transactions, selectedCategory);
        // Take top 5 for better visualization
        setRankingData(ranked.slice(0, 5));
    }
  }, [transactions, selectedCategory]);

  // Update Forecast Chart when transactions, inventory, recipes, or period changes
  useEffect(() => {
    if (transactions.length > 0) {
      const forecastResult = forecastIngredientDemand(transactions, recipes, inventory, forecastPeriod);
      const topInventoryItems = forecastResult.recommendations
        .sort((a, b) => b.forecast - a.forecast)
        .slice(0, 8);

      setForecastData(topInventoryItems);
      setForecastMAPE(forecastResult.confidence);
      setNextPeriodForecast(forecastResult.totalForecast);
    }
  }, [transactions, recipes, inventory, forecastPeriod]);

  // Calculate Ingredient Forecast & Restocking Needs based on recipes
  useEffect(() => {
    if (transactions.length > 0) {
        const ingredientForecastResult = forecastIngredientDemand(transactions, recipes, inventory, forecastPeriod);
        setItemForecast(ingredientForecastResult);

        const restockPlan = calculateRestockingNeeds(ingredientForecastResult, inventory, { minStockDays: 2, maxStockDays: 5 });
        setRestockingPlan(restockPlan);
    }
  }, [transactions, recipes, inventory, forecastPeriod]);

  const categories = ['Beverages', 'Main Dish', 'Side Dish', 'Desserts'];

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen">
        <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">Welcome Back</h1>
            <p className="text-gray-600">Here's your business overview for today</p>
        </div>

        <div className="flex gap-8">
            {/* Left Column: Charts */}
            <div className="flex-1 flex flex-col gap-8">
                
                {/* Chart 1: Top Menu Dish (Ranking) */}
                <div className="border border-gray-200 p-6 rounded-2xl shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Top Menu Items</h3>
                        </div>
                        <select 
                            className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold bg-white/80 backdrop-blur-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rankingData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 13, fill: '#666'}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} />
                                <Bar dataKey="count" fill="#4ade80" radius={[0, 8, 8, 0]} barSize={24} label={{ position: 'right', fill: '#666', fontSize: 12, fontWeight: 'bold' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                {/*Reconfigure Sales Forecasting by top sales based on amount of sold per day, month, year*/}
                {/* Chart 2: Sales Forecasting (Holt-Winters Triple Exponential Smoothing) */}
                <div className="border border-gray-200 p-6 rounded-2xl shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Inventory Forecasting</h3>
                        </div>
                        
                        {/* Period Selection Tabs - Top Right */}
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg shadow-sm">
                            {[
                                { label: 'Daily', value: 'daily' },
                                { label: 'Monthly', value: 'monthly' },
                                { label: 'Yearly', value: 'yearly' }
                            ].map(period => (
                                <button
                                    key={period.value}
                                    onClick={() => setForecastPeriod(period.value)}
                                    className={`px-4 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                                        forecastPeriod === period.value
                                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md scale-105'
                                            : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    {period.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Model Accuracy & Next Forecast Info */}
                    {/* <div className="flex gap-4 mb-4 text-sm">
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                            <span className="text-blue-700 font-semibold">Model Accuracy (MAPE):</span>
                            <span className="text-blue-600 font-bold">{forecastMAPE.toFixed(2)}%</span>
                        </div>
                        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                            <span className="text-green-700 font-semibold">Next Period Forecast:</span>
                            <span className="text-green-600 font-bold">₱ {nextPeriodForecast.toFixed(2)}</span>
                        </div>
                    </div> */}

                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecastData} margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="item" tick={{fontSize: 12, fill: '#666'}} angle={-45} textAnchor="end" height={80} />
                                <YAxis tick={{fontSize: 12, fill: '#666'}} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} formatter={(value) => `${value.toFixed(2)}`} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="forecast" fill="#10b981" name="Forecast Demand" barSize={24} />
                                <Bar dataKey="safetyStock" fill="#60a5fa" name="Safety Stock" barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* <div className="mt-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p><strong>Note:</strong> Forecast uses Holt-Winters Triple Exponential Smoothing with adaptive parameters for {forecastPeriod} analysis. MAPE indicates model accuracy (lower is better). Use for inventory planning.</p>
                    </div> */}
                </div>

                {/* Chart 3: Inventory Recommendations based on Item Forecast - COMMENTED OUT FOR TESTING */}
                {/* <div className="border border-gray-200 p-6 rounded-2xl shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-purple-200 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 6H6.28l-.31-1.243A1 1 0 005 4H3z" />
                                    <path d="M16 16a2 2 0 11-4 0 2 2 0 014 0z" />
                                    <path d="M4 16a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Inventory Forecast</h3>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                            itemForecast?.confidence >= 90 
                                ? 'bg-green-100 text-green-700 border border-green-200' 
                                : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                            {itemForecast?.confidence?.toFixed(1) || 0}% Confidence
                        </div>
                    </div>

                    <div className="mb-4 text-sm bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-purple-800"><strong>📊 Prediction:</strong> {itemForecast?.recommendations?.length || 0} items recommended for restocking based on {itemForecast?.period} forecast analysis</p>
                    </div>

                    {/* Restocking Items List */}
                    {/* <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {restockingPlan && restockingPlan.length > 0 ? (
                            restockingPlan.map((item, idx) => (
                                <div key={idx} className={`p-4 rounded-xl border transition-all duration-300 ${
                                    item.urgency === 'HIGH' 
                                        ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-300 shadow-md' 
                                        : item.urgency === 'MEDIUM'
                                        ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300'
                                        : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300'
                                }`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${
                                                item.urgency === 'HIGH' ? 'bg-red-500' : (item.urgency === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500')
                                            } animate-pulse`}></div>
                                            <h4 className={`font-bold text-sm ${
                                                item.urgency === 'HIGH' 
                                                    ? 'text-red-800' 
                                                    : item.urgency === 'MEDIUM'
                                                    ? 'text-yellow-800'
                                                    : 'text-blue-800'
                                            }`}>
                                                {item.item}
                                            </h4>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                            item.urgency === 'HIGH' 
                                                ? 'bg-red-200 text-red-800' 
                                                : item.urgency === 'MEDIUM'
                                                ? 'bg-yellow-200 text-yellow-800'
                                                : 'bg-blue-200 text-blue-800'
                                        }`}>
                                            {item.urgency}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                        <div>
                                            <p className="text-gray-600 text-xs">Daily Demand</p>
                                            <p className="font-bold text-sm">{item.dailyForecastDemand} units</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 text-xs">Order Qty</p>
                                            <p className="font-bold text-sm">{item.optimalOrderQuantity} units</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 text-xs">Stock Levels</p>
                                            <p className="font-bold text-sm">{item.minStockLevel}-{item.maxStockLevel}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 text-xs">Restock By</p>
                                            <p className="font-bold text-sm">{item.restockDate}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs">
                                        <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                        <p className="text-gray-700">{item.trend === 'increasing' ? '📈' : item.trend === 'decreasing' ? '📉' : '➡️'} {item.notes}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p>No items require restocking at this time</p>
                            </div>
                        )}
                    </div> */}

                    {/* <div className="mt-4 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p><strong>💡 Intelligence:</strong> AI predicts item demand based on {itemForecast?.period} sales patterns. 90%+ confidence means safe to order. Adjust min/max stock levels as needed.</p>
                    </div> */}
                {/* </div> */}

            </div>

            {/* Right Column: Metrics & Notifications */}
            <div className="w-80 flex flex-col gap-6">
                
                {/* Metric 1 */}
                <div className="border border-gray-200 rounded-3xl p-6 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 h-40">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-100 to-green-200 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-center font-semibold text-gray-700">Orders Completed</span>
                    </div>
                    <span className="text-5xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">{todaysOrders}</span>
                    <span className="text-sm text-gray-500 mt-1">Today</span>
                </div>

                {/* Metric 2: Daily Sales - Displays total sales revenue for the current day with automatic midnight reset */}
                <div className="border border-gray-200 rounded-3xl p-6 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 h-40">
                    <div className="flex items-center gap-2 mb-2">
                        {/* Change icon to caash symbol*/}
                        {/* <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8.16 2.75a.75.75 0 0 0-.32 1.02A7.503 7.503 0 0 1 16.5 10a7.5 7.5 0 0 1-13.066 4.62.75.75 0 0 0-1.11.99A9 9 0 1 0 17.659 1.1.75.75 0 0 0 16.9 2.1a7.5 7.5 0 0 1-8.74.65Z" />
                            </svg>
                        </div> */}
                        <span className="text-center font-semibold text-gray-700">Total Sales</span>
                    </div>
                    <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">₱ {dailySales.toFixed(2)}</span>
                    <span className="text-sm text-gray-500 mt-1">Today</span>
                </div>

                 {/* Notifications / Recent Activity */}
                 <div className="border border-gray-200 rounded-3xl p-6 flex-1 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300 min-h-[300px] relative overflow-hidden flex flex-col hover:scale-105">
                    <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-l from-gray-50 to-transparent rounded-l-3xl"></div>
                    
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                                </svg>
                            </div>
                            <h3 className="font-bold text-xl text-gray-800">Recent Activity</h3>
                        </div>
                        <div className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold shadow-sm">
                            Live
                        </div>
                    </div>

                    <div className="space-y-3 relative z-10 flex-1 overflow-y-auto pr-4">
                        {notifications.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <span className="text-lg font-medium">All caught up!</span>
                                <p className="text-sm">No recent activity</p>
                            </div>
                        ) : (
                            notifications.map(note => (
                                <div key={note.id} className={`text-sm p-4 rounded-xl border transition-all duration-300 hover:shadow-md hover:scale-105 ${
                                    note.type === 'warning' 
                                        ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 text-yellow-800 hover:from-yellow-100 hover:to-orange-100' 
                                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-800 hover:from-blue-100 hover:to-indigo-100'
                                }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            note.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                        } animate-pulse shadow-lg`}></div>
                                        <div className="font-semibold">{note.type === 'warning' ? 'Warning' : 'Info'}</div>
                                    </div>
                                    <div className="text-gray-700 leading-relaxed">{note.message}</div>
                                    <div className="text-xs text-right mt-2 opacity-60 font-medium">{new Date(note.timestamp).toLocaleTimeString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default Dashboard;