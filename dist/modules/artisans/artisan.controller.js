"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtisanController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ArtisanController {
    /**
     * Artisan Studio Dashboard: counts, pipeline stages, recent listings, inquiries.
     */
    static async getDashboard(req, res) {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const artisan = await prisma.artisanProfile.findFirst({
            where: { userId: req.user.id }
        });
        if (!artisan) {
            return res.status(404).json({ success: false, error: 'Artisan profile not found' });
        }
        // Studio Counts
        const [draftsCount, processingCount, needsApprovalCount, publishedCount, newEnquiriesCount] = await Promise.all([
            prisma.productDraft.count({ where: { artisanId: artisan.id, status: 'DRAFT' } }),
            prisma.videoProcessingJob.count({ where: { artisanId: artisan.id, stage: { in: ['EXTRACTING', 'SCORING', 'SELECTING'] } } }),
            prisma.productDraft.count({ where: { artisanId: artisan.id, status: 'APPROVED' } }),
            prisma.product.count({ where: { artisanId: artisan.id, status: 'PUBLISHED' } }),
            prisma.enquiryThread.count({ where: { artisanId: artisan.id, status: 'OPEN' } })
        ]);
        // Recent Products
        const recentListings = await prisma.product.findMany({
            where: { artisanId: artisan.id },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });
        // Recent Enquiries
        const recentEnquiries = await prisma.enquiryThread.findMany({
            where: { artisanId: artisan.id },
            take: 5,
            orderBy: { updatedAt: 'desc' },
            include: {
                buyer: { select: { displayName: true } },
                product: { select: { title: true } },
                messages: { take: 1, orderBy: { createdAt: 'desc' } }
            }
        });
        const formattedListings = recentListings.map(p => {
            let images = [];
            try {
                images = JSON.parse(p.images);
            }
            catch { }
            return {
                id: p.id,
                title: p.title,
                price: p.buyerPrice,
                status: p.status,
                stockReady: p.stockReady,
                imageUrl: images[0]?.url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc'
            };
        });
        const formattedEnquiries = recentEnquiries.map(e => ({
            id: e.id,
            buyerName: e.buyer.displayName,
            productTitle: e.product.title,
            messagePreview: e.messages[0]?.text || e.subject,
            status: e.status,
            timeAgo: 'Just now'
        }));
        return res.json({
            success: true,
            data: {
                artisan: {
                    id: artisan.id,
                    displayName: artisan.displayName,
                    regionalCluster: artisan.regionalCluster,
                    craftLineage: artisan.lineageYears || 'Generational Master',
                    workshopStatus: artisan.workshopStatus
                },
                counts: {
                    drafts: draftsCount,
                    processing: processingCount,
                    needsApproval: needsApprovalCount,
                    published: publishedCount,
                    newEnquiries: newEnquiriesCount
                },
                recentListings: formattedListings,
                recentEnquiries: formattedEnquiries
            }
        });
    }
    /**
     * Get artisan onboarding state
     */
    static async getOnboarding(req, res) {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const artisan = await prisma.artisanProfile.findFirst({
            where: { userId: req.user.id }
        });
        let craftCategories = [];
        try {
            craftCategories = artisan ? JSON.parse(artisan.craftCategories) : [];
        }
        catch { }
        return res.json({
            success: true,
            data: {
                step: artisan ? 'completed' : 'profile_details',
                artisan: artisan ? {
                    id: artisan.id,
                    displayName: artisan.displayName,
                    title: artisan.title,
                    craftCategories,
                    regionalCluster: artisan.regionalCluster,
                    state: artisan.state,
                    district: artisan.district,
                    village: artisan.village,
                    lineageYears: artisan.lineageYears,
                    bio: artisan.bio,
                    voiceDialect: artisan.voiceDialect,
                    maskWorkshopGps: artisan.maskWorkshopGps,
                    allowWhatsAppInquiries: artisan.allowWhatsAppInquiries,
                    showArtisanApprovedBadge: artisan.showArtisanApprovedBadge
                } : null
            }
        });
    }
    /**
     * Save artisan onboarding profile & privacy consent
     */
    static async saveOnboarding(req, res) {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const { displayName, title, craftCategories, regionalCluster, state, district, village, lineageYears, bio, voiceDialect, maskWorkshopGps = true, allowWhatsAppInquiries = true, showArtisanApprovedBadge = true } = req.body;
        const categoriesJson = JSON.stringify(Array.isArray(craftCategories) ? craftCategories : [craftCategories]);
        const updated = await prisma.artisanProfile.upsert({
            where: { userId: req.user.id },
            create: {
                userId: req.user.id,
                displayName: displayName || req.user.displayName,
                title: title || 'Traditional Artisan Maker',
                craftCategories: categoriesJson,
                regionalCluster: regionalCluster || `${district || 'Regional'} Craft Cluster`,
                state: state || 'India',
                district: district || 'Central',
                village,
                lineageYears: lineageYears || '10+ years',
                bio,
                voiceDialect,
                maskWorkshopGps: Boolean(maskWorkshopGps),
                allowWhatsAppInquiries: Boolean(allowWhatsAppInquiries),
                showArtisanApprovedBadge: Boolean(showArtisanApprovedBadge)
            },
            update: {
                displayName,
                title,
                craftCategories: categoriesJson,
                regionalCluster,
                state,
                district,
                village,
                lineageYears,
                bio,
                voiceDialect,
                maskWorkshopGps: Boolean(maskWorkshopGps),
                allowWhatsAppInquiries: Boolean(allowWhatsAppInquiries),
                showArtisanApprovedBadge: Boolean(showArtisanApprovedBadge)
            }
        });
        // Ensure user role is ARTISAN
        await prisma.user.update({
            where: { id: req.user.id },
            data: { role: 'ARTISAN' }
        });
        return res.json({
            success: true,
            message: 'Artisan profile & consent settings saved successfully',
            data: updated
        });
    }
}
exports.ArtisanController = ArtisanController;
//# sourceMappingURL=artisan.controller.js.map