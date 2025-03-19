import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ isAuthenticated, children }) => {
    useEffect(() => {
        if (!isAuthenticated) {
            console.log('User not authenticated, redirecting to home page');
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute; 