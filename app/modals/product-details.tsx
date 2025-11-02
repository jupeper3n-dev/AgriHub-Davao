import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProductDetailsModal() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const {
    title,
    category,
    price,
    description,
    specifications,
    locationName,
    lat,
    lng,
    userName,
    imageUrl,
  } = params;

  return (
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📦 Product Details</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.closeBtn}>✖</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Product Image */}
          {imageUrl ? (
            <Image source={{ uri: imageUrl as string }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text>No Image</Text>
            </View>
          )}

          {/* Basic Info */}
          <Text style={styles.category}>{category}</Text>
          <Text style={styles.price}>₱ {price}</Text>
          <Text style={styles.poster}>👤 Posted by {userName || "Unknown"}</Text>

          {/* Description */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.text}>{description || "No description."}</Text>

          {/* Specifications */}
          <Text style={styles.sectionTitle}>Specifications</Text>
          <Text style={styles.text}>
            {specifications || "No specifications available."}
          </Text>

          {/* Location */}
          <Text style={styles.sectionTitle}>📍 Store Location</Text>
          <Text style={styles.text}>{locationName || "No location provided."}</Text>

          {/* ✅ Replaced old <MapView> with See Location button */}
          {lat && lng && (
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() =>
                router.push({
                  pathname: "/modals/view-map",
                  params: { lat, lng, locationName },
                })
              }
            >
              <Text style={styles.mapBtnText}>See Location</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(247, 247, 247, 0.86)", // transparent backdrop
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "92%",
    maxHeight: "90%",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  closeBtn: { fontSize: 20, color: "#E53935", fontWeight: "bold" },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 10,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: "#eee",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  category: { color: "#1E88E5", fontSize: 16 },
  price: {
    color: "#43A047",
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 4,
  },
  poster: { fontSize: 14, color: "#555", marginBottom: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    color: "#333",
  },
  text: { color: "#444", marginBottom: 6 },
  mapBtn: {
    backgroundColor: "#1E88E5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  mapBtnText: { color: "#fff", fontWeight: "bold" },
});