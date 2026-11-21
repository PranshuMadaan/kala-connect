"use strict";
/**
 * Kala Connect Cost-Based Pricing Calculator
 *
 * Production-grade cost accounting for handmade artisan crafts.
 * Distinctly calculates Markup vs. Profit Margin to prevent margin dilution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostCalculator = void 0;
class CostCalculator {
    // Kala Connect direct artisan trade standards
    static DEFAULT_HOURLY_RATE = 150.0; // ₹150/hr minimum fair living artisan wage
    static PLATFORM_FEE_PCT = 0.05; // 5% platform maintenance & escrow fee
    static MIN_VIABLE_MARGIN_PCT = 10; // 10% safety cushion for contingency
    /**
     * Calculates comprehensive cost-based pricing.
     */
    static calculate(input) {
        const materialCost = Math.max(0, Number(input.materialCost) || 0);
        const packagingCost = Math.max(0, Number(input.packagingCost) || 0);
        const overheadCost = Math.max(0, Number(input.overheadCost) || 0);
        const shippingCost = Math.max(0, Number(input.shippingCost) || 0);
        const shippingPayer = input.shippingPayer || 'BUYER';
        // Calculate Labour
        const labourHours = Math.max(0, Number(input.labourHours) || 0);
        const labourHourlyRate = Number(input.labourHourlyRate) > 0
            ? Number(input.labourHourlyRate)
            : this.DEFAULT_HOURLY_RATE;
        const labourCost = input.labourCost !== undefined && input.labourCost !== null && Number(input.labourCost) > 0
            ? Number(input.labourCost)
            : Math.round(labourHours * labourHourlyRate);
        // If artisan absorbs shipping, it forms part of production cost
        const absorbedShipping = shippingPayer === 'ARTISAN' ? shippingCost : 0;
        const baseProductionCost = Math.round(materialCost + labourCost + packagingCost + overheadCost + absorbedShipping);
        // Resolve Profit Margin vs Markup
        // Formula: Margin = Profit / Price => Price = Base / (1 - Margin)
        // Formula: Markup = Profit / Base  => Price = Base * (1 + Markup)
        let desiredMarginPct = 20.0;
        if (input.desiredMarginPct !== undefined && input.desiredMarginPct !== null) {
            desiredMarginPct = Math.min(85, Math.max(5, Number(input.desiredMarginPct)));
        }
        else if (input.markupPct !== undefined && input.markupPct !== null) {
            // Convert markup to margin: margin = markup / (1 + markup)
            const markup = Math.max(0, Number(input.markupPct)) / 100;
            desiredMarginPct = Number(((markup / (1 + markup)) * 100).toFixed(1));
        }
        const marginDecimal = desiredMarginPct / 100.0;
        const makerPrice = baseProductionCost > 0
            ? Math.round(baseProductionCost / (1.0 - marginDecimal))
            : 0;
        const estimatedGrossProfit = Math.max(0, makerPrice - baseProductionCost);
        const effectiveMarkupPct = baseProductionCost > 0
            ? Number(((estimatedGrossProfit / baseProductionCost) * 100).toFixed(1))
            : 0;
        // Minimum Viable Price: Covers base cost + minimum 10% contingency wage
        const minViablePrice = Math.round(baseProductionCost / (1.0 - (this.MIN_VIABLE_MARGIN_PCT / 100.0)));
        // Platform Fee & Buyer Price
        const platformFee = Math.round(makerPrice * this.PLATFORM_FEE_PCT);
        const customerShipping = shippingPayer === 'BUYER' ? shippingCost : 0;
        const buyerPrice = makerPrice + platformFee + customerShipping;
        return {
            baseProductionCost,
            materialCost,
            labourHours,
            labourHourlyRate,
            labourCost,
            packagingCost,
            overheadCost,
            shippingCost,
            shippingPayer,
            desiredMarginPct,
            effectiveMarkupPct,
            makerPrice,
            estimatedGrossProfit,
            minViablePrice,
            platformFeePct: this.PLATFORM_FEE_PCT * 100,
            platformFee,
            buyerPrice,
            costBreakdown: {
                materialCost,
                labourCost,
                packagingCost,
                overheadCost,
                shippingCost,
                baseProductionCost,
                artisanNetProfit: estimatedGrossProfit,
                platformFee,
                buyerPrice
            }
        };
    }
}
exports.CostCalculator = CostCalculator;
//# sourceMappingURL=costCalculator.js.map