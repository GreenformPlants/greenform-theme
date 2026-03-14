/* ============================================================
   GREENFORM — Custom JavaScript
   Vanilla JS only. Layered on top of Dawn v15.4.1
   ============================================================ */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     SCROLL REVEAL (IntersectionObserver)
     --------------------------------------------------------- */
  function initScrollReveal() {
    const els = document.querySelectorAll('.gf-reveal');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------
     NAV SCROLL STATE
     (Handled directly in gf-header.liquid — no action needed here)
     --------------------------------------------------------- */

  /* ---------------------------------------------------------
     TOAST NOTIFICATIONS
     --------------------------------------------------------- */
  const toast = {
    el: null,
    timeout: null,

    init() {
      this.el = document.createElement('div');
      this.el.className = 'gf-toast';
      this.el.setAttribute('role', 'status');
      this.el.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.el);
    },

    show(message, duration = 3000) {
      if (!this.el) this.init();
      clearTimeout(this.timeout);
      this.el.textContent = message;
      // Force reflow
      void this.el.offsetHeight;
      this.el.classList.add('is-visible');
      this.timeout = setTimeout(() => {
        this.el.classList.remove('is-visible');
      }, duration);
    },
  };

  // Expose globally for use in Liquid
  window.GreenformToast = toast;

  /* ---------------------------------------------------------
     PRODUCT MODAL
     --------------------------------------------------------- */
  function initProductModal() {
    const overlay = document.getElementById('gf-modal-overlay');
    const modal = document.getElementById('gf-product-modal');
    if (!overlay || !modal) return;

    function openModal(data) {
      // Populate modal content
      const img = modal.querySelector('.gf-modal__image');
      const title = modal.querySelector('.gf-modal__title');
      const botanical = modal.querySelector('.gf-modal__botanical');
      const price = modal.querySelector('.gf-modal__price');
      const metaLight = modal.querySelector('[data-meta="light"]');
      const metaWater = modal.querySelector('[data-meta="water"]');
      const metaDifficulty = modal.querySelector('[data-meta="difficulty"]');

      if (img) img.src = data.image || '';
      if (img) img.alt = data.title || '';
      if (title) title.textContent = data.title || '';
      if (botanical) botanical.textContent = data.botanical || '';
      if (price) price.textContent = data.price || '';
      if (metaLight) metaLight.textContent = data.light || '';
      if (metaWater) metaWater.textContent = data.water || '';
      if (metaDifficulty) metaDifficulty.textContent = data.difficulty || '';

      // Store variant ID for add to cart
      modal.dataset.variantId = data.variantId || '';

      // Reset quantity
      const qtyValue = modal.querySelector('.gf-modal__qty-value');
      if (qtyValue) qtyValue.textContent = '1';

      overlay.classList.add('is-open');
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      // Focus trap
      const closeBtn = modal.querySelector('.gf-modal__close');
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      overlay.classList.remove('is-open');
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    // Close handlers
    overlay.addEventListener('click', closeModal);
    modal.querySelector('.gf-modal__close')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Prevent modal click from closing
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Qty controls
    const qtyValue = modal.querySelector('.gf-modal__qty-value');
    modal.querySelectorAll('.gf-modal__qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!qtyValue) return;
        let qty = parseInt(qtyValue.textContent, 10) || 1;
        if (btn.dataset.action === 'increase') qty++;
        if (btn.dataset.action === 'decrease' && qty > 1) qty--;
        qtyValue.textContent = qty;
      });
    });

    // Add to cart from modal
    const addBtn = modal.querySelector('.gf-modal__add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const variantId = modal.dataset.variantId;
        const qty = parseInt(qtyValue?.textContent || '1', 10);
        if (!variantId) return;
        addToCart(variantId, qty);
        closeModal();
      });
    }

    // Listen for quick-add triggers
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-gf-quick-add]');
      if (!trigger) return;
      e.preventDefault();

      openModal({
        title: trigger.dataset.title || '',
        botanical: trigger.dataset.botanical || '',
        price: trigger.dataset.price || '',
        image: trigger.dataset.image || '',
        light: trigger.dataset.light || '',
        water: trigger.dataset.water || '',
        difficulty: trigger.dataset.difficulty || '',
        variantId: trigger.dataset.variantId || '',
      });
    });
  }

  /* ---------------------------------------------------------
     AJAX ADD TO CART
     --------------------------------------------------------- */
  function addToCart(variantId, quantity = 1) {
    const body = JSON.stringify({
      items: [{ id: parseInt(variantId, 10), quantity }],
    });

    fetch(window.routes.cart_add_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Add to cart failed');
        return res.json();
      })
      .then(() => {
        toast.show('Added to cart');
        updateCartCount();
        // If Dawn's cart drawer exists, open it
        const cartDrawer = document.querySelector('cart-drawer');
        if (cartDrawer && typeof cartDrawer.open === 'function') {
          // Dawn's cart drawer uses a section rendering API approach
          // Trigger a fetch for the cart drawer section
          refreshCartDrawer();
        }
      })
      .catch((err) => {
        console.error(err);
        toast.show('Could not add to cart');
      });
  }

  function updateCartCount() {
    fetch('/cart.js', {
      headers: { Accept: 'application/json' },
    })
      .then((res) => res.json())
      .then((cart) => {
        document.querySelectorAll('.cart-count-bubble span[aria-hidden]').forEach((el) => {
          el.textContent = cart.item_count;
        });
        document.querySelectorAll('.cart-count-bubble').forEach((el) => {
          el.style.display = cart.item_count > 0 ? '' : 'none';
        });
      })
      .catch(() => {});
  }

  function refreshCartDrawer() {
    fetch('/?sections=cart-drawer')
      .then((res) => res.json())
      .then((data) => {
        const html = data['cart-drawer'];
        if (!html) return;
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const newDrawer = temp.querySelector('cart-drawer');
        const oldDrawer = document.querySelector('cart-drawer');
        if (newDrawer && oldDrawer) {
          oldDrawer.innerHTML = newDrawer.innerHTML;
          // Re-open the drawer
          const details = oldDrawer.querySelector('details');
          if (details) details.setAttribute('open', '');
        }
      })
      .catch(() => {});
  }

  // Expose for inline use
  window.GreenformCart = { addToCart, updateCartCount };

  /* ---------------------------------------------------------
     DIRECT ADD TO CART (for cards without modal)
     --------------------------------------------------------- */
  function initDirectAdd() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gf-direct-add]');
      if (!btn) return;
      e.preventDefault();
      const variantId = btn.dataset.variantId;
      if (!variantId) return;
      btn.disabled = true;
      btn.textContent = 'Adding...';
      addToCart(variantId, 1);
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Quick add';
      }, 1200);
    });
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  function init() {
    toast.init();
    initScrollReveal();
    initProductModal();
    initDirectAdd();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
