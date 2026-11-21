import assert from 'assert';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:5000';

interface TestStats {
  passed: number;
  failed: number;
  tests: { name: string; success: boolean; durationMs: number; error?: string }[];
}

const stats: TestStats = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  process.stdout.write(`  ⏳ Running: ${name}... `);
  try {
    await fn();
    const durationMs = Date.now() - start;
    console.log(`✅ PASSED (${durationMs}ms)`);
    stats.passed++;
    stats.tests.push({ name, success: true, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(`❌ FAILED (${durationMs}ms)`);
    console.error(`     Error: ${err.message}`);
    stats.failed++;
    stats.tests.push({ name, success: false, durationMs, error: err.message });
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🌸 KALA CONNECT — BACKEND AUTOMATED TEST SUITE');
  console.log(`🌐 Testing live server: ${API_BASE}`);
  console.log('================================================================\n');

  let buyerToken = '';
  let artisanToken = '';
  let seededProductId = '';
  let createdDraftId = '';
  let videoJobId = '';
  let enquiryThreadId = '';
  let commissionOrderId = '';

  // -------------------------------------------------------------
  // SUITE 1: Server Infrastructure & Health
  // -------------------------------------------------------------
  console.log('📦 SUITE 1: Infrastructure & Health');

  await test('GET /health returns healthy status', async () => {
    const res = await fetch(`${API_BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.ok(data.uptimeSeconds >= 0);
  });

  await test('GET /api/v1/docs serves interactive API documentation', async () => {
    const res = await fetch(`${API_BASE}/api/v1/docs`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Kala Connect Backend API (v1)'));
    assert.ok(html.includes('/api/v1/auth/request-otp'));
  });

  // -------------------------------------------------------------
  // SUITE 2: Authentication & Sessions
  // -------------------------------------------------------------
  console.log('\n🔑 SUITE 2: Authentication & Role Sessions');

  await test('POST /api/v1/auth/request-otp generates OTP', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919811234567' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.phone || body.phone, '+919811234567');
  });

  await test('POST /api/v1/auth/verify-otp issues JWT tokens for Buyer', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919811234567', otp: '123456' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    buyerToken = body.data?.accessToken || body.accessToken || body.token;
    assert.ok(buyerToken, 'Access token must be present');
    const user = body.data?.user || body.user;
    assert.strictEqual(user.phone, '+919811234567');
  });

  await test('POST /api/v1/auth/verify-otp issues JWT tokens for Artisan', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919876543210', otp: '123456' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    artisanToken = body.data?.accessToken || body.accessToken || body.token;
    assert.ok(artisanToken, 'Artisan access token must be present');
    const user = body.data?.user || body.user;
    assert.strictEqual(user.role, 'ARTISAN');
  });

  await test('POST /api/v1/auth/switch-role toggles persona', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/switch-role`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ targetRole: 'ARTISAN' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const role = body.data?.role || body.user?.role || body.role;
    assert.strictEqual(role, 'ARTISAN');

    // Switch back to BUYER
    await fetch(`${API_BASE}/api/v1/auth/switch-role`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ targetRole: 'BUYER' })
    });
  });

  await test('GET /api/v1/auth/me returns authenticated profile', async () => {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data?.phone || body.user?.phone, '+919811234567');
  });

  // -------------------------------------------------------------
  // SUITE 3: Buyer Marketplace & Discovery
  // -------------------------------------------------------------
  console.log('\n🛍️ SUITE 3: Buyer Marketplace & Discovery');

  await test('GET /api/v1/buyer/home returns curated discovery sections', async () => {
    const res = await fetch(`${API_BASE}/api/v1/buyer/home`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.regions), 'Regions must be array');
    assert.ok(Array.isArray(body.data.craftCategories), 'Craft categories must be array');
    assert.ok(Array.isArray(body.data.featuredArtisans), 'Featured artisans must be array');
    assert.ok(Array.isArray(body.data.newListings), 'New listings must be array');
    assert.ok(body.data.newListings.length > 0, 'Must have seeded products');
    seededProductId = body.data.newListings[0].id;
  });

  await test('GET /api/v1/buyer/search performs faceted craft filtering', async () => {
    const res = await fetch(`${API_BASE}/api/v1/buyer/search?q=terracotta&minPrice=1000&maxPrice=5000`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.items));
    assert.ok((body.data.pagination.total || body.data.pagination.totalCount) >= 1);
  });

  await test('GET /api/v1/buyer/products/:id returns authentic loom details & GPS privacy masking', async () => {
    assert.ok(seededProductId, 'Product ID must be known');
    const res = await fetch(`${API_BASE}/api/v1/buyer/products/${seededProductId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.id, seededProductId);
    assert.strictEqual(body.data.remuneration.middlemanMarkup, 0);
    assert.ok(body.data.remuneration.artisanPayout > 0);
    // Verify GPS village masking is applied
    assert.ok(body.data.artisan.village.includes('Masked'), 'Artisan village must be privacy masked');
  });

  // -------------------------------------------------------------
  // SUITE 4: Artisan Studio & Profile Management
  // -------------------------------------------------------------
  console.log('\n🏺 SUITE 4: Artisan Studio & Profile Management');

  await test('GET /api/v1/artisan/dashboard returns pipeline stage counts', async () => {
    const res = await fetch(`${API_BASE}/api/v1/artisan/dashboard`, {
      headers: { 'Authorization': `Bearer ${artisanToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.counts.published >= 1, 'Must have at least 1 published product');
    assert.ok('drafts' in body.data.counts);
    assert.ok('processing' in body.data.counts);
    assert.ok('needsApproval' in body.data.counts);
  });

  await test('POST /api/v1/artisan/onboarding saves master profile & privacy settings', async () => {
    const res = await fetch(`${API_BASE}/api/v1/artisan/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        displayName: 'Master Govind Ram Prajapati',
        title: 'National Awardee Terracotta Potter',
        craftCategories: ['pottery_clay', 'terracotta'],
        regionalCluster: 'Gorakhpur Terracotta Cluster, UP',
        state: 'Uttar Pradesh',
        district: 'Gorakhpur',
        village: 'Bhadwahan',
        lineageYears: '140+ years unbroken family lineage',
        bio: 'Preserving sacred terracotta horse and elephant crafting techniques inherited from ancestors.',
        maskWorkshopGps: true,
        allowWhatsAppInquiries: true,
        showArtisanApprovedBadge: true
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.maskWorkshopGps, true);
  });

  // -------------------------------------------------------------
  // SUITE 5: 5-Step AI Video Cataloging Wizard
  // -------------------------------------------------------------
  console.log('\n🎥 SUITE 5: 5-Step AI Video Cataloging Wizard');

  await test('Step 1: POST /api/v1/artisan/products/draft saves craft facts', async () => {
    const res = await fetch(`${API_BASE}/api/v1/artisan/products/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        title: 'Terracotta Sacred Temple Horse',
        category: 'Pottery & Clay',
        craftType: 'Gorakhpur Terracotta Relief Craft',
        rawMaterials: ['Alluvial Rapti River Clay', 'Natural Wood Ash', 'Natural Herbal Red Slip'],
        dimensions: { height: '32 cm', width: '24 cm', weight: '2.8 kg' },
        makerPrice: 3800,
        stockReady: 3,
        leadTimeDays: 4,
        careInstructions: 'Clean with soft dry feather brush. Do not immerse in water.'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.draftId);
    createdDraftId = body.data.draftId;
  });

  await test('Step 2: POST /api/v1/artisan/products/:draftId/video-upload processes video upload', async () => {
    assert.ok(createdDraftId, 'Draft ID must be defined');
    const sampleVideoPath = path.resolve(__dirname, '../uploads/videos/test_sample.mp4');
    assert.ok(fs.existsSync(sampleVideoPath), 'Sample video file must exist');

    const fileBuffer = fs.readFileSync(sampleVideoPath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('video', blob, 'test_sample.mp4');

    const res = await fetch(`${API_BASE}/api/v1/artisan/products/${createdDraftId}/video-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${artisanToken}`
      },
      body: formData
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.jobId);
    videoJobId = body.data.jobId;
  });

  await test('Step 3: POST /api/v1/artisan/jobs/start-processing triggers multi-objective optimization', async () => {
    assert.ok(videoJobId, 'Job ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/artisan/jobs/start-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({ jobId: videoJobId })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.stage, 'EXTRACTING');
  });

  await test('Step 3: GET /api/v1/artisan/jobs/:jobId/status polls until optimization completes', async () => {
    assert.ok(videoJobId, 'Job ID must be defined');
    let completed = false;
    let attempts = 0;

    while (!completed && attempts < 20) {
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch(`${API_BASE}/api/v1/artisan/jobs/${videoJobId}/status`, {
        headers: { 'Authorization': `Bearer ${artisanToken}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      if (body.data.stage === 'COMPLETED' || body.data.progressPercentage === 100) {
        completed = true;
      }
      attempts++;
    }
    assert.ok(completed, 'Job should complete processing within allocated polling period');
  });

  await test('Step 4: GET /api/v1/artisan/jobs/:jobId/candidates returns optimized photos S*', async () => {
    assert.ok(videoJobId, 'Job ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/artisan/jobs/${videoJobId}/candidates`, {
      headers: { 'Authorization': `Bearer ${artisanToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.selectedImages));
    assert.ok(body.data.selectedImages.length > 0, 'Must have selected images from multi-objective optimizer');
  });

  await test('Step 4: POST /api/v1/artisan/jobs/:jobId/approve-images confirms artisan curation', async () => {
    assert.ok(videoJobId, 'Job ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/artisan/jobs/${videoJobId}/approve-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        selectedImages: [
          {
            url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrV6ghL4oVZNRY7qSHvSHG1nSHC_Re8HRmtAIfI3uqGt-7ilWIAampaVt7AcJFKVt2wzoIpuXDioQZU3wA_UvbVr1ZK4LuSbjozLw0Sk3AwJ1LLcQuDhvCTHvshFSfaQnffz9acMXg5aXHbcOmpLC3a2to1291Tx8eKBOGNosymWqQYhN1OR01AStJLF2uv_F8X5x9Tb5qsNrK2QzCO2uv0yO44INWbivEmNsIhRRc',
            viewpoint: 'HERO_FRONT',
            rank: 1,
            compositeScore: 0.94
          }
        ]
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
  });

  await test('Step 5: GET /api/v1/artisan/products/:draftId/ai-review provides grounded Gemini listing', async () => {
    assert.ok(createdDraftId, 'Draft ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/artisan/products/${createdDraftId}/ai-review`, {
      headers: { 'Authorization': `Bearer ${artisanToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.title, 'AI title must be generated');
    assert.ok(body.data.description, 'AI description must be generated');
    assert.ok(Array.isArray(body.data.tags), 'Tags must be an array');
    assert.ok(Array.isArray(body.data.verifiedAttributes), 'Verified attributes must be an array');
    assert.ok(body.data.verifiedAttributes.some((a: any) => a.key === 'Raw Materials'));
  });

  await test('Step 5: POST /api/v1/artisan/products/:draftId/publish releases item to live marketplace', async () => {
    assert.ok(createdDraftId, 'Draft ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/artisan/products/${createdDraftId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        title: 'Authentic Gorakhpur Terracotta Sacred Horse',
        description: 'Generational clay sculpture handcrafted from alluvial Rapti silt and fired in sacred kiln.',
        tags: ['terracotta', 'gorakhpur', 'gi-certified', 'clay-art']
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.productId);
    assert.ok(body.data.listingUrl);
    assert.ok(body.data.share.whatsappGreetingTemplate.includes('Namaste'));
  });

  // -------------------------------------------------------------
  // SUITE 6: Direct Maker Enquiries & Vernacular Chat
  // -------------------------------------------------------------
  console.log('\n💬 SUITE 6: Direct Maker Enquiries & Vernacular Chat');

  await test('POST /api/v1/enquiries/create initiates direct buyer-maker dialogue', async () => {
    assert.ok(seededProductId, 'Seeded product ID must be known');
    const res = await fetch(`${API_BASE}/api/v1/enquiries/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        productId: seededProductId,
        subject: 'Custom motif carving enquiry on Terracotta Sacred Elephant',
        initialMessage: 'Namaste Master Govind Ram! Can this elephant sculpture be customized with floral engraving?'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.threadId);
    enquiryThreadId = body.data.threadId;
  });

  await test('GET /api/v1/enquiries/:threadId returns dialogue history & zero-middleman assurance', async () => {
    assert.ok(enquiryThreadId, 'Thread ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/enquiries/${enquiryThreadId}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.dialogueAssurance.zeroMiddleman, true);
    assert.ok(body.data.messages.length >= 1);
  });

  await test('POST /api/v1/enquiries/:threadId/messages translates vernacular exchange', async () => {
    assert.ok(enquiryThreadId, 'Thread ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/enquiries/${enquiryThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        text: 'हाँ बाबूजी, हम इस पर पारंपरिक कमल और घंटी की नक्काशी कर देंगे।'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.detectedDialect, 'hi');
    assert.ok(body.data.translatedText.includes('Artisan Translated'));
  });

  // -------------------------------------------------------------
  // SUITE 7: Custom Commission & 5-Stage Escrow Milestones
  // -------------------------------------------------------------
  console.log('\n🛡️ SUITE 7: Custom Commission & 5-Stage Escrow Milestones');

  await test('POST /api/v1/enquiries/:threadId/request-custom-order creates 5-stage escrow ledger', async () => {
    assert.ok(enquiryThreadId, 'Thread ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/enquiries/${enquiryThreadId}/request-custom-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        customDimensions: '35cm H × 28cm W × 20cm D',
        weaveDensity: 'Master Grade Alluvial Silt Relief',
        proposedBudget: 4500
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.commissionId);
    commissionOrderId = body.data.commissionId;
  });

  await test('GET /api/v1/commissions/:orderId returns all 5 milestones and active stage', async () => {
    assert.ok(commissionOrderId, 'Commission ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/commissions/${commissionOrderId}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.milestones.length, 5, 'Must contain all 5 standard milestone stages');
    assert.strictEqual(body.data.milestones[0].percentage, 20);
    assert.strictEqual(body.data.milestones[1].percentage, 20);
    assert.strictEqual(body.data.milestones[2].percentage, 30);
    assert.strictEqual(body.data.milestones[3].percentage, 15);
    assert.strictEqual(body.data.milestones[4].percentage, 15);
    assert.strictEqual(body.data.escrowLedger.length, 1, 'Initial deposit must exist in ledger');
  });

  await test('POST /api/v1/commissions/:orderId/milestones/1/submit-proof records workbench proof', async () => {
    assert.ok(commissionOrderId, 'Commission ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/commissions/${commissionOrderId}/milestones/1/submit-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${artisanToken}`
      },
      body: JSON.stringify({
        proofPhotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmpXASV-9nkDMKoGz7glKYMC70ENnYGs8Q2MYU1-kKRPbxdWiGw2aSF7z_lu3n2Ors_W0rd_WLgnZKiGnAfyYkc_2vNTGrmfyZDcGX27kgTUwrbmefN1HgdMaUNAoM0o1cflkRX7hs7COc6AM-AarCyIeqmdiBZ1XtJEzvvZnYssT-KyU5JQOHVgng86qpqDJDKJ_J1HM1e9hVYGtexJW9GB5vsdrEB7-15VOddhUd',
        artisanNotes: 'Organic alluvial silt and rice husk temper prepared and hand-kneaded.'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'PROOF_SUBMITTED');
  });

  await test('POST /api/v1/commissions/:orderId/milestones/1/approve releases partial escrow payout via atomic transaction', async () => {
    assert.ok(commissionOrderId, 'Commission ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/commissions/${commissionOrderId}/milestones/1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.updatedMilestone.status, 'DISBURSED');
    assert.strictEqual(body.data.ledgerEntry.transactionType, 'DISBURSEMENT');
    assert.ok(body.data.updatedCommission.amountDisbursed > 0);
  });

  await test('PREVENT DUPLICATE: Re-approving Stage 1 returns 400 error', async () => {
    assert.ok(commissionOrderId, 'Commission ID must be defined');
    const res = await fetch(`${API_BASE}/api/v1/commissions/${commissionOrderId}/milestones/1/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    assert.strictEqual(res.status, 400, 'Duplicate payout must be strictly rejected');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('duplicate') || body.error.includes('already'));
  });

  // -------------------------------------------------------------
  // SUITE 8: AI Market-Based Price Setter & Benchmark Engine
  // -------------------------------------------------------------
  console.log('\n💰 SUITE 8: AI Market-Based Price Setter & Benchmark Engine');

  let savedPriceRecId = '';

  await test('POST /api/pricing/calculate computes transparent cost-plus breakdown', async () => {
    const res = await fetch(`${API_BASE}/api/pricing/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialCost: 500,
        labourHours: 10,
        hourlyRate: 80,
        packagingCost: 100,
        otherProductionCosts: 50,
        desiredProfitMargin: 25,
        platformFeePct: 5
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const d = body.data;
    // Base cost = 500 + 800 + 100 + 50 = 1450
    assert.strictEqual(d.baseProductionCost, 1450);
    assert.strictEqual(d.costBreakdown.labourCost, 800);
    // Maker price at 25% margin = 1450 / (1 - 0.25) = 1933
    assert.strictEqual(d.makerPrice, 1933);
    assert.strictEqual(d.grossProfit, 483);
    assert.strictEqual(d.actualProfitMarginPct, 25);
    // Buyer price = 1933 + 5% fee (97) = 2030
    assert.strictEqual(d.platformFee, 97);
    assert.strictEqual(d.buyerPrice, 2030);
  });

  await test('POST /api/pricing/recommend generates 3-tier prices with authentic benchmarks', async () => {
    const res = await fetch(`${API_BASE}/api/pricing/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialCost: 450,
        labourHours: 12,
        hourlyRate: 75,
        packagingCost: 80,
        otherProductionCosts: 40,
        desiredProfitMargin: 20,
        category: 'pottery',
        craftType: 'Jaipur Blue Pottery',
        craftGrade: 'master',
        material: 'Quartz Powder, Fuller Earth, Natural Turquoise Glaze',
        region: 'Rajasthan',
        isGiCertified: true
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const rec = body.data;
    savedPriceRecId = rec.id;

    assert.ok(rec.minimumViablePrice > 0, 'Min viable price must be positive');
    assert.ok(rec.recommendedPrice >= rec.minimumViablePrice, 'Recommended price must not be below minimum viable floor');
    assert.ok(rec.premiumPrice >= rec.recommendedPrice, 'Premium price must exceed recommended price');
    assert.ok(rec.marketComparison.sampleSize > 0, 'Market benchmark should find authentic sample listings');
    assert.ok(rec.marketComparison.comparablePriceMedian > 0, 'Median price must be positive');
    assert.ok(rec.explanation.includes('Jaipur Blue Pottery') || rec.explanation.includes('craft'), 'Explanation must ground in craft data');
    assert.strictEqual(rec.lossWarningFlag, false, 'Profitable craft must not trigger loss warning');
  });

  await test('POST /api/pricing/recommend triggers loss protection alert when costs exceed market', async () => {
    const res = await fetch(`${API_BASE}/api/pricing/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materialCost: 8000,
        labourHours: 50,
        hourlyRate: 150,
        packagingCost: 500,
        otherProductionCosts: 300,
        desiredProfitMargin: 25,
        category: 'pottery',
        craftType: 'Jaipur Blue Pottery',
        craftGrade: 'standard',
        region: 'Rajasthan',
        isGiCertified: false
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const rec = body.data;

    // Base cost is 8000 + 7500 + 500 + 300 = 16300, well above benchmark median (~2450)
    assert.strictEqual(rec.lossWarningFlag, true, 'Loss warning must be flagged when costs exceed market');
    assert.ok(rec.lossWarningMessage.includes('below your minimum viable costs') || rec.lossWarningMessage.includes('loss'));
    assert.ok(rec.recommendedPrice >= rec.minimumViablePrice, 'Recommended price must protect artisan with minimum viable floor');
  });

  await test('GET /api/pricing/benchmarks lists authentic Indian craft benchmarks', async () => {
    const res = await fetch(`${API_BASE}/api/pricing/benchmarks?category=pottery`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data), 'Benchmarks must be an array');
    assert.ok(body.data.length >= 1, 'Should return at least 1 pottery benchmark');
    assert.ok(body.data.some((b: any) => b.craftType.includes('Pottery') || b.craftType.includes('Terracotta')));
  });

  await test('POST /api/pricing/save-selection persists selected pricing tier', async () => {
    assert.ok(savedPriceRecId, 'Price recommendation ID must exist');
    const res = await fetch(`${API_BASE}/api/pricing/save-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recommendationId: savedPriceRecId,
        chosenTier: 'recommended',
        finalSellingPrice: 2250,
        artisanNotes: 'Selected market recommended tier with GI authenticity'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.chosenTier, 'recommended');
  });

  // -------------------------------------------------------------
  // SUITE 9: Integrated Video-to-Image Optimizer Engine
  // -------------------------------------------------------------
  console.log('\n🎞️ SUITE 9: Integrated Video-to-Image Optimizer Engine');

  let optJobId = '';

  await test('POST /api/optimizer/candidates extracts diverse genuine frames via classical CV', async () => {
    const sampleVideoPath = path.resolve(__dirname, '../uploads/videos/test_sample.mp4');
    assert.ok(fs.existsSync(sampleVideoPath), 'Sample video file must exist');

    const fileBuffer = fs.readFileSync(sampleVideoPath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('video', blob, 'test_craft.mp4');
    formData.append('pool_size', '20');
    formData.append('sample_fps', '10.0');
    formData.append('final_k', '5');

    const res = await fetch(`${API_BASE}/api/optimizer/candidates`, {
      method: 'POST',
      body: formData
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.job_id, 'Must return job_id');
    optJobId = body.job_id;

    assert.ok(body.frames_analysed > 0, 'Must analyse video frames');
    assert.ok(body.candidate_count >= 5, 'Must generate candidate pool');
    assert.ok(Array.isArray(body.selected_images), 'Must select optimal images');
    assert.strictEqual(body.selected_images.length, 5, 'Must select exactly 5 diverse frames');

    // Verify classical CV feature integrity
    const firstImg = body.selected_images[0];
    assert.ok(typeof firstImg.sharpness === 'number', 'Sharpness must be numeric (Laplacian variance)');
    assert.ok(typeof firstImg.exposure === 'number', 'Exposure must be numeric (mean luminance)');
    assert.ok(typeof firstImg.contrast === 'number', 'Contrast must be numeric (std dev)');
    assert.ok(firstImg.image_url.includes(optJobId), 'Image URL must reference job artifact');
  });

  await test('GET /api/optimizer/jobs/:jobId returns job status & progress', async () => {
    assert.ok(optJobId, 'Job ID must exist');
    const res = await fetch(`${API_BASE}/api/optimizer/jobs/${optJobId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job_id, optJobId);
    assert.ok(body.status === 'completed' || body.stage === 'COMPLETED');
  });

  await test('GET /api/optimizer/jobs/:jobId/candidates returns candidates & selected images', async () => {
    assert.ok(optJobId, 'Job ID must exist');
    const res = await fetch(`${API_BASE}/api/optimizer/jobs/${optJobId}/candidates`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.selected_images.length > 0);
  });

  await test('POST /api/optimizer/jobs/:jobId/approve approves genuine frames for product gallery', async () => {
    assert.ok(optJobId, 'Job ID must exist');
    const res = await fetch(`${API_BASE}/api/optimizer/jobs/${optJobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved_frame_indices: [0, 1, 2, 3, 4],
        hero_frame_index: 0
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.approved_count >= 1);
  });

  // -------------------------------------------------------------
  // SUITE 10: Direct Product Creation & Buyer Catalog Verification
  // -------------------------------------------------------------
  console.log('\n🏺 SUITE 10: Direct Product Creation & Buyer Catalog Verification');

  let directCreatedId = '';

  await test('POST /api/products persists product with real price recommendation & frames', async () => {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Master-Carved Jaipur Blue Pottery Floral Vase',
        description: 'Authentic Jaipur Blue Pottery vase crafted from quartz powder, Fuller earth and fired at 850°C with traditional cobalt oxide motifs.',
        hindi_description: 'जयपुर की प्रसिद्ध पारंपरिक नीली मिट्टी कला से निर्मित हस्तनिर्मित फूलदान।',
        category: 'pottery',
        materials: 'Quartz Powder, Glass, Fuller Earth, Cobalt Oxide Glaze',
        technique: 'Ancestral Jaipur Blue Pottery Wheel Turning & Glazing',
        time_taken_days: 7,
        stock_count: 2,
        village: 'Kot Jewar',
        state: 'Rajasthan',
        is_gi_tagged: true,
        custom_orders_accepted: true,
        maker_price: 2150,
        buyer_price: 2258,
        cover_image_url: `/artifacts/${optJobId}/original_frame_0000.jpg`,
        image_urls: [
          `/artifacts/${optJobId}/original_frame_0000.jpg`,
          `/artifacts/${optJobId}/original_frame_0001.jpg`
        ],
        tags: ['jaipur-blue-pottery', 'gi-certified', 'handmade-vase', 'rajasthan'],
        priceRecommendationId: savedPriceRecId,
        status: 'published'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id);
    directCreatedId = body.data.id;
  });

  await test('GET /api/v1/buyer/products returns newly created product in live catalog', async () => {
    const res = await fetch(`${API_BASE}/api/v1/buyer/products`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const items = body.data.results || body.data.items || [];
    assert.ok(items.length > 0, 'Catalog must return items');
    const createdItem = items.find((p: any) => p.id === directCreatedId);
    assert.ok(createdItem, 'Newly created product must be returned in buyer catalog');
    assert.strictEqual(createdItem.title, 'Master-Carved Jaipur Blue Pottery Floral Vase');
    assert.strictEqual(createdItem.price, 2258);
  });

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 TEST EXECUTION COMPLETE: ${stats.passed} Passed, ${stats.failed} Failed`);
  console.log('================================================================');

  if (stats.failed > 0) {
    console.error(`\n❌ ${stats.failed} test(s) failed. Review output above.`);
    process.exit(1);
  } else {
    console.log('\n✨ ALL BACKEND TESTS PASSED WITH 100% SUCCESS RATE! 🌸\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal Test Runner Failure:', err);
  process.exit(1);
});
