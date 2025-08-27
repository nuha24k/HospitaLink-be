const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.bearer;

        if (!authHeader) {
            return res.status(401).json({
                message: 'Authorization header missing. Please provide Bearer token in authorization header'
            });
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : authHeader;

        if (!token) {
            return res.status(401).json({
                message: 'Invalid token format. Token should be: Bearer <token>'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            message: 'Authentication failed',
            error: error.message
        });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

module.exports = { authMiddleware, checkRole };