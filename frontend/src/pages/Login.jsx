import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight, Warehouse } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const [tenantId, setTenantId] = useState(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const urlTenantId = queryParams.get('tenantId');
        if (urlTenantId) {
            localStorage.setItem('tenantId', urlTenantId);
            return urlTenantId;
        }
        return localStorage.getItem('tenantId') || '';
    });
    const [showTenantField, setShowTenantField] = useState(!tenantId);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!tenantId) {
            setError('Tenant Workspace ID is required');
            setLoading(false);
            return;
        }

        try {
            // Store tenant ID in localStorage so request interceptors can dynamically append X-Tenant-Id header
            localStorage.setItem('tenantId', tenantId.toLowerCase().trim());
            const response = await api.post('/auth/login', { email, password });
            login(response.data.token, response.data.user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to login. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4 overflow-hidden relative">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md"
            >
                <div className="glass-card p-10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="flex justify-center mb-8">
                        <motion.div
                            whileHover={{ rotate: 180 }}
                            transition={{ duration: 0.5 }}
                            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Warehouse className="w-8 h-8 text-white" />
                        </motion.div>
                    </div>

                    <h2 className="text-3xl font-bold text-center text-white mb-2">Welcome Back</h2>
                    <p className="text-slate-400 text-center mb-8">Sign in to Smart Inventory Platform</p>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Dynamic Tenant Selector */}
                        {!showTenantField ? (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                                <span className="text-slate-400 font-medium">Workspace: <strong className="text-blue-400 font-semibold">{tenantId}</strong></span>
                                <button 
                                    type="button" 
                                    onClick={() => setShowTenantField(true)} 
                                    className="text-xs text-indigo-450 hover:text-indigo-400 font-bold transition-colors"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Workspace ID</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Warehouse className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={tenantId}
                                        onChange={(e) => setTenantId(e.target.value)}
                                        className="block w-full pl-11 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/50 text-white placeholder-slate-450 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                                        placeholder="my-company-id"
                                    />
                                </div>
                                <p className="text-slate-500 text-xs mt-1.5 pl-1">Enter your organization's unique workspace identifier</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-500" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-500" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Signing in...' : (
                                <>
                                    Sign In
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </motion.button>

                        <div className="mt-6 text-center text-sm text-slate-400">
                            Don&apos;t have an account?{' '}
                            <Link to={tenantId ? `/signup?tenantId=${tenantId}` : "/signup"} className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                Signup here
                            </Link>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
