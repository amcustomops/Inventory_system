import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, Shield, UserPlus, AlertTriangle, Key, Mail, User, ShieldAlert, CheckCircle, Ban } from 'lucide-react';
import api from '../api';

const Users = () => {
    const { user: currentUser } = useAuth();
    const canManage = currentUser?.role === 'owner' || currentUser?.role === 'manager';

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal state for Inviting User
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'staff'
    });
    const [inviteLoading, setInviteLoading] = useState(false);

    // Modal state for Delete confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    useEffect(() => {
        if (canManage) {
            fetchUsers();
        }
    }, [canManage]);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err.response?.data?.message || 'Failed to retrieve company users.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        setInviteLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/users', formData);
            setSuccess(`Invitation email successfully queued for ${formData.email}`);
            setIsInviteModalOpen(false);
            setFormData({ name: '', email: '', password: '', role: 'staff' });
            await fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to invite user.');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleToggleStatus = async (userToModify) => {
        setError('');
        setSuccess('');
        const newStatus = userToModify.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        try {
            await api.put(`/users/${userToModify.id}/status`, { status: newStatus });
            setSuccess(`User status updated to ${newStatus.toLowerCase()} successfully.`);
            await fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change user status.');
        }
    };

    const confirmDelete = (userToDel) => {
        setUserToDelete(userToDel);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setError('');
        setSuccess('');
        try {
            await api.delete(`/users/${userToDelete.id}`);
            setSuccess('User deleted successfully.');
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            await fetchUsers();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete user.');
        }
    };

    const generateRandomPassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
        let pass = '';
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({
            ...prev,
            password: pass
        }));
    };

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.role_name?.toLowerCase().includes(search.toLowerCase())
    );

    // Guard route inside view
    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <AlertTriangle className="w-16 h-16 text-yellow-500" />
                <h1 className="text-2xl font-bold text-white">Access Denied</h1>
                <p className="text-slate-400">You do not have permission to view or manage company users.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">User Management</h1>
                    <p className="text-sm text-slate-400">Invite, configure roles, suspend, or delete company workspace accounts.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        setError('');
                        setSuccess('');
                        setIsInviteModalOpen(true);
                    }}
                    className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-colors"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Member
                </motion.button>
            </div>

            {/* Notification Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center shadow-md"
                    >
                        <ShieldAlert className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 p-4 rounded-xl text-sm flex items-center shadow-md"
                    >
                        <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span>{success}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="glass-card overflow-hidden mt-6">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/30">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search users by name, email, or role..."
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
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Email</th>
                                <th className="px-6 py-4 font-medium">Role</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading workspace users...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Shield className="w-12 h-12 text-slate-600 mb-3" />
                                            <p>No workspace users found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((item, idx) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        key={item.id}
                                        className="hover:bg-slate-800/30 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-white flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 mr-3">
                                                {item.name?.charAt(0).toUpperCase()}
                                            </div>
                                            {item.name}
                                            {item.id.toString() === currentUser?.id?.toString() && (
                                                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded font-semibold">You</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400">{item.email}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                                item.role_name === 'owner' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                item.role_name === 'manager' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                item.role_name === 'warehouse' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                'bg-slate-500/10 text-slate-450 border border-slate-500/20'
                                            }`}>
                                                {item.role_name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                item.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${item.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right">
                                            {item.id.toString() !== currentUser?.id?.toString() && (
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button
                                                        onClick={() => handleToggleStatus(item)}
                                                        title={item.status === 'ACTIVE' ? 'Suspend User' : 'Activate User'}
                                                        className={`p-1 rounded-lg transition-colors border ${
                                                            item.status === 'ACTIVE' 
                                                                ? 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/20' 
                                                                : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/20'
                                                        }`}
                                                    >
                                                        {item.status === 'ACTIVE' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(item)}
                                                        title="Delete User"
                                                        className="p-1 rounded-lg border text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/20 transition-colors"
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

            {/* Invite Modal */}
            <AnimatePresence>
                {isInviteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card w-full max-w-md p-8 overflow-hidden relative flex flex-col"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Invite Organisation User</h3>
                            <p className="text-xs text-slate-400 mb-6">Enter details to send a workspace invitation email containing generated credentials.</p>

                            <form onSubmit={handleInviteSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-350 mb-1">Full Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="Jane Doe"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-350 mb-1">Email Address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="email"
                                            required
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="jane.doe@company.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-350 mb-1">Password</label>
                                    <div className="relative flex space-x-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Key className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                                                placeholder="Enter or generate"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={generateRandomPassword}
                                            className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-350 mb-1">Workspace Role</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Shield className="h-4 w-4 text-slate-500" />
                                        </div>
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleInputChange}
                                            className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none"
                                        >
                                            <option value="staff" className="bg-slate-900 text-white">Staff (Read Only View)</option>
                                            <option value="warehouse" className="bg-slate-900 text-white">Warehouse Staff</option>
                                            <option value="manager" className="bg-slate-900 text-white">General Manager</option>
                                            <option value="owner" className="bg-slate-900 text-white">Owner</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setIsInviteModalOpen(false)}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={inviteLoading}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50"
                                    >
                                        {inviteLoading ? 'Inviting...' : 'Send Invite'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Delete Modal */}
            <AnimatePresence>
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
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
                            <h3 className="text-lg font-bold text-white text-center mb-2">Delete User Account?</h3>
                            <p className="text-sm text-slate-400 text-center mb-6">
                                Are you sure you want to delete <span className="text-white font-semibold">&quot;{userToDelete?.name}&quot;</span>? This user will immediately lose access to the system. This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-3 w-full">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteUser}
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

export default Users;
