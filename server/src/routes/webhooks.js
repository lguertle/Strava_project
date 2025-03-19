const express = require('express');
const router = express.Router();
const { Activity, Token } = require('../models');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Your verification token (should be stored in environment variables)
const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'your_verification_token';

// Webhook verification endpoint - this handles Strava's initial verification request
router.get('/webhook', (req, res) => {
    // Get the parameters from the request
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification request received');
    console.log('Full request query:', req.query);
    console.log('Mode:', mode);
    console.log('Token:', token);
    console.log('Challenge:', challenge);
    console.log('VERIFY_TOKEN from env:', VERIFY_TOKEN);

    // Verify the mode and token
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        // Respond with the challenge to complete verification
        console.log('Webhook verified successfully');
        console.log('Responding with challenge:', { 'hub.challenge': challenge });
        res.json({ 'hub.challenge': challenge });
    } else {
        // If the verification fails, return a 403 Forbidden status
        console.error('\n==== WEBHOOK VERIFICATION FAILED ====');
        console.error(`Received mode: "${mode}" - Expected: "subscribe"`);
        console.error(`Received token: "${token}" - Expected: "${VERIFY_TOKEN}"`);
        console.error(`Challenge: ${challenge}`);
        console.error('========================================\n');
        console.error('Mode match:', mode === 'subscribe');
        console.error('Token match:', token === VERIFY_TOKEN);
        res.sendStatus(403);
    }
});

// Webhook event handler endpoint - this receives the actual webhook events from Strava
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;
    console.log('\n==== WEBHOOK EVENT RECEIVED ====');
    console.log(`Event Type: ${event.object_type} - ${event.aspect_type}`);
    console.log(`Object ID: ${event.object_id}`);
    console.log(`Timestamp: ${new Date(event.event_time * 1000).toISOString()}`);
    console.log(`Full Event: ${JSON.stringify(event, null, 2)}`);
    console.log('================================\n');
        console.log('Webhook event received:', event);

        // Respond to Strava immediately to acknowledge receipt
        // This should happen as quickly as possible to prevent timeouts
        res.status(200).send('EVENT_RECEIVED');

        // Now process the event asynchronously
        await processWebhookEvent(event);
    } catch (error) {
        console.error('Error processing webhook event:', error);
        // Still return 200 to Strava to acknowledge receipt
        // We don't want them to retry events that we've already received
        if (!res.headersSent) {
            res.status(200).send('EVENT_RECEIVED');
        }
    }
});

// Function to process webhook events
async function processWebhookEvent(event) {
    console.log('Processing webhook event:', event);
    console.log('\n==== PROCESSING WEBHOOK EVENT ====');
    
    // Get a valid token to make API calls
    let token;
    try {
        token = await Token.findOne();
        console.log('Token found:', token ? 'Yes' : 'No');
        
        if (!token) {
            console.error('No token available to process webhook event. Please ensure you have authorized with Strava and have a valid token in the database.');
            return;
        }
        
        // Log token details (without exposing sensitive info)
        console.log('Using token for athlete ID:', token.athlete_id);
        console.log('Access token (first 10 chars):', token.access_token.substring(0, 10) + '...');
        console.log('Token expires at:', new Date(token.expires_at * 1000).toISOString());
        
        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (token.expires_at < now) {
            console.error('Token is expired. Attempting to refresh...');
            // Add logic to refresh token here if needed
        }
    } catch (tokenError) {
        console.error('Error finding token in database:', tokenError);
        return;
    }

    try {
        switch (event.object_type) {
            case 'activity':
                await processActivityEvent(event, token);
                break;
            case 'athlete':
                await processAthleteEvent(event, token);
                break;
            default:
                console.log(`Unhandled webhook event object_type: ${event.object_type}`);
        }
    } catch (error) {
        console.error('Error processing webhook event details:', error);
    }
}

// Process activity events (created, updated, deleted)
async function processActivityEvent(event, token) {
    const activityId = event.object_id;
    console.log(`\n==== PROCESSING ACTIVITY EVENT ====`);
    console.log(`Activity ID: ${activityId}`);
    console.log(`Event Type: ${event.aspect_type}`);
    console.log(`Timestamp: ${new Date(event.event_time * 1000).toISOString()}`);
    console.log(`Using token for athlete: ${token.athlete_id}`);
    
    switch (event.aspect_type) {
        case 'create':
            console.log(`New activity created: ${activityId}`);
            await fetchAndStoreActivity(activityId, token);
            break;
        case 'update':
            console.log(`Activity updated: ${activityId}`);
            await fetchAndStoreActivity(activityId, token);
            break;
        case 'delete':
            console.log(`Activity deleted: ${activityId}`);
            // Remove the activity from the database
            await Activity.findOneAndDelete({ strava_id: activityId.toString() });
            break;
        default:
            console.log(`Unhandled activity event aspect_type: ${event.aspect_type}`);
    }
}

// Process athlete events (mainly deauthorization)
async function processAthleteEvent(event, token) {
    if (event.aspect_type === 'update' && event.updates && event.updates.authorized === 'false') {
        console.log(`Athlete ${event.object_id} has deauthorized the application`);
        // Handle deauthorization (e.g., clean up tokens)
        // This is important for complying with Strava's API terms
        await Token.deleteOne({ athlete_id: event.object_id.toString() });
    }
}

// Fetch and store activity data from Strava
async function fetchAndStoreActivity(activityId, token) {
    console.log(`Attempting to fetch activity ${activityId} from Strava`);
    
    try {
        console.log(`Using access token: ${token.access_token.substring(0, 5)}...`);
        
        // Fetch the activity details from Strava
        const response = await axios.get(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            { headers: { Authorization: `Bearer ${token.access_token}` } }
        );
        
        const activityData = response.data;
        console.log(`\n==== ACTIVITY FETCHED SUCCESSFULLY ====`);
        console.log(`Successfully fetched activity ${activityId} from Strava:`, {
            name: activityData.name,
            type: activityData.type,
            start_date: activityData.start_date,
            distance: activityData.distance
        });
        
        // Update or create the activity in the database
        const updatedActivity = await Activity.findOneAndUpdate(
            { strava_id: activityId.toString() },
            {
                strava_id: activityId.toString(),
                name: activityData.name,
                type: activityData.type,
                start_date: activityData.start_date,
                distance: activityData.distance,
                moving_time: activityData.moving_time,
                total_elevation_gain: activityData.total_elevation_gain,
                start_latlng: activityData.start_latlng,
                end_latlng: activityData.end_latlng,
                map: activityData.map,
                average_heartrate: activityData.average_heartrate,
                max_heartrate: activityData.max_heartrate,
                average_speed: activityData.average_speed,
                max_speed: activityData.max_speed,
                average_watts: activityData.average_watts,
                kilojoules: activityData.kilojoules,
                suffer_score: activityData.suffer_score
            },
            { upsert: true, new: true }
        );
        
        console.log(`Activity ${activityId} successfully saved/updated to database with ID ${updatedActivity._id}`);
        return updatedActivity;
    } catch (error) {
        console.error(`Error fetching activity ${activityId} from Strava:`, error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            
            // Handle specific error cases
            if (error.response.status === 401) {
                console.error('Authentication error. Token may be invalid or expired.');
            } else if (error.response.status === 403) {
                console.error('Authorization error. You may not have permission to access this activity.');
            } else if (error.response.status === 404) {
                console.error('Activity not found. It may have been deleted or is not accessible.');
            }
        }
        
        throw error; // Re-throw the error to be caught by the caller
    }
}

// Endpoint to manually subscribe to Strava webhooks
router.post('/subscribe', async (req, res) => {
    try {
        // Get client credentials
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ 
                error: 'Missing client credentials. Please ensure CLIENT_ID and CLIENT_SECRET are set in environment variables.'
            });
        }
        
        // Get callback URL from request or use default
        const callbackUrl = req.body.callback_url || `${req.protocol}://${req.get('host')}/webhook`;
        
        console.log(`Attempting to subscribe to Strava webhooks with callback URL: ${callbackUrl}`);
        
        // Make request to Strava API to create webhook subscription
        const response = await axios.post(
            'https://www.strava.com/api/v3/push_subscriptions',
            null,
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    callback_url: callbackUrl,
                    verify_token: VERIFY_TOKEN
                }
            }
        );
        
        console.log('Webhook subscription successful:', response.data);
        // Add created_at if it doesn't exist
        const subscription = {
            ...response.data,
            created_at: response.data.created_at || new Date().toISOString()
        };
        res.json(subscription);
    } catch (error) {
        console.error('Error subscribing to webhook:', error);
        res.status(500).json({
            error: 'Failed to subscribe to webhook',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint to view current webhook subscriptions
router.get('/subscriptions', async (req, res) => {
    try {
        // Get client credentials
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ 
                error: 'Missing client credentials. Please ensure CLIENT_ID and CLIENT_SECRET are set in environment variables.'
            });
        }
        
        // Get current subscriptions from Strava
        const response = await axios.get(
            'https://www.strava.com/api/v3/push_subscriptions',
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret
                }
            }
        );
        
        // Ensure we always return an array
        const subscriptions = Array.isArray(response.data) ? response.data : [];
        console.log('Webhook subscriptions retrieved:', subscriptions);
        res.json(subscriptions);
    } catch (error) {
        console.error('Error retrieving webhook subscriptions:', error);
        res.status(500).json({
            message: 'Failed to retrieve webhook subscriptions',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint to create a new webhook subscription
router.post('/create', async (req, res) => {
    try {
        // Get client credentials
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ 
                message: 'Missing client credentials. Please ensure CLIENT_ID and CLIENT_SECRET are set in environment variables.'
            });
        }
        
        // Get callback URL from request or use default
        const callbackUrl = req.body.callbackUrl || `${req.protocol}://${req.get('host')}/api/webhooks/webhook`;
        
        console.log(`Attempting to subscribe to Strava webhooks with callback URL: ${callbackUrl}`);
        
        // Make request to Strava API to create webhook subscription
        const response = await axios.post(
            'https://www.strava.com/api/v3/push_subscriptions',
            null,
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    callback_url: callbackUrl,
                    verify_token: VERIFY_TOKEN
                }
            }
        );
        
        console.log('Webhook subscription successful:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error subscribing to webhook:', error);
        res.status(500).json({
            message: 'Failed to create webhook subscription',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint to delete a webhook subscription
router.delete('/delete/:id', async (req, res) => {
    try {
        const subscriptionId = req.params.id;
        
        // Get client credentials
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(400).json({ 
                error: 'Missing client credentials. Please ensure CLIENT_ID and CLIENT_SECRET are set in environment variables.'
            });
        }
        
        // Delete the subscription
        await axios.delete(
            `https://www.strava.com/api/v3/push_subscriptions/${subscriptionId}`,
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret
                }
            }
        );
        
        res.json({
            success: true,
            message: `Subscription ${subscriptionId} deleted successfully`
        });
    } catch (error) {
        console.error(`Error deleting webhook subscription ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to delete webhook subscription',
            details: error.response ? error.response.data : error.message
        });
    }
});

// ADMIN API ENDPOINTS - These should be protected with proper authentication
// and not directly exposed to regular users

// Get webhook status - safe endpoint that doesn't expose sensitive information
router.get('/status', async (req, res) => {
    try {
        // Get client credentials from environment variables (not exposed to frontend)
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(500).json({ 
                status: 'error',
                message: 'Server configuration issue'
            });
        }
        
        // Get current subscriptions from Strava
        const response = await axios.get(
            'https://www.strava.com/api/v3/push_subscriptions',
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret
                }
            }
        );
        
        // Return only the necessary information, not the full subscription details
        const subscriptions = Array.isArray(response.data) ? response.data : [];
        const safeData = {
            status: 'active',
            webhookCount: subscriptions.length,
            isConfigured: subscriptions.length > 0,
            lastChecked: new Date().toISOString()
        };
        
        console.log('Webhook status checked:', safeData);
        res.json(safeData);
    } catch (error) {
        console.error('Error checking webhook status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check webhook status'
        });
    }
});

// Endpoint to initialize webhook subscription - should only be called by authorized admins
router.post('/initialize', async (req, res) => {
    try {
        // This should be protected with proper authentication
        // TODO: Add authentication middleware
        
        // Get client credentials from environment variables (not exposed to frontend)
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(500).json({ 
                status: 'error',
                message: 'Server configuration issue'
            });
        }
        
        // Check if webhook is already configured
        const existingResponse = await axios.get(
            'https://www.strava.com/api/v3/push_subscriptions',
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret
                }
            }
        );
        
        const existingSubscriptions = Array.isArray(existingResponse.data) ? existingResponse.data : [];
        
        if (existingSubscriptions.length > 0) {
            return res.json({
                status: 'success',
                message: 'Webhook already configured',
                isConfigured: true,
                subscriptions: existingSubscriptions
            });
        }
        
        // Generate the callback URL based on server configuration
        // Use the simplified format that worked in our standalone server
        const callbackUrl = `${process.env.SERVER_URL}/api/webhooks/webhook`;
        
        console.log(`Initializing Strava webhook with callback URL: ${callbackUrl}`);
        
        // Create the webhook subscription
        try {
            const response = await axios.post(
                'https://www.strava.com/api/v3/push_subscriptions',
                null,
                {
                    params: {
                        client_id: clientId,
                        client_secret: clientSecret,
                        callback_url: callbackUrl,
                        verify_token: VERIFY_TOKEN
                    }
                }
            );
            
            console.log('Webhook initialization successful:', response.data);
            res.json({
                status: 'success',
                message: 'Webhook successfully configured',
                isConfigured: true,
                subscription: response.data
            });
        } catch (apiError) {
            console.error('Strava API error:', apiError.response?.data || apiError.message);
            res.status(500).json({
                status: 'error',
                message: 'Failed to initialize webhook: ' + (apiError.response?.data?.message || apiError.response?.data?.errors || apiError.message),
                details: apiError.response?.data
            });
        }
    } catch (error) {
        console.error('Error initializing webhook:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to initialize webhook: ' + (error.response?.data?.message || error.message)
        });
    }
});

// Endpoint to reset webhook subscription - should only be called by authorized admins
router.post('/reset', async (req, res) => {
    try {
        // This should be protected with proper authentication
        // TODO: Add authentication middleware
        
        // Get client credentials from environment variables (not exposed to frontend)
        const clientId = process.env.CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            return res.status(500).json({ 
                status: 'error',
                message: 'Server configuration issue'
            });
        }
        
        // Get current subscriptions
        const existingResponse = await axios.get(
            'https://www.strava.com/api/v3/push_subscriptions',
            {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret
                }
            }
        );
        
        const existingSubscriptions = Array.isArray(existingResponse.data) ? existingResponse.data : [];
        
        // Delete all existing subscriptions
        for (const subscription of existingSubscriptions) {
            await axios.delete(
                `https://www.strava.com/api/v3/push_subscriptions/${subscription.id}`,
                {
                    params: {
                        client_id: clientId,
                        client_secret: clientSecret
                    }
                }
            );
            console.log(`Deleted webhook subscription ${subscription.id}`);
        }
        
        // Generate the callback URL based on server configuration
        // Use the simplified format that worked in our standalone server
        const callbackUrl = `${process.env.SERVER_URL}/api/webhooks/webhook`;
        
        console.log(`Resetting Strava webhook with callback URL: ${callbackUrl}`);
        
        // Create a new subscription
        try {
            const response = await axios.post(
                'https://www.strava.com/api/v3/push_subscriptions',
                null,
                {
                    params: {
                        client_id: clientId,
                        client_secret: clientSecret,
                        callback_url: callbackUrl,
                        verify_token: VERIFY_TOKEN
                    }
                }
            );
            
            console.log('Webhook reset successful:', response.data);
            res.json({
                status: 'success',
                message: 'Webhook successfully reset',
                isConfigured: true,
                subscription: response.data
            });
        } catch (apiError) {
            console.error('Strava API error:', apiError.response?.data || apiError.message);
            res.status(500).json({
                status: 'error',
                message: 'Failed to reset webhook: ' + (apiError.response?.data?.message || apiError.response?.data?.errors || apiError.message),
                details: apiError.response?.data
            });
        }
    } catch (error) {
        console.error('Error resetting webhook:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reset webhook: ' + (error.response?.data?.message || error.message)
        });
    }
});

// Add a simple test endpoint to verify that the webhook routes are working
router.get('/test', (req, res) => {
    res.json({
        status: 'success',
        message: 'Webhook routes are working correctly',
        environment: {
            verify_token: VERIFY_TOKEN,
            server_url: process.env.SERVER_URL,
            callback_url: `${process.env.SERVER_URL}/api/webhooks/webhook`
        }
    });
});

module.exports = router; 