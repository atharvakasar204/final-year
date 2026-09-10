import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { db } from "./firebase.js";

const validRoles = new Set(["admin", "hod", "faculty"]);

export function normaliseRole(role) {
  return validRoles.has(role) ? role : "admin";
}

export function dashboardForRole(role) {
  const dashboards = {
    admin: "dashboard.html",
    hod: "hod-dashboard.html",
    faculty: "faculty-dashboard.html"
  };
  return dashboards[normaliseRole(role)];
}

export async function getUserProfile(uid) {
  const profileSnapshot = await getDoc(doc(db, "users", uid));
  if (!profileSnapshot.exists()) return null;

  const profile = profileSnapshot.data();
  return { ...profile, role: normaliseRole(profile.role) };
}

export async function redirectToRoleDashboard(user) {
  try {
    const profile = await getUserProfile(user.uid);
    window.location.assign(dashboardForRole(profile?.role));
  } catch (error) {
    // Existing accounts created before profile documents are added can still
    // access the temporary admin dashboard during development.
    console.warn("Unable to load the role profile; opening the dashboard.", error);
    window.location.assign("dashboard.html");
  }
}
