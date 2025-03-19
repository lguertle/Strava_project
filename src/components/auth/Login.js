import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await axios.get('/check-auth');
        if (response.data.isAuthenticated) {
          localStorage.setItem('isAuthenticated', 'true');
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get('/authorize');
      
      if (response.data.redirect_url) {
        // If we have a redirect_url, user is already authorized
        window.location.href = response.data.redirect_url;
      } else if (response.data.auth_url) {
        // If we have an auth_url, user needs to authorize with Strava
        window.location.href = response.data.auth_url;
      } else {
        setError('Failed to process authorization. Please try again.');
      }
    } catch (err) {
      console.error('Error during authorization:', err);
      setError('Failed to connect with Strava. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center h-screen">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Login with Strava</CardTitle>
          <CardDescription>Connect your Strava account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <Button 
            onClick={handleLogin} 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? 'Connecting...' : 'Connect with Strava'}
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-gray-500">You will be redirected to Strava for authentication</p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login; 