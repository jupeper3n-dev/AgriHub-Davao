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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable
} from "firebase/storage";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

export default function ChatRoom() {
  const { chatId, uid } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  // peer info
  const [userName, setUserName] = useState("User");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<{
    isOnline: boolean;
    lastSeen: any;
  } | null>(null);

  // upload UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const me = auth.currentUser;

  // Animated keyboard height for Android
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      Animated.timing(keyboardHeight, {
        toValue: event.endCoordinates.height - 220,
        duration: 250,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: 250,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Helper: “x min ago”
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return "some time";
    const now = Date.now();
    const time = timestamp?.toMillis ? timestamp.toMillis() : timestamp;
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  /** Peer profile + presence listener **/
  useEffect(() => {
    let unsubPresence: any = null;
    const fetchUser = async () => {
      try {
        let targetUid: any = uid;
        if (!targetUid && chatId) {
          const chatSnap = await getDoc(doc(db, "chats", String(chatId)));
          if (chatSnap.exists()) {
            const members = chatSnap.data().members || [];
            targetUid = members.find((m: string) => m !== me?.uid);
          }
        }
        if (!targetUid) return;
        const userRef = doc(db, "users", String(targetUid));
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          setUserName(data.fullName || "User");
          setUserPhoto(data.photoURL || null);
          setUserStatus({
            isOnline: data.isOnline || false,
            lastSeen: data.lastSeen || null,
          });
        }
        unsubPresence = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserStatus({
              isOnline: data.isOnline || false,
              lastSeen: data.lastSeen || null,
            });
          }
        });
      } catch (err) {
        console.error("Error loading chat user:", err);
      }
    };
    fetchUser();
    return () => unsubPresence && unsubPresence();
  }, [uid, chatId]);

  /** Messages listener + mark read **/
  useEffect(() => {
    if (!chatId) return;
    const currentUser = auth.currentUser;
    if (!currentUser || !chatId) return;
    const msgRef = collection(db, "chats", String(chatId), "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setMessages(list);
        setLoading(false);
        // update chat's lastMessageAt in Firestore when a new message arrives
        if (snap.docs.length > 0) {
          const lastMsg = snap.docs[snap.docs.length - 1].data();
          const chatRef = doc(db, "chats", String(chatId));
          updateDoc(chatRef, {
            lastMessageAt: lastMsg.createdAt || serverTimestamp(),
            lastMessage: lastMsg.text || (lastMsg.imageUrl ? "[Image]" : ""),
            lastSenderId: lastMsg.senderId,
          });
        }
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
        const markAsRead = async () => {
          if (!me) return;
          const chatRef = doc(db, "chats", String(chatId));
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const data = chatSnap.data() as any;
            if (data.lastSenderId !== me.uid && data.lastMessageStatus !== "read") {
              await updateDoc(chatRef, { lastMessageStatus: "read" });
            }
          }
        };
        markAsRead();
      },
      (error) => {
        console.error("Chat listener error:", error);
        Alert.alert("Permission Error", "You don't have permission to read this chat.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [chatId]);

  /** Send text message **/
  const sendMessage = async () => {
    if (!text.trim() || !me) return;
    try {
      await addDoc(collection(db, "chats", String(chatId), "messages"), {
        senderId: me.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      const chatRef = doc(db, "chats", String(chatId));
      await setDoc(
        chatRef,
        {
          lastMessage: text.trim(),
          lastSenderId: me.uid,
          lastMessageStatus: "delivered",
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  /** Camera / Gallery picker **/
  const handleImagePick = async (fromCamera = false) => {
    if (!me) return;
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Denied", "Please grant access to continue.");
        return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          });
      if (result.canceled || !result.assets?.length) return;
      const imageUri = result.assets[0].uri;
      await uploadAndSendImage(imageUri);
    } catch (err) {
      console.error("Image pick error:", err);
    }
  };

  /** Upload to Storage + send as message **/
  const uploadAndSendImage = async (uri: string) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      const storage = getStorage();
      const fileName = `chats/${chatId}/${Date.now()}_${me?.uid}.jpg`;
      const imageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(imageRef, blob);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          Alert.alert("Upload Error", "Failed to upload image.");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, "chats", String(chatId), "messages"), {
            senderId: me?.uid,
            imageUrl: downloadURL,
            text: "",
            createdAt: serverTimestamp(),
          });
          const chatRef = doc(db, "chats", String(chatId));
          await setDoc(
            chatRef,
            {
              lastMessage: "[Image]",
              lastSenderId: me?.uid,
              lastMessageStatus: "delivered",
              lastMessageAt: serverTimestamp(),
            },
            { merge: true }
          );
          setUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (err) {
      console.error("Send image error:", err);
      Alert.alert("Error", "Failed to send image.");
      setUploading(false);
    }
  };

  /** My avatar **/
  const [myPhoto, setMyPhoto] = useState<string | null>(me?.photoURL || null);
  useEffect(() => {
    if (!me) return;
    const userRef = doc(db, "users", me.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setMyPhoto(data.photoURL || null);
      }
    });
    return () => unsub();
  }, [me]);

  /** Render message **/
  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.senderId === me?.uid;
    const avatarUri = isMine ? myPhoto : userPhoto;
    const avatarSource =
      avatarUri && typeof avatarUri === "string"
        ? { uri: avatarUri }
        : require("../assets/images/agrihub-davao-default-avatar.png");
    return (
      <View
        style={[
          styles.messageRow,
          {
            justifyContent: isMine ? "flex-end" : "flex-start",
            alignItems:
              typeof item.text === "string" && item.text.trim().length > 40
                ? "flex-end"
                : "center",
          },
        ]}
      >
        {!isMine && <Image source={avatarSource} style={styles.avatar} />}
        <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
          {typeof item.text === "string" && item.text.trim().length > 0 && (
            <Text style={[styles.msgText, isMine ? { color: "#fff" } : { color: "#000" }]}>
              {item.text}
            </Text>
          )}
          {item.imageUrl ? (
            <TouchableOpacity onPress={() => setFullscreenImage(item.imageUrl)}>
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 10,
                  marginTop: typeof item.text === "string" && item.text.trim() ? 6 : 0,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {isMine && <Image source={avatarSource} style={styles.avatar} />}
      </View>
    );
  };

  /** Main render **/
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{userName}</Text>
          {userStatus ? (
            <Text style={styles.statusText}>
              {userStatus.isOnline
                ? "🟢 Online"
                : `⚪ Active ${getTimeAgo(userStatus.lastSeen)} ago`}
            </Text>
          ) : (
            <Text style={styles.statusText}>⚪ Offline</Text>
          )}
        </View>
      </View>

      {/* Chat body */}
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="height" keyboardVerticalOffset={20}>
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#1E88E5" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{
                  paddingHorizontal: 8,
                  paddingBottom: 0,
                  flexGrow: 1,
                  justifyContent: messages.length ? "flex-end" : "center",
                }}
                ListEmptyComponent={
                  <Text style={styles.placeholder}>
                    Send a message to start the conversation
                  </Text>
                }
              />
            )}

            {uploading && (
              <View style={styles.uploadContainer}>
                <ActivityIndicator size="small" />
                <Text style={{ marginLeft: 8 }}>
                  Uploading… {uploadProgress.toFixed(0)}%
                </Text>
              </View>
            )}

            {/* Animated Composer (instead of static View) */}
            <Animated.View style={[styles.inputWrapper, { marginBottom: keyboardHeight }]}>
              <TouchableOpacity onPress={() => handleImagePick(false)} style={{ marginRight: 8 }}>
                <Ionicons name="image-outline" size={26} color="#4A8C2A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleImagePick(true)} style={{ marginRight: 8 }}>
                <Ionicons name="camera-outline" size={26} color="#4A8C2A" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                value={text}
                onChangeText={setText}
                placeholderTextColor="#888"
                onFocus={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
              />
              <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Styles (unchanged) **/
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  statusText: {
    color: "#e0e0e0",
    fontSize: 13,
    marginTop: 2,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  placeholder: {
    textAlign: "center",
    color: "#777",
    fontSize: 16,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: "#eee",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 8,
    marginVertical: 12,
    borderRadius: 16,
    justifyContent: "center",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#1E88E5",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f1f1",
  },
  msgText: { fontSize: 16, color: "#000" },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: "#1E88E5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendText: { color: "#fff", fontWeight: "bold" },

  uploadContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f8fff8",
  },

  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
});