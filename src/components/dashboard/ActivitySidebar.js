import React from 'react';

const ActivitySidebar = ({ activity }) => {
  if (!activity) return null;

  // Format date
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format duration (seconds to hh:mm:ss)
  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hours > 0 ? hours : null,
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // Format pace (meters per second to min/km)
  const formatPace = (metersPerSecond) => {
    if (!metersPerSecond) return '-';
    
    const secondsPerKm = 1000 / metersPerSecond;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  // Get activity type icon
  const getActivityIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'run':
      case 'running':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        );
      case 'ride':
      case 'cycling':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      case 'swim':
      case 'swimming':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
        );
    }
  };

  const formatStravaId = (id) => {
    if (!id) return '';
    // If id is already a string, use it, otherwise convert to string
    return typeof id === 'string' ? id : id.toString();
  };

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex items-center mb-4">
        <div className="p-2 rounded-full bg-orange-50 text-orange-500 mr-3 shadow-sm">
          {getActivityIcon(activity.type)}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{activity.name || 'Unnamed Activity'}</h2>
          <p className="text-xs text-gray-500">{formatDate(activity.start_date)}</p>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
            <p className="text-xs text-gray-500 uppercase mb-1">Distance</p>
            <p className="text-base font-medium text-gray-800">
              {activity.distance ? (activity.distance / 1000).toFixed(2) + ' km' : '-'}
            </p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
            <p className="text-xs text-gray-500 uppercase mb-1">Duration</p>
            <p className="text-base font-medium text-gray-800">
              {formatDuration(activity.moving_time)}
            </p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
            <p className="text-xs text-gray-500 uppercase mb-1">Avg. Speed</p>
            <p className="text-base font-medium text-gray-800">
              {activity.average_speed ? (activity.average_speed * 3.6).toFixed(1) + ' km/h' : '-'}
            </p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
            <p className="text-xs text-gray-500 uppercase mb-1">Avg. Pace</p>
            <p className="text-base font-medium text-gray-800">
              {formatPace(activity.average_speed)}
            </p>
          </div>
        </div>
      </div>

      {activity.total_elevation_gain > 0 && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Elevation Gain</p>
                <p className="text-base font-medium text-gray-800">
                  {activity.total_elevation_gain} m
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
          </div>
        </div>
      )}

      {activity.average_heartrate && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
              <p className="text-xs text-gray-500 uppercase mb-1">Avg. Heart Rate</p>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <p className="text-base font-medium text-gray-800">
                  {Math.round(activity.average_heartrate)} bpm
                </p>
              </div>
            </div>
            
            {activity.max_heartrate && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 transition-all duration-300 hover:border-gray-200 hover:shadow-sm">
                <p className="text-xs text-gray-500 uppercase mb-1">Max Heart Rate</p>
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-red-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base font-medium text-gray-800">
                    {Math.round(activity.max_heartrate)} bpm
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 mt-4">
        <a 
          href={`https://www.strava.com/activities/${formatStravaId(activity.strava_id || activity.id)}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-all duration-300 shadow-sm hover:shadow transform hover:-translate-y-0.5"
          aria-label="View activity on Strava"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5.41 13.943h4.172l2.836-5.598z" />
          </svg>
          View on Strava
        </a>
      </div>
    </div>
  );
};

export default ActivitySidebar; 