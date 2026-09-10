import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const message = document.getElementById("formMessage");
const loginButton = document.getElementById("loginButton");
const rememberCheckbox = document.getElementById("remember");
const forgotPassword = document.getElementById("forgotPassword");
const passwordToggle = document.getElementById("passwordToggle");


function showMessage(text, type = "error") {

    message.textContent = text;

    message.className =
        `form-message ${type}`;

}


function setLoading(loading) {

    loginButton.disabled = loading;

    loginButton.querySelector("span").textContent =
        loading ? "Signing in..." : "Sign in";

}


/* --------------------------------
   PASSWORD SHOW / HIDE
-------------------------------- */

if (passwordToggle) {

    passwordToggle.addEventListener("click", () => {

        const isPassword =
            passwordInput.type === "password";

        passwordInput.type =
            isPassword ? "text" : "password";

        passwordToggle.setAttribute(
            "aria-label",
            isPassword
                ? "Hide password"
                : "Show password"
        );

        passwordToggle.setAttribute(
            "aria-pressed",
            isPassword ? "true" : "false"
        );

    });

}


/* --------------------------------
   LOGIN
-------------------------------- */

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    if (!email || !password) {

        showMessage(
            "Please enter your email and password."
        );

        return;
    }


    setLoading(true);

    showMessage(
        "Signing in...",
        "info"
    );


    try {

        /* Remember login */

        await setPersistence(
            auth,
            rememberCheckbox.checked
                ? browserLocalPersistence
                : browserSessionPersistence
        );


        /* Firebase login */

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        console.log(
            "Firebase login successful:",
            user.uid
        );


        /* Get user profile */

        const userRef =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userRef);


        if (!userSnapshot.exists()) {

            await auth.signOut();

            throw new Error(
                "Account exists, but the user profile was not found."
            );

        }


        const userData =
            userSnapshot.data();


        console.log(
            "User profile:",
            userData
        );


        /* Save basic session information */

        sessionStorage.setItem(
            "userRole",
            userData.role || ""
        );

        sessionStorage.setItem(
            "userName",
            userData.name || ""
        );

        sessionStorage.setItem(
            "userEmail",
            user.email
        );


        showMessage(
            "Login successful. Opening dashboard...",
            "success"
        );


        /* Redirect */

        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 500);


    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );


        let text =
            "Unable to sign in.";


        switch (error.code) {

            case "auth/invalid-credential":
                text =
                    "Incorrect email or password.";
                break;

            case "auth/user-not-found":
                text =
                    "No account exists with this email.";
                break;

            case "auth/wrong-password":
                text =
                    "Incorrect password.";
                break;

            case "auth/invalid-email":
                text =
                    "Please enter a valid email address.";
                break;

            case "auth/too-many-requests":
                text =
                    "Too many attempts. Please try again later.";
                break;

            case "permission-denied":
                text =
                    "Firestore permission denied.";
                break;

            default:

                if (error.message) {
                    text = error.message;
                }

        }


        showMessage(
            `${text} (${error.code || "error"})`
        );


    } finally {

        setLoading(false);

    }

});


/* --------------------------------
   FORGOT PASSWORD
-------------------------------- */

if (forgotPassword) {

    forgotPassword.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();


            const email =
                emailInput.value.trim();


            if (!email) {

                showMessage(
                    "Enter your email address first."
                );

                emailInput.focus();

                return;
            }


            try {

                await sendPasswordResetEmail(
                    auth,
                    email
                );


                showMessage(
                    "Password reset email sent. Check your inbox.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "PASSWORD RESET ERROR:",
                    error
                );


                showMessage(
                    error.message
                );

            }

        }
    );

}


/* --------------------------------
   CURRENT YEAR
-------------------------------- */

const currentYear =
    document.getElementById("currentYear");

if (currentYear) {

    currentYear.textContent =
        new Date().getFullYear();

}