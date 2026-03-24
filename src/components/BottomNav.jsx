
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNav = () => {
  const location = useLocation();
  const isPos = location.pathname.includes('/employee/pos');
  const isOrders = location.pathname.includes('/employee/orders');

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none z-50">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 flex overflow-hidden w-72 pointer-events-auto transition-all duration-300 hover:shadow-3xl hover:scale-105">
        <Link 
          to="/employee/pos" 
          className={`group relative flex-1 text-center py-4 font-bold transition-all duration-300 border-r border-gray-200 ${
            isPos 
              ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
              : 'hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-100 hover:text-blue-600'
          }`}
        >
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isPos ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
            }`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
              </svg>
            </div>
            <span className="text-xs font-semibold">POS</span>
            {isPos && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
            )}
          </div>
        </Link>
        
        <Link 
          to="/employee/orders" 
          className={`group relative flex-1 text-center py-4 font-bold transition-all duration-300 border-r border-gray-200 ${
            isOrders 
              ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
              : 'hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-100 hover:text-blue-600'
          }`}
        >
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isOrders ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
            }`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h3a1 1 0 100-2H7z" clipRule="evenodd"/>
              </svg>
            </div>
            <span className="text-xs font-semibold">Orders</span>
            {isOrders && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white shadow-lg"></div>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
};

export default BottomNav;
