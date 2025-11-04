import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    FlatList,
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { auth, db } from "../firebaseConfig";

export default function NotificationsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "notifications", user.uid, "items"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setItems(list);
    });

    return () => unsub();
  }, []);

  const renderItem = ({ item }: { item: any }) => {
    const actorPhoto =
      item.actorPhoto ||
      "https://cdn-icons-png.flaticon.com/512/847/847969.png";

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        activeOpacity={0.7}
        onPress={async () => {
        try {
            const user = auth.currentUser;
            if (user && !item.read) {
            await updateDoc(doc(db, "notifications", user.uid, "items", item.id), {
                read: true,
            });
            }

            if (item.type === "verification") {
            // Go to user's own profile
            router.push({
                pathname: "/profile-view",
                params: { uid: auth.currentUser?.uid },
            });
            } else if (item.type === "follow" && item.actorId) {
            // Go to the follower’s profile
            router.push({
                pathname: "/profile-view",
                params: { uid: item.actorId },
            });
            } else if (item.type === "rating" && item.actorId) {
            // Go to the profile of the person who rated you
            router.push({
                pathname: "/profile-view",
                params: { uid: item.actorId },
            });
            } else if (item.subtype === "comment" || item.subtype === "reply") {
            // Go to the post’s comments modal
            router.push({
                pathname: "/modals/comments",
                params: { productId: item.postId },
            });
            } else {
            // Default: go to post details
            router.push({
                pathname: "/modals/product-details",
                params: { postId: item.postId },
            });
            }

        } catch (err) {
            console.error("Error opening notification:", err);
        }
        }}
      >
        <Image source={{ uri: actorPhoto }} style={styles.avatar} />
        <View style={styles.notificationContent}>
        <Text style={styles.messageText}>
            <Text style={styles.actorName}>{item.actorName || "Someone"} </Text>
            {item.type === "follow"
            ? "started following you"
            : item.type === "verification"
            ? item.subtype === "approved"
                ? "Your verification request has been approved!"
                : `Your verification request has been rejected.${
                    item.reason ? " Reason: " + item.reason : ""
                    }`
            : item.type === "rating"
            ? `rated you ${item.rating} star${item.rating > 1 ? "s" : ""}`
            : item.subtype === "like"
            ? "liked your post "
            : item.subtype === "comment"
            ? "commented on your post "
            : item.subtype === "reply"
            ? "replied to your comment on the post "
            : "interacted with your post "}
            {item.postTitle ? (
            <Text style={styles.postTitle}>{`"${item.postTitle}"`}</Text>
            ) : null}
        </Text>

        {/* Add this block for status badge */}
        {item.type === "verification" && (
            <View style={styles.verificationStatus}>
            <Ionicons
                name={
                item.subtype === "approved"
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={16}
                color={item.subtype === "approved" ? "#2E7D32" : "#E53935"}
            />
            <Text
                style={[
                styles.verificationText,
                {
                    color: item.subtype === "approved" ? "#2E7D32" : "#E53935",
                },
                ]}
            >
                {item.subtype === "approved" ? "Approved" : "Rejected"}
            </Text>
            </View>
        )}

        {item.reason && (
            <Text style={styles.reasonText}>Reason: {item.reason}</Text>
        )}

        <Text style={styles.timeText}>
            {item.createdAt?.toDate
            ? new Date(item.createdAt.toDate()).toLocaleString()
            : ""}
        </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#4A8C2A" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications yet.</Text>
        }
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 12,
  },
  empty: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 16,
  },

  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E0E0E0",
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 12,
    marginHorizontal: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#4A8C2A",
    gap: 10,
  },
  unreadCard: {
    backgroundColor: "#F9FFF6",
    borderLeftColor: "#66BB6A",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eee",
  },
  notificationContent: {
    flex: 1,
  },
  actorName: {
    fontWeight: "bold",
    color: "#2E7D32",
  },
  postTitle: {
    color: "#1E88E5",
    fontWeight: "600",
  },
  messageText: {
    color: "#222",
    fontSize: 15,
    lineHeight: 22,
  },
  reasonText: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
  },
  timeText: {
    color: "#999",
    fontSize: 12,
    marginTop: 6,
  },verificationStatus: {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  marginTop: 6,
},
verificationText: {
  fontSize: 13,
  fontWeight: "600",
},
});