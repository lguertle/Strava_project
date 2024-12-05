import requests
import json
import time
import os
import logging
from flask_cors import CORS
from flask import Flask, request, redirect, jsonify, send_from_directory
from azure.storage.blob import BlobServiceClient
from datetime import datetime

app = Flask(__name__, static_folder=os.path.abspath('strava-project/build'), static_url_path='')
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Replace these with your actual values
client_id = "138104"
client_secret = "44b79cd9346f3ba7bc0d4388583bf4474d7b6196"
redirect_uri = "http://localhost:5000/oauth/callback"
connection_string = "DefaultEndpointsProtocol=https;AccountName=stravastorageproject;AccountKey=r4v4kw6itdfqwkzuneRR8FYX2dOI88hS+/4r9WlWAT6LCz3iwbLpO7+5HwHpNLRbOmT73IQD3plA+AStz/VXPw==;EndpointSuffix=core.windows.net"
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
    page = 1
    per_page = 30

    while True:
        params = {
            "page": page,
            "per_page": per_page
        }

        response = requests.get(activities_url, headers=headers, params=params)
        
        if response.status_code != 200:
            logging.error(f"Failed to fetch activities: {response.text}")
            return f"Failed to fetch activities: {response.text}"

        activities = response.json()
        if not activities:
            break

        all_activities.extend(activities)
        page += 1

    # Convert all activities data to JSON format
    activity_json = json.dumps(all_activities)
    logging.info(f"Fetched {len(all_activities)} activities.")

    # Upload activity data to Azure Blob Storage
    try:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        blob_name = "activities.json"  # Fixed blob name to overwrite the existing blob

        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        blob_client.upload_blob(activity_json, overwrite=True)
        logging.info(f"Uploaded activities to Azure Blob Storage: {blob_name}")
    except Exception as e:
        logging.error(f"Failed to upload activities to Azure Blob Storage: {str(e)}")
        return f"Failed to upload activities to Azure Blob Storage: {str(e)}"

    return redirect('/')

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