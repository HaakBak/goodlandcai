import React, { useEffect, useState } from 'react';
import { getTransactions, updateTransactionStatus } from '../../services/mockDatabase';

const Orders = () => {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    const allTransactions = await getTransactions();
    setOrders(allTransactions.filter(t => t.status === 'No'));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleComplete = async (id) => {
    try {
      await updateTransactionStatus(id);
      await fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      alert('Error completing order. Please try again.');
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-8 pb-24 overflow-x-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">Active Orders</h1>
        <p className="text-gray-600">Manage and complete pending orders</p>
      </div>
      
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
          <svg className="w-24 h-24 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-2xl text-gray-400 font-semibold mb-2">No active orders</h2>
          <p className="text-gray-500">All orders have been completed!</p>
        </div>
      ) : (
        <div className="flex gap-6 min-w-max">
            {orders.map(order => (
                <div key={order.id} className="w-72 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 relative flex flex-col hover:scale-105">
                    <div className="absolute top-4 right-4 w-3 h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full animate-pulse shadow-lg"></div>
                    
                    <div className="border-b border-gray-200 pb-3 mb-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-4 py-2 rounded-full font-bold text-lg shadow-md">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            #{String(order.orderNumber).padStart(3, '0')}
                        </div>
                    </div>
                    
                    <div className="mb-4 text-sm flex-1">
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 mb-3 border border-gray-200">
                            <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2 1 1 0 100-2 2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clipRule="evenodd"/>
                                </svg>
                                Order Items
                            </h4>
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center mb-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">{item.menuItem.name}</span>
                                        {item.selectedSize && <span className="text-xs text-gray-500">{item.selectedSize}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-semibold">x{item.quantity}</span>
                                        <span className="font-semibold text-gray-800">₱ {(() => {
                                            let price = item.menuItem.totalPrice;
                                            if (item.selectedSize && item.menuItem.sizes?.[item.selectedSize]) {
                                                price = item.menuItem.sizes[item.selectedSize].totalPrice;
                                            }
                                            return (price * item.quantity).toFixed(2);
                                        })()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-gray-200 my-3 pt-3 text-xs mb-3">
                        <div className="space-y-2">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal:</span>
                                <span className="font-semibold">₱ {order.baseAmount?.toFixed(2) || order.totalAmount.toFixed(2)}</span>
                            </div>
                            
                            {order.discountAmount > 0 && (
                                <div className="flex justify-between text-green-700 font-semibold bg-gradient-to-r from-green-50 to-green-100 p-2 rounded-lg border border-green-200">
                                    <span>{order.discountType} Discount:</span>
                                    <span>-₱ {order.discountAmount?.toFixed(2)}</span>
                                </div>
                            )}
                            
                            {order.discountAmount > 0 && order.vatPortion !== undefined && (
                                <div className="flex justify-between text-green-700 font-semibold bg-gradient-to-r from-green-50 to-green-100 p-2 rounded-lg border border-green-200">
                                    <span>VAT Exemption:</span>
                                    <span>-₱ {order.vatPortion.toFixed(2)}</span>
                                </div>
                            )}
                            
                            {order.serviceFee !== undefined && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Service Fee:</span>
                                    <span className="font-semibold">₱ {order.serviceFee.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-gray-200 my-3 pt-3 flex justify-between font-bold text-lg bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-xl">
                        <span className="text-gray-700">Total:</span>
                        <span className="text-xl bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">₱ {typeof order.totalAmount === 'object' ? order.baseAmount.toFixed(2) : order.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-gray-200 my-3 pt-3 text-xs space-y-2">
                        {order.cashProvided !== undefined && (
                            <div className="flex justify-between bg-gradient-to-r from-blue-50 to-blue-100 p-2 rounded-lg border border-blue-200">
                                <span className="text-blue-700 font-medium">Cash Received:</span>
                                <span className="font-semibold text-blue-800">₱ {order.cashProvided.toFixed(2)}</span>
                            </div>
                        )}
                        {order.change !== undefined && (
                            <div className="flex justify-between bg-gradient-to-r from-green-50 to-green-100 p-2 rounded-lg border border-green-200">
                                <span className="text-green-700 font-medium">Change:</span>
                                <span className="font-semibold text-green-800">₱ {order.change.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-gray-600">
                            <span className="inline-flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                                </svg>
                                {order.type}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {order.timeOrdered}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => handleComplete(order.id)}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Complete Order
                    </button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default Orders;