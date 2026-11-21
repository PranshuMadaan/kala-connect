"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const buyer_controller_1 = require("./buyer.controller");
const router = (0, express_1.Router)();
router.get('/home', buyer_controller_1.BuyerController.getHome);
router.get('/search', buyer_controller_1.BuyerController.search);
router.get('/products', buyer_controller_1.BuyerController.search);
router.get('/products/:id', buyer_controller_1.BuyerController.getProductDetail);
router.get('/artisans/:id', buyer_controller_1.BuyerController.getArtisanProfile);
exports.default = router;
//# sourceMappingURL=buyer.routes.js.map