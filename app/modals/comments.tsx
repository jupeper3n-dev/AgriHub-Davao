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
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function CommentsModal() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // ✅ Load all comments
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

  // ✅ Post comment or reply
  const handleSend = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert("Please log in first.");
    if (!newComment.trim()) return;

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userName = userSnap.exists() ? userSnap.data().fullName : user.email;

      await addDoc(collection(db, "products", String(productId), "comments"), {
        userId: user.uid,
        userName,
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

  // ❤️ Like / Unlike
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

  // 🔄 Toggle reply thread visibility
  const toggleThread = (commentId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // 🧠 Recursive render of replies
  const renderReplies = (parentId: string, depth = 1) => {
    const replies = comments.filter((c) => c.parentId === parentId);
    if (replies.length === 0) return null;

    return replies.map((reply) => {
      const isExpanded = expandedThreads[reply.id] ?? true; // expanded by default

      return (
        <View
          key={reply.id}
          style={[
            styles.replyBox,
            { marginLeft: depth * 20, backgroundColor: "#f0f7ff" },
          ]}
        >
          <Text style={styles.replyName}>{reply.userName}</Text>
          <Text style={styles.replyText}>{reply.text}</Text>

          <View style={styles.replyActions}>
            <TouchableOpacity onPress={() => toggleLike(reply)}>
              <Text style={{ color: "#E91E63" }}>
                ♥ {reply.likes?.length || 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setReplyTo(reply)}>
              <Text style={{ color: "#1E88E5" }}>Reply</Text>
            </TouchableOpacity>

            {comments.some((c) => c.parentId === reply.id) && (
              <TouchableOpacity onPress={() => toggleThread(reply.id)}>
                <Text style={{ color: "#888" }}>
                  {isExpanded ? "Hide replies" : "Show replies"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 🔁 Recursive replies (conditionally rendered) */}
          {isExpanded && renderReplies(reply.id, depth + 1)}
        </View>
      );
    });
  };

  const renderComment = ({ item }: { item: any }) => {
    const user = auth.currentUser;
    const liked = item.likes?.includes(user?.uid);
    const isExpanded = expandedThreads[item.id] ?? true;
    const hasReplies = comments.some((c) => c.parentId === item.id);

    return (
      <View style={styles.commentBox}>
        <Text style={styles.userName}>{item.userName}</Text>
        <Text style={styles.text}>{item.text}</Text>

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => toggleLike(item)}>
            <Text style={{ color: liked ? "#E91E63" : "#666" }}>
              {liked ? "♥" : "♡"} {item.likes?.length || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setReplyTo(item)}>
            <Text style={{ color: "#1E88E5" }}>Reply</Text>
          </TouchableOpacity>

          {hasReplies && (
            <TouchableOpacity onPress={() => toggleThread(item.id)}>
              <Text style={{ color: "#888" }}>
                {isExpanded ? "Hide replies" : "Show replies"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 🔁 Nested replies */}
        {isExpanded && renderReplies(item.id)}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1E88E5" />
      </View>
    );
  }

  return (
    <Modal animationType="slide" visible={true} onRequestClose={() => router.back()}>
      <View style={styles.container}>
        {/* 🔹 Header with Back */}
        <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Comments</Text>
        <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.closeBtn}>✖</Text>
        </TouchableOpacity>
        </View>

        {replyTo && (
          <View style={styles.replyingTo}>
            <Text>Replying to {replyTo.userName}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Text style={{ color: "red" }}>Cancel</Text>
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
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={{ color: "#fff" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  backBtn: { color: "#1E88E5", fontWeight: "bold", fontSize: 16 },
  title: { fontSize: 20, fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  commentBox: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    marginHorizontal: 12,
  },
  userName: { fontWeight: "bold", color: "#333" },
  text: { marginVertical: 4, color: "#444" },
  actions: { flexDirection: "row", gap: 20, marginTop: 4 },
  replyBox: {
    backgroundColor: "#e8f4ff",
    padding: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  replyName: { fontWeight: "600", color: "#1E88E5" },
  replyText: { color: "#333" },
  replyActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  replyingTo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "#e3f2fd",
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 8,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
header: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: "#ddd",
  backgroundColor: "#fff",
},
headerTitle: {
  fontSize: 20,
  fontWeight: "bold",
  color: "#333",
},
closeBtn: {
  fontSize: 22,
  color: "#E53935",
  fontWeight: "bold",
},
});