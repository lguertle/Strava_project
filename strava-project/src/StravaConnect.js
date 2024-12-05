import React, { useState } from 'react';
import axios from 'axios';
import './StravaConnect.css';

const StravaConnect = () => {
    const [message, setMessage] = useState('');

    const connectToStrava = async () => {
        try {
            const response = await axios.get('http://localhost:5000/authorize');
            window.location.href = response.data.auth_url;
        } catch (error) {
            setMessage('Failed to connect to Strava.');
        }
    };

    return (
        <div className="strava-connect">
            <button onClick={connectToStrava}>Connect to Strava</button>
            {message && <p>{message}</p>}
        </div>
    );
};

export default StravaConnect;