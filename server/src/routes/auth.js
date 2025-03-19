const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Token, Activity, Segment, UserProfile } = require('../models');

// Load Strava configuration
const STRAVA_CONFIG = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    redirect_uri: process.env.REDIRECT_URI
};

// Authorization endpoint
router.get('/authorize', async (req, res) => {
    try {
        // First check if we already have a valid token
        const token = await Token.findOne();
        
        if (token) {
            // Check if token is still valid
            const now = Math.floor(Date.now() / 1000);
            if (token.expires_at > now) {
                // Token is still valid, redirect to dashboard
                return res.json({ redirect_url: 'http://localhost:3000/dashboard' });
            }
            
            // Token exists but expired, try to refresh it
            try {
                const response = await axios.post('https://www.strava.com/oauth/token', {
                    client_id: STRAVA_CONFIG.client_id,
                    client_secret: STRAVA_CONFIG.client_secret,
                    refresh_token: token.refresh_token,
                    grant_type: 'refresh_token'
                });
                
                const newToken = response.data;
                await Token.findOneAndUpdate(
                    {},
                    {
                        access_token: newToken.access_token,
                        refresh_token: newToken.refresh_token,
                        expires_at: newToken.expires_at
                    },
                    { upsert: true }
                );
                
                // Token refreshed successfully, redirect to dashboard
                return res.json({ redirect_url: 'http://localhost:3000/dashboard' });
            } catch (refreshError) {
                // If refresh fails, we'll proceed with new authorization
                console.error('Token refresh failed:', refreshError);
            }
        }
        
        // If we get here, we need a new authorization
        const { force } = req.query;
        const approvalPrompt = force === 'true' ? 'force' : 'auto';
        
        // Build the authorization URL with the prompt=select_account parameter
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CONFIG.client_id}&response_type=code&redirect_uri=${STRAVA_CONFIG.redirect_uri}&approval_prompt=${approvalPrompt}&scope=read,activity:read_all,profile:read_all&prompt=select_account`;
        
        console.log('Authorization URL:', authUrl.replace(STRAVA_CONFIG.client_id, 'HIDDEN'));
        res.json({ auth_url: authUrl });
    } catch (error) {
        console.error('Error in authorization process:', error);
        res.status(500).json({ error: 'Failed to process authorization' });
    }
});

// Check authentication endpoint
router.get('/check-auth', async (req, res) => {
    try {
        const token = await Token.findOne();
        if (!token) {
            return res.json({ isAuthenticated: false });
        }

        // Check if token is expired
        if (token.expires_at < Math.floor(Date.now() / 1000)) {
            try {
                // Try to refresh the token
                console.log('Token expired, attempting to refresh...');
                const response = await axios.post('https://www.strava.com/oauth/token', {
                    client_id: STRAVA_CONFIG.client_id,
                    client_secret: STRAVA_CONFIG.client_secret,
                    refresh_token: token.refresh_token,
                    grant_type: 'refresh_token'
                });
                
                const newToken = response.data;
                await Token.findOneAndUpdate(
                    {},
                    {
                        access_token: newToken.access_token,
                        refresh_token: newToken.refresh_token,
                        expires_at: newToken.expires_at
                    },
                    { upsert: true }
                );
                
                console.log('Token refreshed successfully');
                return res.json({ isAuthenticated: true });
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // Log the complete error response
                if (refreshError.response) {
                    console.error('Error response from Strava:');
                    console.error('Status:', refreshError.response.status);
                    console.error('Headers:', refreshError.response.headers);
                    console.error('Data:', JSON.stringify(refreshError.response.data, null, 2));
                }
                return res.json({ isAuthenticated: false });
            }
        }
        
        // Token is valid
        res.json({ isAuthenticated: true });
    } catch (error) {
        console.error('Error checking authentication:', error);
        res.status(500).json({ error: 'Error checking authentication' });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        await Token.deleteOne({});
        // Return success with a flag indicating the client should force account selection on next login
        res.json({ 
            success: true, 
            force_account_selection: true 
        });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Error logging out' });
    }
});

// Deauthorize endpoint - completely removes access from Strava
router.post('/deauthorize', async (req, res) => {
    try {
        // First get the token
        const token = await Token.findOne();
        if (!token) {
            return res.status(404).json({ error: 'No token found to deauthorize' });
        }

        console.log('Deauthorizing application from Strava...');
        
        // Get the athlete ID before deauthorizing
        let athleteId;
        try {
            const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
                headers: { Authorization: `Bearer ${token.access_token}` }
            });
            athleteId = athleteResponse.data.id.toString();
            console.log(`Deauthorizing athlete ID: ${athleteId}`);
        } catch (error) {
            console.error('Error retrieving athlete ID:', error);
        }
        
        // Call Strava deauthorization API
        await axios.post('https://www.strava.com/oauth/deauthorize', null, {
            headers: { 
                'Authorization': `Bearer ${token.access_token}` 
            }
        });
        
        // Remove the token from our database
        await Token.deleteOne({});
        
        // Don't delete any user data - just remove authentication
        
        console.log('Successfully deauthorized from Strava');
        res.json({ success: true, message: 'Successfully deauthorized from Strava' });
    } catch (error) {
        console.error('Error deauthorizing from Strava:', error);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        res.status(500).json({ error: 'Error deauthorizing from Strava' });
    }
});

// OAuth callback endpoint
router.get('/oauth/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error('Error in OAuth callback:', error);
        return res.redirect(`http://localhost:3000?error=strava_auth_error&message=${error}`);
    }

    if (!code) {
        console.error('No authorization code provided');
        return res.redirect('http://localhost:3000?error=no_auth_code&message=No authorization code was provided');
    }

    try {
        // Exchange code for token
        console.log('Attempting to exchange code for token with Strava...');
        console.log(`Using client_id: ${STRAVA_CONFIG.client_id}`);
        console.log(`Using redirect_uri: ${STRAVA_CONFIG.redirect_uri}`);
        
        const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CONFIG.client_id,
            client_secret: STRAVA_CONFIG.client_secret,
            code,
            grant_type: 'authorization_code'
        });

        const tokenData = tokenResponse.data;
        console.log('Token obtained successfully');

        // Fetch athlete data
        const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const athleteData = athleteResponse.data;
        const athleteId = athleteData.id.toString();
        console.log(`Retrieved athlete info for ${athleteData.firstname} ${athleteData.lastname} (ID: ${athleteId})`);

        // Save token to MongoDB with athlete_id
        await Token.findOneAndUpdate(
            {},
            {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_at,
                athlete_id: athleteId // Store athlete ID with token
            },
            { upsert: true }
        );

        // Create or update user profile with basic information from Strava
        await UserProfile.findOneAndUpdate(
            { strava_id: athleteId },
            {
                strava_id: athleteId,
                firstname: athleteData.firstname, 
                lastname: athleteData.lastname,
                profile_image: athleteData.profile,
                // Add other fields from the athlete response if available
                weight: athleteData.weight,
                // Only set if not already set (to avoid overwriting user-defined values)
                $setOnInsert: {
                    resting_heart_rate: 60, // Default value
                    max_heart_rate: 220 - (athleteData.age || 30), // Estimated from age or default
                    preferred_units: athleteData.measurement_preference || 'metric'
                }
            },
            { upsert: true, new: true }
        );

        // Fetch activities
        const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            params: { per_page: 100 }
        });

        const activities = activitiesResponse.data;
        console.log(`Fetched ${activities.length} activities for athlete ${athleteId}`);

        // Process and save activities - add athlete_id to each activity
        await Promise.all(
            activities.map(activity => 
                Activity.findOneAndUpdate(
                    { strava_id: activity.id.toString() },
                    {
                        strava_id: activity.id.toString(),
                        athlete_id: athleteId, // Store athlete ID with activity
                        name: activity.name,
                        type: activity.type,
                        start_date: activity.start_date,
                        distance: activity.distance,
                        moving_time: activity.moving_time,
                        total_elevation_gain: activity.total_elevation_gain,
                        start_latlng: activity.start_latlng,
                        end_latlng: activity.end_latlng,
                        map: activity.map,
                        // Save additional fields including heart rate data
                        average_heartrate: activity.average_heartrate,
                        max_heartrate: activity.max_heartrate,
                        average_speed: activity.average_speed,
                        max_speed: activity.max_speed,
                        average_watts: activity.average_watts,
                        kilojoules: activity.kilojoules,
                        suffer_score: activity.suffer_score
                    },
                    { upsert: true, new: true }
                )
            )
        );

        // Fetch segments from recent activities
        const allSegments = [];
        for (const activity of activities.slice(0, 10)) {
            try {
                const detailResponse = await axios.get(
                    `https://www.strava.com/api/v3/activities/${activity.id}`,
                    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
                );

                if (detailResponse.data.segment_efforts) {
                    detailResponse.data.segment_efforts.forEach(effort => {
                        if (effort.segment) {
                            // Add athlete_id to the segment object
                            effort.segment.athlete_id = athleteId;
                            allSegments.push(effort.segment);
                        }
                    });
                }
            } catch (error) {
                console.error(`Error fetching segments for activity ${activity.id}:`, error);
            }
        }

        // Save segments
        await Promise.all(
            allSegments.map(segment =>
                Segment.findOneAndUpdate(
                    { strava_id: segment.id.toString() },
                    {
                        strava_id: segment.id.toString(),
                        athlete_id: athleteId, // Store athlete ID with segment
                        name: segment.name,
                        activity_type: segment.activity_type,
                        distance: segment.distance,
                        average_grade: segment.average_grade,
                        maximum_grade: segment.maximum_grade,
                        elevation_high: segment.elevation_high,
                        elevation_low: segment.elevation_low,
                        start_latlng: segment.start_latlng,
                        end_latlng: segment.end_latlng,
                        points: segment.points
                    },
                    { upsert: true }
                )
            )
        );

        // Redirect to the main application with success status
        return res.redirect('http://localhost:3000?auth=success');
    } catch (error) {
        console.error('Error in OAuth callback:', error);
        // Log the complete error response
        if (error.response) {
            console.error('Error response from Strava:');
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
        res.redirect(`http://localhost:3000?error=server_error&message=${error.message}`);
    }
});

// Get access token endpoint
router.get('/get-access-token', async (req, res) => {
    try {
        const { access_token } = req.query;
        if (access_token) {
            return res.json({ access_token });
        }

        const token = await Token.findOne();
        if (!token) {
            const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CONFIG.client_id}&response_type=code&redirect_uri=${STRAVA_CONFIG.redirect_uri}&approval_prompt=force&scope=read,activity:read_all`;
            return res.status(401).json({
                error: 'No access token available',
                auth_url: authUrl
            });
        }

        if (token.expires_at < Date.now() / 1000) {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: STRAVA_CONFIG.client_id,
                client_secret: STRAVA_CONFIG.client_secret,
                refresh_token: token.refresh_token,
                grant_type: 'refresh_token'
            });

            const newToken = response.data;
            await Token.findOneAndUpdate(
                {},
                {
                    access_token: newToken.access_token,
                    refresh_token: newToken.refresh_token,
                    expires_at: newToken.expires_at
                },
                { upsert: true }
            );

            return res.json({ access_token: newToken.access_token });
        }

        res.json({ access_token: token.access_token });
    } catch (error) {
        console.error('Error getting access token:', error);
        res.status(500).json({ error: 'Error getting access token' });
    }
});

// Add a diagnostic endpoint to test Strava API connectivity
router.get('/test-strava-api', async (req, res) => {
    try {
        // Get the current configuration
        const config = {
            client_id: STRAVA_CONFIG.client_id,
            client_secret: '****' + STRAVA_CONFIG.client_secret.substring(4), // Partially masked for security
            redirect_uri: STRAVA_CONFIG.redirect_uri
        };
        
        // Check if we have a token in the database
        const token = await Token.findOne();
        let tokenStatus = 'No token found in database';
        
        if (token) {
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = token.expires_at - now;
            
            tokenStatus = {
                exists: true,
                expired: expiresIn <= 0,
                expires_in: expiresIn,
                expires_at_date: new Date(token.expires_at * 1000).toISOString()
            };
            
            // If we have a valid token, try to make a simple API call
            if (expiresIn > 0) {
                try {
                    const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
                        headers: { Authorization: `Bearer ${token.access_token}` }
                    });
                    
                    return res.json({
                        status: 'success',
                        message: 'Successfully connected to Strava API',
                        config,
                        tokenStatus,
                        athlete: {
                            id: athleteResponse.data.id,
                            username: athleteResponse.data.username,
                            firstname: athleteResponse.data.firstname,
                            lastname: athleteResponse.data.lastname
                        }
                    });
                } catch (apiError) {
                    return res.json({
                        status: 'error',
                        message: 'Failed to connect to Strava API with existing token',
                        config,
                        tokenStatus,
                        error: apiError.message,
                        response: apiError.response ? {
                            status: apiError.response.status,
                            data: apiError.response.data
                        } : null
                    });
                }
            }
        }
        
        // If we don't have a valid token, return the configuration
        return res.json({
            status: 'not_authenticated',
            message: 'No valid token available to test Strava API',
            config,
            tokenStatus,
            auth_url: `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CONFIG.client_id}&response_type=code&redirect_uri=${STRAVA_CONFIG.redirect_uri}&approval_prompt=force&scope=read,activity:read_all,profile:read_all`
        });
    } catch (error) {
        console.error('Error testing Strava API:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error testing Strava API',
            error: error.message
        });
    }
});

// Get user profile
router.get('/get-user-profile', async (req, res) => {
    try {
        // Get the current token
        const token = await Token.findOne();
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated with Strava' });
        }

        // Get the athlete data to find the user profile
        const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${token.access_token}` }
        });

        const athleteId = athleteResponse.data.id.toString();
        
        // Find the user profile
        let userProfile = await UserProfile.findOne({ strava_id: athleteId });
        
        // If the profile doesn't exist, create a default one
        if (!userProfile) {
            console.log('No existing profile found, creating default profile for', athleteId);
            
            const newProfile = new UserProfile({
                strava_id: athleteId,
                firstname: athleteResponse.data.firstname,
                lastname: athleteResponse.data.lastname,
                profile_image: athleteResponse.data.profile,
                resting_heart_rate: 60,
                max_heart_rate: 180,
                weight: athleteResponse.data.weight || 70,
                height: 175,
                age: 30,
                gender: athleteResponse.data.sex || 'male',
                ftp: 200,
                preferred_units: 'metric',
                zones: {
                    heart_rate: {
                        zone1: { min: 60, max: 110 },
                        zone2: { min: 111, max: 130 },
                        zone3: { min: 131, max: 150 },
                        zone4: { min: 151, max: 170 },
                        zone5: { min: 171, max: 180 }
                    },
                    power: {
                        zone1: { min: 0, max: 110 },
                        zone2: { min: 111, max: 150 },
                        zone3: { min: 151, max: 180 },
                        zone4: { min: 181, max: 210 },
                        zone5: { min: 211, max: 240 },
                        zone6: { min: 241, max: 300 },
                        zone7: { min: 301, max: 400 }
                    }
                }
            });
            
            userProfile = await newProfile.save();
            console.log('Default profile created for user', athleteId);
        }
        
        res.json({ userProfile });
    } catch (error) {
        console.error('Error retrieving user profile:', error);
        if (error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
        }
        res.status(500).json({ error: 'Error retrieving user profile' });
    }
});

// Update user profile
router.post('/update-user-profile', async (req, res) => {
    try {
        console.log('Profile update request received:', req.body);
        
        // Get the current token
        const token = await Token.findOne();
        if (!token) {
            console.log('No token found, returning 401');
            return res.status(401).json({ error: 'Not authenticated with Strava' });
        }

        // Get the athlete data to find the user profile
        console.log('Getting athlete data with token...');
        const athleteResponse = await axios.get('https://www.strava.com/api/v3/athlete', {
            headers: { Authorization: `Bearer ${token.access_token}` }
        });

        const athleteId = athleteResponse.data.id.toString();
        console.log('Athlete ID retrieved:', athleteId);
        
        // Update fields from request body
        const {
            resting_heart_rate,
            max_heart_rate,
            weight,
            height,
            age,
            gender,
            ftp,
            zones,
            preferred_units,
            display_preferences
        } = req.body;
        
        // Create the update object with only provided fields
        // Don't include fields that are null, undefined, or invalid numbers
        const updateData = {};
        
        if (resting_heart_rate !== undefined && resting_heart_rate !== null && !isNaN(parseFloat(resting_heart_rate))) {
            updateData.resting_heart_rate = parseFloat(resting_heart_rate);
        }
        
        if (max_heart_rate !== undefined && max_heart_rate !== null && !isNaN(parseFloat(max_heart_rate))) {
            updateData.max_heart_rate = parseFloat(max_heart_rate);
        }
        
        if (weight !== undefined && weight !== null && !isNaN(parseFloat(weight))) {
            updateData.weight = parseFloat(weight);
        }
        
        if (height !== undefined && height !== null && !isNaN(parseFloat(height))) {
            updateData.height = parseFloat(height);
        }
        
        if (age !== undefined && age !== null && !isNaN(parseInt(age))) {
            updateData.age = parseInt(age);
        }
        
        if (gender !== undefined && gender !== null && ['male', 'female', 'other'].includes(gender)) {
            updateData.gender = gender;
        }
        
        if (ftp !== undefined && ftp !== null && !isNaN(parseFloat(ftp))) {
            updateData.ftp = parseFloat(ftp);
        }
        
        if (zones !== undefined && zones !== null && typeof zones === 'object') {
            updateData.zones = zones;
        }
        
        if (preferred_units !== undefined && preferred_units !== null && ['metric', 'imperial'].includes(preferred_units)) {
            updateData.preferred_units = preferred_units;
        }
        
        if (display_preferences !== undefined && display_preferences !== null && typeof display_preferences === 'object') {
            updateData.display_preferences = display_preferences;
        }
        
        console.log('Updating user profile with validated data:', updateData);
        
        // Check if a user profile exists for this athlete
        const existingProfile = await UserProfile.findOne({ strava_id: athleteId });
        if (!existingProfile) {
            console.log('No existing profile found, creating new profile');
            
            // Create a new profile with all fields from req.body
            const newProfile = new UserProfile({
                strava_id: athleteId,
                firstname: athleteResponse.data.firstname,
                lastname: athleteResponse.data.lastname,
                profile_image: athleteResponse.data.profile,
                ...updateData
            });
            
            try {
                const savedProfile = await newProfile.save();
                console.log('New profile created and saved:', savedProfile.strava_id);
                return res.json({ userProfile: savedProfile });
            } catch (saveErr) {
                console.error('Error saving new profile:', saveErr);
                if (saveErr.name === 'ValidationError') {
                    return res.status(400).json({ 
                        error: 'Validation error', 
                        details: Object.keys(saveErr.errors).reduce((acc, key) => {
                            acc[key] = saveErr.errors[key].message;
                            return acc;
                        }, {})
                    });
                }
                throw saveErr;
            }
        }
        
        // Update the existing profile
        console.log('Existing profile found, updating...');
        
        try {
            const updatedProfile = await UserProfile.findOneAndUpdate(
                { strava_id: athleteId },
                updateData,
                { new: true, runValidators: true }
            );
            
            if (!updatedProfile) {
                console.log('Update failed, profile not found after update');
                return res.status(404).json({ error: 'User profile not found' });
            }
            
            console.log('Profile successfully updated for user:', updatedProfile.strava_id);
            res.json({ userProfile: updatedProfile });
        } catch (updateErr) {
            console.error('Error updating profile:', updateErr);
            if (updateErr.name === 'ValidationError') {
                return res.status(400).json({ 
                    error: 'Validation error', 
                    details: Object.keys(updateErr.errors).reduce((acc, key) => {
                        acc[key] = updateErr.errors[key].message;
                        return acc;
                    }, {})
                });
            }
            throw updateErr;
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        // Add more detailed error logging
        if (error.response) {
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
        }
        res.status(500).json({ error: 'Error updating user profile' });
    }
});

module.exports = router; 