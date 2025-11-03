import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjM2YWQxMjI0YmM2ZDQ4MTNiYWQ3MjdkMGRjMTk1NDZjIiwiaCI6Im11cm11cjY0In0="; // Replace this with your actual ORS key

export default function ViewMapModal() {
  const { lat, lng, locationName } = useLocalSearchParams();
  const router = useRouter();

  const [userLocation, setUserLocation] = useState<any>(null);
  const [routeCoords, setRouteCoords] = useState<any[]>([]);
  const [distance, setDistance] = useState<string | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please enable location access.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc.coords);
    })();
  }, []);

  // Fetch route from OpenRouteService API
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
          setLoading(false);
          return;
        }

        const geometry = data.features[0].geometry.coordinates;
        const summary = data.features[0].properties.summary;

        const coords = geometry.map(([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        }));

        setRouteCoords(coords);
        // Convert distance to kilometers
        setDistance((summary.distance / 1000).toFixed(2));

        // Convert ETA to readable format
        const durationSec = summary.duration;
        let etaText = "";

        if (durationSec < 60) {
        etaText = `${Math.round(durationSec)} seconds`;
        } else if (durationSec < 3600) {
        const mins = Math.round(durationSec / 60);
        etaText = `${mins} Minute${mins !== 1 ? "s" : ""}`;
        } else {
        const hrs = Math.floor(durationSec / 3600);
        const mins = Math.round((durationSec % 3600) / 60);
        if (mins === 0) {
            etaText = `${hrs} Hour${hrs !== 1 ? "s" : ""}`;
        } else {
            etaText = `${hrs} Hour${hrs !== 1 ? "s" : ""} ${mins} Minute${mins !== 1 ? "s" : ""}`;
        }
        }

        setEta(etaText);

      } catch (error) {
        console.error("Error fetching ORS route:", error);
        Alert.alert("Error", "Failed to fetch route from ORS.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [userLocation]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ color: "#1E88E5", marginTop: 10 }}>
          Fetching route data...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {distance && eta && (
        <View style={styles.infoBox}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.valueBlue}>{distance} km</Text>

            <Text style={styles.label}>Estimated Time</Text>
            <Text style={styles.valueRed}>{eta}</Text>
        </View>
        )}

        {userLocation ? (
          <MapView
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

            {/* Store marker */}
            <Marker
              coordinate={{
                latitude: Number(lat),
                longitude: Number(lng),
              }}
              title={String(locationName || "Store")}
            />
          </MapView>
        ) : (
          <Text style={styles.loading}>Fetching your location...</Text>
        )}

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.closeText}>Close Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(247, 247, 247, 0.86)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "90%",
    elevation: 5,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  info: { color: "#555", marginBottom: 8 },
  map: { width: "100%", height: 400, borderRadius: 10 },
  closeBtn: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    borderColor: "#43A047",
    borderWidth: 1,
  },
  closeText: { color: "#fff", fontWeight: "bold" },
  loading: { textAlign: "center", color: "#888", marginVertical: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  infoBox: {
  alignItems: "flex-start",
  marginBottom: 12,
},label: {
  fontSize: 16,
  fontWeight: "600",
  color: "#444",
  marginBottom: 2,
},valueBlue: {
  fontSize: 22,
  fontWeight: "bold",
  color: "#43A047",
  marginBottom: 8,
},valueRed: {
  fontSize: 22,
  fontWeight: "bold",
  color: "#43A047",
  marginBottom: 10,
},
});