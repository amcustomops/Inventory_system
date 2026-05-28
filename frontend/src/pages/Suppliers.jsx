import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Users, AlertTriangle, Upload, FileSpreadsheet, XCircle } from 'lucide-react';
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

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
                    <div className="flex gap-3">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 px-4 py-2 rounded-xl text-sm font-medium shadow-md transition-colors"
                        >
                            <Upload className="w-4 h-4 mr-2 text-slate-400" />
                            Import Excel
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleOpenAddModal}
                            className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Supplier
                        </motion.button>
                    </div>
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

            {/* Custom Import Modal */}
            <AnimatePresence>
                {isImportModalOpen && (
                    <ImportModal 
                        isOpen={isImportModalOpen} 
                        onClose={() => setIsImportModalOpen(false)} 
                        fetchData={fetchData}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// -------------------------------------------------------------
// Excel Suppliers Import Component
// -------------------------------------------------------------
const ImportModal = ({ isOpen, onClose, fetchData }) => {
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (selectedFile) => {
        setUploadError("");
        setImportResult(null);
        const name = selectedFile.name.toLowerCase();
        if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
            setFile(selectedFile);
        } else {
            setUploadError("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
        }
    };

    const downloadTemplate = () => {
        const headers = ['Supplier Name', 'Email', 'Phone', 'Address'];
        const sampleRow = ['TechSource Ltd', 'contact@techsource.com', '+91 98765 43210', '123 Tech Park, Bangalore'];
        
        const csvContent = "\uFEFF" + [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "supplier_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setImporting(true);
        setUploadError("");
        setImportResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post("/suppliers/import", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            setImportResult(res.data);
            setFile(null);
            fetchData();
        } catch (err) {
            console.error("Import error:", err);
            setUploadError(err.response?.data?.message || "Failed to process the suppliers import.");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card w-full max-w-lg p-6 sm:p-8 overflow-hidden flex flex-col my-8 max-h-[90vh]"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Import Suppliers</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors font-bold text-xl">&times;</button>
                </div>

                <div className="overflow-y-auto pr-1 space-y-5 flex-1">
                    {/* Information on Required Fields */}
                    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl text-xs space-y-2">
                        <h4 className="font-semibold text-slate-350 flex items-center uppercase tracking-wider text-[10px]">
                            Required Fields Guide
                        </h4>
                        <div className="text-slate-400 text-xs">
                            <span className="text-red-400 font-bold mr-1">*</span>
                            <strong className="text-slate-200">Supplier Name:</strong> Display name of the vendor/supplier.
                        </div>
                        <div className="pt-2 border-t border-slate-700/30 text-[11px] text-slate-500">
                            <strong className="text-slate-400">Optional:</strong> Email, Phone, Address.
                        </div>
                    </div>

                    {/* Download Template Button */}
                    <div className="flex items-center justify-between bg-slate-800/20 border border-slate-800/50 rounded-xl p-3 text-sm">
                        <span className="text-slate-400">Need a sample format?</span>
                        <button
                            type="button"
                            onClick={downloadTemplate}
                            className="flex items-center text-blue-400 hover:text-blue-300 font-semibold transition-colors text-xs"
                        >
                            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-blue-450" />
                            Download Template
                        </button>
                    </div>

                    {/* Drag & Drop Upload Zone */}
                    <form onSubmit={handleImportSubmit} className="space-y-4">
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                                dragActive 
                                    ? "border-blue-500 bg-blue-500/5" 
                                    : file 
                                        ? "border-emerald-500/50 bg-emerald-500/5" 
                                        : "border-slate-700/80 hover:border-slate-600 bg-slate-800/20"
                            }`}
                        >
                            <Upload className={`w-10 h-10 mb-3 ${file ? "text-emerald-450" : "text-slate-500"}`} />
                            {file ? (
                                <div className="text-center">
                                    <p className="text-sm font-medium text-emerald-450 truncate max-w-[250px]">{file.name}</p>
                                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-300">Drag and drop file here, or <label className="text-blue-400 hover:text-blue-300 cursor-pointer font-semibold underline">browse<input type="file" onChange={handleChange} className="hidden" accept=".xlsx,.xls,.csv" /></label></p>
                                    <p className="text-xs text-slate-500 mt-2">Supports Excel (.xlsx, .xls) and CSV (.csv)</p>
                                </div>
                            )}
                        </div>

                        {uploadError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center">
                                <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        {/* Submit Actions */}
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl text-sm font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={importing || !file}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50"
                            >
                                {importing ? "Processing..." : "Start Import"}
                            </button>
                        </div>
                    </form>

                    {/* Import Summary */}
                    {importResult && (
                        <div className="border-t border-slate-700/50 pt-4 space-y-3">
                            <h4 className="text-sm font-semibold text-white">Import Summary</h4>
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-emerald-500/10 border border-emerald-500/25 p-3 rounded-xl">
                                    <span className="block text-xl font-bold text-emerald-450">{importResult.successCount}</span>
                                    <span className="text-xs text-slate-450">Imported/Updated</span>
                                </div>
                                <div className={`p-3 rounded-xl border ${
                                    importResult.errorCount > 0 
                                        ? "bg-yellow-500/10 border-yellow-500/25" 
                                        : "bg-slate-800/30 border-slate-800"
                                }`}>
                                    <span className={`block text-xl font-bold ${importResult.errorCount > 0 ? "text-yellow-500" : "text-slate-450"}`}>{importResult.errorCount}</span>
                                    <span className="text-xs text-slate-450">Skipped/Warnings</span>
                                </div>
                            </div>

                            {importResult.errors && importResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Warning Logs ({importResult.errors.length})</span>
                                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl max-h-40 overflow-y-auto p-3 text-xs space-y-1.5 font-mono divide-y divide-slate-800/40">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className={`pt-1.5 first:pt-0 text-slate-400 flex gap-2`}>
                                                <span className="text-yellow-500 font-bold shrink-0">[Row {err.row}]</span>
                                                <span className="text-slate-300">{err.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Suppliers;
