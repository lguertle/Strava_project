import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ isAuthenticated, onLogout, onDeauthorize, toggleSidebar }) => {
    return (
        <nav className="bg-white border-b border-gray-200 text-gray-800 shadow-sm sticky top-0 z-50 transition-all duration-200">
            <div className="container mx-auto px-4 py-2 flex justify-between items-center">
                <div className="flex items-center">
                    {isAuthenticated && (
                        <button 
                            onClick={toggleSidebar}
                            className="mr-3 p-1.5 rounded-md text-gray-600 hover:bg-gray-100 md:hidden focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                            aria-label="Toggle sidebar"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>
                    )}
                    <Link to="/" className="flex items-center group">
                        <svg className="w-3 h-3 mr-1 text-orange-500 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5.41 13.943h4.172l2.836-5.598z" />
                        </svg>
                        <span className="text-base font-medium text-gray-800 transition-colors duration-200 group-hover:text-orange-500">KOM Hunter</span>
                    </Link>
                </div>
                
                <div className="flex items-center">
                    {isAuthenticated ? (
                        <div className="flex items-center space-x-3">
                            <a 
                                href="https://www.strava.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-gray-600 text-xs hover:text-orange-500 transition-colors hidden sm:flex items-center group"
                                aria-label="Visit Strava website"
                            >
                                <svg className="w-2.5 h-2.5 mr-1 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5.41 13.943h4.172l2.836-5.598z" />
                                </svg>
                                <span>Strava</span>
                            </a>
                            <button 
                                onClick={onLogout}
                                className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-md transition-all"
                                aria-label="Logout"
                            >
                                <span className="flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Logout
                                </span>
                            </button>
                        </div>
                    ) : (
                        <Link to="/" className="px-2.5 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-all">
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;