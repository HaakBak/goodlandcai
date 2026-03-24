import React, { useEffect, useState } from 'react';
import { getHistory, clearHistory, getUsers } from '../../services/mockDatabase';
import { 
  Download, Search, Calendar, Clock, 
  User as UserIcon, Filter, Trash2
} from 'lucide-react';

const AdminView = () => {
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Time');
  const [sortDirection, setSortDirection] = useState('descending');
  const [currentPage, setCurrentPage] = useState(1);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(['Time', 'Date', 'Type', 'Description', 'User', 'Current Role']);
  const itemsPerPage = 9;

  useEffect(() => {
    const loadData = async () => {
      // Load history logs
      const historyData = await getHistory();
      console.log('📋 [History Loaded]', { count: historyData.length, items: historyData.slice(0, 3) });
      setHistory(Array.isArray(historyData) ? historyData : []);
      
      // Load users database
      const usersData = await getUsers();
      console.log('👥 [Users Database Loaded]', { count: usersData.length });
      setUsers(Array.isArray(usersData) ? usersData : []);
    };
    loadData();
  }, []);

  const downloadCSV = () => {
    const allHeaders = ['Time', 'Date', 'Type', 'Description', 'User', 'Current Role'];
    const headers = selectedColumns.length > 0 ? selectedColumns : allHeaders;
    
    const rows = history.map(log => {
      const rowData = {
        'Time': log.time,
        'Date': log.date,
        'Type': log.type,
        'Description': log.description,
        'User': log.user,
        'Current Role': getUserDisplayRole(log)
      };
      
      return headers.map(header => rowData[header] || '');
    });

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
    console.log('💾 [CSV Exported]', { rows: history.length, columns: headers, timestamp: new Date().toISOString() });
    setShowColumnSelector(false);
  };

  const resetLogs = async () => {
    if (window.confirm('⚠️ This will backup your history as CSV and delete all logs. Are you sure?')) {
      console.log('🔄 [Reset Logs Started]', { action: 'backup and clear', timestamp: new Date().toISOString() });
      // First, download the CSV backup
      downloadCSV();
      // Then clear the history
      await clearHistory();
      // Reload history state
      const emptyData = await getHistory();
      setHistory(Array.isArray(emptyData) ? emptyData : []);
      setCurrentPage(1);
      console.log('✅ [Logs Reset Complete]', { newCount: 0, timestamp: new Date().toISOString() });
      alert('History logs have been backed up and cleared successfully!');
    }
  };

  // Get user role from database
  // Returns current role from users database, or logged role if user not found
  const getUserDisplayRole = (logEntry) => {
    if (!logEntry.user) return 'Unknown';
    
    // First, try to find the user in the users database
    const dbUser = users.find(u => u.username === logEntry.user);
    
    if (dbUser && dbUser.role) {
      console.log('🔍 [Role From DB]', { user: logEntry.user, dbRole: dbUser.role, logRole: logEntry.role });
      return dbUser.role; // Return role from database (current role)
    }
    
    // Fallback to logged role
    if (logEntry.role) {
      console.log('🔍 [Role From Log]', { user: logEntry.user, logRole: logEntry.role });
      return logEntry.role;
    }
    
    return 'Unknown';
  };

  // STANDARDIZED: Get role ranking for sorting - returns numeric rank (lower = higher priority)
  const getRoleRank = (logEntry) => {
    const displayRole = getUserDisplayRole(logEntry);
    const roleRankMap = {
      'Administrator': 0,
      'Manager': 1,
      'Employee': 2
    };
    return roleRankMap[displayRole] ?? 3; // Default to 3 for Unknown
  };

  // STANDARDIZED: Get event type ranking - categorizes events for sorting
  const getEventTypeRank = (logType) => {
    const eventRankMap = {
      'Admin Login': 0, 'Manager Login': 0, 'Employee Login': 0,
      'User Signup': 1,
      'Admin Logout': 2, 'Manager Logout': 2, 'Employee Logout': 2,
      'Recipe Change': 3, 'Inventory Change': 3, 'Failed Login Attempts': 3
    };
    return eventRankMap[logType] ?? 4; // Default to 4 for unknown events
  };

  // STANDARDIZED: Generic comparator function - handles ascending/descending direction
  const createComparator = (direction) => (comparison) => {
    return direction === 'ascending' ? comparison : -comparison;
  };

  // STANDARDIZED: Unified filter change handler - manages both filter type and direction
  const handleFilterChange = (newFilterType) => {
    const isSameFilter = newFilterType === filterType;
    
    if (isSameFilter) {
      // STANDARDIZED: Toggle direction if clicking same filter
      const toggledDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';
      console.log('🔁 [Filter Direction Toggled]', { 
        filter: filterType, 
        oldDirection: sortDirection, 
        newDirection: toggledDirection 
      });
      setSortDirection(toggledDirection);
    } else {
      // STANDARDIZED: Reset to descending when changing filter type
      console.log('📊 [Filter Changed]', { 
        from: filterType, 
        to: newFilterType, 
        newDirection: 'descending' 
      });
      setFilterType(newFilterType);
      setSortDirection('descending');
    }
    
    setCurrentPage(1); // STANDARDIZED: Always reset pagination on filter change
  };

  // Search filter
  const searchFiltered = history.filter(log => {
    return log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
           log.user.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // STANDARDIZED: Unified sorting function - applies sorting based on filter type and direction
  const applySorting = (data, type, direction) => {
    const comparator = createComparator(direction);
    
    switch(type) {
      case 'Time':
        // STANDARDIZED: Sort by timestamp in specified direction
        return [...data].sort((a, b) => 
          comparator(new Date(b.timestamp) - new Date(a.timestamp))
        );
      
      case 'Roles':
        // STANDARDIZED: Sort by role rank, then by role appearance
        return [...data].sort((a, b) => 
          comparator(getRoleRank(a) - getRoleRank(b))
        );
      
      case 'Event Type':
        // STANDARDIZED: Sort by event type rank, then by role as tiebreaker
        return [...data].sort((a, b) => {
          const eventDifference = getEventTypeRank(a.type) - getEventTypeRank(b.type);
          if (eventDifference !== 0) return comparator(eventDifference);
          return comparator(getRoleRank(a) - getRoleRank(b));
        });
      
      default:
        return data;
    }
  };

  // STANDARDIZED: Apply search filter and sorting - unified data pipeline
  const filteredHistory = applySorting(searchFiltered, filterType, sortDirection);
  
  // STANDARDIZED: Log sorting action for debugging
  const sortIconMap = { 'Time': '⏰', 'Roles': '👥', 'Event Type': '📋' };
  console.log(`${sortIconMap[filterType]} [Sorted by ${filterType}]`, { direction: sortDirection, itemCount: filteredHistory.length });
  
  // STANDARDIZED: Pagination calculation
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
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={resetLogs}
              className="flex items-center space-x-3 bg-red-600 text-white px-8 py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-red-600/20 font-bold text-base active:scale-95"
            >
              <Trash2 size={22} />
              <span>Reset Logs</span>
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="flex items-center space-x-3 bg-gray-700 text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-gray-700/20 font-bold text-base active:scale-95"
              >
                <Download size={22} />
                <span>Export CSV</span>
              </button>
              
              {/* Column Selector Dropdown */}
              {showColumnSelector && (
                <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-gray-300 rounded-xl shadow-2xl z-50 p-4">
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-widest">Select Columns to Export</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {['Time', 'Date', 'Type', 'Description', 'User', 'Current Role'].map((col) => (
                        <label key={col} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input 
                            type="checkbox" 
                            checked={selectedColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedColumns([...selectedColumns, col]);
                              } else {
                                setSelectedColumns(selectedColumns.filter(c => c !== col));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          />
                          <span className="text-gray-700 font-medium text-sm">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    disabled={selectedColumns.length === 0}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Download CSV
                  </button>
                </div>
              )}
            </div>
          </div>
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
                <span>Sort By:</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => handleFilterChange('Time')}
                  className={`px-4 py-2 rounded-md font-bold transition-all ${
                    filterType === 'Time'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Time {filterType === 'Time' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleFilterChange('Roles')}
                  className={`px-4 py-2 rounded-md font-bold transition-all ${
                    filterType === 'Roles'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Roles {filterType === 'Roles' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleFilterChange('Event Type')}
                  className={`px-4 py-2 rounded-md font-bold transition-all ${
                    filterType === 'Event Type'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Event Type {filterType === 'Event Type' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
              </div>
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
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-gray-500 text-base italic">
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
                          log.type === 'Admin Login' ? 'bg-purple-100 text-purple-700' :
                          log.type === 'Admin Logout' ? 'bg-purple-100 text-purple-700' :
                          log.type === 'Manager Login' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'Manager Logout' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'Employee Login' ? 'bg-green-100 text-green-700' :
                          log.type === 'Employee Logout' ? 'bg-green-100 text-green-700' :
                          log.type === 'User Signup' ? 'bg-yellow-100 text-yellow-700' :
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
                      {/* NEW: Role Column - Displays role from database */}
                      <td className="px-8 py-6">
                        {(() => {
                          const displayRole = getUserDisplayRole(log);
                          return (
                            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                              displayRole === 'Administrator' ? 'bg-red-100 text-red-700' :
                              displayRole === 'Manager' ? 'bg-blue-100 text-blue-700' :
                              displayRole === 'Employee' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {displayRole}
                            </span>
                          );
                        })()}
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
