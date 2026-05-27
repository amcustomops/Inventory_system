import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, FileText, Edit2, Trash2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PurchaseOrderModal from '../components/PurchaseOrderModal';

const PurchaseOrders = () => {
    const { user } = useAuth();
    const canManagePOs = user?.role === 'owner' || user?.role === 'manager';

    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPOs();
        if (canManagePOs) {
            fetchSuppliers();
            fetchProducts();
        }
    }, [canManagePOs]);

    const fetchPOs = async () => {
        try {
            const res = await api.get('/purchase-orders');
            setPos(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/suppliers');
            setSuppliers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSavePO = async (poData, isEdit) => {
        setSaving(true);
        try {
            if (isEdit) {
                await api.put(`/purchase-orders/${selectedPO.id}`, poData);
            } else {
                await api.post('/purchase-orders', poData);
            }
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedPO(null);
            fetchPOs();
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePO = async (poId) => {
        if (!window.confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/purchase-orders/${poId}`);
            fetchPOs();
        } catch (err) {
            console.error('Error deleting PO:', err);
            alert(err.response?.data?.message || 'Error deleting PO');
        }
    };

    const openEditModal = async (po) => {
        try {
            // Need to fetch full PO details including items to populate the new modal
            const res = await api.get(`/purchase-orders/${po.id}`);
            setSelectedPO(res.data);
            setShowEditModal(true);
        } catch (err) {
            console.error('Error fetching PO details:', err);
            alert(err.response?.data?.message || 'Error fetching PO details');
        }
    };

    const statusColors = {
        DRAFT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        RECEIVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };

    const filteredAndSortedPOs = pos
        .filter(po => {
            const searchLower = searchTerm.toLowerCase();
            const poIdString = `po-${String(po.id).padStart(5, '0')}`.toLowerCase();
            const poNumberString = (po.po_number || '').toLowerCase();
            const matchesSearch = po.supplier_name.toLowerCase().includes(searchLower) ||
                poIdString.includes(searchLower) ||
                poNumberString.includes(searchLower) ||
                String(po.id).includes(searchLower);
            const matchesStatus = statusFilter === '' || po.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => a.id - b.id); // Ascending order by ID

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Purchase Orders</h1>
                    <p className="text-sm text-slate-400">Manage supplier orders and receiving process.</p>
                </div>
                {canManagePOs && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setShowCreateModal(true);
                        }}
                        className="flex items-center bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-purple-500/20 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create PO
                    </motion.button>
                )}
            </div>

            {/* Filter and Search Bar */}
            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex flex-col md:flex-row items-center justify-between bg-slate-800/30 gap-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full md:w-auto px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                        <option value="">All Statuses</option>
                        <option value="DRAFT">Draft</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="RECEIVED">Received</option>
                    </select>

                    <div className="relative w-full md:w-72 mt-2 md:mt-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search PO#, Supplier, etc..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">PO Number</th>
                                <th className="px-6 py-4 font-medium">Supplier</th>
                                <th className="px-6 py-4 font-medium">Date Created</th>
                                <th className="px-6 py-4 font-medium">Total Amount</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading purchase orders...</td>
                                </tr>
                            ) : filteredAndSortedPOs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <FileText className="w-12 h-12 text-slate-600 mb-3" />
                                            <p>No purchase orders found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedPOs.map((po, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={po.id} className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-white">{po.po_number || `PO-${String(po.id).padStart(5, '0')}`}</td>
                                        <td className="px-6 py-4 text-sm text-slate-300">{po.supplier_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{new Date(po.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">₹{Number(po.total_amount).toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusColors[po.status] || statusColors.DRAFT}`}>
                                                {po.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right">
                                            {canManagePOs && (
                                                <div className="flex justify-end items-center gap-3">
                                                    <button
                                                        onClick={() => openEditModal(po)}
                                                        className="text-slate-400 hover:text-purple-400 transition-colors p-1"
                                                        title="Edit PO"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePO(po.id)}
                                                        className="text-slate-400 hover:text-red-400 transition-colors p-1"
                                                        title="Delete PO"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shared PO Modal Component for Create and Edit */}
            <PurchaseOrderModal
                isOpen={showCreateModal || showEditModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedPO(null);
                }}
                onSave={handleSavePO}
                initialData={showEditModal ? selectedPO : null}
                suppliers={suppliers}
                products={products}
                saving={saving}
            />
        </div>
    );
};

export default PurchaseOrders;
