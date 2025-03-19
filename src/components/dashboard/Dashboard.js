import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
// CSS imports are now handled centrally in src/map-libraries.css
import '../../styles/leaflet-fix.css';
import ActivitySidebar from './ActivitySidebar';

// Fix Leaflet's default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const Dashboard = () => {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]);
  const [mapZoom, setMapZoom] = useState(13);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        console.log('Fetching activities from server...');
        setIsLoading(true);
        const response = await fetch('/api/get-activities');
        
        if (!response.ok) {
          console.error(`HTTP error fetching activities: ${response.status}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Activities API response:', data);
        
        if (data.activities && Array.isArray(data.activities)) {
          console.log(`${data.activities.length} activities fetched successfully`);
          setActivities(data.activities);
          
          // Select the first activity by default if available
          if (data.activities.length > 0) {
            console.log('Setting first activity as selected:', data.activities[0].name);
            setSelectedActivity(data.activities[0]);
            
            // Set map center to first activity's starting point if available
            if (data.activities[0].start_latlng && data.activities[0].start_latlng.length === 2) {
              console.log('Setting map center to activity start point:', data.activities[0].start_latlng);
              setMapCenter(data.activities[0].start_latlng);
            } else if (data.activities[0].map && data.activities[0].map.summary_polyline) {
              const points = decodePolyline(data.activities[0].map.summary_polyline);
              if (points.length > 0) {
                console.log('Setting map center to first point of activity polyline');
                setMapCenter(points[0]);
              }
            }
          } else {
            console.log('No activities returned from API');
          }
        } else {
          console.warn('Invalid response format from activities API:', data);
          setActivities([]);
        }
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError('Failed to load activities. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
    
    // Update map center based on selected activity
    if (activity.start_latlng && activity.start_latlng.length === 2) {
      setMapCenter(activity.start_latlng);
    } else if (activity.map && activity.map.summary_polyline) {
      const points = decodePolyline(activity.map.summary_polyline);
      if (points.length > 0) {
        setMapCenter(points[0]);
      }
    }
  };

  // Function to decode polyline
  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    
    let points = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
  };

  const getActivityIcon = (type) => {
    // Create custom icons based on activity type
    const iconUrl = type && type.toLowerCase().includes('ride') 
      ? 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png'  // Bike icon
      : 'https://cdn-icons-png.flaticon.com/512/2972/2972276.png'; // Run icon
    
    return L.icon({
      iconUrl,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      {/* Main content area with map */}
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 mb-1">Dashboard</h1>
              <p className="text-sm text-gray-500">View and analyze your recent activities</p>
            </div>
            <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-medium">
              {activities.length} Activities
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 flex justify-center items-center h-[500px]">
            <div className="loading-spinner w-8 h-8"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 h-[500px] flex items-center justify-center">
            <div className="text-center max-w-md">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <p className="text-gray-800 font-medium mb-3">{error}</p>
              <p className="text-gray-500 text-sm mb-4">We couldn't load your activities. Please try again.</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 transition-all duration-300 shadow-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 h-[500px] flex items-center justify-center">
            <div className="text-center max-w-md">
              <svg className="w-12 h-12 text-orange-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <p className="text-gray-800 font-medium mb-3">No Activities Found</p>
              <p className="text-gray-500 text-sm mb-4">Connect with Strava to see your activities and find KOM opportunities.</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
              >
                Connect with Strava
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden h-[500px]">
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              style={{ height: '100%', width: '100%' }}
              key={`map-${selectedActivity?.strava_id || 'default'}`}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {activities.map(activity => (
                activity.start_latlng && activity.start_latlng.length === 2 && (
                  <Marker 
                    key={activity.strava_id} 
                    position={activity.start_latlng}
                    icon={getActivityIcon(activity.type)}
                    eventHandlers={{
                      click: () => handleActivitySelect(activity)
                    }}
                  >
                    <Popup className="activity-popup">
                      <div className="text-center py-1">
                        <h3 className="font-medium text-sm">{activity.name}</h3>
                        <div className="text-xs text-gray-500 mt-1">
                          <p>{new Date(activity.start_date).toLocaleDateString()}</p>
                          <p>{(activity.distance / 1000).toFixed(2)} km</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              ))}

              {selectedActivity && selectedActivity.map && selectedActivity.map.summary_polyline && (
                <Polyline 
                  positions={decodePolyline(selectedActivity.map.summary_polyline)}
                  color="#f97316"
                  weight={4}
                  opacity={0.8}
                />
              )}
            </MapContainer>
          </div>
        )}

        {/* Recent activities list */}
        {!isLoading && !error && activities.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mt-4">
            <h2 className="text-md font-medium text-gray-800 mb-3">Recent Activities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activities.slice(0, 6).map((activity) => (
                <div 
                  key={activity.strava_id}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                    selectedActivity && selectedActivity.strava_id === activity.strava_id 
                      ? 'bg-orange-50 border border-orange-200 shadow-sm' 
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleActivitySelect(activity)}
                  tabIndex="0"
                  aria-label={`Select activity: ${activity.name}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivitySelect(activity)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800 truncate">{activity.name}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{activity.type}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="flex items-center justify-between">
                      <span>{new Date(activity.start_date).toLocaleDateString()}</span>
                      <span>{(activity.distance / 1000).toFixed(1)} km</span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-gray-200">
                      <div className="flex items-center">
                        <svg className="w-3 h-3 mr-1 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <span>{Math.floor(activity.moving_time / 60)} min</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity sidebar */}
      {selectedActivity && (
        <div className="w-full md:w-80 bg-white rounded-lg shadow-md">
          <ActivitySidebar activity={selectedActivity} />
        </div>
      )}
    </div>
  );
};

export default Dashboard; 