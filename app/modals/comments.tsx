import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db, storage } from "../../firebaseConfig";

export default function CommentsModal() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [postOwnerId, setPostOwnerId] = useState<string | null>(null);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [postTitle, setPostTitle] = useState<string>("");

  const handleImagePicker = async () => {
  try {
    const chooseFromLibrary = async () => {
      const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPermission.granted) {
        Alert.alert("Permission Denied", "Please allow photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setCommentImage(result.assets[0].uri);
      }
    };

    const takePhoto = async () => {
      const camPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPermission.granted) {
        Alert.alert("Permission Denied", "Please allow camera access.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setCommentImage(result.assets[0].uri);
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          else if (buttonIndex === 2) chooseFromLibrary();
        }
      );
    } else {
      Alert.alert(
        "Add Image",
        "Select image source:",
        [
          { text: "Camera", onPress: takePhoto },
          { text: "Gallery", onPress: chooseFromLibrary },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  } catch (err) {
    console.error("Image picker error:", err);
    Alert.alert("Error", "Unable to open image picker.");
  }
};

  const pickCommentImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setCommentImage(result.assets[0].uri);
    }
  };

  useEffect(() => {
    if (!productId) return;

    const fetchPostInfo = async () => {
      try {
        const postSnap = await getDoc(doc(db, "products", String(productId)));
        if (postSnap.exists()) {
          const data = postSnap.data();
          setPostOwnerId(data.userId || null);
          setPostTitle(data.title || "your post");
        }
      } catch (err) {
        console.error("Error fetching post info:", err);
      }
    };

    fetchPostInfo();
  }, [productId]);


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
    if (isSending) return;
    if (!newComment.trim() && !commentImage) return; // must have text or an image

    try {
      setUploading(true);

      // 1) Resolve commenter identity
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const userName = (userData as any).fullName || user.email;
      const photoURL =
        (userData as any).photoURL ||
        (userData as any).profileImage ||
        "https://cdn-icons-png.flaticon.com/512/847/847969.png";

      let imageUrl: string | null = null;
      if (commentImage) {
        const res = await fetch(commentImage);
        const blob = await res.blob();

        const imgRef = ref(
          storage,
          `comments/${productId}/${Date.now()}_${user.uid}.jpg`
        );
        await uploadBytes(imgRef, blob);
        imageUrl = await getDownloadURL(imgRef);
      }

      const newCommentData = {
        id: Date.now().toString(), // temporary local id
        userId: user.uid,
        userName,
        userPhoto: photoURL,
        text: newComment.trim(),
        imageUrl,
        likes: [],
        parentId: replyTo ? replyTo.id : null,
        createdAt: new Date(), // temporary timestamp for local display
      };

      // Optimistic UI update
      setComments((prev) => [...prev, newCommentData]);

      // Then push to Firestore
      await addDoc(collection(db, "products", String(productId), "comments"), {
        ...newCommentData,
        createdAt: serverTimestamp(), // replace with server time
      });

      try {
        const actorData = { fullName: userName, photoURL };

        if (postOwnerId && postOwnerId !== user.uid) {
          await addDoc(collection(db, "notifications", postOwnerId, "items"), {
            type: "post",
            subtype: "comment",
            postId: productId,
            postTitle,
            actorId: user.uid,
            actorName: actorData.fullName,
            actorPhoto: actorData.photoURL,
            message: `${actorData.fullName} commented on your post "${postTitle}"`,
            read: false,
            createdAt: serverTimestamp(),
          });
        }

        if (replyTo && replyTo.userId && replyTo.userId !== user.uid) {
          await addDoc(collection(db, "notifications", replyTo.userId, "items"), {
            type: "post",
            subtype: "reply",
            postId: productId,
            postTitle,
            actorId: user.uid,
            actorName: actorData.fullName,
            actorPhoto: actorData.photoURL,
            message: `${actorData.fullName} replied to your comment in "${postTitle}"`,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }

      // 5) Reset input UI
      setNewComment("");
      setCommentImage?.(null); // make sure you have const [commentImage, setCommentImage] = useState<string|null>(null)
      setReplyTo(null);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setUploading(false);
      setIsSending(false);
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

            {reply.imageUrl ? (
              <TouchableOpacity onPress={() => setFullscreenImage(reply.imageUrl)}>
                <Image
                  source={{ uri: reply.imageUrl }}
                  style={{ width: 160, height: 160, borderRadius: 10, marginTop: 6 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}

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
                <TouchableOpacity
                  onPress={() => toggleThread(reply.id)}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#888"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={{ color: "#888", fontSize: 12 }}>
                    {isExpanded ? "Hide replies" : "See replies"}
                  </Text>
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

          {item.imageUrl ? (
            <TouchableOpacity onPress={() => setFullscreenImage(item.imageUrl)}>
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: 180, height: 180, borderRadius: 10, marginTop: 8 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}
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
              <TouchableOpacity
                onPress={() => toggleThread(item.id)}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#888"
                  style={{ marginRight: 4 }}
                />
                <Text style={{ color: "#888", fontSize: 13 }}>
                  {isExpanded ? "Hide replies" : "See replies"}
                </Text>
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
          <View style={styles.commentInputWrapper}>
            {/* image preview (shows only when image is picked) */}
            {commentImage && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: commentImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setCommentImage(null)}
                >
                  <Ionicons name="close-circle" size={22} color="#E53935" />
                </TouchableOpacity>
              </View>
            )}

            {/* input row */}
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={handleImagePicker} style={{ marginRight: 6 }}>
                <Ionicons name="image-outline" size={24} color="#4A8C2A" />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Write a comment..."
                placeholderTextColor="#777"
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!newComment.trim() && !commentImage) && { opacity: 0.6 },
                ]}
                onPress={handleSend}
                disabled={!newComment.trim() && !commentImage}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {fullscreenImage && (
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeArea}
              onPress={() => setFullscreenImage(null)}
              activeOpacity={0.9}
            >
              <Ionicons name="close" size={36} color="#fff" style={styles.closeIcon} />
            </TouchableOpacity>

            <Image
              source={{ uri: fullscreenImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        )}
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
  paddingHorizontal: 12,
  paddingTop: 6,
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
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#4A8C2A",
    borderRadius: 20,
    padding: 10,
    marginLeft: 8,
  },imagePreview: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 12,
  paddingVertical: 6,
  backgroundColor: "#f9f9f9",
  borderBottomWidth: 1,
  borderColor: "#eee",
  },previewImage: {
  width: 60,
  height: 60,
  borderRadius: 8,
  },removeImageBtn: {
  marginLeft: 8,
  },commentInputWrapper: {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: "#fff",
  borderTopWidth: 1,
  borderColor: "#ddd",
  paddingBottom: 8,
},modalContainer: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.95)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
},
modalImage: {
  width: "100%",
  height: "100%",
},
closeArea: {
  position: "absolute",
  top: 40,
  right: 20,
  zIndex: 2,
},
closeIcon: {
  backgroundColor: "rgba(0,0,0,0.6)",
  borderRadius: 20,
  padding: 6,
},

});