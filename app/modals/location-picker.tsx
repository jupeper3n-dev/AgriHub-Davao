import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { MapPressEvent, Marker, Polygon } from "react-native-maps";
// @ts-ignore
import inside from "point-in-polygon";

// Davao Region Polygon (bounds)
const davaoRegionCoords = [
  [125.179443, 6.473971],
  [125.36911, 6.359184],
  [125.640106, 6.349032],
  [125.872101, 6.463131],
  [126.012878, 6.671582],
  [126.17569, 6.949217],
  [126.233368, 7.199112],
  [126.270447, 7.436032],
  [126.240234, 7.674414],
  [126.05896, 7.798609],
  [125.819702, 7.924145],
  [125.555725, 7.901297],
  [125.30426, 7.797582],
  [125.099487, 7.630769],
  [124.995117, 7.391935],
  [125.013657, 7.150181],
  [125.085754, 6.898519],
  [125.179443, 6.473971],
];

const davaoPolygon = davaoRegionCoords.map(([lng, lat]) => ({
  latitude: lat,
  longitude: lng,
}));

export default function LocationPicker() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Check if coordinates are inside Davao polygon
  const isInsideDavao = (lat: number, lon: number) => inside([lon, lat], davaoRegionCoords);

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    // Prevent selecting locations outside Davao
    if (!isInsideDavao(latitude, longitude)) {
      Alert.alert(
        "Out of Bounds",
        "The selected location is outside the Davao Region. Please select within the blue boundary."
      );
      return;
    }

    setSelectedLocation({ latitude, longitude });
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      // Pass data to previous route instead of reopening
      router.back();

      setTimeout(() => {
        router.setParams({
          lat: selectedLocation.latitude.toString(),
          lng: selectedLocation.longitude.toString(),
        });
      }, 300);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 7.1907, // Davao City center
          longitude: 125.4553,
          latitudeDelta: 0.6,
          longitudeDelta: 0.6,
        }}
        onPress={handleMapPress}
      >
        {/* Davao Region Polygon */}
        <Polygon
          coordinates={davaoPolygon}
          strokeColor="rgba(30,136,229,0.8)"
          fillColor="rgba(30,136,229,0.1)"
          strokeWidth={2}
        />

        {/* Selected Marker */}
        {selectedLocation && (
          <Marker coordinate={selectedLocation} title="Selected Location" />
        )}
      </MapView>

      <View style={styles.bottomContainer}>
        {selectedLocation ? (
          <Text style={styles.infoText}>
            📍 You have selected:{" "}
            <Text style={{ fontWeight: "600" }}>
              {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
            </Text>
          </Text>
        ) : (
          <Text style={styles.infoText}>Tap inside the blue boundary to select a location</Text>
        )}

        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedLocation && { opacity: 0.5 },
          ]}
          disabled={!selectedLocation}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: "center",
  },
  infoText: { color: "#333", marginBottom: 8, textAlign: "center" },
  confirmButton: {
    backgroundColor: "#1E88E5",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  confirmText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});