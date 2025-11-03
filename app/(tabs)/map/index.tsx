import { Ionicons } from "@expo/vector-icons";
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

// Marker colors by category
const markerColors: Record<string, string> = {
  farmer: "#FB8C00", // Orange
  "store owner": "#43A047", // Green
};

export default function MapScreen() {
  const [region, setRegion] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Get current user location
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

  // Load active products from Firestore with role-based visibility
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    const loadUserAndProducts = async () => {
      const userSnap = await getDoc(userRef);
      const role = userSnap.exists()
        ? (userSnap.data().userType || "store owner").toLowerCase()
        : "store owner";

      setUserRole(role); // we'll add this state next

      const q = query(collection(db, "products"));
      const unsub = onSnapshot(q, (snap) => {
        const all: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          // Only include active ones
          if (data.status && data.status.toLowerCase() !== "active") return;
          all.push({ id: d.id, ...data });
        });

        let visible = all;

        // Visibility rules
        if (role === "farmer" || role === "consumer") {
          visible = visible.filter(
            (p) => (p.userType || "").toLowerCase() === "store owner"
          );
        }

        setProducts(visible);
      });

      return () => unsub();
    };

    loadUserAndProducts();
  }, []);

  // Check if coordinates are within Davao region
  const isInsideDavao = (lat: number, lon: number) =>
    inside([lon, lat], davaoRegionCoords);

  // Filter products based on selected category
  const filteredProducts =
    filter === "All"
      ? products
      : products.filter(
          (p) => (p.userType || "").toLowerCase() === filter.toLowerCase()
        );

  // Get marker color
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

        {Array.isArray(filteredProducts) &&
          filteredProducts
            .filter((p) => p && p.lat && p.lng)
            .map((item) => {
              try {
                const lat = parseFloat(item.lat);
                const lng = parseFloat(item.lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                if (!isInsideDavao(lat, lng)) return null;

                return (
                  <Marker
                    key={item.id || `${item.title}-${lat}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    title={item?.title || "Untitled"}
                    description={String(item?.description || "No description")}
                    pinColor={getMarkerColor(item.userType)}
                    onPress={() => setSelectedProduct(item)}
                  />
                );
              } catch (err) {
                console.warn("⚠️ Skipped invalid item:", item, err);
                return null;
              }
            })}
      </MapView>

      {/* Filter Buttons */}
      {userRole === "store owner" && (
        <View style={styles.filterBar}>
          {["All", "Farmer", "Store Owner"].map((cat) => (
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
      )}

      {/* Legend */}
      {userRole === "store owner" && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.colorDot, { backgroundColor: "#FB8C00" }]} />
            <Text>Farmer</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.colorDot, { backgroundColor: "#43A047" }]} />
            <Text>Store Owner</Text>
          </View>
        </View>
      )}

      {/* Product Preview Modal */}
      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Product Details</Text>
              <TouchableOpacity onPress={() => setSelectedProduct(null)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.modalBody}>
              {/* Product Image (clickable full screen) */}
              {selectedProduct?.imageUrl ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    if (selectedProduct?.imageUrl && typeof selectedProduct.imageUrl === "string") {
                      setFullscreenImage(selectedProduct.imageUrl);
                    } else {
                      console.warn("⚠️ No image URL found for product:", selectedProduct);
                    }
                  }}
                >
                {selectedProduct?.imageUrl ? (
                  <Image
                    source={{ uri: selectedProduct.imageUrl }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={{ color: "#aaa" }}>No Image</Text>
                  </View>
                )}
                </TouchableOpacity>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={{ color: "#aaa" }}>No Image</Text>
                </View>
              )}

              {/* Product Info */}
              <View style={styles.modalInfo}>
                <Text style={styles.modalTitle}>{selectedProduct?.title}</Text>

                {/* Category */}
                <View style={styles.iconRow}>
                  <Ionicons name="pricetag-outline" size={18} color="#4A8C2A" />
                  <Text style={styles.modalText}>
                    {selectedProduct?.category || "Uncategorized"}
                  </Text>
                </View>

                {/* Posted by */}
                <View style={styles.iconRow}>
                  <Ionicons name="person-outline" size={18} color="#4A8C2A" />
                  <Text style={styles.modalText}>
                    {selectedProduct?.userName || "Unknown User"}
                  </Text>
                </View>

                {/* Price */}
                <View style={styles.iconRow}>
                  <Ionicons name="cash-outline" size={18} color="#4A8C2A" />
                  <Text style={styles.modalPrice}>₱ {selectedProduct?.price}</Text>
                </View>

                {/* Description */}
                {selectedProduct?.description ? (
                  <Text style={styles.modalDesc}>{selectedProduct.description}</Text>
                ) : null}

                {/* 🧾 Specs */}
                {selectedProduct?.spec && (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontWeight: "bold", color: "#333" }}>Specifications:</Text>
                    <Text style={{ color: "#555", marginTop: 2 }}>
                      {selectedProduct.spec}
                    </Text>
                  </View>
                )}

                {/* Location */}
                <View style={styles.iconRow}>
                  <Ionicons name="location-outline" size={18} color="#4A8C2A" />
                  <Text style={styles.modalText}>
                    {selectedProduct?.locationName || "No location specified"}
                  </Text>
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.btn, styles.viewBtn]}
                onPress={() => {
                  if (selectedProduct?.lat && selectedProduct?.lng) {
                    router.push({
                      pathname: "/modals/view-map",
                      params: {
                        lat: selectedProduct.lat,
                        lng: selectedProduct.lng,
                        locationName: selectedProduct.locationName || "Product Location",
                      },
                    });
                  } else {
                    console.warn("⚠️ Product has no valid location:", selectedProduct);
                  }
                  setSelectedProduct(null);
                }}
              >
                <Ionicons name="navigate-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>View Direction</Text>
              </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.closeBtn]}
                  onPress={() => setSelectedProduct(null)}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 🔍 Fullscreen Image Viewer */}
          <Modal
            visible={!!fullscreenImage}
            transparent
            animationType="fade"
            onRequestClose={() => setFullscreenImage(null)}
          >
            <View style={styles.fullscreenOverlay}>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={() => setFullscreenImage(null)}
              >
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>

              {fullscreenImage ? (
                <Image
                  source={{ uri: fullscreenImage }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: "#fff" }}>No Image Available</Text>
              )}
            </View>
          </Modal>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Filter Bar
  filterBar: {
    position: "absolute",
    top: 20,
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

  // Legend
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

  modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.6)",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 16,
},
modalContainer: {
  width: "95%",
  maxWidth: 420,
  backgroundColor: "#fff",
  borderRadius: 12,
  overflow: "hidden",
},
modalHeader: {
  backgroundColor: "#4A8C2A",
  paddingVertical: 12,
  paddingHorizontal: 16,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
modalHeaderTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
},
modalBody: {
  padding: 16,
},
modalImage: {
  width: "100%",
  height: 200,
  borderRadius: 8,
  marginBottom: 12,
},
imagePlaceholder: {
  width: "100%",
  height: 200,
  borderRadius: 8,
  backgroundColor: "#eee",
  justifyContent: "center",
  alignItems: "center",
  marginBottom: 12,
},
modalInfo: {
  marginBottom: 12,
},
modalTitle: {
  fontSize: 20,
  fontWeight: "bold",
  color: "#333",
  marginBottom: 10,
},
iconRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 6,
},
modalText: {
  fontSize: 15,
  color: "#444",
  marginLeft: 6,
},
modalPrice: {
  fontSize: 16,
  fontWeight: "bold",
  color: "#1E88E5",
  marginLeft: 6,
},
modalDesc: {
  fontSize: 14,
  color: "#555",
  marginTop: 8,
  marginBottom: 8,
  lineHeight: 18,
},
modalButtons: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 8,
},
btn: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  paddingVertical: 10,
  marginHorizontal: 4,
},
viewBtn: {
  backgroundColor: "#4A8C2A",
},
closeBtn: {
  backgroundColor: "#888",
},
btnText: {
  color: "#fff",
  fontWeight: "bold",
  marginLeft: 6,
  fontSize: 15,
},fullscreenOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.95)",
  justifyContent: "center",
  alignItems: "center",
},fullscreenClose: {
  position: "absolute",
  top: 40,
  right: 20,
  zIndex: 10,
},fullscreenImage: {
  width: "100%",
  height: "100%",
},
});