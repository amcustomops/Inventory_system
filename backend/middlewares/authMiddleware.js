const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // Health checks and status checks do not require JWT
    if (req.path === '/api/health' || req.path === '/api/ml-status') {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here', (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        
        // CRITICAL TENANT CONTAINER SECURITY CHECK
        // Validate that the token's tenant identifier matches the request context
        if (req.tenant && decoded.tenantId !== req.tenant.tenant_id) {
            return res.status(403).json({ message: 'Cross-tenant authentication attempt rejected' });
        }

        req.user = decoded;
        next();
    });
};

const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions' });
        }
        next();
    };
};

/**
 * RBAC Permission Guard
 * Validates that user claims contain the required operation scope
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Owner gets full bypass access to all operations
        const hasPermission = req.user.role === 'owner' || (req.user.permissions && req.user.permissions.includes(permission));
        if (!hasPermission) {
            return res.status(403).json({ message: `Access denied: missing permission '${permission}'` });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole, requirePermission };

