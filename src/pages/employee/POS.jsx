import React, { useState, useEffect } from 'react';
import { getMenu, saveTransaction, getTransactions, resetMenu, getBusinessInfo, getServiceFees } from '../../services/mockDatabase';
import { generateReceiptPDF } from '../../services/receiptServices';
import { useNavigate } from 'react-router-dom';

const POS = () => {
  const [menu, setMenu] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState('All');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentInput, setPaymentInput] = useState('');
  const [orderType, setOrderType] = useState('Dine In');
  const [discountType, setDiscountType] = useState('None'); // 'None', 'PWD', or 'Senior'
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [serviceFees, setServiceFees] = useState({ dineIn: 3, takeout: 5 });
  const navigate = useNavigate();

  useEffect(() => {
    // Reset menu to ensure latest prices are loaded and fetch service fees
    resetMenu().then(() => getMenu()).then(setMenu);
    getServiceFees().then(setServiceFees);
  }, []);

  const addToCart = (item, size = null) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id && i.selectedSize === size);
      if (existing) {
        return prev.map(i => (i.menuItem.id === item.id && i.selectedSize === size) ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem: item, quantity: 1, selectedSize: size }];
    });
  };
  

  const removeFromCart = (itemId, selectedSize = null) => {
    setCart(prev => prev.filter(i => !(i.menuItem.id === itemId && i.selectedSize === selectedSize)));
  };

  const updateQuantity = (itemId, delta, selectedSize = null) => {
    setCart(prev => {
      return prev
        .map(i => {
          if (i.menuItem.id === itemId && i.selectedSize === selectedSize) {
            const newQ = i.quantity + delta;
            return newQ > 0 ? { ...i, quantity: newQ } : null;
          }
          return i;
        })
        .filter(i => i !== null);
    });
  };

  const filteredMenu = menu.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) && 
    (category === 'All' || item.category === category)
  );

  // Calculate totals based on totalPrice (VAT-inclusive price shown to customers)
  // Account for size-specific pricing
  const baseAmount = cart.reduce((sum, item) => {
    let itemPrice = item.menuItem.totalPrice;
    // If item has a selected size, use the size-specific price
    if (item.selectedSize && item.menuItem.sizes?.[item.selectedSize]) {
      itemPrice = item.menuItem.sizes[item.selectedSize].totalPrice;
    }
    return sum + (itemPrice * item.quantity);
  }, 0);
  
  // Calculate discount on the total (which already includes VAT)
  const hasDiscount = discountType !== 'None';
  const discountAmount = hasDiscount ? baseAmount * 0.2 : 0; // 20% discount
  const discountedAmount = baseAmount - discountAmount;
  
  // If customer has discount (PWD/Senior), they are exempted from VAT
  // So we subtract the VAT portion from the discounted amount
  const vatPortion = cart.reduce((sum, item) => {
    let itemVAT = item.menuItem.VAT_fee;
    // If item has a selected size, use the size-specific VAT
    if (item.selectedSize && item.menuItem.sizes?.[item.selectedSize]) {
      itemVAT = item.menuItem.sizes[item.selectedSize].VAT_fee;
    }
    return sum + (itemVAT * item.quantity);
  }, 0);
  // Note: For regular customers, VAT is inside the total, so we display it but don't deduct it from the total payable.
  // For PWD/Senior customers, VAT is exempted, so we subtract it from the discounted amount
  const amountAfterDiscount = hasDiscount ? (discountedAmount - vatPortion) : discountedAmount;
  
  // Service fee is calculated as percentage of base amount (Dine In: serviceFees.dineIn%, Takeout: serviceFees.takeout%)
  const serviceFeePercentage = orderType === 'Dine In' ? serviceFees.dineIn : serviceFees.takeout;
  const serviceFee = cart.length > 0 ? (amountAfterDiscount * (serviceFeePercentage / 100)) : 0;
  const totalAmount = amountAfterDiscount + serviceFee;
  
  const change = paymentInput ? parseFloat(paymentInput) - totalAmount : 0;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Please add items before placing an order.');
      return;
    }
    
    if (!paymentInput || parseFloat(paymentInput) < totalAmount) {
      alert('Payment amount is insufficient. Please enter a valid amount.');
      return;
    }
    
    try {
        const transactions = await getTransactions();
        const nextOrderNum = (transactions.length + 1);
        const timeNow = new Date().toLocaleTimeString();

        // 1. Construct Transaction Object
        const newTransaction = {
            id: crypto.randomUUID(),
            orderNumber: nextOrderNum,
            items: cart.map(item => ({
              ...item,
              menuItem: {
                ...item.menuItem,
                totalPrice: item.menuItem.totalPrice || 0,
                VAT_fee: item.menuItem.VAT_fee || 0
              }
            })),
            baseAmount: baseAmount,
            discountType: discountType,
            discountAmount: discountAmount,
            vatPortion: vatPortion,
            serviceFee: serviceFee,
            totalAmount: totalAmount,
            cashProvided: parseFloat(paymentInput),
            change: change,
            type: orderType,
            timeOrdered: timeNow,
            status: 'No'
        };

        // 2. Save Transaction
        await saveTransaction(newTransaction);

        // 3. Generate PDF Receipt
        let pdfError = false;
        try {
            const businessInfo = await getBusinessInfo();
            await generateReceiptPDF(newTransaction, businessInfo);
        } catch (error) {
            console.error("Error generating receipt PDF:", error);
            pdfError = true;
        }

        // 4. Reset UI
        setCart([]);
        setShowCheckoutModal(false);
        setPaymentInput('');
        setDiscountType('None');
        
        // setTimeout to ensure the alert doesn't block the download initiation immediately
        setTimeout(() => {
            if (pdfError) {
                alert('Order Placed Successfully!\n\nNote: Receipt PDF generation failed. Please check console for details.');
            } else {
                alert('Order Placed Successfully! Receipt downloading...');
            }
        }, 500);

    } catch (error) {
        console.error("Error placing order", error);
        alert("Failed to place order. Please try again.");
    }
  };

  return (
    <div className="flex h-screen pb-20 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        {/* Left Side: Checkout */}
        <div className="w-1/3 border-r border-slate-200 bg-white/90 backdrop-blur-sm p-6 flex flex-col shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <button 
                    onClick={() => navigate('/')}
                    className="group flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium hover:from-slate-700 hover:to-slate-800 transition-all duration-300 shadow-sm hover:shadow-md text-sm"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log Out
                </button>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="w-48 pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-all duration-300 text-sm font-normal bg-white shadow-sm hover:shadow-md focus:shadow-md"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mb-6">
                {['Beverages', 'Main Dishes', 'Side Dish', 'Desserts'].map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`group relative px-4 py-2 border rounded-lg text-sm font-medium transition-all duration-200 ${
                            category === cat 
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
                        }`}
                    >
                        <span className="relative z-10">{cat}</span>
                        {category === cat && (
                            <div className="absolute inset-0 bg-slate-800 rounded-lg opacity-5"></div>
                        )}
                    </button>
                ))}
                <button 
                    onClick={() => setCategory('All')}
                    className={`group relative px-4 py-2 border rounded-lg text-sm font-medium transition-all duration-200 ${
                        category === 'All' 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                            : 'bg-white hover:bg-emerald-50 border-emerald-300 text-emerald-700 hover:text-emerald-900'
                    }`}
                >
                    <span className="relative z-10">All Items</span>
                    {category === 'All' && (
                        <div className="absolute inset-0 bg-green-400 rounded-xl animate-pulse opacity-20"></div>
                    )}
                </button>
            </div>

            {/* Order Details List */}
            <div className="flex-1 border border-slate-200 p-4 overflow-y-auto mb-6 rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-center font-semibold text-lg text-slate-800">Order Details</h3>
                    <div className="bg-white text-slate-700 px-3 py-1 rounded-full text-sm font-medium border border-slate-200 shadow-sm">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                    </div>
                </div>
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <p className="text-base font-medium text-slate-500">Cart is empty</p>
                        <p className="text-sm text-slate-400">Add items from the menu</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={`${item.menuItem.id}-${item.selectedSize || 'default'}`} className="flex justify-between items-center border border-slate-200 p-3 mb-3 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{item.menuItem.name}</span>
                                {item.selectedSize && <span className="text-xs text-slate-500">{item.selectedSize}</span>}
                                <span className="text-sm text-slate-600">₱ {item.menuItem.totalPrice}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-base bg-white text-slate-700 px-2 py-1 rounded-md border border-slate-200">x{item.quantity}</span>
                                <button 
                                    onClick={() => updateQuantity(item.menuItem.id, 1, item.selectedSize)} 
                                    className="w-8 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md flex items-center justify-center font-medium text-xs"
                                    title="Add item"
                                >
                                    ADD
                                </button>
                                <button 
                                    onClick={() => updateQuantity(item.menuItem.id, -1, item.selectedSize)} 
                                    className="w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md flex items-center justify-center font-medium text-xs"
                                    title="Remove item"
                                >
                                    SUB
                                </button>
                                <button 
                                    onClick={() => removeFromCart(item.menuItem.id, item.selectedSize)} 
                                    className="w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md flex items-center justify-center font-medium text-xs"
                                    title="Delete from cart"
                                >
                                    DEL
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-slate-200 pt-6 bg-slate-50 rounded-t-lg">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-xl font-semibold text-slate-800">Total:</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold text-emerald-600">₱ {totalAmount.toFixed(2)}</span>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                </div>
                <button 
                    onClick={() => setShowCheckoutModal(true)}
                    disabled={cart.length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-base transition-colors duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg> PLACE ORDER
                </button>
            </div>
        </div>

        {/* Right Side: Menu Grid */}
        <div className="w-2/3 p-6 bg-slate-50">
            <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Menu Items</h2>
                <p className="text-slate-600 text-sm">Click to add items to cart • Hover drinks for sizes</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto h-full pb-24">
                {filteredMenu.length > 0 ? filteredMenu.map(item => {
                    const isFlipped = hoveredItemId === item.id && item.hasSizes;
                    return (
                        <div 
                            key={item.id} 
                            className="h-64 cursor-pointer"
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                        >
                            <div className="relative w-full h-full transition-transform duration-500 transform-gpu" style={{
                                transformStyle: 'preserve-3d',
                                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                            }}>
                                {/* Front of Card */}
                                <div 
                                    className="absolute inset-0 bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-md border border-slate-100 hover:shadow-lg transition-shadow"
                                    style={{ backfaceVisibility: 'hidden' }}
                                    onClick={() => !item.hasSizes && addToCart(item, null)}
                                >
                                    <h3 className="font-bold text-slate-800 text-center text-sm line-clamp-2">{item.name}</h3>
                                    <p className="text-blue-600 font-bold mt-2 text-sm">₱ {item.totalPrice.toFixed(2)}</p>
                                    {item.hasSizes && (
                                        <span className="mt-2 text-[10px] uppercase font-black text-slate-400 tracking-widest">Cup Size</span>
                                    )}
                                </div>

                                {/* Back of Card (Sizes) */}
                                {item.hasSizes && (
                                    <div 
                                        className="absolute inset-0 bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-white shadow-lg"
                                        style={{
                                            backfaceVisibility: 'hidden',
                                            transform: 'rotateY(180deg)'
                                        }}
                                    >
                                        <h3 className="font-bold text-xs mb-3 border-b border-slate-700 pb-2 w-full text-center truncate uppercase tracking-widest">
                                            {item.name}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2 w-full flex-1 flex flex-col justify-center">
                                            {item.sizes && Object.keys(item.sizes).map(size => (
                                                <button 
                                                    key={size} 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addToCart(item, size);
                                                        setHoveredItemId(null);
                                                    }} 
                                                    className="w-full bg-slate-800 hover:bg-blue-600 py-2 rounded-lg text-[10px] font-black uppercase transition-all border border-slate-700 hover:border-blue-400 text-center"
                                                >
                                                    <div>{size}</div>
                                                    <div className="text-[9px] font-normal">₱{item.sizes[size].totalPrice.toFixed(2)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="col-span-5 flex flex-col items-center justify-center py-20 text-slate-400">
                        <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 6.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-lg font-medium mb-2 text-slate-500">No items found</p>
                        <p className="text-sm text-slate-400">Try adjusting your search or category filter</p>
                    </div>
                )}
            </div>
        </div>

        {/* Checkout Modal */}
        {showCheckoutModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl w-96 shadow-xl border border-slate-200">
                    <div className="mb-4">
                        <div className="border-b border-slate-200 pb-3 mb-3">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-slate-600">Subtotal (VAT-Inclusive):</span>
                                <span className="font-semibold text-slate-800">₱ {baseAmount.toFixed(2)}</span>
                            </div>
                            
                            {/* Discount Section */}
                            <div className="mt-3 pt-3 border-t">
                                <p className="text-sm font-semibold mb-2 text-slate-800">Discount:</p>
                                <div className="flex gap-2 mb-2">
                                    <button 
                                        onClick={() => setDiscountType('None')}
                                        className={`flex-1 py-1 text-xs rounded border border-slate-300 font-medium ${discountType === 'None' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        NONE
                                    </button>
                                    <button 
                                        onClick={() => setDiscountType('PWD')}
                                        className={`flex-1 py-1 text-xs rounded border border-slate-300 font-medium ${discountType === 'PWD' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        PWD (20%)
                                    </button>
                                    <button 
                                        onClick={() => setDiscountType('Senior')}
                                        className={`flex-1 py-1 text-xs rounded border border-slate-300 font-medium ${discountType === 'Senior' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        SENIOR (20%)
                                    </button>
                                </div>
                                {hasDiscount && (
                                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                        <span>Discount ({discountType}):</span>
                                        <span>-₱ {discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                {hasDiscount && (
                                    <div className="flex justify-between text-sm text-emerald-600 font-medium mt-1">
                                        <span>VAT Exemption:</span>
                                        <span>-₱ {vatPortion.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Amount after discount and VAT exemption */}
                        <div className="flex justify-between text-sm font-medium mb-2 pb-2 border-b border-slate-200">
                            <span className="text-slate-600">Amount:</span>
                            <span className="font-semibold text-slate-800">₱ {amountAfterDiscount.toFixed(2)}</span>
                        </div>

                        {/* Service Fee */}
                        <div className="flex justify-between text-sm mb-3">
                            <span className="text-slate-600">Service Fee ({orderType === 'Dine In' ? serviceFees.dineIn : serviceFees.takeout}%):</span>
                            <span className="font-semibold text-slate-800">₱ {serviceFee.toFixed(2)}</span>
                        </div>

                        {/* Total Price */}
                        <div className="flex justify-between text-lg font-semibold mb-2 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                            <span className="text-emerald-800">Total Price:</span>
                            <span className="text-emerald-800">₱ {totalAmount.toFixed(2)}</span>
                        </div>

                        {/* Payment Input */}
                        <input 
                            type="number"
                            placeholder="Input Amount"
                            className="w-full p-3 border border-slate-300 rounded-lg mb-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200"
                            value={paymentInput}
                            onChange={e => setPaymentInput(e.target.value)}
                        />

                        {/* Change */}
                        <div className="flex justify-between text-lg font-semibold mb-4 bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-slate-700">Change:</span>
                            <span className="font-semibold text-slate-800">₱ {change >= 0 ? change.toFixed(2) : '---'}</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mb-6">
                        <button 
                            onClick={() => setOrderType('Dine In')}
                            className={`flex-1 py-2 rounded-lg border border-slate-300 font-medium ${orderType === 'Dine In' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-100 text-slate-600'}`}
                        >
                            DINE IN
                        </button>
                        <button 
                            onClick={() => setOrderType('Takeout')}
                            className={`flex-1 py-2 rounded-lg border border-slate-300 font-medium ${orderType === 'Takeout' ? 'bg-white text-slate-800 border-slate-400' : 'bg-slate-100 text-slate-600'}`}
                        >
                            TAKEOUT
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={handlePlaceOrder}
                            disabled={change < 0 || !paymentInput}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            CONFIRM
                        </button>
                        <button 
                            onClick={() => setShowCheckoutModal(false)}
                            className="w-full py-1 text-sm underline text-slate-500 hover:text-slate-700 transition-colors duration-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default POS;