import React from 'react';
import './Navbar.css';
import StravaConnect from './StravaConnect';

const Navbar = () => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <h1>KOM Hunter</h1>
            </div>
            <div className="navbar-links">
                <StravaConnect />
            </div>
        </nav>
    );
};

export default Navbar;