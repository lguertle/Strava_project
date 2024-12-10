import React, { useState } from 'react';
import './Sidebar.css';

const Sidebar = ({ onToggle }) => {
    const [isRetracted, setIsRetracted] = useState(false);

    const toggleSidebar = () => {
        const newState = !isRetracted;
        setIsRetracted(newState);
        onToggle(newState);
    };

    return (
        <div className={`sidebar ${isRetracted ? 'retracted' : ''}`}>
            <button className="toggle-button" onClick={toggleSidebar}>
                {isRetracted ? '>' : '<'}
            </button>
            {!isRetracted && (
                <>
                    <h2>KOM Hunter</h2>
                    <ul>
                        <li><a href="#dashboard">Dashboard</a></li>
                        <li><a href="#activities">Activities</a></li>
                        <li><a href="#settings">Settings</a></li>
                        <li><a href="#help">Help</a></li>
                    </ul>
                </>
            )}
        </div>
    );
};

export default Sidebar;