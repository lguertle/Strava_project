import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';

// Register necessary components
Chart.register(...registerables);

const HeartRateChart = ({ activityId }) => {
    const [heartRateData, setHeartRateData] = useState([]);
    const [distanceData, setDistanceData] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHeartRateData = async () => {
            try {
                const response = await axios.get('/api/get-heart-rate-data');
                const activityData = response.data[activityId];
                
                if (activityData && activityData.data && activityData.distance) {
                    setHeartRateData(activityData.data);
                    setDistanceData(activityData.distance.map(d => (d / 1000).toFixed(2))); // Convert to km
                    setError(null);
                } else {
                    setError('No heart rate data available for this activity');
                    setHeartRateData([]);
                    setDistanceData([]);
                }
            } catch (error) {
                console.error('Error fetching heart rate data:', error);
                setError('Failed to fetch heart rate data');
                setHeartRateData([]);
                setDistanceData([]);
            }
        };

        if (activityId) {
            fetchHeartRateData();
        }
    }, [activityId]);

    if (error) {
        return (
            <div className="heart-rate-chart">
                <h3>Heart Rate Data</h3>
                <p className="error-message">{error}</p>
            </div>
        );
    }

    if (heartRateData.length === 0) {
        return (
            <div className="heart-rate-chart">
                <h3>Heart Rate Data</h3>
                <p>No heart rate data available for this activity</p>
            </div>
        );
    }

    const chartData = {
        labels: distanceData,
        datasets: [
            {
                label: 'Heart Rate (bpm)',
                data: heartRateData,
                borderColor: 'rgba(255, 0, 0, 1)',
                backgroundColor: 'rgba(255, 0, 0, 0.2)',
                pointRadius: 1,
                fill: true,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Heart Rate vs Distance'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Heart Rate (bpm)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Distance (km)'
                }
            }
        }
    };

    return (
        <div className="heart-rate-chart">
            <h3>Heart Rate Data</h3>
            <Line data={chartData} options={options} />
        </div>
    );
};

export default HeartRateChart;