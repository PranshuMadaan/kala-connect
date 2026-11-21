import { Router } from 'express';
import { ArtisanController } from './artisan.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, ArtisanController.getDashboard);
router.get('/onboarding', authenticate, ArtisanController.getOnboarding);
router.post('/onboarding', authenticate, ArtisanController.saveOnboarding);

export default router;
