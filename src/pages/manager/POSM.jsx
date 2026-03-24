import React, { useEffect, useState } from 'react';
import { getMenu, saveMenu, resetMenu, getServiceFees, saveServiceFees } from '../../services/mockDatabase';

const POSM = () => {
  const [menu, setMenu] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Beverages');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showServiceFeesModal, setShowServiceFeesModal] = useState(false);
  
  const [currentItem, setCurrentItem] = useState({});
  const [priceError, setPriceError] = useState('');
  const [serviceFees, setServiceFees] = useState({ dineIn: 3, takeout: 5 });

  useEffect(() => {
    resetMenu();
    getMenu().then(setMenu);
    getServiceFees().then(setServiceFees);
  }, []);

  const categories = ['Beverages', 'Main Dishes', 'Side Dish', 'Desserts'];
  const filteredMenu = menu.filter(m => m.category === selectedCategory);

  const calculateVatAndTotal = (basePrice) => {
    const base = parseFloat(basePrice) || 0;
    const vat = parseFloat((base * 0.12).toFixed(2));
    const total = parseFloat((base + vat).toFixed(2));
    return { base, vat, total };
  };

  const handleSave = async () => {
    if (!currentItem.name || currentItem.basePrice === undefined) {
        alert('Please fill all required fields');
        return;
    }

    const { base, vat, total } = calculateVatAndTotal(currentItem.basePrice);

    const itemToSave = {
      ...currentItem,
      basePrice: base,
      VAT_fee: vat,
      totalPrice: total,
      category: currentItem.category || selectedCategory,
      hasSizes: currentItem.hasSizes || false,
      sizes: currentItem.hasSizes ? currentItem.sizes : undefined
    };

    let updatedMenu = [...menu];
    if (currentItem.id) {
        updatedMenu = updatedMenu.map(m => m.id === currentItem.id ? itemToSave : m);
    } else {
        updatedMenu.push({ ...itemToSave, id: crypto.randomUUID() });
    }

    try {
      await saveMenu(updatedMenu);
      setMenu(updatedMenu);
      setShowAddModal(false);
      setShowEditModal(false);
      setCurrentItem({});
      setPriceError('');
    } catch (error) {
      alert('Failed to save menu item.');
    }
  };

  const handleToggleSizes = (enabled) => {
    if (enabled) {
      const base = parseFloat(currentItem.basePrice) || 0;
      // Pre-calculate suggested prices for S/M/L
      const s = calculateVatAndTotal(base * 0.8);
      const m = calculateVatAndTotal(base);
      const l = calculateVatAndTotal(base * 1.2);

      setCurrentItem({
        ...currentItem,
        hasSizes: true,
        sizes: {
          Small: { basePrice: s.base, VAT_fee: s.vat, totalPrice: s.total },
          Medium: { basePrice: m.base, VAT_fee: m.vat, totalPrice: m.total },
          Large: { basePrice: l.base, VAT_fee: l.vat, totalPrice: l.total }
        }
      });
    } else {
      setCurrentItem({ ...currentItem, hasSizes: false, sizes: undefined });
    }
  };

  const updateSizeBasePrice = (size, newBase) => {
    if (!currentItem.sizes) return;
    const { base, vat, total } = calculateVatAndTotal(newBase);
    setCurrentItem({
      ...currentItem,
      sizes: {
        ...currentItem.sizes,
        [size]: { basePrice: base, VAT_fee: vat, totalPrice: total }
      }
    });
  };

  const handleDelete = async () => {
    if (!currentItem.id) return;
    const updatedMenu = menu.filter(m => m.id !== currentItem.id);
    await saveMenu(updatedMenu);
    setMenu(updatedMenu);
    setShowDeleteModal(false);
  };

  const handleSaveServiceFees = async () => {
    if (isNaN(serviceFees.dineIn) || isNaN(serviceFees.takeout)) {
      alert('Service fees must be numbers');
      return;
    }
    await saveServiceFees(serviceFees);
    setShowServiceFeesModal(false);
  };

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">POS Management</h1>
                <p className="text-gray-600">Configure menu items and drink sizes</p>
            </div>
            <button
              onClick={() => setShowServiceFeesModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
            >
              Service Fees
            </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mb-8">
            {categories.map(cat => (
                <button 
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`p-4 rounded-xl border-2 font-bold text-lg transition-all ${
                        selectedCategory === cat ? 'bg-blue-600 text-white border-blue-700 shadow-lg' : 'bg-white text-gray-700'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>

        <div>
            <h2 className="text-2xl font-bold mb-4">{selectedCategory}</h2>
            <div className="flex flex-wrap gap-4">
                {filteredMenu.map(item => (
                    <div key={item.id} className="w-48 h-48 border-2 rounded-xl flex flex-col items-center justify-between p-3 relative bg-white shadow-lg hover:shadow-xl transition-shadow">
                        {/* Top Action Buttons */}
                        <div className="w-full flex justify-between items-center mb-2">
                          <button onClick={() => { setCurrentItem({...item}); setShowEditModal(true); }} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors">EDIT</button>
                          <button onClick={() => { setCurrentItem(item); setShowDeleteModal(true); }} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors">DELETE</button>
                        </div>
                        
                        {/* Item Name */}
                        <div className="text-center font-bold text-gray-800 text-sm truncate w-full flex-1 flex items-center justify-center">{item.name}</div>
                        
                        {/* Multi-Size Badge */}
                        {item.hasSizes && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 rounded-full font-black mb-2">MULTI-SIZE</span>}
                        
                        {/* Price Section */}
                        <div className="w-full border-t pt-2">
                          <div className="text-sm font-semibold text-green-600 text-center">₱ {item.basePrice?.toFixed(2) || item.totalPrice?.toFixed(2)}</div>
                          <div className="text-xs text-gray-500 text-center">VAT: ₱ {item.VAT_fee?.toFixed(2)}</div>
                          <div className="text-sm font-bold text-green-700 text-center bg-green-50 rounded px-2 py-1 mt-1">₱ {item.totalPrice?.toFixed(2)}</div>
                        </div>
                    </div>
                ))}
                <button onClick={() => { setCurrentItem({ category: selectedCategory, basePrice: 0 }); setShowAddModal(true); }} className="w-48 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:text-blue-500 transition-all text-4xl">+</button>
            </div>
        </div>

        {(showAddModal || showEditModal) && (
            <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-xl mb-6 text-center">{showEditModal ? 'Edit Item' : 'New Item'}</h3>
                    
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Item Name</label>
                    <input className="w-full border rounded-lg p-3 mb-4 font-bold" value={currentItem.name || ''} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} placeholder="e.g. Caramel Macchiato" />

                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Base Price (₱)</label>
                    <input type="number" className="w-full border rounded-lg p-3 mb-4 font-bold" value={currentItem.basePrice || ''} onChange={e => setCurrentItem({...currentItem, basePrice: parseFloat(e.target.value)})} />

                    {selectedCategory === 'Beverages' && (
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-blue-900 text-sm">Enable Drink Sizes</span>
                          <input type="checkbox" checked={currentItem.hasSizes || false} onChange={e => handleToggleSizes(e.target.checked)} className="w-5 h-5" />
                        </div>
                        
                        {currentItem.hasSizes && (
                          <div className="space-y-3 pt-3 border-t border-blue-200">
                            {['Small', 'Medium', 'Large'].map(size => (
                              <div key={size} className="flex items-center gap-3">
                                <span className="w-16 text-xs font-bold text-blue-700">{size}</span>
                                <input 
                                  type="number" 
                                  className="flex-1 border rounded p-1 text-sm font-bold"
                                  value={currentItem.sizes?.[size]?.basePrice || 0}
                                  onChange={e => updateSizeBasePrice(size, parseFloat(e.target.value))}
                                />
                                <span className="text-[10px] text-blue-400 w-16">₱{currentItem.sizes?.[size]?.totalPrice.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="flex-1 py-3 font-bold text-gray-400 hover:text-gray-600 transition-colors">CANCEL</button>
                      <button onClick={handleSave} className="flex-[2] bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-all">SAVE CHANGES</button>
                    </div>
                </div>
            </div>
        )}

        {showDeleteModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white p-8 rounded-xl w-full max-w-sm shadow-2xl">
                    <h3 className="font-bold text-xl mb-4 text-center">Confirm Delete</h3>
                    <p className="text-gray-600 mb-6 text-center">Are you sure you want to delete <strong>{currentItem.name}</strong>? This action cannot be undone.</p>
                    <div className="flex gap-3">
                      <button onClick={() => { setShowDeleteModal(false); setCurrentItem({}); }} className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">CANCEL</button>
                      <button onClick={handleDelete} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">DELETE</button>
                    </div>
                </div>
            </div>
        )}

        {/* Service Fees Settings Modal */}
        {showServiceFeesModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-semibold mb-6 text-center">Service Fees Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Dine In Service Fee (%)</label>
                    <input
                      type="number"
                      value={serviceFees.dineIn}
                      onChange={(e) => setServiceFees({ ...serviceFees, dineIn: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold mb-2">Takeout Service Fee (%)</label>
                    <input
                      type="number"
                      value={serviceFees.takeout}
                      onChange={(e) => setServiceFees({ ...serviceFees, takeout: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 border rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => setShowServiceFeesModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveServiceFees}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-semibold transition-all"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
        )}
    </div>
  );
};

export default POSM;
