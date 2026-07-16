(function() {
    const mobileNavButtons = document.querySelectorAll('[data-mobile-nav-toggle]');

    if (!mobileNavButtons.length) {
        return;
    }

    function setExpandedState(button, isExpanded) {
        const nav = button.closest('nav');
        const panel = nav ? nav.querySelector('[data-mobile-nav-panel]') : null;
        const icon = button.querySelector('[data-mobile-nav-icon]');

        button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

        if (panel) {
            panel.classList.toggle('hidden', !isExpanded);
        }

        if (icon) {
            icon.textContent = isExpanded ? 'close' : 'menu';
        }
    }

    function closeAllMobileNavs() {
        mobileNavButtons.forEach(function(button) {
            setExpandedState(button, false);
        });
    }

    mobileNavButtons.forEach(function(button) {
        setExpandedState(button, false);

        button.addEventListener('click', function() {
            const isExpanded = button.getAttribute('aria-expanded') === 'true';

            closeAllMobileNavs();
            setExpandedState(button, !isExpanded);
        });

        const nav = button.closest('nav');
        const panel = nav ? nav.querySelector('[data-mobile-nav-panel]') : null;

        if (panel) {
            panel.querySelectorAll('a').forEach(function(link) {
                link.addEventListener('click', function() {
                    closeAllMobileNavs();
                });
            });
        }
    });

    document.addEventListener('click', function(event) {
        if (event.target.closest('[data-mobile-nav-toggle]') || event.target.closest('[data-mobile-nav-panel]')) {
            return;
        }

        closeAllMobileNavs();
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAllMobileNavs();
        }
    });

    window.addEventListener('resize', function() {
        if (window.innerWidth >= 768) {
            closeAllMobileNavs();
        }
    });
})();

(function() {
    const featureCards = document.querySelectorAll('[data-scroll-target]');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highlightDurationMs = 1600;

    if (!featureCards.length) {
        return;
    }

    function highlightTarget(target) {
        target.classList.remove('is-scroll-highlighted');
        void target.offsetWidth;
        target.classList.add('is-scroll-highlighted');

        if (target._highlightTimer) {
            window.clearTimeout(target._highlightTimer);
        }

        target._highlightTimer = window.setTimeout(function() {
            target.classList.remove('is-scroll-highlighted');
            target._highlightTimer = null;
        }, highlightDurationMs);
    }

    function forceReveal(target) {
        if (!target.classList.contains('reveal-fx')) {
            return;
        }

        target.classList.add('reveal-fx-complete');
    }

    function scrollToTarget(target) {
        const fixedNav = document.querySelector('body > nav');
        const navOffset = fixedNav ? fixedNav.offsetHeight + 24 : 24;
        const targetTop = window.scrollY + target.getBoundingClientRect().top - navOffset;
        const shouldAnimate = !prefersReducedMotion.matches;

        forceReveal(target);

        window.scrollTo({
            top: Math.max(targetTop, 0),
            behavior: shouldAnimate ? 'smooth' : 'auto'
        });

        window.setTimeout(function() {
            highlightTarget(target);
        }, shouldAnimate ? 420 : 0);
    }

    featureCards.forEach(function(card) {
        card.addEventListener('click', function() {
            const targetId = card.dataset.scrollTarget;
            const target = targetId ? document.getElementById(targetId) : null;

            if (!target) {
                return;
            }

            scrollToTarget(target);
        });
    });
})();

(function() {
    const zarazStyleId = 'strictllm-zaraz-consent-style';
    const modelessClassName = 'strictllm-consent-modeless';
    const zarazConsentCss = `
        :host,
        dialog.cf_modal {
            --strictllm-consent-surface: rgba(6, 10, 16, 0.74);
            --strictllm-consent-border: rgba(255, 255, 255, 0.18);
            --strictllm-consent-text: #f8fafc;
            --strictllm-consent-text-muted: rgba(248, 250, 252, 0.86);
            --strictllm-consent-primary: #6f94f1;
            --strictllm-consent-primary-hover: #6288e7;
            --strictllm-consent-secondary-hover: rgba(255, 255, 255, 0.08);
            --strictllm-consent-focus-ring: rgba(111, 148, 241, 0.34);
        }

        dialog.cf_modal {
            border-color: var(--strictllm-consent-border) !important;
            background: var(--strictllm-consent-surface) !important;
            color: var(--strictllm-consent-text) !important;
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.26) !important;
        }

        :host(.strictllm-consent-modeless) {
            pointer-events: none !important;
        }

        :host(.strictllm-consent-modeless) dialog.cf_modal {
            pointer-events: auto !important;
        }

        dialog.cf_modal:focus,
        dialog.cf_modal:focus-visible {
            outline: none !important;
        }

        dialog.cf_modal .strictllm-consent-copy,
        dialog.cf_modal .strictllm-consent-copy p,
        dialog.cf_modal .cf_consent-intro,
        dialog.cf_modal .cf_consent-intro p {
            color: var(--strictllm-consent-text-muted) !important;
        }

        dialog.cf_modal .strictllm-consent-copy a,
        dialog.cf_modal .cf_consent-intro a {
            color: var(--strictllm-consent-text) !important;
        }

        dialog.cf_modal .cf_consent-buttons {
            background: transparent !important;
        }

        dialog.cf_modal #cf_consent-buttons__accept-all,
        dialog.cf_modal .cf_consent-buttons .cf_button--accept {
            background: #6f94f1 !important;
            background-color: #6f94f1 !important;
            border-color: #6f94f1 !important;
            color: #ffffff !important;
            box-shadow: 0 0 0 3px rgba(111, 148, 241, 0.18), 0 10px 24px rgba(111, 148, 241, 0.22) !important;
        }

        dialog.cf_modal #cf_consent-buttons__accept-all:hover,
        dialog.cf_modal .cf_consent-buttons .cf_button--accept:hover {
            background: #6288e7 !important;
            background-color: #6288e7 !important;
            border-color: #6288e7 !important;
        }

        dialog.cf_modal #cf_consent-buttons__reject-all,
        dialog.cf_modal .cf_consent-buttons .cf_button--reject {
            background: transparent !important;
            background-color: transparent !important;
            border-color: var(--strictllm-consent-border) !important;
            color: var(--strictllm-consent-text) !important;
            box-shadow: none !important;
        }

        dialog.cf_modal #cf_consent-buttons__reject-all:hover,
        dialog.cf_modal .cf_consent-buttons .cf_button--reject:hover {
            background: var(--strictllm-consent-secondary-hover) !important;
            background-color: var(--strictllm-consent-secondary-hover) !important;
        }
    `;

    function patchConsentShowModal() {
        if (!window.HTMLDialogElement?.prototype?.showModal) {
            return;
        }

        const prototype = window.HTMLDialogElement.prototype;
        if (prototype._strictllmConsentShowModalPatched) {
            return;
        }

        const nativeShowModal = prototype.showModal;
        prototype.showModal = function() {
            if (this.matches?.('dialog.cf_modal')) {
                this.setAttribute('open', '');
                this.classList.add(modelessClassName);
                scheduleZarazConsentSync();
                return undefined;
            }

            return nativeShowModal.apply(this, arguments);
        };
        prototype._strictllmConsentShowModalPatched = true;
    }

    function isModalDialog(dialog) {
        try {
            return dialog.matches(':modal');
        } catch (error) {
            return false;
        }
    }

    function makeConsentModeless(dialog, host) {
        if (!dialog || !dialog.open) {
            return;
        }

        host.classList.add(modelessClassName);
        dialog.classList.add(modelessClassName);

        if (!isModalDialog(dialog) || typeof dialog.close !== 'function') {
            return;
        }

        const returnValue = dialog.returnValue;
        dialog.close();
        dialog.returnValue = returnValue;
        dialog.setAttribute('open', '');
    }

    function syncZarazConsentMode(shadowRoot, host) {
        const modal = shadowRoot?.querySelector('dialog.cf_modal');
        makeConsentModeless(modal, host);
    }

    function scheduleZarazConsentSync() {
        window.setTimeout(syncZarazConsentStyle, 0);
    }

    function applyZarazConsentStyle(shadowRoot) {
        if (!shadowRoot) {
            return;
        }

        let style = shadowRoot.getElementById(zarazStyleId);
        if (!style) {
            style = document.createElement('style');
            style.id = zarazStyleId;
            shadowRoot.appendChild(style);
        }

        if (style.textContent !== zarazConsentCss) {
            style.textContent = zarazConsentCss;
        }
    }

    function syncZarazConsentStyle() {
        document.querySelectorAll('.cf_modal_container').forEach(function(container) {
            applyZarazConsentStyle(container.shadowRoot);
            syncZarazConsentMode(container.shadowRoot, container);
        });

        const documentModal = document.querySelector('dialog.cf_modal');
        makeConsentModeless(documentModal, documentModal);
    }

    const observer = new MutationObserver(syncZarazConsentStyle);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncZarazConsentStyle, { once: true });
    } else {
        syncZarazConsentStyle();
    }

    patchConsentShowModal();
    document.addEventListener('zarazConsentAPIReady', syncZarazConsentStyle);
    document.addEventListener('click', scheduleZarazConsentSync, true);
    document.addEventListener('keydown', scheduleZarazConsentSync, true);
    window.setTimeout(syncZarazConsentStyle, 500);
    window.setTimeout(syncZarazConsentStyle, 1500);
})();
