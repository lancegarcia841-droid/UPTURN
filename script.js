const CALENDLY_URL = 'https://calendly.com/upturn-business/meeting-with-upturn?month=2026-06';
let isSubmitting = false; // duplicate submission guard

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

async function submitInquiry() {
    // ── Duplicate submission guard ─────────────────────────────────────────
    if (isSubmitting) {
        console.warn('[Upturn] Submission already in progress — ignoring duplicate tap.');
        return;
    }

    // ── Collect & validate form data ───────────────────────────────────────
    const name          = document.getElementById('inp-name').value.trim();
    const email         = document.getElementById('inp-email2').value.trim();
    const phone         = document.getElementById('inp-tel').value.trim();
    const businessName  = document.getElementById('inp-biz').value.trim();
    const isNewsletterOptIn = document.getElementById('nl-optin').checked;

    const serviceMap = {
        's1': 'Business Registration',
        's2': 'Business Amendment',
        's3': 'Business Closure',
        's4': 'Bookkeeping & Tax Compliance',
        's5': 'Tax Compliance Review',
        's6': 'Annual Audit'
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

    // ── iOS Safari fix: open the window SYNCHRONOUSLY inside the user gesture
    //
    // Safari (iOS) blocks window.open() called from async callbacks (await,
    // setTimeout, etc.) because they are not considered "user-initiated".
    // The fix: call window.open() NOW — synchronously, before any await —
    // which is still within the original tap event. We navigate the already-
    // trusted blank window to Calendly after the fetch succeeds.
    // Desktop Chrome, Android Chrome, and Firefox are unaffected by this change.
    // ──────────────────────────────────────────────────────────────────────────
    const calendlyWindow = window.open('', '_blank', 'noopener');
    console.log('[Upturn] Pre-opened blank window for Calendly (iOS Safari compat).');

    // ── Lock UI ───────────────────────────────────────────────────────────
    isSubmitting = true;
    const btn = document.querySelector('.btn-submit');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
    }

    try {
        console.log('[Upturn] Sending inquiry to Mailchimp for:', email);

        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                firstName:    name,
                phone:        phone,
                businessName: businessName,
                services:     selectedServices.join(', '),
                tags: isNewsletterOptIn ? ['Inquiry', 'Newsletter'] : ['Inquiry']
            })
        });

        if (response.ok) {
            console.log('[Upturn] Mailchimp submission successful. Navigating to Calendly…');
            showToast('✓ Inquiry sent! Redirecting you to book your free consultation…');

            // Clear form
            document.getElementById('inp-name').value    = '';
            document.getElementById('inp-email2').value  = '';
            document.getElementById('inp-biz').value     = '';
            document.getElementById('inp-tel').value     = '';
            document.getElementById('nl-optin').checked  = false;
            ['s1','s2','s3','s4','s5','s6'].forEach(id =>
                document.getElementById(id).checked = false
            );

            // Navigate the pre-opened window to Calendly.
            // Works on iOS Safari, Android Chrome, Desktop Chrome/Safari/Firefox.
            if (calendlyWindow && !calendlyWindow.closed) {
                calendlyWindow.location.href = CALENDLY_URL;
                console.log('[Upturn] Calendly window navigated successfully.');
            } else {
                // Popup was fully blocked — fall back to same-tab redirect
                console.warn('[Upturn] Popup blocked. Falling back to same-tab redirect after 1.5s.');
                setTimeout(() => { window.location.href = CALENDLY_URL; }, 1500);
            }

        } else {
            const data = await response.json();
            console.error('[Upturn] API error response:', data);
            showToast('Error: ' + (data.error || 'Failed to submit. Please try again.'));
            // Close the blank tab so the user isn't left with an empty page
            if (calendlyWindow && !calendlyWindow.closed) calendlyWindow.close();
        }

    } catch (err) {
        console.error('[Upturn] Network or fetch error:', err);
        showToast('Network error — please try again later.');
        if (calendlyWindow && !calendlyWindow.closed) calendlyWindow.close();

    } finally {
        // ── Always restore the button ────────────────────────────────────
        isSubmitting = false;
        if (btn) {
            btn.disabled    = false;
            btn.textContent = 'Book Free Consultation →';
        }
    }
}

async function subscribeNewsletter() {
    // There is no explicit newsletter form in the HTML currently, just the opt-in checkbox 
    // inside the inquiry form. If we add a dedicated newsletter form later, this handles it.
    const nameInput = document.getElementById('nl-name');
    const emailInput = document.getElementById('nl-email');
    
    if (!nameInput || !emailInput) return; // Inputs don't exist

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!email) {
        showToast('Please enter an email address.');
        return;
    }

    try {
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                firstName: name,
                tags: ['Newsletter']
            })
        });

        if (response.ok) {
            showToast('✓ Subscribed! Welcome to the Upturn newsletter.');
            nameInput.value = '';
            emailInput.value = '';
        } else {
            const data = await response.json();
            showToast('Error: ' + (data.error || 'Failed to subscribe.'));
        }
    } catch (err) {
        console.error(err);
        showToast('Network error, please try again later.');
    }
}