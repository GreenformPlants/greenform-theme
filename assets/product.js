/* ============================================================
   Greenform — product page interactions (v8)
   - Per-size 360 viewer (frame 0 = main photo); drag/swipe to spin
   - Side arrows step through extra static product photos
   - Size change swaps the 360 set + price/variant
   - Pot change shows that variant's composite image (sticky); the
     no-pot swatch / the 360 thumbnail return to the 360
   ============================================================ */
(function () {
  'use strict';
  var section = document.querySelector('[data-product-section]');
  if (!section) return;

  function readJSON(sel, fallback) {
    var el = section.querySelector(sel);
    if (!el) return fallback;
    try { return JSON.parse(el.textContent); } catch (e) { return fallback; }
  }

  var productJson  = readJSON('[data-product-json]', null);
  var sizeFrames   = readJSON('[data-size-frames]', {}) || {};
  var variantMedia = readJSON('[data-variant-media]', {}) || {};
  var extraPhotos  = readJSON('[data-extra-photos]', []) || [];

  /* ---- gallery elements ---- */
  var stage        = section.querySelector('[data-stage]');
  var spinWrap     = section.querySelector('[data-spin-viewer]');
  var staticImg    = section.querySelector('[data-stage-static]');
  var placeholder  = section.querySelector('[data-spin-placeholder]');
  var badge        = section.querySelector('[data-spin-badge]');
  var viewTag      = section.querySelector('[data-view-tag]');
  var hint         = section.querySelector('[data-spin-hint]');
  var scrubber     = section.querySelector('[data-scrubber]');
  var sTrack       = section.querySelector('[data-s-track]');
  var sThumb       = section.querySelector('[data-s-thumb]');
  var thumbs       = section.querySelector('[data-thumbs]');
  var arrowPrev    = section.querySelector('[data-arrow-prev]');
  var arrowNext    = section.querySelector('[data-arrow-next]');
  if (!stage || !spinWrap) return;

  /* ---- option groups (rendered by main-product.liquid) ---- */
  var sizeGroup = section.querySelector('.size-row[data-option-group]');
  var potGroup  = section.querySelector('.pot-row[data-option-group]');

  /* ---- commerce elements ---- */
  var variantInput = section.querySelector('[data-variant-id-input]');
  var priceCurrent = section.querySelector('[data-current-price]');
  var priceCompare = section.querySelector('[data-compare-price]');
  var stockEl      = section.querySelector('[data-stock-indicator]');
  var stockLabel   = section.querySelector('[data-stock-label]');
  var submitBtn    = section.querySelector('[data-add-to-cart-btn]');

  /* ---- option names from product JSON ---- */
  var optNames = [];
  if (productJson && productJson.options) {
    optNames = productJson.options.map(function (o) { return (typeof o === 'string') ? o : o.name; });
  }

  /* ---- state ---- */
  var SIZE = sizeGroup ? selectedVal(sizeGroup) : null;
  var POT  = potGroup  ? selectedVal(potGroup)  : null;
  var frames = [], spinFrame = 0, view = 'spin', dragging = false, startX = 0, startFrame = 0;
  var SENS = 14;

  function selectedVal(group) {
    var s = group.querySelector('.selected') || group.querySelector('[data-option-value]');
    return s ? s.getAttribute('data-option-value') : null;
  }
  function handleize(v) { return (v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function isNonePot(v) {
    var h = handleize(v);
    return !v || h === 'no-pot' || h === 'none' || h === 'nopot' || h === 'grow-pot' || h === 'plastic-grow-pot';
  }
  function markSelected(group, btn) {
    group.querySelectorAll('[data-option-value]').forEach(function (b) { b.classList.remove('selected'); });
    if (btn) btn.classList.add('selected');
  }

  /* ---- 360 frames for the current size ---- */
  function currentFrames() {
    if (SIZE && sizeFrames[SIZE] && sizeFrames[SIZE].length) return sizeFrames[SIZE];
    if (sizeFrames._all && sizeFrames._all.length) return sizeFrames._all;
    return [];
  }
  function buildFrames() {
    frames = currentFrames();
    spinWrap.innerHTML = '';
    frames.forEach(function (url, i) {
      var im = document.createElement('img');
      im.src = url; im.draggable = false; im.alt = '';
      if (i === 0) im.className = 'active';
      spinWrap.appendChild(im);
    });
    spinFrame = 0;
  }
  function setSpinFrame(f) {
    if (!frames.length) return;
    f = ((f % frames.length) + frames.length) % frames.length;
    var imgs = spinWrap.children;
    if (imgs[spinFrame]) imgs[spinFrame].classList.remove('active');
    spinFrame = f;
    if (imgs[spinFrame]) imgs[spinFrame].classList.add('active');
    var pct = frames.length > 1 ? spinFrame / (frames.length - 1) : 0;
    if (sThumb) sThumb.style.left = (pct * 100) + '%';
  }

  /* ---- views ---- */
  function showSpin() {
    view = 'spin';
    if (staticImg) staticImg.hidden = true;
    spinWrap.style.display = '';
    if (frames.length) {
      if (placeholder) placeholder.hidden = true;
      spinWrap.hidden = false;
      badge.classList.remove('hidden');
      if (scrubber) scrubber.classList.remove('hidden');
    } else {
      spinWrap.hidden = true;
      if (placeholder) placeholder.hidden = false;
      badge.classList.add('hidden');
      if (scrubber) scrubber.classList.add('hidden');
    }
    if (viewTag) viewTag.classList.add('hidden');
    setSpinFrame(spinFrame);
    syncThumbs();
  }
  function showStatic(url, label) {
    if (!staticImg) return;
    view = 'static';
    staticImg.src = url; staticImg.hidden = false;
    spinWrap.style.display = 'none';
    if (placeholder) placeholder.hidden = true;
    badge.classList.add('hidden');
    if (scrubber) scrubber.classList.add('hidden');
    if (hint) hint.classList.add('gone');
    if (viewTag) { viewTag.classList.remove('hidden'); viewTag.textContent = label || ''; }
    dragging = false; stage.classList.remove('spinning');
    syncThumbs();
  }

  /* ---- variant resolution + commerce update ---- */
  function findVariant() {
    if (!productJson || !productJson.variants) return null;
    return productJson.variants.find(function (v) {
      return optNames.every(function (name, i) {
        var n = name.toLowerCase();
        if (n.indexOf('size') >= 0) return !SIZE || v.options[i] === SIZE;
        if (n.indexOf('pot') >= 0 || n.indexOf('colour') >= 0 || n.indexOf('color') >= 0) return !POT || v.options[i] === POT;
        return true;
      });
    });
  }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function updateVariant(v) {
    if (!v) {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Unavailable'; }
      return;
    }
    if (variantInput) variantInput.value = v.id;
    if (priceCurrent) priceCurrent.textContent = money(v.price);
    if (priceCompare) {
      if (v.compare_at_price && v.compare_at_price > v.price) {
        priceCompare.textContent = money(v.compare_at_price); priceCompare.style.display = '';
      } else { priceCompare.style.display = 'none'; }
    }
    if (v.available) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add to cart'; }
      if (stockEl) stockEl.classList.remove('out');
      if (stockLabel) stockLabel.textContent = 'In stock — ships within 2–4 business days';
    } else {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sold out'; }
      if (stockEl) stockEl.classList.add('out');
      if (stockLabel) stockLabel.textContent = 'Currently out of stock';
    }
    try {
      if (v.id && history.replaceState) {
        var url = new URL(window.location); url.searchParams.set('variant', v.id); history.replaceState({}, '', url);
      }
    } catch (x) {}
  }

  /* ---- selection handlers ---- */
  function applyPotView() {
    var v = findVariant();
    updateVariant(v);
    if (isNonePot(POT)) { showSpin(); return; }
    var url = v && variantMedia[String(v.id)];
    if (url) showStatic(url, POT); else showSpin();
  }
  if (sizeGroup) {
    sizeGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-option-value]'); if (!btn) return;
      SIZE = btn.getAttribute('data-option-value'); markSelected(sizeGroup, btn);
      buildFrames();
      if (view === 'static' && !isNonePot(POT)) applyPotView();
      else { updateVariant(findVariant()); showSpin(); }
    });
  }
  if (potGroup) {
    potGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-option-value]'); if (!btn) return;
      POT = btn.getAttribute('data-option-value'); markSelected(potGroup, btn);
      applyPotView();
    });
  }

  /* ---- arrows + thumbnails over [360, extra photos...] ---- */
  function selectNonePot() {
    if (!potGroup) return;
    var none = null;
    potGroup.querySelectorAll('[data-option-value]').forEach(function (b) {
      if (!none && isNonePot(b.getAttribute('data-option-value'))) none = b;
    });
    if (none) { POT = none.getAttribute('data-option-value'); markSelected(potGroup, none); updateVariant(findVariant()); }
  }
  var slideCount = 1 + extraPhotos.length;
  var slideIdx = 0;
  function gotoSlide(i) {
    i = ((i % slideCount) + slideCount) % slideCount;
    slideIdx = i;
    if (i === 0) { selectNonePot(); showSpin(); }
    else showStatic(extraPhotos[i - 1], 'Photo ' + i);
  }
  if (arrowPrev) arrowPrev.addEventListener('click', function () { gotoSlide(slideIdx - 1); });
  if (arrowNext) arrowNext.addEventListener('click', function () { gotoSlide(slideIdx + 1); });

  function renderThumbs() {
    if (!thumbs) return;
    thumbs.innerHTML = '';
    var t0 = document.createElement('button');
    t0.type = 'button'; t0.className = 'thumb-item'; t0.dataset.slide = '0';
    t0.innerHTML = '<div class="thumb-360"><svg viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" stroke-width="1.6"><path d="M3 12a9 4 0 1 0 18 0 9 4 0 1 0-18 0"/></svg><span>360°</span></div>';
    t0.addEventListener('click', function () { slideIdx = 0; gotoSlide(0); });
    thumbs.appendChild(t0);
    extraPhotos.forEach(function (url, i) {
      var t = document.createElement('button');
      t.type = 'button'; t.className = 'thumb-item'; t.dataset.slide = String(i + 1);
      t.innerHTML = '<img src="' + url + '" alt="" loading="lazy">';
      t.addEventListener('click', function () { gotoSlide(i + 1); });
      thumbs.appendChild(t);
    });
  }
  function syncThumbs() {
    if (!thumbs) return;
    thumbs.querySelectorAll('.thumb-item').forEach(function (t) {
      var idx = parseInt(t.dataset.slide, 10);
      t.classList.toggle('active', view === 'spin' ? idx === 0 : idx === slideIdx && idx !== 0);
    });
  }

  /* ---- spin drag (only in 360 view) ---- */
  function spinActive() { return view === 'spin' && frames.length > 1; }
  function dismissHint() { if (hint) hint.classList.add('gone'); }
  stage.addEventListener('pointerdown', function (e) {
    if (!spinActive()) { dragging = false; return; }
    dragging = true; startX = e.clientX; startFrame = spinFrame;
    stage.classList.add('spinning'); dismissHint();
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging || !spinActive()) return;
    setSpinFrame(startFrame + Math.round((e.clientX - startX) / SENS));
  });
  function endDrag() { dragging = false; stage.classList.remove('spinning'); }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', endDrag);

  /* scrubber */
  if (sTrack) {
    var scrubbing = false;
    function scrubAt(x) { var r = sTrack.getBoundingClientRect(); var pct = Math.max(0, Math.min(1, (x - r.left) / r.width)); setSpinFrame(Math.round(pct * (frames.length - 1))); }
    sTrack.addEventListener('pointerdown', function (e) { if (!spinActive()) return; scrubbing = true; dismissHint(); scrubAt(e.clientX); try { sTrack.setPointerCapture(e.pointerId); } catch (x) {} });
    sTrack.addEventListener('pointermove', function (e) { if (scrubbing && spinActive()) scrubAt(e.clientX); });
    sTrack.addEventListener('pointerup', function () { scrubbing = false; });
  }

  /* ---- wishlist (non-breaking) ---- */
  var wishlistBtn = section.querySelector('[data-wishlist-btn]');
  if (wishlistBtn) wishlistBtn.addEventListener('click', function () { wishlistBtn.textContent = 'Saved ♡'; setTimeout(function () { wishlistBtn.textContent = 'Save to wishlist'; }, 1500); });

  /* ---- init ---- */
  buildFrames();
  renderThumbs();
  updateVariant(findVariant());
  showSpin();
})();
