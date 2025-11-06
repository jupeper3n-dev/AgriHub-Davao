import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM2YWQxMjI0YmM2ZDQ4MTNiYWQ3MjdkMGRjMTk1NDZjIiwiaCI6Im11cm11cjY0In0="; // Replace with your ORS key

export default function ViewMapModal() {
  const { lat, lng, locationName } = useLocalSearchParams();
  const router = useRouter();

  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [distance, setDistance] = useState<string | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false); // new: shows silent updates

  // 1. Watch user location every 10 seconds
  useEffect(() => {
    let subscriber: any;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please enable location access.");
        setLoading(false);
        return;
      }

      // Get initial location
      const initial = await Location.getCurrentPositionAsync({});
      setUserLocation(initial.coords);
      setLoading(false);

      // Start watching location changes (every 10s)
      subscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // every 10 seconds
          distanceInterval: 10, // only update if moved 10m
        },
        (loc) => {
          setUserLocation(loc.coords);
          setUpdating(true);
        }
      );
    })();

    return () => {
      if (subscriber) subscriber.remove();
    };
  }, []);

  // 2. Fetch route when location updates
  useEffect(() => {
    const fetchRoute = async () => {
      if (!userLocation) return;

      try {
        const response = await fetch(
          "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: ORS_API_KEY,
            },
            body: JSON.stringify({
              coordinates: [
                [userLocation.longitude, userLocation.latitude],
                [Number(lng), Number(lat)],
              ],
            }),
          }
        );

        const data = await response.json();
        if (!data.features || data.features.length === 0) {
          Alert.alert("No route found");
          return;
        }

        const geometry = data.features[0].geometry.coordinates;
        const summary = data.features[0].properties.summary;

        const coords = geometry.map(([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        }));

        setRouteCoords(coords);
        setDistance((summary.distance / 1000).toFixed(2));

        // ETA formatting
        const durationSec = summary.duration;
        let etaText = "";
        if (durationSec < 60) {
          etaText = `${Math.round(durationSec)} sec`;
        } else if (durationSec < 3600) {
          const mins = Math.round(durationSec / 60);
          etaText = `${mins} min${mins !== 1 ? "s" : ""}`;
        } else {
          const hrs = Math.floor(durationSec / 3600);
          const mins = Math.round((durationSec % 3600) / 60);
          etaText = `${hrs}h ${mins}m`;
        }

        setEta(etaText);

        // Smoothly move map view to new position
        mapRef.current?.animateToRegion(
          {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      } catch (error) {
        console.error("Error fetching ORS route:", error);
      } finally {
        setUpdating(false);
      }
    };

    fetchRoute();
  }, [userLocation]);

  // 3. Initial loading indicator only once
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ color: "#1E88E5", marginTop: 10 }}>
          Getting your location...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map takes full screen */}
      {userLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {/* Draw the route */}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#1E88E5"
              strokeWidth={5}
            />
          )}

          {/* User marker */}
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            title="Your Location"
            pinColor="green"
          />

          {/* Destination marker */}
          <Marker
            coordinate={{
              latitude: Number(lat),
              longitude: Number(lng),
            }}
            title={String(locationName || "Destination")}
          />
        </MapView>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E88E5" />
          <Text style={{ color: "#1E88E5", marginTop: 10 }}>
            Locating your position...
          </Text>
        </View>
      )}

      {/* Overlay info panel */}
      {distance && eta && (
        <View style={styles.infoOverlay}>
          <Text style={styles.label}>Distance</Text>
          <Text style={styles.valueBlue}>{distance} km</Text>
          <Text style={styles.label}>Estimated Time</Text>
          <Text style={styles.valueRed}>{eta}</Text>
        </View>
      )}

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeText}>Close Map</Text>
      </TouchableOpacity>

      {/* Optional subtle updating text */}
      {updating && (
        <Text style={styles.refreshText}>Updating your position...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  infoOverlay: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    padding: 12,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
    marginBottom: 2,
  },
  valueBlue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#43A047",
    marginBottom: 6,
  },
  valueRed: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#43A047",
  },
  closeBtn: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "#4A8C2A",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    elevation: 3,
  },
  closeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  refreshText: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    color: "#999",
    fontStyle: "italic",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});