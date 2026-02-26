// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, limit, where, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";


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

// Sign in anonymously on load with retry logic
function attemptAnonymousSignIn(maxRetries = 3, delay = 2000) {
  let attempts = 0;
  
  function trySignIn() {
    attempts++;
    console.log(`Authentication attempt ${attempts}/${maxRetries}...`);
    
    return signInAnonymously(auth).catch((error) => {
      console.error(`Anonymous auth failed (attempt ${attempts}):`, error);
      
      // Handle visibility check error specifically
      if (error.code === 'auth/visibility-check-was-unavailable') {
        console.warn("Firebase visibility check unavailable - this is often a temporary issue");
        
        if (attempts < maxRetries) {
          console.log(`Retrying authentication in ${delay/1000} seconds...`);
          return new Promise(resolve => setTimeout(() => resolve(trySignIn()), delay));
        }
      }
      
      throw error;
    });
  }
  
  return trySignIn();
}

// Start the authentication process with retries
attemptAnonymousSignIn().catch((error) => {
  console.error("All authentication attempts failed:", error);
});

// Listen for authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid; // <-- unique anonymous user ID
  }
});

// Simple promise to wait for authentication with retry logic
const authReady = new Promise((resolve, reject) => {
  let authResolved = false;
  
  // Set up auth state change listener
  onAuthStateChanged(auth, (user) => {
      if (user) {
          currentUserId = user.uid;
          console.log("Firebase authenticated");
          authResolved = true;
          resolve(user.uid);
      }
  }, (error) => {
      console.error("Auth state change error:", error);
      if (!authResolved) {
          reject(error);
      }
  });
  
  // Start anonymous sign-in with retries
  attemptAnonymousSignIn(3, 2000).catch((error) => {
      console.error("All anonymous auth attempts failed:", error);
      // If auth hasn't been resolved yet by the onAuthStateChanged handler
      if (!authResolved) {
          // Create a fallback user ID to allow the game to continue without Firebase
          currentUserId = "offline-" + Math.random().toString(36).substring(2, 15);
          console.warn("Using offline fallback ID:", currentUserId);
          resolve(currentUserId); // Resolve anyway to prevent game blocking
      }
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
  try {
    // Try to wait for auth, but don't block game if it fails
    try {
      await Promise.race([
        authReady,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Auth timeout")), 5000)
        )
      ]);
    } catch (authError) {
      console.warn("Auth timed out or failed, continuing with offline mode:", authError.message);
      // Continue anyway - we'll use the fallback ID or "unknown"
    }

    const userEnv = getUserEnvironmentInfo();
    const timestamp = Date.now();
    const { date, time } = getDateAndTime(timestamp);

    // Only try to save to Firebase if we're not in offline mode
    if (currentUserId && !currentUserId.startsWith("offline-")) {
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
        // Continue in offline mode
      }
    } else {
      console.log("Skipping Firebase save in offline mode");
    }
    
    // Return a fake ID in offline mode
    return "offline-" + Math.random().toString(36).substring(2, 15);
  } catch (e) {
    console.error("Error in saveInteraction:", e);
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

// Function to delete scores that no longer qualify as high scores
async function cleanupOldScores(gameMode, maxResults = 10) {
  await authReady;
  
  try {
    console.log(`Cleaning up old scores for ${gameMode} mode...`);
    
    // Get all scores for the mode without limit
    let scoresQuery;
    
    if (gameMode) {
      scoresQuery = query(
        collection(db, 'highscores'),
        where("mode", "==", gameMode),
        orderBy("score", "desc")
      );
    } else {
      scoresQuery = query(
        collection(db, 'highscores'),
        orderBy("score", "desc")
      );
    }
    
    const querySnapshot = await getDocs(scoresQuery);
    const scores = [];
    
    querySnapshot.forEach((doc) => {
      scores.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // If we have more scores than maxResults, delete the excess
    if (scores.length > maxResults) {
      console.log(`Found ${scores.length} scores, keeping top ${maxResults}, deleting ${scores.length - maxResults}`);
      
      // Get the scores to delete (everything after the top maxResults)
      const scoresToDelete = scores.slice(maxResults);
      
      // Delete each score
      for (const scoreData of scoresToDelete) {
        try {
          await deleteDoc(doc(db, 'highscores', scoreData.id));
          console.log(`Deleted score with ID: ${scoreData.id}, score: ${scoreData.score}`);
        } catch (deleteError) {
          console.error(`Error deleting score ${scoreData.id}:`, deleteError);
        }
      }
      
      console.log(`Cleanup completed, deleted ${scoresToDelete.length} scores`);
    } else {
      console.log(`Only ${scores.length} scores found, no cleanup needed`);
    }
    
    return true;
  } catch (e) {
    console.error("Error cleaning up old scores:", e);
    return false;
  }
}

// Function to save a high score
async function saveHighScore(scoreData) {
  await authReady;
  
  const timestamp = Date.now();
  const { date, time } = getDateAndTime(timestamp);
  
  // Debug: Log the full score data object to check all fields
  console.log("Full scoreData object:", JSON.stringify(scoreData, null, 2));
  
  try {
    // Create the data object to save
    const highScoreData = {
      userId: currentUserId || "unknown",
      username: scoreData.username || "Anonymous Player",
      score: scoreData.score || 0,
      mode: scoreData.mode || "easy",
      level: scoreData.level || 1,
      temperature: scoreData.temperature || 0.2,
      prompt: scoreData.prompt || "",
      timestamp: timestamp,
      date: date,
      time: time,
      timezone: 'utc',
      wordCount: scoreData.totalWordCount || 0,
      aiWordCount: scoreData.failCount || 0,
      originalWordCount: scoreData.originalWordCount || 0,
      inputText: scoreData.inputText || ""
    };
    
    // Debug: Log the exact data being saved to Firebase
    console.log("Saving to Firebase:", JSON.stringify(highScoreData, null, 2));
    
    const docRef = await addDoc(collection(db, 'highscores'), highScoreData);
    
    console.log("High score saved with ID:", docRef.id);
    
    // After saving the high score, clean up any old scores that no longer qualify
    try {
      await cleanupOldScores(scoreData.mode, 10); // Keep top 10 scores per mode
    } catch (cleanupError) {
      console.error("Error during score cleanup:", cleanupError);
      // Continue even if cleanup fails
    }
    
    // Debug: Verify the document was saved by retrieving it
    try {
      const savedData = await getTopScores(scoreData.mode, 1);
      console.log("Most recent saved high score:", savedData[0] ? JSON.stringify(savedData[0], null, 2) : "No data");
    } catch (readError) {
      console.error("Error verifying saved high score:", readError);
    }
    
    return docRef.id;
  } catch (e) {
    console.error("Error adding high score:", e);
    console.error("Error details:", e.message, e.code);
    return null;
  }
}

// Function to get top scores
async function getTopScores(gameMode = null, maxResults = 10) {
  await authReady;
  
  try {
    let scoresQuery;
    let indexErrorHandled = false;
    
    // Try with the ideal query first
    try {
      if (gameMode) {
        // Filter by mode if provided
        scoresQuery = query(
          collection(db, 'highscores'),
          where("mode", "==", gameMode),
          orderBy("score", "desc"),
          limit(maxResults)
        );
      } else {
        // Get all scores regardless of mode
        scoresQuery = query(
          collection(db, 'highscores'),
          orderBy("score", "desc"),
          limit(maxResults)
        );
      }
      
      const querySnapshot = await getDocs(scoresQuery);
      const scores = [];
      
      querySnapshot.forEach((doc) => {
        scores.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return scores;
    } catch (indexError) {
      // If we hit an index error, handle it with a fallback approach
      if (indexError.message && indexError.message.includes("requires an index")) {
        console.warn("Firebase index error detected. Using fallback query method.");
        indexErrorHandled = true;
        
        // Fallback: Get all scores and filter/sort client-side
        // This is less efficient but works without the composite index
        const fallbackQuery = query(collection(db, 'highscores'));
        let allScores = [];
        
        try {
          const snapshot = await getDocs(fallbackQuery);
          snapshot.forEach((doc) => {
            // Ensure we have valid score data
            const data = doc.data();
            if (data && typeof data.score === 'number') {
              allScores.push({
                id: doc.id,
                ...data
              });
            }
          });
          
          // Manual filtering and sorting
          let filteredScores = gameMode 
            ? allScores.filter(score => score.mode === gameMode)
            : allScores;
            
          // Sort by level descending first, then by score descending
          filteredScores.sort((a, b) => {
            // Get level values, default to 1 if not present
            const levelA = typeof a.level === 'number' ? a.level : 1;
            const levelB = typeof b.level === 'number' ? b.level : 1;
            
            // If levels are different, sort by level
            if (levelB !== levelA) {
              return levelB - levelA;
            }
            
            // If levels are the same, sort by score
            const scoreA = typeof a.score === 'number' ? a.score : 0;
            const scoreB = typeof b.score === 'number' ? b.score : 0;
            return scoreB - scoreA;
          });
          
          // Limit to requested number
          console.log(`Fallback method returned ${filteredScores.length} scores before limiting to ${maxResults}`);
          return filteredScores.slice(0, maxResults);
        } catch (fallbackError) {
          console.error("Error in fallback query method:", fallbackError);
          // Return empty array as last resort
          return [];
        }
      } else {
        // If it's not an index error, re-throw it
        throw indexError;
      }
    }
  } catch (e) {
    console.error("Error getting top scores:", e);
    if (e.message && e.message.includes("requires an index")) {
      console.error("This error requires creating a Firebase index. Please visit the following URL to create the necessary index:");
      console.error("https://console.firebase.google.com/project/nonslop-game-logs/firestore/indexes");
      console.error("You need to create a composite index on the 'highscores' collection with fields 'mode' (Ascending) and 'score' (Descending)");
      console.error("Until the index is created, the application will use a less efficient fallback method.");
    }
    return [];
  }
}

// Check if the score is a high score
async function isHighScore(score, gameMode, level, maxResults = 10) {
  try {
    // Validate input parameters
    if (typeof score !== 'number' || isNaN(score)) {
      console.warn("Invalid score value provided to isHighScore:", score);
      score = 0; // Default to 0 if invalid
    }
    
    // Get top scores using our improved function
    const topScores = await getTopScores(gameMode, maxResults);
    console.log(`Retrieved ${topScores.length} top scores for ${gameMode} mode`);
    
    // If we have fewer than maxResults scores, it's automatically a high score
    if (topScores.length < maxResults) {
      console.log(`Less than ${maxResults} scores on leaderboard, this is a high score`);
      return true;
    }
    
    // If the array is empty (despite expecting scores) assume it's a high score
    if (topScores.length === 0) {
      console.warn("No scores retrieved, assuming this is a high score");
      return true;
    }
    
    // Use level-aware comparison (same logic as getTopScores sorting)
    const lowestOnBoard = topScores[topScores.length - 1];
    const lowestLevel = typeof lowestOnBoard.level === 'number' ? lowestOnBoard.level : 1;
    const playerLevel = typeof level === 'number' ? level : 1;
    
    console.log(`Comparing: Player level ${playerLevel} score ${score} vs Board lowest level ${lowestLevel} score ${lowestOnBoard.score}`);
    
    // If player's level is higher, it's automatically a high score
    if (playerLevel > lowestLevel) {
      console.log(`Player level ${playerLevel} > lowest level ${lowestLevel}: IS a high score`);
      return true;
    }
    
    // If player's level is lower, it's not a high score
    if (playerLevel < lowestLevel) {
      console.log(`Player level ${playerLevel} < lowest level ${lowestLevel}: is NOT a high score`);
      return false;
    }
    
    // Same level - compare raw scores
    const isHigh = score > lowestOnBoard.score;
    console.log(`Same level ${playerLevel}: Score ${score} vs ${lowestOnBoard.score}: ${isHigh ? "IS" : "is NOT"} a high score`);
    return isHigh;
  } catch (e) {
    console.error("Error checking if high score:", e);
    // In case of error, assume it is a high score to give the player the benefit of the doubt
    return true;
  }
}

export { 
  saveInteraction, 
  getUserEnvironmentInfo, 
  waitForAuth, 
  saveHighScore, 
  getTopScores, 
  isHighScore,
  cleanupOldScores 
};
