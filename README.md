# KOM Hunter

A React-based web application that integrates with Strava API to help cyclists analyze their activities and find KOM (King of the Mountain) opportunities.

## Core Features

- **Strava OAuth Integration** - Securely connect to your Strava account
- **Activity Analytics** - Visualize your rides with detailed metrics
- **Segment Analysis** - Find your best segments and KOM opportunities
- **Interactive Maps** - View activities with Mapbox integration
- **Webhook Support** - Real-time activity updates

## Tech Stack

### Frontend
- **React** - Component-based UI library
- **TailwindCSS** - Utility-first CSS framework
- **Mapbox GL** - Interactive mapping
- **Chart.js** - Data visualization
- **React Router** - Client-side routing

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - Database for activity and segment storage
- **Strava API** - Activity and segment data
- **OAuth 2.0** - Authentication via Strava

## Quick Start

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/lguertle/strava-project.git
   cd strava-project
   npm install
   ```

2. **Set up environment variables**
   - Create a `.env` file based on `.env.example`
   - Add your Strava API credentials

3. **Start development server**
   ```bash
   npm run dev
   ```

## Project Structure

- `/src` - React frontend
- `/server` - Node.js backend
- `/public` - Static assets
- `/docs` - Documentation

## API Integration

KOM Hunter connects with Strava's API to access:
- Athlete profile information
- Activity records
- Segment leaderboards
- Webhook events for real-time updates

## License

MIT License

## Contact

Created by Laurent Gürtler (laurent.guertler@gmail.com)
