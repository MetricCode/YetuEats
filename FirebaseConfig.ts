import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBoDBjFheMevJZMHtH9E1E94rYJzvsXs8k",
  authDomain: "yetueats.firebaseapp.com",
  projectId: "yetueats",
  storageBucket: "yetueats.firebasestorage.app",
  messagingSenderId: "985273428248",
  appId: "1:985273428248:web:078f996649e761cbe2166d",
  measurementId: "G-XZF1RPS4J0"
};

// Initialize Firebase
export const FIREBASE_APP = initializeApp(firebaseConfig);
export const FIREBASE_AUTH = getAuth(FIREBASE_APP);
export const FIREBASE_DB = getFirestore(FIREBASE_APP);