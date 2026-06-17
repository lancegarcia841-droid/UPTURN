const CALENDLY_URL = 'https://calendly.com/upturn-business/meeting-with-upturn?month=2026-06';
let isSubmitting = false;

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