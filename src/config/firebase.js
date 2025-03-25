// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCejXgwQ9jDGSi-EbsvvEKP0AcXHM2gUHM",
    authDomain: "nonslop-game-logs.firebaseapp.com",
    projectId: "nonslop-game-logs",
    storageBucket: "nonslop-game-logs.firebasestorage.app",
    messagingSenderId: "534330213993",
    appId: "1:534330213993:web:af32470f3b6c989e3e84f8",
    measurementId: "G-E963CDCXX6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;

// Sign in anonymously on load
signInAnonymously(auth).catch((error) => {
  console.error("Anonymous auth failed:", error);
});

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid; // <-- unique anonymous user ID
    console.log("Anonymous User ID:", currentUserId);
  }
});

export { db, currentUserId };

