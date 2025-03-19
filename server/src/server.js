const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Initialize Express app
const app = express();

// Force using port 5000 by killing any process using it
const PORT = 5000;
try {
    // Attempt to kill any process using port 5000
    console.log(`Ensuring port ${PORT} is available...`);
    if (process.platform === 'win32') {
        try {
            // Get the PID
            const pidCommand = `netstat -ano | findstr :${PORT} | findstr LISTENING`;
            const output = execSync(pidCommand).toString();
            const pidMatch = output.match(/\s+(\d+)$/m);
            
            if (pidMatch && pidMatch[1]) {
                const pid = pidMatch[1];
                console.log(`Found process ${pid} using port ${PORT}, killing it...`);
                execSync(`taskkill /F /PID ${pid}`);
                console.log(`Process ${pid} killed successfully.`);
            }
        } catch (err) {
            // If no process is found or there's another error, it's okay
            console.log(`No process found using port ${PORT} or failed to kill: ${err.message}`);
        }
    } else {
        // For Unix-like systems (Linux, macOS)
        try {
            execSync(`lsof -ti:${PORT} | xargs kill -9`);
            console.log(`Any process using port ${PORT} has been killed.`);
        } catch (err) {
            console.log(`No process found using port ${PORT} or failed to kill.`);
        }
    }
} catch (error) {
    console.log(`Failed to free up port ${PORT}: ${error.message}`);
}

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../build')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Check if MongoDB connection string is available
if (!process.env.DB_CONNECTION) {
    console.error('DB_CONNECTION environment variable is not set!');
    console.log('Environment variables loaded:');
    console.log('- CLIENT_ID:', process.env.CLIENT_ID ? 'Set' : 'Not set');
    console.log('- REDIRECT_URI:', process.env.REDIRECT_URI ? 'Set' : 'Not set');
    process.exit(1);
}

// MongoDB connection
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.DB_CONNECTION)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const activitiesRoutes = require('./routes/activities');
const segmentsRoutes = require('./routes/segments');
const webhookRoutes = require('./routes/webhooks');

// Use routes
app.use('/', authRoutes);
app.use('/api', activitiesRoutes);
app.use('/api', segmentsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Simple test route
app.get('/api/test', (req, res) => {
    res.json({
        message: 'API is working',
        time: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Server error',
        message: err.message
    });
});

// Catch-all route for React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../build', 'index.html'));
});

// Start server with fixed port
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Ensure the .env file has the correct value
    try {
        const fs = require('fs');
        const envPath = path.resolve(__dirname, '../../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Update PORT to 5000
        envContent = envContent.replace(/PORT=\d+/, `PORT=${PORT}`);
        
        // Update REDIRECT_URI if it contains a different port
        if (process.env.REDIRECT_URI && !process.env.REDIRECT_URI.includes(`:${PORT}`)) {
            const originalRedirectUri = process.env.REDIRECT_URI;
            const portRegex = /:\d+\//;
            const newRedirectUri = originalRedirectUri.replace(portRegex, `:${PORT}/`);
            envContent = envContent.replace(originalRedirectUri, newRedirectUri);
        }
        
        fs.writeFileSync(envPath, envContent);
        
        // Update proxy in package.json to point to port 5000
        const packagePath = path.resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (packageJson.proxy && !packageJson.proxy.includes(`:${PORT}`)) {
            packageJson.proxy = `http://localhost:${PORT}`;
            fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        }
    } catch (error) {
        console.error('Error updating configuration files:', error);
    }
}).on('error', (error) => {
    console.error(`Failed to start server on port ${PORT}:`, error.message);
    process.exit(1);
}); 