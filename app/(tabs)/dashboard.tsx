import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image, Linking, Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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
  const [unreadChats, setUnreadChats] = useState(0);
  const [verification, setVerification] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const onRefresh = useCallback(() => {
  setRefreshing(true);
  setTimeout(() => setRefreshing(false), 800);
  }, []);

  
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    type: "pending" | "rejected" | "notVerified" | null;
    title: string;
    message: string;
  }>({
    visible: false,
    type: null,
    title: "",
    message: "",
  });

  const showCustomAlert = (
    type: "pending" | "rejected" | "notVerified",
    title: string,
    message: string
  ) => {
    setCustomAlert({ visible: true, type, title, message });
  };

  const closeCustomAlert = () =>
    setCustomAlert({ ...customAlert, visible: false });

  useEffect(() => {
    if (!isFocused) return; // skip if screen not active

    const user = auth.currentUser;
    if (!user) return;

    const unsubscribers: (() => void)[] = [];

    try {
      console.log(" Dashboard: setting up snapshot listeners...");

      // Notifications (unread count)
      const notifQ = query(
        collection(db, "notifications", user.uid, "items"),
        where("read", "==", false)
      );
      unsubscribers.push(onSnapshot(notifQ, (snap) => setUnreadNotifications(snap.size)));

      // Chats
      const chatQ = query(collection(db, "chats"), where("members", "array-contains", user.uid));
      unsubscribers.push(
        onSnapshot(chatQ, (snap) => {
          let unread = 0;
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.lastSenderId !== user.uid && data.lastMessageStatus !== "read") unread++;
          });
          setUnreadChats(unread);
        })
      );

      // User Role
      const userRef = doc(db, "users", user.uid);
      unsubscribers.push(
        onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const role = snap.data().userType || "Store Owner";
          setUserRole(role);
        })
      );

      // Saved Posts
      const savedRef = collection(db, "saved_posts", user.uid, "posts");
      unsubscribers.push(
        onSnapshot(savedRef, (snap) => {
          const savedIds: string[] = [];
          snap.forEach((d) => savedIds.push(d.data().postId));
          setSavedPosts(savedIds);
        })
      );

      // Verification Status
      const verRef = doc(db, "user_verifications", user.uid);
      unsubscribers.push(
        onSnapshot(verRef, (snap) => {
          if (snap.exists()) setVerification(snap.data().status);
          else setVerification(null);
        })
      );
    } catch (error) {
      console.error("Dashboard listener setup failed:", error);
    }

    return () => {
      console.log(" Cleaning up dashboard Firestore listeners...");
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || !userRole) return; // Only run while dashboard visible
    console.log(" Dashboard: product listener active for role:", userRole);

    let isMounted = true;
    let unsub: (() => void) | null = null;

    const timer = setTimeout(() => {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;

          const allItems = snap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as any),
          }));
          const currentUid = auth.currentUser?.uid;
          const role = (userRole || "").toLowerCase().trim();

          const visibilityMap: Record<string, Set<string>> = {
            "store owner": new Set(["store owner", "consumer", "farmer"]),
            farmer: new Set(["farmer", "store owner"]),
            consumer: new Set(["consumer", "store owner"]),
          };

          const allowed = visibilityMap[role] ?? new Set();
          const visiblePosts = allItems.filter((p) => {
            const type = (p.userType || "").toLowerCase().trim();
            return allowed.has(type) && p.userId !== currentUid;
          });

          setProducts(visiblePosts);
          setFiltered(visiblePosts);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore products listener error:", error);
        }
      );
    }, 250);

    return () => {
      console.log(" Cleaning up product listener...");
      isMounted = false;
      clearTimeout(timer);
      if (unsub) unsub();
    };
  }, [isFocused, userRole]);

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
      const isLiked = currentLikes.includes(user.uid);
      const updatedLikes = isLiked
        ? currentLikes.filter((id: string) => id !== user.uid)
        : [...currentLikes, user.uid];

      await updateDoc(ref, { likes: updatedLikes });

      if (!isLiked && item.userId !== user.uid) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const actorData = userDoc.exists() ? userDoc.data() : {};

        await addDoc(collection(db, "notifications", item.userId, "items"), {
          type: "post",
          subtype: "like",
          postId: item.id,
          postTitle: item.title || "your post",
          actorId: user.uid,
          actorName: actorData.fullName || "Someone",
          actorPhoto: actorData.photoURL || null,
          message: `${actorData.fullName || "Someone"} liked your post ${
            item.title || ""
          }`,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
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
          userType: item.userType || "",
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
          <View style={[styles.infoRow, { flexWrap: "wrap", justifyContent: "space-between" }]}>
            {/* Post Title */}
            <Text style={[styles.infoText, { flexShrink: 1 }]}>
              <Text style={styles.label}>Post Title:</Text> {item.title || "Untitled"}
            </Text>

            {/* Category */}
            <Text style={[styles.infoText, { flexShrink: 1 }]}>
              <Text style={styles.label}>Category:</Text> {item.category || "N/A"}
            </Text>
          </View>

          {/* Show price only if not a consumer post */}
          {item.userType?.toLowerCase() !== "consumer" && (
            <View style={styles.infoRow}>
              <Text style={styles.infoText}>
                <Text style={styles.label}>Price:</Text>{" "}
                <Text style={{ color: "#43A047", fontWeight: "bold" }}>
                  ₱ {item.price ?? "N/A"}
                </Text>
              </Text>
            </View>
          )}

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

      <View style={styles.whiteNav}>
        {["Messages", "Notifications"].map((tab, index) => {
          const isActive = activeTab === tab && activeTab !== "Home"; // Only active if not "Home"
          const showBadge =
            (tab === "Messages" && unreadChats > 0) ||
            (tab === "Notifications" && unreadNotifications > 0);
          const badgeCount =
            tab === "Messages" ? unreadChats : unreadNotifications;

          return (
            <React.Fragment key={tab}>
              <TouchableOpacity
                style={[styles.navItemWhite, isActive && styles.navItemWhiteActive]}
                onPress={() => {
                  if (tab === "Messages") {
                    router.push("../chats");
                    setActiveTab("Messages");
                  } else if (tab === "Notifications") {
                    router.push("/notifications");
                    setActiveTab("Notifications");
                  }
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={[
                      styles.navTextWhite,
                      isActive && styles.navTextWhiteActive,
                    ]}
                  >
                    {tab}
                  </Text>

                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Divider between tabs */}
              {index === 0 && <View style={styles.verticalDivider} />}
            </React.Fragment>
          );
        })}
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

      <View style={styles.addButtonContainerFixed}>
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor:
                verification === "approved" ? "#43A047" : "#a5d6a7", // bright green vs dim green
              opacity: verification === "approved" ? 1 : 0.7,
            },
          ]}
          onPress={() => {
          if (verification === "pending") {
            showCustomAlert(
              "pending",
              "Verification In Progress",
              "Your verification is currently under review. You’ll be able to post once it’s approved."
            );
            return;
          }

          if (verification === "rejected") {
            showCustomAlert(
              "rejected",
              "Verification Rejected",
              "Your verification request was rejected."
            );
            return;
          }

          if (verification !== "approved") {
            showCustomAlert(
              "notVerified",
              "Verification Required",
              "You must verify your account before adding a post."
            );
            return;
          }

            // Only allow navigation when approved
            router.push("/modals/product-form");
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add a Post</Text>
        </TouchableOpacity>
      </View>

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
      <Modal transparent visible={customAlert.visible} animationType="fade">
      <View style={styles.alertOverlay}>
        <View
          style={[
            styles.alertBox,
            customAlert.type === "pending" && { borderColor: "#FFC107", borderWidth: 2 },
            customAlert.type === "rejected" && { borderColor: "#E53935", borderWidth: 2 },
            customAlert.type === "notVerified" && { borderColor: "#757575", borderWidth: 2 },
          ]}
        >
          {customAlert.type === "pending" && (
            <Ionicons name="time-outline" size={60} color="#FFC107" style={{ marginBottom: 10 }} />
          )}
          {customAlert.type === "rejected" && (
            <Ionicons name="close-circle-outline" size={60} color="#E53935" style={{ marginBottom: 10 }} />
          )}
          {customAlert.type === "notVerified" && (
            <Ionicons name="alert-circle-outline" size={60} color="#757575" style={{ marginBottom: 10 }} />
          )}

          <Text
            style={[
              styles.alertTitle,
              customAlert.type === "pending" && { color: "#FFC107" },
              customAlert.type === "rejected" && { color: "#E53935" },
              customAlert.type === "notVerified" && { color: "#757575" },
            ]}
          >
            {customAlert.title}
          </Text>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.alertMessage}>
              {customAlert.message}
            </Text>

            {/* Separate row for contact support */}
            <Text
              style={styles.mailLink}
              onPress={() => Linking.openURL("mailto:support@agrihub.com?subject=Verification Assistance - AgriHub")}
            >
              Contact Support
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.alertButton,
              customAlert.type === "pending" && { backgroundColor: "#FFC107" },
              customAlert.type === "rejected" && { backgroundColor: "#E53935" },
              customAlert.type === "notVerified" && { backgroundColor: "#757575" },
            ]}
            onPress={closeCustomAlert}
          >
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
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
    marginTop: 5,
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
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
    elevation: 3,
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
  elevation: 3,
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
  },badge: {
  minWidth: 28,
  height: 24,
  borderRadius: 9,
  backgroundColor: "#E53935",
  alignItems: "center",
  justifyContent: "center",
},
badgeText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "bold",
},whiteNav: {
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
  backgroundColor: "#fff",
  paddingVertical: 6,
  borderBottomWidth: 1,
  borderBottomColor: "#ddd",
  elevation: 2,
}, navItemWhite: {
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderBottomWidth: 2,
  borderBottomColor: "transparent",
}, navItemWhiteActive: {
  borderBottomColor: "#4A8C2A",
}, navTextWhite: {
  fontSize: 16,
  fontWeight: "500",
  color: "#555",
}, navTextWhiteActive: {
  color: "#4A8C2A",
  fontWeight: "bold",
},verticalDivider: {
  width: 1.2,
  height: 20,
  backgroundColor: "#000",
  alignSelf: "center",
  marginHorizontal: 8,
  opacity: 1,
},alertOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "center",
  alignItems: "center",
},
alertBox: {
  backgroundColor: "#fff",
  padding: 25,
  borderRadius: 14,
  alignItems: "center",
  width: "80%",
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 6,
  height: "40%",
  elevation: 5,
}, alertTitle: {
  fontSize: 20,
  fontWeight: "bold",
  marginBottom: 6,
  textAlign: "center",
}, alertMessage: {
  fontSize: 15,
  color: "#444",
  textAlign: "center",
  marginBottom: 16,
  lineHeight: 20,
}, alertButton: {
  paddingVertical: 10,
  paddingHorizontal: 30,
  borderRadius: 8,
  marginTop: 30,
}, alertButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "600",
},mailLink: {
  color: "#1E88E5",
  textDecorationLine: "underline",
  fontWeight: "600",
  fontSize: 18,
},addButtonContainerFixed: {
  position: "absolute",
  bottom: 55,              
  left: 0,
  right: 0,
  paddingHorizontal: 20,
  paddingVertical: 10,     
  backgroundColor: "#fff",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,             
  elevation: 6,            
},
});