import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Layers, DollarSign, Plus, Eye, Loader, ArrowRight, X } from 'lucide-react';
import api from '../api';

function AdminDashboard() {
    // Platform state
    const [metrics, setMetrics] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1 });
    const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'logs'
    const [loading, setLoading] = useState(true);
    
    // Modal & Form states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        tenantId: '',
        ownerName: '',
        ownerEmail: '',
        password: '',
        planId: '1' // Starter
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Expandable logs state
    const [expandedLogId, setExpandedLogId] = useState(null);

    // Load data on page mounts/tab change
    useEffect(() => {
        loadData();
    }, [activeTab, pagination.page]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load metrics
            const metricsRes = await api.get('/admin/metrics');
            setMetrics(metricsRes.data);

            if (activeTab === 'tenants') {
                const tenantsRes = await api.get('/admin/tenants');
                setTenants(tenantsRes.data);
            } else {
                const logsRes = await api.get(`/admin/logs?page=${pagination.page}&limit=15`);
                setLogs(logsRes.data.logs);
                setPagination(logsRes.data.pagination);
            }
        } catch (err) {
            console.error('[Admin Dashboard] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Toggle tenant status between ACTIVE and SUSPENDED
    const handleToggleStatus = async (tenantId, currentStatus) => {
        setActionLoadingId(tenantId);
        const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.put(`/admin/tenants/${tenantId}/status`, { status: nextStatus });
            // Reload
            await loadData();
        } catch (err) {
            console.error('[Admin Dashboard] Status update failed:', err);
            alert(err.response?.data?.message || 'Failed to update tenant status');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Handle onboarding form submit
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormLoading(true);

        // Regex validation: tenantId must be alphanumeric only
        const alphaNumeric = /^[a-zA-Z0-9]+$/;
        if (!alphaNumeric.test(formData.tenantId)) {
            setFormError('Tenant Workspace ID must contain alphanumeric characters only (no spaces or hyphens)');
            setFormLoading(false);
            return;
        }

        try {
            await api.post('/admin/tenants', formData);
            // Onboarded successfully
            setIsModalOpen(false);
            setFormData({
                name: '',
                tenantId: '',
                ownerName: '',
                ownerEmail: '',
                password: '',
                planId: '1'
            });
            await loadData();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Onboarding failed');
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header Title & Onboard Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Management Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">Configure workspace databases, pricing tiers, and audit trails</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/15 text-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span>Onboard New Tenant</span>
                </button>
            </div>

            {/* KPI Cards Grid */}
            {metrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#0f1424] border border-slate-800/80 rounded-2xl p-6 flex items-center space-x-4 shadow-xl">
                        <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Tenants</span>
                            <h3 className="text-2xl font-black text-white mt-1">{metrics.totalTenants}</h3>
                        </div>
                    </div>
                    <div className="bg-[#0f1424] border border-slate-800/80 rounded-2xl p-6 flex items-center space-x-4 shadow-xl">
                        <div className="p-3 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Subscribers</span>
                            <h3 className="text-2xl font-black text-white mt-1">{metrics.activeTenants}</h3>
                        </div>
                    </div>
                    <div className="bg-[#0f1424] border border-slate-800/80 rounded-2xl p-6 flex items-center space-x-4 shadow-xl">
                        <div className="p-3 bg-red-600/10 border border-red-500/20 text-red-400 rounded-xl">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Suspended Tenants</span>
                            <h3 className="text-2xl font-black text-white mt-1">{metrics.suspendedTenants}</h3>
                        </div>
                    </div>
                    <div className="bg-[#0f1424] border border-slate-800/80 rounded-2xl p-6 flex items-center space-x-4 shadow-xl">
                        <div className="p-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Recurring Revenue</span>
                            <h3 className="text-2xl font-black text-white mt-1">${metrics.monthlyRevenue.toFixed(2)}</h3>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Tabs Navigation */}
            <div className="border-b border-slate-850 flex space-x-6 text-sm font-semibold">
                <button 
                    onClick={() => { setActiveTab('tenants'); setPagination({ page: 1, pages: 1 }); }}
                    className={`pb-3 border-b-2 transition-all ${activeTab === 'tenants' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Tenant Directory
                </button>
                <button 
                    onClick={() => { setActiveTab('logs'); setPagination({ page: 1, pages: 1 }); }}
                    className={`pb-3 border-b-2 transition-all ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    System Audit Logs
                </button>
            </div>

            {/* Loading Indicator */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader className="w-8 h-8 text-indigo-500 animate-spin" />
                    <span className="text-sm text-slate-400">Loading master files...</span>
                </div>
            )}

            {/* Directory Tab View */}
            {!loading && activeTab === 'tenants' && (
                <div className="bg-[#0f1424] border border-slate-800/85 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Company details</th>
                                    <th className="px-6 py-4">Tenant Code</th>
                                    <th className="px-6 py-4">Database</th>
                                    <th className="px-6 py-4">Pricing Plan</th>
                                    <th className="px-6 py-4">Subscription</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {tenants.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-900/25 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-white">{t.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Created on {new Date(t.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-2 py-1 rounded-lg text-xs">{t.tenant_id}</code>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300 font-mono text-xs">{t.db_name}</td>
                                        <td className="px-6 py-4 text-slate-300 font-semibold">{t.plan_name || 'Free Trial'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${t.sub_status === 'ACTIVE' ? 'bg-emerald-950/50 border border-emerald-900 text-emerald-400' : 'bg-yellow-950/50 border border-yellow-900 text-yellow-400'}`}>
                                                {t.sub_status || 'TRIAL'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${t.status === 'ACTIVE' ? 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-600/10 border border-red-500/20 text-red-400'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                disabled={actionLoadingId === t.id}
                                                onClick={() => handleToggleStatus(t.id, t.status)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    t.status === 'ACTIVE' 
                                                    ? 'bg-red-950/20 hover:bg-red-950/50 border border-red-800/40 text-red-400'
                                                    : 'bg-emerald-950/20 hover:bg-emerald-950/50 border border-emerald-800/40 text-emerald-400'
                                                }`}
                                            >
                                                {actionLoadingId === t.id ? (
                                                    <Loader className="w-3.5 h-3.5 animate-spin" />
                                                ) : t.status === 'ACTIVE' ? (
                                                    'Suspend Access'
                                                ) : (
                                                    'Activate Workspace'
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Audit Logs View */}
            {!loading && activeTab === 'logs' && (
                <div className="bg-[#0f1424] border border-slate-800/85 rounded-2xl overflow-hidden shadow-2xl space-y-4">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-800/80 bg-slate-900/30 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">Tenant / Org</th>
                                    <th className="px-6 py-4">User Email</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Entity type</th>
                                    <th className="px-6 py-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {logs.map((log) => (
                                    <>
                                        <tr key={log.id} className="hover:bg-slate-900/25 transition-colors">
                                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-white">{log.company_name || 'System / Admin'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 font-medium">{log.user_email}</td>
                                            <td className="px-6 py-4">
                                                <code className="text-blue-400 bg-blue-950/40 border border-blue-900/40 px-2.5 py-1 rounded-lg text-xs font-bold">{log.action}</code>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">{log.entity_type} (ID: {log.entity_id})</td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                                    className="inline-flex items-center space-x-1 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>{expandedLogId === log.id ? 'Hide' : 'Inspect'}</span>
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded JSON diff panel */}
                                        {expandedLogId === log.id && (
                                            <tr>
                                                <td colSpan="6" className="bg-slate-950/60 px-8 py-6 border-b border-slate-800/80">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                                        <div className="space-y-2">
                                                            <div className="font-bold text-slate-500 uppercase tracking-wider">Original Payload State (Before)</div>
                                                            <pre className="bg-[#070a13] border border-slate-800 p-4 rounded-xl text-red-400 overflow-x-auto max-h-60 leading-relaxed font-mono">
                                                                {log.old_value ? JSON.stringify(log.old_value, null, 2) : 'No legacy data available (Create operation)'}
                                                            </pre>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="font-bold text-indigo-400 uppercase tracking-wider">Modified Payload State (After)</div>
                                                            <pre className="bg-[#070a13] border border-slate-800 p-4 rounded-xl text-emerald-400 overflow-x-auto max-h-60 leading-relaxed font-mono">
                                                                {log.new_value ? JSON.stringify(log.new_value, null, 2) : 'Null data payload'}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/60 text-xs">
                            <span className="text-slate-400">Page {pagination.page} of {pagination.pages} ({pagination.total} records)</span>
                            <div className="flex space-x-2">
                                <button 
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:text-white"
                                >
                                    Previous
                                </button>
                                <button 
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:text-white"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Onboard Company Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0f1424] border border-slate-800 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-2xl font-black text-white">Create New Tenant</h3>
                                <p className="text-slate-400 text-sm mt-1">Provision database, seed schema, and create administrative credentials</p>
                            </div>

                            {formError && (
                                <div className="p-3 bg-red-950/40 border border-red-800 text-red-400 rounded-xl text-xs flex items-center space-x-2">
                                    <span>⚠️</span>
                                    <span>{formError}</span>
                                </div>
                            )}

                            <form onSubmit={handleFormSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Company Name</label>
                                        <input 
                                            type="text" 
                                            value={formData.name} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                                            required 
                                            placeholder="Acme Corp"
                                            className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Tenant Workspace ID</label>
                                        <input 
                                            type="text" 
                                            value={formData.tenantId} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))} 
                                            required 
                                            placeholder="acmecorp"
                                            className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Owner Full Name</label>
                                        <input 
                                            type="text" 
                                            value={formData.ownerName} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))} 
                                            required 
                                            placeholder="John Doe"
                                            className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Owner Email</label>
                                        <input 
                                            type="email" 
                                            value={formData.ownerEmail} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))} 
                                            required 
                                            placeholder="john@acmecorp.com"
                                            className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Owner Password</label>
                                        <input 
                                            type="password" 
                                            value={formData.password} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} 
                                            required 
                                            placeholder="••••••••"
                                            className="w-full bg-[#070a13] border border-slate-800 text-white placeholder-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">Subscription Tier</label>
                                        <select 
                                            value={formData.planId} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, planId: e.target.value }))} 
                                            className="w-full bg-[#070a13] border border-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors text-sm appearance-none cursor-pointer"
                                        >
                                            <option value="1">Basic Starter ($29.00/mo)</option>
                                            <option value="2">Professional Growth ($79.00/mo)</option>
                                            <option value="3">Enterprise Core ($199.00/mo)</option>
                                        </select>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={formLoading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-indigo-600/15 text-sm mt-4 flex items-center justify-center space-x-2"
                                >
                                    {formLoading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            <span>Provisioning Database & Schema...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Initialize Onboarding</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
