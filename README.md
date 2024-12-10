# KOM Hunter

A web application that integrates with Strava to visualize and analyze your cycling activities. Built with React and Flask, this application allows you to view your activities on an interactive map, analyze heart rate data, and filter through your Strava history.

![Demo](docs/assets/demo.gif)

## Features

- **Strava Integration**: Connect seamlessly with your Strava account to access your activities
- **Interactive Map**: Visualize your activities on a Mapbox-powered map with customizable styles
- **Activity Filtering**: Filter activities by type (Ride, Run, Virtual Ride, etc.)
- **Heart Rate Analysis**: View heart rate data for selected activities
- **Responsive Design**: Clean and intuitive interface that works across different screen sizes

## Tech Stack

- **Frontend**: 
  - React
  - Mapbox GL JS
  - Chart.js for data visualization
  - Axios for API requests

- **Backend**:
  - Flask
  - Azure Blob Storage for data persistence
  - Strava API integration

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.x
- Azure Storage account
- Strava API credentials
- Mapbox API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lguertle/Strava_project.git
cd Strava_project

2. Install frontend dependencies:
```bash
npm install

3. Install backend dependencies:
```bash
pip install -r requirements.txt

4. Create a .env file in the root directory:
```bash
CLIENT_ID=your_strava_client_id
CLIENT_SECRET=your_strava_client_secret
REDIRECT_URI=http://localhost:5000/oauth/callback
CONNECTION_STRING=your_azure_storage_connection_string
REACT_APP_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

### Running the Application

1. Start the Flask backend:
```bash
python blob_storage.py

2. Start the React frontend:
```bash
npm start

3. Open your browser and navigate to http://localhost:3000

## Usage

1. **Connect Your Strava Account**
   - Click "Connect to Strava" to authorize the application
   - Grant necessary permissions to access your activity data

2. **View Your Activities**
   - Activities are automatically fetched and displayed in the sidebar
   - Filter activities by type (Ride, Run, etc.)

3. **Explore Activities on the Map**
   - Select any activity from the sidebar to view its route
   - The map will automatically zoom to fit the selected route

4. **Map Controls**
   - 🗺️ **View Options**
     - Toggle between classic and satellite map styles using the "Map Style" menu
   - 🔍 **Navigation**
     - Use the search bar to find specific locations
     - Click the locate icon to find your current position
   - 📊 **Data Visualization**
     - View heart rate data charts for selected activities
     - Track elevation profiles along your routes

5. **Data Analysis**
   - Analyze heart rate zones for each activity
   - View detailed statistics including distance, time, and elevation gain

## License
This project is released under the MIT License.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## Contact
Created by Laurent Gürtler.
For inquiries, please email at laurent.guertler@gmail.com.

## Acknowledgments
- Strava API for activity data
- Mapbox for mapping functionality
- Chart.js for data visualization
