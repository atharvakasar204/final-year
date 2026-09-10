import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const registerForm =
    document.getElementById("registerForm");

const message =
    document.getElementById("message");


registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;


    message.textContent = "Creating account...";
    message.style.color = "black";


    if (!name || !email || !password || !role) {

        message.textContent =
            "Please fill all fields.";

        message.style.color = "red";

        return;
    }


    try {

        // --------------------------------
        // 1. Create Firebase Auth account
        // --------------------------------

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user =
            userCredential.user;


        console.log(
            "Firebase Auth user created:",
            user.uid
        );


        // --------------------------------
        // 2. Create Firestore user document
        // --------------------------------

        await setDoc(
            doc(db, "users", user.uid),
            {
                name: name,
                email: email,
                role: role,
                createdAt: serverTimestamp()
            }
        );


        console.log(
            "Firestore user document created"
        );


        // --------------------------------
        // 3. Logout after registration
        // --------------------------------

        await signOut(auth);


        message.textContent =
            "Registration successful! Redirecting to login...";

        message.style.color = "green";


        setTimeout(() => {

            window.location.href = "index.html";

        }, 1500);


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        let errorMessage =
            "Registration failed.";


        if (error.code === "auth/email-already-in-use") {

            errorMessage =
                "This email is already registered.";

        } else if (error.code === "auth/invalid-email") {

            errorMessage =
                "Invalid email address.";

        } else if (error.code === "auth/weak-password") {

            errorMessage =
                "Password must be at least 6 characters.";

        } else if (
            error.code === "permission-denied"
        ) {

            errorMessage =
                "Firebase Firestore permission denied.";

        } else {

            errorMessage =
                error.message;

        }


        message.textContent =
            errorMessage +
            " (" +
            error.code +
            ")";

        message.style.color = "red";

    }

});