import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CostCalculator } from './costCalculator';
import { MarketResearchService } from './marketResearchService';
import { PriceRecommendationService, PriceRecommendationInput } from './priceRecommendationService';

const prisma = new PrismaClient();

export class PricingController {
  /**
   * Fast cost-based calculator endpoint
   * POST /api/pricing/calculate or POST /api/v1/pricing/calculate
   */
  static async calculateCost(req: Request, res: Response) {
    try {
      const {
        materialCost = 0,
        labourHours = 0,
        labourHourlyRate,
        hourlyRate,
        labourCost,
        packagingCost = 0,
        overheadCost = 0,
        otherProductionCosts,
        shippingCost = 0,
        shippingPayer = 'BUYER',
        desiredMarginPct,
        desiredProfitMargin,
        markupPct
      } = req.body;

      const resolvedRate = labourHourlyRate !== undefined ? Number(labourHourlyRate) : (hourlyRate !== undefined ? Number(hourlyRate) : undefined);
      const resolvedOverhead = overheadCost !== undefined && Number(overheadCost) > 0 ? Number(overheadCost) : (otherProductionCosts !== undefined ? Number(otherProductionCosts) : 0);
      const resolvedMargin = desiredMarginPct !== undefined ? Number(desiredMarginPct) : (desiredProfitMargin !== undefined ? Number(desiredProfitMargin) : 20);

      const result = CostCalculator.calculate({
        materialCost: Number(materialCost),
        labourHours: Number(labourHours),
        labourHourlyRate: resolvedRate,
        labourCost: labourCost !== undefined ? Number(labourCost) : undefined,
        packagingCost: Number(packagingCost),
        overheadCost: resolvedOverhead,
        shippingCost: Number(shippingCost),
        shippingPayer,
        desiredMarginPct: resolvedMargin,
        markupPct: markupPct !== undefined ? Number(markupPct) : undefined
      });

      return res.json({
        success: true,
        data: {
          ...result,
          actualProfitMarginPct: result.desiredMarginPct,
          grossProfit: result.estimatedGrossProfit
        }
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * Complete Market-Based Price Setter with Comparable Product Intelligence
   * POST /api/v1/pricing/recommend or POST /api/pricing/recommend
   */
  static async recommendPrice(req: Request, res: Response) {
    try {
      const {
        draftId,
        category,
        craftType,
        productName,
        materialsText,
        material,
        dimensions,
        isGiTagged,
        isGiCertified,
        region,
        materialCost = 0,
        labourHours = 0,
        labourHourlyRate,
        hourlyRate,
        labourCost,
        packagingCost = 0,
        overheadCost = 0,
        otherProductionCosts,
        shippingCost = 0,
        shippingPayer = 'BUYER',
        desiredMarginPct,
        desiredProfitMargin,
        artisanSelectedPrice
      } = req.body;

      if (!category) {
        return res.status(400).json({ success: false, error: 'Product category is required.' });
      }

      const resolvedRate = labourHourlyRate !== undefined ? Number(labourHourlyRate) : (hourlyRate !== undefined ? Number(hourlyRate) : undefined);
      const resolvedOverhead = overheadCost !== undefined && Number(overheadCost) > 0 ? Number(overheadCost) : (otherProductionCosts !== undefined ? Number(otherProductionCosts) : 0);
      const resolvedMargin = desiredMarginPct !== undefined ? Number(desiredMarginPct) : (desiredProfitMargin !== undefined ? Number(desiredProfitMargin) : 20);
      const resolvedGi = isGiTagged !== undefined ? Boolean(isGiTagged) : Boolean(isGiCertified);
      const resolvedMaterials = materialsText || material;

      const recommendation = await PriceRecommendationService.generateRecommendation({
        category,
        craftType,
        productName,
        materialsText: resolvedMaterials,
        dimensions,
        isGiTagged: resolvedGi,
        region,
        materialCost: Number(materialCost),
        labourHours: Number(labourHours),
        labourHourlyRate: resolvedRate,
        labourCost: labourCost !== undefined ? Number(labourCost) : undefined,
        packagingCost: Number(packagingCost),
        overheadCost: resolvedOverhead,
        shippingCost: Number(shippingCost),
        shippingPayer,
        desiredMarginPct: resolvedMargin,
        artisanSelectedPrice: artisanSelectedPrice ? Number(artisanSelectedPrice) : undefined
      });

      // Always persist record in database for auditability and selection saving
      let targetArtisanId = req.user?.artisanId;
      if (!targetArtisanId) {
        const defaultArtisan = await prisma.artisanProfile.findFirst();
        targetArtisanId = defaultArtisan ? defaultArtisan.id : 'default_artisan';
      }

      const record = await prisma.priceRecommendation.create({
        data: {
          draftId: draftId || null,
          artisanId: targetArtisanId,
          productCategory: recommendation.productCategory,
          craftType: recommendation.craftType,
          materialCost: recommendation.costBreakdown.materialCost,
          labourHours: Number(labourHours) || 0,
          labourHourlyRate: resolvedRate || CostCalculator.DEFAULT_HOURLY_RATE,
          labourCost: recommendation.costBreakdown.labourCost,
          packagingCost: recommendation.costBreakdown.packagingCost,
          overheadCost: recommendation.costBreakdown.overheadCost,
          shippingCost: recommendation.costBreakdown.shippingCost,
          shippingPayer,
          baseProductionCost: recommendation.baseProductionCost,
          desiredMarginPct: resolvedMargin,
          markupPct: recommendation.effectiveMarkupPct,
          minViablePrice: recommendation.minViablePrice,
          recommendedPrice: recommendation.recommendedPrice,
          premiumPrice: recommendation.premiumPrice,
          marketMedianPrice: recommendation.marketComparison.marketMedianPrice,
          marketRangeLow: recommendation.marketComparison.marketRangeLow,
          marketRangeHigh: recommendation.marketComparison.marketRangeHigh,
          comparableCount: recommendation.marketComparison.comparableCount,
          confidenceScore: recommendation.confidenceScore,
          lossRiskFlag: recommendation.lossRiskFlag,
          artisanSelectedPrice: recommendation.selectedPrice,
          explanation: recommendation.explanation,
          costBreakdown: JSON.stringify(recommendation.costBreakdown),
          comparableListings: JSON.stringify(recommendation.marketComparison.comparables)
        }
      });

      const recommendationRecordId = record.id;

      // If draftId provided, link recommendation to draft
      if (draftId) {
        await prisma.productDraft.update({
          where: { id: draftId },
          data: {
            pricingRecommendationId: record.id,
            makerPrice: recommendation.selectedPrice,
            buyerPrice: recommendation.buyerPrice,
            recommendedPrice: recommendation.recommendedPrice,
            pricingInputs: JSON.stringify(req.body)
          }
        }).catch(() => {});
      }

      return res.json({
        success: true,
        data: {
          ...recommendation,
          id: recommendationRecordId,
          recommendationId: recommendationRecordId,
          minimumViablePrice: recommendation.minViablePrice,
          lossWarningFlag: recommendation.lossRiskFlag,
          lossWarningMessage: recommendation.lossRiskWarning,
          breakdown: {
            costBased: {
              desiredMarginPct: resolvedMargin,
              baseCost: recommendation.baseProductionCost,
              makerPrice: recommendation.selectedPrice
            }
          },
          marketComparison: {
            ...recommendation.marketComparison,
            sampleSize: recommendation.marketComparison.comparableCount,
            comparablePriceMedian: recommendation.marketComparison.marketMedianPrice,
            comparablePriceMin: recommendation.marketComparison.marketRangeLow,
            comparablePriceMax: recommendation.marketComparison.marketRangeHigh,
            confidenceLevel: recommendation.marketComparison.confidenceScore
          }
        }
      });
    } catch (err: any) {
      console.error('[PricingController.recommendPrice] error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Returns list of authentic craft benchmarks
   * GET /api/v1/pricing/benchmarks
   */
  static async getBenchmarks(req: Request, res: Response) {
    try {
      const category = req.query.category as string;
      const craftType = req.query.craftType as string;

      const where: any = {};
      if (category) where.category = category;
      if (craftType) where.craftType = { contains: craftType };

      const benchmarks = await prisma.marketBenchmark.findMany({
        where,
        orderBy: { updatedAt: 'desc' }
      });

      return res.json({
        success: true,
        count: benchmarks.length,
        data: benchmarks
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Save artisan's chosen selling price override
   * POST /api/v1/pricing/save-selection
   */
  static async savePriceSelection(req: Request, res: Response) {
    try {
      const { draftId, selectedPrice, finalSellingPrice, recommendationId, chosenTier, artisanNotes } = req.body;
      const numericPrice = Number(selectedPrice || finalSellingPrice || 0);
      const buyerPrice = Math.round(numericPrice * 1.05);

      if (draftId && numericPrice > 0) {
        await prisma.productDraft.update({
          where: { id: draftId },
          data: {
            makerPrice: numericPrice,
            buyerPrice: buyerPrice,
            finalPrice: numericPrice,
            pricingRecommendationId: recommendationId || undefined
          }
        }).catch(() => {});
      }

      if (recommendationId && numericPrice > 0) {
        await prisma.priceRecommendation.update({
          where: { id: recommendationId },
          data: { artisanSelectedPrice: numericPrice }
        }).catch(() => {});
      }

      return res.json({
        success: true,
        message: 'Artisan price confirmed and saved.',
        data: {
          recommendationId,
          chosenTier: chosenTier || 'recommended',
          finalSellingPrice: numericPrice,
          makerPrice: numericPrice,
          buyerPrice: buyerPrice
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
