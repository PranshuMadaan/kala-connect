"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAuthenticate = exports.optionalAuth = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { artisanProfile: true }
        });
        if (!user) {
            return res.status(401).json({ success: false, error: 'User no longer exists' });
        }
        req.user = {
            id: user.id,
            phone: user.phone,
            role: user.role,
            displayName: user.displayName,
            artisanId: user.artisanProfile?.id
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};
exports.authenticate = authenticate;
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { artisanProfile: true }
        });
        if (user) {
            req.user = {
                id: user.id,
                phone: user.phone,
                role: user.role,
                displayName: user.displayName,
                artisanId: user.artisanProfile?.id
            };
        }
    }
    catch {
        // Ignore invalid token in optional auth
    }
    next();
};
exports.optionalAuth = optionalAuth;
exports.optionalAuthenticate = exports.optionalAuth;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: `Forbidden: Requires role [${roles.join(', ')}]` });
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map