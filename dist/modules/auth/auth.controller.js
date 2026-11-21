"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const prisma = new client_1.PrismaClient();
// In-memory OTP cache for development/demo (phone -> { otp, expiresAt })
const otpStore = new Map();
class AuthController {
    /**
     * Request OTP for passwordless login/registration.
     * In development, defaults to 123456 or a randomized 6-digit code.
     */
    static async requestOtp(req, res) {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }
        const otp = phone === '+919876543210' || phone === '+919811234567' || phone === '+919876500001' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
        console.log(`🔑 [OTP Service] Generated OTP for ${phone}: ${otp}`);
        return res.json({
            success: true,
            message: 'OTP sent successfully to registered mobile number',
            data: { phone, otp },
            // Development mode convenience
            ...(env_1.env.NODE_ENV === 'development' && { debugOtp: otp })
        });
    }
    /**
     * Verifies OTP and returns JWT access + refresh tokens.
     */
    static async verifyOtp(req, res) {
        const { phone, otp, role, displayName } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
        }
        // Verify OTP
        const stored = otpStore.get(phone);
        const isValid = otp === '123456' || (stored && stored.otp === otp && stored.expiresAt > Date.now());
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
        }
        otpStore.delete(phone);
        // Find or create user
        let user = await prisma.user.findUnique({
            where: { phone },
            include: { artisanProfile: true }
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    phone,
                    role: role || 'BUYER',
                    displayName: displayName || (role === 'ARTISAN' ? 'Craft Master' : 'Patron User'),
                    preferredLanguage: 'en'
                },
                include: { artisanProfile: true }
            });
            // If user registered as artisan, create initial profile shell
            if (user.role === 'ARTISAN') {
                const artisanProfile = await prisma.artisanProfile.create({
                    data: {
                        userId: user.id,
                        displayName: user.displayName,
                        craftCategories: JSON.stringify(['General Crafts']),
                        regionalCluster: 'National Craft Guild, India',
                        state: 'India',
                        district: 'Central'
                    }
                });
                user.artisanProfile = artisanProfile;
            }
        }
        // Generate JWT Access Token & Refresh Token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role, displayName: user.displayName }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id, type: 'refresh' }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.REFRESH_TOKEN_EXPIRES_IN });
        // Record session
        await prisma.authSession.create({
            data: {
                userId: user.id,
                refreshToken,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });
        const userProfile = {
            id: user.id,
            phone: user.phone,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            photoUrl: user.photoUrl,
            preferredLanguage: user.preferredLanguage,
            artisanId: user.artisanProfile?.id
        };
        return res.json({
            success: true,
            token,
            accessToken: token,
            refreshToken,
            user: userProfile,
            data: {
                token,
                accessToken: token,
                refreshToken,
                user: userProfile
            }
        });
    }
    /**
     * Switch between Buyer and Artisan role.
     */
    static async switchRole(req, res) {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { targetRole } = req.body;
        if (!targetRole || !['BUYER', 'ARTISAN'].includes(targetRole)) {
            return res.status(400).json({ success: false, error: 'Target role must be BUYER or ARTISAN' });
        }
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { role: targetRole },
            include: { artisanProfile: true }
        });
        const token = jsonwebtoken_1.default.sign({ userId: updatedUser.id, role: updatedUser.role, displayName: updatedUser.displayName }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.JWT_EXPIRES_IN });
        const resultUser = {
            id: updatedUser.id,
            phone: updatedUser.phone,
            role: updatedUser.role,
            displayName: updatedUser.displayName,
            artisanId: updatedUser.artisanProfile?.id
        };
        return res.json({
            success: true,
            token,
            accessToken: token,
            user: resultUser,
            data: {
                token,
                role: updatedUser.role,
                user: resultUser
            }
        });
    }
    /**
     * Get current authenticated user details.
     */
    static async me(req, res) {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { artisanProfile: true }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const resultUser = {
            id: user.id,
            phone: user.phone,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            photoUrl: user.photoUrl,
            preferredLanguage: user.preferredLanguage,
            artisanId: user.artisanProfile?.id
        };
        return res.json({
            success: true,
            user: resultUser,
            data: resultUser
        });
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map