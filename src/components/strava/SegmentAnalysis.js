import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const SegmentAnalysis = () => {
    const [segments, setSegments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activityFilter, setActivityFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [segmentEfforts, setSegmentEfforts] = useState([]);
    const [loadingEfforts, setLoadingEfforts] = useState(false);
    const [activeTab, setActiveTab] = useState('efforts'); // Only 'efforts' tab remains
    const [progressInfo, setProgressInfo] = useState(null);
    const [activityTypes, setActivityTypes] = useState([]);
    const [accessToken, setAccessToken] = useState(null);
    const [dataSource, setDataSource] = useState('loading'); // 'loading', 'database', 'api'
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [backgroundProcessing, setBackgroundProcessing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState(null);
    const backgroundRefreshInterval = useRef(null);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
    const refreshMenuRef = useRef(null);
    const [athleteInfo, setAthleteInfo] = useState(null);

    // Get access token from URL query params or from server
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const urlToken = queryParams.get('access_token');
    
    // Add a confirmation function for API-intensive operations
    const confirmApiUsage = (operation, message) => {
        return window.confirm(
            `This operation will use your Strava API quota: ${message}\n\nDo you want to continue?`
        );
    };
    
    // Add a function to show API usage badge or notification
    const showApiUsageBadge = (message) => {
        // Could be expanded to show a toast notification or modal
        console.log(`API USAGE: ${message}`);
        // For now, we'll just log to console, but this could be enhanced with a proper UI notification
    };
    
    // Fetch access token if not in URL
    useEffect(() => {
        const getAccessToken = async () => {
            try {
                console.log("Fetching access token from server...");
                const response = await fetch('/get-access-token');
                const data = await response.json();
                
                if (response.ok && data.access_token) {
                    console.log("Access token retrieved from server");
                    setAccessToken(data.access_token);
                } else if (urlToken) {
                    console.log("Using access token from URL");
                    setAccessToken(urlToken);
                } else {
                    setError("Could not retrieve access token. Please try logging in again.");
                }
            } catch (err) {
                console.error("Error fetching access token:", err);
                if (urlToken) {
                    console.log("Using access token from URL after error");
                    setAccessToken(urlToken);
                } else {
                    setError("Could not retrieve access token. Please try logging in again.");
                }
            }
        };
        
        getAccessToken();
    }, [urlToken]);
    
    // Update the fetchSegments function to be more stable with proper error handling
    const fetchSegments = useCallback(async (pageNum = 1, reset = false, fetchLeaderboards = false) => {
        if (!accessToken) {
            console.error("No access token available for fetching segments");
            return;
        }
        
        setLoading(true);
        
        try {
            console.log(`Fetching additional segments page ${pageNum} with token: ${accessToken.substring(0, 10)}...`);
            // Increase limit to get more segments initially
            const limit = pageNum === 1 ? 50 : 20;
            // Only include fetch_leaderboards when explicitly requested
            const fetchLeaderboardsParam = fetchLeaderboards ? '&fetch_leaderboards=true' : '';
            const response = await fetch(`/api/get-all-activity-segments?access_token=${accessToken}&page=${pageNum}&limit=${limit}${fetchLeaderboardsParam}&disable_background=true`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch segments');
            }
            
            console.log(`Received ${data.segments?.length || 0} segments`);
            
            // Update segments list - IMPORTANT: Use a callback function to ensure we have the latest state
            if (reset) {
                setSegments(data.segments || []);
            } else {
                setSegments(prevSegments => [...prevSegments, ...(data.segments || [])]);
            }
            
            // Update other state
            setHasMore(data.has_more);
            setPage(pageNum);
        } catch (err) {
            console.error('Error fetching segments:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);
    
    // Start background refresh interval - define BEFORE the useEffect that uses it
    const startBackgroundRefresh = useCallback(() => {
        // Only start if auto-refresh is enabled
        if (!autoRefreshEnabled) return () => {};
        
        // Clear any existing interval
        if (backgroundRefreshInterval.current) {
            clearInterval(backgroundRefreshInterval.current);
        }
        
        // Set new interval to check for new segments every 10 seconds
        backgroundRefreshInterval.current = setInterval(() => {
            if (accessToken) {
                console.log("Background refresh: checking for new segments...");
                // Include leaderboards when auto-refresh is enabled since user has already been warned about API usage
                fetchSegments(1, true, true); // Pass true for fetchLeaderboards
            }
        }, 10000); // 10 seconds
        
        return () => {
            if (backgroundRefreshInterval.current) {
                clearInterval(backgroundRefreshInterval.current);
                backgroundRefreshInterval.current = null;
            }
        };
    }, [accessToken, fetchSegments, autoRefreshEnabled]);
    
    // Prefetch leaderboards for segments - but only call when explicitly requested
    const prefetchLeaderboards = useCallback(async (segmentsToFetch) => {
        if (!accessToken || !segmentsToFetch || segmentsToFetch.length === 0) return;
        
        try {
            const segmentIds = segmentsToFetch.map(s => s.strava_id).join(',');
            console.log(`Prefetching leaderboards for ${segmentsToFetch.length} segments...`);
            
            const response = await fetch(`/api/prefetch-leaderboards?access_token=${accessToken}&segment_ids=${segmentIds}`);
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Error prefetching leaderboards:', data.error);
                return;
            }
            
            console.log(`Prefetch complete: fetched ${data.fetched}, cached ${data.cached}, errors ${data.errors}`);
            
            // Update the segments in state with the fetched leaderboard data
            if (data.segments && data.segments.length > 0) {
                // Create a map of segment IDs to leaderboard data
                const updatedSegments = [...segments];
                
                data.segments.forEach(fetchedSegment => {
                    if (fetchedSegment.status === 'fetched' || fetchedSegment.status === 'cached') {
                        // Find the segment in our state
                        const segmentIndex = updatedSegments.findIndex(s => s.strava_id === fetchedSegment.strava_id);
                        if (segmentIndex !== -1) {
                            // Mark the segment as having leaderboard data
                            updatedSegments[segmentIndex].has_leaderboard = fetchedSegment.entries > 0;
                            updatedSegments[segmentIndex].leaderboard_updated_at = new Date();
                            
                            // Store the actual leaderboard data
                            if (fetchedSegment.leaderboard && fetchedSegment.leaderboard.length > 0) {
                                updatedSegments[segmentIndex].leaderboard = fetchedSegment.leaderboard;
                                console.log(`Stored leaderboard data for segment ${fetchedSegment.strava_id} with ${fetchedSegment.leaderboard.length} entries`);
                            }
                            
                            console.log(`Updated segment ${fetchedSegment.strava_id} in state with leaderboard status: ${fetchedSegment.status}`);
                        }
                    }
                });
                
                // Update the segments state
                setSegments(updatedSegments);
            }
        } catch (error) {
            console.error('Error prefetching leaderboards:', error);
        }
    }, [accessToken, segments]);
    
    // Initial fetch when access token is available - now startBackgroundRefresh is defined before this
    useEffect(() => {
        let mounted = true;
        
        const initialFetch = async () => {
            if (!accessToken || !mounted) return;
            
            console.log("Access token available, initiating segment fetch");
            
            try {
                // Don't clear previous data until we have new data
                setLoading(true);
                
                // Make the API request
                console.log(`Fetching segments with token: ${accessToken.substring(0, 10)}...`);
                const limit = 50; // Get more segments initially
                // Remove fetch_leaderboards=true to prevent automatic leaderboard fetching
                const response = await fetch(`/api/get-all-activity-segments?access_token=${accessToken}&page=1&limit=${limit}&disable_background=true`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch segments');
                }
                
                console.log(`Received ${data.segments?.length || 0} segments directly`);
                
                // Only update state if component is still mounted
                if (mounted) {
                    // Update segments state ONLY if we have data
                    if (data.segments && data.segments.length > 0) {
                        setSegments(data.segments);
                        
                        // Set other related state
                        setHasMore(data.has_more);
                        setPage(1);
                        
                        // Check if background processing is happening
                        if (data.background_processing) {
                            setBackgroundProcessing(true);
                            setLastRefreshTime(new Date());
                            
                            // Start background refresh interval if auto-refresh is enabled
                            if (autoRefreshEnabled) {
                                startBackgroundRefresh();
                            }
                        } else {
                            setBackgroundProcessing(false);
                            if (backgroundRefreshInterval.current) {
                                clearInterval(backgroundRefreshInterval.current);
                                backgroundRefreshInterval.current = null;
                            }
                        }
                        
                        if (data.processed_activities === 0) {
                            setDataSource('database');
                            console.log('Segments loaded from database');
                        } else {
                            setDataSource('api');
                            console.log('Segments loaded from Strava API');
                        }
                        
                        setProgressInfo({
                            totalSegments: data.total_segments,
                            totalActivities: data.total_activities,
                            processedActivities: data.processed_activities
                        });
                        
                        // Extract unique activity types
                        const types = [...new Set(data.segments.map(segment => segment.activity_type))].filter(Boolean);
                        setActivityTypes(types);
                        
                        // REMOVED: Don't prefetch leaderboards automatically
                        // prefetchLeaderboards(data.segments.slice(0, 10));
                    }
                    
                    // Finally, mark loading as complete
                    setLoading(false);
                    setInitialLoadComplete(true);
                    
                    console.log("Initial segment load complete with segments:", data.segments?.length || 0);
                }
            } catch (error) {
                console.error("Error during initial segment fetch:", error);
                if (mounted) {
                    setError("Failed to load segments. Please try refreshing the page.");
                    setLoading(false);
                }
            }
        };
        
        initialFetch();
        
        return () => {
            mounted = false;
        };
    // Now startBackgroundRefresh is properly defined before it's used in dependencies
    }, [accessToken, autoRefreshEnabled, startBackgroundRefresh]);
    
    // Toggle auto refresh function
    const toggleAutoRefresh = () => {
        // If user is enabling auto-refresh, show API usage warning
        if (!autoRefreshEnabled) {
            if (!confirmApiUsage(
                "Enable Auto-Refresh",
                "When enabled, auto-refresh will periodically check for new segments from Strava's API, which will consume your API quota regularly."
            )) {
                return; // User canceled, don't toggle
            }
        }
        
        const newState = !autoRefreshEnabled;
        setAutoRefreshEnabled(newState);
        
        if (newState && backgroundProcessing && !backgroundRefreshInterval.current) {
            // Start refresh if enabling and background processing is active
            startBackgroundRefresh();
        } else if (!newState && backgroundRefreshInterval.current) {
            // Stop refresh if disabling
            clearInterval(backgroundRefreshInterval.current);
            backgroundRefreshInterval.current = null;
        }
    };
    
    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (backgroundRefreshInterval.current) {
                clearInterval(backgroundRefreshInterval.current);
                backgroundRefreshInterval.current = null;
            }
        };
    }, []);
    
    // Load more segments
    const loadMore = () => {
        if (!loading && hasMore) {
            console.log(`Loading more segments, page ${page + 1}`);
            
            // Set a flag in local storage to remember we're loading additional pages
            localStorage.setItem('segmentAnalysis_loadingPage', page + 1);
            
            // Use fetchSegments with the next page number and don't reset existing data
            fetchSegments(page + 1, false);
        }
    };
    
    // Modify the handleRefresh function to only fetch leaderboards when auto-refresh is enabled
    const handleRefresh = () => {
        console.log("Local refresh triggered");
        // Clear any page loading memory
        localStorage.removeItem('segmentAnalysis_loadingPage');
        // Reset to page 1 and clear existing data
        // Don't fetch leaderboards on regular refresh
        fetchSegments(1, true, false);
    };
    
    // Modify handleForceReload function to include leaderboard fetching only when explicitly requested
    const handleForceReload = async () => {
        if (!confirmApiUsage(
            "Force Refresh from Strava",
            "This will bypass the local database and directly fetch all segments from Strava's API, which uses more of your API quota."
        )) {
            return;
        }
        
        console.log("Force reload triggered");
        try {
            if (!accessToken) {
                setError("Authentication required. Please log in again.");
                return;
            }
            
            setLoading(true);
            setError(null);
            setDataSource('loading');
            
            // Force refresh should include leaderboard data since it's an explicit user action
            const response = await fetch(`/api/force-refresh-segments?access_token=${accessToken}&page=1&limit=20&fetch_leaderboards=true`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to force refresh segments');
            }
            
            console.log(`Received ${data.segments?.length || 0} segments from force refresh`);
            
            setProgressInfo({
                totalSegments: data.total_segments,
                totalActivities: data.total_activities,
                processedActivities: data.processed_activities
            });
            
            // Update segments list
            setSegments(data.segments || []);
            
            // Extract unique activity types
            const types = [...new Set((data.segments || []).map(segment => segment.activity_type))].filter(Boolean);
            setActivityTypes(types);
            
            setHasMore(data.has_more);
            setPage(1);
            setDataSource('api');
            setInitialLoadComplete(true);
        } catch (err) {
            console.error('Error force refreshing segments:', err);
            setError(err.message);
            setDataSource('error');
        } finally {
            setLoading(false);
        }
    };
    
    // Fetch segment efforts for a selected segment
    const fetchSegmentEfforts = async (segmentId) => {
        if (!accessToken || !segmentId) return;
        
        setLoadingEfforts(true);
        
        try {
            const response = await fetch(`/api/get-segment-efforts/${segmentId}?access_token=${accessToken}&per_page=50`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch segment efforts');
            }
            
            console.log(`Received ${data.efforts?.length || 0} efforts for segment ${segmentId}${data.from_cache ? ' (from cache)' : ''}`);
            setSegmentEfforts(data.efforts || []);
        } catch (err) {
            console.error(`Error fetching efforts for segment ${segmentId}:`, err);
        } finally {
            setLoadingEfforts(false);
        }
    };
    
    // Handle segment selection
    const handleSegmentSelect = (segment) => {
        setSelectedSegment(segment);
        
        // Handle efforts data
        const effortsCacheStatus = getSegmentCacheStatus(segment).efforts;
        
        console.log(`Selecting segment ${segment.strava_id} - ${segment.name}`);
        console.log(`Efforts cache status: ${effortsCacheStatus.status}, fresh: ${effortsCacheStatus.fresh}`);
        
        // Always fetch segment efforts, but server will return cached data if available
        setLoadingEfforts(true);
        fetchSegmentEfforts(segment.strava_id);
    };
    
    // Handle tab change
    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };
    
    // Add a debugging effect to log when segments change
    useEffect(() => {
        console.log(`Segments state updated: ${segments.length} segments available`);
        // Log the first few segments to verify data
        if (segments.length > 0) {
            console.log(`First segment: ${segments[0].name} (${segments[0].strava_id})`);
        }
    }, [segments]);
    
    // Apply filters and sorting
    const filteredSegments = segments
        .filter(segment => {
            // Filter by activity type
            if (typeFilter && segment.activity_type !== typeFilter) {
                return false;
            }
            
            // Filter by name
            if (activityFilter && !segment.name.toLowerCase().includes(activityFilter.toLowerCase())) {
                return false;
            }
            
            return true;
        })
        .sort((a, b) => {
            // Sort by selected field
            let valueA, valueB;
            
            switch (sortBy) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'distance':
                    valueA = a.distance;
                    valueB = b.distance;
                    break;
                case 'grade':
                    valueA = a.average_grade || 0;
                    valueB = b.average_grade || 0;
                    break;
                default:
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
            }
            
            // Apply sort order
            if (sortOrder === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });
    
    // Format distance in kilometers
    const formatDistance = (distance) => {
        if (!distance) return '0 km';
        return (distance / 1000).toFixed(2) + ' km';
    };
    
    // Format time in minutes:seconds
    const formatTime = (seconds) => {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };
    
    // Add the missing formatSpeed function
    const formatSpeed = (distance, seconds) => {
        if (!distance || !seconds) return 'N/A';
        
        // Calculate speed in km/h
        const distanceKm = distance / 1000;
        const timeHours = seconds / 3600;
        const speedKmh = distanceKm / timeHours;
        
        return `${speedKmh.toFixed(1)} km/h`;
    };
    
    // Format time ago
    const formatTimeAgo = (date) => {
        if (!date) return '';
        
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval > 1) return interval + ' years ago';
        
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) return interval + ' months ago';
        
        interval = Math.floor(seconds / 86400);
        if (interval > 1) return interval + ' days ago';
        
        interval = Math.floor(seconds / 3600);
        if (interval > 1) return interval + ' hours ago';
        
        interval = Math.floor(seconds / 60);
        if (interval > 1) return interval + ' minutes ago';
        
        return Math.floor(seconds) + ' seconds ago';
    };
    
    // Handle sort change
    const handleSortChange = (field) => {
        if (sortBy === field) {
            // Toggle sort order if clicking the same field
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new sort field and default to ascending
            setSortBy(field);
            setSortOrder('asc');
        }
    };
    
    // Get data source message
    const getDataSourceMessage = () => {
        if (dataSource === 'loading') return 'Loading segments...';
        if (dataSource === 'database') return 'Segments loaded from database';
        if (dataSource === 'api') return 'Segments loaded from Strava API';
        return '';
    };
    
    // Add effect to handle clicking outside of dropdown menu
    useEffect(() => {
        function handleClickOutside(event) {
            if (refreshMenuRef.current && !refreshMenuRef.current.contains(event.target)) {
                setRefreshMenuOpen(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [refreshMenuRef]);
    
    // Update the segment cache status function to provide more user-friendly information
    const getSegmentCacheStatus = (segment) => {
        // Check for efforts cache - we can be more certain now thanks to server-side flags
        const hasEffortsCache = segment.efforts_cached || segment.has_efforts_cache;
        // Check when efforts were last updated
        const effortsUpdatedRecently = segment.efforts_updated_at && 
            new Date() - new Date(segment.efforts_updated_at) < 7 * 24 * 60 * 60 * 1000; // Within last 7 days
        
        return {
            efforts: {
                status: hasEffortsCache ? 'cached' : 'api',
                fresh: effortsUpdatedRecently,
                tooltip: hasEffortsCache 
                    ? `Efforts cached ${segment.efforts_updated_at ? formatTimeAgo(new Date(segment.efforts_updated_at)) : ''}`
                    : 'Will use Strava API to fetch efforts'
            }
        };
    };
    
    // Add a function to fetch athlete info
    const fetchAthleteInfo = useCallback(async () => {
        if (!accessToken) return;
        
        try {
            const response = await fetch(`/api/get-athlete-info?access_token=${accessToken}`);
            const data = await response.json();
            
            if (response.ok && data.athlete) {
                console.log('Connected Strava account:', data.athlete);
                setAthleteInfo(data.athlete);
            } else {
                console.error('Failed to fetch athlete info:', data.error);
            }
        } catch (err) {
            console.error('Error fetching athlete info:', err);
        }
    }, [accessToken]);

    // Call fetchAthleteInfo when access token is available
    useEffect(() => {
        if (accessToken) {
            fetchAthleteInfo();
        }
    }, [accessToken, fetchAthleteInfo]);
    
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Segment Analysis</h1>
            
            {/* Add account verification section */}
            {athleteInfo && (
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {athleteInfo.profile && (
                                <img 
                                    src={athleteInfo.profile} 
                                    alt={athleteInfo.firstname} 
                                    className="w-10 h-10 rounded-full mr-3"
                                />
                            )}
                            <div>
                                <p className="font-medium">
                                    Connected as: {athleteInfo.firstname} {athleteInfo.lastname}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Subscription: {athleteInfo.premium ? (
                                        <span className="text-green-600 font-medium">Premium ✓</span>
                                    ) : (
                                        <span className="text-yellow-600">Free Account</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.href = '/logout'}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 focus:outline-none"
                        >
                            Switch Account
                        </button>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}
            
            {/* Data Source Info */}
            {initialLoadComplete && (
                <div className={`mb-4 px-4 py-3 rounded border ${
                    dataSource === 'database' ? 'bg-green-50 border-green-200 text-green-800' : 
                    dataSource === 'api' ? 'bg-blue-50 border-blue-200 text-blue-800' : 
                    'bg-gray-50 border-gray-200 text-gray-800'
                }`}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p>{getDataSourceMessage()}</p>
                            {backgroundProcessing && (
                                <p className="text-sm mt-1">
                                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                                    Background processing in progress. New segments will appear automatically.
                                    {lastRefreshTime && (
                                        <span className="ml-2 text-xs text-gray-600">
                                            Last checked: {formatTimeAgo(lastRefreshTime)}
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Filters and Actions */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Segment Filters</h2>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={autoRefreshEnabled}
                                onChange={toggleAutoRefresh}
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700">
                                Auto-refresh {autoRefreshEnabled ? 'enabled' : 'disabled'}
                                {autoRefreshEnabled && (
                                    <span className="text-yellow-500 text-xs font-medium ml-2 px-2 py-1 bg-yellow-50 rounded-full">
                                        API Usage
                                    </span>
                                )}
                            </span>
                        </label>
                        
                        <div className="relative" ref={refreshMenuRef}>
                            <button
                                onClick={() => setRefreshMenuOpen(!refreshMenuOpen)}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                            >
                                {loading ? 'Refreshing...' : 'Refresh Options'}
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                            
                            {refreshMenuOpen && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                    <div className="p-2">
                                        <button
                                            onClick={() => {
                                                setRefreshMenuOpen(false);
                                                handleRefresh();
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center justify-between"
                                        >
                                            <div>
                                                <span className="font-medium">Refresh from Database</span>
                                                <p className="text-xs text-gray-500 mt-1">Loads segments from local database. Uses minimal API quota.</p>
                                            </div>
                                            <span className="text-green-500 text-xs font-medium px-2 py-1 bg-green-50 rounded-full">Safe</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => {
                                                setRefreshMenuOpen(false);
                                                handleForceReload();
                                            }}
                                            className="w-full text-left mt-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center justify-between"
                                        >
                                            <div>
                                                <span className="font-medium">Refresh from Strava API</span>
                                                <p className="text-xs text-gray-500 mt-1">Fetches fresh data directly from Strava. Uses significant API quota.</p>
                                            </div>
                                            <span className="text-yellow-500 text-xs font-medium px-2 py-1 bg-yellow-50 rounded-full">API Usage</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search Segments
                        </label>
                        <input
                            type="text"
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Activity Type
                        </label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">All Types</option>
                            {activityTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sort By
                        </label>
                        <div className="flex items-center">
                            <select
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="name">Name</option>
                                <option value="distance">Distance</option>
                                <option value="grade">Grade</option>
                            </select>
                            
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="ml-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Progress info */}
            {progressInfo && progressInfo.processedActivities > 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
                    <p>Processed {progressInfo.processedActivities} of {progressInfo.totalActivities} activities</p>
                    <p>Found {progressInfo.totalSegments} segments</p>
                </div>
            )}
            
            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Segments list */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Segments ({filteredSegments.length})</h2>
                            {loading && (
                                <div className="flex items-center text-blue-500">
                                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-sm">Loading</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Distance
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Grade
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredSegments.map(segment => (
                                        <tr 
                                            key={segment.strava_id} 
                                            className={`hover:bg-gray-50 cursor-pointer ${selectedSegment?.strava_id === segment.strava_id ? 'bg-orange-50' : ''}`}
                                            onClick={() => handleSegmentSelect(segment)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{segment.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500">{formatDistance(segment.distance)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500">{segment.average_grade ? segment.average_grade.toFixed(1) + '%' : 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    {segment.activity_type || 'Unknown'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {hasMore && (
                            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-center">
                                <button
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                                >
                                    {loading ? 'Loading...' : 'Load More Segments'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Segment details */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm h-full">
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold">Segment Details</h2>
                        </div>
                        
                        {selectedSegment ? (
                            <div className="p-4">
                                <h3 className="text-xl font-bold mb-2">{selectedSegment.name}</h3>
                                
                                {/* Only show efforts cache status */}
                                <div className="flex gap-2 mb-4">
                                    <span className={`px-2 py-1 inline-flex items-center text-xs leading-4 font-medium rounded-full ${
                                        getSegmentCacheStatus(selectedSegment).efforts.status === 'cached' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`} title={getSegmentCacheStatus(selectedSegment).efforts.tooltip}>
                                        {getSegmentCacheStatus(selectedSegment).efforts.status === 'cached' ? (
                                            <>
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                </svg>
                                                {getSegmentCacheStatus(selectedSegment).efforts.fresh ? 'Efforts Cached (Recent)' : 'Efforts Cached'}
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                                </svg>
                                                Efforts API Required
                                            </>
                                        )}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-gray-50 p-3 rounded-md">
                                        <p className="text-xs text-gray-500 mb-1">Distance</p>
                                        <p className="text-lg font-bold text-gray-800">{formatDistance(selectedSegment.distance)}</p>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-3 rounded-md">
                                        <p className="text-xs text-gray-500 mb-1">Grade</p>
                                        <p className="text-lg font-bold text-gray-800">{selectedSegment.average_grade ? selectedSegment.average_grade.toFixed(1) + '%' : 'N/A'}</p>
                                    </div>
                                </div>
                                
                                {/* Remove tabs - only show efforts */}
                                <h4 className="font-medium text-lg mb-4">Your Efforts</h4>
                                
                                {/* Your Efforts Tab */}
                                {loadingEfforts ? (
                                    <p className="text-center text-gray-500 py-4">Loading efforts...</p>
                                ) : segmentEfforts.length === 0 ? (
                                    <p className="text-center text-gray-500 py-4">No efforts found for this segment</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Date
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Time
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Speed
                                                    </th>
                                                    <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Achievement
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {segmentEfforts.map(effort => (
                                                    <tr key={effort.id}>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="text-sm text-gray-900">{formatDate(effort.start_date)}</div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">{formatTime(effort.elapsed_time)}</div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="text-sm text-gray-500">{formatSpeed(effort.distance, effort.elapsed_time)}</div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            {effort.pr_rank ? (
                                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                                    PR #{effort.pr_rank}
                                                                </span>
                                                            ) : effort.kom_rank ? (
                                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                                    KOM #{effort.kom_rank}
                                                                </span>
                                                            ) : (
                                                                <span className="text-sm text-gray-500">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-500">
                                <p>Select a segment to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SegmentAnalysis; 