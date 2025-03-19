import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import MainSidebar from './MainSidebar';

const AppLayout = ({ isAuthenticated, onLogout, onDeauthorize }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Navbar 
                isAuthenticated={isAuthenticated} 
                onLogout={onLogout} 
                onDeauthorize={onDeauthorize}
                toggleSidebar={toggleSidebar} 
            />
            
            <div className="flex flex-1 overflow-hidden">
                {isAuthenticated && (
                    <>
                        {/* Desktop sidebar */}
                        <div 
                            className={`hidden md:block md:w-64 border-r border-gray-200 shadow-sm flex-shrink-0 transition-all duration-300 ease-in-out`}
                        >
                            <MainSidebar />
                        </div>
                        
                        {/* Mobile sidebar */}
                        <div 
                            className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-40 md:hidden transform transition-transform duration-300 ease-in-out ${
                                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                            }`}
                            style={{ top: '56px', height: 'calc(100% - 56px)' }}
                        >
                            <MainSidebar />
                        </div>
                        
                        {/* Backdrop for mobile sidebar */}
                        {isSidebarOpen && (
                            <div 
                                className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity duration-300 ease-in-out"
                                onClick={() => setIsSidebarOpen(false)}
                                aria-hidden="true"
                            ></div>
                        )}
                    </>
                )}
                
                <main 
                    className={`flex-1 overflow-auto p-4 md:p-6 transition-all duration-300 ease-in-out ${
                        isAuthenticated ? 'md:ml-0' : ''
                    }`}
                >
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AppLayout; 