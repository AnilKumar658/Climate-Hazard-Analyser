import { useState, useCallback, useRef, useEffect } from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  ZoomControl,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchRegions } from '../api/client';

// Fix Leaflet default marker icons in Vite.
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Sleek oceanic pin for the selected region.
const selectedPinIcon = new L.DivIcon({
  html: `<div style="
    width:18px;height:18px;
    background:#0284C7;
    border:2.5px solid #ffffff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(2,132,199,0.55);
  "></div>`,
  className: 'selected-region-marker',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

// Cyan-sky beacon for the device's current location.
const currentLocationIcon = new L.DivIcon({
  html: `<div style="
    width:12px;height:12px;
    box-sizing:border-box;
    border-radius:50%;
    background:#38BDF8;
    border:2px solid #ffffff;
    box-shadow:0 0 0 5px rgba(56,189,248,0.25),0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  className: 'current-location-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function MapCenterUpdater({ lat, lon, zoom = 6 }) {
  const map = useMap();
  useEffect(() => {
    if (
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon)
    ) {
      map.flyTo([lat, lon], Math.max(map.getZoom(), zoom), { duration: 0.7 });
    }
  }, [lat, lon, map, zoom]);
  return null;
}

export default function RegionSelector({ selectedLat, selectedLon, regionName, onSelect }) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [searchError, setSearchError]     = useState('');
  const [showDropdown, setShowDropdown]   = useState(false);
  const [locating, setLocating]           = useState(false);
  const [locationError, setLocationError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);

  const searchTimer = useRef(null);
  const requestId   = useRef(0);

  const hasSelection =
    typeof selectedLat === 'number' &&
    typeof selectedLon === 'number' &&
    Number.isFinite(selectedLat) &&
    Number.isFinite(selectedLon);

  useEffect(() => {
    return () => {
      clearTimeout(searchTimer.current);
      requestId.current += 1;
    };
  }, []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSearchError('');
    setLocationError('');
    clearTimeout(searchTimer.current);

    const currentRequestId = ++requestId.current;

    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchRegions(query.trim());
        if (currentRequestId !== requestId.current) return;

        setSearchResults(Array.isArray(results) ? results : []);
        setShowDropdown(true);

        if (!Array.isArray(results) || results.length === 0) {
          setSearchError('No matching locations found.');
        }
      } catch (error) {
        if (currentRequestId !== requestId.current) return;
        setSearchResults([]);
        setShowDropdown(false);
        setSearchError(error?.message || 'Unable to search locations. Try again.');
      } finally {
        if (currentRequestId === requestId.current) setIsSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectResult = useCallback(
    (result) => {
      const lat = Number(result.lat);
      const lon = Number(result.lon);

      if (
        !Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < -90 || lat > 90 || lon < -180 || lon > 180
      ) {
        setSearchError('The selected location has invalid coordinates.');
        return;
      }

      const name = [result.name, result.admin1, result.country].filter(Boolean).join(', ');
      onSelect(lat, lon, name);

      setSearchQuery(name || result.name || '');
      setSearchResults([]);
      setShowDropdown(false);
      setSearchError('');
      setLocationError('');
      setCurrentLocation(null);
    },
    [onSelect],
  );

  const handleMapClick = useCallback(
    (lat, lon) => {
      const name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      onSelect(lat, lon, name);
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      setSearchError('');
      setLocationError('');
      setCurrentLocation(null);
    },
    [onSelect],
  );

  const handleLocateMe = useCallback(() => {
    setLocationError('');
    setSearchError('');
    clearTimeout(searchTimer.current);
    requestId.current += 1;
    setIsSearching(false);
    setLocating(true);

    if (!('geolocation' in navigator)) {
      setLocationError('Location is not supported by this browser.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocationError('Your browser returned invalid coordinates.');
          setLocating(false);
          return;
        }

        setCurrentLocation({ lat: latitude, lon: longitude, accuracy });
        onSelect(latitude, longitude, 'My current location');
        setSearchQuery('My current location');
        setSearchResults([]);
        setShowDropdown(false);
        setSearchError('');
        setLocationError('');
        setLocating(false);
      },
      (error) => {
        const messages = {
          1: 'Location permission denied. Allow location access in your browser settings.',
          2: 'Your current location is unavailable. Check your device location settings.',
          3: 'Location request timed out. Please try again.',
        };
        setLocationError(messages[error.code] || 'Unable to detect your current location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [onSelect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%' }}>

      {/* City search */}
      <div className="search-wrap">
        <span className="search-icon" aria-hidden="true">
          {isSearching ? '⏳' : '🔍'}
        </span>
        <input
          id="region-search"
          type="search"
          className="form-input search-input-padded"
          placeholder="Search city or region…"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          autoComplete="off"
          aria-label="Search for a city or region"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? 'region-search-results' : undefined}
          aria-autocomplete="list"
        />

        {/* Search results dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div
            id="region-search-results"
            className="search-dropdown"
            role="listbox"
            aria-label="Search results"
          >
            {searchResults.map((result, index) => (
              <div
                key={`${result.lat}-${result.lon}-${index}`}
                className="search-dropdown-item"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectResult(result)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="search-item-name">
                    📍 {result.name}{result.admin1 ? `, ${result.admin1}` : ''}
                  </div>
                  <div className="search-item-meta">{result.country}</div>
                </div>
                <div className="search-item-meta">
                  {Number(result.lat).toFixed(2)}°,{' '}
                  {Number(result.lon).toFixed(2)}°
                </div>
              </div>
            ))}
          </div>
        )}

        {searchError && (
          <p className="search-error" role="status">{searchError}</p>
        )}
      </div>

      {/* Location permission / detection errors */}
      {locationError && (
        <div className="location-error" role="alert">{locationError}</div>
      )}

      {/* Selected location */}
      {hasSelection && (
        <div className="location-selected" aria-label={`Selected: ${regionName}`}>
          <span aria-hidden="true">📍</span>
          <span className="location-selected__name">{regionName || 'Selected location'}</span>
          <span className="location-selected__coords">
            {selectedLat.toFixed(4)}°, {selectedLon.toFixed(4)}°
          </span>
        </div>
      )}

      {/* Map */}
      <div className="map-wrapper">
        <MapContainer
          center={hasSelection ? [selectedLat, selectedLon] : [20, 10]}
          zoom={hasSelection ? 6 : 2}
          style={{ height: '100%', width: '100%', background: '#0B0F19' }}
          zoomControl={false}
          attributionControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> &mdash; Dark Gray Canvas'
            maxZoom={16}
          />

          <ZoomControl position="topright" />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapCenterUpdater
            lat={hasSelection ? selectedLat : null}
            lon={hasSelection ? selectedLon : null}
            zoom={currentLocation ? 14 : 6}
          />

          {/* Current device location: blue dot */}
          {currentLocation && (
            <Marker
              position={[currentLocation.lat, currentLocation.lon]}
              icon={currentLocationIcon}
              keyboard={false}
              title="Your current location"
              zIndexOffset={1000}
            />
          )}

          {/* Selected region: blue pin */}
          {hasSelection && !currentLocation && (
            <Marker
              position={[selectedLat, selectedLon]}
              icon={selectedPinIcon}
            />
          )}
        </MapContainer>

        {/* Floating locate-me button */}
        <button
          type="button"
          className="locate-btn"
          onClick={handleLocateMe}
          disabled={locating}
          aria-label={locating ? 'Locating…' : 'Find my current location'}
          title="Find my current location"
        >
          {locating ? (
            <span style={{ fontSize: '14px', lineHeight: 1 }} aria-hidden="true">…</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2.5V5M12 19V21.5M2.5 12H5M19 12H21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Map hint */}
        <div
          className="map-hint"
          aria-hidden="true"
        >
          Click on map to select a location
        </div>
      </div>
    </div>
  );
}
