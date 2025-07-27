
import { MAKE_WEBHOOK_URL, MAKE_WEBHOOK_AUTH_TOKEN } from '../constants';
import type { WebhookPayload } from '../types';

/**
 * Sends a structured payload to the Make.com webhook.
 * @param payload The data to be sent to the webhook.
 * @returns A promise that resolves when the request is complete.
 */
export const sendToMakeWebhook = async (payload: WebhookPayload): Promise<void> => {
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Per Make.com documentation, the API key should be sent in this custom header.
                'x-make-apikey': MAKE_WEBHOOK_AUTH_TOKEN,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // Provide a specific, helpful error for 401 Unauthorized.
            if (response.status === 401) {
                throw new Error('Webhook request failed (401 Unauthorized). The provided token in the `x-make-apikey` header is incorrect or has been rejected. Please verify your webhook credentials in Make.com.');
            }
            // Generic error for other non-2xx statuses.
            const responseText = await response.text();
            throw new Error(`Webhook request failed with status ${response.status}: ${responseText}`);
        }

        console.log(`Successfully sent data to webhook for headline: "${payload.headline}"`);

    } catch (error) {
        console.error('Error sending to Make webhook:', error);
        // Re-throw to be caught by the main task handler in App.tsx
        throw error;
    }
};