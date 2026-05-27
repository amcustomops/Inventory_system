import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Package, Warehouse, ShoppingCart, LogOut, Users, Menu, X, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const Layout = () => {
    const navigate = useNavigate();
    const { user, logout, sessionExp } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState(null);
    const [mlStatus, setMlStatus] = useState('checking');
    const prevMlStatusRef = useRef('checking');

    // Poll ML Status
    useEffect(() => {
        const checkMlStatus = async () => {
            try {
                const response = await api.get('/ml-status');
                if (response.status === 200) {
                    setMlStatus(response.data.isRunning ? 'running' : 'disconnected');
                } else {
                    setMlStatus('disconnected');
                }
            } catch {
                setMlStatus('disconnected');
            }
        };

        checkMlStatus();
        const interval = setInterval(checkMlStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    // Reload page when ML service comes back online
    useEffect(() => {
        if (prevMlStatusRef.current === 'disconnected' && mlStatus === 'running') {
            window.location.reload();
        }
        prevMlStatusRef.current = mlStatus;
    }, [mlStatus]);

    // Close sidebar on mobile when window is resized to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(true);
            } else {
                setIsSidebarOpen(false);
            }
        };

        // Set initial state
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Calculate session countdown
    useEffect(() => {
        if (!sessionExp || (user?.role !== 'owner' && user?.role !== 'manager')) {
            setTimeout(() => setTimeLeft(null), 0);
            return;
        }

        const updateTimer = () => {
            const ms = sessionExp - Date.now();
            if (ms <= 0) {
                setTimeLeft('00:00');
            } else {
                const mins = Math.floor(ms / 60000);
                const secs = Math.floor((ms % 60000) / 1000);
                setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
            }
        };

        updateTimer(); // initial call
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [sessionExp, user]);

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Products', path: '/products', icon: Package },
        { name: 'Inventory', path: '/inventory', icon: Warehouse },
        { name: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
    ];

    if (user?.role === 'owner' || user?.role === 'manager') {
        navItems.push({ name: 'Suppliers', path: '/suppliers', icon: Users });
    }

    return (
        <div className="flex h-screen bg-slate-900 text-slate-200 overflow-hidden">

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && window.innerWidth < 768 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.aside
                        initial={{ x: -250 }}
                        animate={{ x: 0 }}
                        exit={{ x: -250 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        className="w-64 bg-slate-800/90 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-50 shadow-2xl fixed inset-y-0 left-0 md:relative"
                    >
                        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-700/50">
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mr-3 shadow-lg shadow-blue-500/20">
                                    <Warehouse className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                    SmartInventory
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
                                            ? 'text-blue-400 bg-blue-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-blue-500/20'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                            <span className="font-medium z-10 relative">{item.name}</span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="sidebar-active"
                                                    className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-50"
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

                        <div className="p-4 border-t border-slate-700/50">
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

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                <header className="h-16 bg-slate-900/40 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between px-4 sm:px-8 z-10 sticky top-0">
                    <div className="flex items-center">
                        <button
                            className="mr-4 text-slate-400 hover:text-white md:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-medium text-slate-300 hidden sm:block">Overview</h2>
                    </div>
                    <div className="flex items-center space-x-3 sm:space-x-6">

                        {/* ML Status UI Indicator */}
                        <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg shadow-sm">
                            <div className={`w-2 h-2 rounded-full mr-2 ${mlStatus === 'running' ? 'bg-emerald-500' :
                                mlStatus === 'disconnected' ? 'bg-red-500 animate-pulse' :
                                    'bg-yellow-500'
                                }`} />
                            <span className="text-xs font-medium text-slate-300">
                                {mlStatus === 'running' ? 'ML Service Active' :
                                    mlStatus === 'disconnected' ? 'ML Offline - Reconnecting...' :
                                        'Checking Status...'}
                            </span>
                        </div>

                        {/* Session Timer Component */}
                        {timeLeft && (
                            <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-800/80 border border-slate-700/50 rounded-lg shadow-sm">
                                <Clock className="w-4 h-4 text-purple-400 mr-2" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider leading-none mb-0.5">Session</span>
                                    <span className="text-sm font-medium text-slate-200 leading-none">{timeLeft}</span>
                                </div>
                            </div>
                        )}

                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-sm font-medium text-slate-200">{user?.name || 'User'}</span>
                            <span className="text-xs text-slate-500">{user?.role || 'Guest'}</span>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20 border border-indigo-400/20 flex items-center justify-center text-white font-bold text-sm uppercase flex-shrink-0">
                            {user?.name?.charAt(0) || 'U'}
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

export default Layout;
