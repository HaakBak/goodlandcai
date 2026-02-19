import React, { useEffect, useState } from 'react';
import { getTransactions, getNotifications } from '../../services/mockDatabase';
import { calculateCategoryRanking, calculateESA } from '../../utils/mlEngine';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend 
} from 'recharts';

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  
  // Metrics
  const [todaysOrders, setTodaysOrders] = useState(0);
  
  // Ranking Chart State
  const [rankingData, setRankingData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Beverages');

  // Forecasting Chart State
  const [forecastData, setForecastData] = useState([]);
//Notifications
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadData = async () => {
        const data = await getTransactions();
        setTransactions(data);

        // Calculate "Today's Orders" - Counting "Yes" status as completed for demo
        const completedCount = data.filter(t => t.status === 'Yes').length;
        setTodaysOrders(completedCount);

        // Load Notifications
        const notifs = await getNotifications();
        setNotifications(notifs.slice(0, 5)); // Show top 5 recent
    };
    loadData();

    // Listen for new toasts to update list immediately
    const handleUpdate = () => {
        getNotifications().then(n => setNotifications(n.slice(0, 5)));
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

  // Update Forecast Chart when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
        // Use ESA algorithm
        const esaData = calculateESA(transactions, 0.5); 
        setForecastData(esaData);
    }
  }, [transactions]);

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
                {/* Chart 2: Sales Forecasting (ESA) */}
                <div className="border border-gray-200 p-6 rounded-2xl shadow-xl bg-white/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-md">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Sales Forecasting</h3>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold border border-blue-200 shadow-sm">
                            Exponential Smoothing
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={forecastData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="time" tick={{fontSize: 12, fill: '#666'}} />
                                <YAxis tick={{fontSize: 12, fill: '#666'}} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual Sales" strokeWidth={3} dot={{r:5, fill: '#3b82f6'}} activeDot={{r:7}} />
                                <Line type="monotone" dataKey="forecast" stroke="#10b981" name="Forecast (ESA)" strokeWidth={3} strokeDasharray="8 4" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

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