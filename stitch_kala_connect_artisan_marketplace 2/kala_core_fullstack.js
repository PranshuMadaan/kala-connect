// ═══════════════════════════════════════════════════════════════
// KALA CONNECT — FULL-STACK CORE APPLICATION CONTROLLER
// Real Supabase Auth, PostgreSQL RLS, Storage, & Gemini AI
// ═══════════════════════════════════════════════════════════════

const BACKEND_API_URL = window.KALA_BACKEND_URL || (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file:') ? window.location.origin : 'http://localhost:5000');

// ─── Application State ───────────────────────────────────────
const KALA = {
  activeScreen: 'home',
  user: null,          // Real authenticated user profile
  session: null,       // Supabase auth session
  supabase: null,      // Live Supabase Client instance
  isSupabaseConnected: false,
  isGeminiConfigured: false,
  products: [],        // Live products from database
  enquiries: [],       // Live enquiries
  orders: [],          // Live orders
  currentProduct: null,
  activeEnquiry: null,
  activeOrder: null,
  filterCategory: '',
  filterState: '',
  filterGIOnly: false,
  filterSort: 'newest',
  searchQuery: '',
  authRedirect: null,
  wizardStep: 1,
  aiTone: 'heritage',
  storyLang: 'en',
  activeDocFacts: null,
  uploadedMedia: [],
  wizardDraft: {
    title: '',
    category: 'pottery',
    technique: '',
    materials: '',
    width: 15,
    height: 25,
    timeTaken: 3,
    stock: 1,
    village: '',
    state: 'Rajasthan',
    customizable: true,
    isGi: false,
    costMaterial: 400,
    costLabour: 600,
    costPackaging: 80,
    costOverhead: 50,
    profitMargin: 20,
    price: 1356,
    buyerPrice: 1424,
    platformFee: 68,
    coverImage: '',
    tags: []
  }
};

// ─── 1. Configuration & Supabase Initialization ───────────────
async function initKalaSystem() {
  console.log('🔄 Initializing Kala Connect Full-Stack Application...');

  // 1. Fetch backend configuration status
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/config/status`);
    if (res.ok) {
      const config = await res.json();
      KALA.isGeminiConfigured = config.integrations?.gemini?.configured || false;
      if (config.integrations?.supabase?.configured && config.integrations?.supabase?.url) {
        window.localStorage.setItem('kala_supabase_url', config.integrations.supabase.url);
      }
    }
  } catch (err) {
    console.warn('Backend server not reachable on port 3005. Check that `node dist/index.js` is running.');
  }

  // 2. Initialize Supabase Client if credentials are provided
  const storedUrl = window.localStorage.getItem('kala_supabase_url') || window.ENV?.SUPABASE_URL;
  const storedAnonKey = window.localStorage.getItem('kala_supabase_anon_key') || window.ENV?.SUPABASE_ANON_KEY;

  if (storedUrl && storedAnonKey && typeof supabase !== 'undefined') {
    try {
      KALA.supabase = supabase.createClient(storedUrl, storedAnonKey);
      KALA.isSupabaseConnected = true;
      console.log('✅ Supabase Client connected to:', storedUrl);

      // Listen for auth state changes
      KALA.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, session?.user?.id);
        KALA.session = session;
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          KALA.user = null;
          updateHeaderUI();
        }
      });

      // Check current session
      const { data: { session } } = await KALA.supabase.auth.getSession();
      if (session?.user) {
        KALA.session = session;
        await loadUserProfile(session.user.id);
      }
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      KALA.isSupabaseConnected = false;
    }
  }

  // 3. Update configuration status banner
  renderConfigBanner();

  // 4. Fetch live products from database
  await fetchMarketplaceProducts();

  // 5. Initial screen render
  const initialHash = window.location.hash.replace('#', '') || 'home';
  navigate(initialHash, false);
}

// ─── 2. User Profile Loader ──────────────────────────────────
async function loadUserProfile(userId) {
  if (!KALA.supabase) return;
  try {
    const { data: profile, error } = await KALA.supabase
      .from('profiles')
      .select('*, artisan_profiles(*)')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // User authenticated but has no profile yet -> Prompt Role Registration
      console.log('New user detected. Showing role registration form...');
      setAuthMode('register');
      navigate('auth');
      return;
    }

    if (profile) {
      KALA.user = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        phone: profile.phone_number,
        role: profile.role,
        village: profile.city || profile.artisan_profiles?.[0]?.village || '',
        state: profile.state || profile.artisan_profiles?.[0]?.state || '',
        craft: profile.artisan_profiles?.[0]?.craft_tradition || '',
        bio: profile.artisan_profiles?.[0]?.bio || '',
        avatar: profile.avatar_url || (profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U')
      };
      console.log('User profile loaded:', KALA.user.name, `(${KALA.user.role})`);
      updateHeaderUI();

      if (KALA.user.role === 'artisan') {
        await loadArtisanDashboardData();
      }
    }
  } catch (err) {
    console.error('Error loading user profile:', err);
  }
}

// ─── 3. Real Supabase Authentication ─────────────────────────

// Option A: Phone OTP Request
async function requestPhoneOtp() {
  const countryCode = document.getElementById('auth-country-code')?.value || '+91';
  const phoneRaw = document.getElementById('auth-phone-input')?.value.trim();

  if (!phoneRaw || phoneRaw.length < 8) {
    showNotification('Please enter a valid mobile phone number.', 'error');
    return;
  }

  const fullPhone = `${countryCode}${phoneRaw.replace(/\D/g, '')}`;

  if (!KALA.isSupabaseConnected || !KALA.supabase) {
    showConfigNotice('Supabase Authentication is not connected. Real SMS OTP requires a configured Supabase project in .env.');
    return;
  }

  const sendBtn = document.getElementById('auth-send-otp-btn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span class="inline-block animate-spin mr-2">●</span> Sending OTP via Supabase...`;
  }

  try {
    const { data, error } = await KALA.supabase.auth.signInWithOtp({
      phone: fullPhone
    });

    if (error) {
      showNotification(`SMS Gateway Error: ${error.message}`, 'error');
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send OTP / कोड प्राप्त करें</span> <span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
      }
      return;
    }

    // OTP successfully dispatched by Supabase
    document.getElementById('auth-step-phone')?.classList.add('hidden');
    document.getElementById('auth-step-otp')?.classList.remove('hidden');
    const sentToEl = document.getElementById('auth-otp-sent-to');
    if (sentToEl) sentToEl.innerText = fullPhone;

    window._authPhone = fullPhone;
    showNotification(`6-digit verification code sent to ${fullPhone}`, 'success');
  } catch (err) {
    showNotification(`Authentication error: ${err.message}`, 'error');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `<span>Send OTP / कोड प्राप्त करें</span>`;
    }
  }
}

// Option A: Phone OTP Verification
async function submitOtpVerification() {
  const digits = [1, 2, 3, 4, 5, 6].map(i => document.getElementById(`otp-${i}`)?.value || '').join('');
  if (digits.length !== 6) {
    showNotification('Please enter the full 6-digit verification code.', 'error');
    return;
  }

  const phone = window._authPhone;
  if (!phone || !KALA.supabase) {
    showNotification('Session expired. Please request OTP again.', 'error');
    changeAuthPhone();
    return;
  }

  try {
    const { data, error } = await KALA.supabase.auth.verifyOtp({
      phone,
      token: digits,
      type: 'sms'
    });

    if (error) {
      showNotification(`Verification Failed: ${error.message}`, 'error');
      return;
    }

    showNotification('Phone number verified successfully!', 'success');
    // On auth state change, loadUserProfile will be triggered
  } catch (err) {
    showNotification(`Verification exception: ${err.message}`, 'error');
  }
}

// Option B: Google OAuth Login
async function continueWithGoogle() {
  if (!KALA.isSupabaseConnected || !KALA.supabase) {
    showConfigNotice('Google OAuth requires Supabase connection. Please enter your SUPABASE_URL and SUPABASE_ANON_KEY in the Backend Setup dialog.');
    return;
  }

  try {
    const { error } = await KALA.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) {
      showNotification(`Google Auth Error: ${error.message}`, 'error');
    }
  } catch (err) {
    showNotification(`Google OAuth Exception: ${err.message}`, 'error');
  }
}

// Log Out
async function handleLogout() {
  if (KALA.supabase) {
    await KALA.supabase.auth.signOut();
  }
  KALA.user = null;
  KALA.session = null;
  updateHeaderUI();
  showNotification('Logged out successfully.', 'info');
  navigate('home');
}

// First-Time Registration Submission
async function completeRoleRegistration(role) {
  if (!KALA.supabase || !KALA.session?.user) {
    showNotification('Please authenticate your phone or Google account first.', 'error');
    return;
  }

  const userId = KALA.session.user.id;
  const userPhone = KALA.session.user.phone || '';
  const userEmail = KALA.session.user.email || '';

  if (role === 'artisan') {
    const fullName = document.getElementById('reg-artisan-name')?.value.trim();
    const village = document.getElementById('reg-artisan-village')?.value.trim();
    const state = document.getElementById('reg-artisan-state')?.value || 'Rajasthan';
    const craft = document.getElementById('reg-artisan-craft')?.value.trim();
    const bio = document.getElementById('reg-artisan-bio')?.value.trim();
    const lang = document.getElementById('reg-artisan-lang')?.value || 'en';

    if (!fullName || !village || !craft) {
      showNotification('Full name, village, and craft category are required.', 'error');
      return;
    }

    // Insert public profile
    const { error: pErr } = await KALA.supabase.from('profiles').upsert({
      id: userId,
      role: 'artisan',
      full_name: fullName,
      phone_number: userPhone,
      email: userEmail,
      city: village,
      state,
      preferred_language: lang
    });

    if (pErr) {
      showNotification(`Failed to save profile: ${pErr.message}`, 'error');
      return;
    }

    // Insert artisan profile
    const { error: aErr } = await KALA.supabase.from('artisan_profiles').upsert({
      user_id: userId,
      display_name: fullName,
      village,
      state,
      craft_categories: [craft],
      craft_tradition: craft,
      bio
    });

    if (aErr) {
      showNotification(`Failed to save artisan profile: ${aErr.message}`, 'error');
      return;
    }

    await loadUserProfile(userId);
    showNotification('Artisan Studio account created! Welcome to Kala Connect.', 'success');
    navigate('dashboard');
  } else {
    // Buyer Registration
    const fullName = document.getElementById('reg-buyer-name')?.value.trim();
    const city = document.getElementById('reg-buyer-city')?.value.trim();
    const lang = document.getElementById('reg-buyer-lang')?.value || 'en';

    if (!fullName || !city) {
      showNotification('Full name and city are required.', 'error');
      return;
    }

    const { error: pErr } = await KALA.supabase.from('profiles').upsert({
      id: userId,
      role: 'buyer',
      full_name: fullName,
      phone_number: userPhone,
      email: userEmail,
      city,
      preferred_language: lang
    });

    if (pErr) {
      showNotification(`Failed to save profile: ${pErr.message}`, 'error');
      return;
    }

    await loadUserProfile(userId);
    showNotification('Buyer account created! Welcome to Kala Connect.', 'success');
    navigate('marketplace');
  }
}

// ─── 4. Database Operations: Marketplace & Products ──────────

async function fetchMarketplaceProducts() {
  if (KALA.supabase && KALA.isSupabaseConnected) {
    try {
      let query = KALA.supabase
        .from('products')
        .select(`
          id, title, description, short_description, hindi_description,
          category, technique, materials, dimensions, time_taken_days,
          village, state, is_gi_tagged, custom_orders_accepted,
          maker_price, suggested_price, buyer_price, price_breakdown,
          tags, care_guide, cover_image_url, status, created_at,
          profiles:artisan_id (id, full_name, city, state, avatar_url)
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (KALA.filterCategory) {
        query = query.eq('category', KALA.filterCategory);
      }
      if (KALA.filterState) {
        query = query.eq('state', KALA.filterState);
      }
      if (KALA.filterGIOnly) {
        query = query.eq('is_gi_tagged', true);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error querying Supabase products:', error);
      } else {
        KALA.products = (data || []).map(p => ({
          id: p.id,
          artisan_id: p.profiles?.id || '',
          artisan_name: p.profiles?.full_name || 'Master Artisan',
          artisan_village: p.village || p.profiles?.city || '',
          artisan_state: p.state || p.profiles?.state || '',
          title: p.title,
          description: p.description,
          short_description: p.short_description,
          hindi_description: p.hindi_description,
          category: p.category,
          technique: p.technique,
          materials: p.materials,
          final_price: Number(p.buyer_price) || 0,
          maker_price: Number(p.maker_price) || 0,
          platform_fee: Number(p.price_breakdown?.platform_fee_5pct) || 0,
          cover_image: p.cover_image_url,
          tags: Array.isArray(p.tags) ? p.tags : [],
          is_gi_tagged: Boolean(p.is_gi_tagged),
          customizable: Boolean(p.custom_orders_accepted),
          time_taken_days: p.time_taken_days || 1,
          care_instructions: p.care_guide || '',
          status: p.status,
          created_at: new Date(p.created_at).getTime()
        }));
      }
    } catch (err) {
      console.warn('Database query exception:', err);
    }
  } else {
    // If Supabase not connected, load from rebuilt Node.js backend
    try {
      const prodRes = await fetch(`${BACKEND_API_URL}/api/v1/buyer/products`);
      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        const list = prodJson.data?.results || prodJson.data?.items || prodJson.products || [];
        if (list && list.length > 0) {
          KALA.products = list.map(p => ({
            id: p.id,
            artisan_id: p.artisanId || p.artisan_id || 'artisan_govind',
            artisan_name: p.artisanName || p.artisan_name || 'Master Govind Ram',
            artisan_village: p.region || p.village || 'Jaipur',
            artisan_state: p.state || 'Rajasthan',
            title: p.title,
            description: p.description || p.short_description || '',
            short_description: p.short_description || '',
            hindi_description: p.hindi_description || '',
            category: p.category,
            technique: p.craftType || p.technique || '',
            materials: p.materials || '',
            final_price: Number(p.price || p.buyerPrice || p.final_price) || 0,
            maker_price: Number(p.makerPrice || p.maker_price) || 0,
            platform_fee: Math.round((Number(p.price || p.buyerPrice || p.final_price) || 0) * 0.05),
            cover_image: p.imageUrl || p.cover_image || p.cover_image_url || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80',
            tags: Array.isArray(p.tags) ? p.tags : [],
            is_gi_tagged: Boolean(p.giRegistryNumber || p.is_gi_tagged),
            customizable: true,
            time_taken_days: p.time_taken_days || 5,
            care_instructions: p.care_instructions || '',
            status: 'published',
            created_at: Date.now()
          }));
        } else {
          KALA.products = JSON.parse(window.localStorage.getItem('kala_products_db') || '[]');
        }
      } else {
        KALA.products = JSON.parse(window.localStorage.getItem('kala_products_db') || '[]');
      }
    } catch (e) {
      KALA.products = JSON.parse(window.localStorage.getItem('kala_products_db') || '[]');
    }
  }

  renderMarketplaceGrid();
}

function renderMarketplaceGrid() {
  const grid = document.getElementById('marketplace-products-grid');
  const emptyState = document.getElementById('marketplace-empty-state');
  const countEl = document.getElementById('market-results-count');
  if (!grid) return;

  // Filter by search query
  let items = [...KALA.products];
  if (KALA.searchQuery) {
    const q = KALA.searchQuery.toLowerCase();
    items = items.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.materials && p.materials.toLowerCase().includes(q)) ||
      (p.artisan_village && p.artisan_village.toLowerCase().includes(q))
    );
  }

  if (countEl) {
    countEl.innerText = `Showing ${items.length} verified handcrafted items`;
  }

  if (items.length === 0) {
    grid.innerHTML = '';
    if (emptyState) {
      emptyState.classList.remove('hidden');
      if (KALA.products.length === 0) {
        emptyState.innerHTML = `
          <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-primary mb-3">
            <span class="material-symbols-outlined text-[36px]">storefront</span>
          </div>
          <h3 class="font-headline-sm text-lg font-bold text-on-surface mb-1">No Crafts Published Yet</h3>
          <p class="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto mb-4">
            This is a genuine live marketplace. Authentic creations will appear here as soon as registered artisans list their work.
          </p>
          <button onclick="requireArtisan('add-product')" class="btn-primary !min-h-[40px] !py-2 !px-4 text-xs mx-auto flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">add_circle</span>
            <span>+ List Your Craft / पहला शिल्प जोड़ें</span>
          </button>
        `;
      } else {
        emptyState.innerHTML = `
          <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto text-outline mb-3">
            <span class="material-symbols-outlined text-[36px]">search_off</span>
          </div>
          <h3 class="font-headline-sm text-lg font-bold text-on-surface mb-1">No Crafts Matching Filters</h3>
          <p class="font-body-sm text-xs text-on-surface-variant max-w-sm mx-auto mb-4">Try clearing your filters or searching for another craft cluster.</p>
          <button onclick="resetMarketplaceFilters()" class="btn-primary !min-h-[40px] !py-2 !px-4 text-xs mx-auto">
            Reset All Filters
          </button>
        `;
      }
    }
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = items.map(p => `
    <div onclick="openProductDetail('${p.id}')" class="card overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-200 flex flex-col">
      <div class="relative aspect-square overflow-hidden bg-surface-container">
        <img src="${p.cover_image || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600'}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"/>
        ${p.is_gi_tagged ? `
          <span class="absolute top-2.5 left-2.5 chip bg-secondary-fixed text-on-secondary-fixed font-bold text-[10px] shadow-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">verified</span> GI Certified
          </span>
        ` : ''}
        ${p.customizable ? `
          <span class="absolute top-2.5 right-2.5 chip bg-surface-container-lowest/90 backdrop-blur-xs text-primary font-bold text-[10px] shadow-sm">
            Customizable
          </span>
        ` : ''}
      </div>
      <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-secondary">${p.category}</span>
          <h3 class="font-headline-sm text-sm font-semibold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">${p.title}</h3>
          <p class="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
            <span class="material-symbols-outlined text-[13px] text-tertiary">location_on</span>
            <span>${p.artisan_village ? `${p.artisan_village}, ` : ''}${p.artisan_state || 'India'}</span>
          </p>
        </div>
        <div class="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-on-surface-variant block">Fair Price</span>
            <span class="font-headline-sm text-base font-bold text-primary">₹${p.final_price?.toLocaleString('en-IN') || 0}</span>
          </div>
          <button class="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors" title="View Details">
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ─── 5. Document Upload & AI Extraction (Step 1) ──────────────

async function handleDocumentUpload(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;

  const loadingEl = document.getElementById('doc-analysis-loading');
  const resultCard = document.getElementById('doc-analysis-result');
  const loadingMsg = document.getElementById('doc-loading-msg');

  if (loadingEl) {
    loadingEl.classList.remove('hidden');
    if (loadingMsg) loadingMsg.innerText = `Uploading "${file.name}" and extracting craft records...`;
  }
  if (resultCard) resultCard.classList.add('hidden');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${BACKEND_API_URL}/api/upload/document?autoAnalyze=true`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (loadingEl) loadingEl.classList.add('hidden');

    if (!res.ok) {
      showNotification(`Upload Error: ${data.error || 'Failed to upload document'}`, 'error');
      return;
    }

    showNotification(`Document "${file.name}" extracted successfully!`, 'success');

    // Display AI analysis if returned
    if (data.aiAnalysis && !data.aiAnalysis.error) {
      const a = data.aiAnalysis;
      KALA.activeDocFacts = JSON.stringify(a);

      if (resultCard) {
        resultCard.classList.remove('hidden');
        resultCard.innerHTML = `
          <div class="card p-4 bg-tertiary-fixed/20 border border-tertiary/30 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <span class="chip bg-tertiary text-white font-bold text-xs flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">fact_check</span>
                Verified Document: ${a.document_type || 'Craft Record'}
              </span>
              <span class="text-[11px] font-semibold text-tertiary font-mono">Confidence: ${a.confidence_score || 'High'}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div class="bg-white p-2.5 rounded-lg border border-outline-variant/30">
                <span class="font-bold text-on-surface block text-[11px] text-secondary">Materials Mentioned:</span>
                <span class="text-on-surface">${(a.materials_mentioned || []).join(', ') || 'See document'}</span>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-outline-variant/30">
                <span class="font-bold text-on-surface block text-[11px] text-secondary">Craft Techniques:</span>
                <span class="text-on-surface">${(a.craft_techniques || []).join(', ') || 'Ancestral manual work'}</span>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-outline-variant/30">
                <span class="font-bold text-on-surface block text-[11px] text-secondary">Origin Verified:</span>
                <span class="text-on-surface">${a.origin_village ? `${a.origin_village}, ` : ''}${a.origin_state || 'India'}</span>
              </div>
              <div class="bg-white p-2.5 rounded-lg border border-outline-variant/30">
                <span class="font-bold text-on-surface block text-[11px] text-secondary">Identified Dates / Reg No:</span>
                <span class="text-on-surface font-mono">${(a.registration_numbers || []).join(', ') || (a.important_dates || []).join(', ') || 'N/A'}</span>
              </div>
            </div>
            ${a.potential_inconsistencies?.length ? `
              <div class="p-2 rounded bg-amber-50 text-amber-800 text-[11px] border border-amber-200">
                <strong>Observations:</strong> ${a.potential_inconsistencies.join('; ')}
              </div>
            ` : ''}
            <div class="flex items-center justify-between pt-1">
              <span class="text-[10px] text-on-surface-variant italic">Document text accurately extracted via pdf-parse & Gemini.</span>
              <button onclick="applyDocumentFactsToForm()" class="btn-primary !min-h-[34px] !py-1 !px-3 text-xs font-semibold flex items-center gap-1 shadow-sm">
                <span class="material-symbols-outlined text-[15px]">auto_fix_high</span>
                Apply Extracted Facts to Form
              </button>
            </div>
          </div>
        `;
      }
    } else if (data.extraction) {
      // Document text extracted but Gemini requires API key
      if (resultCard) {
        resultCard.classList.remove('hidden');
        resultCard.innerHTML = `
          <div class="card p-3.5 bg-surface-container rounded-xl text-xs space-y-2 border border-outline-variant/30">
            <div class="flex items-center justify-between">
              <span class="font-bold text-on-surface">Extracted Text Preview (${data.file.name})</span>
              <span class="chip bg-surface-container-high text-on-surface-variant text-[10px]">${data.extraction.pageCount ? `${data.extraction.pageCount} pages` : 'Plain Text'}</span>
            </div>
            <p class="font-mono text-[11px] bg-white p-2.5 rounded border border-outline-variant/30 max-h-24 overflow-y-auto text-on-surface-variant">
              ${data.extraction.textSnippet}
            </p>
            <p class="text-[11px] text-secondary font-semibold">
              ℹ️ To perform automated structured analysis, enter your Gemini API key in the Setup dialog.
            </p>
          </div>
        `;
      }
    }
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    showNotification(`Document processing error: ${err.message}`, 'error');
  }
}

function applyDocumentFactsToForm() {
  if (!KALA.activeDocFacts) return;
  try {
    const a = JSON.parse(KALA.activeDocFacts);
    if (a.product_name) {
      const titleEl = document.getElementById('step1-title');
      if (titleEl) titleEl.value = a.product_name;
    }
    if (a.materials_mentioned?.length) {
      const matEl = document.getElementById('step1-materials');
      if (matEl) matEl.value = a.materials_mentioned.join(', ');
    }
    if (a.craft_techniques?.length) {
      const techEl = document.getElementById('step1-technique');
      if (techEl) techEl.value = a.craft_techniques.join(', ');
    }
    if (a.origin_village) {
      const vEl = document.getElementById('step1-village');
      if (vEl) vEl.value = a.origin_village;
    }
    if (a.origin_state) {
      const sEl = document.getElementById('step1-state');
      if (sEl) sEl.value = a.origin_state;
    }
    if (a.registration_numbers?.some(r => r.toUpperCase().includes('GI'))) {
      const giCheckbox = document.getElementById('step1-gi');
      if (giCheckbox) giCheckbox.checked = true;
    }
    showNotification('Applied verified document facts directly to form fields!', 'success');
    onStep1FieldChange();
  } catch (e) {
    console.error('Error applying facts:', e);
  }
}

// ─── 6. Real Media Upload (Step 2) ────────────────────────────

async function handleMediaSelected(input) {
  const files = input?.files;
  if (!files || files.length === 0) return;

  const previewStrip = document.getElementById('media-preview-strip');
  showNotification(`Uploading ${files.length} craft file(s)...`, 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append('file', file);

    const isVideo = file.type.startsWith('video/');
    const endpoint = isVideo ? `${BACKEND_API_URL}/api/upload/video` : `${BACKEND_API_URL}/api/upload/image`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        KALA.uploadedMedia.push(data.url);
        if (!KALA.wizardDraft.coverImage) {
          KALA.wizardDraft.coverImage = data.url;
        }
      }
    } catch (err) {
      console.warn('File upload failed:', err);
    }
  }

  renderStep4Gallery();
  showNotification(`Uploaded ${KALA.uploadedMedia.length} media file(s) to storage.`, 'success');
}

function renderStep4Gallery() {
  const container = document.getElementById('extracted-photos-grid');
  if (!container) return;

  if (KALA.uploadedMedia.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8 text-on-surface-variant text-xs">
        No photos uploaded yet. Return to Step 2 to upload craft images.
      </div>
    `;
    return;
  }

  container.innerHTML = KALA.uploadedMedia.map((url, idx) => `
    <div class="relative group rounded-xl overflow-hidden border-2 ${url === KALA.wizardDraft.coverImage ? 'border-primary shadow-md' : 'border-outline-variant/40'} aspect-square bg-surface-container">
      <img src="${url}" class="w-full h-full object-cover"/>
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button onclick="setCoverImage('${url}')" class="px-2 py-1 bg-white text-on-surface rounded text-[10px] font-bold shadow-xs">
          ${url === KALA.wizardDraft.coverImage ? 'Cover ✓' : 'Set Cover'}
        </button>
        <button onclick="deleteUploadedMedia(${idx})" class="p-1 bg-error text-white rounded text-[10px] shadow-xs" title="Delete photo">
          <span class="material-symbols-outlined text-[14px]">delete</span>
        </button>
      </div>
      ${url === KALA.wizardDraft.coverImage ? `
        <span class="absolute top-1.5 left-1.5 chip bg-primary text-white text-[9px] font-bold">Cover</span>
      ` : ''}
    </div>
  `).join('');
}

function setCoverImage(url) {
  KALA.wizardDraft.coverImage = url;
  renderStep4Gallery();
  showNotification('Cover photo updated.', 'info');
}

function deleteUploadedMedia(index) {
  KALA.uploadedMedia.splice(index, 1);
  if (KALA.wizardDraft.coverImage && !KALA.uploadedMedia.includes(KALA.wizardDraft.coverImage)) {
    KALA.wizardDraft.coverImage = KALA.uploadedMedia[0] || '';
  }
  renderStep4Gallery();
}

// ─── 7. Real AI Product Description (Step 5) ──────────────────

async function triggerGeminiNarrativeGeneration() {
  const title = document.getElementById('step1-title')?.value || KALA.wizardDraft.title;
  const category = document.getElementById('step1-category')?.value || KALA.wizardDraft.category;
  const materials = document.getElementById('step1-materials')?.value || KALA.wizardDraft.materials;
  const technique = document.getElementById('step1-technique')?.value || KALA.wizardDraft.technique;
  const village = document.getElementById('step1-village')?.value || KALA.wizardDraft.village;
  const state = document.getElementById('step1-state')?.value || KALA.wizardDraft.state;
  const timeTaken = document.getElementById('step1-time')?.value || KALA.wizardDraft.timeTaken;
  const isGi = document.getElementById('step1-gi')?.checked || KALA.wizardDraft.isGi;

  const statusEl = document.getElementById('ai-generation-status');
  if (statusEl) {
    statusEl.innerHTML = `<span class="inline-block animate-spin mr-1">●</span> Synthesizing story with Gemini AI using your verified facts...`;
    statusEl.classList.remove('hidden');
  }

  try {
    const res = await fetch(`${BACKEND_API_URL}/api/ai/generate-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        materials,
        technique,
        village,
        state,
        time_taken_days: timeTaken,
        is_gi_tagged: isGi,
        tone: KALA.aiTone,
        documentFacts: KALA.activeDocFacts
      })
    });

    const data = await res.json();
    if (statusEl) statusEl.classList.add('hidden');

    if (data.data) {
      const out = data.data;
      const titleInput = document.getElementById('review-title-input');
      const descArea = document.getElementById('review-desc-area');
      const shortDescArea = document.getElementById('review-short-desc');
      const hindiDescArea = document.getElementById('review-hindi-desc');
      const careArea = document.getElementById('review-care-area');

      if (titleInput && out.title) titleInput.value = out.title;
      if (descArea && out.description) descArea.value = out.description;
      if (shortDescArea && out.short_description) shortDescArea.value = out.short_description;
      if (hindiDescArea && out.hindi_description) hindiDescArea.value = out.hindi_description;
      if (careArea && out.care_guide) careArea.value = out.care_guide;

      showNotification('AI synthesized authentic product story from your inputs!', 'success');
    } else if (data.requiresApiKey) {
      showNotification('Notice: Real AI synthesis requires GEMINI_API_KEY in .env. Falling back to deterministic local narrative.', 'info');
      synthesizeLocalNarrative();
    }
  } catch (err) {
    if (statusEl) statusEl.classList.add('hidden');
    console.warn('AI Generation exception, falling back locally:', err);
    synthesizeLocalNarrative();
  }
}

// ─── 8. Publishing Product (Step 5 to Database) ───────────────

async function publishProduct() {
  if (!KALA.user || KALA.user.role !== 'artisan') {
    showNotification('Only registered artisans can publish products. Please sign in as an artisan.', 'error');
    KALA.authRedirect = 'add-product';
    navigate('auth');
    return;
  }

  const title = document.getElementById('review-title-input')?.value.trim() || KALA.wizardDraft.title;
  const description = document.getElementById('review-desc-area')?.value.trim() || '';
  const shortDescription = document.getElementById('review-short-desc')?.value.trim() || '';
  const hindiDescription = document.getElementById('review-hindi-desc')?.value.trim() || '';
  const careGuide = document.getElementById('review-care-area')?.value.trim() || '';
  const category = document.getElementById('step1-category')?.value || KALA.wizardDraft.category;
  const technique = document.getElementById('step1-technique')?.value || KALA.wizardDraft.technique;
  const materials = document.getElementById('step1-materials')?.value || KALA.wizardDraft.materials;
  const village = document.getElementById('step1-village')?.value || KALA.user.village || 'Heritage Studio';
  const state = document.getElementById('step1-state')?.value || KALA.user.state || 'Rajasthan';
  const isGi = document.getElementById('step1-gi')?.checked || false;
  const customizable = document.getElementById('step1-custom')?.checked || false;
  const timeTaken = Number(document.getElementById('step1-time')?.value) || 3;
  const makerPrice = Number(document.getElementById('step1-price')?.value) || KALA.wizardDraft.price;
  const buyerPrice = Number(document.getElementById('calc-out-buyer')?.innerText.replace(/[^\d]/g, '')) || Math.round(makerPrice * 1.05);
  const coverImage = KALA.wizardDraft.coverImage || KALA.uploadedMedia[0] || 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600';

  const newProductPayload = {
    artisan_id: KALA.user.id,
    title,
    description,
    short_description: shortDescription,
    hindi_description: hindiDescription,
    category,
    technique,
    materials,
    time_taken_days: timeTaken,
    village,
    state,
    is_gi_tagged: isGi,
    custom_orders_accepted: customizable,
    maker_price: makerPrice,
    buyer_price: buyerPrice,
    price_breakdown: {
      material_cost: KALA.wizardDraft.costMaterial,
      labour_cost: KALA.wizardDraft.costLabour,
      packaging_cost: KALA.wizardDraft.costPackaging,
      overhead_cost: KALA.wizardDraft.costOverhead,
      profit_margin_pct: KALA.wizardDraft.profitMargin,
      platform_fee_5pct: buyerPrice - makerPrice
    },
    tags: [category, village.toLowerCase(), isGi ? 'gi-certified' : 'handmade'],
    care_guide: careGuide,
    cover_image_url: coverImage,
    status: 'published'
  };

  if (KALA.supabase && KALA.isSupabaseConnected) {
    try {
      const { data: createdProd, error } = await KALA.supabase
        .from('products')
        .insert(newProductPayload)
        .select()
        .single();

      if (error) {
        showNotification(`Database Error: ${error.message}`, 'error');
        return;
      }

      // Insert gallery images
      if (KALA.uploadedMedia.length > 0) {
        const imageRows = KALA.uploadedMedia.map((url, idx) => ({
          product_id: createdProd.id,
          url,
          is_cover: url === coverImage,
          sort_order: idx
        }));
        await KALA.supabase.from('product_images').insert(imageRows);
      }

      showNotification('Craft piece published live to marketplace!', 'success');
    } catch (err) {
      showNotification(`Publishing exception: ${err.message}`, 'error');
      return;
    }
  } else {
    // LocalStorage fallback for demo verification
    const localProd = {
      ...newProductPayload,
      id: 'prod_' + Date.now(),
      cover_image: coverImage,
      final_price: buyerPrice,
      artisan_name: KALA.user.name,
      artisan_village: village,
      artisan_state: state,
      created_at: Date.now()
    };
    KALA.products.unshift(localProd);
    window.localStorage.setItem('kala_products_db', JSON.stringify(KALA.products));
    showNotification('Craft piece published to local marketplace!', 'success');
  }

  // Refresh data and navigate to success screen
  await fetchMarketplaceProducts();
  const successTitle = document.getElementById('success-product-title');
  if (successTitle) successTitle.innerText = title;
  navigate('success');
}

// ─── 9. Direct Enquiries & Price Negotiation ──────────────────

async function submitDirectEnquiry() {
  if (!KALA.user) {
    showNotification('Please sign in or register to send enquiries and custom offers.', 'error');
    KALA.authRedirect = KALA.currentProduct ? `product-${KALA.currentProduct.id}` : 'marketplace';
    navigate('auth');
    return;
  }

  const message = document.getElementById('enquiry-message-input')?.value.trim();
  const offerPrice = Number(document.getElementById('enquiry-offer-input')?.value) || 0;

  if (!message) {
    showNotification('Please enter a message or question for the artisan.', 'error');
    return;
  }

  if (!KALA.currentProduct) return;

  const payload = {
    product_id: KALA.currentProduct.id,
    buyer_id: KALA.user.id,
    artisan_id: KALA.currentProduct.artisan_id,
    initial_message: message,
    offered_price: offerPrice > 0 ? offerPrice : null,
    status: 'pending'
  };

  if (KALA.supabase && KALA.isSupabaseConnected) {
    try {
      const { data: enq, error } = await KALA.supabase
        .from('enquiries')
        .insert(payload)
        .select()
        .single();

      if (error) {
        showNotification(`Failed to send enquiry: ${error.message}`, 'error');
        return;
      }

      // Insert message
      await KALA.supabase.from('enquiry_messages').insert({
        enquiry_id: enq.id,
        sender_id: KALA.user.id,
        message,
        offer_price: offerPrice > 0 ? offerPrice : null
      });

      showNotification('Enquiry & offer sent directly to artisan!', 'success');
      closeEnquiryModal();
    } catch (err) {
      showNotification(`Enquiry error: ${err.message}`, 'error');
    }
  } else {
    // LocalStorage fallback
    const localEnquiry = {
      id: 'enq_' + Date.now(),
      product_id: KALA.currentProduct.id,
      product_title: KALA.currentProduct.title,
      buyer_id: KALA.user.id,
      buyer_name: KALA.user.name,
      artisan_id: KALA.currentProduct.artisan_id,
      message,
      offered_price: offerPrice,
      status: 'pending',
      created_at: Date.now()
    };
    KALA.enquiries.unshift(localEnquiry);
    window.localStorage.setItem('kala_enquiries_db', JSON.stringify(KALA.enquiries));
    showNotification('Enquiry & offer sent to artisan studio!', 'success');
    closeEnquiryModal();
  }
}

// ─── 10. Artisan Dashboard Queries ────────────────────────────

async function loadArtisanDashboardData() {
  if (!KALA.user || KALA.user.role !== 'artisan') return;

  let publishedCount = 0;
  let totalEnquiries = 0;
  let activeOrders = 0;
  let totalRevenue = 0;

  if (KALA.supabase && KALA.isSupabaseConnected) {
    try {
      // 1. Published crafts
      const { count: pCount } = await KALA.supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('artisan_id', KALA.user.id)
        .eq('status', 'published');
      publishedCount = pCount || 0;

      // 2. Enquiries
      const { data: enqs } = await KALA.supabase
        .from('enquiries')
        .select('*, products(title)')
        .eq('artisan_id', KALA.user.id);
      totalEnquiries = enqs?.length || 0;
      KALA.enquiries = enqs || [];

      // 3. Orders
      const { data: ords } = await KALA.supabase
        .from('orders')
        .select('*')
        .eq('artisan_id', KALA.user.id);
      KALA.orders = ords || [];
      activeOrders = (ords || []).filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;
      totalRevenue = (ords || []).filter(o => o.status === 'delivered').reduce((sum, o) => sum + (Number(o.artisan_payout) || 0), 0);
    } catch (err) {
      console.warn('Dashboard query error:', err);
    }
  } else {
    // Local calculations
    const myProds = KALA.products.filter(p => p.artisan_id === KALA.user.id);
    publishedCount = myProds.length;
    const myEnqs = KALA.enquiries.filter(e => e.artisan_id === KALA.user.id);
    totalEnquiries = myEnqs.length;
    const myOrds = KALA.orders.filter(o => o.artisan_id === KALA.user.id);
    activeOrders = myOrds.filter(o => o.status !== 'delivered').length;
    totalRevenue = myOrds.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.artisan_payout || 0), 0);
  }

  // Update counters
  const pCountEl = document.getElementById('dash-stat-published');
  const enqCountEl = document.getElementById('dash-stat-enquiries');
  const ordCountEl = document.getElementById('dash-stat-orders');
  const revCountEl = document.getElementById('dash-stat-revenue');

  if (pCountEl) pCountEl.innerText = publishedCount;
  if (enqCountEl) enqCountEl.innerText = totalEnquiries;
  if (ordCountEl) ordCountEl.innerText = activeOrders;
  if (revCountEl) revCountEl.innerText = `₹${totalRevenue.toLocaleString('en-IN')}`;

  renderArtisanDashboardTables();
}

function renderArtisanDashboardTables() {
  // Render listings table with empty state
  const listingsBody = document.getElementById('dash-listings-tbody');
  const myProds = KALA.products.filter(p => p.artisan_id === KALA.user?.id);

  if (listingsBody) {
    if (myProds.length === 0) {
      listingsBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-8 text-center text-xs text-on-surface-variant">
            <span class="material-symbols-outlined text-[28px] text-outline block mb-1">inventory_2</span>
            No crafts listed in your studio yet. Click <strong>"+ List New Craft"</strong> above to publish your first piece.
          </td>
        </tr>
      `;
    } else {
      listingsBody.innerHTML = myProds.map(p => `
        <tr class="border-b border-outline-variant/30 hover:bg-surface-container-low/40 text-xs">
          <td class="p-3 flex items-center gap-3">
            <img src="${p.cover_image}" class="w-10 h-10 rounded-lg object-cover"/>
            <div>
              <span class="font-bold text-on-surface block">${p.title}</span>
              <span class="text-[10px] text-on-surface-variant">${p.category}</span>
            </div>
          </td>
          <td class="p-3 font-semibold text-primary">₹${p.final_price?.toLocaleString('en-IN')}</td>
          <td class="p-3">
            <span class="chip bg-tertiary-fixed text-tertiary text-[10px] font-bold uppercase">Published</span>
          </td>
          <td class="p-3 text-on-surface-variant">${p.time_taken_days} days</td>
          <td class="p-3 text-right">
            <button onclick="openProductDetail('${p.id}')" class="text-primary hover:underline font-semibold">View</button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render direct enquiries list with empty state
  const enqContainer = document.getElementById('dash-enquiries-list');
  const myEnqs = KALA.enquiries.filter(e => e.artisan_id === KALA.user?.id);

  if (enqContainer) {
    if (myEnqs.length === 0) {
      enqContainer.innerHTML = `
        <div class="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl">
          <span class="material-symbols-outlined text-[24px] text-outline block mb-1">chat_bubble_outline</span>
          No customer enquiries yet. Questions and custom offers will appear here.
        </div>
      `;
    } else {
      enqContainer.innerHTML = myEnqs.map(e => `
        <div class="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-on-surface">${e.buyer_name || 'Interested Patron'}</span>
            <span class="chip bg-secondary-fixed text-secondary text-[10px] font-bold">Offer: ₹${e.offered_price || 'Standard'}</span>
          </div>
          <p class="text-on-surface-variant italic">"${e.initial_message || e.message}"</p>
          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] text-on-surface-variant">${e.products?.title || e.product_title || 'Craft Piece'}</span>
            <button onclick="acceptEnquiryOffer('${e.id}')" class="px-2.5 py-1 bg-primary text-white rounded text-[11px] font-semibold hover:bg-primary-container">
              Accept Offer
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

// ─── 11. Configuration UI Helper ──────────────────────────────

function renderConfigBanner() {
  const existingBanner = document.getElementById('kala-config-banner');
  if (existingBanner) existingBanner.remove();

  if (!KALA.isSupabaseConnected || !KALA.isGeminiConfigured) {
    const banner = document.createElement('div');
    banner.id = 'kala-config-banner';
    banner.className = 'w-full bg-secondary-container text-on-secondary-container px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-secondary/30 z-40';
    banner.innerHTML = `
      <div class="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] text-secondary">info</span>
          <span>
            ${!KALA.isSupabaseConnected && !KALA.isGeminiConfigured
              ? 'Backend Setup: Connect your Supabase project (PostgreSQL + Auth + Storage) & Gemini API for full live cloud features.'
              : !KALA.isSupabaseConnected
              ? 'Supabase project not connected. Live SMS auth & cloud PostgreSQL storage requires Supabase keys in .env.'
              : 'Gemini API not configured. Automated AI document analysis and storytelling requires GEMINI_API_KEY.'}
          </span>
        </div>
        <button onclick="openConfigModal()" class="px-2.5 py-1 bg-secondary text-on-secondary rounded-lg text-xs font-bold shadow-2xs hover:bg-on-secondary-container transition-colors shrink-0">
          ⚙️ Setup Credentials
        </button>
      </div>
    `;
    document.body.prepend(banner);
  }
}

function openConfigModal() {
  const modal = document.getElementById('config-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeConfigModal() {
  const modal = document.getElementById('config-modal');
  if (modal) modal.classList.add('hidden');
}

function saveConfigCredentials() {
  const url = document.getElementById('cfg-supabase-url')?.value.trim();
  const anonKey = document.getElementById('cfg-supabase-anon')?.value.trim();

  if (url && anonKey) {
    window.localStorage.setItem('kala_supabase_url', url);
    window.localStorage.setItem('kala_supabase_anon_key', anonKey);
    showNotification('Supabase credentials saved! Initializing live connection...', 'success');
    closeConfigModal();
    setTimeout(() => window.location.reload(), 1000);
  } else {
    showNotification('Please enter both Supabase URL and Anon Key.', 'error');
  }
}

function showConfigNotice(message) {
  const notif = document.getElementById('auth-error-notice');
  if (notif) {
    notif.innerText = message;
    notif.classList.remove('hidden');
  } else {
    showNotification(message, 'error');
  }
  openConfigModal();
}

// ─── 12. Global Notification Toast ────────────────────────────
function showNotification(msg, type = 'info') {
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-error text-white' : type === 'success' ? 'bg-tertiary text-white' : 'bg-primary text-white';
  toast.className = `fixed bottom-5 right-5 z-50 ${bg} px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info'}</span>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Ensure execution on window load
window.addEventListener('DOMContentLoaded', initKalaSystem);
