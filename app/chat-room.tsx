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
  updateDoc, // ✅ added
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

export default function ChatRoom() {
  const { chatId, uid } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const me = auth.currentUser;

  // ✅ Fetch chat partner name
  useEffect(() => {
    const fetchUser = async () => {
      try {
        let targetUid = uid;
        if (!targetUid && chatId) {
          const chatSnap = await getDoc(doc(db, "chats", String(chatId)));
          if (chatSnap.exists()) {
            const members = chatSnap.data().members || [];
            targetUid = members.find((m: string) => m !== me?.uid);
          }
        }
        if (!targetUid) return;

        const userSnap = await getDoc(doc(db, "users", String(targetUid)));
        if (userSnap.exists()) {
          setUserName(userSnap.data().fullName || "User");
        }
      } catch (err) {
        console.error("Error loading chat user:", err);
      }
    };
    fetchUser();
  }, [uid, chatId]);

  // ✅ Load messages + mark chat as read when opened
  useEffect(() => {
    if (!chatId) return;

    const msgRef = collection(db, "chats", String(chatId), "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setMessages(list);
        setLoading(false);

        // ✅ Scroll to latest
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);

        // ✅ Mark chat as read (receiver’s POV)
        const markAsRead = async () => {
          if (!me) return;
          const chatRef = doc(db, "chats", String(chatId));
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
            const data = chatSnap.data();
            // Only mark as read if I’m not the sender of the last message
            if (data.lastSenderId !== me.uid && data.lastMessageStatus !== "read") {
              await updateDoc(chatRef, {
                lastMessageStatus: "read",
              });
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

  // ✅ Send message
  const sendMessage = async () => {
    if (!text.trim() || !me) return;
    try {
      console.log("Sending message to chat:", chatId, "Text:", text);

      const msgRef = await addDoc(collection(db, "chats", String(chatId), "messages"), {
        senderId: me.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });

      console.log("Message saved with ID:", msgRef.id);

      const chatRef = doc(db, "chats", String(chatId));
      await setDoc(
        chatRef,
        {
          lastMessage: text.trim(),
          lastSenderId: me.uid,
          lastMessageStatus: "delivered", // ✅ new status when sent
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // ✅ Render message bubbles
  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.senderId === me?.uid;
    return (
      <View
        style={[
          styles.messageBubble,
          isMine ? styles.myMessage : styles.theirMessage,
        ]}
      >
        <Text
          style={[
            styles.msgText,
            isMine ? { color: "#fff" } : { color: "#000" },
          ]}
        >
          {item.text}
        </Text>
      </View>
    );
  };

  // ✅ Main Render
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ✅ Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{userName}</Text>
      </View>

      {/* ✅ Chat Body */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
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
              paddingHorizontal: 12,
              paddingBottom: 8,
              flexGrow: 1,
              justifyContent: messages.length ? "flex-end" : "center",
            }}
            ListEmptyComponent={
              <Text style={styles.placeholder}>
                Send a message to start the conversation 👋
              </Text>
            }
          />
        )}

        {/* ✅ Input Box */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={text}
            onChangeText={setText}
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A8C2A",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { color: "#fff", fontSize: 20, marginRight: 10 },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },

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

  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    marginVertical: 4,
    borderRadius: 12,
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
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    marginBottom: Platform.OS === "android" ? 2 : 0,
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
});