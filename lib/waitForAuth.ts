import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebaseConfig";

export const waitForAuth = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
};