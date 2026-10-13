# Google Maps for the ranking maps

The Local Search Grid, Map Ranking and the setup "Is this the right place?" map use Google Maps when the app has a browser key (`src/components/maps/google-maps.tsx`). Without one they fall back to OpenStreetMap (`leaflet-maps.tsx`).

## 1. Browser API key

In Google Cloud (the MyPageSEO project):

1. **APIs & Services → Library → Maps JavaScript API → Enable.**
2. **Credentials → Create credentials → API key.** Name it e.g. "MyPageSEO web maps".
3. **Application restrictions → Websites:** add `https://app.mypageseo.com/*`, `https://*.mypageseo.com/*` and, for local work, `http://localhost:3000/*`.
4. **API restrictions → Restrict key → Maps JavaScript API** only.

This key is public by design: it ships in the page and is protected by the website restriction. Don't use the backend's `GOOGLE_PLACE_API_KEY` (a server key).

## 2. Map ID and style

The markers are Advanced Markers (our own HTML), which need a Map ID. The map's look comes from that Map ID's style.

1. **Google Maps Platform → Map Styles → Create style → JavaScript → Import JSON**, and paste the JSON below. Name it "MyPageSEO muted".
2. **Map Management → Create Map ID:** type **JavaScript**, **Vector**, and attach the "MyPageSEO muted" style.
3. Copy the Map ID.

```json
[
  { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e6efe4" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f4f5f3" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#e7e3d8" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8f98" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#a1a6ad" }] },
  { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#5f6670" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#3f4650" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#cfe0ec" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#7d97ab" }] }
]
```

Business points of interest are hidden so Google's own business pins don't compete with ours.

## 3. Configure the app

In `.env` (and the deployment's environment):

```
VITE_GOOGLE_MAPS_API_KEY=<the browser key>
VITE_GOOGLE_MAPS_MAP_ID=<the Map ID>
```

Rebuild. Without a Map ID the app uses Google's `DEMO_MAP_ID` (default Google look), which is meant for testing only.

## Cost

Each map shown counts as a Dynamic Maps load (Maps JavaScript API). Google's monthly free allowance (10,000 loads per SKU at the time of writing) covers light use; above it, list price is about $7 per 1,000 loads. Maps appear only on the Grid, Map Ranking and the setup center step. Check current pricing in the Cloud console.
