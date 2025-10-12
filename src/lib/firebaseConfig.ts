// Firebase Configuration
// NOTE: These are PUBLIC keys and safe to commit
// Get these from Firebase Console > Project Settings > General

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Instructions to get Firebase config:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing
// 3. Add an Android app (package name: app.lovable.c9213afe1e6545938c572cfda087384c)
// 4. Download google-services.json and place in android/app/
// 5. Copy the config values above from Project Settings > General
// 6. Enable Cloud Messaging in Project Settings > Cloud Messaging
// 7. Copy the Server Key and add it as FIREBASE_SERVER_KEY secret
