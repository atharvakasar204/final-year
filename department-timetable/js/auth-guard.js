import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth,
    isFirebaseConfigured
} from "./firebase.js";

const signInPage = "index.html";

export function requireAuthenticatedUser() {

    if (!isFirebaseConfigured) {

        window.location.replace(
            `${signInPage}?setup=required`
        );

        return Promise.reject(
            new Error("Firebase has not been configured.")
        );
    }

    return new Promise((resolve, reject) => {

        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {

                unsubscribe();

                if (!user) {

                    window.location.replace(
                        signInPage
                    );

                    reject(
                        new Error("User is not authenticated.")
                    );

                    return;
                }

                resolve(user);
            },

            (error) => {

                unsubscribe();

                console.error(
                    "Authentication state error:",
                    error
                );

                reject(error);
            }
        );

    });
}


export function enableSignOut() {

    const signOutButton =
        document.querySelector("[data-sign-out]");

    if (!signOutButton) return;


    signOutButton.addEventListener(
        "click",
        async () => {

            signOutButton.disabled = true;

            try {

                await signOut(auth);

                window.location.replace(
                    signInPage
                );

            } catch (error) {

                signOutButton.disabled = false;

                console.error(
                    "Sign-out error:",
                    error
                );

                window.alert(
                    "Unable to sign out. Please try again."
                );

            }

        }
    );
}