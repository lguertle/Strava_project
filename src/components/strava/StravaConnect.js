import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const StravaConnect = ({ onAuthSuccess, minimal = false }) => {
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check for error parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const errorType = urlParams.get('error');
        const errorMessage = urlParams.get('message');
        const successMessage = urlParams.get('message');
        const accessToken = urlParams.get('access_token');
        
        if (accessToken) {
            // If we have an access token in the URL, we're authenticated
            console.log('Access token found in URL, triggering auth success callback');
            if (onAuthSuccess) {
                onAuthSuccess();
            }
            navigate('/dashboard');
        } else if (errorType) {
            console.error('Error type in URL params:', errorType);
            switch (errorType) {
                case 'no_code':
                    setError('No authorization code received from Strava. Please try connecting again.');
                    break;
                case 'no_token':
                    setError('Failed to get access token from Strava. Please try connecting again.');
                    break;
                case 'token_error':
                    setError(errorMessage || 'Failed to authenticate with Strava. Please try connecting again.');
                    break;
                case 'oauth_error':
                    setError('Authorization failed. Please try connecting again.');
                    break;
                default:
                    setError('An error occurred during Strava authentication. Please try connecting again.');
            }
            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (successMessage) {
            console.log('Success message found in URL params:', successMessage);
            setMessage(successMessage);
            // Also mark as authenticated
            if (onAuthSuccess) {
                onAuthSuccess();
            }
            // Clear the message after 5 seconds
            setTimeout(() => setMessage(''), 5000);
            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [navigate, onAuthSuccess]);

    const connectToStrava = async () => {
        try {
            setError(null);
            setIsLoading(true);
            setMessage('Connecting to Strava...');
            
            console.log('Requesting Strava authorization URL');
            const response = await axios.get('/authorize', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log('Authorization URL response:', response.data);
            if (response.data && response.data.auth_url) {
                console.log('Redirecting to Strava authorization page');
                window.location.href = response.data.auth_url;
            } else if (response.data && response.data.error) {
                throw new Error(response.data.error);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Strava connection error:', error);
            setError(
                error.response?.data?.error || 
                error.message || 
                'Failed to connect to Strava. Please try again.'
            );
            setMessage('');
        } finally {
            setIsLoading(false);
        }
    };

    // Minimal version for navbar
    if (minimal) {
        return (
            <button 
                onClick={connectToStrava} 
                disabled={isLoading}
                className="flex items-center px-3 py-1.5 rounded-md bg-white text-orange-500 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all duration-300 text-sm shadow-sm"
                aria-label="Connect to Strava"
            >
                <svg className="w-3.5 h-3.5 mr-1.5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5.41 13.943h4.172l2.836-5.598z" />
                </svg>
                {isLoading ? 
                    <span className="flex items-center">
                        <span className="loading-spinner mr-1.5 w-3 h-3 border-orange-500"></span>
                        Connecting...
                    </span> 
                    : 'Connect'}
            </button>
        );
    }

    // Full version for main page
    return (
        <div className="flex flex-col items-center w-full">
            <button
                onClick={connectToStrava}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors duration-200"
            >
                {isLoading ? (
                    <svg className="w-3 h-3 mr-2 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                ) : (
                    <svg className="w-2.5 h-2.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5.41 13.943h4.172l2.836-5.598z" />
                    </svg>
                )}
                {isLoading ? 'Connecting...' : 'Connect with Strava'}
            </button>
            
            {message && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md w-full border border-green-200 slide-in-up text-xs">
                    <div className="flex items-center">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                        {message}
                    </div>
                </div>
            )}
            
            {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md w-full border border-red-200 slide-in-up text-xs">
                    <div className="flex items-center">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        {error}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StravaConnect;