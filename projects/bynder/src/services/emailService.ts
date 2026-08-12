import axios from 'axios';
import User, { IUser } from '../db/models/User.model.js';
import { ScanResult } from '../db/models/ScanResult.model.js';
import { getJsonModel, cleanJsonResponse } from '../utils/geminiClient.js';
import dotenv from 'dotenv';

dotenv.config();

const refreshGoogleToken = async (user: IUser) => {
    if (!user.refreshToken) return null;

    // Check if within 5 mins of expiry
    const now = new Date();
    if (user.tokenExpiry && now.getTime() < user.tokenExpiry.getTime() - (5 * 60 * 1000)) {
        return user.accessToken;
    }

    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: user.refreshToken,
            grant_type: 'refresh_token',
        });

        const { access_token, expires_in } = response.data;
        user.accessToken = access_token;
        user.tokenExpiry = new Date(Date.now() + expires_in * 1000);
        await user.save();
        return access_token;
    } catch (error: any) {
        console.error('Error refreshing Google token:', error.response?.data || error.message);
        return null;
    }
};

export const scanEmailsForSubscriptions = async (userId: string, tokenOverride?: string) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    let token = tokenOverride;
    if (!token) {
        token = await refreshGoogleToken(user as any);
    }

    if (!token) throw new Error('No valid Google token found. Please re-authenticate.');

    // Search for a broader range of payment-related emails
    const query = 'subscription OR receipt OR invoice OR payment OR renews OR renewal OR "order confirmation" OR bill OR statement';

    try {
        const listResponse = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
            return [];
        }

        const messages = listResponse.data.messages;

        const emailDetails = await Promise.all(messages.map(async (msg: any) => {
            const detailResponse = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const detail = detailResponse.data;
            const headers = detail.payload.headers;
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
            const from = headers.find((h: any) => h.name === 'From')?.value || '';
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';

            let body = '';
            if (detail.payload.parts) {
                const textPart = detail.payload.parts.find((p: any) => p.mimeType === 'text/plain');
                if (textPart && textPart.body.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                } else if (detail.payload.parts[0]?.body?.data) {
                    body = Buffer.from(detail.payload.parts[0].body.data, 'base64').toString('utf-8');
                }
            } else if (detail.payload.body?.data) {
                body = Buffer.from(detail.payload.body.data, 'base64').toString('utf-8');
            }

            const cleanBody = body.replace(/\s+/g, ' ').slice(0, 1000);
            return { subject, from, date, body: cleanBody };
        }));

        // Use AI to extract structured subscription data
        const model = getJsonModel();
        const prompt = `
            You are a subscription extraction assistant. I will provide you with a list of email summaries.
            
            TASKS:
            1. RECURRING PATTERN RECOGNITION: Analyze the sequence of emails. If you see multiple payments to the same sender (e.g., "Netflix" shows up in 3 emails over 3 months), definitively mark it as a subscription.
            2. FILTER: Ignore any subscription that appears to be CANCELLED or EXPIRED based on the email history provided. Only return currently active subscriptions.
            3. CURRENCY & CONVERSION: The target currency for this user is USD. Convert any other currency to USD using current approximate rates.
            4. PRICE RELIABILITY: If you find multiple emails for the same service, use the price from the MOST RECENT email. If price is missing in one but present in a previous one for the same service, use that.
            
            EXTRACT:
            - Name: The service name
            - Price: The numeric amount in USD (after conversion)
            - Currency: Always return "USD" after your conversion.
            - OriginalCurrency: The currency you found in the email.
            - Cycle: "Monthly" or "Yearly"
            - StartDate: Valid ISO date string of the first payment seen.
            - Category: "Streaming", "Software", "Cloud", "Gym", "Mobile", "Other"
            - Confidence: 1-10 (How sure are you this is a recurring subscription vs a one-time purchase)
            - EvidenceCount: Number of separate emails found for this service.
            
            Return ONLY a JSON array of objects.
            
            EMAILS:
            ${JSON.stringify(emailDetails, null, 2)}
        `;

        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        const extracted = JSON.parse(text);

        // Generate a unique ID for this scan
        const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Map the results to their database-friendly structure (but don't save yet)
        const candidates = extracted.map((item: any) => {
            const price = parseFloat(String(item.Price || 0));
            const originalCurrency = item.OriginalCurrency || 'USD';
            let notes = item.Notes || '';
            if (originalCurrency !== 'USD') {
                notes = `[AI CONVERTED] Original price was in ${originalCurrency}. ${notes}`.trim();
            }

            return {
                name: item.Name,
                price: isNaN(price) ? 0 : price,
                currency: 'USD',
                cycle: item.Cycle || 'Monthly',
                startDate: item.StartDate || new Date().toISOString(),
                category: item.Category || 'Other',
                notes,
                confidence: item.Confidence || 5,
                evidenceCount: item.EvidenceCount || 1,
                active: true
            };
        });

        // Filter out candidates with very low confidence or duplicate names within the same scan
        const uniqueCandidates = candidates.filter((item: any, index: number, self: any[]) =>
            index === self.findIndex((t) => t.name === item.name)
        );

        // Store in DB for 10 minutes (TTL index on ScanResult.createdAt handles expiry)
        await ScanResult.create({ scanId, userId, candidates: uniqueCandidates });

        return { scanId, candidates: uniqueCandidates };
    } catch (error: any) {
        if (error.response?.status === 403 || error.response?.status === 401) {
            throw new Error('REAUTH_GMAIL');
        }
        console.error('Error scanning Gmail:', error.response?.data || error.message);
        throw new Error('Failed to scan emails');
    }
};
