import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, History, LogOut, Menu, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminLayout = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Sync sidebar state on resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && window.innerWidth < 768 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Navigation */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ x: -250 }}
                        animate={{ x: 0 }}
                        exit={{ x: -250 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        className="w-64 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80 flex flex-col z-50 shadow-2xl fixed inset-y-0 left-0 md:relative"
                    >
                        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/20">
                                    <ShieldAlert className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                                    SaaS Master
                                </h1>
                            </div>
                            <button
                                className="md:hidden text-slate-400 hover:text-white"
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <nav className="flex-1 py-6 px-4 space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center px-3 py-3 rounded-xl transition-all duration-300 relative overflow-hidden group ${isActive
                                            ? 'text-indigo-400 bg-indigo-600/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-indigo-500/20'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                            <span className="font-medium z-10 relative">{item.name}</span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="admin-sidebar-active"
                                                    className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="p-4 border-t border-slate-800/60">
                            <button
                                onClick={handleLogout}
                                className="flex items-center w-full px-3 py-3 text-slate-400 rounded-xl hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                            >
                                <LogOut className="w-5 h-5 mr-3" />
                                <span className="font-medium">Sign Out</span>
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Dashboard Content Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5 pointer-events-none" />

                <header className="h-16 bg-[#070a13]/40 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0">
                    <div className="flex items-center">
                        <button
                            className="mr-4 text-slate-400 hover:text-white md:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-semibold text-slate-300">Master Administration</h2>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-semibold text-slate-200">{user?.name || 'Super Admin'}</span>
                            <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/50 px-2 py-0.5 border border-indigo-800/40 rounded-full tracking-wider uppercase">Platform Admin</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 border border-indigo-400/20 flex items-center justify-center text-white font-bold text-sm uppercase">
                            SA
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 sm:p-8 relative z-0">
                    <AnimatePresence mode="wait">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
