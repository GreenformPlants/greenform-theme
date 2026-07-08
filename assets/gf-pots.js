/* Greenform — metafield-driven pot selector (per-size).
   Pots with a composite show that composite; the pot with no composite is the
   default pot the 360 was shot in, so selecting it returns to the 360 viewer.
   Independent of product.js (which handles variant-based pots). */
(function () {
  'use strict';
  var section = document.querySelector('[data-product-section]');
  if (!section) return;
  var dataEl = section.querySelector('[data-pots]');
  var potBlock = section.querySelector('[data-pot-block]');
  var potRow = section.querySelector('[data-pot-row]');
  if (!dataEl || !potBlock || !potRow) return;

  var POTS = {};
  try { POTS = JSON.parse(dataEl.textContent) || {}; } catch (e) { return; }

  var stage    = section.querySelector('[data-stage]');
  var spinWrap = section.querySelector('[data-spin-viewer]');
  var staticImg= section.querySelector('[data-stage-static]');
  var badge    = section.querySelector('[data-spin-badge]');
  var scrubber = section.querySelector('[data-scrubber]');
  var viewTag  = section.querySelector('[data-view-tag]');
  var hint     = section.querySelector('[data-spin-hint]');
  var sizeRow  = section.querySelector('.size-row[data-option-group]');

  function currentSize() {
    if (sizeRow) {
      var s = sizeRow.querySelector('.selected') || sizeRow.querySelector('[data-option-value]');
      if (s) return s.getAttribute('data-option-value');
    }
    var keys = Object.keys(POTS);
    return keys.length ? keys[0] : null;
  }

  function showComposite(url, label) {
    if (!staticImg) return;
    staticImg.src = url; staticImg.hidden = false;
    if (spinWrap) spinWrap.style.display = 'none';
    if (badge) badge.classList.add('hidden');
    if (scrubber) scrubber.classList.add('hidden');
    if (hint) hint.classList.add('gone');
    if (viewTag) { viewTag.classList.remove('hidden'); viewTag.textContent = label || ''; }
    if (stage) stage.classList.remove('spinning');
  }
  function backTo360() {
    if (staticImg) staticImg.hidden = true;
    if (spinWrap) spinWrap.style.display = '';
    if (badge) badge.classList.remove('hidden');
    if (scrubber) scrubber.classList.remove('hidden');
    if (viewTag) viewTag.classList.add('hidden');
  }
  function clearSelected() {
    potRow.querySelectorAll('.swatch').forEach(function (b) { b.classList.remove('selected'); });
  }

  function renderPots() {
    var size = currentSize();
    var arr = (size && POTS[size]) ? POTS[size] : [];
    potRow.innerHTML = '';
    if (!arr.length) { potBlock.hidden = true; return; }
    potBlock.hidden = false;

    var defaultBtn = null;
    arr.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch';
      b.style.background = p.swatch || '#cccccc';
      b.setAttribute('aria-label', p.title); b.title = p.title;
      b.setAttribute('data-pot-handle', p.handle);
      if (!p.img && !defaultBtn) defaultBtn = b;
      b.addEventListener('click', function () {
        clearSelected(); b.classList.add('selected');
        if (p.img) showComposite(p.img, p.title); else backTo360();
      });
      potRow.appendChild(b);
    });

    clearSelected();
    if (defaultBtn) defaultBtn.classList.add('selected');
    backTo360();
  }

  renderPots();
  if (sizeRow) {
    sizeRow.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-option-value]'); if (!btn) return;
      setTimeout(function () { renderPots(); }, 0);
    });
  }
})();
