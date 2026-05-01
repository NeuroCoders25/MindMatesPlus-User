import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB6xYQWNc6R246bMMnohCbaVe6VmaFCQy0",
  authDomain: "mindmatesplus.firebaseapp.com",
  projectId: "mindmatesplus",
  storageBucket: "mindmatesplus.firebasestorage.app",
  messagingSenderId: "1068423012547",
  appId: "1:1068423012547:web:ffb37fc78ea1ee15a3c276",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);







// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyB6xYQWNc6R246bMMnohCbaVe6VmaFCQy0",
//   authDomain: "mindmatesplus.firebaseapp.com",
//   projectId: "mindmatesplus",
//   storageBucket: "mindmatesplus.firebasestorage.app",
//   messagingSenderId: "1068423012547",
//   appId: "1:1068423012547:web:ffb37fc78ea1ee15a3c276",
//   measurementId: "G-8PJ6XSG870"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);