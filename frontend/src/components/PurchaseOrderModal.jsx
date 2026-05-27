import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Calendar, FileText, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import Switch from 'react-switch';
import Select from 'react-select';

const defaultPO = {
    po_number: '',
    po_date: '',
    valid_from: '',
    valid_to: '',
    supplier_id: '',
    same_shipping: true,
    shipping_address: '',
    status: 'DRAFT',
    items: [
        { product_id: '', name: '', quantity: 0, unit_price: 0, tax_percentage: 0 }
    ]
};

const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        background: 'rgba(15, 23, 42, 0.5)', // bg-slate-900/50
        borderColor: state.isFocused ? 'rgba(168, 85, 247, 0.5)' : 'rgba(51, 65, 85, 0.5)',
        borderRadius: '0.75rem',
        minHeight: '42px', // matches input py-2.5 height
        boxShadow: state.isFocused ? '0 0 0 2px rgba(168, 85, 247, 0.5)' : 'none',
        '&:hover': {
            borderColor: 'rgba(168, 85, 247, 0.5)'
        }
    }),
    valueContainer: (base) => ({
        ...base,
        padding: '0 12px'
    }),
    singleValue: (base) => ({
        ...base,
        color: 'white',
        margin: 0
    }),
    input: (base) => ({
        ...base,
        color: 'white',
        margin: 0,
        padding: 0
    }),
    menu: (base) => ({
        ...base,
        background: 'rgba(30, 41, 59, 1)', // bg-slate-800
        border: '1px solid rgba(51, 65, 85, 0.5)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        zIndex: 50
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? 'rgba(51, 65, 85, 0.8)' : 'transparent',
        color: 'white',
        padding: '10px 16px',
        '&:active': {
            backgroundColor: 'rgba(71, 85, 105, 1)'
        }
    }),
    placeholder: (base) => ({
        ...base,
        color: '#64748b',
        margin: 0
    })
};

const PurchaseOrderModal = ({ isOpen, onClose, onSave, initialData, suppliers, products, saving }) => {
    const [formData, setFormData] = useState(defaultPO);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    po_number: initialData.po_number || '',
                    po_date: initialData.po_date ? initialData.po_date.split('T')[0] : '',
                    valid_from: initialData.valid_from ? initialData.valid_from.split('T')[0] : '',
                    valid_to: initialData.valid_to ? initialData.valid_to.split('T')[0] : '',
                    same_shipping: initialData.shipping_address ? false : true,
                    shipping_address: initialData.shipping_address || '',
                    items: initialData.items?.length ? initialData.items : defaultPO.items
                });
            } else {
                setFormData(defaultPO);
            }
            setError('');
        }
    }, [isOpen, initialData]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSupplierChange = (selectedOption) => {
        setFormData(prev => ({ ...prev, supplier_id: selectedOption ? selectedOption.value : '' }));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'product_id' && value) {
            const product = products.find(p => p.id === value);
            if (product) {
                newItems[index].unit_price = product.cost_price;
                newItems[index].name = product.name;
            }
        }

        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { product_id: '', name: '', quantity: 0, unit_price: 0, tax_percentage: 0 }]
        }));
    };

    const removeItem = (index) => {
        if (formData.items.length <= 1) return;
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const calculateItemTotal = (item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unit_price) || 0;
        const tax = parseFloat(item.tax_percentage) || 0;
        const subtotal = qty * price;
        return subtotal + (subtotal * (tax / 100));
    };

    const calculateGrandTotal = () => {
        return formData.items.reduce((total, item) => total + calculateItemTotal(item), 0);
    };

    const handleSubmit = async () => {
        if (!formData.supplier_id) {
            setError('Please select a supplier.');
            return;
        }

        const validItems = formData.items.filter(i => i.product_id && i.quantity > 0);
        if (validItems.length === 0) {
            setError('Please add at least one valid item with quantity > 0.');
            return;
        }

        const payload = {
            supplier_id: formData.supplier_id,
            total_amount: calculateGrandTotal(),
            status: formData.status,
            po_number: formData.po_number,
            po_date: formData.po_date || null,
            valid_from: formData.valid_from || null,
            valid_to: formData.valid_to || null,
            shipping_address: formData.same_shipping ? null : formData.shipping_address,
            items: validItems.map(i => ({
                product_id: i.product_id,
                ordered_quantity: parseFloat(i.quantity),
                cost_price: parseFloat(i.unit_price),
                tax_percentage: parseFloat(i.tax_percentage)
            }))
        };

        try {
            await onSave(payload, !!initialData);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
        }
    };

    // Options for react-select
    const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
    const productOptions = products
        .filter(p => !formData.supplier_id || p.supplier_id === formData.supplier_id)
        .map(p => ({
            value: p.id,
            label: p.sku ? `${p.sku} | ${p.name}` : p.name,
            category: p.category_name || 'Uncategorized'
        }));

    // Custom option format to show secondary text nicely in the dropdown menu
    const formatProductOptionLabel = (option, { context }) => (
        context === 'menu' ? (
            <div className="flex flex-col">
                <span className="font-medium text-white">{option.label}</span>
                {option.category && <span className="text-xs text-slate-400 mt-0.5">{option.category}</span>}
            </div>
        ) : (
            <span className="font-medium truncate block">{option.label}</span>
        )
    );

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/90 backdrop-blur-md overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-slate-800/80 border border-slate-700/50 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/40 shrink-0">
                            <h2 className="text-2xl font-bold text-slate-100 text-center flex-1">
                                {initialData ? 'Edit Purchase Order Details' : 'Enter Purchase Order Details'}
                            </h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg hover:bg-slate-700 shrink-0 ml-4">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Form Body */}
                        <div className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                            {error && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Section 1: Top Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Purchase Order No</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FileText className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="po_number"
                                            value={formData.po_number}
                                            onChange={handleFormChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                            placeholder="Customer's Purchase Order No"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Purchase Order Date</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="date"
                                            name="po_date"
                                            value={formData.po_date}
                                            onChange={handleFormChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Valid From</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="date"
                                            name="valid_from"
                                            value={formData.valid_from}
                                            onChange={handleFormChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Valid To</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="date"
                                            name="valid_to"
                                            value={formData.valid_to}
                                            onChange={handleFormChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Bill To / Supplier */}
                            <div className="p-5 border border-slate-700/50 rounded-xl bg-slate-900/30">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-semibold text-slate-200 flex items-center">
                                        <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                                        Bill To (Supplier)
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-medium text-slate-400">Same Shipping Address</span>
                                        <Switch
                                            checked={formData.same_shipping}
                                            onChange={(checked) => setFormData(prev => ({ ...prev, same_shipping: checked }))}
                                            onColor="#8b5cf6" // purple-500
                                            offColor="#334155" // slate-700
                                            checkedIcon={false}
                                            uncheckedIcon={false}
                                            height={20}
                                            width={40}
                                            handleDiameter={16}
                                            className="react-switch"
                                        />
                                    </div>
                                </div>

                                <Select
                                    value={supplierOptions.find(opt => opt.value === formData.supplier_id) || null}
                                    onChange={handleSupplierChange}
                                    options={supplierOptions}
                                    styles={customSelectStyles}
                                    placeholder="Select a supplier"
                                    isClearable
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    menuPlacement="auto"
                                />

                                {!formData.same_shipping && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="mt-4"
                                    >
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 mb-2 block">Shipping Address</label>
                                        <textarea
                                            name="shipping_address"
                                            value={formData.shipping_address}
                                            onChange={handleFormChange}
                                            rows={3}
                                            className="w-full p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm resize-none"
                                            placeholder="Enter the shipping address here..."
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {/* Section 3: Item Details Repeater */}
                            <div className="border border-purple-500/30 rounded-xl bg-slate-900/30 overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="relative border-b border-slate-700/50 last:border-b-0">
                                        <div className="flex items-center justify-between p-4 bg-slate-800/40 border-b border-slate-700/30">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-purple-600/20 text-purple-400 w-6 h-6 rounded flex items-center justify-center text-xs font-bold border border-purple-500/30">
                                                    {index + 1}
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-200">Item Details</h4>
                                            </div>
                                            {formData.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItem(index)}
                                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                                    title="Remove Item"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-5 flex flex-col lg:flex-row gap-4 items-start">
                                            <div className="w-full lg:w-[45%] flex flex-col">
                                                <label className="text-xs font-semibold text-slate-400 mb-1.5 ml-1">Item Selection</label>
                                                <Select
                                                    value={productOptions.find(opt => opt.value === item.product_id) || null}
                                                    onChange={(opt) => handleItemChange(index, 'product_id', opt ? opt.value : '')}
                                                    options={productOptions}
                                                    formatOptionLabel={formatProductOptionLabel}
                                                    styles={customSelectStyles}
                                                    placeholder="Select Items"
                                                    isClearable
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    menuPlacement="auto"
                                                />
                                            </div>
                                            <div className="w-full lg:flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 ml-1">Quantity</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity || ''}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        className="px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 ml-1">Unit Price</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.unit_price || ''}
                                                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                                            className="w-full pl-8 pr-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 ml-1">Tax %</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.tax_percentage || ''}
                                                        onChange={(e) => handleItemChange(index, 'tax_percentage', e.target.value)}
                                                        className="px-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium text-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 ml-1">Total Amount</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700 text-sm">₹</span>
                                                        <input
                                                            type="text"
                                                            disabled
                                                            value={calculateItemTotal(item).toFixed(2)}
                                                            className="w-full pl-8 pr-3 py-2.5 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm cursor-not-allowed"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="p-4 bg-slate-800/20 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="flex items-center bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-500/20"
                                    >
                                        <Plus className="w-4 h-4 mr-1.5" />
                                        Add Item
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="px-8 py-5 border-t border-slate-700/50 bg-slate-900/60 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3 text-slate-300">
                                Status:
                                <select
                                    value={formData.status}
                                    onChange={handleFormChange}
                                    name="status"
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="APPROVED">Approved</option>
                                    <option value="RECEIVED">Received</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-4">
                                    <span className="text-xs text-slate-400 uppercase tracking-wider block">Grand Total</span>
                                    <span className="text-xl font-bold text-white">₹ {calculateGrandTotal().toFixed(2)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Purchase Order'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default PurchaseOrderModal;
