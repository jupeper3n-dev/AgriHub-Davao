import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { auth, db } from "../firebaseConfig";

// 🟢 Animated Like Button (for smooth tap feedback)
const AnimatedLikeButton = ({
  liked,
  onPress,
}: {
  liked: boolean;
  onPress: () => void;
}) => {
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
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={24}
          color={liked ? "#E91E63" : "#000"}
        />
      </Animated.View>
    </Pressable>
  );
};

export default function SavedPosts() {
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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

  // Like post (with animated icon)
  const toggleReaction = async (item: any, index: number) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login Required", "Please log in first.");
      return;
    }

    try {
      const ref = doc(db, "products", item.postId);
      const isLiked = item.likes?.includes(user.uid);
      const updatedLikes = isLiked
        ? item.likes.filter((id: string) => id !== user.uid)
        : [...(item.likes || []), user.uid];

      await updateDoc(ref, { likes: updatedLikes });

      // Instant UI update
      setSavedPosts((prev) => {
        const updated = [...prev];
        updated[index] = { ...item, likes: updatedLikes };
        return updated;
      });
    } catch (err) {
      console.error("Reaction error:", err);
    }
  };

  // --- CHAT (fix self-check issue) ---
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

      try {
        setChatLoading(true); // start spinner
        const me = currentUser.uid;
        const them = String(item.userId);
        const chatId = [me, them].sort().join("_");

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

        setChatLoading(false); // stop spinner before navigation
        router.push({
          pathname: "/chat-room",
          params: { chatId, uid: them },
        });
      } catch (err) {
        console.error("Start chat error:", err);
        setChatLoading(false);
        Alert.alert("Error", "Failed to open chat.");
      }
    };

    try {
      const me = currentUser.uid;
      const them = String(item.userId);
      const chatId = [me, them].sort().join("_");

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

      router.push({
        pathname: "/chat-room",
        params: { chatId, uid: them },
      });
    } catch (err) {
      console.error("Start chat error:", err);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

  // --- COMMENTS ---
  const handleComments = (item: any) => {
    router.push({
      pathname: "/modals/comments",
      params: { productId: item.postId },
    });
  };

  // --- REFRESH ---
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // --- RENDER POST ---
  const renderPost = ({ item, index }: { item: any; index: number }) => {
    const user = auth.currentUser;
    const liked = item.likes?.includes(user?.uid);

    return (
      <View style={styles.card}>
        {/* Header */}
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
            <Text style={styles.posterName}>
              Posted by {item.userName || "Unknown User"}
            </Text>
          </TouchableOpacity>

          {/* Unsave */}
          <TouchableOpacity onPress={() => handleUnsave(item.id)}>
            <Ionicons name="bookmark" size={26} color="#4A8C2A" />
          </TouchableOpacity>
        </View>

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
        <Text style={styles.infoText}>
          <Text style={styles.label}>Product:</Text> {item.title} {" | "}
          <Text style={styles.label}>Category:</Text> {item.category} {" | "}
          <Text style={styles.label}>Price:</Text>{" "}
          <Text style={{ color: "#43A047", fontWeight: "bold" }}>
            ₱ {item.price}
          </Text>
        </Text>

        {/* Description */}
        {item.description ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.label}>Description:</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsRow}>
          {/* Like */}
          <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => toggleReaction(item, index)}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={22}
                color={liked ? "#E91E63" : "#000"}
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
            <Ionicons name="chatbubble-outline" size={22} color="#000" />
            <Text style={styles.iconLabel}>Comment</Text>
          </TouchableOpacity>

          {/* Message */}
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => handleChat(item)}
          >
            <Ionicons name="send-outline" size={22} color="#000" />
            <Text style={styles.iconLabel}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* View Details */}
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={async () => {
            try {
              const ref = doc(db, "products", item.postId);
              const snap = await getDoc(ref);
              if (snap.exists()) {
                const fullData = { id: snap.id, ...snap.data() };
                // Explicitly type fullData as any to allow flexible Firestore data
                const data = fullData as any;

                router.push({
                  pathname: "/modals/product-details",
                  params: {
                    ...data,
                    imageUrl:
                      typeof data.imageUrl === "string"
                        ? data.imageUrl
                        : Array.isArray(data.imageUrl)
                        ? data.imageUrl[0]
                        : (data.imageUrl as any)?.uri || "",
                  },
                });
              } else {
                Alert.alert("Not Found", "The original post could not be found.");
              }
            } catch (err) {
              console.error("View details error:", err);
              Alert.alert("Error", "Failed to load post details.");
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
        <Text style={{ marginTop: 10, color: "#1E88E5" }}>
          Loading saved posts...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4A8C2A" />
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Saved Posts</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>You have no saved posts yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 50, padding: 10 }}
      />
      {chatLoading && (
        <View style={styles.chatOverlay}>
          <ActivityIndicator size="large" color="#4A8C2A" />
          <Text style={styles.chatText}>Retrieving conversation...</Text>
        </View>
      )}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeArea}
            onPress={() => setImageModalVisible(false)}
            activeOpacity={1}
          >
            <Ionicons
              name="close"
              size={36}
              color="#fff"
              style={styles.closeIcon}
            />
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
  navbar: {
    backgroundColor: "#4A8C2A",
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navTitle: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginTop: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  posterName: { fontSize: 18, color: "#4A8C2A", fontWeight: "bold" },
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
  infoText: { fontSize: 16, color: "#000" },
  label: { fontWeight: "bold", color: "#000" },
  descriptionBox: { marginTop: 8, marginBottom: 8 },
  description: { color: "#000", fontSize: 16, lineHeight: 20 },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 50,
    marginTop: 8,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    paddingHorizontal: 8,
    minWidth: 60,
  },
  iconLabel: { color: "#000", fontSize: 13, marginTop: 3, textAlign: "center" },
  detailsBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4A8C2A",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 20,
  },
  detailsText: { color: "#000", fontWeight: "bold" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  closeBtn: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    padding: 4,
  },
  iconShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
    elevation: 3,
  },chatOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
},
chatText: {
  color: "#fff",
  marginTop: 12,
  fontSize: 16,
  fontWeight: "500",
},modalContainer: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.95)",
  justifyContent: "center",
  alignItems: "center",
},fullImage: {
  width: "100%",
  height: "100%",
},closeArea: {
  position: "absolute",
  top: 40,
  right: 20,
  zIndex: 2,
},closeIcon: {
  backgroundColor: "rgba(0,0,0,0.5)",
  borderRadius: 20,
  padding: 6,
},
}); 