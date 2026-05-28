import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Upload, FileSpreadsheet, TrendingUp, AlertTriangle, XCircle, ShoppingBag } from 'lucide-react';
import api from '../api';

const Sales = () => {
    const [sales, setSales] = useState([]);
    const [products, setProducts] = useState([]);
    const [locations, setLocations] = useState([]);
    const [inventory, setInventory] = useState([]);

    const { user } = useAuth();
    const canImport = user?.role === 'owner' || user?.role === 'manager';

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [salesRes, prodRes, locRes, invRes] = await Promise.all([
                api.get('/sales'),
                api.get('/products'),
                api.get('/locations'),
                api.get('/inventory').catch(() => ({ data: [] }))
            ]);

            setSales(salesRes.data);
            setProducts(prodRes.data);
            setLocations(locRes.data);
            setInventory(invRes.data);
        } catch (err) {
            console.error('Error fetching sales data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRecordSubmit = async (formData) => {
        await api.post('/sales', formData);
        await fetchData();
    };

    // Filter sales history
    const filteredSales = sales.filter(s =>
        s.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
        s.location_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.sale_date?.toLowerCase().includes(search.toLowerCase())
    );

    // Compute simple KPIs
    const totalTransactions = filteredSales.length;
    const totalUnitsSold = filteredSales.reduce((acc, curr) => acc + curr.quantity_sold, 0);

    return (
        <div className="space-y-6 relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Sales History</h1>
                    <p className="text-sm text-slate-400">Track and record product dispatches, store outflows, and direct client sales.</p>
                </div>
                <div className="flex gap-3">
                    {canImport && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 px-4 py-2 rounded-xl text-sm font-medium shadow-md transition-colors"
                        >
                            <Upload className="w-4 h-4 mr-2 text-slate-400" />
                            Import Excel
                        </motion.button>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsRecordModalOpen(true)}
                        className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Record Sale
                    </motion.button>
                </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-6 flex items-center space-x-4 bg-slate-800/20 border border-slate-700/50 rounded-2xl">
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 uppercase tracking-wider font-semibold">Total Transactions</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{totalTransactions}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 flex items-center space-x-4 bg-slate-800/20 border border-slate-700/50 rounded-2xl">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 uppercase tracking-wider font-semibold">Total Units Sold</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{totalUnitsSold}</h3>
                    </div>
                </div>
            </div>

            {/* Main table container */}
            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-800/30">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by product name, SKU, location, or date..."
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
                                <th className="px-6 py-4 font-medium">Sale Date</th>
                                <th className="px-6 py-4 font-medium">Product Name</th>
                                <th className="px-6 py-4 font-medium">SKU</th>
                                <th className="px-6 py-4 font-medium">Location</th>
                                <th className="px-6 py-4 font-medium text-right">Quantity Sold</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading sales records...</td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <ShoppingBag className="w-12 h-12 text-slate-600 mb-3" />
                                            <p>No sales records found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        key={sale.id}
                                        className="hover:bg-slate-800/30 transition-colors group"
                                    >
                                        <td className="px-6 py-4 text-sm text-slate-400">
                                            {new Date(sale.sale_date).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">{sale.product_name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{sale.product_sku}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{sale.location_name}</td>
                                        <td className="px-6 py-4 text-sm font-semibold text-white text-right">
                                            {sale.quantity_sold}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {isRecordModalOpen && (
                    <RecordSaleModal
                        isOpen={isRecordModalOpen}
                        onClose={() => setIsRecordModalOpen(false)}
                        onSubmit={handleRecordSubmit}
                        products={products}
                        locations={locations}
                        inventory={inventory}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isImportModalOpen && (
                    <ImportSalesModal
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
// Record Manual Sale Modal
// -------------------------------------------------------------
const RecordSaleModal = ({ isOpen, onClose, onSubmit, products, locations, inventory }) => {
    const [productId, setProductId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [quantitySold, setQuantitySold] = useState('');
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [availableStock, setAvailableStock] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch and check available stock whenever product or location changes
    useEffect(() => {
        if (productId && locationId) {
            const stockRecord = inventory.find(
                inv => inv.product_id?.toString() === productId.toString() && 
                       inv.location_id?.toString() === locationId.toString()
            );
            setAvailableStock(stockRecord ? Number(stockRecord.quantity) : 0);
        } else {
            setAvailableStock(null);
        }
    }, [productId, locationId, inventory]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const qty = parseInt(quantitySold, 10);
        if (isNaN(qty) || qty <= 0) {
            setError('Please enter a valid positive quantity.');
            return;
        }

        if (availableStock !== null && qty > availableStock) {
            setError(`Insufficient stock. Only ${availableStock} units available at this location.`);
            return;
        }

        setLoading(true);
        try {
            await onSubmit({
                product_id: productId,
                location_id: locationId,
                quantity_sold: qty,
                sale_date: saleDate
            });
            onClose();
        } catch (err) {
            console.error('Error recording sale:', err);
            setError(err.response?.data?.message || 'Failed to record transaction.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                    <h2 className="text-xl font-bold text-white">Record Sale</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-bold text-xl"
                    >
                        &times;
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form id="record-sale-form" onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center space-x-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Product *
                            </label>
                            <select
                                required
                                value={productId}
                                onChange={(e) => setProductId(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="" disabled className="bg-slate-900">-- Select Product --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id} className="bg-slate-900">
                                        {p.name} ({p.sku})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Location *
                            </label>
                            <select
                                required
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="" disabled className="bg-slate-900">-- Select Location --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id} className="bg-slate-900">
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {availableStock !== null && (
                            <div className={`p-3 rounded-lg text-xs font-semibold ${availableStock > 0 ? 'bg-slate-800/40 text-blue-400 border border-blue-500/10' : 'bg-red-500/5 text-red-400 border border-red-500/10'}`}>
                                Available Stock at Selected Location: {availableStock} units
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Quantity Sold *
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="Enter units sold"
                                value={quantitySold}
                                onChange={(e) => setQuantitySold(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                Sale Date *
                            </label>
                            <input
                                type="date"
                                required
                                max={new Date().toISOString().split('T')[0]}
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-slate-700/50 bg-slate-800/20 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="record-sale-form"
                        disabled={loading || (availableStock !== null && availableStock <= 0)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {loading ? 'Recording...' : 'Register Sale'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// -------------------------------------------------------------
// Excel Sales Import Component
// -------------------------------------------------------------
const ImportSalesModal = ({ isOpen, onClose, fetchData }) => {
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
        const headers = ['product_id', 'location_id', 'quantity_sold', 'sale_date'];
        const sampleRow = ['1', '1', '15', '2026-05-27'];
        
        const csvContent = "\uFEFF" + [headers.join(','), sampleRow.join(',')].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "sales_import_template.csv");
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
            const res = await api.post("/sales/import", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            setImportResult(res.data);
            setFile(null);
            fetchData();
        } catch (err) {
            console.error("Sales import error:", err);
            setUploadError(err.response?.data?.message || "Failed to process sales history import.");
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
                    <h3 className="text-xl font-bold text-white">Import Sales History</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors font-bold text-xl">&times;</button>
                </div>

                <div className="overflow-y-auto pr-1 space-y-5 flex-1">
                    {/* Required Fields Guide */}
                    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl text-xs space-y-2">
                        <h4 className="font-semibold text-slate-350 flex items-center uppercase tracking-wider text-[10px]">
                            Required Fields Guide
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-slate-400">
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
                                <strong className="text-slate-200">quantity_sold:</strong> Positive integer
                            </div>
                            <div>
                                <span className="text-red-400 font-bold mr-1">*</span>
                                <strong className="text-slate-200">sale_date:</strong> YYYY-MM-DD
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-450 pt-1 border-t border-slate-700/50">
                            Note: Sale Date cannot be in the future. Rows with insufficient stock at the specified location will be skipped.
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
                                id="sales-file-upload"
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleChange}
                            />
                            <label htmlFor="sales-file-upload" className="cursor-pointer w-full flex flex-col items-center justify-center">
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

export default Sales;
