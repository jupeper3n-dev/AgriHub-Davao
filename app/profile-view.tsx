import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
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
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function ProfileView() {
  const { userId: rawParam, uid } = useLocalSearchParams();
  const router = useRouter();
  // ✅ Accepts either ?userId=... or ?uid=...
  const userId = Array.isArray(rawParam) ? rawParam[0] : rawParam || uid;

  const [userInfo, setUserInfo] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  // 🧱 Report user modal states
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  // 🔄 Pull-to-refresh
// 🔄 Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      // Re-fetch user info
      const ref = doc(db, "users", String(userId));
      const snap = await getDoc(ref);
      if (snap.exists()) setUserInfo(snap.data());

      // Reload posts
      const postsSnap = await getDocs(
        query(
          collection(db, "products"),
          where("userId", "==", String(userId)),
          orderBy("createdAt", "desc")
        )
      );
      const list: any[] = [];
      postsSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPosts(list);

      // Re-check report status
      if (auth.currentUser) {
        const q = query(
          collection(db, "reports"),
          where("reporterId", "==", auth.currentUser.uid),
          where("reportedId", "==", userId)
        );
        const snapReport = await getDocs(q);
        setHasReported(!snapReport.empty);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReportUser = async () => {
    if (!auth.currentUser) {
      Alert.alert("Login Required", "You must be logged in to report users.");
      return;
    }

    if (!reportReason.trim()) {
      Alert.alert("Missing Info", "Please provide a reason for your report.");
      return;
    }

    try {
      setReportLoading(true); // ⏳ Start spinner

      await addDoc(collection(db, "reports"), {
        reporterId: auth.currentUser.uid,
        reportedId: userId,
        reason: reportReason.trim(),
        createdAt: serverTimestamp(),
      });

      Alert.alert("✅ Report Submitted", "The user has been reported.");
      setReportModalVisible(false);
      setReportReason("");
    } catch (err) {
      console.error("Report error:", err);
      Alert.alert("Error", "Failed to submit report.");
    } finally {
      setReportLoading(false); // ✅ Stop spinner
    }
  };

  const currentUser = auth.currentUser;
  // ⭐ Rating system
  const [myRating, setMyRating] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingsCount, setRatingsCount] = useState<number>(0);

  // 🕒 Helper for "X time ago"
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "";
    const date =
      typeof timestamp?.toDate === "function" ? timestamp.toDate() : timestamp;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // ✅ Load user info
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!userId) {
          setLoading(false);
          return;
        }
        const ref = doc(db, "users", String(userId));
        const snap = await getDoc(ref);
        if (snap.exists()) setUserInfo(snap.data());
        else Alert.alert("User Not Found", "This user profile no longer exists.");
      } catch (err: any) {
        console.error("🔥 Error loading user:", err.message || err);
        Alert.alert("Error", "Unable to load user profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  // ✅ Load user posts (kept with full actions)
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, "products"),
      where("userId", "==", String(userId)),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setPosts(list);
        setLoadingPosts(false);
      },
      (err) => {
        console.error("Firestore listener error:", err);
        setLoadingPosts(false);
      }
    );
    return () => unsub();
  }, [userId]);

  // ✅ Check if current user has already reported this profile
  useEffect(() => {
    if (!auth.currentUser || !userId) return;

    const checkReport = async () => {
      try {
        const q = query(
          collection(db, "reports"),
          where("reporterId", "==", auth.currentUser?.uid || ""),
          where("reportedId", "==", userId)
        );
        const snap = await getDocs(q);
        setHasReported(!snap.empty); // ✅ true if already reported
      } catch (err) {
        console.error("Check report error:", err);
      }
    };

    checkReport();
  }, [userId]);

  // ✅ Live follower count
  useEffect(() => {
    if (!userId) return;
    const ref = collection(db, "follows", String(userId), "followers");
    const unsub = onSnapshot(ref, (snap) => setFollowerCount(snap.size));
    return () => unsub();
  }, [userId]);

    useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, "ratings"), where("userId", "==", userId));
    const unsub = onSnapshot(
        q,
        (snap) => {
        const ratingMap = new Map<string, { score: number; updatedAt: any }>();

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (typeof data.score === "number" && data.ratedBy) {
            const existing = ratingMap.get(data.ratedBy);
            // keep only the latest rating per user
            if (
                !existing ||
                (data.updatedAt?.toMillis?.() || 0) > (existing.updatedAt?.toMillis?.() || 0)
            ) {
                ratingMap.set(data.ratedBy, { score: data.score, updatedAt: data.updatedAt });
            }
            }
        });

        const allRatings = Array.from(ratingMap.values()).map((r) => r.score);
        const total = allRatings.reduce((sum, n) => sum + n, 0);
        const count = allRatings.length;
        const myScore = ratingMap.get(currentUser?.uid || "")?.score || null;

        setRatingsCount(count);
        setAvgRating(count > 0 ? total / count : 0);
        setMyRating(myScore);
        },
        (err) => console.error("Rating listener error:", err)
    );

    return () => unsub();
    }, [userId, currentUser]);

  // ✅ Follow state (live)
  useEffect(() => {
    if (!currentUser || !userId) return;
    const ref = doc(db, "follows", currentUser.uid, "following", String(userId));
    const unsub = onSnapshot(ref, (snap) => setIsFollowing(snap.exists()));
    return () => unsub();
  }, [currentUser, userId]);

  // ✅ Toggle Follow
  const toggleFollow = async () => {
    if (!currentUser) return Alert.alert("Login Required");
    const me = currentUser.uid;
    const target = String(userId);

    try {
      const followingRef = doc(db, "follows", me, "following", target);
      const followerRef = doc(db, "follows", target, "followers", me);

      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
      } else {
        await setDoc(followingRef, {
          userId: target,
          followedAt: serverTimestamp(),
        });
        await setDoc(followerRef, {
          userId: me,
          followedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error("toggleFollow error:", err);
      Alert.alert("Error", "Failed to update follow status.");
    }
  };

  // ✅ Start Chat (with loading overlay)
  const startChat = async () => {
    if (!currentUser) {
      Alert.alert("Login Required", "You must be logged in to send messages.");
      return;
    }

    setChatLoading(true);
    try {
      const me = currentUser.uid;
      const them = String(userId);
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

      // Brief delay so users see the overlay and Firestore can settle
      setTimeout(() => {
        setChatLoading(false);
        router.push({ pathname: "/chat-room", params: { chatId, uid: them } });
      }, 800);
    } catch (err) {
      console.error("Start chat error:", err);
      setChatLoading(false);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

  // ✅ Render Post (ALL actions preserved)
  const renderPost = ({ item }: { item: any }) => {
    const user = auth.currentUser;
    const liked = item.likes?.includes(user?.uid);

    const toggleReaction = async () => {
      try {
        const ref = doc(db, "products", item.id);
        const currentLikes = item.likes || [];
        const updatedLikes = currentLikes.includes(user?.uid)
          ? currentLikes.filter((id: string) => id !== user?.uid)
          : [...currentLikes, user?.uid];
        await setDoc(ref, { likes: updatedLikes }, { merge: true });
      } catch (err: any) {
        console.error("Reaction error:", err);
      }
    };

    const handleComments = () => {
      router.push({ pathname: "/modals/comments", params: { productId: item.id } });
    };

    const handleShare = async () => {
      try {
        const link = `https://geo-davao.app/product?id=${item.id}`;
        await Clipboard.setStringAsync(link);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(link);
        } else {
          Alert.alert("Link copied!", link);
        }
      } catch (err: any) {
        Alert.alert("Error", "Failed to share product link.");
      }
    };

    const handleSave = async () => {
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
            createdAt: new Date(),
          });
          Alert.alert("Saved", "Post added to your saved list!");
        }
      } catch (err: any) {
        Alert.alert("Error", "Unable to save post.");
      }
    };

    return (
      <View style={styles.card}>
        <Text style={styles.posterName}>
          Posted by{" "}
          <Text style={{ fontWeight: "bold", color: "#1E88E5" }}>
            {item.userName || "Unknown User"}
          </Text>{" "}
          • {getTimeAgo(item.createdAt)}
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

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={toggleReaction}>
            <Text style={[styles.iconText, liked && { color: "#E91E63" }]}>
              ❤️ {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleComments}>
            <Text style={styles.iconText}>💬 Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare}>
            <Text style={styles.iconText}>📤 Share</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.iconText}>🔖 Save</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() =>
            router.push({
              pathname: "/modals/product-details",
              params: item,
            })
          }
        >
          <Text style={styles.detailsText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      {/* 🌀 Chat loading overlay */}
      <Modal visible={chatLoading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1E88E5" />
            <Text style={styles.loadingText}>Retrieving conversation...</Text>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={{ color: "#1E88E5", fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      {userInfo && (
        <View style={styles.profileHeader}>
          {userInfo.photoURL ? (
            <Image source={{ uri: userInfo.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={{ color: "#1E88E5", fontSize: 18 }}>
                {userInfo.fullName?.[0]?.toUpperCase() || "U"}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{userInfo.fullName || "Unnamed User"}</Text>
          <Text style={styles.email}>{userInfo.email}</Text>

            <Text style={styles.metaLine}>
            👥 Followers: {followerCount}  •  ⭐ {avgRating.toFixed(1)} ({ratingsCount})
            </Text>

            {/* ⭐ Rate this user */}
            {currentUser?.uid !== userId && (
            <View style={styles.rateRow}>
            {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                key={n}
                onPress={async () => {
                if (!currentUser) return Alert.alert("Login Required");
                try {
                    const ratingId = `${userId}_${currentUser.uid}`;
                    const ratingRef = doc(db, "ratings", ratingId);

                    // 🧹 Delete any stray old rating docs from previous versions
                    const oldRatings = query(
                    collection(db, "ratings"),
                    where("userId", "==", userId),
                    where("ratedBy", "==", currentUser.uid)
                    );
                    const oldSnap = await getDocs(oldRatings);
                    for (const d of oldSnap.docs) {
                    if (d.id !== ratingId) await deleteDoc(d.ref);
                    }

                    // ✅ Create or overwrite rating doc (one per user)
                    await setDoc(
                    ratingRef,
                    {
                        userId,
                        ratedBy: currentUser.uid,
                        score: n,
                        updatedAt: serverTimestamp(),
                    });

                    setMyRating(n);
                    await setDoc(
                    ratingRef,
                    {
                        userId,
                        ratedBy: currentUser.uid,
                        score: n,
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                    );
                } catch (err) {
                    console.error("Rating error:", err);
                    Alert.alert("Error", "Unable to save rating.");
                }
                }}
                >
                <Text
                    style={{
                    fontSize: 26,
                    marginHorizontal: 2,
                    color: n <= (myRating || 0) ? "#FFD700" : "#C7C7C7", // ⭐ yellow if active, gray if not
                    }}
                >
                    ★
                </Text>
                </TouchableOpacity>
            ))}
            <Text style={{ marginLeft: 8, color: "#555" }}>
                {myRating ? `You rated: ${myRating}⭐` : "Tap to rate"}
            </Text>
            </View>
            )}

          <Text style={styles.role}>
            {userInfo.userType
              ? userInfo.userType.charAt(0).toUpperCase() +
                userInfo.userType.slice(1)
              : "Unknown Role"}
          </Text>

          {currentUser?.uid !== userId && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowing && { backgroundColor: "#43A047" },
                ]}
                onPress={toggleFollow}
              >
                <Text style={styles.followText}>
                  {isFollowing ? "Following" : "+ Follow"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.msgBtn} onPress={startChat}>
                <Text style={styles.msgText}>💬 Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.reportBtn,
                  hasReported && { backgroundColor: "#ccc" },
                ]}
                disabled={hasReported}
                onPress={() => setReportModalVisible(true)}
              >
                <Text style={styles.reportText}>
                  {hasReported ? "Reported" : "Report"}
                </Text>
              </TouchableOpacity>

            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Posts by this user</Text>

      {loadingPosts ? (
        <ActivityIndicator color="#1E88E5" />
      ) : posts.length === 0 ? (
        <Text style={styles.noPosts}>No posts available.</Text>
      ) : (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      )}

        <Modal visible={reportModalVisible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Report User</Text>
          <TextInput
            placeholder="Enter reason..."
            value={reportReason}
            onChangeText={setReportReason}
            multiline
            style={styles.modalInput}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                { backgroundColor: reportLoading ? "#ccc" : "#4A8C2A" },
              ]}
              disabled={reportLoading}
              onPress={handleReportUser}
            >
              {reportLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalBtnText}>Submit</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#E53935" }]}
              onPress={() => setReportModalVisible(false)}
              disabled={reportLoading}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  backBtn: { marginBottom: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingBox: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  loadingText: { marginTop: 10, color: "#1E88E5", fontWeight: "600" },

  profileHeader: {
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  name: { fontSize: 20, fontWeight: "bold", color: "#222" },
  email: { color: "#555", marginBottom: 6 },
  role: { color: "#1E88E5", fontWeight: "600", marginTop: 6 },
  metaLine: { color: "#444", marginTop: 6 },

  followBtn: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followText: { color: "#fff", fontWeight: "bold" },
  msgBtn: {
    backgroundColor: "#f1f1f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 10,
  },
  reportBtn: {
  backgroundColor: "#E53935",
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 20,
  marginLeft: 10,
  },
  reportText: {
  color: "#fff",
  fontWeight: "bold",
  },
  msgText: { color: "#1E88E5", fontWeight: "600" },
  actionRow: { flexDirection: "row", marginTop: 10 },

  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },

  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  posterName: { fontSize: 14, marginBottom: 6, color: "#555" },
  image: { width: "100%", height: 180, borderRadius: 8, marginBottom: 8 },
  imagePlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#eee",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  infoRow: { marginBottom: 6 },
  infoText: { color: "#444" },
  label: { fontWeight: "bold", color: "#000" },
  descriptionBox: { marginBottom: 6 },
  description: { color: "#555" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  iconText: { color: "#444" },
  detailsBtn: {
    marginTop: 8,
    backgroundColor: "#1E88E5",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  detailsText: { color: "#fff", fontWeight: "bold" },
  noPosts: { textAlign: "center", color: "#888", marginTop: 20 },
  rateRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 8,
},
modalOverlay: {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "rgba(0,0,0,0.5)",
},
modalBox: {
  backgroundColor: "#fff",
  padding: 20,
  borderRadius: 10,
  width: "85%",
},
modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
modalInput: {
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 8,
  padding: 10,
  height: 100,
  textAlignVertical: "top",
  marginBottom: 10,
},
modalButtons: { flexDirection: "row", justifyContent: "space-between" },
modalBtn: {
  flex: 1,
  padding: 10,
  borderRadius: 8,
  alignItems: "center",
  marginHorizontal: 5,
},
modalBtnText: { color: "#fff", fontWeight: "bold" },
});