"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const enquiry_controller_1 = require("./enquiry.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/create', auth_1.authenticate, enquiry_controller_1.EnquiryController.createEnquiry);
router.get('/:threadId', auth_1.authenticate, enquiry_controller_1.EnquiryController.getThread);
router.post('/:threadId/messages', auth_1.authenticate, enquiry_controller_1.EnquiryController.sendMessage);
router.post('/:threadId/custom-order-request', auth_1.authenticate, enquiry_controller_1.EnquiryController.requestCustomOrder);
router.post('/:threadId/request-custom-order', auth_1.authenticate, enquiry_controller_1.EnquiryController.requestCustomOrder);
exports.default = router;
//# sourceMappingURL=enquiry.routes.js.map