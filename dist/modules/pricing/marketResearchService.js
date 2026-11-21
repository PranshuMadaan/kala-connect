"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketResearchService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class MarketResearchService {
    /**
     * Identifies comparable market products from authentic benchmark records
     * without scraping or violating terms.
     */
    static async findComparables(query) {
        const categoryNorm = (query.category || '').toLowerCase().trim();
        const craftTypeNorm = (query.craftType || '').toLowerCase().trim();
        const isGi = Boolean(query.isGiTagged);
        // Retrieve all benchmarks in database
        const allBenchmarks = await prisma.marketBenchmark.findMany();
        if (allBenchmarks.length === 0) {
            return {
                hasReliableData: false,
                comparableCount: 0,
                marketMedianPrice: null,
                marketRangeLow: null,
                marketRangeHigh: null,
                craftGrade: 'UNKNOWN',
                confidenceScore: 0.0,
                dataFreshness: new Date(),
                sourceAttribution: 'None available',
                matchedCraftType: null,
                comparables: [],
                explanation: 'No historical market benchmark data is currently available in the system catalog.'
            };
        }
        // Score match quality
        const scored = allBenchmarks.map(b => {
            let score = 0;
            const bCat = b.category.toLowerCase();
            const bCraft = b.craftType.toLowerCase();
            const bMat = b.material.toLowerCase();
            // Category matching
            if (bCat === categoryNorm || categoryNorm.includes(bCat) || bCat.includes(categoryNorm)) {
                score += 40;
            }
            // Craft type / technique matching
            if (craftTypeNorm && (bCraft.includes(craftTypeNorm) || craftTypeNorm.includes(bCraft))) {
                score += 40;
            }
            // Material token matching
            if (query.materialsText) {
                const words = query.materialsText.toLowerCase().split(/[\s,]+/);
                for (const w of words) {
                    if (w.length > 3 && bMat.includes(w)) {
                        score += 10;
                        break;
                    }
                }
            }
            // GI Tag matching bonus
            if (isGi && b.craftGrade === 'GI_CERTIFIED_HERITAGE') {
                score += 15;
            }
            return { benchmark: b, matchScore: score };
        });
        // Filter to matches with meaningful correlation (score >= 35)
        const matches = scored
            .filter(item => item.matchScore >= 35)
            .sort((a, b) => b.matchScore - a.matchScore);
        if (matches.length === 0) {
            return {
                hasReliableData: false,
                comparableCount: 0,
                marketMedianPrice: null,
                marketRangeLow: null,
                marketRangeHigh: null,
                craftGrade: isGi ? 'GI_CERTIFIED_HERITAGE' : 'HANDMADE_ARTISAN',
                confidenceScore: 0.15,
                dataFreshness: new Date(),
                sourceAttribution: 'General Handicrafts Registry',
                matchedCraftType: null,
                comparables: [],
                explanation: `No verified market records closely match '${query.craftType || query.category}'. Recommended price will be calculated primarily from your direct production expenses to protect your margins.`
            };
        }
        // Top match
        const primary = matches[0].benchmark;
        const topScore = matches[0].matchScore;
        // Aggregate statistics across relevant matches
        let totalSample = 0;
        let weightedMedianSum = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        const sourcesSet = new Set();
        for (const m of matches) {
            const b = m.benchmark;
            const weight = m.matchScore * b.sampleSize;
            totalSample += b.sampleSize;
            weightedMedianSum += b.priceMedian * weight;
            if (b.priceMin < minPrice)
                minPrice = b.priceMin;
            if (b.priceMax > maxPrice)
                maxPrice = b.priceMax;
            sourcesSet.add(b.sourceName);
        }
        const totalWeight = matches.reduce((acc, m) => acc + (m.matchScore * m.benchmark.sampleSize), 0);
        const aggregateMedian = totalWeight > 0 ? Math.round(weightedMedianSum / totalWeight) : primary.priceMedian;
        // Calculate confidence score (bounded 0.35 to 0.98)
        const confidence = Math.min(0.98, Math.max(0.35, (topScore / 95.0) * (totalSample >= 25 ? 1.0 : totalSample / 25.0)));
        const sourcesStr = Array.from(sourcesSet).join('; ');
        const explanation = `Matched ${matches.length} authentic handicraft benchmarks (${totalSample} verified artisan listings) from ${sourcesStr}. Benchmark median for authentic ${primary.craftType} is ₹${aggregateMedian.toLocaleString('en-IN')} (typical range: ₹${minPrice.toLocaleString('en-IN')} – ₹${maxPrice.toLocaleString('en-IN')}).`;
        return {
            hasReliableData: true,
            comparableCount: totalSample,
            marketMedianPrice: aggregateMedian,
            marketRangeLow: minPrice !== Infinity ? minPrice : primary.priceMin,
            marketRangeHigh: maxPrice !== -Infinity ? maxPrice : primary.priceMax,
            craftGrade: primary.craftGrade,
            confidenceScore: Number(confidence.toFixed(2)),
            dataFreshness: primary.updatedAt,
            sourceAttribution: sourcesStr,
            matchedCraftType: primary.craftType,
            comparables: matches.slice(0, 3).map(m => ({
                id: m.benchmark.id,
                craftType: m.benchmark.craftType,
                category: m.benchmark.category,
                craftGrade: m.benchmark.craftGrade,
                priceMedian: m.benchmark.priceMedian,
                priceRange: `₹${m.benchmark.priceMin.toLocaleString('en-IN')} – ₹${m.benchmark.priceMax.toLocaleString('en-IN')}`,
                region: m.benchmark.region,
                sourceName: m.benchmark.sourceName,
                isHandmadeCertified: m.benchmark.isHandmadeCertified
            })),
            explanation
        };
    }
}
exports.MarketResearchService = MarketResearchService;
//# sourceMappingURL=marketResearchService.js.map