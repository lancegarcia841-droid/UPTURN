// Note: On Vercel, env vars are injected automatically. dotenv is not needed here.

const crypto = require('crypto');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, firstName, lastName, phone, businessName, services, newsletter } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const MAILCHIMP_API_KEY     = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || 'ca0ed81d80';
    const DATA_CENTER           = process.env.DATA_CENTER || 'us2';

    if (!MAILCHIMP_API_KEY) {
        return res.status(500).json({ error: 'Missing Mailchimp API Key in environment variables' });
    }

    const authHeader = {
        'Authorization': `Basic ${Buffer.from(`any:${MAILCHIMP_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json'
    };

    const baseUrl = `https://${DATA_CENTER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}`;

    // ── Build member payload ────────────────────────────────────────────
    const memberData = {
        email_address: email,
        status_if_new: 'subscribed',
        status:        'subscribed',
        merge_fields:  {}
    };

    if (firstName) {
        if (firstName.includes(' ')) {
            const parts = firstName.split(' ');
            memberData.merge_fields.FNAME = parts[0];
            memberData.merge_fields.LNAME = parts.slice(1).join(' ');
        } else {
            memberData.merge_fields.FNAME = firstName;
        }
    }
    if (lastName)     memberData.merge_fields.LNAME    = lastName;
    if (phone)        memberData.merge_fields.PHONE    = phone;
    if (businessName) memberData.merge_fields.COMPANY  = businessName;
    if (services)     memberData.merge_fields.SERVICES = services;

    // ── MD5 hash of lowercase email (Mailchimp subscriber ID) ──────────
    const subscriberHash = crypto
        .createHash('md5')
        .update(email.toLowerCase())
        .digest('hex');

    try {
        // ── Step 1: Upsert the member ───────────────────────────────────
        const memberRes = await fetch(`${baseUrl}/members/${subscriberHash}`, {
            method:  'PUT',
            headers: authHeader,
            body:    JSON.stringify(memberData)
        });

        const memberResult = await memberRes.json();

        if (!memberRes.ok) {
            console.error('Mailchimp member upsert error:', JSON.stringify(memberResult, null, 2));
            const errorMsg = memberResult.detail || memberResult.title || 'Failed to save contact';
            return res.status(400).json({ error: errorMsg });
        }

        // ── Step 2: Build and apply tags ────────────────────────────────
        // Always tag as "Cold Lead".
        // Add one tag per checked service.
        // Add "Newsletter" if opted in.
        const serviceList = services
            ? services.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        const tagsToApply = [
            'Cold Lead',
            ...serviceList,
            ...(newsletter ? ['Newsletter'] : [])
        ];

        const uniqueTags = [...new Set(tagsToApply)];

        console.log(`[Upturn] Applying tags to ${email}:`, uniqueTags);

        const tagsRes = await fetch(`${baseUrl}/members/${subscriberHash}/tags`, {
            method:  'POST',
            headers: authHeader,
            body:    JSON.stringify({
                tags: uniqueTags.map(name => ({ name, status: 'active' }))
            })
        });

        // Mailchimp returns 204 No Content on success for tags
        if (!tagsRes.ok) {
            const tagsResult = await tagsRes.json();
            console.error('Mailchimp tags error:', JSON.stringify(tagsResult, null, 2));
            return res.status(200).json({ message: 'Contact saved, but tags failed to apply', id: memberResult.id });
        }

        console.log(`[Upturn] Contact saved and tagged successfully: ${email}`);
        return res.status(200).json({ message: 'Successfully saved contact and applied tags', id: memberResult.id });

    } catch (error) {
        console.error('Network/Internal Error calling Mailchimp:', error.message || error);
        return res.status(500).json({ error: 'Internal server error while calling Mailchimp' });
    }
}
