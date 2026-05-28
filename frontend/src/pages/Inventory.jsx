import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MapPin, ArrowRightLeft, Upload, FileSpreadsheet, XCircle, AlertTriangle } from 'lucide-react';
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
    const [isImportOpen, setIsImportOpen] = useState(false);

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
                            onClick={() => setIsImportOpen(true)}
                            className="flex items-center bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 px-4 py-2 rounded-xl text-sm font-medium shadow-md transition-colors"
                        >
                            <Upload className="w-4 h-4 mr-2 text-slate-400" />
                            Import Excel
                        </motion.button>
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

            <AnimatePresence>
                {isImportOpen && (
                    <ImportInventoryModal
                        isOpen={isImportOpen}
                        onClose={() => setIsImportOpen(false)}
                        fetchData={fetchData}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// -------------------------------------------------------------
// Excel Inventory Adjustments Import Component
// -------------------------------------------------------------
const ImportInventoryModal = ({ isOpen, onClose, fetchData }) => {
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
        const headers = ['product_id', 'location_id', 'quantity'];
        const sampleRow = ['1', '1', '120'];
        const sampleRow2 = ['2', '2', '65'];
        
        const csvContent = "\uFEFF" + [headers.join(','), sampleRow.join(','), sampleRow2.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "inventory_adjustment_template.csv");
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
            const res = await api.post("/inventory/import", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            setImportResult(res.data);
            setFile(null);
            fetchData();
        } catch (err) {
            console.error("Inventory import error:", err);
            setUploadError(err.response?.data?.message || "Failed to process inventory adjustments import.");
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
                    <h3 className="text-xl font-bold text-white">Import Inventory</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors font-bold text-xl">&times;</button>
                </div>

                <div className="overflow-y-auto pr-1 space-y-5 flex-1">
                    {/* Required Fields Guide */}
                    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl text-xs space-y-2">
                        <h4 className="font-semibold text-slate-350 flex items-center uppercase tracking-wider text-[10px]">
                            Required Fields Guide
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-450">
                            <div>
                                <span className="text-red-400 font-bold mr-1">*</span>
                                <strong className="text-slate-200">product_id:</strong> Exists in DB
                            </div>
                            <div>
                                <span className="text-red-400 font-bold mr-1">*</span>
                                <strong className="text-slate-200">location_id:</strong> Exists in DB
                            </div>
                            <div>
                                <span className="text-red-400 font-bold mr-1">*</span>
                                <strong className="text-slate-200">quantity:</strong> Non-negative integer
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-450 pt-1 border-t border-slate-700/50">
                            Note: The system will automatically update the inventory count to match this quantity, calculating and logging the respective IN or OUT stock movements automatically.
                        </p>
                    </div>

                    {/* Drag & Drop Zone */}
                    <form onSubmit={handleImportSubmit} className="space-y-4">
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                                dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700/50 hover:border-slate-650 hover:bg-slate-800/10'
                            }`}
                        >
                            <input
                                type="file"
                                id="inventory-file-upload"
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleChange}
                            />
                            <label htmlFor="inventory-file-upload" className="cursor-pointer w-full flex flex-col items-center justify-center">
                                <FileSpreadsheet className="w-10 h-10 text-slate-500 mb-3" />
                                {file ? (
                                    <div>
                                        <p className="text-sm font-semibold text-white">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-slate-300 font-medium">Drag & drop your Excel/CSV here</p>
                                        <p className="text-xs text-slate-500 mt-1">or click to browse from files</p>
                                    </div>
                                )}
                            </label>
                        </div>

                        {uploadError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center space-x-2">
                                <XCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center"
                            >
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Download Template
                            </button>
                            <button
                                type="submit"
                                disabled={!file || importing}
                                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {importing ? 'Processing...' : 'Upload & Import'}
                            </button>
                        </div>
                    </form>

                    {/* Result Logs */}
                    {importResult && (
                        <div className="space-y-3 pt-2 border-t border-slate-700/50">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Import Result</h4>
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                                    <p className="text-[10px] text-slate-400 uppercase">Succeeded</p>
                                    <p className="text-xl font-bold text-emerald-400 mt-0.5">{importResult.successCount}</p>
                                </div>
                                <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl">
                                    <p className="text-[10px] text-slate-400 uppercase">Warnings / Skips</p>
                                    <p className="text-xl font-bold text-orange-400 mt-0.5">{importResult.errorCount}</p>
                                </div>
                            </div>

                            {importResult.errors && importResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Skipped Rows Log</p>
                                    <div className="bg-slate-900/50 border border-slate-750 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="flex justify-between items-start border-b border-slate-800 pb-1.5 last:border-0 last:pb-0">
                                                <span className="font-semibold text-slate-350">Row {err.row} (PID: {err.productId || 'N/A'})</span>
                                                <span className="text-red-400 text-right max-w-[240px]">{err.reason}</span>
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

export default Inventory;
