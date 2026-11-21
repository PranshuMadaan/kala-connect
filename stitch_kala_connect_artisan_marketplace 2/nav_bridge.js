/**
 * Kala Connect — Shared Client-Side Navigation & Data-Binding Bridge
 * Works across both the unified SPA (index.html) and individual Stitch screen files.
 */
(function() {
  // Get current active user (null if guest)
  function getUser() {
    try {
      const stored = localStorage.getItem('kala_user');
      return stored ? JSON.parse(stored) : null;
    } catch(e) {
      return null;
    }
  }

  function getCounts() {
    try {
      return JSON.parse(localStorage.getItem('kala_counts')) || {
        drafts: 0,
        processing: 0,
        needsApproval: 0,
        published: 0,
        newEnquiries: 0
      };
    } catch(e) {
      return { drafts: 0, processing: 0, needsApproval: 0, published: 0, newEnquiries: 0 };
    }
  }

  // Replace double-bracket tokens in text nodes and attribute values
  function replaceTokensInDOM() {
    const user = getUser() || {
      name: 'Guest User',
      displayName: 'Guest Artisan',
      role: 'guest',
      language: 'EN | हिन्दी',
      regionalCluster: 'Artisan Commons',
      craftLineage: 'Master Craftsperson',
      workshopStatus: 'Open Studio'
    };
    const counts = getCounts();

    const tokenMap = {
      'user.name': user.name,
      'user.role': user.role === 'artisan' ? 'Artisan' : user.role === 'buyer' ? 'Conscious Buyer' : 'Guest',
      'user.language': user.language || 'EN | हिन्दी',
      'user.photoUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&q=80',
      'artisan.displayName': user.displayName || user.name,
      'artisan.regionalCluster': user.regionalCluster || 'Jaipur Craft Cluster',
      'artisan.craftLineage': user.craftLineage || 'Master Craftsperson',
      'artisan.workshopStatus': user.workshopStatus || 'Accepting Commissions',
      'counts.drafts': counts.drafts,
      'counts.processing': counts.processing,
      'counts.needsApproval': counts.needsApproval,
      'counts.published': counts.published,
      'counts.newEnquiries': counts.newEnquiries,
      'product.title': 'Jaipur Blue Pottery Glazed Floral Urn',
      'product.price': '1,850',
      'product.draftId': 'DFT-2025-081',
      'product.category': 'Pottery & Clay',
      'product.region': 'Jaipur, Rajasthan',
      'product.giRegistryNumber': 'GI-IN-0024',
      'product.imageUrl': 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80',
      'wizard.currentStep': '1',
      'draft.status': 'Draft In Progress',
      'draft.fields.title': 'Jaipur Blue Pottery Glazed Floral Urn',
      'draft.fields.category': 'Pottery & Clay',
      'draft.fields.makerPrice': '1850',
      'video.status': 'idle',
      'video.durationLimit': '15–30 sec',
      'video.uploadProgress': '78%',
      'video.fileName': 'jaipur_urn_360.mp4',
      'video.fileSize': '24.6 MB',
      'job.id': 'JOB-9428-AI',
      'job.stage': '4',
      'job.stageName': 'Score Craft Lineage & Angles',
      'job.progress': '74',
      'job.estimatedMinutes': '1',
      'job.framesScored': '18',
      'job.totalFrames': '24',
      'job.error': 'None',
      'review.selectedCount': '5',
      'review.candidateCount': '12',
      'review.k': '5',
      'listing.id': 'KC-RAJ-9420',
      'listing.url': window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html#product-p4'),
      'listing.previewCard.title': 'Jaipur Blue Pottery Glazed Floral Urn',
      'listing.previewCard.price': '₹1,850',
      'listing.previewCard.region': 'Jaipur, Rajasthan',
      'listing.previewCard.artisanName': user.displayName || user.name,
      'share.messageTemplate': `Namaste! I just published a new handcrafted item on Kala Connect: Jaipur Blue Pottery Glazed Floral Urn. 100% authentic GI certified directly from my workshop: ${window.location.origin}/#product-p4`,
      'app.supportContact.tollFree': '1800-208-KALA',
      'app.supportContact': '1800-208-KALA (India)',
      'emptyMessage': 'No pending records found in this view.'
    };

    // TreeWalker to safely replace text tokens
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodes = [];
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes('{{')) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(tn => {
      let val = tn.nodeValue;
      Object.keys(tokenMap).forEach(k => {
        val = val.split(`{{${k}}}`).join(tokenMap[k]);
        val = val.split(`{{${k} || 'Not provided'}}`).join(tokenMap[k]);
        val = val.split(`{{${k} || "Not provided"}}`).join(tokenMap[k]);
      });
      // Handle remaining unmatched tokens cleanly
      val = val.replace(/\{\{[^}]+\}\}/g, function(match) {
        if (match.includes('each') || match.includes('/each')) return '';
        return '';
      });
      tn.nodeValue = val;
    });

    // Also replace in input values and placeholders
    document.querySelectorAll('input, textarea').forEach(el => {
      if (el.value && el.value.includes('{{')) {
        Object.keys(tokenMap).forEach(k => {
          el.value = el.value.split(`{{${k}}}`).join(tokenMap[k]);
        });
      }
      if (el.placeholder && el.placeholder.includes('{{')) {
        Object.keys(tokenMap).forEach(k => {
          el.placeholder = el.placeholder.split(`{{${k}}}`).join(tokenMap[k]);
        });
      }
    });
  }

  // Path resolution across directory boundaries
  function resolvePath(target) {
    const isRoot = !window.location.pathname.includes('/stitch_kala_connect_artisan_marketplace 2/') ||
                   window.location.pathname.endsWith('index.html') ||
                   window.location.pathname.endsWith('/');

    const prefix = isRoot ? '' : '../';

    const pathMap = {
      'home': prefix + 'index.html#home',
      'directory': prefix + 'index.html#marketplace',
      'all-crafts': prefix + 'index.html#marketplace',
      'textiles-category': prefix + 'index.html#marketplace?cat=textiles',
      'pottery-and-clay': prefix + 'index.html#marketplace?cat=pottery',
      'jewellery-category': prefix + 'index.html#marketplace?cat=jewellery',
      'woodwork-category': prefix + 'index.html#marketplace?cat=woodwork',
      'paintings-category': prefix + 'index.html#marketplace?cat=paintings',
      'regional-crafts-gi': prefix + 'index.html#marketplace?gi=true',
      'artisan-stories': prefix + 'index.html#home',
      'artisan-portal': prefix + 'index.html#onboarding',
      'craft-enquiries': prefix + 'index.html#enquiries',
      'enquiries': prefix + 'index.html#enquiries',
      'sign-in': prefix + 'index.html#auth',
      'dashboard': prefix + 'index.html#dashboard',
      'my-products': prefix + 'index.html#dashboard?tab=products',
      'add-product': prefix + 'index.html#add-product',
      'add-product-step-1': prefix + 'index.html#add-product?step=1',
      'add-product-step-2': prefix + 'index.html#add-product?step=2',
      'add-product-step-3': prefix + 'index.html#add-product?step=3',
      'add-product-step-4': prefix + 'index.html#add-product?step=4',
      'add-product-step-5': prefix + 'index.html#add-product?step=5',
      'track-orders': prefix + 'index.html#orders',
      'buyer-search-results-desktop-kala_connect': prefix + 'index.html#marketplace',
      'product-detail': prefix + 'index.html#product-p4',
      'price-helper': prefix + 'index.html#add-product?step=1'
    };

    return pathMap[target] || (prefix + 'index.html#' + target);
  }

  // Intercept click on data-path attributes
  function wireNavigation() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-path]');
      if (!target) return;
      const path = target.getAttribute('data-path');
      if (path) {
        e.preventDefault();
        const url = resolvePath(path);
        window.location.href = url;
      }
    });

    // Wire up auth / sign in navigation
    window.switchPersona = function(type) {
      window.location.href = resolvePath('sign-in') + (type ? `?role=${type}` : '');
    };

    // Wire up state indicators if present
    window.setDashboardState = function(state) {
      const loaded = document.getElementById('view-loaded');
      const skeleton = document.getElementById('view-skeleton');
      const empty = document.getElementById('view-empty');
      const error = document.getElementById('view-error');
      if (!loaded) return;

      [loaded, skeleton, empty, error].forEach(el => el && el.classList.add('hidden'));

      if (state === 'loaded' && loaded) loaded.classList.remove('hidden');
      if (state === 'skeleton' && skeleton) skeleton.classList.remove('hidden');
      if (state === 'empty' && empty) empty.classList.remove('hidden');
      if (state === 'error' && error) error.classList.remove('hidden');
    };
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      replaceTokensInDOM();
      wireNavigation();
    });
  } else {
    replaceTokensInDOM();
    wireNavigation();
  }
})();
