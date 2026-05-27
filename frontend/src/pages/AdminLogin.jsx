import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Clear any tenant header context for central admin actions
            localStorage.removeItem('tenantId');
            
            const res = await api.post('/auth/admin-login', { email, password });
            
            // Login to global context
            login(res.data.token, res.data.user);
            navigate('/admin/dashboard');
        } catch (err) {
            console.error('[Admin Login] Error:', err);
            setError(err.response?.data?.message || 'Invalid administrative credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070a13] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-950/20 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-[#0f1424] border border-slate-800/80 rounded-3xl p-8 shadow-2xl space-y-8 backdrop-blur-xl">
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-2xl font-black mb-1">
                            SI
                        </div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">Master Console</h2>
                        <p className="text-slate-400 text-sm">Platform administration portal</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-950/40 border border-red-800/60 text-red-400 rounded-xl text-sm flex items-center space-x-2">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Admin Email</label>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    required 
                                    placeholder="admin@smartinventory.com"
                                    className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-600 rounded-xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Password</label>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                    placeholder="••••••••••••"
                                    className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-600 rounded-xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm" 
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-xl shadow-indigo-600/15 text-sm"
                        >
                            {loading ? 'Authenticating...' : 'Sign In to Master Control'}
                        </button>
                    </form>
                </div>
                
                <p className="text-center text-xs text-slate-500 mt-6 font-medium">
                    &copy; 2026 Smart Inventory Platforms. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default AdminLogin;
