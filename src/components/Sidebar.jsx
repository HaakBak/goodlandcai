import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { addHistoryLog } from '../services/mockDatabase';
import { clearUserSession } from '../services/privilegeService';
import { LogOut, ShieldCheck, History } from 'lucide-react';

const Sidebar = ({ role, historyData = [], username = 'Manager' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const now = new Date();
    
    // Get the actual username from unified sessionStorage key
    const actualUsername = sessionStorage.getItem('username') || 'Unknown';
    
    console.log('🚪 [User Logout Initiated]', { role, username: actualUsername });
    
    // 🔐 SECURITY: Clear user session and stored roles from sessionStorage
    clearUserSession();
    console.log('💾 [SessionStorage Cleared - All userRole and username keys removed]');
    
    // Determine logout type and description based on role
    let logoutType = 'Logout';
    let description = '';
    let logRole = 'Unknown';
    
    if (role === 'ADMIN') {
      logoutType = 'Admin Logout';
      description = `Administrator ${actualUsername} logged out of the system`;
      logRole = 'Administrator';
    } else if (role === 'EMPLOYEE') {
      logoutType = 'Employee Logout';
      description = `Employee ${actualUsername} logged out of the system`;
      logRole = 'Employee';
    } else if (role === 'MANAGER') {
      logoutType = 'Manager Logout';
      description = `Manager ${actualUsername} logged out of the system`;
      logRole = 'Manager';
    }
    
    await addHistoryLog({
      type: logoutType,
      description: description,
      user: actualUsername,
      role: logRole,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });
    console.log('✅ [Logout recorded in history]', { type: logoutType, user: actualUsername });
    navigate('/');
  };

  // Admin Sidebar
  if (role === 'ADMIN') {
    return (
      <aside className="w-72 bg-slate-800 text-white flex flex-col shadow-2xl fixed left-0 top-0 h-screen overflow-y-auto z-10">
        <div className="p-8 flex items-center space-x-4 border-b border-slate-700">
          <div className="w-12 h-12 bg-slate-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-white leading-tight">GoodLand</h1>
            <span className="text-xs text-slate-400 font-bold tracking-widest uppercase">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <div className="flex items-center space-x-3 px-4 py-4 bg-slate-700 text-white rounded-xl cursor-default border border-slate-600">
            <History size={22} />
            <span className="font-bold text-lg">System History</span>
          </div>
          
          <div className="pt-8 px-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Stats</p>
            <div className="space-y-4">
              <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
                <p className="text-xs text-slate-400 mb-1">Total Logs</p>
                <p className="text-2xl font-bold text-white">{historyData?.length || 0}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600">
                <p className="text-xs text-slate-400 mb-1">Critical Alerts</p>
                <p className="text-2xl font-bold text-slate-200">
                  {historyData?.filter(h => h.type === 'Failed Login Attempts').length || 0}
                </p>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-700">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-full space-x-3 text-slate-300 bg-slate-700 py-4 rounded-lg hover:bg-slate-600 transition-all font-bold group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    );
  }

  // Manager Sidebar - used for both Manager and Employee (default)
  const isEmployeeRole = role === 'EMPLOYEE';
  return (
    <div className={`h-screen ${isEmployeeRole ? 'w-72' : 'w-64'} bg-white/80 backdrop-blur-sm text-slate-700 flex flex-col shadow-sm fixed left-0 top-0 overflow-y-auto z-10 border-r border-slate-200`}>
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-slate-700 font-bold text-xl">G</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">GoodLand CAI</h1>
        </div>
        
        <div className="bg-slate-100 rounded-lg p-2 text-center">
          <span className="text-sm font-semibold text-slate-600">{isEmployeeRole ? 'Employee Panel' : 'Manager Panel'}</span>
        </div>
      </div>
        
      <nav className="flex flex-col space-y-2 px-4">
        {!isEmployeeRole && (
          <>
            <Link 
              to="/manager/dashboard" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('dashboard') 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('dashboard') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
              </div>
              <span>Dashboard</span>
              {location.pathname.includes('dashboard') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>
            
            <Link 
              to="/manager/inventory" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('inventory') 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('inventory') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                </svg>
              </div>
              <span>Inventory</span>
              {location.pathname.includes('inventory') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>
            
            <Link 
              to="/manager/posm" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('posm') 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('posm') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
                </svg>
              </div>
              <span>POSM</span>
              {location.pathname.includes('posm') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>

            <Link 
              to="/manager/history" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('history') 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('history') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <History size={14} className="text-white" />
              </div>
              <span>Activity History</span>
              {location.pathname.includes('history') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>
          </>
        )}
        
        {isEmployeeRole && (
          <>
            <Link 
              to="/employee/pos" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('pos') && !location.pathname.includes('posm')
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('pos') && !location.pathname.includes('posm') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                </svg>
              </div>
              <span>POS</span>
              {location.pathname.includes('pos') && !location.pathname.includes('posm') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>
            
            <Link 
              to="/employee/orders" 
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                location.pathname.includes('orders') 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                location.pathname.includes('orders') ? 'bg-slate-900' : 'bg-slate-400'
              }`}>
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 000 2h3a1 1 0 100-2H7z" clipRule="evenodd"/>
                </svg>
              </div>
              <span>Orders</span>
              {location.pathname.includes('orders') && (
                <div className="absolute right-2 w-2 h-2 bg-slate-900 rounded-full"></div>
              )}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-auto p-6 space-y-3 border-t border-slate-200 bg-slate-50">
        {/* Username */}
        <div className="w-full py-2 px-4 bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-medium flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/>
            <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/>
          </svg>
          {username}
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full py-2 px-4 bg-rose-100 text-rose-700 border border-rose-300 rounded-lg font-medium hover:bg-rose-200 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;