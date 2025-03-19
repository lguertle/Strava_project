const mongoose = require('mongoose');

// Make sure the schema includes these fields for leaderboard data
const SegmentSchema = new mongoose.Schema({
    // ... existing fields ...
    
    // Add or update these fields for leaderboard data
    leaderboard: {
        type: Array,
        default: []
    },
    leaderboard_updated_at: {
        type: Date,
        default: null
    },
    has_leaderboard: {
        type: Boolean,
        default: false
    },
    
    // ... existing fields ...
});

module.exports = mongoose.model('Segment', SegmentSchema); 