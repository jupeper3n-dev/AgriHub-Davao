import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../firebaseConfig";
const formatTime = (timestamp: any): string => {
  if (!timestamp) return "";
  const date: Date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Chats() {
  const router = useRouter();
  const user = auth.currentUser;
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Listen to all chats of the current user
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid)
    );

    // Keep track of all chat user snapshot unsubscribers
    const userListeners: (() => void)[] = [];

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list: any[] = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const otherId = data.members.find((m: string) => m !== user.uid);
          if (!otherId) continue;

          const userRef = doc(db, "users", otherId);

          // Add user listener and store its unsubscribe function
          const userUnsub = onSnapshot(userRef, (userSnap) => {
            if (userSnap.exists()) {
              const otherData = userSnap.data();
              const updatedChat = {
                id: docSnap.id,
                ...data,
                otherUser: otherData,
              };

              setChats((prev) => {
                const existingIndex = prev.findIndex((c) => c.id === docSnap.id);
                let newList;
                if (existingIndex >= 0) {
                  newList = [...prev];
                  newList[existingIndex] = updatedChat;
                } else {
                  newList = [...prev, updatedChat];
                }

                // Sort chats by latest message timestamp
                return newList.sort((a, b) => {
                  const timeA =
                    a.updatedAt?.toMillis?.() ||
                    a.lastMessageAt?.toMillis?.() ||
                    0;
                  const timeB =
                    b.updatedAt?.toMillis?.() ||
                    b.lastMessageAt?.toMillis?.() ||
                    0;
                  return timeB - timeA;
                });
              });
            }
          });

          userListeners.push(userUnsub);
        }

        setLoading(false);
      },
      (error) => {
        console.error(" Error fetching chats:", error);
        setLoading(false);
      }
    );

    // Cleanup all listeners when component unmounts
    return () => {
      unsub();
      userListeners.forEach((fn) => fn());
    };
  }, [user]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Search only users you follow
  const handleSearch = async (text: string) => {
    setSearchText(text);
    if (!text.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    try {
      const followingSnap = await getDocs(
        collection(db, "follows", user.uid, "following")
      );
      const followingIds = followingSnap.docs.map((d) => d.id);

      if (followingIds.length === 0) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      const chunks = [];
      for (let i = 0; i < followingIds.length; i += 10) {
        const slice = followingIds.slice(i, i + 10);
        const q = query(collection(db, "users"), where("uid", "in", slice));
        const snap = await getDocs(q);
        chunks.push(
          ...snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }))
        );
      }

      const filtered = chunks.filter((u) =>
        u.fullName?.toLowerCase().includes(text.toLowerCase())
      );

      setSearchResults(filtered);
    } catch (err) {
      console.error("Search error:", err);
    }

    setSearching(false);
  };

  // Start or open chat with selected user
  const openChat = async (otherUser: any) => {
    if (!user) return;

    const me = user.uid;
    const them = otherUser.uid;
    const chatId = [me, them].sort().join("_");
    const chatRef = doc(db, "chats", chatId);

    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
      await setDoc(
        chatRef,
        {
          members: [me, them],
          lastMessage: "Say hi ",
          lastSenderId: me,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    router.push({ pathname: "/chat-room", params: { chatId, uid: them } });
  };

  // Format last seen
  const getLastSeenText = (timestamp: any) => {
    if (!timestamp) return "Offline";
    const lastSeenDate =
    timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - timestamp.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#1E88E5" barStyle="light-content" />

      {/* Sticky Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/dashboard")}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Messages</Text>
      </View>

      <View style={styles.container}>
        {/* Search bar */}
        <TextInput
          placeholder="Search users..."
          placeholderTextColor="#777"
          value={searchText}
          onChangeText={handleSearch}
          style={styles.searchInput}
        />

        {searching && <ActivityIndicator color="#1E88E5" />}

        {searchText.length > 0 ? (
          searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchItem}
                  onPress={() => openChat(item)}
                >
                  <Text style={styles.searchName}>{item.fullName}</Text>
                  <Text style={styles.searchEmail}>{item.email}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={{ backgroundColor: "#f0f0f0" }}
            />
          ) : (
            !searching && (
              <View style={styles.center}>
                <Text style={{ color: "#666", marginTop: 10 }}>
                  No users found
                </Text>
              </View>
            )
          )
        ) : (
          <FlatList
            data={chats}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              const isUnread =
                item.lastSenderId !== user?.uid &&
                item.lastMessageStatus !== "read";
              const other = item.otherUser;

              // Status text logic
              let statusLine = "";
              if (item.lastSenderId === user?.uid) {
                if (item.lastMessageStatus === "read") statusLine = "Read";
                else if (item.lastMessageStatus === "delivered")
                  statusLine = "Delivered";
              } else {
                // Receiver's POV
                statusLine = "Sent you a new message";
              }

              // Top presence text
              const presenceText = other?.isOnline
                ? "Online"
                : `Active ${getLastSeenText(other?.lastSeen)}`;

              return (
                <TouchableOpacity
                  style={[
                    styles.chatItem,
                    isUnread ? styles.unreadChat : styles.readChat,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/chat-room",
                      params: { chatId: item.id, uid: other?.uid },
                    })
                  }
                >
                  {/* Avatar + Online Indicator */}
                  <View style={styles.avatarContainer}>
                    <Image
                      source={{
                        uri:
                          other?.photoURL ||
                          other?.profileImage ||
                          "https://cdn-icons-png.flaticon.com/512/847/847969.png",
                      }}
                      style={styles.avatar}
                    />
                    {other?.isOnline && <View style={styles.onlineDot} />}
                  </View>

                  {/* Chat Info */}
                  <View style={styles.chatInfo}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={styles.chatName}>
                        {other?.fullName || "Unknown User"}
                      </Text>

                      {/* Timestamp */}
                      <Text style={styles.chatTime}>
                        {item.lastMessageAt ? formatTime(item.lastMessageAt) : ""}
                      </Text>
                    </View>

                    <Text style={styles.presenceText}>{presenceText}</Text>

                    <View style={styles.messageBlock}>
                      <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.lastMessage || "Say hi "}
                      </Text>
                      <Text style={styles.lastSeen}>{statusLine}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E88E5",
    paddingTop: 0,
  },
  headerBar: {
    backgroundColor: "#4A8C2A",
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    flexDirection: "row",
    zIndex: 10,
    elevation: 3,
  },
  headerText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  searchItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
  },
  searchName: { fontWeight: "bold", color: "#000" },
  searchEmail: { color: "#555" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 10,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  chatInfo: { flex: 1, marginRight: 10 },
  chatName: { fontSize: 16, fontWeight: "bold", color: "#000" },
  presenceText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  lastMessage: { color: "#555", marginTop: 4 },
  lastSeen: { color: "#888", fontSize: 12, marginTop: 3 },
  avatarContainer: { marginRight: 10 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#eee",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#fff",
  },
  unreadChat: {
    backgroundColor: "#E3F2FD",
  },
  readChat: {
    backgroundColor: "#fff",
  },
  messageBlock: {
    flexDirection: "column",
    marginTop: 2,
  },
  chatTime: {
  fontSize: 12,
  color: "#999",
  marginLeft: 8,
  },
  backButton: {
  marginRight: 10,
  justifyContent: "center",
  alignItems: "center",
},
});