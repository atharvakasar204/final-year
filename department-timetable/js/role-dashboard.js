import { requireAuthenticatedUser, enableSignOut } from "./auth-guard.js";
import { dashboardForRole, getUserProfile } from "./role-routing.js";

async function initialiseRoleDashboard() {
  const user = await requireAuthenticatedUser();
  const expectedRole = document.body.dataset.role;
  const profile = await getUserProfile(user.uid);
  const role = profile?.role || "admin";

  if (role !== expectedRole) {
    window.location.replace(dashboardForRole(role));
    return;
  }

  const userName = profile?.name || user.displayName || user.email?.split("@")[0] || "User";
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = userName;
  });
  document.querySelectorAll("[data-user-email]").forEach((element) => {
    element.textContent = user.email || "";
  });
  document.querySelector("#protectedContent")?.removeAttribute("hidden");
  enableSignOut();
}

initialiseRoleDashboard().catch((error) => {
  console.error("Unable to load the role dashboard:", error);
  const errorBox = document.querySelector("#roleDashboardError");
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = "Unable to load your profile. Check that Firestore is set up and try again.";
  }
});
