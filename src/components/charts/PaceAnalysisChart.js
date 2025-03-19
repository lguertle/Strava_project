import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register necessary components
Chart.register(...registerables);

const PaceAnalysisChart = ({ activities, activityType = 'Ride' }) => {
  // Process activities data for the chart
  const chartData = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Speed',
          data: [],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
        }]
      };
    }

    // Filter activities by type and ensure they have distance and time
    const filteredActivities = activities
      .filter(activity => 
        activity.type === activityType && 
        activity.distance > 0 && 
        activity.moving_time > 0 &&
        activity.start_date
      )
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    if (filteredActivities.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Speed',
          data: [],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
        }]
      };
    }

    // Calculate speed (km/h) for each activity
    const speedData = filteredActivities.map(activity => {
      // Convert m/s to km/h: (distance in meters / time in seconds) * 3.6
      return (activity.distance / activity.moving_time) * 3.6;
    });

    // Format dates for labels
    const labels = filteredActivities.map(activity => {
      const date = new Date(activity.start_date);
      return date.toLocaleDateString();
    });

    // Calculate moving average for smoother trend line
    const movingAverageSpeed = [];
    const windowSize = Math.min(5, speedData.length); // Use smaller window for fewer data points
    
    for (let i = 0; i < speedData.length; i++) {
      let sum = 0;
      let count = 0;
      
      // Calculate average of surrounding points
      for (let j = Math.max(0, i - Math.floor(windowSize/2)); 
           j <= Math.min(speedData.length - 1, i + Math.floor(windowSize/2)); 
           j++) {
        sum += speedData[j];
        count++;
      }
      
      movingAverageSpeed.push(sum / count);
    }

    return {
      labels,
      datasets: [
        {
          label: `${activityType} Speed (km/h)`,
          data: speedData,
          borderColor: 'rgba(75, 192, 192, 0.5)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          pointRadius: 3,
          pointBackgroundColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1,
          fill: false
        },
        {
          label: 'Trend (Moving Average)',
          data: movingAverageSpeed,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.4,
          fill: false
        }
      ]
    };
  }, [activities, activityType]);

  const formatSpeed = (speed) => {
    if (isNaN(speed)) return '-';
    return speed.toFixed(1);
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${activityType} Speed Trends Over Time`
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatSpeed(context.parsed.y) + ' km/h';
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        reverse: false, // Higher speed is better, don't reverse the scale
        title: {
          display: true,
          text: 'Speed (km/h)'
        },
        ticks: {
          callback: function(value) {
            return formatSpeed(value);
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    }
  };

  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default PaceAnalysisChart; 