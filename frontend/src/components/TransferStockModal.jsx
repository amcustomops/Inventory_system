import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, PackageSearch, MapPin, Hash } from 'lucide-react';

const defaultData = {
    product_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: ''
};

const TransferStockModal = ({ isOpen, onClose, onSubmit, products, locations }) => {

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

        if (formData.from_location_id === formData.to_location_id) {
            setError('Source and destination locations cannot be the same');
            return;
        }

        if (Number(formData.quantity) <= 0) {
            setError('Quantity must be greater than zero');
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
            setError(err.response?.data?.message || err.message || 'An error occurred during transfer');
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
                            <ArrowRightLeft className="w-5 h-5 mr-2 text-blue-400" />
                            Transfer Stock
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

                        <form id="transferForm" onSubmit={handleSubmit} className="space-y-6">
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
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Choose a product...</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Source Location */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">From Location *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MapPin className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <select
                                        name="from_location_id"
                                        required
                                        value={formData.from_location_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Origin location...</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Destination Location */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">To Location *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MapPin className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <select
                                        name="to_location_id"
                                        required
                                        value={formData.to_location_id}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                                    >
                                        <option value="">Destination location...</option>
                                        {locations.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Transfer Quantity *</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Hash className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <input
                                        type="number"
                                        name="quantity"
                                        min="1"
                                        required
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
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
                            form="transferForm"
                            disabled={loading}
                            className="px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? 'Processing...' : 'Transfer Stock'}
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TransferStockModal;
