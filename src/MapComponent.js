import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import './MapComponent.css';
import polyline from '@mapbox/polyline';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const MapComponent = ({ selectedActivity }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-74.5, 40],
            zoom: 9
        });

        mapRef.current = map;

        const geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            types: 'country,region,place,postcode,locality,neighborhood',
            placeholder: 'Search for a city'
        });

        if (!document.getElementById('geocoder').hasChildNodes()) {
            geocoder.addTo('#geocoder');
        }

        geocoder.on('result', (e) => {
            const coordinates = e.result.geometry.coordinates;
            map.flyTo({ center: coordinates, zoom: 12 });
            new mapboxgl.Marker().setLngLat(coordinates).addTo(map);
        });

        document.getElementById('locate-icon').onclick = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    const userCoords = [position.coords.longitude, position.coords.latitude];
                    map.flyTo({ center: userCoords, zoom: 12 });
                    new mapboxgl.Marker().setLngLat(userCoords).addTo(map);
                }, (error) => {
                    console.error('Error finding your location: ', error);
                    alert('Unable to retrieve your location.');
                });
            } else {
                alert('Geolocation is not supported by this browser.');
            }
        };

        document.getElementById('style-toggle').onclick = () => {
            const menu = document.getElementById('style-menu');
            menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
        };

        document.querySelectorAll('input[name="map-style"]').forEach((radio) => {
            radio.onclick = () => {
                const style = radio.value === 'classic'
                    ? 'mapbox://styles/mapbox/streets-v11'
                    : 'mapbox://styles/mapbox/satellite-streets-v11';
                map.setStyle(style);
                localStorage.setItem('mapStyle', radio.value);
            };
        });

        const storedStyle = localStorage.getItem('mapStyle');
        if (storedStyle) {
            document.getElementById(`${storedStyle}-style`).checked = true;
            map.setStyle(storedStyle === 'classic'
                ? 'mapbox://styles/mapbox/streets-v11'
                : 'mapbox://styles/mapbox/satellite-streets-v11');
        }

        return () => map.remove();
    }, []);

    useEffect(() => {
        if (selectedActivity && mapRef.current) {
            const map = mapRef.current;
            const decodedPolyline = polyline.decode(selectedActivity.map.summary_polyline);
            const coordinates = decodedPolyline.map(coord => [coord[1], coord[0]]);

            if (map.getLayer('route')) {
                map.removeLayer('route');
                map.removeSource('route');
            }

            map.addLayer({
                id: 'route',
                type: 'line',
                source: {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: coordinates
                        }
                    }
                },
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#FFA500',
                    'line-width': 6
                }
            });

            // Adjust the map's bounds to fit the polyline coordinates
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, {
                padding: 20,
                maxZoom: 15
            });
        }
    }, [selectedActivity]);

    return (
        <div className="map-container">
            <div id="geocoder"></div>
            <div id="map" ref={mapContainerRef}></div>
            <img id="locate-icon" src="/icons/location_2.png" alt="Find My Location" width="30" height="30" />
            <div id="style-toggle">Map Style</div>
            <div id="style-menu">
                <div>
                    <input type="radio" id="classic-style" name="map-style" value="classic" defaultChecked />
                    <label htmlFor="classic-style">Classic Map</label>
                </div>
                <div>
                    <input type="radio" id="satellite-style" name="map-style" value="satellite" />
                    <label htmlFor="satellite-style">Satellite Map</label>
                </div>
            </div>
        </div>
    );
};

export default MapComponent;