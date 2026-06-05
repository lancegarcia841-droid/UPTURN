function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

async function submitInquiry() {
    const name = document.getElementById('inp-name').value.trim();
    const email = document.getElementById('inp-email2').value.trim();
    const phone = document.getElementById('inp-tel').value.trim();
    const isNewsletterOptIn = document.getElementById('nl-optin').checked;
    
    const checked = ['s1', 's2', 's3', 's4', 's5', 's6'].some(id => document.getElementById(id).checked);

    if (!name || !email) {
        showToast('Please fill in your name and email.');
        return;
    }

    if (!checked) {
        showToast('Please select at least one service.');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                firstName: name,
                phone: phone,
                tags: isNewsletterOptIn ? ['Inquiry', 'Newsletter'] : ['Inquiry']
            })
        });

        if (response.ok) {
            showToast('✓ Inquiry sent! We\'ll be in touch within 24 hours.');
            document.getElementById('inp-name').value = '';
            document.getElementById('inp-email2').value = '';
            document.getElementById('inp-biz').value = '';
            document.getElementById('inp-tel').value = '';
            document.getElementById('nl-optin').checked = false;
            ['s1', 's2', 's3', 's4', 's5', 's6'].forEach(id => document.getElementById(id).checked = false);
        } else {
            const data = await response.json();
            showToast('Error: ' + (data.error || 'Failed to submit.'));
        }
    } catch (err) {
        console.error(err);
        showToast('Network error, please try again later.');
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
        const response = await fetch('http://localhost:3000/api/subscribe', {
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