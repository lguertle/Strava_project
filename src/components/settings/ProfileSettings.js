import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ProfileSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [profile, setProfile] = useState({
    resting_heart_rate: 60,
    max_heart_rate: 180,
    weight: 70,
    height: 175,
    age: 30,
    gender: 'male',
    ftp: 200,
    preferred_units: 'metric',
    zones: {
      heart_rate: {
        zone1: { min: 0, max: 0 },
        zone2: { min: 0, max: 0 },
        zone3: { min: 0, max: 0 },
        zone4: { min: 0, max: 0 },
        zone5: { min: 0, max: 0 }
      },
      power: {
        zone1: { min: 0, max: 0 },
        zone2: { min: 0, max: 0 },
        zone3: { min: 0, max: 0 },
        zone4: { min: 0, max: 0 },
        zone5: { min: 0, max: 0 },
        zone6: { min: 0, max: 0 },
        zone7: { min: 0, max: 0 }
      }
    }
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/get-user-profile');
        
        if (response.data && response.data.userProfile) {
          // Fill in any missing properties with defaults
          const userProfile = response.data.userProfile;
          setProfile(prevProfile => ({
            ...prevProfile,
            ...userProfile,
            zones: {
              heart_rate: {
                ...prevProfile.zones.heart_rate,
                ...(userProfile.zones?.heart_rate || {})
              },
              power: {
                ...prevProfile.zones.power,
                ...(userProfile.zones?.power || {})
              }
            }
          }));
        }
      } catch (err) {
        console.error('Error fetching user profile', err);
        setError('Failed to load your profile. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Calculate heart rate zones based on resting and max HR
  useEffect(() => {
    if (profile.resting_heart_rate && profile.max_heart_rate) {
      const hrReserve = profile.max_heart_rate - profile.resting_heart_rate;
      
      const updatedZones = {
        zone1: { 
          min: Math.round(profile.resting_heart_rate),
          max: Math.round(profile.resting_heart_rate + (hrReserve * 0.6))
        },
        zone2: { 
          min: Math.round(profile.resting_heart_rate + (hrReserve * 0.6) + 1),
          max: Math.round(profile.resting_heart_rate + (hrReserve * 0.7))
        },
        zone3: { 
          min: Math.round(profile.resting_heart_rate + (hrReserve * 0.7) + 1),
          max: Math.round(profile.resting_heart_rate + (hrReserve * 0.8))
        },
        zone4: { 
          min: Math.round(profile.resting_heart_rate + (hrReserve * 0.8) + 1),
          max: Math.round(profile.resting_heart_rate + (hrReserve * 0.9))
        },
        zone5: { 
          min: Math.round(profile.resting_heart_rate + (hrReserve * 0.9) + 1),
          max: Math.round(profile.max_heart_rate)
        }
      };

      setProfile(prevProfile => ({
        ...prevProfile,
        zones: {
          ...prevProfile.zones,
          heart_rate: updatedZones
        }
      }));
    }
  }, [profile.resting_heart_rate, profile.max_heart_rate]);

  // Calculate power zones based on FTP
  useEffect(() => {
    if (profile.ftp) {
      const ftp = profile.ftp;
      
      const updatedZones = {
        zone1: { min: 0, max: Math.round(ftp * 0.55) },
        zone2: { min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75) },
        zone3: { min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.9) },
        zone4: { min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
        zone5: { min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.2) },
        zone6: { min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.5) },
        zone7: { min: Math.round(ftp * 1.51), max: Math.round(ftp * 2.0) },
      };

      setProfile(prevProfile => ({
        ...prevProfile,
        zones: {
          ...prevProfile.zones,
          power: updatedZones
        }
      }));
    }
  }, [profile.ftp]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Handle numeric inputs
    const numericFields = ['resting_heart_rate', 'max_heart_rate', 'weight', 'height', 'age', 'ftp'];
    const processedValue = numericFields.includes(name) ? Number(value) : value;
    
    setProfile({
      ...profile,
      [name]: processedValue
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      console.log('Submitting profile data:', profile);
      const response = await axios.post('/update-user-profile', profile);
      
      console.log('Profile update response:', response.data);
      
      if (response.data && response.data.userProfile) {
        setSuccess('Profile saved successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      } else {
        console.warn('Received unexpected response format:', response.data);
        setError('Received unexpected response format from server');
      }
    } catch (err) {
      console.error('Error updating profile', err);
      // Display more detailed error information
      if (err.response) {
        console.error('Error status:', err.response.status);
        console.error('Error data:', err.response.data);
        
        // Set more specific error message based on status code
        if (err.response.status === 401) {
          setError('Authentication error. Please log in again.');
        } else if (err.response.status === 404) {
          setError('User profile not found. Please try refreshing the page.');
        } else if (err.response.status === 500) {
          setError(`Server error: ${err.response.data.error || 'Unknown error'}`);
        } else {
          setError(`Failed to save your profile: ${err.response.data.error || 'Please try again.'}`);
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error('No response received:', err.request);
        setError('No response from server. Please check your connection and try again.');
      } else {
        // Something else caused the error
        setError('Failed to save your profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Profile Settings</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Update your personal information to improve training load calculations and fitness tracking.
      </p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{success}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Personal Information</h3>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="age">
                Age
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="age"
                name="age"
                type="number"
                min="0"
                max="120"
                value={profile.age || ''}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="gender">
                Gender
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="gender"
                name="gender"
                value={profile.gender || 'male'}
                onChange={handleInputChange}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="weight">
                Weight (kg)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="weight"
                name="weight"
                type="number"
                min="0"
                step="0.1"
                value={profile.weight || ''}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="height">
                Height (cm)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="height"
                name="height"
                type="number"
                min="0"
                value={profile.height || ''}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Performance Metrics</h3>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="resting_heart_rate">
                Resting Heart Rate (bpm)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="resting_heart_rate"
                name="resting_heart_rate"
                type="number"
                min="30"
                max="100"
                value={profile.resting_heart_rate || ''}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your heart rate when completely at rest, typically measured first thing in the morning.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="max_heart_rate">
                Maximum Heart Rate (bpm)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="max_heart_rate"
                name="max_heart_rate"
                type="number"
                min="100"
                max="240"
                value={profile.max_heart_rate || ''}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your highest sustainable heart rate during maximum exertion.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="ftp">
                Functional Threshold Power (FTP)
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="ftp"
                name="ftp"
                type="number"
                min="0"
                max="500"
                value={profile.ftp || ''}
                onChange={handleInputChange}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The highest average power you can sustain for a one-hour all-out effort.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-bold mb-2" htmlFor="preferred_units">
                Preferred Units
              </label>
              <select
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-gray-200 dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="preferred_units"
                name="preferred_units"
                value={profile.preferred_units || 'metric'}
                onChange={handleInputChange}
              >
                <option value="metric">Metric (km, kg)</option>
                <option value="imperial">Imperial (miles, lbs)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Training Zones</h3>
          
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-600 dark:text-gray-300 mb-3">Heart Rate Zones</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white dark:bg-gray-700 rounded-lg">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 text-left text-xs font-semibold uppercase tracking-wider">
                    <th className="px-4 py-2">Zone</th>
                    <th className="px-4 py-2">Range (bpm)</th>
                    <th className="px-4 py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600 dark:text-gray-200">
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">Zone 1</td>
                    <td className="px-4 py-2">{profile.zones.heart_rate.zone1.min} - {profile.zones.heart_rate.zone1.max}</td>
                    <td className="px-4 py-2">Very light / Recovery</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">Zone 2</td>
                    <td className="px-4 py-2">{profile.zones.heart_rate.zone2.min} - {profile.zones.heart_rate.zone2.max}</td>
                    <td className="px-4 py-2">Light / Endurance</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">Zone 3</td>
                    <td className="px-4 py-2">{profile.zones.heart_rate.zone3.min} - {profile.zones.heart_rate.zone3.max}</td>
                    <td className="px-4 py-2">Moderate / Tempo</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">Zone 4</td>
                    <td className="px-4 py-2">{profile.zones.heart_rate.zone4.min} - {profile.zones.heart_rate.zone4.max}</td>
                    <td className="px-4 py-2">Hard / Threshold</td>
                  </tr>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">Zone 5</td>
                    <td className="px-4 py-2">{profile.zones.heart_rate.zone5.min} - {profile.zones.heart_rate.zone5.max}</td>
                    <td className="px-4 py-2">Maximum / Anaerobic</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Heart rate zones are automatically calculated based on your resting and maximum heart rate.
            </p>
          </div>
          
          {profile.ftp > 0 && (
            <div>
              <h4 className="text-md font-medium text-gray-600 dark:text-gray-300 mb-3">Power Zones</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white dark:bg-gray-700 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 text-left text-xs font-semibold uppercase tracking-wider">
                      <th className="px-4 py-2">Zone</th>
                      <th className="px-4 py-2">Range (watts)</th>
                      <th className="px-4 py-2">% of FTP</th>
                      <th className="px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-200">
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 1</td>
                      <td className="px-4 py-2">{profile.zones.power.zone1.min} - {profile.zones.power.zone1.max}</td>
                      <td className="px-4 py-2">0-55%</td>
                      <td className="px-4 py-2">Active Recovery</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 2</td>
                      <td className="px-4 py-2">{profile.zones.power.zone2.min} - {profile.zones.power.zone2.max}</td>
                      <td className="px-4 py-2">56-75%</td>
                      <td className="px-4 py-2">Endurance</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 3</td>
                      <td className="px-4 py-2">{profile.zones.power.zone3.min} - {profile.zones.power.zone3.max}</td>
                      <td className="px-4 py-2">76-90%</td>
                      <td className="px-4 py-2">Tempo</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 4</td>
                      <td className="px-4 py-2">{profile.zones.power.zone4.min} - {profile.zones.power.zone4.max}</td>
                      <td className="px-4 py-2">91-105%</td>
                      <td className="px-4 py-2">Threshold</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 5</td>
                      <td className="px-4 py-2">{profile.zones.power.zone5.min} - {profile.zones.power.zone5.max}</td>
                      <td className="px-4 py-2">106-120%</td>
                      <td className="px-4 py-2">VO2 Max</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 6</td>
                      <td className="px-4 py-2">{profile.zones.power.zone6.min} - {profile.zones.power.zone6.max}</td>
                      <td className="px-4 py-2">121-150%</td>
                      <td className="px-4 py-2">Anaerobic Capacity</td>
                    </tr>
                    <tr className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">Zone 7</td>
                      <td className="px-4 py-2">{profile.zones.power.zone7.min} - {profile.zones.power.zone7.max}</td>
                      <td className="px-4 py-2">151%+</td>
                      <td className="px-4 py-2">Neuromuscular Power</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Power zones are automatically calculated based on your FTP.
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings; 