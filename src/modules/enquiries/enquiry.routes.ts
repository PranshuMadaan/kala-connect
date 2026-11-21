import { Router } from 'express';
import { EnquiryController } from './enquiry.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.post('/create', authenticate, EnquiryController.createEnquiry);
router.get('/:threadId', authenticate, EnquiryController.getThread);
router.post('/:threadId/messages', authenticate, EnquiryController.sendMessage);
router.post('/:threadId/custom-order-request', authenticate, EnquiryController.requestCustomOrder);
router.post('/:threadId/request-custom-order', authenticate, EnquiryController.requestCustomOrder);

export default router;
