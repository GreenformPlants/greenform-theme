/* Greenform — small global helpers */
(function () {
  'use strict';

  // Money formatter using shop.money_format when available
  window.Greenform = window.Greenform || {};

  window.Greenform.formatMoney = function (cents) {
    var format = (window.Greenform.shop && window.Greenform.shop.moneyFormat) || '${{amount}}';
    var amount = (cents / 100).toFixed(2);
    return format.replace(/\{\{\s*amount\s*\}\}/, amount)
                 .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100))
                 .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, amount.replace('.', ','));
  };

  // Refresh the cart bubble after any cart change
  window.Greenform.refreshCart = function () {
    return fetch('/cart.js', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var bubble = document.querySelector('[data-cart-count]');
        if (bubble) {
          bubble.textContent = cart.item_count;
          bubble.style.display = cart.item_count > 0 ? '' : 'none';
        }
        return cart;
      });
  };

  // Curtain header: drop a solid green pane from the top edge to the bottom edge
  // of the header as the first section scrolls past. Progress (0 to 1) is written
  // to the nav's --gf-nav-fill custom property; the CSS turns it into a scaleY on
  // the green pane and a nav-ink colour shift. Runs on every template except
  // product pages, where the header is static and never fills.
  (function () {
    if (document.body.classList.contains('template-product')) return;
    var nav = document.querySelector('[data-site-nav]');
    var main = document.getElementById('main-content');
    if (!nav || !main) return;
    var anchor = main.firstElementChild; // hero on the homepage, page/collection header elsewhere
    var ticking = false;
    function update() {
      var navH = nav.offsetHeight || 64;
      var fill;
      if (anchor) {
        var rect = anchor.getBoundingClientRect();
        var span = anchor.offsetHeight - navH; // scroll distance for a full swipe
        if (span < 40) span = 40;              // guarantee a real swipe on short sections
        fill = 1 - (rect.bottom - navH) / span;
      } else {
        fill = window.scrollY > 60 ? 1 : window.scrollY / 60;
      }
      if (fill < 0) fill = 0;
      if (fill > 1) fill = 1;
      nav.style.setProperty('--gf-nav-fill', fill.toFixed(4));
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();

  // Mobile menu drawer toggle
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest && e.target.closest('[data-menu-toggle]');
    if (toggle) {
      var drawer = document.querySelector('[data-menu-drawer]');
      if (!drawer) return;
      var open = drawer.hasAttribute('hidden') ? false : true;
      if (open) {
        drawer.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        drawer.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    // Click outside drawer closes it
    var drawerEl = document.querySelector('[data-menu-drawer]');
    if (drawerEl && !drawerEl.hasAttribute('hidden')) {
      if (!e.target.closest('[data-menu-drawer]') && !e.target.closest('[data-menu-toggle]')) {
        drawerEl.setAttribute('hidden', '');
        var btn = document.querySelector('[data-menu-toggle]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  // Listen for add-to-cart forms and intercept with AJAX
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches || !form.matches('form[action*="/cart/add"]')) return;
    if (form.dataset.ajax === 'false') return;

    e.preventDefault();
    var btn = form.querySelector('[type="submit"]');
    var originalText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

    var formData = new FormData(form);

    fetch(window.Greenform.routes.cart_add_url + '.js', {
      method: 'POST',
      headers: { 'Accept': 'application/javascript' },
      body: formData,
      credentials: 'same-origin'
    })
      .then(function (r) {
        if (!r.ok) throw new Error('add to cart failed');
        return r.json();
      })
      .then(function () { return window.Greenform.refreshCart(); })
      .then(function () {
        if (btn) { btn.textContent = 'Added ✓'; setTimeout(function () { btn.textContent = originalText; btn.disabled = false; }, 1200); }
      })
      .catch(function () {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
        // fall back to a real form submit so the error surfaces
        form.dataset.ajax = 'false';
        form.submit();
      });
  });
})();
