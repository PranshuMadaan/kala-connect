import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class EnquiryController {
  /**
   * Start a new direct enquiry thread from buyer to artisan.
   */
  static async createEnquiry(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const productId = req.body.productId;
    const message = req.body.message || req.body.initialMessage;
    const subject = req.body.subject;
    if (!productId || !message) {
      return res.status(400).json({ success: false, error: 'productId and message are required' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { artisan: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Create thread
    const thread = await prisma.enquiryThread.create({
      data: {
        productId,
        buyerId: req.user.id,
        artisanId: product.artisanId,
        subject: subject || `Inquiry for ${product.title}`,
        status: 'OPEN'
      }
    });

    // Create initial message
    const initialMsg = await prisma.message.create({
      data: {
        threadId: thread.id,
        senderId: req.user.id,
        text: message,
        detectedDialect: 'en',
        translatedText: `नमस्ते! खरीदार का प्रश्न: ${message}`
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Direct maker enquiry thread created',
      data: {
        threadId: thread.id,
        initialMessage: initialMsg
      }
    });
  }

  /**
   * Get thread history, audio notes, attachments, and participant details.
   */
  static async getThread(req: Request, res: Response) {
    const threadId = req.params.threadId as string;

    const thread = await prisma.enquiryThread.findUnique({
      where: { id: threadId },
      include: {
        product: { select: { id: true, title: true, buyerPrice: true, images: true } },
        buyer: { select: { id: true, displayName: true, photoUrl: true, phone: true } },
        artisan: {
          select: {
            id: true,
            displayName: true,
            regionalCluster: true,
            voiceDialect: true,
            workshopStatus: true,
            guildStatus: true,
            user: { select: { photoUrl: true } }
          }
        },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!thread) {
      return res.status(404).json({ success: false, error: 'Enquiry thread not found' });
    }

    // Verify participant authorization
    if (req.user && req.user.id !== thread.buyerId && req.user.artisanId !== thread.artisanId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied: not a participant of this thread' });
    }

    const messages = thread.messages.map(m => {
      let attachments = [];
      try { attachments = JSON.parse(m.attachments || '[]'); } catch {}
      return {
        id: m.id,
        senderId: m.senderId,
        senderRole: m.senderId === thread.buyerId ? 'buyer' : 'artisan',
        text: m.text,
        audioNoteUrl: m.audioNoteUrl,
        detectedDialect: m.detectedDialect,
        translatedText: m.translatedText,
        attachments,
        createdAt: m.createdAt
      };
    });

    return res.json({
      success: true,
      data: {
        threadId: thread.id,
        status: thread.status,
        subject: thread.subject,
        product: thread.product,
        artisan: {
          ...thread.artisan,
          photoUrl: thread.artisan.user?.photoUrl
        },
        buyer: thread.buyer,
        messages,
        dialogueAssurance: {
          zeroMiddleman: true,
          directChannel: 'Artisan Workshop Studio Desk',
          autoTranslation: 'Dialect translation active'
        }
      }
    });
  }

  /**
   * Post message or audio memo into thread.
   */
  static async sendMessage(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const threadId = req.params.threadId as string;
    const { text, audioNoteUrl, attachments } = req.body;

    const thread = await prisma.enquiryThread.findUnique({
      where: { id: threadId }
    });

    if (!thread) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const senderRole = req.user.id === thread.buyerId ? 'BUYER' : 'ARTISAN';

    // Vernacular translation simulation
    let detectedDialect = 'en';
    let translatedText = text;

    if (senderRole === 'ARTISAN') {
      detectedDialect = 'hi';
      translatedText = `[Artisan Translated]: ${text}`;
    } else {
      detectedDialect = 'en';
      translatedText = `[हिंदी अनुवाद]: ${text}`;
    }

    const message = await prisma.message.create({
      data: {
        threadId,
        senderId: req.user.id,
        text: text || '(Voice Note / Attachment)',
        audioNoteUrl,
        detectedDialect,
        translatedText,
        attachments: attachments ? JSON.stringify(attachments) : null
      }
    });

    // Update thread updated timestamp
    await prisma.enquiryThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  }

  /**
   * Convert enquiry thread to custom commission proposal.
   */
  static async requestCustomOrder(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const threadId = req.params.threadId as string;
    const { customDimensions, weaveDensity, proposedBudget } = req.body;

    const thread = await prisma.enquiryThread.findUnique({
      where: { id: threadId },
      include: { product: true }
    });

    if (!thread) {
      return res.status(404).json({ success: false, error: 'Thread not found' });
    }

    const budget = parseFloat(proposedBudget || String(thread.product.buyerPrice));
    const orderNumber = `KC-ORD-${Date.now().toString().slice(-6)}`;

    // Create Commission in database
    const commission = await prisma.commission.create({
      data: {
        orderNumber,
        buyerId: thread.buyerId,
        artisanId: thread.artisanId,
        productId: thread.productId,
        totalEscrowAmount: budget,
        amountDisbursed: 0,
        amountInEscrow: budget,
        customDimensions: customDimensions || 'Custom Atelier Specifications',
        weaveDensity: weaveDensity || 'Master Grade Density',
        status: 'ACTIVE'
      }
    });

    // Setup 5 Standard Milestones (20%, 20%, 30%, 15%, 15%)
    const stages = [
      { num: 1, title: 'Seed Lot / Organic Fiber Selection & Hand Spinning', pct: 20 },
      { num: 2, title: 'Natural Indigo & Herbal Vat Dyeing', pct: 20 },
      { num: 3, title: 'Handloom Pit-Loom Weaving', pct: 30 },
      { num: 4, title: 'Natural Sun Curing & Herbal Softening', pct: 15 },
      { num: 5, title: 'GI Tag Inspection & Studio Packaging / Dispatch', pct: 15 }
    ];

    for (const st of stages) {
      await prisma.milestone.create({
        data: {
          commissionId: commission.id,
          stageNumber: st.num,
          title: st.title,
          percentage: st.pct,
          amount: Number(((budget * st.pct) / 100).toFixed(2)),
          status: st.num === 1 ? 'IN_PROGRESS' : 'PENDING'
        }
      });
    }

    // Create Initial Deposit in Sandbox Escrow Ledger
    await prisma.escrowLedger.create({
      data: {
        commissionId: commission.id,
        transactionType: 'DEPOSIT',
        amount: budget,
        description: `Patron funded ₹${budget} for custom commission #${orderNumber} into protected escrow.`,
        reference: `ESCROW-INIT-${orderNumber}`
      }
    });

    // Mark thread
    await prisma.enquiryThread.update({
      where: { id: threadId },
      data: { status: 'COMMISSION_REQUESTED' }
    });

    return res.status(201).json({
      success: true,
      message: 'Custom order commission initiated with 5 protected escrow milestones',
      data: {
        commissionId: commission.id,
        orderNumber: commission.orderNumber,
        totalAmount: budget,
        commissionUrl: `/orders/${commission.id}`
      }
    });
  }
}
