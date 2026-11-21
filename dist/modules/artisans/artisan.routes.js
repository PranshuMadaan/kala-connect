"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const artisan_controller_1 = require("./artisan.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/dashboard', auth_1.authenticate, artisan_controller_1.ArtisanController.getDashboard);
router.get('/onboarding', auth_1.authenticate, artisan_controller_1.ArtisanController.getOnboarding);
router.post('/onboarding', auth_1.authenticate, artisan_controller_1.ArtisanController.saveOnboarding);
exports.default = router;
//# sourceMappingURL=artisan.routes.js.map