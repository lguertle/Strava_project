const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Activity, Token } = require('../models');

// Get all activities
router.get('/get-activities', async (req, res) => {
    try {
        // Get current token to identify the authenticated athlete
        const token = await Token.findOne();
        if (!token || !token.athlete_id) {
            return res.status(401).json({ error: 'Not authenticated with Strava or missing athlete ID' });
        }

        // Filter activities by the authenticated athlete's ID
        const activities = await Activity.find({ athlete_id: token.athlete_id })
            .sort({ start_date: -1 })
            .limit(20);
            
        console.log(`Fetched ${activities.length} activities for athlete ${token.athlete_id}`);
        res.json({ activities });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// Get activity by ID
router.get('/get-activity/:id', async (req, res) => {
    try {
        // Get current token to identify the authenticated athlete
        const token = await Token.findOne();
        if (!token || !token.athlete_id) {
            return res.status(401).json({ error: 'Not authenticated with Strava or missing athlete ID' });
        }

        // Filter by both activity ID and the authenticated athlete's ID
        const activity = await Activity.findOne({ 
            strava_id: req.params.id,
            athlete_id: token.athlete_id
        });
        
        if (!activity) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        
        res.json({ activity });
    } catch (error) {
        console.error(`Error fetching activity ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// Get detailed heart rate data for activities
router.get('/get-heart-rate-data', async (req, res) => {
    try {
        // Get the current token
        const token = await Token.findOne();
        if (!token || !token.athlete_id) {
            return res.status(401).json({ error: 'Not authenticated with Strava or missing athlete ID' });
        }

        // Get the most recent activities for the authenticated athlete
        const activities = await Activity.find({ athlete_id: token.athlete_id })
            .sort({ start_date: -1 })
            .limit(10);
        
        // Object to store heart rate data for each activity
        const heartRateData = {};
        
        // For each activity, fetch detailed heart rate data from Strava
        for (const activity of activities) {
            try {
                // Only proceed if activity has heart rate data
                if (activity.average_heartrate) {
                    console.log(`Fetching heart rate data for activity ${activity.strava_id}`);
                    
                    // Make API call to get activity streams (including heart rate)
                    const streamsResponse = await axios.get(
                        `https://www.strava.com/api/v3/activities/${activity.strava_id}/streams`,
                        {
                            headers: { Authorization: `Bearer ${token.access_token}` },
                            params: {
                                keys: 'heartrate,distance',
                                key_by_type: true
                            }
                        }
                    );
                    
                    // Extract heart rate and distance data
                    const streams = streamsResponse.data;
                    
                    if (streams && streams.heartrate && streams.distance) {
                        heartRateData[activity.strava_id] = {
                            data: streams.heartrate.data,
                            distance: streams.distance.data,
                            activityName: activity.name,
                            activityType: activity.type,
                            activityDate: activity.start_date
                        };
                    } else {
                        console.log(`No detailed heart rate data available for activity ${activity.strava_id}`);
                    }
                }
            } catch (error) {
                console.error(`Error fetching heart rate data for activity ${activity.strava_id}:`, error);
                // Continue with next activity even if one fails
            }
        }
        
        // Return the gathered heart rate data
        res.json(heartRateData);
    } catch (error) {
        console.error('Error fetching heart rate data:', error);
        res.status(500).json({ error: 'Failed to fetch heart rate data' });
    }
});

module.exports = router; 