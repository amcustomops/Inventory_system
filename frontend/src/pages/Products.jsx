import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, PackageSearch, AlertTriangle } from 'lucide-react';
import api from '../api';
import ProductModal from '../components/ProductModal';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const { user } = useAuth();
    const canEdit = user?.role === 'owner' || user?.role === 'manager';

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prodRes, catRes, supRes, classRes] = await Promise.all([
                api.get('/products'),
                api.get('/categories'),
                api.get('/suppliers'),
                api.get('/analytics/classifications').catch(() => ({ data: { classifications: [] } }))
            ]);

            // Map classifications
            const classMap = {};
            if (classRes.data && classRes.data.classifications) {
                classRes.data.classifications.forEach(c => {
                    classMap[c.product_id] = c;
                });
            }

            setProducts(prodRes.data.map(p => ({
                ...p,
                ml_classification: classMap[p.id] ? classMap[p.id].classification : null
            })));
            setCategories(catRes.data);
            setSuppliers(supRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleModalSubmit = async (formData) => {
        if (editingProduct) {
            await api.put(`/products/${editingProduct.id}`, formData);
        } else {
            await api.post('/products', formData);
        }
        await fetchData();
    };

    const confirmDelete = (product) => {
        setProductToDelete(product);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteProduct = async () => {
        if (!productToDelete) return;
        try {
            await api.delete(`/products/${productToDelete.id}`);
            setIsDeleteModalOpen(false);
            setProductToDelete(null);
            await fetchData();
        } catch (err) {
            console.error('Error deleting product:', err);
            alert(err.response?.data?.message || 'Failed to delete product');
        }
    };

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Product Catalog</h1>
                    <p className="text-sm text-slate-400">Manage all items, categories, and pricing systems globally.</p>
                </div>
                {canEdit && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpenAddModal}
                        className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Product
                    </motion.button>
                )}
            </div>

            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-800/30">
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search products..."
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
                                <th className="px-6 py-4 font-medium">Product Name</th>
                                <th className="px-6 py-4 font-medium">SKU</th>
                                <th className="px-6 py-4 font-medium">Category</th>
                                <th className="px-6 py-4 font-medium">Supplier</th>
                                <th className="px-6 py-4 font-medium">Cost Price</th>
                                <th className="px-6 py-4 font-medium">Selling Price</th>
                                {canEdit && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Loading products...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <PackageSearch className="w-12 h-12 text-slate-600 mb-3" />
                                            <p>No products found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={product.id} className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-white">{product.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            <div className="flex flex-col">
                                                <span>{product.sku}</span>
                                                {product.ml_classification && (
                                                    <span className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block w-fit border ${product.ml_classification.includes('Fast') ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                                        product.ml_classification.includes('Medium') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                            'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                                        }`}>
                                                        {product.ml_classification}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            <span className="px-2 py-1 bg-slate-700/50 rounded-md text-xs">{product.category_name || 'Uncategorized'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{product.supplier_name || 'No Supplier'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">₹{Number(product.cost_price).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-white font-medium">₹{Number(product.selling_price).toFixed(2)}</td>
                                        {canEdit && (
                                            <td className="px-6 py-4 text-sm text-right">
                                                <button onClick={() => handleOpenEditModal(product)} className="text-slate-400 hover:text-blue-400 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => confirmDelete(product)} className="text-slate-400 hover:text-red-400 transition-colors p-1 ml-2"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        )}
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleModalSubmit}
                initialData={editingProduct}
                categories={categories}
                suppliers={suppliers}
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
                            <h3 className="text-lg font-bold text-white text-center mb-2">Delete Product?</h3>
                            <p className="text-sm text-slate-400 text-center mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">&quot;{productToDelete?.name}&quot;</span>? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3 w-full">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteProduct}
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

export default Products;
