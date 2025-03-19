import React, { useState, useEffect, useRef, useCallback, useMemo, Component } from 'react';
import axios from 'axios';
import ActivitySummaryChart from '../charts/ActivitySummaryChart';
import ActivityTypeChart from '../charts/ActivityTypeChart';
import PaceAnalysisChart from '../charts/PaceAnalysisChart';
import ActivityStatsCard from '../charts/ActivityStatsCard';
import ActivityCalendarHeatmap from '../charts/ActivityCalendarHeatmap';
import HeartRateChart from '../charts/HeartRateChart';

// Debounce utility function to prevent excessive function calls
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Error Boundary component to catch and display errors gracefully
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Error caught by ErrorBoundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
                    <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
                    <p className="mb-2">An error occurred while rendering this component.</p>
                    <button 
                        onClick={() => this.setState({ hasError: false })}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ActivityAnalytics = ({ activities = [], onSelectActivity }) => {
    const [localActivities, setLocalActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [timeframe, setTimeframe] = useState('weekly');
    const [metric, setMetric] = useState('distance');
    const [activityType, setActivityType] = useState('All');
    const [paceActivityType, setPaceActivityType] = useState('Ride');
    const [dateRange, setDateRange] = useState('all');
    const [chartsLoaded, setChartsLoaded] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    
    // Use refs to track fetch state and prevent duplicate requests
    const fetchInProgress = useRef(false);
    const hasFetchedActivities = useRef(false);
    const abortControllerRef = useRef(null);

    // Check for dark mode preference
    useEffect(() => {
        const darkModePreference = localStorage.getItem('darkMode') === 'true';
        setIsDarkMode(darkModePreference);
        
        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            const newDarkMode = e.matches;
            setIsDarkMode(newDarkMode);
            localStorage.setItem('darkMode', newDarkMode);
        };
        
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Show toast notification
    const showNotification = (message) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    // Memoize the fetch function to prevent recreating it on every render
    // and implement debouncing to prevent excessive API calls
    const fetchActivities = useCallback(
        debounce(async (force = false) => {
            // Don't fetch if already in progress or if we've already fetched (unless forced)
            if (fetchInProgress.current || (!force && hasFetchedActivities.current)) {
                console.log('Skipping fetch - already in progress or already fetched');
                return;
            }
            
            // Cancel any existing requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            
            // Create a new abort controller for this request
            abortControllerRef.current = new AbortController();
            
            try {
                fetchInProgress.current = true;
                setIsLoading(true);
                setError('');
                console.log('Fetching activities...');
                
                const response = await axios.get('/api/get-activities', {
                    signal: abortControllerRef.current.signal,
                    timeout: 30000 // 30 second timeout
                });
                
                console.log('Activities response received:', response.status);
                
                // Ensure we're setting an array
                const activitiesData = Array.isArray(response.data) ? response.data : 
                                      (response.data && Array.isArray(response.data.activities)) ? response.data.activities : [];
                
                console.log(`Received ${activitiesData.length} activities`);
                setLocalActivities(activitiesData);
                
                // Mark that we've successfully fetched activities
                hasFetchedActivities.current = true;
                
                // Set charts as loaded after a short delay to ensure smooth rendering
                setTimeout(() => {
                    setChartsLoaded(true);
                }, 300);
                
                showNotification('Activities loaded successfully');
            } catch (error) {
                // Don't show error for aborted requests
                if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                    console.error('Error fetching activities:', error);
                    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch activities.';
                    setError(errorMessage);
                    showNotification(`Error: ${errorMessage}`);
                }
            } finally {
                setIsLoading(false);
                fetchInProgress.current = false;
            }
        }, 300), // 300ms debounce time
        []
    );

    // If activities are passed as props, use them
    useEffect(() => {
        if (activities && activities.length > 0) {
            console.log('Using provided activities from props:', activities.length);
            setLocalActivities(activities);
            hasFetchedActivities.current = true;
            // Set charts as loaded after a short delay
            setTimeout(() => {
                setChartsLoaded(true);
            }, 300);
        } else {
            // Always fetch on initial mount - removed the condition to make data load automatically
            console.log('No activities in props, fetching from API');
            fetchActivities();
        }
    }, [activities, fetchActivities]);

    // Cleanup function to abort any pending requests when component unmounts
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Filter activities based on selected filters
    const filteredActivities = useMemo(() => {
        if (!localActivities || !Array.isArray(localActivities)) return [];
        
        let filtered = [...localActivities];
        
        // Filter by activity type
        if (activityType !== 'All') {
            filtered = filtered.filter(activity => activity.type === activityType);
        }
        
        // Filter by date range
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (dateRange) {
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate = new Date(now);
                    startDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    startDate = new Date(now);
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    startDate = null;
            }
            
            if (startDate) {
                filtered = filtered.filter(activity => {
                    const activityDate = new Date(activity.start_date);
                    return activityDate >= startDate;
                });
            }
        }
        
        return filtered;
    }, [localActivities, activityType, dateRange]);

    const handleSelectActivity = (activity) => {
        setSelectedActivity(activity);
        if (onSelectActivity) {
            onSelectActivity(activity);
        }
    };

    const handleRefresh = () => {
        setChartsLoaded(false);
        if (!fetchInProgress.current) {
            fetchActivities(true); // Pass true to force a refresh
        }
    };

    // Export activities to CSV
    const exportToCSV = () => {
        if (!filteredActivities || filteredActivities.length === 0) {
            showNotification('No activities to export');
            return;
        }
        
        try {
            // Define CSV headers
            const headers = [
                'Name',
                'Date',
                'Type',
                'Distance (km)',
                'Moving Time (seconds)',
                'Elevation Gain (m)',
                'Average Speed (km/h)',
                'Max Speed (km/h)',
                'Average Heart Rate',
                'Max Heart Rate'
            ];
            
            // Map activities to CSV rows
            const csvRows = filteredActivities.map(activity => [
                activity.name || '',
                activity.start_date || '',
                activity.type || '',
                ((activity.distance || 0) / 1000).toFixed(2),
                activity.moving_time || 0,
                activity.total_elevation_gain || 0,
                ((activity.average_speed || 0) * 3.6).toFixed(2),
                ((activity.max_speed || 0) * 3.6).toFixed(2),
                activity.average_heartrate || '',
                activity.max_heartrate || ''
            ]);
            
            // Combine headers and rows
            const csvContent = [
                headers.join(','),
                ...csvRows.map(row => row.join(','))
            ].join('\n');
            
            // Create a blob and download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `strava_activities_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('Activities exported successfully');
        } catch (error) {
            console.error('Error exporting activities:', error);
            showNotification('Failed to export activities');
        }
    };

    // Print function
    const handlePrint = () => {
        window.print();
    };

    // Get unique activity types for filter dropdown
    const activityTypes = useMemo(() => {
        if (!localActivities || !Array.isArray(localActivities)) return [];
        
        const types = new Set(localActivities.map(activity => activity.type).filter(Boolean));
        return ['All', ...Array.from(types)];
    }, [localActivities]);

    const formatDistance = (distance) => {
        return (distance / 1000).toFixed(2) + ' km';
    };

    const formatTime = (time) => {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    // Loading skeleton for charts
    const ChartSkeleton = () => (
        <div className="animate-pulse">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
        </div>
    );

    // Memoized chart components to prevent unnecessary re-renders
    const MemoizedActivityCalendarHeatmap = useMemo(() => {
        return chartsLoaded ? <ActivityCalendarHeatmap activities={filteredActivities} darkMode={isDarkMode} /> : <ChartSkeleton />;
    }, [chartsLoaded, filteredActivities, isDarkMode]);

    const MemoizedActivitySummaryChart = useMemo(() => {
        return chartsLoaded ? (
            <ActivitySummaryChart 
                activities={filteredActivities} 
                metric={metric} 
                timeframe={timeframe} 
            />
        ) : <ChartSkeleton />;
    }, [chartsLoaded, filteredActivities, metric, timeframe]);

    const MemoizedActivityTypeChart = useMemo(() => {
        return chartsLoaded ? <ActivityTypeChart activities={filteredActivities} /> : <ChartSkeleton />;
    }, [chartsLoaded, filteredActivities]);

    const MemoizedPaceAnalysisChart = useMemo(() => {
        return chartsLoaded ? (
            <PaceAnalysisChart 
                activities={localActivities} 
                activityType={paceActivityType} 
            />
        ) : <ChartSkeleton />;
    }, [chartsLoaded, localActivities, paceActivityType]);

    return (
        <ErrorBoundary>
            <div className={`p-5 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'} h-full overflow-y-auto`}>
                {/* Toast notification */}
                {showToast && (
                    <div className="fixed top-4 right-4 z-50 p-4 rounded-md bg-orange-500 text-white shadow-lg transition-opacity duration-300">
                        {toastMessage}
                    </div>
                )}
                
                {/* Header with sticky filters */}
                <div className={`sticky top-0 z-10 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} pb-4 mb-6`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                        <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3 md:mb-0`}>Activity Analytics</h2>
                        
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <select 
                                value={activityType} 
                                onChange={(e) => setActivityType(e.target.value)}
                                className={`px-3 py-2 border ${isDarkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                            >
                                {activityTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            
                            <select 
                                value={dateRange} 
                                onChange={(e) => setDateRange(e.target.value)}
                                className={`px-3 py-2 border ${isDarkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                            >
                                <option value="all">All Time</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="year">Last 12 Months</option>
                            </select>
                            
                            <button 
                                onClick={handleRefresh}
                                disabled={isLoading || fetchInProgress.current}
                                className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                                aria-label="Refresh data"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Refresh
                                    </>
                                )}
                            </button>
                            
                            <button 
                                onClick={exportToCSV}
                                disabled={isLoading || filteredActivities.length === 0}
                                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                                aria-label="Export to CSV"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export CSV
                            </button>
                            
                            <button 
                                onClick={handlePrint}
                                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                                aria-label="Print view"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print
                            </button>
                            
                            <button 
                                onClick={() => {
                                    const newDarkMode = !isDarkMode;
                                    setIsDarkMode(newDarkMode);
                                    localStorage.setItem('darkMode', newDarkMode);
                                }}
                                className={`px-3 py-2 ${isDarkMode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-gray-800'} text-white rounded-md transition-colors flex items-center`}
                                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                            >
                                {isDarkMode ? (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        Light
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                        </svg>
                                        Dark
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
                            <p className="flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        </div>
                    )}
                    
                    {/* Activity Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 rounded-md shadow-sm border`}>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Activities</p>
                            {isLoading ? (
                                <div className={`animate-pulse h-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-16`}></div>
                            ) : (
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{filteredActivities.length}</p>
                            )}
                        </div>
                        
                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 rounded-md shadow-sm border`}>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Total Distance</p>
                            {isLoading ? (
                                <div className={`animate-pulse h-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-24`}></div>
                            ) : (
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                    {formatDistance(filteredActivities.reduce((sum, activity) => sum + (activity.distance || 0), 0))}
                                </p>
                            )}
                        </div>
                        
                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 rounded-md shadow-sm border`}>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Total Time</p>
                            {isLoading ? (
                                <div className={`animate-pulse h-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-20`}></div>
                            ) : (
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                    {formatTime(filteredActivities.reduce((sum, activity) => sum + (activity.moving_time || 0), 0))}
                                </p>
                            )}
                        </div>
                        
                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-3 rounded-md shadow-sm border`}>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Elevation Gain</p>
                            {isLoading ? (
                                <div className={`animate-pulse h-6 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded w-16`}></div>
                            ) : (
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                    {filteredActivities.reduce((sum, activity) => sum + (activity.total_elevation_gain || 0), 0).toFixed(0)} m
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Calendar Heatmap */}
                <div className={`mb-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Activity Calendar</h3>
                    <div className="pl-0">
                        {MemoizedActivityCalendarHeatmap}
                    </div>
                </div>
                
                {/* Activity Trends and Types */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Activity Trends</h3>
                        
                        <div className="mb-3 flex flex-wrap gap-2">
                            <select 
                                value={metric} 
                                onChange={(e) => setMetric(e.target.value)}
                                className={`px-3 py-2 border ${isDarkMode ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                            >
                                <option value="distance">Distance</option>
                                <option value="moving_time">Time</option>
                                <option value="elevation_gain">Elevation</option>
                                <option value="count">Count</option>
                            </select>
                            
                            <select 
                                value={timeframe} 
                                onChange={(e) => setTimeframe(e.target.value)}
                                className={`px-3 py-2 border ${isDarkMode ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                            >
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </div>
                        
                        <div className="h-64">
                            {MemoizedActivitySummaryChart}
                        </div>
                    </div>
                    
                    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Activity Types</h3>
                        <div className="h-64">
                            {MemoizedActivityTypeChart}
                        </div>
                    </div>
                </div>
                
                {/* Activity Stats Cards */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {!chartsLoaded ? (
                        <>
                            <div className={`animate-pulse ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border h-48`}></div>
                            <div className={`animate-pulse ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border h-48`}></div>
                            <div className={`animate-pulse ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border h-48`}></div>
                        </>
                    ) : (
                        <>
                            <ActivityStatsCard 
                                activities={filteredActivities} 
                                title="Distance" 
                                icon="📏" 
                                statType="distance" 
                                darkMode={isDarkMode}
                            />
                            
                            <ActivityStatsCard 
                                activities={filteredActivities} 
                                title="Time" 
                                icon="⏱️" 
                                statType="time" 
                                darkMode={isDarkMode}
                            />
                            
                            <ActivityStatsCard 
                                activities={filteredActivities} 
                                title="Elevation" 
                                icon="🏔️" 
                                statType="elevation" 
                                darkMode={isDarkMode}
                            />
                        </>
                    )}
                </div>
                
                {/* Pace Analysis */}
                <div className="mb-6">
                    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Pace Analysis</h3>
                        
                        <div className="mb-3">
                            <select 
                                value={paceActivityType}
                                onChange={(e) => setPaceActivityType(e.target.value)}
                                className={`px-3 py-2 border ${isDarkMode ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500`}
                            >
                                {activityTypes.filter(type => type !== 'All').map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="h-64">
                            {MemoizedPaceAnalysisChart}
                        </div>
                    </div>
                </div>
                
                {/* Recent Activities */}
                <div className="mb-6">
                    <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Recent Activities</h3>
                        
                        {isLoading ? (
                            <div className="animate-pulse space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-md`}></div>
                                ))}
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className={`text-center py-8 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-500'} rounded-md`}>
                                <svg className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <p className="mt-2">No activities found with the current filters.</p>
                                <button 
                                    onClick={handleRefresh} 
                                    className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    Refresh Data
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                                        <tr>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Name
                                            </th>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Date
                                            </th>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Type
                                            </th>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Distance
                                            </th>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Time
                                            </th>
                                            <th className={`px-6 py-3 text-left text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                                                Elevation
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={`${isDarkMode ? 'bg-gray-800 divide-y divide-gray-700' : 'bg-white divide-y divide-gray-200'}`}>
                                        {filteredActivities.slice(0, 10).map((activity) => (
                                            <tr 
                                                key={activity.id || activity._id} 
                                                className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} cursor-pointer transition-colors`}
                                                onClick={() => handleSelectActivity(activity)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{activity.name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {new Date(activity.start_date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
                                                        {activity.type}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {formatDistance(activity.distance)}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {formatTime(activity.moving_time)}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {activity.total_elevation_gain?.toFixed(0)} m
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Selected Activity Details */}
                {selectedActivity && (
                    <div className="mb-6">
                        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm p-4 border`}>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                    Selected Activity: {selectedActivity.name}
                                </h3>
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                                    aria-label="Close activity details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <div className="mb-4 grid grid-cols-2 gap-4">
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Date</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {new Date(selectedActivity.start_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Type</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{selectedActivity.type}</p>
                                        </div>
                                        
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Distance</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {formatDistance(selectedActivity.distance)}
                                            </p>
                                        </div>
                                        
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Time</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {formatTime(selectedActivity.moving_time)}
                                            </p>
                                        </div>
                                        
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Elevation Gain</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {selectedActivity.total_elevation_gain?.toFixed(0)} m
                                            </p>
                                        </div>
                                        
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Average Speed</p>
                                            <p className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {(selectedActivity.average_speed * 3.6).toFixed(1)} km/h
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {selectedActivity.description && (
                                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md mb-4`}>
                                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Description</p>
                                            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>{selectedActivity.description}</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <HeartRateChart activityId={selectedActivity.id || selectedActivity._id} darkMode={isDarkMode} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default ActivityAnalytics; 