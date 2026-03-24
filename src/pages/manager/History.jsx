import React, { useEffect, useState } from 'react';
import { getTransactions, clearTransactions } from '../../services/mockDatabase';
import { 
  Search, Calendar, Clock, 
  User as UserIcon, Filter, Trash2, ShoppingCart, 
} from 'lucide-react';

const ManagerHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Time');
  const [sortDirection, setSortDirection] = useState('descending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const loadData = async () => {
      // Load POS transactions
      const transactionsData = await getTransactions();
      console.log('💳 [Manager POS Transactions Loaded]', { count: transactionsData.length, items: transactionsData.slice(0, 3) });
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
    };
    loadData();
  }, []);

  const downloadAndBackupCSV = () => {
    const headers = ['Time', 'Date', 'Items', 'Total Amount', 'Payment Received', 'Employee'];
    
    const rows = transactions.map(txn => {
      const itemsList = txn.items.map(item => item.menuItem?.name || 'Unknown').join(', ');
      const rowData = {
        'Time': new Date(txn.timestamp).toLocaleTimeString(),
        'Date': txn.timestamp ? txn.timestamp.split('T')[0] : '',
        'Items': itemsList,
        'Total Amount': `₱${(txn.totalAmount || 0).toFixed(2)}`,
        'Payment Received': `₱${(txn.cashProvided || 0).toFixed(2)}`,
        'Employee': txn.employeeId || 'Unknown'
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
    link.setAttribute('download', `transaction_logs_backup_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('💾 [Transaction Logs Backed Up]', { rows: transactions.length, timestamp: new Date().toISOString() });
  };

  const resetLogs = async () => {
    if (window.confirm('⚠️ This will backup your transaction logs as CSV and delete all records. Are you sure?')) {
      console.log('🔄 [Reset Logs Started]', { action: 'backup and clear', timestamp: new Date().toISOString() });
      // First, download the CSV backup
      downloadAndBackupCSV();
      // Then clear the transactions
      await clearTransactions();
      // Reload transactions state
      const emptyData = await getTransactions();
      setTransactions(Array.isArray(emptyData) ? emptyData : []);
      setCurrentPage(1);
      console.log('✅ [Logs Reset Complete]', { newCount: 0, timestamp: new Date().toISOString() });
      alert('Transaction logs have been backed up and cleared successfully!');
    }
  };


  // Format items list for display
  const formatItems = (items) => {
    if (!Array.isArray(items)) return 'No items';
    return items.map(item => {
      const name = item.menuItem?.name || 'Unknown';
      return `${name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`;
    }).join(', ');
  };

  // Generic comparator function - handles ascending/descending direction
  const createComparator = (direction) => (comparison) => {
    return direction === 'ascending' ? comparison : -comparison;
  };

  // Unified filter change handler - manages both filter type and direction
  const handleFilterChange = (newFilterType) => {
    const isSameFilter = newFilterType === filterType;
    
    if (isSameFilter) {
      // Toggle direction if clicking same filter
      const toggledDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';
      console.log('🔁 [Filter Direction Toggled]', { 
        filter: filterType, 
        oldDirection: sortDirection, 
        newDirection: toggledDirection 
      });
      setSortDirection(toggledDirection);
    } else {
      // Reset to descending when changing filter type
      console.log('📊 [Filter Changed]', { 
        from: filterType, 
        to: newFilterType, 
        newDirection: 'descending' 
      });
      setFilterType(newFilterType);
      setSortDirection('descending');
    }
    
    setCurrentPage(1); // Always reset pagination on filter change
  };

  // Search filter
  const searchFiltered = transactions.filter(txn => {
    const items = formatItems(txn.items).toLowerCase();
    const employeeId = (txn.employeeId || '').toLowerCase();
    return items.includes(searchTerm.toLowerCase()) || 
           employeeId.includes(searchTerm.toLowerCase());
  });

  // Unified sorting function - applies sorting based on filter type and direction
  const applySorting = (data, type, direction) => {
    const comparator = createComparator(direction);
    
    switch(type) {
      case 'Time':
        // Sort by transaction timestamp
        return [...data].sort((a, b) => 
          comparator(new Date(b.timestamp) - new Date(a.timestamp))
        );
      
      case 'Amount':
        // Sort by total amount
        return [...data].sort((a, b) => 
          comparator(b.totalAmount - a.totalAmount)
        );
      
      case 'Employee':
        // Sort by employee name/ID
        return [...data].sort((a, b) => {
          const empA = (a.employeeId || 'Unknown').toLowerCase();
          const empB = (b.employeeId || 'Unknown').toLowerCase();
          return comparator(empA.localeCompare(empB));
        });
      
      default:
        return data;
    }
  };

  // Apply search filter and sorting - unified data pipeline
  const filteredTransactions = applySorting(searchFiltered, filterType, sortDirection);
  
  // Log sorting action for debugging
  const sortIconMap = { 'Time': '⏰', 'Amount': '💰', 'Employee': '👤' };
  console.log(`${sortIconMap[filterType]} [Sorted by ${filterType}]`, { direction: sortDirection, itemCount: filteredTransactions.length });
  
  // Pagination calculation
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  return (
    <div className="w-full flex flex-col bg-gray-50 min-h-screen">
      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-10 py-8 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Transaction Logs</h2>
            <p className="text-gray-600 mt-2 text-sm">View all point-of-sale transactions by employee with payment details</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={resetLogs}
              className="flex items-center space-x-3 bg-red-600 text-white px-8 py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-red-600/20 font-bold text-base active:scale-95"
            >
              <Trash2 size={22} />
              <span>Reset Logs</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          {/* Filters Bar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-wrap gap-6 items-center">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Search by items or employee name..."
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
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    filterType === 'Time'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Time {filterType === 'Time' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleFilterChange('Amount')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    filterType === 'Amount'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Amount {filterType === 'Amount' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleFilterChange('Employee')}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    filterType === 'Employee'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-transparent text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Employee {filterType === 'Employee' && (sortDirection === 'ascending' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Time & Date</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Items Ordered</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Payment Received</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Employee</th>
                  <th className="px-8 py-6 text-sm font-black text-gray-700 uppercase tracking-widest">Order Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-gray-500 text-base italic">
                      No POS transactions found.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2 text-gray-800 font-bold">
                            <Clock size={14} className="text-gray-400" />
                            <span>{new Date(txn.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-500 text-xs mt-1">
                            <Calendar size={12} />
                            <span>{txn.timestamp?.split('T')[0]}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          <ShoppingCart size={16} className="text-green-600" />
                          <span className="text-gray-700 font-medium">{formatItems(txn.items)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          
                          <span className="font-bold text-gray-900">₱{(txn.totalAmount || 0).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-gray-900">₱{(txn.cashProvided || 0).toFixed(2)}</span>
                          {(txn.change || 0) > 0 && (
                            <span className="text-xs text-gray-500">(Change: ₱{(txn.change || 0).toFixed(2)})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                            <UserIcon size={18} />
                          </div>
                          <span className="font-bold text-gray-700">{txn.employeeId || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-purple-100 text-purple-700">
                          {txn.type}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredTransactions.length > 0 && (
              <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 flex items-center justify-center">
                <div className="flex items-center space-x-4">
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

export default ManagerHistory;
