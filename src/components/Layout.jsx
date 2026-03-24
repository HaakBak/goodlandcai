
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import NotificationToast from '../components/NotificationToast';
import { getHistory } from '../services/mockDatabase';

const Layout = () => {
  const location = useLocation();
  const isManager = location.pathname.includes('/manager');
  const isEmployee = location.pathname.includes('/employee');
  const isAdmin = location.pathname.includes('/admin');
  const [historyData, setHistoryData] = useState([]);
  const [currentUsername, setCurrentUsername] = useState('');
  
  // POS-specific route path -> make POS full viewport height and non-scrollable
  const isEmployeePOS = location.pathname === '/employee/pos' || location.pathname.includes('/employee/pos');

  useEffect(() => {
    if (isAdmin) {
      const loadHistory = async () => {
        const data = await getHistory();
        setHistoryData(Array.isArray(data) ? data : []);
      };
      loadHistory();
    }
    // Get username from unified sessionStorage key
    const username = sessionStorage.getItem('username');
    setCurrentUsername(username || 'User');
  }, [isAdmin, isManager]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <NotificationToast />

      {/* Admin: sidebar + main content with left margin */}
      {isAdmin ? (
        <>
          <Sidebar role="ADMIN" historyData={historyData} />
          <div className="flex-1 ml-72 transition-all duration-300 ease-in-out h-screen">
            <Outlet />
          </div>
        </>
      ) : isManager ? (
        <>
          <Sidebar role="MANAGER" username={currentUsername} />
          <div className="flex-1 ml-64 transition-all duration-300 ease-in-out">
            <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
              <Outlet />
            </div>
          </div>
        </>
      ) : isEmployee ? (
        /* Employee: full-width main content, reserve space for bottom nav */
        // For the employee POS view we want the content to occupy the full
        // viewport height and prevent page-level scrolling. We keep the
        // bottom nav reserved space (pb-16) so content doesn't overlap it.
        <div className={`${isEmployeePOS ? 'flex-1 pb-20 h-screen overflow-hidden bg-gradient-to-br from-white to-gray-50' : 'flex-1 pb-20 bg-gradient-to-br from-white to-gray-50'} transition-all duration-300 ease-in-out`}>
          <Outlet />
        </div>
      ) : (
        /* Default: just main content */
        <div className="flex-1 bg-gradient-to-br from-white to-gray-50 transition-all duration-300 ease-in-out">
          <Outlet />
        </div>
      )}
      {isEmployee && <BottomNav />}
    </div>
  );
};

export default Layout;
