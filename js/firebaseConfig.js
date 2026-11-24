// Public by design: every Firebase website ships this config to its visitors.
// What protects her data is firestore.rules (each Google account can only reach its own document), not secrecy.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDy3tk4wfj3RN0wshFb6qxQ4rVkAka2f0o',
  authDomain: 'ca-inter-hq.firebaseapp.com',
  projectId: 'ca-inter-hq',
  storageBucket: 'ca-inter-hq.firebasestorage.app',
  messagingSenderId: '281725490106',
  appId: '1:281725490106:web:e3e8e93196c3e8a6970383',
};

// Loaded straight from Google's CDN as ES modules, so there is still no build step.
export const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/13.4.0';
