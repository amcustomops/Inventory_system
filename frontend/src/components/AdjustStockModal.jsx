import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Settings, PackageSearch, MapPin, Hash } from 'lucide-react';

const defaultData = {
    product_id: '',
    location_id: '',
    adjustment_type: 'IN', // IN, OUT, ADJUSTMENT
    quantity: ''
};

const AdjustStockModal = ({ isOpen, onClose, onSubmit, products, locations }) => {

    const [formData, setFormData] = useState(defaultData);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFormData(defaultData);
            setError('');
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (Number(formData.quantity) < 0) {
            setError('Quantity must be non-negative');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await onSubmit({
                ...formData,
                quantity: Number(formData.quantity)
            });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred during adjustment');
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
                    className="glass-card w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex justify-between items-center p-6 border-b border-slate-700/50 bg-slate-800/50">
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-indigo-400" />
                            Adjust Stock
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

                        <form id="adjustForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Product Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Select Product *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <PackageSearch className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <select
                                        name="product_id"
                                        required
                                        value={formData.product_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Choose a product...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Target Location */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Location *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MapPin className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <select
                                        name="location_id"
                                        required
                                        value={formData.location_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Target location...</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Adjustment Type Options */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Adjustment Type *</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <label className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border ${formData.adjustment_type === 'IN' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'} transition-all`}>
                                        <input
                                            type="radio"
                                            name="adjustment_type"
                                            value="IN"
                                            checked={formData.adjustment_type === 'IN'}
                                            onChange={handleChange}
                                            className="hidden"
                                        />
                                        <Plus className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-semibold">Add Stock</span>
                                    </label>
                                    <label className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border ${formData.adjustment_type === 'OUT' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'} transition-all`}>
                                        <input
                                            type="radio"
                                            name="adjustment_type"
                                            value="OUT"
                                            checked={formData.adjustment_type === 'OUT'}
                                            onChange={handleChange}
                                            className="hidden"
                                        />
                                        <Minus className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-semibold">Remove Stock</span>
                                    </label>
                                    <label className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border ${formData.adjustment_type === 'ADJUSTMENT' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'} transition-all`}>
                                        <input
                                            type="radio"
                                            name="adjustment_type"
                                            value="ADJUSTMENT"
                                            checked={formData.adjustment_type === 'ADJUSTMENT'}
                                            onChange={handleChange}
                                            className="hidden"
                                        />
                                        <Settings className="w-5 h-5 mb-1" />
                                        <span className="text-xs font-semibold text-center leading-tight">Set Exact Amount</span>
                                    </label>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">
                                    {formData.adjustment_type === 'ADJUSTMENT' ? 'Target Quantity *' : 'Quantity Change *'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Hash className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <input
                                        type="number"
                                        name="quantity"
                                        min="0"
                                        required
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                                        placeholder="0"
                                    />
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
                            form="adjustForm"
                            disabled={loading}
                            className={`px-6 py-2.5 rounded-xl font-medium text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center
                                ${formData.adjustment_type === 'IN' ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-500/30' :
                                    formData.adjustment_type === 'OUT' ? 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-red-500/30' :
                                        'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/30'}`}
                        >
                            {loading ? 'Processing...' : 'Apply Adjustment'}
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AdjustStockModal;
