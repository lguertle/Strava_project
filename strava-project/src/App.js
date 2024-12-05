import React, { useState } from 'react';
import Navbar from './Navbar';
import MapComponent from './MapComponent';
import SelectActivity from './SelectActivity';
import './App.css';

function App() {
    const [selectedActivity, setSelectedActivity] = useState(null);

    return (
        <div className="App">
            <Navbar />
            <div className="main-container">
                <MapComponent selectedActivity={selectedActivity} />
                <SelectActivity onSelectActivity={setSelectedActivity} />
            </div>
        </div>
    );
}

export default App;