import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import axios from 'axios';

// Register necessary components
Chart.register(...registerables);

const HeartRateChart = ({ activityId }) => {
    const [heartRateData, setHeartRateData] = useState([]);
    const [distanceData, setDistanceData] = useState([]);

    useEffect(() => {
        const fetchHeartRateData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/get-heart-rate-data');
                const data = response.data[activityId];
                if (data) {
                    const heartRateStream = data.find(stream => stream.type === 'heartrate');
                    const distanceStream = data.find(stream => stream.type === 'distance');
                    if (heartRateStream && distanceStream) {
                        setHeartRateData(heartRateStream.data);
                        setDistanceData(distanceStream.data.map(d => (d / 1000).toFixed(2))); // Convert to km
                    }
                }
            } catch (error) {
                console.error('Failed to fetch heart rate data:', error);
            }
        };

        if (activityId) {
            fetchHeartRateData();
        }
    }, [activityId]);

    const chartData = {
        labels: distanceData,
        datasets: [
            {
                label: 'Heart Rate',
                data: heartRateData,
                borderColor: 'rgba(255, 0, 0, 1)', // Red color
                backgroundColor: 'rgba(255, 0, 0, 0.2)', // Light red background
                pointRadius: 1, // Very small data points
                fill: true,
            },
        ],
    };

    return (
        <div>
            <h3>Heart Rate Data</h3>
            <Line data={chartData} />
        </div>
    );
};

export default HeartRateChart;