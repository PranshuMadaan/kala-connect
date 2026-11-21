"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const commission_controller_1 = require("./commission.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/:orderId', auth_1.authenticate, commission_controller_1.CommissionController.getCommission);
router.post('/:orderId/milestones/:stage/submit-proof', auth_1.authenticate, commission_controller_1.CommissionController.submitMilestoneProof);
router.post('/:orderId/milestones/:stage/approve', auth_1.authenticate, commission_controller_1.CommissionController.approveMilestone);
exports.default = router;
//# sourceMappingURL=commission.routes.js.map