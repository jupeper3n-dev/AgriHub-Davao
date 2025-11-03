import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function SavedPosts() {
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const user = auth.currentUser;

  // Real-time load saved posts
  useEffect(() => {
    if (!user) {
      Alert.alert("Not logged in", "Please log in to view saved posts.");
      return;
    }

    const ref = collection(db, "saved_posts", user.uid, "posts");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        setSavedPosts(list);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore listener error:", err);
        Alert.alert("Error", "Unable to load saved posts.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Unsave post
  const handleUnsave = async (id: string) => {
    try {
      if (!user) return;
      await deleteDoc(doc(db, "saved_posts", user.uid, "posts", id));
      Alert.alert("Removed", "Post unsaved successfully.");
    } catch (err: any) {
      console.error("Unsave error:", err);
      Alert.alert("Error", "Unable to unsave this post.");
    }
  };

  // Like a post
  const toggleReaction = async (item: any) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Login Required", "You must log in to react to posts.");
        return;
      }

      const ref = doc(db, "products", item.postId);
      const currentLikes = item.likes || [];
      const updatedLikes = currentLikes.includes(user.uid)
        ? currentLikes.filter((id: string) => id !== user.uid)
        : [...currentLikes, user.uid];
      await updateDoc(ref, { likes: updatedLikes });
    } catch (err: any) {
      console.error("Reaction error:", err);
    }
  };

  // Share post
  const handleShare = async (item: any) => {
    try {
      const link = `https://geo-davao.app/product?id=${item.postId}`;
      await Clipboard.setStringAsync(link);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(link);
      } else {
        Alert.alert("Link copied!", link);
      }
    } catch (err: any) {
      console.error("Share error:", err);
      Alert.alert("Error", "Failed to share product link.");
    }
  };

  // Comment post
  const handleComments = (item: any) => {
    router.push({
      pathname: "/modals/comments",
      params: { productId: item.postId },
    });
  };

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Render card (same layout as Dashboard)
  const renderPost = ({ item }: { item: any }) => {
    const user = auth.currentUser;
    const liked = item.likes?.includes(user?.uid);

    return (
      <View style={styles.card}>
        <Text style={styles.posterName}>
          Posted by{" "}
          <Text style={{ fontWeight: "bold", fontSize: 22, color: "#1E88E5" }}>
            {item.userName || "Unknown User"}
          </Text>
        </Text>

        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: "#aaa" }}>No Image</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            <Text style={styles.label}>Product:</Text> {item.title} {" | "}
            <Text style={styles.label}>Category:</Text> {item.category} {" | "}
            <Text style={styles.label}>Price:</Text>{" "}
            <Text style={{ color: "#43A047", fontWeight: "bold" }}>
              ₱ {item.price}
            </Text>
          </Text>
        </View>

        {item.description ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.label}>Description:</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ) : null}

        {/* Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={() => toggleReaction(item)}>
            <Text style={[styles.iconText, liked && { color: "#E91E63" }]}>
              ❤️ {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleComments(item)}>
            <Text style={styles.iconText}>💬 Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleShare(item)}>
            <Text style={styles.iconText}>📤 Share</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUnsave(item.id)}>
            <Text style={[styles.iconText, { color: "#E53935" }]}>❌ Unsave</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
        style={styles.detailsBtn}
        onPress={async () => {
            try {
            const ref = doc(db, "products", item.postId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const fullData = { id: snap.id, ...snap.data() };
                router.push({
                pathname: "/modals/product-details",
                params: fullData, // ✅ always includes location now
                });
            } else {
                Alert.alert("Not Found", "The original post could not be found.");
            }
            } catch (err) {
            console.error("View details error:", err);
            Alert.alert("Error", "Failed to load full post details.");
            }
        }}
        >
        <Text style={styles.detailsText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 10, color: "#1E88E5" }}>Loading saved posts...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E88E5" />
      <View
        style={[
          styles.navbar,
          Platform.OS === "android" ? { paddingTop: 20 } : {},
        ]}
      >
        <Text style={styles.navTitle}>Saved Posts</Text>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>You have no saved posts yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 50, padding: 10 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  navbar: {
    backgroundColor: "#4A8C2A",
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navTitle: { color: "#fff", fontSize: 24, fontWeight: "bold", },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  posterName: { fontSize: 22, color: "#333", marginBottom: 15 },
  image: { width: "100%", height: 220, borderRadius: 8, marginBottom: 12 },
  imagePlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  infoRow: { marginBottom: 6 },
  infoText: { fontSize: 16, color: "#000", textAlign: "left", flexWrap: "wrap" },
  label: { fontWeight: "bold", color: "#000" },
  descriptionBox: { marginTop: 8, marginBottom: 8 },
  description: { color: "#000", fontSize: 16, lineHeight: 20 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  iconText: { color: "#1E88E5", fontWeight: "600", fontSize: 18, marginBottom: 20 },
  detailsBtn: {
    backgroundColor: "#1E88E5",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
  },
  detailsText: { color: "#fff", fontWeight: "bold" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  closeBtn: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
});