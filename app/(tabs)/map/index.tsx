import * as Location from "expo-location";
import { useRouter } from "expo-router";
// @ts-ignore
import { collection, doc, getDoc, onSnapshot, query } from "firebase/firestore";
// @ts-ignore
import inside from "point-in-polygon";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { auth, db } from "../../../firebaseConfig";

// ✅ Davao Region Polygon (bounds)
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

// 🎨 Marker colors by category
const markerColors: Record<string, string> = {
  farmer: "#FB8C00", // Orange
  consumer: "#1E88E5", // Blue
  "store owner": "#43A047", // Green
};

export default function MapScreen() {
  const [region, setRegion] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const router = useRouter();

  // 📍 Get current user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.4,
        longitudeDelta: 0.4,
      });
    })();
  }, []);

  // 🧭 Load active products from Firestore with role-based visibility
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const loadProducts = async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userRole = userSnap.exists()
        ? (userSnap.data().userType || "store owner").toLowerCase()
        : "store owner";

      const q = query(collection(db, "products"));
      const unsub = onSnapshot(q, (snap) => {
        const all: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          // ✅ Only include active ones
          if (data.status && data.status.toLowerCase() !== "active") return;
          all.push({ id: d.id, ...data });
        });

        let visible = all;

        // ✅ Apply visibility rules
        if (userRole === "farmer" || userRole === "consumer") {
          visible = visible.filter(
            (p) => (p.userType || "").toLowerCase() === "store owner"
          );
        }

        // ✅ Store Owner can see everyone
        setProducts(visible);
      });

      return () => unsub();
    };

    loadProducts();
  }, []);

  // 🗺️ Check if coordinates are within Davao region
  const isInsideDavao = (lat: number, lon: number) =>
    inside([lon, lat], davaoRegionCoords);

  // 🔍 Filter products based on selected category
  const filteredProducts =
    filter === "All"
      ? products
      : products.filter(
          (p) => (p.userType || "").toLowerCase() === filter.toLowerCase()
        );

  // 🖌️ Get marker color
  const getMarkerColor = (userType: string) =>
    markerColors[userType?.toLowerCase()] || "#757575"; // gray fallback

  if (!region) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 10, color: "#1E88E5" }}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🗺️ Map */}
      <MapView
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Region Boundary */}
        <Polygon
          coordinates={davaoPolygon}
          strokeColor="rgba(30,136,229,0.8)"
          fillColor="rgba(30,136,229,0.1)"
          strokeWidth={2}
        />

        {/* Markers */}
        {filteredProducts.map(
          (item) =>
            item.lat &&
            item.lng &&
            isInsideDavao(item.lat, item.lng) && (
              <Marker
                key={item.id || `${item.title}-${item.lat}`}
                coordinate={{
                  latitude: parseFloat(item.lat),
                  longitude: parseFloat(item.lng),
                }}
                title={item.title}
                description={item.description}
                pinColor={getMarkerColor(item.userType)}
                onPress={() => setSelectedProduct(item)}
              />
            )
        )}
      </MapView>

      {/* 🧭 Filter Buttons */}
      <View style={styles.filterBar}>
        {["All", "Farmer", "Consumer", "Store Owner"].map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterButton,
              filter === cat && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(cat)}
          >
            <Text
              style={[
                styles.filterText,
                filter === cat && styles.filterTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 🎨 Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.colorDot, { backgroundColor: "#1E88E5" }]} />
          <Text>Consumer</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorDot, { backgroundColor: "#FB8C00" }]} />
          <Text>Farmer</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorDot, { backgroundColor: "#43A047" }]} />
          <Text>Store Owner</Text>
        </View>
      </View>

      {/* 🪟 Product Preview Modal */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedProduct?.imageUrl ? (
              <Image
                source={{ uri: selectedProduct.imageUrl }}
                style={styles.modalImage}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={{ color: "#aaa" }}>No Image</Text>
              </View>
            )}

            <Text style={styles.modalTitle}>{selectedProduct?.title}</Text>
            <Text style={styles.modalPrice}>₱ {selectedProduct?.price}</Text>
            <Text style={styles.modalDesc}>{selectedProduct?.description}</Text>
            <Text style={styles.modalLocation}>
              📍 {selectedProduct?.locationName}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#1E88E5" }]}
                onPress={() => {
                  router.push({
                    pathname: "/modals/product-details",
                    params: { ...selectedProduct },
                  });
                  setSelectedProduct(null);
                }}
              >
                <Text style={styles.btnText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#ccc" }]}
                onPress={() => setSelectedProduct(null)}
              >
                <Text style={styles.btnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // 🔍 Filter Bar
  filterBar: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    elevation: 3,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: "#f0f0f0",
  },
  filterButtonActive: {
    backgroundColor: "#4A8C2A",
  },
  filterText: { color: "#333", fontWeight: "600" },
  filterTextActive: { color: "#fff" },

  // 🎨 Legend
  legend: {
    position: "absolute",
    bottom: 20,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 8,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },

  // 🪟 Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    width: "90%",
  },
  modalImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  modalPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E88E5",
    marginVertical: 4,
  },
  modalDesc: { fontSize: 14, color: "#555", marginBottom: 6 },
  modalLocation: { fontSize: 13, color: "#777", marginBottom: 10 },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  btn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  btnText: { color: "#fff", fontWeight: "bold" },
});