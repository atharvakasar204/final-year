import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const firebaseConfig = {

    apiKey:
        "AIzaSyB8yvJuIZwKb0DOj0ne5KDFHAmkrASMmm8",

    authDomain:
        "department-timetable-system.firebaseapp.com",

    projectId:
        "department-timetable-system",

    storageBucket:
        "department-timetable-system.firebasestorage.app",

    messagingSenderId:
        "706022261814",

    appId:
        "1:706022261814:web:43215fe8bc87caa69b4497",

    measurementId:
        "G-6LY21GL1QF"
};


export const isFirebaseConfigured =
    Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        firebaseConfig.appId
    );


const app =
    initializeApp(firebaseConfig);


export const auth =
    getAuth(app);


export const db =
    getFirestore(app);