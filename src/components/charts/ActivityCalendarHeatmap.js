import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

const ActivityCalendarHeatmap = ({ activities, darkMode = false }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [dateOffset, setDateOffset] = useState(0); // 0 = current period, -1 = previous period, etc.
  const [effortMetric, setEffortMetric] = useState('training_load'); // 'training_load', 'distance', 'elevation', 'time'
  const [userProfile, setUserProfile] = useState(null);
  
  // Fetch user profile for more accurate calculations
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await axios.get('/get-user-profile');
        if (response.data && response.data.userProfile) {
          setUserProfile(response.data.userProfile);
          console.log('User profile loaded for training load calculations');
        }
      } catch (error) {
        console.error('Error fetching user profile for training load calculations:', error);
        // Continue with default values if profile can't be loaded
      }
    };
    
    fetchUserProfile();
  }, []);
  
  // Calculate Training Load Score for an activity
  const calculateTrainingLoad = (activity) => {
    if (!activity) return 0;
    
    // Activity type factors - different sports have different physiological demands
    const activityTypeFactor = {
      'Run': 1.0,
      'Ride': 0.75, // Cycling generally has lower physiological stress per minute than running
      'Swim': 0.85,
      'Hike': 0.8,
      'Walk': 0.6,
      'VirtualRide': 0.7,
      'WeightTraining': 0.65,
      'Workout': 0.7
    }[activity.type] || 0.75; // Default factor if type not found
    
    // Base metrics - calculate normalized values relative to common benchmarks
    const distance = activity.distance || 0; // in meters
    const elevGain = activity.total_elevation_gain || 0; // in meters
    const movingTime = activity.moving_time || 0; // in seconds
    const avgSpeed = activity.average_speed || 0; // in m/s
    
    // Calculate intensity factor based on available metrics
    let intensityFactor = 1.0;
    
    // If heart rate data is available, use it to calculate intensity using TRIMP formula
    if (activity.average_heartrate) {
      // Get profile-based values or use defaults
      const restingHR = userProfile?.resting_heart_rate || 60;
      const maxHR = userProfile?.max_heart_rate || 190;
      
      // Calculate heart rate reserve and use TRIMP formula
      // Heart Rate Reserve = (avg_hr - rest_hr) / (max_hr - rest_hr)
      const hrReserve = Math.max(0, Math.min(1, (activity.average_heartrate - restingHR) / (maxHR - restingHR)));
      
      // Use gender-specific TRIMP formula if gender is set
      let gender = userProfile?.gender || 'male';
      
      // TRIMP exponential formula with gender-specific constants
      if (gender === 'female') {
        // For females: 0.64 * e^(1.67 * HRR)
        intensityFactor = Math.min(2.5, 0.64 * Math.exp(1.67 * hrReserve));
      } else {
        // For males: 0.64 * e^(1.92 * HRR)
        intensityFactor = Math.min(2.5, 0.64 * Math.exp(1.92 * hrReserve));
      }
    } 
    // If power data available and the activity is a ride or virtual ride
    else if (activity.average_watts && (activity.type === 'Ride' || activity.type === 'VirtualRide')) {
      const userFTP = userProfile?.ftp || 200; // Default FTP if not set
      
      // Calculate intensity factor (IF = avg_power / FTP)
      const powerIF = activity.average_watts / userFTP;
      
      // Normalize using Training Stress Score (TSS) concept
      // TSS-like factor = IF^2 (squared to emphasize intensity)
      intensityFactor = Math.min(2.0, powerIF * powerIF);
    }
    // If no heart rate but average speed is available, use speed as intensity proxy
    else if (avgSpeed > 0) {
      // Different speed benchmarks for different activity types
      let speedFactor = 0;
      
      if (activity.type === 'Run') {
        // For running: moderate pace ~3.0 m/s (10.8 km/h)
        speedFactor = avgSpeed / 3.0;
      } else if (activity.type === 'Ride' || activity.type === 'VirtualRide') {
        // For cycling: moderate pace ~6.0 m/s (21.6 km/h)
        speedFactor = avgSpeed / 6.0;
      } else {
        // Default
        speedFactor = avgSpeed / 2.0;
      }
      
      // Cap and adjust the intensity factor
      intensityFactor = Math.min(2.0, Math.max(0.5, speedFactor));
    }
    
    // Calculate duration-based load (similar to TSS duration component)
    // Normalized to hours (using 3600 seconds as baseline)
    const durationLoad = (movingTime / 3600) * 100;
    
    // Calculate elevation-based load (similar to MTU concept, where 100m gain = 1 unit)
    // 1000m of elevation gain is roughly equivalent to 10km of flat distance in effort
    const elevationLoad = elevGain / 10;
    
    // Calculate distance-based load
    // Using the concept that 10km running = ~100 TSS at moderate pace
    // Scale by activity type
    const distanceLoad = (distance / 10000) * 100 * activityTypeFactor;
    
    // Combined training load based on weighted factors
    // If activity is very short but intense (like intervals), prioritize intensity more
    const isShortIntenseActivity = movingTime < 1800 && intensityFactor > 1.3; // Less than 30 min but high intensity
    
    let trainingLoad;
    if (isShortIntenseActivity) {
      // For short intense activities, intensity matters more than volume
      trainingLoad = (0.2 * distanceLoad + 0.2 * elevationLoad + 0.6 * durationLoad) * intensityFactor * intensityFactor;
    } else {
      // For normal activities, balance volume and intensity
      trainingLoad = (0.35 * distanceLoad + 0.25 * elevationLoad + 0.4 * durationLoad) * intensityFactor;
    }
    
    // Apply body weight factor if available (heavier athletes expend more energy)
    if (userProfile?.weight) {
      // Reference weight of 70kg
      const weightFactor = Math.sqrt(userProfile.weight / 70);
      trainingLoad *= weightFactor;
    }
    
    // Cap and scale for visualization purposes
    return Math.min(5, trainingLoad / 25);
  };
  
  // Process activity data for the heatmap
  const heatmapData = useMemo(() => {
    if (!activities || activities.length === 0) {
      return {
        months: [],
        data: {},
        effortData: {},
        weeklyEffort: {},
        maxValue: 0,
        maxEffort: 0
      };
    }

    // Get date range
    const dates = activities
      .filter(activity => activity.start_date)
      .map(activity => new Date(activity.start_date));
    
    if (dates.length === 0) return { 
      months: [], 
      data: {}, 
      effortData: {}, 
      weeklyEffort: {},
      maxValue: 0,
      maxEffort: 0
    };
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Ensure we cover at least the last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const startDate = minDate < oneYearAgo ? minDate : oneYearAgo;
    startDate.setDate(1); // Start from the 1st of the month
    
    // Create month labels
    const months = [];
    const currentDate = new Date(startDate);
    while (currentDate <= maxDate) {
      const monthName = currentDate.toLocaleString('en-US', { month: 'short' });
      months.push(`${monthName} ${currentDate.getFullYear()}`);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // Count activities and effort by date
    const activityCounts = {};
    const effortScores = {};
    const weeklyEffort = {};
    let totalActivities = 0;
    let activeDays = 0;
    let maxEffort = 0;
    
    activities.forEach(activity => {
      if (!activity.start_date) return;
      
      const date = new Date(activity.start_date);
      const dateKey = date.toISOString().split('T')[0];
      
      // Calculate week key for weekly accumulation
      // Get Monday of the week (to maintain ISO week standard)
      const weekDate = new Date(date);
      const day = weekDate.getDay();
      const diff = weekDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      weekDate.setDate(diff);
      const weekKey = weekDate.toISOString().split('T')[0];
      
      // Activity count
      if (!activityCounts[dateKey]) {
        activityCounts[dateKey] = 0;
        effortScores[dateKey] = 0;
        activeDays++;
      }
      
      activityCounts[dateKey]++;
      totalActivities++;
      
      // Calculate effort score
      const effortScore = calculateTrainingLoad(activity);
      effortScores[dateKey] += effortScore;
      
      // Update max effort
      if (effortScores[dateKey] > maxEffort) {
        maxEffort = effortScores[dateKey];
      }
      
      // Accumulate weekly effort
      if (!weeklyEffort[weekKey]) {
        weeklyEffort[weekKey] = {
          totalEffort: 0,
          activityCount: 0,
          startDate: weekDate
        };
      }
      
      weeklyEffort[weekKey].totalEffort += effortScore;
      weeklyEffort[weekKey].activityCount++;
    });
    
    // Find max value for color scaling
    const maxValue = Math.max(1, ...Object.values(activityCounts));
    
    return {
      months,
      data: activityCounts,
      effortData: effortScores,
      weeklyEffort,
      maxValue,
      maxEffort: Math.max(1, maxEffort),
      totalActivities,
      activeDays
    };
  }, [activities]);

  // Get color class based on effort intensity and theme
  const getEffortColorIntensity = (effort, maxEffort) => {
    if (!effort) return darkMode ? 'bg-gray-800' : 'bg-gray-100';
    
    const intensity = Math.min(1, effort / maxEffort);
    
    if (darkMode) {
      // Dark mode with color gradient from blue (low) to orange (high)
      if (intensity < 0.2) return 'bg-blue-900';
      if (intensity < 0.4) return 'bg-teal-800';
      if (intensity < 0.6) return 'bg-emerald-700';
      if (intensity < 0.8) return 'bg-amber-700';
      return 'bg-orange-600';
    } else {
      // Light mode with color gradient from blue (low) to orange (high)
      if (intensity < 0.2) return 'bg-blue-100';
      if (intensity < 0.4) return 'bg-teal-200';
      if (intensity < 0.6) return 'bg-emerald-300';
      if (intensity < 0.8) return 'bg-amber-300';
      return 'bg-orange-400';
    }
  };

  // Get color class based on activity count and theme (original method)
  const getColorIntensity = (count, maxValue) => {
    if (!count) return darkMode ? 'bg-gray-800' : 'bg-gray-100';
    
    const intensity = Math.min(1, count / maxValue);
    
    if (darkMode) {
      // Dark mode color scheme
      if (intensity < 0.2) return 'bg-green-900';
      if (intensity < 0.4) return 'bg-green-800';
      if (intensity < 0.6) return 'bg-green-700';
      if (intensity < 0.8) return 'bg-green-600';
      return 'bg-green-500';
    } else {
      // Light mode color scheme
      if (intensity < 0.2) return 'bg-green-100';
      if (intensity < 0.4) return 'bg-green-200';
      if (intensity < 0.6) return 'bg-green-300';
      if (intensity < 0.8) return 'bg-green-400';
      return 'bg-green-500';
    }
  };

  // Navigate to previous period
  const handlePrevPeriod = () => {
    setDateOffset(prev => prev - 1);
  };

  // Navigate to next period
  const handleNextPeriod = () => {
    if (dateOffset < 0) {
      setDateOffset(prev => prev + 1);
    }
  };

  // Change effort metric
  const handleChangeEffortMetric = (e) => {
    setEffortMetric(e.target.value);
  };

  // Get day name for each day of the week
  const getDayName = (dayIndex) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[dayIndex];
  };

  // Render calendar with consecutive days from top to bottom
  const renderCalendar = () => {
    if (heatmapData.months.length === 0) {
      return (
        <div className={`text-center ${darkMode ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-50'} py-8 rounded-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p>No activity data available</p>
          <p className="text-sm mt-2 text-gray-500">Connect your Strava account to see your activities here</p>
        </div>
      );
    }

    // Calculate date range (considering offset)
    const today = new Date();
    const weeksToShow = 8; // Show 8 weeks at once
    
    // Find current week's Monday
    const currentWeekMonday = new Date(today);
    const currentDay = currentWeekMonday.getDay();
    const diff = currentWeekMonday.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust when day is Sunday
    currentWeekMonday.setDate(diff);
    
    // Calculate end date based on offset (end date is Sunday)
    let endDate = new Date(currentWeekMonday);
    endDate.setDate(endDate.getDate() + (weeksToShow * 7) - 1); // Add weeks and subtract 1 to get to Sunday
    
    if (dateOffset < 0) {
      // Move backward by the offset in weeks
      currentWeekMonday.setDate(currentWeekMonday.getDate() + (dateOffset * weeksToShow * 7));
      endDate.setDate(endDate.getDate() + (dateOffset * weeksToShow * 7));
    }
    
    // Start date is the Monday of the first week
    const startDate = new Date(currentWeekMonday);
    
    // Generate week column headers
    const weekHeaders = [];
    
    for (let week = 0; week < weeksToShow; week++) {
      const weekStartDate = new Date(startDate);
      weekStartDate.setDate(startDate.getDate() + (week * 7));
      
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      
      // Format the date range
      const startMonth = weekStartDate.toLocaleString('en-US', { month: 'short' });
      const endMonth = weekEndDate.toLocaleString('en-US', { month: 'short' });
      
      let header;
      if (startMonth === endMonth) {
        header = `${startMonth} ${weekStartDate.getDate()}-${weekEndDate.getDate()}`;
      } else {
        header = `${startMonth} ${weekStartDate.getDate()} - ${endMonth} ${weekEndDate.getDate()}`;
      }
      
      // Get the week key for weekly effort summary
      const weekKey = weekStartDate.toISOString().split('T')[0];
      const weekSummary = heatmapData.weeklyEffort[weekKey];
      
      const weeklyEffortText = weekSummary 
        ? `Week Total: ${weekSummary.totalEffort.toFixed(1)} TL` 
        : '';
      
      // Determine if this is a high load week for highlighting
      const isHighLoad = weekSummary && weekSummary.totalEffort > (heatmapData.maxEffort * 0.7);
      
      weekHeaders.push(
        <th 
          key={`week-${week}`} 
          className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'} py-3 px-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${
            isHighLoad ? (darkMode ? 'bg-amber-900/30' : 'bg-amber-50') : ''
          }`}
        >
          <div>
            {header}
            {weekSummary && (
              <div className={`mt-1 text-xs ${isHighLoad ? (darkMode ? 'text-orange-400' : 'text-orange-600') : (darkMode ? 'text-blue-400' : 'text-blue-600')}`}>
                {weeklyEffortText}
              </div>
            )}
          </div>
        </th>
      );
    }
    
    // Generate rows for each day of the week (Monday-Sunday)
    const rows = [];
    
    // Day name header row
    const dayNameRow = (
      <tr key="day-names" className={`${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
        {[...Array(weeksToShow)].map((_, weekIndex) => (
          <td key={`week-title-${weekIndex}`} className="p-1 text-center">
            <div className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Week {weekIndex + 1}
            </div>
          </td>
        ))}
      </tr>
    );
    
    rows.push(dayNameRow);
    
    // Generate a row for each day of the week
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayCells = [];
      
      for (let week = 0; week < weeksToShow; week++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (week * 7) + dayOfWeek);
        
        const dateKey = date.toISOString().split('T')[0];
        const count = heatmapData.data[dateKey] || 0;
        const effort = heatmapData.effortData[dateKey] || 0;
        
        const colorClass = effortMetric === 'training_load' 
          ? getEffortColorIntensity(effort, heatmapData.maxEffort)
          : getColorIntensity(count, heatmapData.maxValue);
          
        const isToday = dateKey === today.toISOString().split('T')[0];
        const isFuture = date > today;
        const isHovered = hoveredDay === dateKey;
        
        // Format the day for display (e.g., "Mon 15")
        const dayNum = date.getDate();
        
        // Get the day name
        const dayName = getDayName(dayOfWeek);
        
        // Get the full date for tooltip
        const tooltipDate = date.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric' 
        });
        
        const tooltipContent = `${tooltipDate}: ${count} ${count === 1 ? 'activity' : 'activities'}, Training Load: ${effort.toFixed(1)}`;
        
        dayCells.push(
          <td key={dateKey} className={`p-1 relative ${dayOfWeek % 2 === 1 ? (darkMode ? 'bg-gray-800/30' : 'bg-gray-50/50') : ''}`}>
            <div 
              className={`flex items-center py-1 px-2 rounded-md ${isHovered ? (darkMode ? 'bg-gray-700' : 'bg-gray-100') : ''} transition-colors duration-150`}
              onMouseEnter={() => setHoveredDay(dateKey)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span className={`text-sm font-medium ${isToday ? (darkMode ? 'text-blue-300' : 'text-blue-600') : (darkMode ? 'text-gray-300' : 'text-gray-700')} mr-3 w-16`}>
                {dayName} {dayNum}
              </span>
              <div 
                className={`w-5 h-5 ${colorClass} ${isToday ? 'ring-2 ring-blue-500' : ''} ${isFuture ? 'opacity-50' : ''} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-md transition-all ${isHovered ? 'scale-125' : ''} hover:z-10 shadow-sm`}
                aria-label={tooltipContent}
                role="img"
                data-tooltip={tooltipContent}
              ></div>
              
              {isHovered && (
                <div className={`absolute z-20 -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-md shadow-lg text-xs whitespace-nowrap ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'} border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  {tooltipContent}
                </div>
              )}
            </div>
          </td>
        );
      }
      
      rows.push(
        <tr key={`day-${dayOfWeek}`} className={`border-t border-gray-200 dark:border-gray-700 ${
          dayOfWeek === 5 || dayOfWeek === 6 ? (darkMode ? 'bg-gray-700/20' : 'bg-gray-100/40') : ''
        }`}>
          {dayCells}
        </tr>
      );
    }
    
    return (
      <div className="ml-0 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {weekHeaders}
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    );
  };

  // Calculate recommended recovery weeks
  const getRecoveryWeekRecommendation = () => {
    if (!heatmapData.weeklyEffort || Object.keys(heatmapData.weeklyEffort).length === 0) {
      return null;
    }
    
    // Sort weeks by date
    const sortedWeeks = Object.entries(heatmapData.weeklyEffort)
      .sort(([weekA], [weekB]) => new Date(weekA) - new Date(weekB))
      .map(([week, data]) => ({ week, ...data }));
      
    if (sortedWeeks.length < 3) return null;
    
    // Find weeks with high load (top 25% of effort)
    const effortValues = sortedWeeks.map(week => week.totalEffort);
    const highLoadThreshold = Math.max(...effortValues) * 0.75;
    
    // Count consecutive high load weeks
    let consecutiveHighLoad = 0;
    let needsRecoveryAfter = null;
    
    for (let i = 0; i < sortedWeeks.length; i++) {
      if (sortedWeeks[i].totalEffort >= highLoadThreshold) {
        consecutiveHighLoad++;
        
        // After 3-4 weeks of high load, recommend recovery
        if (consecutiveHighLoad >= 3 && !needsRecoveryAfter) {
          needsRecoveryAfter = sortedWeeks[i].week;
        }
      } else {
        consecutiveHighLoad = 0;
      }
    }
    
    if (needsRecoveryAfter) {
      const recoveryWeekDate = new Date(needsRecoveryAfter);
      recoveryWeekDate.setDate(recoveryWeekDate.getDate() + 7); // Next week
      
      return {
        message: "Recovery week recommended after:",
        date: recoveryWeekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
    
    return null;
  };

  // Activity stats summary
  const renderStats = () => {
    if (heatmapData.totalActivities === 0) return null;
    
    const recoveryRecommendation = getRecoveryWeekRecommendation();
    
    return (
      <div className="space-y-6 mb-6">
        <div className={`grid grid-cols-2 md:grid-cols-5 gap-4 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-all duration-300 hover:shadow-md`}>
            <p className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Total Activities</p>
            <p className="text-2xl font-bold">{heatmapData.totalActivities}</p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-all duration-300 hover:shadow-md`}>
            <p className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Active Days</p>
            <p className="text-2xl font-bold">{heatmapData.activeDays}</p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-all duration-300 hover:shadow-md`}>
            <p className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Most in a Day</p>
            <p className="text-2xl font-bold">{heatmapData.maxValue}</p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-all duration-300 hover:shadow-md`}>
            <p className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Avg per Active Day</p>
            <p className="text-2xl font-bold">
              {heatmapData.activeDays ? (heatmapData.totalActivities / heatmapData.activeDays).toFixed(1) : '0'}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'} transition-all duration-300 hover:shadow-md`}>
            <p className={`text-xs uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1`}>Max Training Load</p>
            <p className="text-2xl font-bold">
              {heatmapData.maxEffort.toFixed(1)}
            </p>
          </div>
        </div>
        
        {recoveryRecommendation && (
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${darkMode ? 'border-amber-600' : 'border-amber-500'} border-l-4 transition-all duration-300 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${darkMode ? 'text-amber-400' : 'text-amber-500'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
              </svg>
              <p className="font-medium">{recoveryRecommendation.message} <span className="font-bold">{recoveryRecommendation.date}</span></p>
            </div>
            <p className="mt-1 text-sm opacity-75">Based on your recent training load, a recovery week with reduced intensity would help prevent overtraining.</p>
          </div>
        )}
      </div>
    );
  };

  // Calculate date range labels for navigation
  const getDateRangeLabel = () => {
    const today = new Date();
    const weeksToShow = 8; // Show 8 weeks at once
    
    // Find current week's Monday
    const currentWeekMonday = new Date(today);
    const currentDay = currentWeekMonday.getDay();
    const diff = currentWeekMonday.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust when day is Sunday
    currentWeekMonday.setDate(diff);
    
    // Calculate end date based on offset
    let endDate = new Date(currentWeekMonday);
    endDate.setDate(endDate.getDate() + (weeksToShow * 7) - 1); // End date is Sunday
    
    if (dateOffset < 0) {
      // Move backward by the offset in weeks
      currentWeekMonday.setDate(currentWeekMonday.getDate() + (dateOffset * weeksToShow * 7));
      endDate.setDate(endDate.getDate() + (dateOffset * weeksToShow * 7));
    }
    
    const startDateFormat = currentWeekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endDateFormat = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return `${startDateFormat} - ${endDateFormat}`;
  };

  return (
    <div className="flex flex-col">
      {renderStats()}
      
      <div className={`overflow-x-auto pb-6 rounded-lg shadow-sm ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border p-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <div className="flex items-center">
            <button 
              onClick={handlePrevPeriod}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
              aria-label="Previous period"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} mx-2`}>
              {getDateRangeLabel()}
            </span>
            
            <button 
              onClick={handleNextPeriod}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'} ${dateOffset === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Next period"
              disabled={dateOffset === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center">
            <label className={`mr-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Color by:
            </label>
            <select 
              value={effortMetric} 
              onChange={handleChangeEffortMetric}
              className={`rounded-md border px-2 py-1 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-700'}`}
            >
              <option value="training_load">Training Load</option>
              <option value="count">Activity Count</option>
            </select>
          </div>
        </div>
      
        {renderCalendar()}
      
        <div className="flex items-center mt-6 text-xs">
          <span className={`mr-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {effortMetric === 'training_load' ? 'Low Effort' : 'Less'}
          </span>
          <div className="flex space-x-1">
            {effortMetric === 'training_load' ? (
              // Effort intensity legend (blue to orange)
              <>
                <div className={`w-4 h-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-blue-900' : 'bg-blue-100'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-teal-800' : 'bg-teal-200'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-emerald-700' : 'bg-emerald-300'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-amber-700' : 'bg-amber-300'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-orange-600' : 'bg-orange-400'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
              </>
            ) : (
              // Activity count legend (greens)
              <>
                <div className={`w-4 h-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-green-900' : 'bg-green-100'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-green-800' : 'bg-green-200'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-green-700' : 'bg-green-300'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-green-600' : 'bg-green-400'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
                <div className={`w-4 h-4 ${darkMode ? 'bg-green-500' : 'bg-green-500'} border ${darkMode ? 'border-gray-700' : 'border-white'} rounded-sm shadow-sm`}></div>
              </>
            )}
          </div>
          <span className={`ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {effortMetric === 'training_load' ? 'High Effort' : 'More'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityCalendarHeatmap; 