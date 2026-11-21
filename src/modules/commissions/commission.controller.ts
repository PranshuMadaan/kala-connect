import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class CommissionController {
  /**
   * Get commission details, milestone tracker, and append-only escrow ledger.
   */
  static async getCommission(req: Request, res: Response) {
    const orderId = req.params.orderId as string;

    const commission = await prisma.commission.findFirst({
      where: {
        OR: [
          { id: orderId },
          { orderNumber: orderId }
        ]
      },
      include: {
        buyer: { select: { id: true, displayName: true, photoUrl: true, phone: true } },
        artisan: {
          select: {
            id: true,
            displayName: true,
            regionalCluster: true,
            voiceDialect: true,
            user: { select: { photoUrl: true } }
          }
        },
        product: { select: { id: true, title: true, category: true, images: true } },
        milestones: { orderBy: { stageNumber: 'asc' } },
        ledgerEntries: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission order not found' });
    }

    let weatherAdvisory = { status: 'optimal', note: 'Climate conditions optimal for studio curing.' };
    try {
      if (commission.weatherAdvisory) {
        weatherAdvisory = JSON.parse(commission.weatherAdvisory);
      }
    } catch {}

    const activeMilestone = commission.milestones.find(m => m.status === 'IN_PROGRESS' || m.status === 'PROOF_SUBMITTED') || commission.milestones[commission.milestones.length - 1];

    return res.json({
      success: true,
      data: {
        id: commission.id,
        orderNumber: commission.orderNumber,
        status: commission.status,
        totalEscrowAmount: commission.totalEscrowAmount,
        amountInEscrow: commission.amountInEscrow,
        amountDisbursed: commission.amountDisbursed,
        customDimensions: commission.customDimensions,
        weaveDensity: commission.weaveDensity,
        weatherAdvisory,
        product: commission.product,
        artisan: commission.artisan,
        buyer: commission.buyer,
        activeStage: activeMilestone?.stageNumber || 1,
        milestones: commission.milestones,
        escrowLedger: commission.ledgerEntries,
        protectionNotice: 'All funds held securely in sandbox escrow ledger. Disbursed directly to maker upon proof approval.'
      }
    });
  }

  /**
   * Artisan submits milestone stage proof (photo/audio).
   */
  static async submitMilestoneProof(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const orderId = req.params.orderId as string;
    const stage = req.params.stage as string;
    const { proofPhotoUrl, proofAudioMemoUrl, artisanNotes } = req.body;
    const stageNum = parseInt(stage);

    const commission = await prisma.commission.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }]
      },
      include: { milestones: true }
    });

    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }

    // Verify artisan role
    if (req.user.role !== 'ARTISAN' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only a registered artisan can submit milestone proof' });
    }

    const targetMilestone = commission.milestones.find(m => m.stageNumber === stageNum);
    if (!targetMilestone) {
      return res.status(404).json({ success: false, error: `Milestone stage ${stage} not found` });
    }

    if (targetMilestone.status === 'DISBURSED') {
      return res.status(400).json({ success: false, error: 'This milestone has already been approved and disbursed' });
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: targetMilestone.id },
      data: {
        status: 'PROOF_SUBMITTED',
        proofPhotoUrl: proofPhotoUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd',
        proofAudioMemoUrl,
        artisanNotes: artisanNotes || 'Stage proof submitted from artisan studio workbench.'
      }
    });

    return res.json({
      success: true,
      message: `Proof submitted for Stage ${stageNum}: ${targetMilestone.title}. Awaiting patron approval.`,
      data: updatedMilestone
    });
  }

  /**
   * Buyer reviews and approves milestone proof; releases escrow payment via transaction.
   */
  static async approveMilestone(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const orderId = req.params.orderId as string;
    const stage = req.params.stage as string;
    const stageNum = parseInt(stage);

    const commission = await prisma.commission.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }]
      },
      include: { milestones: true }
    });

    if (!commission) {
      return res.status(404).json({ success: false, error: 'Commission not found' });
    }

    // Verify buyer authorization
    if (req.user.id !== commission.buyerId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only the ordering patron or admin can approve milestones' });
    }

    const targetMilestone = commission.milestones.find(m => m.stageNumber === stageNum);
    if (!targetMilestone) {
      return res.status(404).json({ success: false, error: `Milestone stage ${stage} not found` });
    }

    if (targetMilestone.status === 'DISBURSED') {
      return res.status(400).json({ success: false, error: 'Milestone payout has already been released (duplicate prevented)' });
    }

    // Execute financial state machine in a database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark milestone disbursed
      const updatedMilestone = await tx.milestone.update({
        where: { id: targetMilestone.id },
        data: {
          status: 'DISBURSED',
          disbursedAt: new Date()
        }
      });

      // 2. Adjust commission escrow balances
      const updatedCommission = await tx.commission.update({
        where: { id: commission.id },
        data: {
          amountDisbursed: Number((commission.amountDisbursed + targetMilestone.amount).toFixed(2)),
          amountInEscrow: Number((commission.amountInEscrow - targetMilestone.amount).toFixed(2)),
          status: stageNum === 5 ? 'COMPLETED' : commission.status
        }
      });

      // 3. Append ledger entry
      const ledgerEntry = await tx.escrowLedger.create({
        data: {
          commissionId: commission.id,
          milestoneId: targetMilestone.id,
          transactionType: 'DISBURSEMENT',
          amount: targetMilestone.amount,
          description: `Stage ${stageNum} (${targetMilestone.title}) approved by patron. Disbursed ₹${targetMilestone.amount} to artisan account.`,
          reference: `TXN-DISBURSE-ST${stageNum}-${commission.orderNumber}`
        }
      });

      // 4. Advance next milestone to IN_PROGRESS if exists
      const nextMilestone = commission.milestones.find(m => m.stageNumber === stageNum + 1);
      if (nextMilestone) {
        await tx.milestone.update({
          where: { id: nextMilestone.id },
          data: { status: 'IN_PROGRESS' }
        });
      }

      return { updatedMilestone, updatedCommission, ledgerEntry };
    });

    return res.json({
      success: true,
      message: `Stage ${stageNum} approved successfully! ₹${targetMilestone.amount} disbursed to artisan.`,
      data: result
    });
  }
}
