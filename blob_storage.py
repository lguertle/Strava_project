import requests
import json
import time
import os
import logging
from flask_cors import CORS
from flask import Flask, request, redirect, jsonify, send_from_directory
from azure.storage.blob import BlobServiceClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder=os.path.abspath('strava-project/build'), static_url_path='')
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)

client_id = os.getenv('CLIENT_ID')
client_secret = os.getenv('CLIENT_SECRET')
redirect_uri = os.getenv('REDIRECT_URI')
connection_string = os.getenv('CONNECTION_STRING')
mapbox_access_token = os.getenv('MAPBOX_ACCESS_TOKEN')

logging.info(f"CLIENT_ID: {client_id}")
logging.info(f"CLIENT_SECRET: {client_secret}")
logging.info(f"REDIRECT_URI: {redirect_uri}")
logging.info(f"CONNECTION_STRING: {connection_string}")
logging.info(f"MAPBOX_ACCESS_TOKEN: {mapbox_access_token}")

# Define container name
container_name = "strava-data"

# Serve the React app
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/authorize')
def authorize():
    # Redirect to Strava's authorization page
    auth_url = (
        f"https://www.strava.com/oauth/authorize?client_id={client_id}&"
        f"response_type=code&redirect_uri={redirect_uri}&"
        "approval_prompt=force&scope=read,activity:read_all"
    )
    return jsonify({"auth_url": auth_url})

@app.route('/oauth/callback')
def oauth_callback():
    code = request.args.get('code')
    
    # Exchange the authorization code for an access token
    token_url = "https://www.strava.com/oauth/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    
    response = requests.post(token_url, data=payload, headers=headers)
    
    if response.status_code != 200:
        logging.error(f"Failed to get access token: {response.text}")
        return f"Failed to get access token: {response.text}"

    access_token_info = response.json()
    access_token = access_token_info.get('access_token')

    if not access_token:
        logging.error("Failed to retrieve access token.")
        return "Failed to retrieve access token."

    # Store the access token in session or database for later use
    # For simplicity, we'll return it in the response
    return redirect(f'/fetch-activities?access_token={access_token}')

@app.route('/fetch-activities')
def fetch_activities():
    access_token = request.args.get('access_token')

    if not access_token:
        logging.error("Access token is missing.")
        return "Access token is missing."

    activities_url = "https://www.strava.com/api/v3/athlete/activities"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    all_activities = []
    all_heart_rate_data = {}
    per_page = 20  # Limit to the last 20 activities

    params = {
        "per_page": per_page
    }

    response = requests.get(activities_url, headers=headers, params=params)
    
    if response.status_code != 200:
        logging.error(f"Failed to fetch activities: {response.text}")
        return f"Failed to fetch activities: {response.text}"

    activities = response.json()
    all_activities.extend(activities)

    # Fetch heart rate data for each activity
    for activity in activities:
        activity_id = activity['id']
        heart_rate_url = f"https://www.strava.com/api/v3/activities/{activity_id}/streams?keys=heartrate"
        hr_response = requests.get(heart_rate_url, headers=headers)
        if hr_response.status_code == 200:
            heart_rate_data = hr_response.json()
            all_heart_rate_data[activity_id] = heart_rate_data

    # Convert all activities data to JSON format
    activity_json = json.dumps(all_activities)
    heart_rate_json = json.dumps(all_heart_rate_data)

    # Upload activity data to Azure Blob Storage
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(container=container_name, blob="activities.json")
        blob_client.upload_blob(activity_json, overwrite=True)
        logging.info("Uploaded activities to Azure Blob Storage")

        blob_client = blob_service_client.get_blob_client(container=container_name, blob="heart_rate_data.json")
        blob_client.upload_blob(heart_rate_json, overwrite=True)
        logging.info("Uploaded heart rate data to Azure Blob Storage")
    except Exception as e:
        logging.error(f"Failed to upload data to Azure Blob Storage: {str(e)}")
        return f"Failed to upload data to Azure Blob Storage: {str(e)}"

    return redirect('/')

@app.route('/get-heart-rate-data', methods=['GET'])
def get_heart_rate_data():
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(container=container_name, blob="heart_rate_data.json")
        heart_rate_data = blob_client.download_blob().readall()
        return jsonify(json.loads(heart_rate_data))
    except Exception as e:
        logging.error(f"Failed to get heart rate data from Azure Blob Storage: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-activities', methods=['GET'])
def get_activities():
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(container=container_name, blob="activities.json")
        activities_data = blob_client.download_blob().readall()
        return jsonify(json.loads(activities_data))
    except Exception as e:
        logging.error(f"Failed to get activities from Azure Blob Storage: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/get-point', methods=['GET'])
def get_point():
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_client = blob_service_client.get_blob_client(container=container_name, blob="selected_point.json")
        point_data = blob_client.download_blob().readall()
        return jsonify(json.loads(point_data))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)