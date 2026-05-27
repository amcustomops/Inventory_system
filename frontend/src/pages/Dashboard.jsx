import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertTriangle, Target, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';

const StatCard = ({ title, value, icon: Icon, colorClass, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="glass-card p-6 relative overflow-hidden group"
    >
        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 ${colorClass}`} />
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-white">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-opacity-20 ${colorClass}`}>
                <Icon className={`w-6 h-6 object-contain`} />
            </div>
        </div>
    </motion.div>
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        lowStockCount: 0,
        totalValue: 0,
        pendingPOs: 0,
        inventoryData: []
    });
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [predictionLoading, setPredictionLoading] = useState(false);

    // Time Series Forecast Stat
    const [forecast, setForecast] = useState(null);
    const [forecastLoading, setForecastLoading] = useState(false);

    // Anomaly Detection Stat
    const [deadStock, setDeadStock] = useState([]);

    // Expiry Risk Stat
    const [expiryRisk, setExpiryRisk] = useState([]);

    // Auto PO state
    const [poLoading, setPoLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [dashRes, prodRes, deadRes, expiryRes] = await Promise.all([
                    api.get('/analytics/dashboard'),
                    api.get('/products'),
                    api.get('/analytics/dead-stock').catch(() => ({ data: { anomalies: [] } })),
                    api.get('/analytics/expiry-risk').catch(() => ({ data: { expiry_risks: [] } }))
                ]);
                setStats(dashRes.data);
                setProducts(prodRes.data);
                if (deadRes.data && deadRes.data.anomalies) {
                    setDeadStock(deadRes.data.anomalies);
                }
                if (expiryRes.data && expiryRes.data.expiry_risks) {
                    setExpiryRisk(expiryRes.data.expiry_risks);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const fetchPrediction = async (productId) => {
        if (!productId) {
            setPrediction(null);
            setForecast(null);
            return;
        }
        setPredictionLoading(true);
        try {
            const res = await api.get(`/analytics/predictions/${productId}`);
            setPrediction(res.data);
        } catch (err) {
            console.error('Error fetching prediction:', err);
            setPrediction(null);
        } finally {
            setPredictionLoading(false);
        }
    };

    const fetchForecast = async (productId) => {
        if (!productId) {
            setForecast(null);
            return;
        }
        setForecastLoading(true);
        try {
            const res = await api.get(`/analytics/forecast/${productId}`);
            setForecast(res.data);
        } catch (err) {
            console.error('Error fetching forecast:', err);
            setForecast(null);
        } finally {
            setForecastLoading(false);
        }
    };

    const handleCreatePO = async () => {
        if (!prediction || !selectedProductId) return;
        setPoLoading(true);
        try {
            const payload = {
                product_id: parseInt(selectedProductId),
                recommended_qty: prediction.recommended_reorder,
                expected_demand: prediction.expected_demand_14d,
                confidence: prediction.confidence
            };
            const res = await api.post('/purchase-orders/auto-generate', payload);
            alert(`Purchase Order #${res.data.po_id} successfully auto-generated!`);

            // Refresh dashboard stats
            const dashRes = await api.get('/analytics/dashboard');
            setStats(dashRes.data);
        } catch (err) {
            console.error('Error generating PO:', err);
            alert(err.response?.data?.message || 'Failed to generate Purchase Order');
        } finally {
            setPoLoading(false);
        }
    };

    const handleProductChange = (e) => {
        const val = e.target.value;
        setSelectedProductId(val);
        fetchPrediction(val);
        fetchForecast(val);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full text-slate-400">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Overview Dashboard</h1>
                    <p className="text-sm text-slate-400">Your smart inventory metrics at a glance.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <StatCard
                    title="Total Inventory Value"
                    value={`₹${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={Target}
                    colorClass="bg-blue-500 text-blue-400"
                    delay={0.1}
                />
                <StatCard
                    title="Low Stock Items"
                    value={stats.lowStockCount}
                    icon={AlertTriangle}
                    colorClass="bg-red-500 text-red-400"
                    delay={0.2}
                />
                <StatCard
                    title="Pending Purchase Orders"
                    value={stats.pendingPOs}
                    icon={Package}
                    colorClass="bg-amber-500 text-amber-400"
                    delay={0.3}
                />
            </div>

            {/* Dead Stock Alert Banner */}
            <AnimatePresence>
                {deadStock.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start space-x-4 shadow-lg shadow-red-500/5 mt-6"
                    >
                        <div className="bg-red-500/20 p-2 rounded-lg shrink-0 mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-red-400 font-bold text-sm">Dead Stock Detected (Isolation Forest)</h4>
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30">
                                    {deadStock.length} Actionable Items
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm mb-3">
                                Machine learning anomaly detection has flagged inventory items with high capital allocation but zero recent sales velocity. Consider liquidating or discounting these products to free up cash flow.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {deadStock.map((item, idx) => {
                                    const product = products.find(p => p.id == item.product_id);
                                    return (
                                        <div key={idx} className="bg-slate-900/50 rounded-lg p-3 border border-red-500/20 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-white font-medium text-sm truncate pr-2">{product ? product.name : `Product #${item.product_id}`}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.risk_level === 'High' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                                                        {item.risk_level} Risk
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2" title={item.reason}>
                                                    {item.reason}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expiry Risk Alert Banner */}
            <AnimatePresence>
                {expiryRisk.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start space-x-4 shadow-lg shadow-amber-500/5 mt-6"
                    >
                        <div className="bg-amber-500/20 p-2 rounded-lg shrink-0 mt-0.5">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="text-amber-400 font-bold text-sm">Batch Expiry Risk Alerts (FIFO Waste Model)</h4>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30">
                                    {expiryRisk.length} Batches Flagged
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm mb-3">
                                The ML service predicts these batches will expire before demand can consume their quantities under FIFO order, leading to inventory waste.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {expiryRisk.map((item, idx) => (
                                    <div key={idx} className="bg-slate-900/50 rounded-lg p-3 border border-amber-500/20 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-white font-medium text-sm truncate pr-2" title={item.product_name}>{item.product_name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.risk_level === 'High' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                    {item.risk_level} Risk
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>Batch: {item.batch_number}</span>
                                                <span>Qty: {item.quantity}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 leading-relaxed" title={item.reason}>
                                                {item.reason}
                                            </p>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500">Confidence: <span className="font-semibold text-slate-300">{item.confidence}</span></span>
                                            <span className="text-red-400 font-medium font-mono">Waste: {item.expected_waste} u ({item.waste_percentage}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 auto-rows-fr">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-6 min-h-[24rem] h-full flex flex-col"
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Stock Value & Inventory</h3>
                    <div className="flex-1 w-full h-full bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                        {stats.inventoryData && stats.inventoryData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={stats.inventoryData}
                                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        stroke="#475569"
                                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        orientation="left"
                                        stroke="#475569"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        tickFormatter={(value) => `₹${value.toLocaleString()}`}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        stroke="#475569"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.5rem' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(value, name) => [
                                            name === 'Total Value (₹)' ? `₹${Number(value).toLocaleString()}` : value,
                                            name
                                        ]}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Bar yAxisId="left" dataKey="value" name="Total Value (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="stock" name="Current Stock Units" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                No inventory data available.
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card p-6 min-h-[24rem] h-full flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">AI Purchase Recommendation</h3>
                            <span className="px-2 py-1 text-xs font-semibold bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">EOQ Model</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            Select a specific product from the predictions widget to view machine learning powered stock-out predictions based on historical sales data.
                        </p>

                        <div className="mb-4">
                            <select
                                value={selectedProductId}
                                onChange={handleProductChange}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                            >
                                <option value="">-- Select a product to analyze --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                        <AnimatePresence mode="wait">
                            {predictionLoading ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center"
                                >
                                    <RefreshCw className="w-8 h-8 text-indigo-400/50 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Running ML Analysis...</p>
                                </motion.div>
                            ) : prediction ? (
                                <motion.div
                                    key="result"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="w-full flex justify-between h-full"
                                >
                                    <div className="flex-1 pr-6 flex flex-col justify-center">
                                        <p className="text-sm font-medium text-slate-400 mb-1">Optimal Order Qty</p>
                                        <p className="text-4xl font-bold text-emerald-400 mb-6">{prediction.recommended_reorder} <span className="text-lg text-slate-500 font-medium select-none">units</span></p>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                                                <span className="text-sm text-slate-400">Expected Demand (14 d)</span>
                                                <span className="text-sm font-semibold text-white">{prediction.expected_demand_14d}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
                                                <span className="text-sm text-slate-400">ML Confidence</span>
                                                <span className={`text-sm font-semibold ${
                                                    prediction.confidence === 'High' ? 'text-emerald-400' :
                                                    prediction.confidence === 'Medium' ? 'text-amber-400' :
                                                    'text-red-400'
                                                }`}>{prediction.confidence}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-1/3 flex flex-col items-center justify-center border-l border-slate-700/50 pl-6">
                                        <CheckCircle className="w-12 h-12 text-emerald-500 mb-4 opacity-80" />
                                        <button
                                            onClick={handleCreatePO}
                                            disabled={poLoading}
                                            className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm flex items-center justify-center"
                                        >
                                            {poLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                            {poLoading ? 'Drafting...' : 'Create PO Now'}
                                        </button>
                                        <p className="text-xs text-slate-500 mt-3 text-center">Auto-drafts a new <br />Purchase Order.</p>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-center"
                                >
                                    <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">No specific product selected for analysis.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* Prophet Forecast UI Section */}
            <div className="grid grid-cols-1 mt-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="glass-card p-6 min-h-96 flex flex-col justify-between"
                >
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white">Demand Forecast Trend (30 Days)</h3>
                            <p className="text-slate-400 text-sm mt-1">Time series projection powered by Facebook Prophet</p>
                        </div>
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 min-w-16 text-center shadow-lg shadow-blue-500/10">Time Series</span>
                    </div>

                    <div className="flex-1 w-full bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 h-80 flex items-center justify-center relative">
                        <AnimatePresence mode="wait">
                            {forecastLoading ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center absolute inset-0 flex flex-col items-center justify-center">
                                    <RefreshCw className="w-8 h-8 text-blue-400/50 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Fitting time-series model...</p>
                                </motion.div>
                            ) : forecast && !forecast.error ? (
                                <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col">
                                    <div className="flex space-x-6 mb-4 px-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 font-medium">Next 7 Days</span>
                                            <span className="text-2xl font-bold text-white">{forecast.forecast_7d}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-500 font-medium">Next 30 Days</span>
                                            <span className="text-2xl font-bold text-blue-400">{forecast.forecast_30d}</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-700/50 pl-6">
                                            <span className="text-xs text-slate-500 font-medium">Peak Day</span>
                                            <span className="text-2xl font-bold text-amber-400">{forecast.peak_demand_day}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 w-full relative -left-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={forecast.chart_data}
                                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                                    stroke="#475569"
                                                    tickFormatter={(dateStr) => {
                                                        const d = new Date(dateStr);
                                                        return `${d.getMonth() + 1}/${d.getDate()}`;
                                                    }}
                                                />
                                                <YAxis
                                                    stroke="#475569"
                                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.75rem' }}
                                                    itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                                                    labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                                                />
                                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                                                <Bar dataKey="actual" name="Historical Sales" fill="#64748b" radius={[2, 2, 0, 0]} opacity={0.5} />
                                                <Bar dataKey="predicted" name="Forecast Sales" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>
                            ) : forecast && forecast.error ? (
                                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                    <p className="text-slate-400 text-sm max-w-sm">{forecast.error}</p>
                                </motion.div>
                            ) : (
                                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                                    <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm">Select a product above to generate a 30-day forecast.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;
