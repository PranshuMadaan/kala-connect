"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class BuyerController {
    /**
     * Home Discovery screen payload:
     * Returns regions, craft categories, featured verified artisans, and new listings.
     */
    static async getHome(req, res) {
        // 1. Featured Artisans
        const artisans = await prisma.artisanProfile.findMany({
            take: 6,
            include: {
                user: { select: { photoUrl: true } }
            }
        });
        // 2. New Listings
        const products = await prisma.product.findMany({
            where: { status: 'PUBLISHED' },
            take: 8,
            orderBy: { createdAt: 'desc' },
            include: {
                artisan: { select: { displayName: true, regionalCluster: true, state: true } }
            }
        });
        // Formatted regions & craft categories
        const regions = [
            { id: 'north', name: 'Uttar Pradesh & North', artisanCount: '450+', craftCount: '12 GI Crafts', coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc' },
            { id: 'central', name: 'Madhya Pradesh & Central', artisanCount: '380+', craftCount: '14 GI Crafts', coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd' },
            { id: 'west', name: 'Kutch & Gujarat', artisanCount: '320+', craftCount: '9 GI Crafts', coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM3LJNhITTVNWFlPCJDCimWawbUEHbRdc95VRlpki9zeJ2D-0cSqmwU4H5DuM37fQzpel8bHP1VzWt8xxxsg1XpOdJXFc1BPh41EOvOCvJk2GgdeuZ7C6khZQPB0jneTr2G0QTKwpqGC2CyxP2OjRWNrNwLQdGmsfwnYed2YRLYHVtg7udhyRoNM5mEyWQ8VEhlLxPFmhTp_zgLIbHeWWXH6RcyznICYY91DuGoAjN' },
            { id: 'east', name: 'Bihar & Bengal', artisanCount: '290+', craftCount: '11 GI Crafts', coverUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJpAQl3bf-rfVCY0Nq4x2l5-Pl91rjJq1KJ39NhOfGVQyyCySnIl2Naht3lnTKCGRVKIrqB43glnjDl8ywadfzbdHOFh9ekn0Ul46OvXO0KqtOLE944PVrhttJghY9f9p3X4YNVfw5IAfPqtKShUKW2WPIP9cWOQShPCCMWaJlCg_BQBqaTAae3PU_664xwSvlHs0ofC7QthGtcfkV21v2bm2UkjNW2kR20QTrU-in' }
        ];
        const craftCategories = [
            { id: 'pottery', title: 'Pottery & Clay', clusterCount: '18 Clusters', count: 32, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc' },
            { id: 'textiles', title: 'Handloom Textiles', clusterCount: '24 Clusters', count: 48, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd' },
            { id: 'jewellery', title: 'Tribal & Dokra Jewellery', clusterCount: '8 Clusters', count: 19, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM3LJNhITTVNWFlPCJDCimWawbUEHbRdc95VRlpki9zeJ2D-0cSqmwU4H5DuM37fQzpel8bHP1VzWt8xxxsg1XpOdJXFc1BPh41EOvOCvJk2GgdeuZ7C6khZQPB0jneTr2G0QTKwpqGC2CyxP2OjRWNrNwLQdGmsfwnYed2YRLYHVtg7udhyRoNM5mEyWQ8VEhlLxPFmhTp_zgLIbHeWWXH6RcyznICYY91DuGoAjN' },
            { id: 'paintings', title: 'Traditional Folk Art', clusterCount: '12 Clusters', count: 26, imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJpAQl3bf-rfVCY0Nq4x2l5-Pl91rjJq1KJ39NhOfGVQyyCySnIl2Naht3lnTKCGRVKIrqB43glnjDl8ywadfzbdHOFh9ekn0Ul46OvXO0KqtOLE944PVrhttJghY9f9p3X4YNVfw5IAfPqtKShUKW2WPIP9cWOQShPCCMWaJlCg_BQBqaTAae3PU_664xwSvlHs0ofC7QthGtcfkV21v2bm2UkjNW2kR20QTrU-in' }
        ];
        const formattedListings = products.map(p => {
            let images = [];
            try {
                images = JSON.parse(p.images);
            }
            catch { }
            return {
                id: p.id,
                title: p.title,
                price: p.buyerPrice,
                makerPrice: p.makerPrice,
                category: p.category,
                craftType: p.craftType,
                region: p.artisan?.regionalCluster || 'India',
                imageUrl: images[0]?.url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc',
                giRegistryNumber: p.giRegistryNumber
            };
        });
        const formattedArtisans = artisans.map(a => ({
            id: a.id,
            displayName: a.displayName,
            regionalCluster: a.regionalCluster,
            craftLineage: a.lineageYears || 'Generational Master',
            imageUrl: a.user?.photoUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM3LJNhITTVNWFlPCJDCimWawbUEHbRdc95VRlpki9zeJ2D-0cSqmwU4H5DuM37fQzpel8bHP1VzWt8xxxsg1XpOdJXFc1BPh41EOvOCvJk2GgdeuZ7C6khZQPB0jneTr2G0QTKwpqGC2CyxP2OjRWNrNwLQdGmsfwnYed2YRLYHVtg7udhyRoNM5mEyWQ8VEhlLxPFmhTp_zgLIbHeWWXH6RcyznICYY91DuGoAjN',
            giTagNumber: a.giTagNumber
        }));
        return res.json({
            success: true,
            data: {
                regions,
                craftCategories,
                featuredArtisans: formattedArtisans,
                newListings: formattedListings
            }
        });
    }
    /**
     * Search and filter products across craft category, state, GI tags, price.
     */
    static async search(req, res) {
        const { q, category, state, giCertified, minPrice, maxPrice, sort, page = '1', limit = '12' } = req.query;
        const where = { status: 'PUBLISHED' };
        if (q) {
            const qStr = String(q);
            const qLower = qStr.toLowerCase();
            const qCap = qStr.charAt(0).toUpperCase() + qStr.slice(1);
            where.OR = [
                { title: { contains: qStr } },
                { title: { contains: qLower } },
                { title: { contains: qCap } },
                { description: { contains: qStr } },
                { description: { contains: qLower } },
                { category: { contains: qStr } },
                { category: { contains: qLower } },
                { category: { contains: qCap } },
                { craftType: { contains: qStr } },
                { craftType: { contains: qLower } },
                { craftType: { contains: qCap } }
            ];
        }
        if (category && category !== 'All Crafts') {
            where.category = { contains: String(category) };
        }
        if (state) {
            where.artisan = { state: { contains: String(state) } };
        }
        if (giCertified === 'true') {
            where.giRegistryNumber = { not: null };
        }
        if (minPrice || maxPrice) {
            where.buyerPrice = {};
            if (minPrice)
                where.buyerPrice.gte = parseFloat(minPrice);
            if (maxPrice)
                where.buyerPrice.lte = parseFloat(maxPrice);
        }
        let orderBy = { createdAt: 'desc' };
        if (sort === 'price_asc')
            orderBy = { buyerPrice: 'asc' };
        if (sort === 'price_desc')
            orderBy = { buyerPrice: 'desc' };
        const take = parseInt(limit);
        const skip = (parseInt(page) - 1) * take;
        const [products, totalCount] = await Promise.all([
            prisma.product.findMany({
                where,
                take,
                skip,
                orderBy,
                include: {
                    artisan: { select: { displayName: true, regionalCluster: true, state: true, guildStatus: true } }
                }
            }),
            prisma.product.count({ where })
        ]);
        const items = products.map(p => {
            let images = [];
            try {
                images = JSON.parse(p.images);
            }
            catch { }
            return {
                id: p.id,
                title: p.title,
                price: p.buyerPrice,
                makerPrice: p.makerPrice,
                category: p.category,
                craftType: p.craftType,
                region: p.artisan?.regionalCluster || 'India',
                artisanName: p.artisan?.displayName,
                imageUrl: images[0]?.url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc',
                giRegistryNumber: p.giRegistryNumber
            };
        });
        return res.json({
            success: true,
            data: {
                results: items,
                items,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    totalPages: Math.ceil(totalCount / take),
                    hasMore: skip + items.length < totalCount
                }
            }
        });
    }
    /**
     * Product details with unfiltered studio proof guarantee, GI registry, and raw materials.
     */
    static async getProductDetail(req, res) {
        const id = req.params.id;
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                artisan: {
                    include: { user: { select: { photoUrl: true } } }
                }
            }
        });
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        let images = [];
        let rawMaterials = [];
        let dimensions = {};
        let tags = [];
        let translations = {};
        try {
            images = JSON.parse(product.images);
        }
        catch { }
        try {
            rawMaterials = JSON.parse(product.rawMaterials);
        }
        catch { }
        try {
            dimensions = JSON.parse(product.dimensions);
        }
        catch { }
        try {
            tags = JSON.parse(product.tags);
        }
        catch { }
        try {
            translations = product.translations ? JSON.parse(product.translations) : {};
        }
        catch { }
        // Apply GPS privacy masking to artisan profile
        const artisanData = {
            id: product.artisan.id,
            displayName: product.artisan.displayName,
            title: product.artisan.title,
            regionalCluster: product.artisan.regionalCluster,
            state: product.artisan.state,
            // Mask village if GPS masking is active
            village: product.artisan.maskWorkshopGps ? `${product.artisan.district} Craft Cluster (Location Masked for Privacy)` : product.artisan.village,
            district: product.artisan.district,
            guildStatus: product.artisan.guildStatus,
            giTagNumber: product.artisan.giTagNumber,
            workshopStatus: product.artisan.workshopStatus,
            bio: product.artisan.bio,
            voiceDialect: product.artisan.voiceDialect,
            audioBioUrl: product.artisan.audioBioUrl,
            photoUrl: product.artisan.user.photoUrl
        };
        return res.json({
            success: true,
            data: {
                id: product.id,
                title: product.title,
                category: product.category,
                craftType: product.craftType,
                craftDiscipline: product.craftDiscipline,
                description: product.description,
                rawMaterials,
                dimensions,
                makerPrice: product.makerPrice,
                buyerPrice: product.buyerPrice,
                stockReady: product.stockReady,
                leadTimeDays: product.leadTimeDays,
                careInstructions: product.careInstructions,
                giRegistryNumber: product.giRegistryNumber,
                status: product.status,
                images,
                tags,
                translations,
                artisan: artisanData,
                remuneration: {
                    artisanPayout: product.makerPrice,
                    buyerTotal: product.buyerPrice,
                    middlemanMarkup: 0.0,
                    payoutPolicy: '100% of declared maker price paid directly to artisan upon delivery.'
                }
            }
        });
    }
    /**
     * Public artisan profile lookup
     */
    static async getArtisanProfile(req, res) {
        const id = req.params.id;
        const artisan = await prisma.artisanProfile.findUnique({
            where: { id },
            include: {
                user: { select: { photoUrl: true, preferredLanguage: true } },
                products: { where: { status: 'PUBLISHED' }, take: 6 }
            }
        });
        if (!artisan) {
            return res.status(404).json({ success: false, error: 'Artisan profile not found' });
        }
        return res.json({
            success: true,
            data: {
                id: artisan.id,
                displayName: artisan.displayName,
                title: artisan.title,
                regionalCluster: artisan.regionalCluster,
                state: artisan.state,
                district: artisan.district,
                village: artisan.maskWorkshopGps ? 'Masked for Maker Privacy' : artisan.village,
                guildStatus: artisan.guildStatus,
                giTagNumber: artisan.giTagNumber,
                workshopStatus: artisan.workshopStatus,
                bio: artisan.bio,
                voiceDialect: artisan.voiceDialect,
                photoUrl: artisan.user.photoUrl,
                productsCount: artisan.products.length
            }
        });
    }
}
exports.BuyerController = BuyerController;
//# sourceMappingURL=buyer.controller.js.map