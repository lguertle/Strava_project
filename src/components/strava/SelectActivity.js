import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import HeartRateChart from '../charts/HeartRateChart';

const SelectActivity = ({ activities = [], onSelectActivity, showSidebar, setShowSidebar }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [activitiesPerPage] = useState(10);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [error, setError] = useState('');
    const [activityType, setActivityType] = useState('All');
    const [localActivities, setLocalActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Use refs to track fetch state and prevent duplicate requests
    const fetchInProgress = useRef(false);
    const hasFetchedActivities = useRef(false);
    const abortControllerRef = useRef(null);

    // Memoize the fetch function to prevent recreating it on every render
    const fetchActivities = useCallback(async (force = false) => {
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
            console.log('Fetching activities...');
            
            const response = await axios.get('/api/get-activities', {
                signal: abortControllerRef.current.signal
            });
            
            console.log('Activities response received:', response.status);
            
            // Ensure we're setting an array
            const activitiesData = Array.isArray(response.data) ? response.data : 
                                  (response.data && Array.isArray(response.data.activities)) ? response.data.activities : [];
            
            console.log(`Received ${activitiesData.length} activities`);
            setLocalActivities(activitiesData);
            
            // Mark that we've successfully fetched activities
            hasFetchedActivities.current = true;
        } catch (error) {
            // Don't show error for aborted requests
            if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
                console.error('Error fetching activities:', error);
                setError('Failed to fetch activities.');
            }
        } finally {
            setIsLoading(false);
            fetchInProgress.current = false;
        }
    }, []);

    // If activities are passed as props, use them
    useEffect(() => {
        if (activities && activities.length > 0) {
            console.log('Using provided activities from props:', activities.length);
            setLocalActivities(activities);
            hasFetchedActivities.current = true;
        } else if (!hasFetchedActivities.current && !fetchInProgress.current) {
            // Only fetch on initial mount if no activities provided
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

    // Ensure filteredActivities is always an array
    const filteredActivities = Array.isArray(localActivities) ? 
        (activityType === 'All' 
            ? localActivities 
            : localActivities.filter(activity => activity.type === activityType))
        : [];

    // Get current activities
    const indexOfLastActivity = currentPage * activitiesPerPage;
    const indexOfFirstActivity = indexOfLastActivity - activitiesPerPage;
    const currentActivities = filteredActivities.slice(indexOfFirstActivity, indexOfLastActivity);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => setCurrentPage((prevPage) => Math.min(prevPage + 1, Math.ceil(filteredActivities.length / activitiesPerPage)));
    const prevPage = () => setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));

    const handleSelect = (activity) => {
        setSelectedActivity(activity);
        if (onSelectActivity) {
            onSelectActivity(activity);
        }
        // Show the sidebar when an activity is selected
        if (setShowSidebar && !showSidebar) {
            setShowSidebar(true);
        }
    };

    const handleFilterChange = (event) => {
        setActivityType(event.target.value);
        setCurrentPage(1); // Reset to the first page when filter changes
    };

    const totalPages = Math.ceil(filteredActivities.length / activitiesPerPage);

    const formatDistance = (distance) => {
        return (distance / 1000).toFixed(2) + ' km';
    };

    const formatTime = (time) => {
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    // Manual refresh button handler - force a new fetch
    const handleRefresh = () => {
        if (!fetchInProgress.current) {
            fetchActivities(true); // Pass true to force a refresh
        }
    };

    return (
        <div className="p-5 bg-gray-50 h-full overflow-y-auto flex flex-col">
            <h2 className="mt-0 mb-5 text-orange-500 text-2xl border-b border-gray-200 pb-2.5">Select an Activity</h2>
            {error && (
                <p className="text-red-600 p-2.5 bg-red-50 rounded border border-red-200 mb-5">{error}</p>
            )}
            
            <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center">
                    <label htmlFor="activity-type" className="mr-2.5 font-medium text-gray-700">Filter by type:</label>
                    <select 
                        id="activity-type" 
                        value={activityType} 
                        onChange={handleFilterChange}
                        className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm flex-grow focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                        <option value="All">All</option>
                        <option value="Ride">Ride</option>
                        <option value="Run">Run</option>
                        <option value="VirtualRide">Virtual Ride</option>
                        <option value="WeightTraining">Weight Training</option>
                    </select>
                </div>
                
                <button 
                    onClick={handleRefresh}
                    disabled={isLoading || fetchInProgress.current}
                    className="px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <span className="flex items-center">
                            <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></span>
                            Loading...
                        </span>
                    ) : 'Refresh'}
                </button>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-24 text-gray-600">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mr-3"></div>
                    Loading activities...
                </div>
            ) : (
                <>
                    {filteredActivities.length === 0 ? (
                        <p className="text-center text-gray-600 p-5 bg-gray-50 rounded border border-gray-200">
                            No activities found. Try a different filter or connect to Strava.
                        </p>
                    ) : (
                        <>
                            <ul className="list-none p-0 m-0 mb-5 flex-grow overflow-y-auto">
                                {currentActivities.map((activity) => (
                                    <li 
                                        key={activity.id || activity._id} 
                                        className="mb-2.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                        onClick={() => handleSelect(activity)}
                                    >
                                        <div className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${
                                            selectedActivity && (selectedActivity.id === activity.id || selectedActivity._id === activity._id)
                                                ? 'border-orange-500 bg-orange-50'
                                                : 'border-gray-200'
                                        }`}>
                                            <h4 className="m-0 mb-2.5 text-base text-gray-800">{activity.name}</h4>
                                            <div className="flex justify-between text-sm text-gray-600">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                                                    {activity.type}
                                                </span>
                                                <span>{formatDistance(activity.distance)}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            
                            <div className="flex justify-center items-center mt-5 gap-2.5">
                                <button 
                                    onClick={() => paginate(1)} 
                                    disabled={currentPage === 1}
                                    className="bg-white border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    1
                                </button>
                                <button 
                                    onClick={prevPage} 
                                    disabled={currentPage === 1}
                                    className="bg-white border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    &lt;
                                </button>
                                <span className="text-gray-600 mx-2.5">
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                                <button 
                                    onClick={nextPage} 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="bg-white border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    &gt;
                                </button>
                                <button 
                                    onClick={() => paginate(totalPages)} 
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="bg-white border border-gray-300 text-gray-700 px-2.5 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {totalPages || 1}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
            
            {selectedActivity && (
                <div className="mt-5 p-5 bg-white rounded-lg shadow-sm">
                    <h3 className="mt-0 text-orange-500 text-lg mb-4 border-b border-gray-200 pb-2.5">Selected Activity</h3>
                    <p className="my-2 text-gray-700"><span className="font-medium">Title:</span> {selectedActivity.name}</p>
                    <p className="my-2 text-gray-700"><span className="font-medium">Distance:</span> {formatDistance(selectedActivity.distance)}</p>
                    <p className="my-2 text-gray-700"><span className="font-medium">Moving Time:</span> {formatTime(selectedActivity.moving_time)}</p>
                    <p className="my-2 text-gray-700"><span className="font-medium">Elevation Gain:</span> {selectedActivity.total_elevation_gain} meters</p>
                    <HeartRateChart activityId={selectedActivity.id || selectedActivity._id} />
                </div>
            )}
        </div>
    );
};

export default SelectActivity;