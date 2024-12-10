import React, { useState } from 'react';
import Navbar from './Navbar';
import MapComponent from './MapComponent';
import SelectActivity from './SelectActivity';
import Sidebar from './Sidebar';
import './App.css';

function App() {
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [isSidebarRetracted, setIsSidebarRetracted] = useState(false);

    const handleSidebarToggle = (retracted) => {
        setIsSidebarRetracted(retracted);
    };

    return (
        <div className="App">
            <Navbar />
            <div className="main-container">
                <Sidebar onToggle={handleSidebarToggle} />
                <div className={`content-container ${isSidebarRetracted ? 'sidebar-retracted' : ''}`}>
                    <SelectActivity onSelectActivity={setSelectedActivity} />
                    <MapComponent selectedActivity={selectedActivity} />
                </div>
            </div>
        </div>
    );
}

export default App;