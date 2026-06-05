const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();

// Mailchimp Config
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || 'ca0ed81d80';
const DATA_CENTER = process.env.DATA_CENTER || 'us2';

app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

app.post('/api/subscribe', async (req, res) => {
    const { email, firstName, lastName, phone, tags } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
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
            res.status(200).json({ message: 'Successfully subscribed', id: result.id });
        } else if (result.title === 'Member Exists') {
            res.status(200).json({ message: 'Already subscribed' });
        } else {
            console.error('Mailchimp API Error:', result);
            res.status(400).json({ error: result.detail || 'Failed to subscribe' });
        }
    } catch (error) {
        console.error('Error calling Mailchimp:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
