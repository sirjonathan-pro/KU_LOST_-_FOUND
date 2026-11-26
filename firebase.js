
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAEmW3dY36AMyHrpR0Pg7kLybp-Uappfh8",
    authDomain: "kuj-lost-and-found.firebaseapp.com",
    projectId: "kuj-lost-and-found",
    storageBucket: "kuj-lost-and-found.firebasestorage.app",
    messagingSenderId: "479191332450",
    appId: "1:479191332450:web:070e77946325755bdec33b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

console.log("KUJ Lost & Found Firebase initialized successfully!");
