import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Users, AlertTriangle } from 'lucide-react';
import api from '../api';
import SupplierModal from '../components/SupplierModal';

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);

    const { user } = useAuth();
    // Only Owners and Managers should access this page, but we'll double check role here just in case.
    const canEdit = user?.role === 'owner' || user?.role === 'manager';

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/suppliers');
            setSuppliers(res.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingSupplier(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (supplier) => {
        setEditingSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSupplier(null);
    };

    const handleModalSubmit = async (formData) => {
        if (editingSupplier) {
            await api.put(`/suppliers/${editingSupplier.id}`, formData);
        } else {
            await api.post('/suppliers', formData);
        }
        await fetchData();
    };

    const confirmDelete = (supplier) => {
        setSupplierToDelete(supplier);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteSupplier = async () => {
        if (!supplierToDelete) return;
        try {
            await api.delete(`/suppliers/${supplierToDelete.id}`);
            setIsDeleteModalOpen(false);
            setSupplierToDelete(null);
            await fetchData();
        } catch (err) {
            console.error('Error deleting supplier:', err);
            alert(err.response?.data?.message || 'Failed to delete supplier');
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (!canEdit) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <AlertTriangle className="w-16 h-16 text-yellow-500" />
                <h1 className="text-2xl font-bold text-white">Access Denied</h1>
                <p className="text-slate-400">You do not have permission to view or manage suppliers.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Suppliers Management</h1>
                    <p className="text-sm text-slate-400">Manage your supplier network and contact information.</p>
                </div>
                {canEdit && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpenAddModal}
                        className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Supplier
                    </motion.button>
                )}
            </div>

            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search suppliers by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Supplier Name</th>
                                <th className="px-6 py-4 font-medium">Email</th>
                                <th className="px-6 py-4 font-medium">Phone</th>
                                <th className="px-6 py-4 font-medium">Address</th>
                                {canEdit && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading suppliers...</td>
                                </tr>
                            ) : filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Users className="w-12 h-12 text-slate-600 mb-3" />
                                            <p>No suppliers found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((supplier, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={supplier.id} className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-white">{supplier.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{supplier.email || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{supplier.phone || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400 truncate max-w-[200px]">{supplier.address || '-'}</td>
                                        {canEdit && (
                                            <td className="px-6 py-4 text-sm text-right">
                                                <button onClick={() => handleOpenEditModal(supplier)} className="text-slate-400 hover:text-blue-400 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => confirmDelete(supplier)} className="text-slate-400 hover:text-red-400 transition-colors p-1 ml-2"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        )}
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <SupplierModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleModalSubmit}
                initialData={editingSupplier}
            />

            {/* Custom Delete Confirmation Modal */}
            <AnimatePresence>
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card w-full max-w-sm p-6 overflow-hidden flex flex-col"
                        >
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-red-500/20 rounded-full">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white text-center mb-2">Delete Supplier?</h3>
                            <p className="text-sm text-slate-400 text-center mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">&quot;{supplierToDelete?.name}&quot;</span>? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3 w-full">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteSupplier}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Suppliers;
