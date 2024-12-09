import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SelectActivity.css';
import HeartRateChart from './HeartRateChart';

const SelectActivity = ({ onSelectActivity }) => {
    const [activities, setActivities] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activitiesPerPage] = useState(10); // Adjust the number of activities per page to fit within the fixed height
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [error, setError] = useState('');
    const [activityType, setActivityType] = useState('All');

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await axios.get('http://localhost:5000/get-activities');
                setActivities(response.data);
            } catch (error) {
                setError('Failed to fetch activities.');
            }
        };

        fetchActivities();
    }, []);

    // Get current activities
    const indexOfLastActivity = currentPage * activitiesPerPage;
    const indexOfFirstActivity = indexOfLastActivity - activitiesPerPage;
    const filteredActivities = activityType === 'All' ? activities : activities.filter(activity => activity.type === activityType);
    const currentActivities = filteredActivities.slice(indexOfFirstActivity, indexOfLastActivity);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => setCurrentPage((prevPage) => Math.min(prevPage + 1, Math.ceil(filteredActivities.length / activitiesPerPage)));
    const prevPage = () => setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));

    const handleSelect = (activity) => {
        setSelectedActivity(activity);
        onSelectActivity(activity);
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

    return (
        <div className="select-activity-container">
            <h2>Select an Activity</h2>
            {error && <p>{error}</p>}
            <div className="filter-container">
                <label htmlFor="activity-type">Filter by type:</label>
                <select id="activity-type" value={activityType} onChange={handleFilterChange}>
                    <option value="All">All</option>
                    <option value="Ride">Ride</option>
                    <option value="Run">Run</option>
                    <option value="VirtualRide">Virtual Ride</option>
                    <option value="WeightTraining">Weight Training</option>
                    {/* Add more options as needed */}
                </select>
            </div>
            <ul>
                {currentActivities.map((activity) => (
                    <li key={activity.id} onClick={() => handleSelect(activity)}>
                        {activity.name}
                    </li>
                ))}
            </ul>
            <div className="pagination">
                <button onClick={() => paginate(1)} disabled={currentPage === 1}>
                    1
                </button>
                <button onClick={prevPage} disabled={currentPage === 1}>
                    &lt;
                </button>
                <span className="page-info">
                    Page {currentPage} of {totalPages}
                </span>
                <button onClick={nextPage} disabled={currentPage === totalPages}>
                    &gt;
                </button>
                <button onClick={() => paginate(totalPages)} disabled={currentPage === totalPages}>
                    {totalPages}
                </button>
            </div>
            {selectedActivity && (
                <div className="selected-activity">
                    <h3>Selected Activity</h3>
                    <p>Title: {selectedActivity.name}</p>
                    <p>Distance: {formatDistance(selectedActivity.distance)}</p>
                    <p>Moving Time: {formatTime(selectedActivity.moving_time)}</p>
                    <p>Elevation Gain: {selectedActivity.total_elevation_gain} meters</p>
                    <HeartRateChart activityId={selectedActivity.id} />
                </div>
            )}
        </div>
    );
};

export default SelectActivity;