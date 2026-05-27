import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Plus, Search, MapPin, ArrowRightLeft } from 'lucide-react';
import api from '../api';
import TransferStockModal from '../components/TransferStockModal';
import AdjustStockModal from '../components/AdjustStockModal';

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [products, setProducts] = useState([]);
    const [locations, setLocations] = useState([]);

    const { user } = useAuth();
    const canEdit = user?.role === 'owner' || user?.role === 'manager';

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [invRes, prodRes, locRes, classRes] = await Promise.all([
                api.get('/inventory'),
                api.get('/products'),
                api.get('/locations'),
                api.get('/analytics/classifications').catch(() => ({ data: { classifications: [] } }))
            ]);

            // Map classifications by product_id for O(1) lookup
            const classMap = {};
            if (classRes.data && classRes.data.classifications) {
                classRes.data.classifications.forEach(c => {
                    classMap[c.product_id] = c;
                });
            }

            // Merge into inventory for easy access
            const enrichedInventory = invRes.data.map(item => ({
                ...item,
                ml_classification: classMap[item.product_id] ? classMap[item.product_id].classification : null
            }));

            setInventory(enrichedInventory);
            setProducts(prodRes.data);
            setLocations(locRes.data);
        } catch (err) {
            console.error('Error fetching inventory data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTransferSubmit = async (data) => {
        await api.post('/inventory/transfer', data);
        await fetchData(); // Refresh table
    };

    const handleAdjustSubmit = async (data) => {
        await api.post('/inventory/adjust', data);
        await fetchData(); // Refresh table
    };

    const filteredInventory = inventory.filter(i =>
        i.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.sku?.toLowerCase().includes(search.toLowerCase()) ||
        i.location_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Inventory Management</h1>
                    <p className="text-sm text-slate-400">Track and manage stock levels across all locations.</p>
                </div>
                {canEdit && (
                    <div className="flex space-x-3">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsTransferOpen(true)}
                            className="flex items-center bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                        >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Transfer Stock
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsAdjustOpen(true)}
                            className="flex items-center bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Adjust Stock
                        </motion.button>
                    </div>
                )}
            </div>

            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-800/30">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by product, SKU or location..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Product Name</th>
                                <th className="px-6 py-4 font-medium">SKU</th>
                                <th className="px-6 py-4 font-medium">Location</th>
                                <th className="px-6 py-4 font-medium text-right">Quantity In Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading inventory...</td>
                                </tr>
                            ) : filteredInventory.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                        No inventory records found
                                    </td>
                                </tr>
                            ) : (
                                filteredInventory.map((item, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={item.id} className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-white">{item.product_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            <div className="flex flex-col">
                                                <span>{item.sku}</span>
                                                {item.ml_classification && (
                                                    <span className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block w-fit border ${item.ml_classification.includes('Fast') ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                                        item.ml_classification.includes('Medium') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                            'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                                        }`}>
                                                        {item.ml_classification}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            <div className="flex items-center">
                                                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                                <span>{item.location_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.quantity < 10 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                                                {item.quantity} Units
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <TransferStockModal
                isOpen={isTransferOpen}
                onClose={() => setIsTransferOpen(false)}
                onSubmit={handleTransferSubmit}
                products={products}
                locations={locations}
            />

            <AdjustStockModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                onSubmit={handleAdjustSubmit}
                products={products}
                locations={locations}
            />
        </div>
    );
};

export default Inventory;
