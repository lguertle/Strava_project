import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Logout = () => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const response = await axios.post('/logout');
      
      if (response.data.success) {
        // Store a flag to force account selection on next login
        if (response.data.force_account_selection) {
          localStorage.setItem('force_account_selection', 'true');
        }
        
        // Clear any auth-related state from localStorage
        localStorage.removeItem('isAuthenticated');
        
        // Redirect to the login page
        navigate('/login');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button 
      variant="destructive" 
      onClick={handleLogout} 
      disabled={isLoggingOut}
      className="mt-2"
    >
      {isLoggingOut ? 'Logging out...' : 'Logout'}
    </Button>
  );
};

export default Logout; 