import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../../firebaseConfig";

// 🕓 Utility: format "X minutes ago"
function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) {
      return `Posted ${count} ${label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "Posted just now";
}

export default function DashboardScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Home");
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Load user type
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const role = snap.data().userType || "Store Owner";
      setUserRole(role);

      // ✅ Only redirect once everything is settled
      setTimeout(() => {
        if (role === "Admin") {
          console.log("👑 Admin detected, redirecting to admin panel...");
          router.replace("../admin-panel");
        }
      }, 300); // wait a tiny bit for auth state to settle
    });

    return () => unsub();
  }, []);

  // ✅ Load posts based on role
  useEffect(() => {
    if (!userRole) return;
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allItems: any[] = [];
      snap.forEach((doc) => allItems.push({ id: doc.id, ...doc.data() }));

      let visiblePosts = allItems;

      // ✅ Restrict what each role can see
      if (userRole?.toLowerCase() === "farmer" || userRole?.toLowerCase() === "consumer") {
        visiblePosts = allItems.filter(
          (p) => (p.category || "").toLowerCase() === "store owner"
        );
      } else if (userRole?.toLowerCase() === "store owner") {
        // Store owners see everything (optional: include only valid posts)
        visiblePosts = allItems;
      }

      // Hide your own posts
      const currentUid = auth.currentUser?.uid;
      visiblePosts = visiblePosts.filter((p) => p.userId !== currentUid);

      setProducts(visiblePosts);
      setFiltered(visiblePosts);
      setLoading(false);
    });

    return () => unsub();
  }, [userRole]);

  // ✅ Real-time sync for saved posts
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "saved_posts", user.uid, "posts");
    const unsub = onSnapshot(ref, (snap) => {
      const savedIds: string[] = [];
      snap.forEach((d) => savedIds.push(d.data().postId));
      setSavedPosts(savedIds);
    });

    return () => unsub();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ✅ Permission check
  const canInteractWith = (targetUserType: string): boolean => {
    const target = (targetUserType || "").toLowerCase();

    if (userRole === "farmer" || userRole === "consumer") {
      return target === "store owner";
    }

    // Store Owners can interact with anyone
    return true;
  };

  // ✅ Like post
  const toggleReaction = async (item: any) => {
    if (!canInteractWith(item.category)) {
      Alert.alert("Access Denied", "You cannot like this post.");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Login Required", "You must log in to react to posts.");
        return;
      }

      const ref = doc(db, "products", item.id);
      const currentLikes = item.likes || [];
      const updatedLikes = currentLikes.includes(user.uid)
        ? currentLikes.filter((id: string) => id !== user.uid)
        : [...currentLikes, user.uid];
      await updateDoc(ref, { likes: updatedLikes });
    } catch (err: any) {
      console.error("Reaction error:", err);
    }
  };

  // ✅ Share post
  const handleShare = async (item: any) => {
    if (!canInteractWith(item.category)) {
      Alert.alert("Access Denied", "You cannot share this post.");
      return;
    }

    try {
      const link = `https://geo-davao.app/product?id=${item.id}`;
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

  // ✅ Comment post
  const handleComments = (item: any) => {
    if (!canInteractWith(item.category)) {
      Alert.alert("Access Denied", "You cannot comment on this post.");
      return;
    }
    router.push({ pathname: "/modals/comments", params: { productId: item.id } });
  };

  // ✅ Save/Unsave Post
  const handleSavePost = async (item: any) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login Required", "You must log in to save posts.");
      return;
    }

    try {
      const q = query(
        collection(db, "saved_posts", user.uid, "posts"),
        where("postId", "==", item.id)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        snap.forEach(async (d) => {
          await deleteDoc(doc(db, "saved_posts", user.uid, "posts", d.id));
        });
        Alert.alert("Removed", "Post unsaved.");
      } else {
        await addDoc(collection(db, "saved_posts", user.uid, "posts"), {
          userId: user.uid,
          postId: item.id,
          title: item.title || "Untitled Product",
          userName: item.userName || "Unknown User",
          imageUrl: item.imageUrl || null,
          category: item.category || "Uncategorized",
          price: item.price || 0,
          description: item.description || "",
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          createdAt: new Date(),
        });
        Alert.alert("Saved", "Post added to your saved list!");
      }
    } catch (err: any) {
      console.error("Save/Unsave error:", err);
      Alert.alert("Error", "Unable to save post.");
    }
  };

  // ✅ Render Post
  const renderPost = ({ item }: { item: any }) => {
    const user = auth.currentUser;
    const liked = item.likes?.includes(user?.uid);
    const isSaved = savedPosts.includes(item.id);

    return (
      <View style={styles.card}>
        {/* 🔹 Poster Info */}
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/profile-view",
              params: { uid: item.userId },
            })
          }
        >
          <Text style={styles.posterName}>Posted by {item.userName || "Unknown User"}</Text>
        </TouchableOpacity>

        {item.createdAt && (
          <Text style={styles.timeText}>
            {getTimeAgo(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt)}
          </Text>
        )}

        {/* 🔹 Image */}
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: "#aaa" }}>No Image</Text>
          </View>
        )}

        {/* 🔹 Info */}
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

        {/* 🔹 Actions */}
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

          <TouchableOpacity onPress={() => handleSavePost(item)}>
            <Text
              style={[
                styles.iconText,
                { color: isSaved ? "#E53935" : "#1E88E5" },
              ]}
            >
              {isSaved ? "❌ Unsave" : "🔖 Save"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 🔹 Details */}
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() =>
            router.push({ pathname: "/modals/product-details", params: item })
          }
        >
          <Text style={styles.detailsText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ✅ Loading state
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 10, color: "#1E88E5" }}>Loading posts...</Text>
      </View>
    );
  }

  // ✅ Main Render
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E88E5" />

      {/* 🔹 Top Navbar */}
      <View style={styles.topBar}>
        <Text style={styles.navTitle}>AgriHub Davao</Text>
        <TouchableOpacity onPress={() => router.push("/search-users")}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 🔹 Tabs */}
      <View style={styles.navbar}>
        {["Home", "Messages", "Notifications"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, activeTab === tab && styles.navItemActive]}
            onPress={() =>
              tab === "Messages"
                ? router.push("../chats")
                : setActiveTab(tab)
            }
          >
            <Text
              style={[styles.navText, activeTab === tab && styles.navTextActive]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 🔹 Posts */}
      <View style={styles.container}>
        <Text style={styles.title}>Community Posts</Text>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No posts available.</Text>
          }
          contentContainerStyle={{ paddingBottom: 50 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60
  },
  navTitle: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#4A8C2A",
    paddingVertical: 10,
    paddingBottom: 20,
  },
  navItem: { paddingVertical: 6, paddingHorizontal: 10 },
  navItemActive: { backgroundColor: "#fff", borderRadius: 20 },
  navText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  navTextActive: { fontWeight: "bold", color: "#000" },
  container: { flex: 1, backgroundColor: "#f9f9f9", padding: 10 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, marginLeft: 10,},
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  posterName: { fontSize: 18, color: "#1E88E5", fontWeight: "bold" },
  timeText: { fontSize: 13, color: "#777", marginBottom: 8 },
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
  infoText: { fontSize: 16, color: "#000" },
  label: { fontWeight: "bold", color: "#000" },
  descriptionBox: { marginTop: 8, marginBottom: 8 },
  description: { color: "#000", fontSize: 16, lineHeight: 20 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  iconText: {
    color: "#1E88E5",
    fontWeight: "600",
    fontSize: 18,
    marginBottom: 20,
  },
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
});