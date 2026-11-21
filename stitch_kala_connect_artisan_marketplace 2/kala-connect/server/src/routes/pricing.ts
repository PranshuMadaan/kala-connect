import { Router, Request, Response } from 'express';

export const pricingRouter = Router();

/**
 * POST /api/pricing/calculate
 * Computes fair-price breakdown from studio inputs.
 */
pricingRouter.post('/calculate', (req: Request, res: Response) => {
  try {
    const {
      material_cost = 0,
      labour_cost = 0,
      packaging_cost = 0,
      overhead_cost = 0,
      profit_margin_pct = 20
    } = req.body;

    const materials = Math.max(0, Number(material_cost) || 0);
    const labour = Math.max(0, Number(labour_cost) || 0);
    const packaging = Math.max(0, Number(packaging_cost) || 0);
    const overhead = Math.max(0, Number(overhead_cost) || 0);
    const marginPct = Math.max(5, Math.min(100, Number(profit_margin_pct) || 20));

    const subtotal = materials + labour + packaging + overhead;
    const profit = Math.round(subtotal * (marginPct / 100));
    const makerPrice = subtotal + profit;
    const networkFee = Math.round(makerPrice * 0.05); // 5% platform fee paid by buyer
    const buyerPrice = makerPrice + networkFee;

    res.json({
      success: true,
      breakdown: {
        material_cost: materials,
        labour_cost: labour,
        packaging_cost: packaging,
        overhead_cost: overhead,
        subtotal_cost: subtotal,
        profit_margin_pct: marginPct,
        profit_amount: profit,
        maker_price: makerPrice,
        platform_fee_5pct: networkFee,
        buyer_price: buyerPrice,
        artisan_share_pct: 100 // 100% of Maker Price reaches artisan
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Pricing calculation failed' });
  }
});
