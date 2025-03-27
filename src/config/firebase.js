// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";


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
  }
});

// Simple promise to wait for authentication
const authReady = new Promise((resolve, reject) => {
  // Set up auth state change listener
  onAuthStateChanged(auth, (user) => {
      if (user) {
          currentUserId = user.uid;
          console.log("Firebase authenticated");
          resolve(user.uid);
      }
  }, (error) => {
      console.error("Auth state change error:", error);
      reject(error);
  });
  
  // Start anonymous sign-in
  signInAnonymously(auth).catch((error) => {
      console.error("Anonymous auth failed:", error);
      reject(error);
  });
});

function getUserEnvironmentInfo() {
  const userAgent = navigator.userAgent;
  
  // Simple OS detection
  let os = "Unknown OS";
  if (userAgent.includes("Win")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("X11")) os = "UNIX";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (/Android/.test(userAgent)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(userAgent)) os = "iOS";

  // Simple Browser detection
  let browser = "Unknown Browser";
  if (/Chrome\/(\S+)/.test(userAgent) && !/Edge|OPR/.test(userAgent)) browser = "Chrome";
  else if (/Firefox\/(\S+)/.test(userAgent)) browser = "Firefox";
  else if (/Safari\/(\S+)/.test(userAgent) && !/Chrome/.test(userAgent)) browser = "Safari";
  else if (/Edge\/(\S+)/.test(userAgent)) browser = "Edge";
  else if (/OPR\/(\S+)/.test(userAgent)) browser = "Opera";

  return {
    os,
    browser,
    userAgent // Storing full UA string can help with future debugging
  };
}


function getDateAndTime(timestamp) {
  const dateObj = new Date(timestamp);

  // Date in YYYY-MM-DD format
  const date = dateObj.getUTCFullYear() + "-" +
               (dateObj.getUTCMonth() + 1).toString().padStart(2, '0') + "-" +
               dateObj.getUTCDate().toString().padStart(2, '0');

  // Time in HH:MM format (UTC)
  const time = dateObj.getUTCHours().toString().padStart(2, '0') + ":" +
               dateObj.getUTCMinutes().toString().padStart(2, '0');

  return { date, time };
}


// Function to save interaction - now waits for auth if needed
async function saveInteraction(interaction, dbName) {

  await authReady

  const userEnv = getUserEnvironmentInfo();
  const timestamp = Date.now();
  const { date, time } = getDateAndTime(timestamp);

  try {
      const docRef = await addDoc(collection(db, dbName), {
          userId: currentUserId || "unknown",
          userEnvironment: userEnv,
          timestamp: timestamp,
          date: date,
          time: time,
          timezone: 'utc',
          interaction: interaction
      });
    
      console.log("Firebase document written with ID:", docRef.id);
      return docRef.id;
  } catch (e) {
      console.error("Error adding document to Firebase:", e);
      return null;
  }
}

async function waitForAuth() {
  if (currentUserId) {
      return currentUserId;
  }
  
  try {
      return await authReady;
  } catch (error) {
      console.error("Authentication failed:", error);
      return null;
  }
}

export { saveInteraction, getUserEnvironmentInfo, waitForAuth};

