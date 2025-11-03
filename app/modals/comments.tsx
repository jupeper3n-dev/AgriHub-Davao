import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";

export default function CommentsModal() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // Load all comments
  useEffect(() => {
    if (!productId) return;

    const q = query(
      collection(db, "products", String(productId), "comments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setComments(list);
      setLoading(false);
    });

    return () => unsub();
  }, [productId]);

  // Post comment or reply
  const handleSend = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Please log in first.");
    if (!newComment.trim()) return;

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const userName = userData.fullName || user.email;
      const photoURL =
        userData.photoURL ||
        userData.profileImage ||
        "https://cdn-icons-png.flaticon.com/512/847/847969.png";

      await addDoc(collection(db, "products", String(productId), "comments"), {
        userId: user.uid,
        userName,
        userPhoto: photoURL,
        text: newComment.trim(),
        likes: [],
        parentId: replyTo ? replyTo.id : null,
        createdAt: serverTimestamp(),
      });

      setNewComment("");
      setReplyTo(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to post comment.");
    }
  };

  // Like / Unlike
  const toggleLike = async (comment: any) => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Please log in to like comments.");

    try {
      const ref = doc(db, "products", String(productId), "comments", comment.id);
      const currentLikes = comment.likes || [];
      const updatedLikes = currentLikes.includes(user.uid)
        ? currentLikes.filter((uid: string) => uid !== user.uid)
        : [...currentLikes, user.uid];
      await updateDoc(ref, { likes: updatedLikes });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Toggle reply thread visibility
  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // Recursive replies renderer
  const renderReplies = (parentId: string, depth = 1) => {
    const replies = comments.filter((c) => c.parentId === parentId);
    if (replies.length === 0) return null;

    return replies.map((reply) => {
      const isExpanded = expandedThreads[reply.id] ?? true;

      return (
        <View key={reply.id} style={[styles.replyBox, { marginLeft: depth *5 , marginTop: 15}]}>
        <TouchableOpacity onPress={() => router.push({ pathname: "/profile-view", params: { uid: reply.userId } })}>
          <Image
            source={{ uri: reply.userPhoto }}
            style={styles.avatarSmall}
          />
        </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.push({ pathname: "/profile-view", params: { uid: reply.userId } })}>
              <Text style={[styles.replyName, { color: "#1E88E5"}]}>{reply.userName}</Text>
            </TouchableOpacity>
            <Text style={styles.replyText}>{reply.text}</Text>

            <View style={styles.replyActions}>
              <TouchableOpacity onPress={() => toggleLike(reply)}>
                <Ionicons
                  name={
                    reply.likes?.includes(auth.currentUser?.uid)
                      ? "heart"
                      : "heart-outline"
                  }
                  size={18}
                  color="#E91E63"
                />
              </TouchableOpacity>
              <Text style={styles.likeCount}>{reply.likes?.length || 0}</Text>

              <TouchableOpacity onPress={() => setReplyTo(reply)}>
                <Ionicons name="chatbubble-outline" size={18} color="#1E88E5" />
              </TouchableOpacity>

              {comments.some((c) => c.parentId === reply.id) && (
                <TouchableOpacity onPress={() => toggleThread(reply.id)}>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#888"
                  />
                </TouchableOpacity>
              )}
            </View>

            {isExpanded && renderReplies(reply.id, depth + 1)}
          </View>
        </View>
      );
    });
  };

  const renderComment = ({ item }: { item: any }) => {
    const liked = item.likes?.includes(auth.currentUser?.uid);
    const isExpanded = expandedThreads[item.id] ?? true;
    const hasReplies = comments.some((c) => c.parentId === item.id);

    return (
      <View style={styles.commentRow}>
      <TouchableOpacity onPress={() => router.push({ pathname: "/profile-view", params: { uid: item.userId } })}>
        <Image
          source={{
            uri: item.userPhoto || "https://cdn-icons-png.flaticon.com/512/847/847969.png",
          }}
          style={styles.avatar}
        />
      </TouchableOpacity>

        <View style={styles.commentBox}>
          <TouchableOpacity onPress={() => router.push({ pathname: "/profile-view", params: { uid: item.userId } })}>
            <Text style={[styles.userName, { color: "#1E88E5"}]}>{item.userName}</Text>
          </TouchableOpacity>
          <Text style={styles.text}>{item.text}</Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => toggleLike(item)}>
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={20}
                color={liked ? "#E91E63" : "#666"}
              />
            </TouchableOpacity>
            <Text style={styles.likeCount}>{item.likes?.length || 0}</Text>

            <TouchableOpacity onPress={() => setReplyTo(item)}>
              <Ionicons name="chatbubble-outline" size={20} color="#1E88E5" />
            </TouchableOpacity>

            {hasReplies && (
              <TouchableOpacity onPress={() => toggleThread(item.id)}>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>
            )}
          </View>

          {isExpanded && renderReplies(item.id)}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4A8C2A" />
      </View>
    );
  }

  return (
    <Modal animationType="slide" visible onRequestClose={() => router.back()}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top"]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
              <Text style={styles.headerTitle}>Comments</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {replyTo && (
            <View style={styles.replyingTo}>
              <Text style={styles.replyingText}>
                Replying to <Text style={{ fontWeight: "bold" }}>{replyTo.userName}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close-circle" size={20} color="#E53935" />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={comments.filter((c) => c.parentId === null)}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            contentContainerStyle={{ paddingBottom: 80 }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Write a comment..."
              placeholderTextColor="#777"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !newComment.trim() && { opacity: 0.6 }]}
              onPress={handleSend}
              disabled={!newComment.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 6,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 12,
    marginVertical: 6,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 8,
    backgroundColor: "#eee",
  },
  avatarColumn: {
    marginRight: 6,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eee",
    marginRight: 5,
  },

  commentBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  userName: { fontWeight: "bold", color: "#4A8C2A" },
  text: { color: "#333", marginVertical: 4, fontSize: 15 },

  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  likeCount: { color: "#555", fontSize: 13, marginLeft: -4 },

  replyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f1f8e9",
    borderRadius: 10,
    padding: 8,
    marginVertical: 4,
    marginRight: 12,
  },
  replyName: { fontWeight: "600", color: "#1E88E5" },
  replyText: { color: "#333", marginVertical: 2 },
  replyActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },

  replyingTo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
  },
  replyingText: { color: "#333", fontSize: 14 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    backgroundColor: "#f4f4f4",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#000",
  },
  sendBtn: {
    backgroundColor: "#4A8C2A",
    borderRadius: 20,
    padding: 10,
    marginLeft: 8,
  },
});