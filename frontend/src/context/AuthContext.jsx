import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
    const [sessionExp, setSessionExp] = useState(null);

    const login = (newToken, userData) => {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setSessionExp(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    // Proactive Session Expiration Timer
    useEffect(() => {
        let timeoutId;

        if (token) {
            try {
                // Decode the JWT payload (the middle part of the token)
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));

                const payload = JSON.parse(jsonPayload);

                if (payload.exp) {
                    const expiryTimeMs = payload.exp * 1000;
                    setTimeout(() => setSessionExp(expiryTimeMs), 0);

                    const currentTimeMs = Date.now();
                    const timeLeftMs = expiryTimeMs - currentTimeMs;

                    if (timeLeftMs <= 0) {
                        // Token already expired
                        setTimeout(() => logout(), 0);
                    } else {
                        // Set timeout to auto-logout precisely when token expires
                        timeoutId = setTimeout(() => {
                            logout();
                            // Optional: Alert the user or redirect explicitly
                            window.location.href = '/login?expired=true';
                        }, timeLeftMs);
                    }
                }
            } catch (err) {
                console.error("Failed to decode token for session management:", err);
            }
        }

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [token]);

    return (
        <AuthContext.Provider value={{ token, user, login, logout, sessionExp, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
