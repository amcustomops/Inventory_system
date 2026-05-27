import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Dynamically append X-Tenant-Id for tenant-isolated request resolution
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
            config.headers['X-Tenant-Id'] = tenantId;
        }
        
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            const isAuthRequest = error.config && (
                error.config.url.endsWith('/auth/login') ||
                error.config.url.endsWith('/auth/admin-login') ||
                error.config.url.endsWith('/auth/register')
            );

            if (!isAuthRequest) {
                const userJson = localStorage.getItem('user');
                let isSuperAdmin = false;
                if (userJson) {
                    try {
                        const user = JSON.parse(userJson);
                        isSuperAdmin = user.role === 'SUPER_ADMIN';
                    } catch (e) {}
                }

                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('tenantId');

                if (isSuperAdmin) {
                    window.location.href = '/admin/login';
                } else {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
