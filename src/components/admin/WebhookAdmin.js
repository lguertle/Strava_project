import React, { useState, useEffect } from 'react';
import axios from 'axios';

const WebhookAdmin = () => {
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Fetch webhook status
  const fetchWebhookStatus = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/webhooks/status');
      setWebhookStatus(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load webhook status: ' + (err.response?.data?.message || err.message));
      setWebhookStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Initialize webhook
  const initializeWebhook = async () => {
    setIsInitializing(true);
    setSuccessMessage('');
    setError(null);
    
    try {
      const response = await axios.post('/api/webhooks/initialize');
      setSuccessMessage(response.data.message || 'Webhook successfully initialized!');
      // Refresh status
      fetchWebhookStatus();
    } catch (err) {
      setError('Failed to initialize webhook: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsInitializing(false);
    }
  };

  // Reset webhook
  const resetWebhook = async () => {
    if (!window.confirm('Are you sure you want to reset the webhook configuration? This will delete existing subscriptions and create a new one.')) {
      return;
    }
    
    setIsResetting(true);
    setSuccessMessage('');
    setError(null);
    
    try {
      const response = await axios.post('/api/webhooks/reset');
      setSuccessMessage(response.data.message || 'Webhook successfully reset!');
      // Refresh status
      fetchWebhookStatus();
    } catch (err) {
      setError('Failed to reset webhook: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsResetting(false);
    }
  };

  // Load webhook status on component mount
  useEffect(() => {
    fetchWebhookStatus();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Strava Webhook Status</h1>
        <p className="text-gray-600">
          Webhooks allow your application to receive real-time updates from Strava when activities are created, updated, or deleted.
        </p>
      </div>

      {/* Success or Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
          <p>{successMessage}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Webhook Status Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Webhook Configuration</h2>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading webhook status...</p>
          </div>
        ) : webhookStatus ? (
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="mr-3">
                <span className={`inline-block w-3 h-3 rounded-full ${webhookStatus.isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  Status: <span className={webhookStatus.isConfigured ? 'text-green-600' : 'text-yellow-600'}>
                    {webhookStatus.isConfigured ? 'Active' : 'Not Configured'}
                  </span>
                </p>
                {webhookStatus.isConfigured && (
                  <p className="text-sm text-gray-600">
                    {webhookStatus.webhookCount} webhook subscription{webhookStatus.webhookCount !== 1 ? 's' : ''} configured
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Last checked: {new Date(webhookStatus.lastChecked).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
              {!webhookStatus.isConfigured ? (
                <button
                  onClick={initializeWebhook}
                  disabled={isInitializing}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  {isInitializing ? 'Initializing...' : 'Initialize Webhook'}
                </button>
              ) : (
                <button
                  onClick={resetWebhook}
                  disabled={isResetting}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Reset Webhook'}
                </button>
              )}
              
              <button
                onClick={fetchWebhookStatus}
                disabled={loading}
                className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md p-6 text-center">
            <p className="text-gray-600">Unable to retrieve webhook status.</p>
            <p className="text-sm text-gray-500 mt-1">Please check your server configuration.</p>
          </div>
        )}
      </div>

      {/* Webhook Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">About Strava Webhooks</h2>
        
        <div className="prose prose-sm max-w-none text-gray-600">
          <p>
            Strava webhooks allow your application to receive real-time updates when:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>A user creates a new activity</li>
            <li>A user updates an existing activity</li>
            <li>A user deletes an activity</li>
            <li>A user updates their profile</li>
          </ul>
          
          <div className="mt-4 bg-blue-50 p-4 rounded-md">
            <h3 className="text-sm font-semibold text-blue-800">How it works:</h3>
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-blue-700">
              <li>Your server subscribes to Strava webhook events (handled automatically)</li>
              <li>When a user performs an action on Strava, Strava sends a notification to your server</li>
              <li>Your server processes the notification and updates your database</li>
              <li>Your application displays the updated data to users</li>
            </ol>
          </div>
          
          <p className="mt-4">
            All webhook processing happens securely on the server. No sensitive information is exposed to the frontend.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WebhookAdmin; 