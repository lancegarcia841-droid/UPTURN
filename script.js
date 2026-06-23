const CALENDLY_URL = 'https://calendly.com/upturn-business/meeting-with-upturn?month=2026-06';
let isSubmitting = false;

// ── GA4 helper ────────────────────────────────────────────────────────────
function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
    }
}

// ── Scroll depth tracking (25 / 50 / 75 / 100%) ─────────────────────────
(function () {
    const milestones = [25, 50, 75, 100];
    const reached = new Set();

    window.addEventListener('scroll', function () {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        const pct      = Math.round((scrolled / total) * 100);

        milestones.forEach(function (m) {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                trackEvent('scroll_depth', { depth_percentage: m });
            }
        });
    }, { passive: true });
})();

// ── CTA click tracking ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

    // "INQUIRE NOW" and "OUR SERVICES" hero buttons
    document.querySelectorAll('.btn-gold, .btn-outline-blue').forEach(function (el) {
        el.addEventListener('click', function () {
            trackEvent('cta_click', {
                button_text:     el.textContent.trim(),
                button_location: 'hero'
            });
        });
    });

    // Nav "FREE CONSULTATION" button
    document.querySelector('.nav-cta')?.addEventListener('click', function () {
        trackEvent('cta_click', {
            button_text:     'FREE CONSULTATION',
            button_location: 'navbar'
        });
    });

    // Mobile nav CTA
    document.querySelector('.mobile-cta')?.addEventListener('click', function () {
        trackEvent('cta_click', {
            button_text:     'FREE CONSULTATION',
            button_location: 'mobile_nav'
        });
    });

    // "Talk to Us" button in Who We Are section
    document.querySelector('.btn-navy-pill')?.addEventListener('click', function () {
        trackEvent('cta_click', {
            button_text:     'Talk to Us',
            button_location: 'who_we_are'
        });
    });

    // Service checkboxes
    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            if (cb.checked) {
                const label = cb.closest('.check-item')
                    ?.querySelector('.check-text')?.textContent.trim();
                trackEvent('service_selected', { service_name: label });
            }
        });
    });

});

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

async function submitInquiry() {
    if (isSubmitting) return;

    // ── Collect & validate ─────────────────────────────────────────────────
    const name             = document.getElementById('inp-name').value.trim();
    const email            = document.getElementById('inp-email2').value.trim();
    const phone            = document.getElementById('inp-tel').value.trim();
    const businessName     = document.getElementById('inp-biz').value.trim();
    const isNewsletterOptIn = document.getElementById('nl-optin').checked;

    const serviceMap = {
        's1': 'Business Registration',
        's2': 'Business Amendment',
        's3': 'Business Closure',
        's4': 'Tax Compliance & Bookkeeping',
        's5': 'BIR Letter of Authority Case Handling',
        's6': 'Audited Financial Statements & ITR'
    };

    const selectedServices = Object.keys(serviceMap)
        .filter(id => document.getElementById(id).checked)
        .map(id => serviceMap[id]);

    if (!name || !email) {
        showToast('Please fill in your name and email.');
        return;
    }
    if (selectedServices.length === 0) {
        showToast('Please select at least one service.');
        return;
    }

    // ── iOS Safari fix ─────────────────────────────────────────────────────
    // Safari on iOS only allows window.open() inside a synchronous user-gesture
    // handler. Opening the window NOW (before any await) keeps it "trusted".
    // We intentionally omit 'noopener' so we retain the window reference and
    // can navigate it to Calendly after the fetch completes.
    // Without this, iOS Safari silently discards the redirect.
    const calendlyWindow = window.open('', '_blank');
    console.log('[Upturn] Pre-opened blank window for Calendly (iOS Safari compat).');

    // ── Lock UI ────────────────────────────────────────────────────────────
    isSubmitting = true;
    const btn = document.querySelector('.btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                firstName:    name,
                phone,
                businessName,
                services:     selectedServices.join(', '),
                newsletter:   isNewsletterOptIn
            })
        });

        if (response.ok) {
            showToast('✓ Inquiry sent! Redirecting to Calendly…');

            // Track successful signup
            trackEvent('signup_complete', {
                services_selected: selectedServices.join(', '),
                newsletter_opt_in: isNewsletterOptIn
            });

            // Clear form
            ['inp-name','inp-email2','inp-biz','inp-tel']
                .forEach(id => document.getElementById(id).value = '');
            ['s1','s2','s3','s4','s5','s6','nl-optin']
                .forEach(id => document.getElementById(id).checked = false);

            // Navigate the pre-opened window to Calendly.
            // This works on iOS Safari, Android, and all desktop browsers because
            // we opened the window synchronously in the same user-gesture call stack.
            if (calendlyWindow && !calendlyWindow.closed) {
                calendlyWindow.location.href = CALENDLY_URL;
                console.log('[Upturn] Calendly window navigated successfully.');
            } else {
                // Popup was hard-blocked by browser — fall back to same-tab redirect
                console.warn('[Upturn] Popup blocked — falling back to same-tab redirect.');
                setTimeout(() => { window.location.href = CALENDLY_URL; }, 1500);
            }

        } else {
            const data = await response.json();
            showToast('Error: ' + (data.error || 'Submission failed. Please try again.'));
            if (calendlyWindow && !calendlyWindow.closed) calendlyWindow.close();
        }

    } catch (err) {
        console.error('[Upturn] Network error:', err);
        showToast('Network error — please try again later.');
        if (calendlyWindow && !calendlyWindow.closed) calendlyWindow.close();

    } finally {
        isSubmitting = false;
        if (btn) {
            btn.disabled    = false;
            btn.textContent = 'BOOK FREE CONSULTATION →';
        }
    }
}