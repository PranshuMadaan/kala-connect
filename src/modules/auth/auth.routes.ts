import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate';

const router = Router();

const requestOtpSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required')
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10),
  otp: z.string().min(4),
  role: z.enum(['BUYER', 'ARTISAN']).optional(),
  displayName: z.string().optional()
});

const switchRoleSchema = z.object({
  targetRole: z.enum(['BUYER', 'ARTISAN'])
});

router.post('/request-otp', validateBody(requestOtpSchema), AuthController.requestOtp);
router.post('/verify-otp', validateBody(verifyOtpSchema), AuthController.verifyOtp);
router.post('/switch-role', authenticate, validateBody(switchRoleSchema), AuthController.switchRole);
router.get('/me', authenticate, AuthController.me);

export default router;
