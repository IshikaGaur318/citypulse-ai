# CityPulse AI — Full-Stack Smart City Intelligence Dashboard

CityPulse AI is a full-stack smart city simulation and machine learning dashboard that visualizes urban indicators and generates predictions for traffic flow, air quality, energy usage, and water reserves.

## Features

* Interactive smart city dashboard with urban metrics
* Traffic, air quality, energy, and water indicators
* Python machine learning predictions using Random Forest models
* Node.js and Express backend API
* React dashboard connected to backend prediction endpoints
* Interactive charts and historical simulation trends
* Selectable city districts
* Rule-based alerts and AI-style insights
* Simulation controls: pause, resume, reset, and manual updates
* Simulation history and CSV export
* MongoDB Atlas database integration/configuration

## Technology Stack

### Frontend

* React
* Vite
* JavaScript
* Recharts
* CSS

### Backend

* Node.js
* Express.js
* REST API

### AI / Machine Learning

* Python
* scikit-learn
* Random Forest regression models

### Database

* MongoDB Atlas

## Architecture

1. The React frontend displays city metrics, charts, and prediction cards.
2. The Node.js/Express backend provides API endpoints to the frontend.
3. The Python machine learning model generates predictions for selected urban indicators.
4. MongoDB Atlas provides database connectivity for supported application data.

## Run Locally

### 1. Start the backend

Open a terminal in the project directory:

```bash
cd server
npm install
node index.js
```

Configure the required environment variables in `server/.env` before starting the backend.

### 2. Start the frontend

Open a second terminal in the project root:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

### 3. Python environment

Install the Python dependencies required by `ai_model.py` in your Python environment before running predictions.

## Data and AI Notice

CityPulse AI is a smart city simulation and machine learning demonstration project. Its dashboard can use simulated demonstration data, while the prediction endpoint runs the configured Python ML model. It is not currently presented as a live city-sensor monitoring system.

## Future Improvements

* Integrate real-time city sensor APIs
* Improve data persistence and historical storage
* Add authentication and role-based access
* Deploy the frontend, backend, and ML service online
* Add prediction accuracy evaluation and monitoring

## Project Goal

Demonstrate how a full-stack web application can combine an interactive dashboard, backend APIs, database connectivity, and machine learning predictions for a smart city digital twin concept.

