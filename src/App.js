import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/dashboard/Dashboard';
import ActivityAnalytics from './components/strava/ActivityAnalytics';
import SegmentAnalysis from './components/strava/SegmentAnalysis';
import StravaConnect from './components/strava/StravaConnect';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ProfileSettings from './components/settings/ProfileSettings';
import WebhookAdmin from './components/admin/WebhookAdmin';
import { toast } from 'react-hot-toast';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);

    useEffect(() => {
        // Check if user is authenticated
        const checkAuth = async () => {
            try {
                const response = await fetch('/check-auth');
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const data = await response.json();
                console.log('Authentication check response:', data);
                setIsAuthenticated(data.isAuthenticated);
            } catch (error) {
                console.error('Error checking authentication:', error);
                setAuthError('Failed to check authentication status. Please try again.');
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        // Check for access token in URL (from OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const errorMsg = urlParams.get('error');
        const successMsg = urlParams.get('message');
        
        if (accessToken) {
            // We've just been authenticated
            console.log('Access token found in URL, setting authenticated state');
            setIsAuthenticated(true);
            setIsLoading(false);
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (errorMsg) {
            // Authentication error
            console.error('Auth error in URL:', errorMsg);
            setAuthError(`Authentication error: ${errorMsg}`);
            setIsAuthenticated(false);
            setIsLoading(false);
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (successMsg) {
            // Successful authentication message
            console.log('Success message in URL:', successMsg);
            setIsAuthenticated(true);
            setIsLoading(false);
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Regular check
            console.log('No auth params in URL, checking authentication status');
            checkAuth();
        }
    }, []);

    const handleLogout = async () => {
        try {
            const response = await fetch('/logout', { method: 'POST' });
            if (response.ok) {
                console.log('Logout successful');
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const handleDeauthorize = async () => {
        try {
            const confirmed = window.confirm(
                'This will completely disconnect your Strava account from this application. You will need to reauthorize to use the app again. Continue?'
            );
            
            if (!confirmed) return;
            
            const response = await fetch('/deauthorize', { method: 'POST' });
            if (response.ok) {
                console.log('Successfully deauthorized from Strava');
                setIsAuthenticated(false);
                // Show a notification that deauthorization was successful
                toast('Your Strava account has been successfully disconnected.', {
                    duration: 5000,
                });
            }
        } catch (error) {
            console.error('Error deauthorizing from Strava:', error);
            toast.error('Failed to disconnect your Strava account. Please try again.', {
                duration: 5000,
            });
        }
    };

    const handleAuthSuccess = () => {
        console.log('Auth success callback triggered');
        setIsAuthenticated(true);
    };

    const checkAuthStatus = async () => {
        try {
            setDebugInfo('Checking authentication status...');
            const response = await fetch('/check-auth');
            const data = await response.json();
            setDebugInfo(`Auth check response: ${JSON.stringify(data)}`);
            
            if (data.isAuthenticated) {
                setIsAuthenticated(true);
                setDebugInfo(prev => `${prev}\nAuthentication successful! Redirecting to dashboard...`);
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 2000);
            }
        } catch (error) {
            setDebugInfo(`Error checking auth: ${error.message}`);
        }
    };

    const checkActivities = async () => {
        try {
            setDebugInfo('Fetching activities...');
            const response = await fetch('/api/get-activities');
            const data = await response.json();
            setDebugInfo(`Activities response: ${JSON.stringify(data).substring(0, 200)}...`);
        } catch (error) {
            setDebugInfo(`Error fetching activities: ${error.message}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <Router>
            <Routes>
                <Route 
                    path="/" 
                    element={
                        <AppLayout 
                            isAuthenticated={isAuthenticated} 
                            onLogout={handleLogout}
                            onDeauthorize={handleDeauthorize}
                        />
                    }
                >
                    <Route 
                        index 
                        element={
                            isAuthenticated ? 
                                <Navigate to="/dashboard" replace /> : 
                                <div className="flex flex-col items-center justify-center p-6 max-w-4xl mx-auto">
                                    <div className="w-full grid md:grid-cols-2 gap-6 items-center">
                                        <div className="text-left">
                                            <h1 className="text-2xl font-bold text-gray-800 mb-2">
                                                KOM <span className="text-orange-500">Hunter</span>
                                            </h1>
                                            <p className="text-sm text-gray-600 mb-4">
                                                Connect with Strava to analyze your activities and find KOM opportunities.
                                            </p>
                                            
                                            <div className="mb-6 max-w-sm">
                                                <StravaConnect onAuthSuccess={handleAuthSuccess} />
                                            </div>
                                        </div>
                                        
                                        <div className="hidden md:block">
                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                                <img 
                                                    src="https://i.imgur.com/8rXY2OY.png" 
                                                    alt="KOM Hunter Dashboard Preview" 
                                                    className="rounded-lg w-auto h-auto max-h-[180px] mx-auto"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {authError && (
                                        <div className="mt-6 p-3 bg-red-50 text-red-600 rounded-md border border-red-200 w-full max-w-md slide-in-up">
                                            <div className="flex items-center">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                                </svg>
                                                {authError}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Debug section - hidden by default */}
                                    <div className="mt-8 pt-4 border-t border-gray-200 w-full max-w-md">
                                        <details className="text-sm text-gray-500">
                                            <summary className="cursor-pointer font-medium text-xs">Debug Tools</summary>
                                            <div className="mt-2 space-y-2">
                                                <div className="flex space-x-2">
                                                    <button 
                                                        onClick={checkAuthStatus}
                                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                                                    >
                                                        Check Auth Status
                                                    </button>
                                                    <button 
                                                        onClick={checkActivities}
                                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                                                    >
                                                        Check Activities
                                                    </button>
                                                </div>
                                                {debugInfo && (
                                                    <pre className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto max-h-40">
                                                        {debugInfo}
                                                    </pre>
                                                )}
                                            </div>
                                        </details>
                                    </div>
                                </div>
                        } 
                    />
                    
                    <Route 
                        path="dashboard" 
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated}>
                                <Dashboard />
                            </ProtectedRoute>
                        } 
                    />
                    
                    <Route 
                        path="analytics" 
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated}>
                                <ActivityAnalytics onSelectActivity={(activity) => console.log('Activity selected:', activity)} />
                            </ProtectedRoute>
                        } 
                    />
                    
                    <Route 
                        path="segments" 
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated}>
                                <SegmentAnalysis />
                            </ProtectedRoute>
                        } 
                    />
                    
                    <Route 
                        path="settings" 
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated}>
                                <ProfileSettings />
                            </ProtectedRoute>
                        } 
                    />
                    
                    <Route 
                        path="webhooks" 
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated}>
                                <WebhookAdmin />
                            </ProtectedRoute>
                        } 
                    />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;