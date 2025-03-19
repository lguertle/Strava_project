import React, { useMemo } from 'react';

const ActivityStatsCard = ({ activities, title, icon, statType }) => {
  const stats = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        total: 0,
        avg: 0,
        max: 0,
        count: 0
      };
    }

    // Filter out activities with invalid data for the stat type
    const validActivities = activities.filter(activity => {
      switch (statType) {
        case 'distance':
          return activity.distance && activity.distance > 0;
        case 'elevation':
          return activity.total_elevation_gain && activity.total_elevation_gain >= 0;
        case 'time':
          return activity.moving_time && activity.moving_time > 0;
        case 'speed':
          return activity.average_speed && activity.average_speed > 0;
        case 'heartrate':
          return activity.average_heartrate && activity.average_heartrate > 0;
        default:
          return true;
      }
    });

    if (validActivities.length === 0) {
      return {
        total: 0,
        avg: 0,
        max: 0,
        count: 0
      };
    }

    let total = 0;
    let max = 0;

    validActivities.forEach(activity => {
      let value;
      switch (statType) {
        case 'distance':
          value = activity.distance;
          break;
        case 'elevation':
          value = activity.total_elevation_gain;
          break;
        case 'time':
          value = activity.moving_time;
          break;
        case 'speed':
          value = activity.average_speed;
          break;
        case 'heartrate':
          value = activity.average_heartrate;
          break;
        default:
          value = 0;
      }

      total += value;
      max = Math.max(max, value);
    });

    return {
      total,
      avg: total / validActivities.length,
      max,
      count: validActivities.length
    };
  }, [activities, statType]);

  const formatValue = (value, type) => {
    switch (type) {
      case 'distance':
        return (value / 1000).toFixed(1) + ' km';
      case 'elevation':
        return value.toFixed(0) + ' m';
      case 'time':
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      case 'speed':
        return (value * 3.6).toFixed(1) + ' km/h'; // Convert m/s to km/h
      case 'heartrate':
        return value.toFixed(0) + ' bpm';
      default:
        return value.toString();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flex items-center mb-3">
        <div className="bg-orange-100 p-2 rounded-full mr-3">
          <span className="text-orange-500 text-xl">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-lg font-bold text-gray-800">{formatValue(stats.total, statType)}</p>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-500 mb-1">Average</p>
          <p className="text-lg font-bold text-gray-800">{formatValue(stats.avg, statType)}</p>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-500 mb-1">Maximum</p>
          <p className="text-lg font-bold text-gray-800">{formatValue(stats.max, statType)}</p>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          <p className="text-xs text-gray-500 mb-1">Activities</p>
          <p className="text-lg font-bold text-gray-800">{stats.count}</p>
        </div>
      </div>
    </div>
  );
};

export default ActivityStatsCard; 