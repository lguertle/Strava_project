import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MainSidebar = () => {
    const location = useLocation();
    
    const isActive = (path) => {
        return location.pathname === path;
    };
    
    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">
                    <span className="text-orange-500">Strava</span> Analytics
                </h2>
            </div>
            
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
                <div className="space-y-1.5">
                    <Link
                        to="/dashboard"
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            isActive('/dashboard') 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                        </svg>
                        <span className="truncate">Dashboard</span>
                    </Link>
                    
                    <Link
                        to="/analytics"
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            isActive('/analytics') 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        <span className="truncate">Analytics</span>
                    </Link>
                    
                    <Link
                        to="/segments"
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            isActive('/segments') 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                        </svg>
                        <span className="truncate">Segments</span>
                    </Link>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <Link
                        to="/settings"
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            isActive('/settings') 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span className="truncate">Settings</span>
                    </Link>
                    
                    <Link
                        to="/webhooks"
                        className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            isActive('/webhooks') 
                                ? 'bg-orange-50 text-orange-600' 
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        <span className="truncate">Webhooks</span>
                        <span className="ml-auto bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">New</span>
                    </Link>
                </div>
            </nav>
            
            <div className="p-4 border-t border-gray-100 text-xs text-gray-500">
                <p>Connected with Strava</p>
            </div>
        </div>
    );
};

export default MainSidebar; 