import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register necessary components
Chart.register(...registerables);

const ActivitySummaryChart = ({ activities, metric = 'distance', timeframe = 'weekly' }) => {
  // Define getMetricLabel function before using it in useMemo
  const getMetricLabel = (metric) => {
    switch (metric) {
      case 'distance':
        return 'Distance (km)';
      case 'moving_time':
        return 'Moving Time (hours)';
      case 'elevation_gain':
        return 'Elevation Gain (m)';
      case 'count':
        return 'Number of Activities';
      default:
        return '';
    }
  };

  // Process activities data for the chart
  const chartData = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: 'rgba(249, 115, 22, 0.6)',
          borderColor: 'rgba(249, 115, 22, 1)',
          borderWidth: 1
        }]
      };
    }

    // Sort activities by date
    const sortedActivities = [...activities].sort((a, b) => 
      new Date(a.start_date) - new Date(b.start_date)
    );

    // Group activities by timeframe
    const groupedData = {};
    const labels = [];
    const data = [];

    sortedActivities.forEach(activity => {
      const date = new Date(activity.start_date);
      let key;

      if (timeframe === 'weekly') {
        // Get the week number
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        key = `Week ${weekNumber}, ${date.getFullYear()}`;
      } else if (timeframe === 'monthly') {
        // Get month name
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      } else {
        // Daily
        key = date.toISOString().split('T')[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          distance: 0,
          moving_time: 0,
          elevation_gain: 0,
          count: 0
        };
        labels.push(key);
      }

      // Accumulate metrics
      groupedData[key].distance += activity.distance || 0;
      groupedData[key].moving_time += activity.moving_time || 0;
      groupedData[key].elevation_gain += activity.total_elevation_gain || 0;
      groupedData[key].count += 1;
    });

    // Extract the requested metric
    labels.forEach(label => {
      let value;
      switch (metric) {
        case 'distance':
          // Convert to kilometers
          value = groupedData[label].distance / 1000;
          break;
        case 'moving_time':
          // Convert to hours
          value = groupedData[label].moving_time / 3600;
          break;
        case 'elevation_gain':
          value = groupedData[label].elevation_gain;
          break;
        case 'count':
          value = groupedData[label].count;
          break;
        default:
          value = 0;
      }
      data.push(value);
    });

    return {
      labels,
      datasets: [{
        label: getMetricLabel(metric),
        data,
        backgroundColor: 'rgba(249, 115, 22, 0.6)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1
      }]
    };
  }, [activities, metric, timeframe]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${getMetricLabel(metric)} by ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} Period`
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += metric === 'distance' ? 
                context.parsed.y.toFixed(2) + ' km' : 
                metric === 'moving_time' ? 
                  context.parsed.y.toFixed(2) + ' hours' : 
                  context.parsed.y.toFixed(0);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: getMetricLabel(metric)
        }
      },
      x: {
        title: {
          display: true,
          text: timeframe.charAt(0).toUpperCase() + timeframe.slice(1) + ' Period'
        }
      }
    }
  };

  return (
    <div className="w-full h-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default ActivitySummaryChart; 