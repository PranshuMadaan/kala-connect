import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Kala Connect Database Seed...');

  // 1. Clean existing records
  await prisma.escrowLedger.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.message.deleteMany();
  await prisma.enquiryThread.deleteMany();
  await prisma.videoProcessingJob.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productDraft.deleteMany();
  await prisma.priceRecommendation.deleteMany();
  await prisma.marketBenchmark.deleteMany();
  await prisma.artisanProfile.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Verified Authentic Market Benchmarks
  console.log('📊 Seeding Authentic Craft Market Benchmarks...');
  const benchmarks = [
    {
      category: 'pottery',
      craftType: 'Jaipur Blue Pottery',
      material: 'Quartz powder, glass, fuller earth, cobalt oxide glaze',
      craftGrade: 'GI_CERTIFIED_HERITAGE',
      region: 'Jaipur, Rajasthan',
      typicalLabourHours: 16.0,
      priceMin: 1200,
      priceMedian: 1850,
      priceMax: 3400,
      sampleSize: 42,
      sourceName: 'Rajasthan Craft Development Corporation (RDCC) & Guild Registry',
      isHandmadeCertified: true,
      notes: 'Hand-shaped without potter wheel, painted in natural metal oxide glazes and fired once in wood kiln.'
    },
    {
      category: 'pottery',
      craftType: 'Gorakhpur Terracotta Relief Craft',
      material: 'Pure Alluvial Clay, Rice Husk Temper, Natural Herbal Red Slip',
      craftGrade: 'MASTER_ARTISAN',
      region: 'Gorakhpur, Uttar Pradesh',
      typicalLabourHours: 24.0,
      priceMin: 1800,
      priceMedian: 3100,
      priceMax: 5500,
      sampleSize: 35,
      sourceName: 'UP Handicrafts Development Corporation & GI Registry',
      isHandmadeCertified: true,
      notes: 'Hand-sculpted temple figurines with intricate bell and floral reliefs.'
    },
    {
      category: 'pottery',
      craftType: 'Molela Terracotta Plaque',
      material: 'Terracotta clay, river silt, natural pigments',
      craftGrade: 'GI_CERTIFIED_HERITAGE',
      region: 'Molela, Rajasthan',
      typicalLabourHours: 20.0,
      priceMin: 1500,
      priceMedian: 2800,
      priceMax: 4800,
      sampleSize: 28,
      sourceName: 'Molela Master Potters Guild Index',
      isHandmadeCertified: true,
      notes: 'Votive clay plaques of folk deities, sun-dried and low-kiln baked.'
    },
    {
      category: 'textiles',
      craftType: 'Chanderi Handloom Weaving',
      material: 'Indigenous Organic Kala Cotton, Pure Mulberry Silk, Tested Gold Zari',
      craftGrade: 'GI_CERTIFIED_HERITAGE',
      region: 'Chanderi, Madhya Pradesh',
      typicalLabourHours: 56.0,
      priceMin: 8500,
      priceMedian: 12500,
      priceMax: 24000,
      sampleSize: 64,
      sourceName: 'Weavers Service Centre & Chanderi Development Foundation',
      isHandmadeCertified: true,
      notes: 'Woven on traditional pit-looms with interlocked extra-weft zari motifs.'
    },
    {
      category: 'textiles',
      craftType: 'Banarasi Brocade Silk Handloom',
      material: 'Pure Katan silk, silver/gold tested zari',
      craftGrade: 'MASTER_ARTISAN',
      region: 'Varanasi, Uttar Pradesh',
      typicalLabourHours: 80.0,
      priceMin: 14000,
      priceMedian: 22000,
      priceMax: 45000,
      sampleSize: 78,
      sourceName: 'Varanasi Handloom Registry & Crafts Council of India',
      isHandmadeCertified: true,
      notes: 'Jacquard/naksha pit-loom woven master bridal and heritage sarees.'
    },
    {
      category: 'traditional_crafts',
      craftType: 'Dhokra Lost-Wax Metal Casting',
      material: 'Recycled brass, bronze, beeswax, river clay',
      craftGrade: 'MASTER_ARTISAN',
      region: 'Bastar, Chhattisgarh',
      typicalLabourHours: 32.0,
      priceMin: 2200,
      priceMedian: 4200,
      priceMax: 8500,
      sampleSize: 52,
      sourceName: 'Tribal Co-operative Marketing Development Federation (TRIFED)',
      isHandmadeCertified: true,
      notes: 'Non-ferrous metal casting using lost-wax technique dating back 4000 years to Mohenjo-Daro.'
    },
    {
      category: 'woodwork',
      craftType: 'Saharanpur Wood Carving',
      material: 'Seasoned Sheesham / Rosewood, natural wax finish',
      craftGrade: 'MASTER_ARTISAN',
      region: 'Saharanpur, Uttar Pradesh',
      typicalLabourHours: 18.0,
      priceMin: 1100,
      priceMedian: 2100,
      priceMax: 4600,
      sampleSize: 45,
      sourceName: 'EPCH Woodcraft Benchmark Database',
      isHandmadeCertified: true,
      notes: 'Lattice jali work and deep floral relief carving with zero chemical stains.'
    },
    {
      category: 'paintings',
      craftType: 'Madhubani Hand Painting',
      material: 'Handmade treated rag paper, natural soot and plant pigments, bamboo twigs',
      craftGrade: 'MASTER_ARTISAN',
      region: 'Mithila, Bihar',
      typicalLabourHours: 30.0,
      priceMin: 1500,
      priceMedian: 3500,
      priceMax: 9000,
      sampleSize: 60,
      sourceName: 'Mithila Kalakriti Cooperative Benchmark',
      isHandmadeCertified: true,
      notes: 'Geometric double-line motifs depicting sacred nature, painted with nib and bamboo pens.'
    },
    {
      category: 'jewellery',
      craftType: 'Thewa Gold on Glass Work',
      material: '24K gold foil, fused colored Belgian glass, sterling silver base',
      craftGrade: 'GI_CERTIFIED_HERITAGE',
      region: 'Pratapgarh, Rajasthan',
      typicalLabourHours: 40.0,
      priceMin: 6500,
      priceMedian: 11500,
      priceMax: 28000,
      sampleSize: 22,
      sourceName: 'Thewa Artisans Welfare Society & Rajasthan Heritage Board',
      isHandmadeCertified: true,
      notes: 'Micro-chiseled 24K pure gold sheet fused on heated colored glass base.'
    },
    {
      category: 'traditional_crafts',
      craftType: 'Bidriware Silver Inlay',
      material: 'Zinc-copper alloy, 99.9% pure silver wire, Bidar fort soil patina',
      craftGrade: 'GI_CERTIFIED_HERITAGE',
      region: 'Bidar, Karnataka',
      typicalLabourHours: 25.0,
      priceMin: 2800,
      priceMedian: 5200,
      priceMax: 11000,
      sampleSize: 30,
      sourceName: 'Karnataka Handloom & Handicrafts Development Corporation',
      isHandmadeCertified: true,
      notes: 'Pure silver wire inlaid in engraved metal and oxidized to jet black with historical mud paste.'
    }
  ];

  for (const b of benchmarks) {
    await prisma.marketBenchmark.create({ data: b });
  }

  // 3. Create Users
  // Artisan 1: Master Govind Ram
  const artisanUser1 = await prisma.user.create({
    data: {
      phone: '+919876543210',
      email: 'govind.ram@kalaconnect.org',
      role: 'ARTISAN',
      displayName: 'Master Govind Ram Prajapati',
      photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM3LJNhITTVNWFlPCJDCimWawbUEHbRdc95VRlpki9zeJ2D-0cSqmwU4H5DuM37fQzpel8bHP1VzWt8xxxsg1XpOdJXFc1BPh41EOvOCvJk2GgdeuZ7C6khZQPB0jneTr2G0QTKwpqGC2CyxP2OjRWNrNwLQdGmsfwnYed2YRLYHVtg7udhyRoNM5mEyWQ8VEhlLxPFmhTp_zgLIbHeWWXH6RcyznICYY91DuGoAjN',
      preferredLanguage: 'hi'
    }
  });

  // Artisan 2: Devki Bai (Weaver)
  const artisanUser2 = await prisma.user.create({
    data: {
      phone: '+919876543211',
      email: 'devki.bai@kalaconnect.org',
      role: 'ARTISAN',
      displayName: 'Smt. Devki Bai',
      photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJpAQl3bf-rfVCY0Nq4x2l5-Pl91rjJq1KJ39NhOfGVQyyCySnIl2Naht3lnTKCGRVKIrqB43glnjDl8ywadfzbdHOFh9ekn0Ul46OvXO0KqtOLE944PVrhttJghY9f9p3X4YNVfw5IAfPqtKShUKW2WPIP9cWOQShPCCMWaJlCg_BQBqaTAae3PU_664xwSvlHs0ofC7QthGtcfkV21v2bm2UkjNW2kR20QTrU-in',
      preferredLanguage: 'hi'
    }
  });

  // Buyer 1: Ananya Sharma
  const buyerUser1 = await prisma.user.create({
    data: {
      phone: '+919811234567',
      email: 'ananya.sharma@example.com',
      role: 'BUYER',
      displayName: 'Ananya Sharma',
      preferredLanguage: 'en'
    }
  });

  // Admin User
  const adminUser = await prisma.user.create({
    data: {
      phone: '+919999900000',
      email: 'admin@kalaconnect.org',
      role: 'ADMIN',
      displayName: 'Kala Connect Guild Oversight',
      preferredLanguage: 'en'
    }
  });

  // 4. Create Artisan Profiles
  const artisanProfile1 = await prisma.artisanProfile.create({
    data: {
      userId: artisanUser1.id,
      displayName: 'Master Govind Ram Prajapati',
      title: 'National Awardee Terracotta Potter',
      craftCategories: JSON.stringify(['pottery_clay', 'terracotta']),
      regionalCluster: 'Gorakhpur Terracotta Cluster, UP',
      state: 'Uttar Pradesh',
      district: 'Gorakhpur',
      village: 'Bhadwahan',
      lineageYears: '140+ years unbroken family lineage',
      guildStatus: 'VERIFIED_MASTER',
      giTagNumber: 'GI-IN-2021-0428',
      workshopStatus: 'ACTIVE_KILN',
      bio: 'Preserving sacred terracotta horse and elephant crafting techniques inherited from ancestors. Hand-carved with alluvial riverbed clay and fired in wood kilns without synthetic glazes.',
      voiceDialect: 'Bhojpuri / Hindi',
      maskWorkshopGps: true,
      allowWhatsAppInquiries: true,
      showArtisanApprovedBadge: true,
      bankAccountDetails: JSON.stringify({ bank: 'State Bank of India', ifsc: 'SBIN0001234', mask: 'XXXX-XXXX-8821' })
    }
  });

  const artisanProfile2 = await prisma.artisanProfile.create({
    data: {
      userId: artisanUser2.id,
      displayName: 'Smt. Devki Bai',
      title: 'Master Chanderi Jamdani Weaver',
      craftCategories: JSON.stringify(['textiles', 'handloom']),
      regionalCluster: 'Chanderi Weaving Cluster, MP',
      state: 'Madhya Pradesh',
      district: 'Ashoknagar',
      village: 'Pranpur',
      lineageYears: '4th Generation Handloom Weaver',
      guildStatus: 'VERIFIED_MASTER',
      giTagNumber: 'GI-IN-2005-0012',
      workshopStatus: 'ACTIVE_LOOM',
      bio: 'Weaving delicate silk-cotton Chanderi sarees with pure zari buttis on traditional pit looms.',
      voiceDialect: 'Bundeli / Hindi',
      maskWorkshopGps: true,
      allowWhatsAppInquiries: true,
      showArtisanApprovedBadge: true,
      bankAccountDetails: JSON.stringify({ bank: 'Bank of Baroda', ifsc: 'BARB0CHAND', mask: 'XXXX-XXXX-4412' })
    }
  });

  // 5. Create Price Recommendation for Seed Product 1
  const priceRec1 = await prisma.priceRecommendation.create({
    data: {
      artisanId: artisanProfile1.id,
      productCategory: 'pottery',
      craftType: 'Gorakhpur Terracotta Relief Craft',
      materialCost: 650.0,
      labourHours: 12.0,
      labourHourlyRate: 150.0,
      labourCost: 1800.0,
      packagingCost: 150.0,
      overheadCost: 120.0,
      shippingCost: 200.0,
      shippingPayer: 'BUYER',
      baseProductionCost: 2720.0,
      desiredMarginPct: 22.0,
      markupPct: 28.2,
      minViablePrice: 2850.0,
      recommendedPrice: 3100.0,
      premiumPrice: 3800.0,
      marketMedianPrice: 3100.0,
      marketRangeLow: 1800.0,
      marketRangeHigh: 5500.0,
      comparableCount: 35,
      confidenceScore: 0.94,
      lossRiskFlag: false,
      artisanSelectedPrice: 3100.0,
      explanation: 'Production cost of ₹2,720 with 12 artisan labour hours @ ₹150/hr. Recommending ₹3,100 aligns with authentic Gorakhpur GI benchmark median (₹3,100) and secures 22% net profit for the artisan.',
      costBreakdown: JSON.stringify({
        rawMaterials: 650,
        labourHours: 12,
        labourRate: 150,
        labourCost: 1800,
        packaging: 150,
        studioOverhead: 120,
        baseCost: 2720,
        artisanNetProfit: 380,
        platformFee: 155
      })
    }
  });

  // 6. Create Published Products
  const product1 = await prisma.product.create({
    data: {
      artisanId: artisanProfile1.id,
      title: 'Handcrafted Terracotta Sacred Temple Elephant',
      category: 'Pottery & Clay',
      craftType: 'Gorakhpur Terracotta Relief Craft',
      craftDiscipline: 'Hand-pinched & wheel-turned clay sculpture',
      description: 'Authentic hand-carved Gorakhpur terracotta elephant, adorned with traditional temple bells and natural red slip. Sculpted from alluvial silt scooped from the banks of Rapti river, seasoned with wood ash, and hand-ornamented with bell and lotus motifs.',
      rawMaterials: JSON.stringify(['Pure Alluvial Clay', 'Rice Husk Temper', 'Natural Herbal Red Slip']),
      dimensions: JSON.stringify({ height: '28 cm', width: '22 cm', diameter: '18 cm', weight: '2.4 kg' }),
      makerPrice: 3100.0,
      buyerPrice: 3450.0,
      stockReady: 4,
      leadTimeDays: 2,
      careInstructions: 'Dust with soft dry brush. Keep away from water immersion.',
      giRegistryNumber: 'GI-IN-2021-0428',
      status: 'PUBLISHED',
      pricingRecommendationId: priceRec1.id,
      images: JSON.stringify([
        {
          url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc',
          rank: 1,
          isHero: true,
          qualityScore: 0.94,
          detectedAngle: 'FRONT_HERO'
        }
      ]),
      tags: JSON.stringify(['pottery', 'terracotta', 'elephant', 'gi-tagged', 'gorakhpur']),
      translations: JSON.stringify({
        hi: {
          title: 'गोरखपुर टेराकोटा हस्तनिर्मित मंदिर हाथी',
          description: 'पारंपरिक मिट्टी से बना कलात्मक हाथी, प्राकृतिक रंगों और घंटियों से सुसज्जित।'
        }
      })
    }
  });

  const product2 = await prisma.product.create({
    data: {
      artisanId: artisanProfile2.id,
      title: 'Authentic Chanderi Jamdani Handloom Silk Saree',
      category: 'Textiles',
      craftType: 'Chanderi Handloom Weaving',
      craftDiscipline: 'Traditional Pit-Loom Weaving with Zari Work',
      description: 'Handwoven pure Chanderi silk and indigenous organic Kala cotton blend with gold zari floral motifs.',
      rawMaterials: JSON.stringify(['Indigenous Organic Kala Cotton', 'Pure Mulberry Silk', 'Tested Gold Zari']),
      dimensions: JSON.stringify({ height: '1.15 m', width: '5.5 m', weight: '450 grams' }),
      makerPrice: 12500.0,
      buyerPrice: 14500.0,
      stockReady: 1,
      leadTimeDays: 14,
      careInstructions: 'Dry clean only. Store wrapped in pure unbleached muslin cloth.',
      giRegistryNumber: 'GI-IN-2005-0012',
      status: 'PUBLISHED',
      images: JSON.stringify([
        {
          url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc',
          rank: 1,
          isHero: true,
          qualityScore: 0.96,
          detectedAngle: 'PERSPECTIVE_45'
        }
      ]),
      tags: JSON.stringify(['textiles', 'chanderi', 'saree', 'silk', 'handloom', 'gi-tagged']),
      translations: JSON.stringify({
        hi: {
          title: 'पारंपरिक चंदेरी जामदानी सिल्क साड़ी',
          description: 'हथकरघे पर बुनी शुद्ध चंदेरी सिल्क साड़ी, ज़री बूटियों के साथ।'
        }
      })
    }
  });

  // 7. Create Direct Enquiry Thread
  const thread = await prisma.enquiryThread.create({
    data: {
      productId: product1.id,
      buyerId: buyerUser1.id,
      artisanId: artisanProfile1.id,
      status: 'OPEN',
      subject: 'Inquiry regarding 12-inch terracotta elephant'
    }
  });

  await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: buyerUser1.id,
      text: 'Namaste Master Govind Ram! Can this elephant be crafted in a 12-inch size for our Diwali puja mandir?',
      detectedDialect: 'en',
      translatedText: 'नमस्ते मास्टर गोविंद राम! क्या यह हाथी हमारे दिवाली पूजा मंदिर के लिए 12 इंच के आकार में बनाया जा सकता है?'
    }
  });

  await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: artisanUser1.id,
      text: 'प्रणाम! हां, हम इसे शुद्ध गंगा-राप्ती की मिट्टी से 12 इंच में बना सकते हैं। धूप में सुखाने और भट्टी में पकाने में लगभग 10-12 दिन लगेंगे।',
      detectedDialect: 'hi',
      translatedText: 'Pranam! Yes, we can sculpt this in 12-inch height using pure Rapti silt. Sun-curing and wood-kiln firing will take approximately 10-12 days.'
    }
  });

  // 8. Create Commission & 5 Milestones with Sandbox Escrow Ledger
  const commission = await prisma.commission.create({
    data: {
      orderNumber: 'KC-ORD-2026-8821',
      buyerId: buyerUser1.id,
      artisanId: artisanProfile2.id,
      productId: product2.id,
      totalEscrowAmount: 14500.0,
      amountDisbursed: 5800.0,
      amountInEscrow: 8700.0,
      customDimensions: '5.5 meters x 1.15 meters',
      weaveDensity: '84 threads/inch',
      weatherAdvisory: JSON.stringify({ status: 'monsoon_pause', note: 'Natural herbal dye vat stabilization.' }),
      status: 'ACTIVE'
    }
  });

  // 5 Milestones (20%, 20%, 30%, 15%, 15%)
  const m1 = await prisma.milestone.create({
    data: {
      commissionId: commission.id,
      stageNumber: 1,
      title: 'Seed Lot / Organic Fiber Selection & Hand Spinning',
      percentage: 20.0,
      amount: 2900.0,
      status: 'DISBURSED',
      proofPhotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd',
      artisanNotes: 'Organic Kala cotton spun on traditional charkha. Moisture verified.',
      disbursedAt: new Date(Date.now() - 7 * 86400000)
    }
  });

  const m2 = await prisma.milestone.create({
    data: {
      commissionId: commission.id,
      stageNumber: 2,
      title: 'Natural Indigo & Herbal Vat Dyeing',
      percentage: 20.0,
      amount: 2900.0,
      status: 'DISBURSED',
      proofPhotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd',
      artisanNotes: 'Herbal pomegranate rind and natural indigo leaf bath completed.',
      disbursedAt: new Date(Date.now() - 3 * 86400000)
    }
  });

  const m3 = await prisma.milestone.create({
    data: {
      commissionId: commission.id,
      stageNumber: 3,
      title: 'Handloom Pit-Loom Weaving',
      percentage: 30.0,
      amount: 4350.0,
      status: 'IN_PROGRESS',
      proofPhotoUrl: null,
      artisanNotes: 'Loom density calibrated to 84 picks/inch. Zari buttis being hand-inserted.'
    }
  });

  const m4 = await prisma.milestone.create({
    data: {
      commissionId: commission.id,
      stageNumber: 4,
      title: 'Natural Sun Curing & Herbal Softening',
      percentage: 15.0,
      amount: 2175.0,
      status: 'PENDING'
    }
  });

  const m5 = await prisma.milestone.create({
    data: {
      commissionId: commission.id,
      stageNumber: 5,
      title: 'GI Tag Inspection & Studio Packaging / Dispatch',
      percentage: 15.0,
      amount: 2175.0,
      status: 'PENDING'
    }
  });

  // Append-only Sandbox Escrow Ledger Entries
  await prisma.escrowLedger.create({
    data: {
      commissionId: commission.id,
      milestoneId: null,
      transactionType: 'DEPOSIT',
      amount: 14500.0,
      description: 'Patron deposited total commission escrow into secure holding account.',
      reference: 'TXN-BANK-ESCROW-INIT'
    }
  });

  await prisma.escrowLedger.create({
    data: {
      commissionId: commission.id,
      milestoneId: m1.id,
      transactionType: 'DISBURSEMENT',
      amount: 2900.0,
      description: 'Milestone 1 approved. Disbursed 20% to artisan bank account.',
      reference: 'TXN-DISBURSE-STAGE1'
    }
  });

  await prisma.escrowLedger.create({
    data: {
      commissionId: commission.id,
      milestoneId: m2.id,
      transactionType: 'DISBURSEMENT',
      amount: 2900.0,
      description: 'Milestone 2 approved. Disbursed 20% to artisan bank account.',
      reference: 'TXN-DISBURSE-STAGE2'
    }
  });

  console.log('✅ Kala Connect Database Seed Completed successfully!');
  console.log(`   - Users: 4`);
  console.log(`   - Artisan Profiles: 2`);
  console.log(`   - Market Benchmarks: ${benchmarks.length}`);
  console.log(`   - Published Products: 2`);
  console.log(`   - Price Recommendations: 1`);
  console.log(`   - Enquiry Threads: 1 (with 2 translated messages)`);
  console.log(`   - Commissions: 1 (with 5 milestones & 3 ledger entries)`);
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
