"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceRecommendationService = void 0;
const costCalculator_1 = require("./costCalculator");
const marketResearchService_1 = require("./marketResearchService");
class PriceRecommendationService {
    /**
     * Generates a transparent, market-informed price recommendation.
     * Never fabricates prices; protects artisans from below-cost selling.
     */
    static async generateRecommendation(input) {
        // 1. Calculate Cost Baseline
        const costResult = costCalculator_1.CostCalculator.calculate({
            materialCost: input.materialCost,
            labourHours: input.labourHours,
            labourHourlyRate: input.labourHourlyRate,
            labourCost: input.labourCost,
            packagingCost: input.packagingCost,
            overheadCost: input.overheadCost,
            shippingCost: input.shippingCost,
            shippingPayer: input.shippingPayer,
            desiredMarginPct: input.desiredMarginPct
        });
        const baseCost = costResult.baseProductionCost;
        const costMakerPrice = costResult.makerPrice;
        const minViable = costResult.minViablePrice;
        // 2. Query Authentic Market Benchmarks
        const marketComparison = await marketResearchService_1.MarketResearchService.findComparables({
            category: input.category,
            craftType: input.craftType,
            materialsText: input.materialsText,
            region: input.region,
            isGiTagged: input.isGiTagged
        });
        // 3. Determine Recommended Price & Loss Protection
        let recommendedPrice = costMakerPrice;
        let lossRiskFlag = false;
        let lossRiskWarning = undefined;
        if (marketComparison.hasReliableData && marketComparison.marketMedianPrice !== null) {
            const marketMedian = marketComparison.marketMedianPrice;
            // Check if market median is lower than base production costs
            if (marketMedian < baseCost) {
                lossRiskFlag = true;
                lossRiskWarning = `⚠️ Market Alert: Comparable generic listings show a median of ₹${marketMedian.toLocaleString('en-IN')}, which is below your workshop production cost (₹${baseCost.toLocaleString('en-IN')}). Kala Connect protects authentic artisan labor: we strongly recommend pricing at or above ₹${minViable.toLocaleString('en-IN')} to avoid working at a loss.`;
                // Enforce safety floor
                recommendedPrice = Math.max(costMakerPrice, minViable);
            }
            else {
                // Market supports a fair price.
                // Balance artisan cost-plus target with market median:
                // Weight: 60% artisan desired cost-plus + 40% authentic market median
                let blended = Math.round(0.60 * costMakerPrice + 0.40 * marketMedian);
                // GI certified pieces command a recognized heritage premium
                if (input.isGiTagged) {
                    blended = Math.round(blended * 1.10);
                }
                // Never let blended recommendation dip below minViablePrice
                recommendedPrice = Math.max(blended, minViable);
            }
        }
        else {
            // No market comparison: purely cost-based
            recommendedPrice = costMakerPrice;
        }
        // 4. Calculate Premium Positioning Option
        let premiumPrice = Math.round(recommendedPrice * 1.30);
        if (marketComparison.marketRangeHigh && marketComparison.marketRangeHigh > premiumPrice) {
            // If authentic market supports higher top-tier master works, calibrate to 90% of market high
            premiumPrice = Math.round(Math.max(premiumPrice, marketComparison.marketRangeHigh * 0.90));
        }
        // Selected Price: defaults to recommended price, or artisan's manual override
        const selectedPrice = input.artisanSelectedPrice && input.artisanSelectedPrice > 0
            ? input.artisanSelectedPrice
            : recommendedPrice;
        // Recalculate profit for selected price
        const estimatedGrossProfit = Math.max(0, selectedPrice - baseCost);
        const estimatedProfitMarginPct = selectedPrice > 0
            ? Number(((estimatedGrossProfit / selectedPrice) * 100).toFixed(1))
            : 0;
        const effectiveMarkupPct = baseCost > 0
            ? Number(((estimatedGrossProfit / baseCost) * 100).toFixed(1))
            : 0;
        const platformFee = Math.round(selectedPrice * costCalculator_1.CostCalculator.PLATFORM_FEE_PCT);
        const buyerPrice = selectedPrice + platformFee + (input.shippingPayer === 'BUYER' ? (input.shippingCost || 0) : 0);
        // 5. Build Clear Human-Readable Explanation
        const craftLabel = input.craftType || input.category;
        let explanation = `Your direct workshop cost is ₹${baseCost.toLocaleString('en-IN')} `;
        explanation += `(Raw materials: ₹${costResult.materialCost.toLocaleString('en-IN')}, `;
        explanation += `Labour: ₹${costResult.labourCost.toLocaleString('en-IN')}${costResult.labourHours > 0 ? ` for ${costResult.labourHours} hrs` : ''}, `;
        explanation += `Packaging/Studio: ₹${(costResult.packagingCost + costResult.overheadCost).toLocaleString('en-IN')}). `;
        if (marketComparison.hasReliableData && marketComparison.marketMedianPrice) {
            explanation += `Authentic market benchmarks for ${marketComparison.matchedCraftType || craftLabel} indicate a median of ₹${marketComparison.marketMedianPrice.toLocaleString('en-IN')} across ${marketComparison.comparableCount} verified artisan listings. `;
            explanation += `Our recommended selling price of ₹${recommendedPrice.toLocaleString('en-IN')} gives you ₹${(recommendedPrice - baseCost).toLocaleString('en-IN')} net earnings (${Math.round(((recommendedPrice - baseCost) / recommendedPrice) * 100)}% profit margin) while staying competitive with conscious buyers.`;
        }
        else {
            explanation += `Based on your desired ${costResult.desiredMarginPct}% profit margin, setting your price at ₹${recommendedPrice.toLocaleString('en-IN')} yields ₹${estimatedGrossProfit.toLocaleString('en-IN')} net artisan remuneration with zero intermediary commission.`;
        }
        return {
            productCategory: input.category,
            craftType: craftLabel,
            minViablePrice: minViable,
            recommendedPrice,
            premiumPrice,
            selectedPrice,
            buyerPrice,
            baseProductionCost: baseCost,
            estimatedGrossProfit,
            estimatedProfitMarginPct,
            effectiveMarkupPct,
            marketComparison,
            lossRiskFlag,
            lossRiskWarning,
            costBreakdown: costResult.costBreakdown,
            explanation,
            confidenceScore: marketComparison.confidenceScore
        };
    }
}
exports.PriceRecommendationService = PriceRecommendationService;
//# sourceMappingURL=priceRecommendationService.js.map