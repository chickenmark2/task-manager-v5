import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase コンソール (https://console.firebase.google.com) でプロジェクトを作成し、
// 以下の値を置き換えてください。
const firebaseConfig = {
  apiKey: "AIzaSyCKg4TQExbxyxZ6wMpaTCVrU1U6fXhqAX0",
  authDomain: "project-chickenmark2-001.firebaseapp.com",
  projectId: "project-chickenmark2-001",
  storageBucket: "project-chickenmark2-001.firebasestorage.app",
  messagingSenderId: "483555996377",
  appId: "1:483555996377:web:e0d18c00c6fb7392fe84c8",
  measurementId: "G-6M5ZJK7XE8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
