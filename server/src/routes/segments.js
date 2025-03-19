const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Segment, Token, Activity } = require('../models');

// Rate limiting variables
const RATE_LIMIT_15_MIN = 100; // Strava's non-upload rate limit per 15 minutes
const RATE_LIMIT_DAILY = 1000; // Strava's non-upload rate limit per day
let requestCount15Min = 0;
let requestCountDaily = 0;
let lastReset15Min = Date.now();
let lastResetDaily = new Date().setUTCHours(0, 0, 0, 0);

// Reset counters at appropriate intervals
setInterval(() => {
    const now = Date.now();
    // Reset 15-minute counter every 15 minutes
    if (now - lastReset15Min >= 15 * 60 * 1000) {
        requestCount15Min = 0;
        lastReset15Min = now;
        console.log('15-minute rate limit counter reset');
    }
    
    // Reset daily counter at midnight UTC
    const midnightUTC = new Date().setUTCHours(0, 0, 0, 0);
    if (now >= midnightUTC && lastResetDaily < midnightUTC) {
        requestCountDaily = 0;
        lastResetDaily = midnightUTC;
        console.log('Daily rate limit counter reset');
    }
}, 60 * 1000); // Check every minute

// Rate limit check function
const checkRateLimit = () => {
    if (requestCount15Min >= RATE_LIMIT_15_MIN) {
        const resetTime = new Date(lastReset15Min + 15 * 60 * 1000);
        throw new Error(`15-minute rate limit reached. Try again after ${resetTime.toISOString()}`);
    }
    
    if (requestCountDaily >= RATE_LIMIT_DAILY) {
        const resetTime = new Date(lastResetDaily + 24 * 60 * 60 * 1000);
        throw new Error(`Daily rate limit reached. Try again after ${resetTime.toISOString()}`);
    }
    
    requestCount15Min++;
    requestCountDaily++;
};

// Helper function to make rate-limited API calls
const makeStravaApiCall = async (url, token, params = {}) => {
    try {
        checkRateLimit();
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            params
        });
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw error;
    }
};

// Get all segments
router.get('/get-segments', async (req, res) => {
    try {
        // Get current token to identify the authenticated athlete
        const token = await Token.findOne();
        if (!token || !token.athlete_id) {
            return res.status(401).json({ error: 'Not authenticated with Strava or missing athlete ID' });
        }

        // Filter segments by the authenticated athlete's ID
        const segments = await Segment.find({ athlete_id: token.athlete_id });
        console.log(`Fetched ${segments.length} segments for athlete ${token.athlete_id}`);
        
        res.json({ segments });
    } catch (error) {
        console.error('Error fetching segments:', error);
        res.status(500).json({ error: 'Failed to fetch segments' });
    }
});

// Get segment by ID
router.get('/get-segment/:id', async (req, res) => {
    try {
        // Get current token to identify the authenticated athlete
        const token = await Token.findOne();
        if (!token || !token.athlete_id) {
            return res.status(401).json({ error: 'Not authenticated with Strava or missing athlete ID' });
        }

        // Filter by both segment ID and the authenticated athlete's ID
        const segment = await Segment.findOne({ 
            strava_id: req.params.id,
            athlete_id: token.athlete_id
        });
        
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        res.json({ segment });
    } catch (error) {
        console.error(`Error fetching segment ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch segment' });
    }
});

// Get nearby segments
router.get('/get-nearby-segments', async (req, res) => {
    const { lat, lng, radius = 5, access_token } = req.query;
    
    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    try {
        // First try to get segments from our database
        let segments = await Segment.find({
            start_latlng: {
                $geoWithin: {
                    $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radius) / 6371] // radius in km, 6371 is Earth's radius in km
                }
            }
        }).limit(20);
        
        // If we don't have enough segments in our DB, fetch from Strava API
        if (segments.length < 5 && access_token) {
            console.log(`Found only ${segments.length} segments in DB, fetching more from Strava API...`);
            
            try {
                const response = await makeStravaApiCall(`https://www.strava.com/api/v3/segments/explore`, access_token, {
                        bounds: `${parseFloat(lat) - 0.05},${parseFloat(lng) - 0.05},${parseFloat(lat) + 0.05},${parseFloat(lng) + 0.05}`,
                        activity_type: 'riding'
                });
                
                const stravaSegments = response.segments;
                
                // Save new segments to our database
                if (stravaSegments && stravaSegments.length > 0) {
                    for (const segment of stravaSegments) {
                        await Segment.findOneAndUpdate(
                            { strava_id: segment.id.toString() },
                            {
                                strava_id: segment.id.toString(),
                                name: segment.name,
                                activity_type: segment.activity_type || 'Ride',
                                distance: segment.distance,
                                average_grade: segment.avg_grade,
                                maximum_grade: segment.maximum_grade,
                                elevation_high: segment.elevation_high,
                                elevation_low: segment.elevation_low,
                                start_latlng: segment.start_latlng,
                                end_latlng: segment.end_latlng,
                                points: segment.points
                            },
                            { upsert: true }
                        );
                    }
                    
                    // Get updated segments from DB
                    segments = await Segment.find({
                        start_latlng: {
                            $geoWithin: {
                                $centerSphere: [[parseFloat(lng), parseFloat(lat)], parseFloat(radius) / 6371]
                            }
                        }
                    }).limit(20);
                }
            } catch (stravaError) {
                console.error('Error fetching segments from Strava:', stravaError);
                // We'll continue with what we have in the DB
            }
        }
        
        res.json({ segments });
    } catch (error) {
        console.error('Error finding nearby segments:', error);
        res.status(500).json({ error: 'Failed to find nearby segments' });
    }
});

// Process a segment and optionally fetch its leaderboard
const processSegment = async (segment, accessToken, fetchLeaderboard = false) => {
    try {
        // Store segment in database
        const updatedSegment = await Segment.findOneAndUpdate(
            { strava_id: segment.id.toString() },
            {
                strava_id: segment.id.toString(),
                name: segment.name,
                activity_type: segment.activity_type,
                distance: segment.distance,
                average_grade: segment.average_grade,
                maximum_grade: segment.maximum_grade,
                elevation_high: segment.elevation_high,
                elevation_low: segment.elevation_low,
                start_latlng: segment.start_latlng,
                end_latlng: segment.end_latlng,
                points: segment.points,
                city: segment.city,
                state: segment.state,
                country: segment.country,
                climb_category: segment.climb_category,
                private: segment.private
            },
            { upsert: true, new: true }
        );
        
        // Leaderboard fetching has been removed as it's no longer supported by Strava API
        
        return updatedSegment;
    } catch (error) {
        console.error(`Error processing segment ${segment.id}:`, error);
        throw error;
    }
};

// NEW ENDPOINT: Get all segments from user's activities
router.get('/get-all-activity-segments', async (req, res) => {
    const { access_token, limit = 50, page = 1, fetch_leaderboards = 'false', disable_background = 'false' } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    try {
        // Get activities from database
        const activities = await Activity.find()
            .sort({ start_date: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));
        
        if (!activities || activities.length === 0) {
            return res.json({ 
                segments: [], 
                message: 'No activities found',
                total_segments: 0,
                total_activities: 0,
                processed_activities: 0,
                page: parseInt(page),
                has_more: false,
                background_processing: false
            });
        }
        
        // Get all segments from database first
        const dbSegments = await Segment.find();
        console.log(`Found ${dbSegments.length} segments in database`);
        
        // Prepare segments from database for immediate response
        const formattedDbSegments = dbSegments.map(segment => ({
            strava_id: segment.strava_id,
            name: segment.name,
            activity_type: segment.activity_type,
            distance: segment.distance,
            average_grade: segment.average_grade,
            maximum_grade: segment.maximum_grade,
            elevation_high: segment.elevation_high,
            elevation_low: segment.elevation_low,
            start_latlng: segment.start_latlng,
            end_latlng: segment.end_latlng,
            has_efforts: segment.user_efforts && segment.user_efforts.length > 0,
            has_efforts_cache: segment.user_efforts && segment.user_efforts.length > 0,
            efforts_updated_at: segment.efforts_updated_at,
            efforts_cached: segment.user_efforts && segment.user_efforts.length > 0
        }));
        
        // Remove duplicates based on strava_id
        const uniqueDbSegments = Array.from(
            new Map(formattedDbSegments.map(segment => [segment.strava_id, segment])).values()
        );
        
        // Determine if we should do background processing
        const enableBackgroundProcessing = disable_background !== 'true';
        
        // Send immediate response with database segments
        res.json({
            segments: uniqueDbSegments,
            total_segments: uniqueDbSegments.length,
            total_activities: activities.length,
            processed_activities: 0,
            page: parseInt(page),
            has_more: activities.length === parseInt(limit),
            background_processing: enableBackgroundProcessing
        });
        
        // Continue processing in the background only if enabled
        if (enableBackgroundProcessing) {
            (async () => {
                try {
                    // Track progress for client
                    let progress = 0;
                    const totalActivities = activities.length;
                    const processedActivities = [];
                    const activitySegmentMap = new Map(); // Map to track which activities have segments
                    
                    // Always fetch leaderboards when processing segments
                    // This change ensures we always get leaderboard data with segments
                    const shouldFetchLeaderboards = true; // Changed from fetch_leaderboards === 'true' to always be true
                    
                    // Process activities in batches to avoid rate limiting
                    for (const activity of activities) {
                        try {
                            // Check if we've already processed this activity
                            const activityId = activity.strava_id;
                            if (processedActivities.includes(activityId)) {
                                progress++;
                                continue;
                            }
                            
                            // Check if we need to fetch detailed activity data
                            // Only fetch if we don't have segments for this activity yet
                            if (!activitySegmentMap.has(activityId)) {
                                // Get detailed activity with segment efforts
                                const detailedActivity = await makeStravaApiCall(
                                    `https://www.strava.com/api/v3/activities/${activityId}`,
                                    access_token
                                );
                                
                                // Process segment efforts
                                if (detailedActivity.segment_efforts && detailedActivity.segment_efforts.length > 0) {
                                    for (const effort of detailedActivity.segment_efforts) {
                                        if (effort.segment) {
                                            // Process segment and potentially fetch leaderboard
                                            await processSegment(effort.segment, access_token, shouldFetchLeaderboards);
                                        }
                                    }
                                    
                                    // Mark that we have segments for this activity
                                    activitySegmentMap.set(activityId, true);
                                }
                            }
                            
                            // Mark activity as processed
                            processedActivities.push(activityId);
                            
                            // Update progress
                            progress++;
                            
                            // Add a small delay to avoid hitting rate limits too quickly
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error(`Error processing activity ${activity.strava_id}:`, error);
                            // Continue with next activity
                            progress++;
                        }
                    }
                    
                    console.log(`Background processing complete. Processed ${processedActivities.length} activities.`);
                } catch (error) {
                    console.error('Error in background processing:', error);
                }
            })();
        } else {
            console.log("Background processing disabled by client request");
        }
        
    } catch (error) {
        console.error('Error fetching activity segments:', error);
        res.status(500).json({ error: 'Failed to fetch activity segments' });
    }
});

// NEW ENDPOINT: Get segment efforts for a specific segment
router.get('/get-segment-efforts/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { access_token, per_page = 200, page = 1, force_refresh = 'false' } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    if (!segmentId) {
        return res.status(400).json({ error: 'Segment ID is required' });
    }
    
    try {
        // Find the segment in the database
        const segment = await Segment.findOne({ strava_id: segmentId });
        
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        const forceRefresh = force_refresh === 'true';
        
        // Check if we have user efforts stored for this segment (if it has user_efforts field)
        // Only use stored efforts if not forcing refresh
        if (segment.user_efforts && segment.user_efforts.length > 0 && !forceRefresh) {
            console.log(`Returning cached efforts for segment ${segmentId}`);
            return res.json({
                efforts: segment.user_efforts,
                from_cache: true,
                page: parseInt(page),
                per_page: parseInt(per_page),
                has_more: false
            });
        }
        
        // Get segment efforts from Strava API with maximum allowed per_page (200)
        const data = await makeStravaApiCall(
            `https://www.strava.com/api/v3/segments/${segmentId}/all_efforts`,
            access_token,
            {
                per_page: per_page,
                page: page
            }
        );
        
        // Store the user efforts in the segment
        if (data && data.length > 0) {
            await Segment.findOneAndUpdate(
                { strava_id: segmentId },
                { 
                    user_efforts: data,
                    efforts_updated_at: new Date()
                }
            );
            console.log(`Stored ${data.length} efforts for segment ${segmentId}`);
        }
        
        res.json({
            efforts: data,
            from_cache: false,
            page: parseInt(page),
            per_page: parseInt(per_page),
            has_more: data.length === parseInt(per_page)
        });
    } catch (error) {
        console.error(`Error fetching efforts for segment ${segmentId}:`, error);
        
        // If we have stored efforts, return them as fallback
        const segment = await Segment.findOne({ strava_id: segmentId });
        if (segment && segment.user_efforts && segment.user_efforts.length > 0) {
            console.log(`Returning fallback cached efforts for segment ${segmentId} due to API error`);
            return res.json({
                efforts: segment.user_efforts,
                from_cache: true,
                fallback: true,
                page: parseInt(page),
                per_page: parseInt(per_page),
                has_more: false
            });
        }
        
        res.status(500).json({ error: 'Failed to fetch segment efforts' });
    }
});

// NEW ENDPOINT: Get segments for a specific activity
router.get('/get-activity-segments/:activityId', async (req, res) => {
    const { activityId } = req.params;
    const { access_token } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    if (!activityId) {
        return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    try {
        // Get detailed activity with segment efforts
        const detailedActivity = await makeStravaApiCall(
            `https://www.strava.com/api/v3/activities/${activityId}`,
            access_token
        );
        
        const segments = [];
        
        // Process segment efforts
        if (detailedActivity.segment_efforts && detailedActivity.segment_efforts.length > 0) {
            for (const effort of detailedActivity.segment_efforts) {
                if (effort.segment) {
                    // Store segment in database
                    const segment = effort.segment;
                    await Segment.findOneAndUpdate(
                        { strava_id: segment.id.toString() },
                        {
                            strava_id: segment.id.toString(),
                            name: segment.name,
                            activity_type: segment.activity_type,
                            distance: segment.distance,
                            average_grade: segment.average_grade,
                            maximum_grade: segment.maximum_grade,
                            elevation_high: segment.elevation_high,
                            elevation_low: segment.elevation_low,
                            start_latlng: segment.start_latlng,
                            end_latlng: segment.end_latlng,
                            points: segment.points,
                            city: segment.city,
                            state: segment.state,
                            country: segment.country,
                            climb_category: segment.climb_category,
                            private: segment.private
                        },
                        { upsert: true }
                    );
                    
                    // Add to result
                    segments.push({
                        segment: {
                            id: segment.id,
                            name: segment.name,
                            activity_type: segment.activity_type,
                            distance: segment.distance,
                            average_grade: segment.average_grade,
                            maximum_grade: segment.maximum_grade,
                            elevation_high: segment.elevation_high,
                            elevation_low: segment.elevation_low,
                            start_latlng: segment.start_latlng,
                            end_latlng: segment.end_latlng,
                            city: segment.city,
                            state: segment.state,
                            country: segment.country,
                            climb_category: segment.climb_category
                        },
                        effort: {
                            id: effort.id,
                            elapsed_time: effort.elapsed_time,
                            start_date: effort.start_date,
                            start_date_local: effort.start_date_local,
                            distance: effort.distance,
                            average_watts: effort.average_watts,
                            device_watts: effort.device_watts,
                            average_heartrate: effort.average_heartrate,
                            max_heartrate: effort.max_heartrate,
                            pr_rank: effort.pr_rank,
                            kom_rank: effort.kom_rank,
                            achievements: effort.achievements
                        }
                    });
                }
            }
        }
        
        res.json({
            activity_id: activityId,
            activity_name: detailedActivity.name,
            segments: segments,
            total_segments: segments.length
        });
    } catch (error) {
        console.error(`Error fetching segments for activity ${activityId}:`, error);
        res.status(500).json({ error: 'Failed to fetch activity segments' });
    }
});

// NEW ENDPOINT: Force refresh segments from Strava API
router.get('/force-refresh-segments', async (req, res) => {
    const { access_token, limit = 20, page = 1 } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    try {
        // Get activities from database
        const activities = await Activity.find()
            .sort({ start_date: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));
        
        if (!activities || activities.length === 0) {
            return res.json({ 
                segments: [], 
                message: 'No activities found',
                total_segments: 0,
                total_activities: 0,
                processed_activities: 0,
                page: parseInt(page),
                has_more: false
            });
        }
        
        // Track progress for client
        let progress = 0;
        const totalActivities = activities.length;
        const allSegments = [];
        const processedActivities = [];
        
        console.log(`Force refreshing segments for ${activities.length} activities`);
        
        // Process activities in batches to avoid rate limiting
        for (const activity of activities) {
            try {
                // Check if we've already processed this activity
                const activityId = activity.strava_id;
                if (processedActivities.includes(activityId)) {
                    progress++;
                    continue;
                }
                
                // Get detailed activity with segment efforts
                const detailedActivity = await makeStravaApiCall(
                    `https://www.strava.com/api/v3/activities/${activityId}`,
                    access_token
                );
                
                // Process segment efforts
                if (detailedActivity.segment_efforts && detailedActivity.segment_efforts.length > 0) {
                    for (const effort of detailedActivity.segment_efforts) {
                        if (effort.segment) {
                            // Store segment in database
                            const segment = effort.segment;
                            await Segment.findOneAndUpdate(
                                { strava_id: segment.id.toString() },
                                {
                                    strava_id: segment.id.toString(),
                                    name: segment.name,
                                    activity_type: segment.activity_type,
                                    distance: segment.distance,
                                    average_grade: segment.average_grade,
                                    maximum_grade: segment.maximum_grade,
                                    elevation_high: segment.elevation_high,
                                    elevation_low: segment.elevation_low,
                                    start_latlng: segment.start_latlng,
                                    end_latlng: segment.end_latlng,
                                    points: segment.points,
                                    city: segment.city,
                                    state: segment.state,
                                    country: segment.country,
                                    climb_category: segment.climb_category,
                                    private: segment.private
                                },
                                { upsert: true, new: true }
                            );
                            
                            // Add to result if not already included
                            if (!allSegments.some(s => s.strava_id === segment.id.toString())) {
                                allSegments.push({
                                    strava_id: segment.id.toString(),
                                    name: segment.name,
                                    activity_type: segment.activity_type,
                                    distance: segment.distance,
                                    average_grade: segment.average_grade,
                                    effort: {
                                        elapsed_time: effort.elapsed_time,
                                        start_date: effort.start_date,
                                        activity_id: activityId
                                    }
                                });
                            }
                        }
                    }
                }
                
                // Mark activity as processed
                processedActivities.push(activityId);
                
                // Update progress
                progress++;
                
                // Add a small delay to avoid hitting rate limits too quickly
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error processing activity ${activity.strava_id}:`, error);
                // Continue with next activity
                progress++;
            }
        }
        
        // Get all segments from database after refresh
        const dbSegments = await Segment.find();
        
        // Remove duplicates based on strava_id
        const uniqueSegments = Array.from(
            new Map(allSegments.map(segment => [segment.strava_id, segment])).values()
        );
        
        console.log(`Force refresh complete. Found ${uniqueSegments.length} segments from API, total in DB: ${dbSegments.length}`);
        
        res.json({
            segments: uniqueSegments,
            total_segments: uniqueSegments.length,
            total_activities: totalActivities,
            processed_activities: processedActivities.length,
            page: parseInt(page),
            has_more: activities.length === parseInt(limit)
        });
    } catch (error) {
        console.error('Error force refreshing segments:', error);
        res.status(500).json({ error: 'Failed to force refresh segments' });
    }
});

// NEW ENDPOINT: Force refresh leaderboard for a specific segment
router.get('/force-refresh-leaderboard/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { access_token } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    if (!segmentId) {
        return res.status(400).json({ error: 'Segment ID is required' });
    }
    
    console.log(`Force refreshing leaderboard for segment ${segmentId}`);
    
    try {
        // Find the segment
        const segment = await Segment.findOne({ strava_id: segmentId });
        
        if (!segment) {
            console.warn(`Segment ${segmentId} not found in database`);
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        console.log(`Found segment ${segmentId} in database: ${segment.name}`);
        
        // Get segment leaderboard from Strava API
        console.log(`Directly fetching leaderboard from Strava API for segment ${segmentId}`);
        
        try {
            const data = await makeStravaApiCall(`https://www.strava.com/api/v3/segments/${segmentId}/leaderboard`, access_token, {
                per_page: 10
            });
            
            console.log(`Strava API returned leaderboard data for force refresh:`, JSON.stringify(data, null, 2));
            
            // Check if the data has the expected structure
            if (!data.entries) {
                console.error(`Strava API returned unexpected format for leaderboard data:`, data);
                return res.status(500).json({ 
                    error: 'Unexpected data format from Strava API',
                    data_received: data
                });
            }
            
            // Format the leaderboard entries
            const leaderboard = data.entries.map(entry => ({
                rank: entry.rank,
                athlete_name: entry.athlete_name,
                athlete_id: entry.athlete_id.toString(),
                elapsed_time: entry.elapsed_time,
                start_date: entry.start_date,
                effort_id: entry.effort_id.toString()
            }));
            
            // Update the segment in database with leaderboard data
            await Segment.findOneAndUpdate(
                { strava_id: segmentId },
                { 
                    leaderboard: leaderboard,
                    leaderboard_updated_at: new Date()
                }
            );
            
            console.log(`Updated leaderboard for segment ${segmentId} with ${leaderboard.length} entries`);
            
            return res.json({
                success: true,
                entries: leaderboard,
                segment: {
                    id: segment.strava_id,
                    name: segment.name
                }
            });
        } catch (apiError) {
            console.error(`Error calling Strava API for segment ${segmentId}:`, apiError);
            return res.status(500).json({ 
                error: 'Error calling Strava API',
                message: apiError.message
            });
        }
    } catch (error) {
        console.error(`General error in force-refresh-leaderboard for ${segmentId}:`, error);
        res.status(500).json({ error: 'Failed to force refresh leaderboard' });
    }
});

// Add this endpoint after your existing endpoints
// Endpoint to check for leaderboard data in the database
router.get('/check-leaderboard-data', async (req, res) => {
    try {
        // Find a few segments with leaderboard data
        const segmentsWithLeaderboard = await Segment.find({ 
            leaderboard: { $exists: true, $ne: [] } 
        }).limit(5);
        
        // Find total count of segments with leaderboard data
        const totalWithLeaderboard = await Segment.countDocuments({ 
            leaderboard: { $exists: true, $ne: [] } 
        });
        
        // Get total segment count
        const totalSegments = await Segment.countDocuments({});
        
        console.log(`Found ${totalWithLeaderboard} segments with leaderboard data out of ${totalSegments} total segments`);
        
        return res.json({
            total_segments: totalSegments,
            segments_with_leaderboard: totalWithLeaderboard,
            sample_segments: segmentsWithLeaderboard,
        });
    } catch (err) {
        console.error('Error checking leaderboard data:', err);
        return res.status(500).json({ error: 'Failed to check leaderboard data' });
    }
});

// Endpoint to reset a specific segment's leaderboard
router.post('/reset-segment/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { access_token } = req.body;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    try {
        // Reset the segment in the database
        const result = await Segment.findOneAndUpdate(
            { strava_id: segmentId },
            { 
                $unset: { 
                    user_efforts: "",
                    efforts_updated_at: ""
                }
            },
            { new: true }
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        return res.json({
            message: 'Segment reset successfully',
            segment: result
        });
    } catch (err) {
        console.error(`Error resetting segment ${segmentId}:`, err);
        return res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// Endpoint to reset all segments' leaderboard data
router.post('/reset-all-segments', async (req, res) => {
    const { access_token, confirm } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token required' });
    }
    
    if (confirm !== 'yes') {
        return res.status(400).json({ 
            error: 'Confirmation required. Add ?confirm=yes to your request to proceed. WARNING: This will clear all leaderboard data!'
        });
    }
    
    try {
        // Update all segments to clear leaderboard data
        const result = await Segment.updateMany(
            {},
            { 
                leaderboard: [],
                leaderboard_updated_at: null,
                has_leaderboard: false
            }
        );
        
        console.log(`Reset leaderboard data for ${result.modifiedCount} segments`);
        
        return res.json({
            message: `Reset ${result.modifiedCount} segments. You'll need to view each segment individually to reload its leaderboard data.`,
            result
        });
    } catch (err) {
        console.error('Error resetting all segments:', err);
        return res.status(500).json({ error: 'Failed to reset segments' });
    }
});

// Add a new endpoint for testing with just 10 segments
router.get('/get-test-segments', async (req, res) => {
    const { access_token, limit = 10 } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    try {
        console.log(`Getting up to ${limit} test segments for leaderboard testing`);
        
        // Find segments that have effort data (these are more likely to have leaderboards)
        const segments = await Segment.find()
            .sort({ _id: -1 }) // Get most recently added segments
            .limit(parseInt(limit));
        
        if (segments.length === 0) {
            return res.status(404).json({ error: 'No segments found. Please sync some activities first.' });
        }
        
        console.log(`Found ${segments.length} test segments`);
        
        return res.json({
            segments,
            count: segments.length,
            message: 'Use these segments for testing leaderboard functionality to preserve API quota'
        });
    } catch (error) {
        console.error('Error fetching test segments:', error);
        return res.status(500).json({ error: 'Failed to fetch test segments' });
    }
});

// Add an endpoint to fetch a leaderboard with optimized rate limiting
router.get('/test-segment-leaderboard/:segmentId', async (req, res) => {
    const { segmentId } = req.params;
    const { access_token, force_refresh } = req.query;
    
    if (!segmentId || !access_token) {
        return res.status(400).json({ error: 'Segment ID and access token are required' });
    }
    
    console.log(`Testing leaderboard for segment ${segmentId}, force_refresh=${force_refresh}`);
    
    try {
        // Check if already at rate limit before making the call
        if (requestCount15Min >= RATE_LIMIT_15_MIN - 1) {
            const resetTime = new Date(lastReset15Min + 15 * 60 * 1000);
            const timeToReset = Math.ceil((resetTime - new Date()) / 1000 / 60);
            
            return res.status(429).json({ 
                error: `Rate limit about to be reached. Try again in ${timeToReset} minutes.`,
                reset_time: resetTime
            });
        }
        
        // Find the segment in the database
        const segment = await Segment.findOne({ strava_id: segmentId });
        
        if (!segment) {
            return res.status(404).json({ error: 'Segment not found' });
        }
        
        // Check if we already have cached leaderboard data
        const hasLeaderboardData = segment.leaderboard && 
                                  segment.leaderboard.length > 0 && 
                                  segment.leaderboard_updated_at &&
                                  force_refresh !== 'true';
        
        if (hasLeaderboardData) {
            console.log(`Using cached leaderboard data for segment ${segmentId} (${segment.name})`);
            return res.json({
                entries: segment.leaderboard,
                from_cache: true,
                updated_at: segment.leaderboard_updated_at,
                segment: {
                    name: segment.name,
                    id: segment.strava_id
                }
            });
        }
        
        // Fetch fresh data from Strava API
        console.log(`Making Strava API call for segment ${segmentId} leaderboard`);
        
        try {
            const leaderboardData = await makeStravaApiCall(
                `https://www.strava.com/api/v3/segments/${segmentId}/leaderboard`,
                access_token,
                { per_page: 10 }
            );
            
            console.log(`Strava API response:`, leaderboardData.data);
            
            if (!leaderboardData.data || !leaderboardData.data.entries) {
                return res.status(500).json({ 
                    error: 'Invalid leaderboard data from Strava API',
                    api_response: leaderboardData.data
                });
            }
            
            // Format the entries
            const formattedEntries = leaderboardData.data.entries.map(entry => ({
                rank: entry.rank,
                athlete_name: entry.athlete_name,
                athlete_id: entry.athlete_id,
                elapsed_time: entry.elapsed_time,
                moving_time: entry.moving_time,
                start_date: entry.start_date,
                start_date_local: entry.start_date_local,
                effort_id: entry.effort_id
            }));
            
            // Update the segment in the database
            await Segment.findOneAndUpdate(
                { strava_id: segmentId },
                { 
                    leaderboard: formattedEntries,
                    leaderboard_updated_at: new Date(),
                    has_leaderboard: formattedEntries.length > 0
                }
            );
            
            return res.json({
                entries: formattedEntries,
                from_cache: false,
                api_response: leaderboardData.data,
                segment: {
                    name: segment.name,
                    id: segment.strava_id
                }
            });
        } catch (err) {
            console.error(`Error fetching leaderboard for segment ${segmentId}:`, err);
            
            // If we have existing data, return that instead
            if (segment.leaderboard && segment.leaderboard.length > 0) {
                return res.json({
                    entries: segment.leaderboard,
                    from_cache: true,
                    error: err.message || 'API error',
                    api_error: true,
                    segment: {
                        name: segment.name,
                        id: segment.strava_id
                    }
                });
            }
            
            return res.status(500).json({
                error: `Failed to fetch leaderboard: ${err.message || 'Unknown error'}`,
                api_error: true,
                segment: {
                    name: segment.name,
                    id: segment.strava_id
                }
            });
        }
    } catch (err) {
        console.error(`Error in test-segment-leaderboard for segment ${segmentId}:`, err);
        return res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// NEW ENDPOINT: Prefetch leaderboards for multiple segments
router.get('/prefetch-leaderboards', async (req, res) => {
    const { access_token, segment_ids, force_refresh = 'false' } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    if (!segment_ids) {
        return res.status(400).json({ error: 'segment_ids parameter is required' });
    }
    
    try {
        const segmentIdList = segment_ids.split(',').map(id => id.trim());
        console.log(`Prefetching leaderboards for ${segmentIdList.length} segments, force_refresh=${force_refresh}`);
        
        const results = {
            total: segmentIdList.length,
            fetched: 0,
            cached: 0,
            errors: 0,
            segments: []
        };
        
        // Find segments in database
        const segments = await Segment.find({ strava_id: { $in: segmentIdList } });
        
        // Process each segment
        for (const segment of segments) {
            try {
                const hasRecentLeaderboard = segment.leaderboard_updated_at && 
                    segment.leaderboard && 
                    segment.leaderboard.length > 0 && 
                    (new Date() - new Date(segment.leaderboard_updated_at)) < 7 * 24 * 60 * 60 * 1000;
                
                if (hasRecentLeaderboard && force_refresh !== 'true') {
                    console.log(`Using cached leaderboard for segment ${segment.strava_id}`);
                    results.cached++;
                    results.segments.push({
                        strava_id: segment.strava_id,
                        name: segment.name,
                        status: 'cached',
                        entries: segment.leaderboard.length,
                        leaderboard: segment.leaderboard // Include the actual leaderboard data
                    });
                    continue;
                }
                
                // Fetch leaderboard from Strava API
                console.log(`Fetching leaderboard for segment ${segment.strava_id}`);
                const leaderboardData = await makeStravaApiCall(
                    `https://www.strava.com/api/v3/segments/${segment.strava_id}/leaderboard`,
                    access_token,
                    { per_page: 10 }
                );
                
                if (leaderboardData && leaderboardData.entries) {
                    // Format the leaderboard entries
                    const leaderboard = leaderboardData.entries.map(entry => ({
                        rank: entry.rank,
                        athlete_name: entry.athlete_name,
                        athlete_id: entry.athlete_id.toString(),
                        elapsed_time: entry.elapsed_time,
                        start_date: entry.start_date,
                        effort_id: entry.effort_id.toString()
                    }));
                    
                    // Update the segment with leaderboard data
                    await Segment.findOneAndUpdate(
                        { strava_id: segment.strava_id },
                        { 
                            leaderboard: leaderboard,
                            leaderboard_updated_at: new Date(),
                            has_leaderboard: leaderboard.length > 0
                        }
                    );
                    
                    console.log(`Updated leaderboard for segment ${segment.strava_id} with ${leaderboard.length} entries`);
                    results.fetched++;
                    results.segments.push({
                        strava_id: segment.strava_id,
                        name: segment.name,
                        status: 'fetched',
                        entries: leaderboard.length,
                        leaderboard: leaderboard // Include the actual leaderboard data
                    });
                }
            } catch (error) {
                console.error(`Error prefetching leaderboard for segment ${segment.strava_id}:`, error);
                results.errors++;
                results.segments.push({
                    strava_id: segment.strava_id,
                    name: segment.name,
                    status: 'error',
                    error: error.message
                });
                
                // If we hit a rate limit, stop processing
                if (error.message.includes('Rate limit')) {
                    break;
                }
            }
        }
        
        res.json(results);
    } catch (error) {
        console.error('Error prefetching leaderboards:', error);
        res.status(500).json({ error: 'Failed to prefetch leaderboards' });
    }
});

// Add a new endpoint to get athlete information
router.get('/get-athlete-info', async (req, res) => {
    const { access_token } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    try {
        // Make API call to get athlete info
        const athleteData = await makeStravaApiCall(
            'https://www.strava.com/api/v3/athlete',
            access_token
        );
        
        // Log athlete info (excluding sensitive data)
        console.log(`Retrieved athlete info for ${athleteData.firstname} ${athleteData.lastname} (ID: ${athleteData.id})`);
        console.log(`Subscription status: ${athleteData.premium ? 'Premium' : 'Free'}`);
        
        // Return athlete info
        return res.json({
            athlete: {
                id: athleteData.id,
                firstname: athleteData.firstname,
                lastname: athleteData.lastname,
                profile: athleteData.profile,
                premium: athleteData.premium,
                subscription_type: athleteData.subscription_type,
                created_at: athleteData.created_at,
                updated_at: athleteData.updated_at
            }
        });
    } catch (err) {
        console.error('Error fetching athlete info:', err);
        
        // Check if this is an authentication error
        const isAuthError = err.response && (err.response.status === 401 || err.response.status === 403);
        
        return res.status(isAuthError ? 401 : 500).json({
            error: isAuthError 
                ? 'Authentication failed. Your access token may have expired.' 
                : `Failed to fetch athlete info: ${err.message}`
        });
    }
});

// Add a debug endpoint to test API token and leaderboard access
router.get('/debug-token', async (req, res) => {
    const { access_token, segment_id } = req.query;
    
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }
    
    const results = {
        token_status: null,
        athlete_info: null,
        leaderboard_test: null,
        raw_responses: {}
    };
    
    try {
        // Step 1: Test the token by getting athlete info
        console.log('Testing token with athlete info endpoint...');
        try {
            const athleteData = await makeStravaApiCall(
                'https://www.strava.com/api/v3/athlete',
                access_token
            );
            
            results.token_status = 'valid';
            results.athlete_info = {
                id: athleteData.id,
                name: `${athleteData.firstname} ${athleteData.lastname}`,
                premium: athleteData.premium,
                subscription_type: athleteData.subscription_type
            };
            
            console.log(`Token is valid for user ${athleteData.firstname} ${athleteData.lastname}`);
            console.log(`Premium status: ${athleteData.premium ? 'Yes' : 'No'}`);
            
            // Store raw response for debugging
            results.raw_responses.athlete = athleteData;
        } catch (err) {
            results.token_status = 'invalid';
            results.token_error = err.message;
            console.error('Token validation failed:', err);
            
            // Store error details
            results.raw_responses.athlete_error = {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data
            };
        }
        
        // Step 2: Test leaderboard access if a segment ID is provided
        if (segment_id && results.token_status === 'valid') {
            console.log(`Testing leaderboard access for segment ${segment_id}...`);
            try {
                // Make a direct API call to the leaderboard endpoint
                const leaderboardData = await makeStravaApiCall(
                    `https://www.strava.com/api/v3/segments/${segment_id}/leaderboard`,
                    access_token,
                    { per_page: 1 } // Just get one entry to minimize data transfer
                );
                
                results.leaderboard_test = 'success';
                results.leaderboard_info = {
                    entry_count: leaderboardData.entry_count,
                    has_entries: leaderboardData.entries && leaderboardData.entries.length > 0
                };
                
                console.log(`Leaderboard access successful. Found ${leaderboardData.entry_count} entries.`);
                
                // Store raw response for debugging
                results.raw_responses.leaderboard = leaderboardData;
            } catch (err) {
                results.leaderboard_test = 'failed';
                results.leaderboard_error = err.message;
                console.error('Leaderboard access failed:', err);
                
                // Store error details
                results.raw_responses.leaderboard_error = {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                };
                
                // Check for specific error types
                if (err.response?.status === 403) {
                    results.leaderboard_error_type = 'forbidden';
                    results.leaderboard_error_reason = 'This may be due to subscription requirements or privacy settings.';
                } else if (err.response?.status === 404) {
                    results.leaderboard_error_type = 'not_found';
                    results.leaderboard_error_reason = 'The segment may not exist or may be private.';
                } else if (err.response?.status === 429) {
                    results.leaderboard_error_type = 'rate_limit';
                    results.leaderboard_error_reason = 'You have exceeded the Strava API rate limits.';
                }
            }
        }
        
        // Return all results
        return res.json(results);
    } catch (err) {
        console.error('Debug token endpoint error:', err);
        return res.status(500).json({
            error: `Server error: ${err.message}`,
            results: results // Return partial results if available
        });
    }
});

module.exports = router; 