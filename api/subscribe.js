// Note: On Vercel, env vars are injected automatically. dotenv is not needed here.

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, firstName, lastName, phone, businessName, services, tags } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || 'ca0ed81d80';
    const DATA_CENTER = process.env.DATA_CENTER || 'us2';

    if (!MAILCHIMP_API_KEY) {
        return res.status(500).json({ error: 'Missing Mailchimp API Key in environment variables' });
    }

    const data = {
        email_address: email,
        status: 'subscribed',
        merge_fields: {},
        tags: tags || []
    };

    if (firstName) {
        data.merge_fields.FNAME = firstName;
    }
    if (lastName) {
        data.merge_fields.LNAME = lastName;
    } else if (firstName && firstName.includes(' ')) {
        const parts = firstName.split(' ');
        data.merge_fields.FNAME = parts[0];
        data.merge_fields.LNAME = parts.slice(1).join(' ');
    }
    if (phone) {
        data.merge_fields.PHONE = phone;
    }
    if (businessName) {
        data.merge_fields.COMPANY = businessName;
    }
    if (services) {
        data.merge_fields.SERVICES = services;
    }

    try {
        const response = await fetch(`https://${DATA_CENTER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`any:${MAILCHIMP_API_KEY}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            return res.status(200).json({ message: 'Successfully subscribed', id: result.id });
        } else if (result.title === 'Member Exists') {
            return res.status(200).json({ message: 'Already subscribed' });
        } else {
            console.error('Mailchimp API Error details:', JSON.stringify(result, null, 2));
            const errorMsg = result.detail || result.title || 'Failed to subscribe to Mailchimp';
            return res.status(400).json({ error: errorMsg });
        }
    } catch (error) {
        console.error('Network/Internal Error calling Mailchimp:', error.message || error);
        return res.status(500).json({ error: 'Internal server error while calling Mailchimp' });
    }
}
