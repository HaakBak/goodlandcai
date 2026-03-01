import React, { useEffect, useState } from 'react';
import { getHistory } from '../../services/mockDatabase';
import { 
  Download, Search, Calendar, Clock, 
  User as UserIcon, Filter
} from 'lucide-react';

const AdminView = () => {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Time');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const loadHistory = async () => {
      const data = await getHistory();
      setHistory(Array.isArray(data) ? data : []);
    };
    loadHistory();
  }, []);

  const downloadCSV = () => {
    const headers = ['Time', 'Date', 'Type', 'Description', 'User'];
    const rows = history.map(log => [
      log.time,
      log.date,
      log.type,
      log.description,
      log.user
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `system_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get user role from log type or description
  const getUserRole = (log) => {
    if (log.type === 'Admin Login' || log.type === 'Admin Logout') return 0; // Admin
    if (log.type === 'Manager Login' || log.type === 'Manager Signup' || log.type === 'Manager Logout') return 1; // Manager
    return 2; // Employee
  };

  // Get event type ranking
  const getEventTypeRank = (logType) => {
    if (logType === 'Admin Login' || logType === 'Manager Login' || logType === 'Employee Login') return 0; // Login
    if (logType === 'Manager Signup') return 1; // Signup
    return 2; // Updates (Logout, Recipe Change, Inventory Change, Failed Attempts)
  };

  // Search filter
  const searchFiltered = history.filter(log => {
    return log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
           log.user.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Sort based on filter type
  let filteredHistory = [...searchFiltered];
  
  if (filterType === 'Time') {
    filteredHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (filterType === 'Roles') {
    filteredHistory.sort((a, b) => getUserRole(a) - getUserRole(b));
  } else if (filterType === 'Event Type') {
    filteredHistory.sort((a, b) => {
      const rankA = getEventTypeRank(a.type);
      const rankB = getEventTypeRank(b.type);
      if (rankA !== rankB) return rankA - rankB;
      return getUserRole(a) - getUserRole(b);
    });
  }

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  return (
    <div className="w-full flex flex-col bg-gray-50 min-h-screen">
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-10 py-8 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">System History</h2>
            <p className="text-gray-600 mt-2 text-sm">Monitor all system activities and security events</p>
          </div>
          
          <button 
            onClick={downloadCSV}
            className="flex items-center space-x-3 bg-gray-700 text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-gray-700/20 font-bold text-base active:scale-95"
          >
            <Download size={22} />
            <span>Export CSV</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          {/* Filters Bar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap gap-6 items-center">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Search by description or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-300 rounded-xl focus:border-gray-500 focus:bg-white transition-all outline-none"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-700 font-bold">
                <Filter size={18} />
                <span>Filter:</span>
              </div>
              <select 
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border-2 border-gray-300 rounded-xl px-6 py-4 outline-none focus:border-gray-500 transition-all font-bold text-gray-700"
              >
                <option value="Time">Time</option>
                <option value="Roles">User Roles</option>
                <option value="Event Type">Event Type</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Time & Date</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Event Type</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Description</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-gray-500 text-base italic">
                      No history logs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2 text-gray-800 font-bold">
                            <Clock size={14} className="text-gray-400" />
                            <span>{log.time}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-500 text-xs mt-1">
                            <Calendar size={12} />
                            <span>{log.date}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                          log.type === 'Failed Login Attempts' ? 'bg-red-100 text-red-700' :
                          log.type === 'Admin Login' || log.type === 'Manager Login' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'Manager Signup' || log.type === 'Employee Login' ? 'bg-green-100 text-green-700' :
                          log.type === 'Employee Logout' ? 'bg-yellow-100 text-yellow-700' :
                          log.type === 'Recipe Change' ? 'bg-purple-100 text-purple-700' :
                          log.type === 'Inventory Change' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-gray-700 font-medium leading-relaxed max-w-md">
                          {log.description}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 group-hover:bg-gray-300 group-hover:text-gray-800 transition-colors">
                            <UserIcon size={18} />
                          </div>
                          <span className="font-bold text-gray-700">{log.user}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredHistory.length > 0 && (
              <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 flex items-center justify-center">
                <div className="flex  items-center space-x-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold"
                  >
                    Previous
                  </button>

                  <div className="text-sm font-bold text-gray-700 min-w-[120px] text-center">
                    Page {currentPage} of {totalPages}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminView;
