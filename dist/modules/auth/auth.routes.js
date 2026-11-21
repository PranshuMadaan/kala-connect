"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const zod_1 = require("zod");
const validate_1 = require("../../middleware/validate");
const router = (0, express_1.Router)();
const requestOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10, 'Valid phone number is required')
});
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
    otp: zod_1.z.string().min(4),
    role: zod_1.z.enum(['BUYER', 'ARTISAN']).optional(),
    displayName: zod_1.z.string().optional()
});
const switchRoleSchema = zod_1.z.object({
    targetRole: zod_1.z.enum(['BUYER', 'ARTISAN'])
});
router.post('/request-otp', (0, validate_1.validateBody)(requestOtpSchema), auth_controller_1.AuthController.requestOtp);
router.post('/verify-otp', (0, validate_1.validateBody)(verifyOtpSchema), auth_controller_1.AuthController.verifyOtp);
router.post('/switch-role', auth_1.authenticate, (0, validate_1.validateBody)(switchRoleSchema), auth_controller_1.AuthController.switchRole);
router.get('/me', auth_1.authenticate, auth_controller_1.AuthController.me);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map