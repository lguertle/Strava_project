import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
// CSS imports are now handled centrally in src/map-libraries.css
import polyline from '@mapbox/polyline';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const MapComponent = ({ selectedActivity }) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const geocoderRef = useRef(null);

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
    
        if (geocoderRef.current && !geocoderRef.current.hasChildNodes()) {
            geocoder.addTo(geocoderRef.current);
        }
    
        geocoder.on('result', (e) => {
            const coordinates = e.result.geometry.coordinates;
            map.flyTo({ center: coordinates, zoom: 12 });
        });
    
        document.getElementById('locate-icon').onclick = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    const userCoords = [position.coords.longitude, position.coords.latitude];
                    map.flyTo({ center: userCoords, zoom: 12 });
                    // Remove the line that adds the marker
                    // new mapboxgl.Marker().setLngLat(userCoords).addTo(map);
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
        <div className="relative w-full h-screen p-1">
            <div id="geocoder" ref={geocoderRef} className="z-10 m-2.5"></div>
            <div id="map" ref={mapContainerRef} className="w-full h-full"></div>
            <img 
                id="locate-icon" 
                src="/icons/location_2.png" 
                alt="Find My Location" 
                className="absolute top-20 left-5 bg-white rounded-full p-2.5 cursor-pointer shadow-md w-[30px] h-[30px]" 
            />
            <div 
                id="style-toggle"
                className="absolute top-[87px] left-20 bg-white p-2.5 rounded-md cursor-pointer shadow-md text-sm"
            >
                Map Style
            </div>
            <div 
                id="style-menu"
                className="absolute top-20 left-40 bg-white p-2.5 rounded-md shadow-md text-sm hidden"
            >
                <div className="mb-2">
                    <input 
                        type="radio" 
                        id="classic-style" 
                        name="map-style" 
                        value="classic" 
                        defaultChecked 
                        className="mr-2"
                    />
                    <label htmlFor="classic-style" className="cursor-pointer">Classic Map</label>
                </div>
                <div>
                    <input 
                        type="radio" 
                        id="satellite-style" 
                        name="map-style" 
                        value="satellite" 
                        className="mr-2"
                    />
                    <label htmlFor="satellite-style" className="cursor-pointer">Satellite Map</label>
                </div>
            </div>
        </div>
    );
};

export default MapComponent;