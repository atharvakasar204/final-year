const messages = {
  "auth/email-already-in-use": "An account already exists with this email address.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/weak-password": "Use a password of at least six characters.",
  "auth/invalid-credential": "The email address or password is incorrect.",
  "auth/user-not-found": "No account exists with that email address.",
  "auth/wrong-password": "The email address or password is incorrect.",
  "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase Authentication.",
  "auth/invalid-api-key": "The Firebase API key is invalid. Recheck js/firebase.js.",
  "auth/app-not-authorized": "This app or domain is not authorized in the Firebase project settings.",
  "auth/unauthorized-domain": "This domain is not authorized for Firebase Authentication. Add it in Firebase Authentication settings.",
  "auth/network-request-failed": "Unable to reach Firebase. Check your internet connection and browser network settings.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "permission-denied": "The account could not be saved. Check Firestore rules for the users collection.",
  "unavailable": "Firestore is unavailable. Confirm that a Firestore database has been created."
};

export function readableFirebaseError(error, fallback) {
  const code = error?.code;
  const message = messages[code] || fallback;
  return code ? `${message} [${code}]` : message;
}

export function isFileProtocol() {
  return window.location.protocol === "file:";
}
