import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Tag, DollarSign, Archive, Layers, Truck } from 'lucide-react';

const defaultData = {
    name: '',
    sku: '',
    category_id: '',
    supplier_id: '',
    cost_price: '',
    selling_price: '',
    reorder_level: 0,
    ordering_cost: 50.00,
    holding_cost: 2.00,
    track_expiry: false,
    track_batch: false
};

const ProductModal = ({ isOpen, onClose, onSubmit, initialData, categories, suppliers }) => {

    const [formData, setFormData] = useState(defaultData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || defaultData);
            setError('');
        }
    }, [isOpen, initialData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await onSubmit(formData);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="glass-card w-full max-w-[calc(100vw-2rem)] md:max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-800/50">
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <Package className="w-5 h-5 mr-2 text-blue-400" />
                            {initialData ? 'Edit Product' : 'Add New Product'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form id="productForm" onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Product Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Product Name *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Package className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            placeholder="Standard Widget"
                                        />
                                    </div>
                                </div>

                                {/* SKU */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">SKU *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Tag className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            name="sku"
                                            required
                                            value={formData.sku}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            placeholder="WDG-001"
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Category</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Layers className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <select
                                            name="category_id"
                                            value={formData.category_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                                        >
                                            <option value="">No Category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Supplier */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Supplier</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Truck className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <select
                                            name="supplier_id"
                                            value={formData.supplier_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                                        >
                                            <option value="">No Supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Cost Price */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Cost Price *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="number"
                                            name="cost_price"
                                            step="0.01"
                                            min="0"
                                            required
                                            value={formData.cost_price}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Selling Price */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Selling Price *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="number"
                                            name="selling_price"
                                            step="0.01"
                                            min="0"
                                            required
                                            value={formData.selling_price}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Reorder Level */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Reorder Level (Alert Threshold)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Archive className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="number"
                                            name="reorder_level"
                                            min="0"
                                            value={formData.reorder_level}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                {/* Ordering Cost */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Ordering Cost (₹) [ML EOQ]</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <input
                                            type="number"
                                            name="ordering_cost"
                                            step="0.01"
                                            min="0"
                                            value={formData.ordering_cost}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                                            placeholder="50.00"
                                        />
                                    </div>
                                </div>

                                {/* Holding Cost */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Holding Cost (₹) [ML EOQ]</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <input
                                            type="number"
                                            name="holding_cost"
                                            step="0.01"
                                            min="0"
                                            value={formData.holding_cost}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                                            placeholder="2.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="p-6 border-t border-slate-700/50 bg-slate-800/50 flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            form="productForm"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? 'Saving...' : 'Save Product'}
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProductModal;
