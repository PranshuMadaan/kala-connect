"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pricing_controller_1 = require("./pricing.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Fast cost calculator
router.post('/calculate', pricing_controller_1.PricingController.calculateCost);
// Market-based price recommendation
router.post('/recommend', auth_1.optionalAuthenticate, pricing_controller_1.PricingController.recommendPrice);
// Market benchmark listings
router.get('/benchmarks', pricing_controller_1.PricingController.getBenchmarks);
// Save price selection
router.post('/save-selection', auth_1.optionalAuthenticate, pricing_controller_1.PricingController.savePriceSelection);
exports.default = router;
//# sourceMappingURL=pricing.routes.js.map