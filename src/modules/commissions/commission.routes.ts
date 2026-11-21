import { Router } from 'express';
import { CommissionController } from './commission.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/:orderId', authenticate, CommissionController.getCommission);
router.post('/:orderId/milestones/:stage/submit-proof', authenticate, CommissionController.submitMilestoneProof);
router.post('/:orderId/milestones/:stage/approve', authenticate, CommissionController.approveMilestone);

export default router;
