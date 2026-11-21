import { Router } from 'express';
import { BuyerController } from './buyer.controller';

const router = Router();

router.get('/home', BuyerController.getHome);
router.get('/search', BuyerController.search);
router.get('/products', BuyerController.search);
router.get('/products/:id', BuyerController.getProductDetail);
router.get('/artisans/:id', BuyerController.getArtisanProfile);

export default router;
