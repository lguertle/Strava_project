import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/Sidebar.css';

const Sidebar = ({ activity, onClose, isVisible = true }) => {
    const [isRetracted, setIsRetracted] = useState(false);

    const toggleSidebar = () => {
        const newState = !isRetracted;
        setIsRetracted(newState);
        if (newState) {
            onClose();
        }
    };

    // Format activity data for display
    const formatDistance = (distance) => {
        return distance ? `${(distance / 1000).toFixed(2)} km` : 'N/A';
    };

    const formatTime = (seconds) => {
        if (!seconds) return 'N/A';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    if (!isVisible) return null;

    return (
        <div className={`sidebar ${isRetracted ? 'retracted' : ''}`}>
            <button className="toggle-button" onClick={toggleSidebar}>
                {isRetracted ? '>' : '<'}
            </button>
            {!isRetracted && activity && (
                <div className="activity-details">
                    <h2>{activity.name || 'Activity Details'}</h2>
                    <div className="detail-item">
                        <span className="label">Type:</span>
                        <span className="value">{activity.type || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                        <span className="label">Date:</span>
                        <span className="value">{formatDate(activity.start_date)}</span>
                    </div>
                    <div className="detail-item">
                        <span className="label">Distance:</span>
                        <span className="value">{formatDistance(activity.distance)}</span>
                    </div>
                    <div className="detail-item">
                        <span className="label">Duration:</span>
                        <span className="value">{formatTime(activity.moving_time)}</span>
                    </div>
                    <div className="detail-item">
                        <span className="label">Elevation Gain:</span>
                        <span className="value">{activity.total_elevation_gain || 0} m</span>
                    </div>
                    
                    <div className="sidebar-nav">
                        <h3>Navigation</h3>
                        <ul>
                            <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                            <li><NavLink to="/kom-analysis">KOM Analysis</NavLink></li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;