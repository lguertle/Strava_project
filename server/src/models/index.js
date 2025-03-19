const mongoose = require('mongoose');

// Define schemas
const TokenSchema = new mongoose.Schema({
    access_token: String,
    refresh_token: String,
    expires_at: Number,
    athlete_id: String  // Add athlete_id to associate token with specific user
});

const ActivitySchema = new mongoose.Schema({
    strava_id: String,
    athlete_id: String, // Add athlete_id to associate activities with specific users
    name: String,
    type: String,
    start_date: Date,
    distance: Number,
    moving_time: Number,
    total_elevation_gain: Number,
    start_latlng: [Number],
    end_latlng: [Number],
    map: {
        summary_polyline: String
    },
    // Add heart rate and additional fields
    average_heartrate: Number,
    max_heartrate: Number,
    average_speed: Number,
    max_speed: Number,
    average_watts: Number,
    kilojoules: Number,
    suffer_score: Number  // Strava's relative effort score
});

// Define a schema for segment efforts to allow flexibility in effort data
const SegmentEffortSchema = new mongoose.Schema({
    id: String,
    elapsed_time: Number,
    start_date: Date,
    start_date_local: Date,
    distance: Number,
    average_watts: Number,
    device_watts: Boolean,
    average_heartrate: Number,
    max_heartrate: Number,
    pr_rank: Number,
    kom_rank: Number,
    achievements: [Number]
}, { strict: false });  // Allow other fields that might be present

const SegmentSchema = new mongoose.Schema({
    strava_id: String,
    athlete_id: String, // Add athlete_id to associate segments with specific users
    name: String,
    activity_type: String,
    distance: Number,
    average_grade: Number,
    maximum_grade: Number,
    elevation_high: Number,
    elevation_low: Number,
    start_latlng: [Number],
    end_latlng: [Number],
    points: String,
    user_efforts: [mongoose.Schema.Types.Mixed],  // Store efforts as flexible documents
    efforts_updated_at: Date
});

// User profile schema for storing personal information
const UserProfileSchema = new mongoose.Schema({
    strava_id: String,  // Link to Strava athlete ID
    firstname: String,
    lastname: String,
    profile_image: String,
    // Personal metrics
    resting_heart_rate: Number,
    max_heart_rate: Number,
    weight: Number,  // in kg
    height: Number,  // in cm
    age: Number,
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    // Training metrics
    ftp: Number,  // Functional Threshold Power
    zones: {
        heart_rate: {
            zone1: { min: Number, max: Number },
            zone2: { min: Number, max: Number },
            zone3: { min: Number, max: Number },
            zone4: { min: Number, max: Number },
            zone5: { min: Number, max: Number }
        },
        power: {
            zone1: { min: Number, max: Number },
            zone2: { min: Number, max: Number },
            zone3: { min: Number, max: Number },
            zone4: { min: Number, max: Number },
            zone5: { min: Number, max: Number },
            zone6: { min: Number, max: Number },
            zone7: { min: Number, max: Number }
        }
    },
    // Settings
    preferred_units: {
        type: String,
        enum: ['metric', 'imperial'],
        default: 'metric'
    },
    display_preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark', 'system'],
            default: 'system'
        }
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
UserProfileSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

// Create models
const Token = mongoose.models.Token || mongoose.model('Token', TokenSchema);
const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
const Segment = mongoose.models.Segment || mongoose.model('Segment', SegmentSchema);
const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);

module.exports = { Token, Activity, Segment, UserProfile }; 