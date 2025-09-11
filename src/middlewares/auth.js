const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Existing mobile auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospitalink-secret');
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user inactive.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// NEW: Web auth middleware (for cookies)
const authWebMiddleware = async (req, res, next) => {
  try {
    // Check for token in cookies or Authorization header
    const token = req.cookies?.doctorToken || 
                  req.cookies?.adminToken || 
                  req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hospitalink-secret');
    
    // Verify platform is web
    if (decoded.platform !== 'web') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token platform.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user inactive.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Clear expired cookie
      res.clearCookie('doctorToken');
      res.clearCookie('adminToken');
      
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }

    res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// Keep existing requireRole middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,      // For mobile API
  authWebMiddleware,   // For web dashboard
  requireRole,
};