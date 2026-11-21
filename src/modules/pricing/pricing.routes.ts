import { Router } from 'express';
import { PricingController } from './pricing.controller';
import { optionalAuthenticate } from '../../middleware/auth';

const router = Router();

// Fast cost calculator
router.post('/calculate', PricingController.calculateCost);

// Market-based price recommendation
router.post('/recommend', optionalAuthenticate, PricingController.recommendPrice);

// Market benchmark listings
router.get('/benchmarks', PricingController.getBenchmarks);

// Save price selection
router.post('/save-selection', optionalAuthenticate, PricingController.savePriceSelection);

export default router;
