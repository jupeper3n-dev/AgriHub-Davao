// Replaces the Share button with a Chat button
// Redirects to the Chat Room with the post owner's userId

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

const { width } = Dimensions.get("window");

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

  const SaveButton = ({ isSaved, onPress }: { isSaved: boolean; onPress: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        speed: 30,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          {
            justifyContent: "center",
            alignItems: "center",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: pressed ? "rgba(0,0,0,0.05)" : "transparent",
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {!isSaved && (
            <Ionicons
              name="bookmark-outline"
              size={28}
              color="#000"
              style={{ position: "absolute" }}
            />
          )}
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={26}
            color={isSaved ? "#4A8C2A" : "#fff"}
          />
        </Animated.View>
      </Pressable>
    );
  };

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
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const role = snap.data().userType || "Store Owner";
      setUserRole(role);

      setTimeout(() => {
        if (role === "Admin") {
          console.log("Admin detected, redirecting to admin panel...");
          router.replace("../admin-panel");
        }
      }, 300);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userRole) return;
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allItems: any[] = [];
      snap.forEach((doc) => allItems.push({ id: doc.id, ...doc.data() }));

      let visiblePosts = allItems;
      if (userRole?.toLowerCase() === "farmer" || userRole?.toLowerCase() === "consumer") {
        visiblePosts = allItems.filter(
          (p) => (p.category || "").toLowerCase() === "store owner"
        );
      }

      const currentUid = auth.currentUser?.uid;
      visiblePosts = visiblePosts.filter((p) => p.userId !== currentUid);

      setProducts(visiblePosts);
      setFiltered(visiblePosts);
      setLoading(false);
    });

    return () => unsub();
  }, [userRole]);

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

  const canInteractWith = (targetUserType: string): boolean => {
    const target = (targetUserType || "").toLowerCase();
    if (userRole === "farmer" || userRole === "consumer") {
      return target === "store owner";
    }
    return true;
  };

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

  const handleComments = (item: any) => {
    if (!canInteractWith(item.category)) {
      Alert.alert("Access Denied", "You cannot comment on this post.");
      return;
    }
    router.push({ pathname: "/modals/comments", params: { productId: item.id } });
  };

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

  // Open chat with the user who posted
  const handleChat = async (item: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Login Required", "You must be logged in to send messages.");
      return;
    }

    if (!item.userId) {
      Alert.alert("Error", "This post's user ID is missing.");
      return;
    }

    if (item.userId === currentUser.uid) {
      Alert.alert("Notice", "You can’t message yourself.");
      return;
    }

    try {
      const me = currentUser.uid;
      const them = String(item.userId);
      const chatId = [me, them].sort().join("_");

      // Show a temporary loading overlay if you like (optional)
      setLoading(true);

      const chatRef = doc(db, "chats", chatId);
      await setDoc(
        chatRef,
        {
          members: [me, them],
          lastMessage: "",
          lastSenderId: "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLoading(false);

      router.push({
        pathname: "/chat-room",
        params: { chatId, uid: them },
      });
    } catch (err) {
      console.error("Start chat error:", err);
      setLoading(false);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

    // Inside renderPost():
    const renderPost = ({ item }: { item: any }) => {
      const user = auth.currentUser;
      const liked = item.likes?.includes(user?.uid);
      const isSaved = savedPosts.includes(item.id);

      return (
        <View style={styles.card}>
          {/* Header Row: Poster Info + Save Icon */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/profile-view",
                  params: { uid: item.userId },
                })
              }
              style={{ flex: 1 }}
            >
              <Text style={styles.posterName}>Posted by {item.userName || "Unknown User"}</Text>
            </TouchableOpacity>

            <SaveButton isSaved={isSaved} onPress={() => handleSavePost(item)} />
          </View>

          {item.createdAt && (
            <Text style={styles.timeText}>
              {getTimeAgo(item.createdAt?.toDate ? item.createdAt.toDate() : item.createdAt)}
            </Text>
          )}

          {/* Image */}
          {item.imageUrl ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setSelectedImage(item.imageUrl);
                setImageModalVisible(true);
              }}
            >
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
            </TouchableOpacity>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ color: "#aaa" }}>No Image</Text>
            </View>
          )}

          {/* Product Info */}
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              <Text style={styles.label}>Product:</Text> {item.title} {" | "}
              <Text style={styles.label}>Category:</Text> {item.category} {" | "}
              <Text style={styles.label}>Price:</Text>{" "}
              <Text style={{ color: "#43A047", fontWeight: "bold" }}>₱ {item.price}</Text>
            </Text>
          </View>

          {/* Description */}
          {item.description ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.label}>Description:</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            {/* Like */}
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => toggleReaction(item)}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? "#43A047" : "#43A047"}
                style={styles.iconShadow}
              />
              <Text style={styles.iconLabel}>{item.likes?.length || 0}</Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => handleComments(item)}
            >
              <Ionicons
                name="chatbubble-outline"
                size={22}
                color="#43A047"
                style={styles.iconShadow}
              />
              <Text style={styles.iconLabel}>Comment</Text>
            </TouchableOpacity>

            {/* Chat */}
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => handleChat(item)}
            >
              <Ionicons
                name="send-outline"
                size={22}
                color="#43A047"
                style={styles.iconShadow}
              />
              <Text style={styles.iconLabel}>Chat</Text>
            </TouchableOpacity>
          </View>

          {/* View Details BELOW */}
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() =>
            router.push({
              pathname: "/modals/product-details",
              params: { ...item, imageUrl: item.imageUrl },
            })
            }
          >
            <Text style={styles.detailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      );
    };

// ...rest of your DashboardScreen component (unchanged)...


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 10, color: "#1E88E5" }}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E88E5" />
      <View style={styles.topBar}>
        <View style={styles.brandContainer}>
          <Image
            source={require("@/assets/images/agrihub-davao-logo.png")}
            style={styles.logo}
          />
          <Text style={styles.navTitle}>AgriHub Davao</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/search-users")}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.navbar}>
        {["Home", "Messages"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, activeTab === tab && styles.navItemActive]}
            onPress={() =>
              tab === "Messages" ? router.push("../chats") : setActiveTab(tab)
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
      
      <View style={styles.container}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No posts available.</Text>}
          contentContainerStyle={{ paddingBottom: 60 + insets.bottom, }}
        />
      </View>

      {(userRole === "Store Owner" || userRole === "Farmer") && (
      <View style={[styles.addButtonContainer, { bottom: 20 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/modals/product-form")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add a Post</Text>
        </TouchableOpacity>
      </View>
      )}

      <Modal visible={imageModalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={styles.closeArea}
            activeOpacity={1}
            onPress={() => setImageModalVisible(false)}
          >
            <Ionicons name="close" size={36} color="#fff" style={styles.closeIcon} />
          </TouchableOpacity>

          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 20,
    marginTop: 10,
    marginLeft: 10,
  },
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
  posterName: { fontSize: 18, color: "#4A8C2A", fontWeight: "bold" },
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4A8C2A",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 20,
  },
  detailsText: { color: "#43A047", fontWeight: "bold" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  addButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#43A047",
    paddingVertical: 14,
    borderRadius: 10,
    width: "100%",
    elevation: 3,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    marginLeft: 8,
  },
  logo: {
    width: width * 0.12,
    height: width * 0.12,
    resizeMode: "contain",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: width * 0.02,
  },
  headerRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
  },iconShadow: {
    shadowColor: "#000",
    shadowOpacity: 1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
    elevation: 3, // Android support
  },iconButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    paddingHorizontal: 8,
  },iconLabel: {
    color: "#000",
    fontSize: 13,
    marginTop: 3,
    textAlign: "center",
  },saveIcon: {
  shadowOpacity: 1,
  shadowRadius: 2,
  shadowOffset: { width: 1, height: 1 },
  elevation: 3, // Android shadow support
  },modalBackground: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.95)",
  justifyContent: "center",
  alignItems: "center",
  },fullImage: {
    width: "100%",
    height: "100%",
  },
  closeArea: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeIcon: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    padding: 6,
  },
});