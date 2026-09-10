import { requireAuthenticatedUser, enableSignOut } from "./auth-guard.js";
import { renderNavigation } from "./layout.js";
import { dashboardForRole, getUserProfile } from "./role-routing.js";

function formatDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date());
}

async function initialiseDashboard() {
  renderNavigation();
  const user = await requireAuthenticatedUser();
  const profile = await getUserProfile(user.uid);
  const role = profile?.role || "admin";
  if (role !== "admin") {
    window.location.replace(dashboardForRole(role));
    return;
  }
  const userName = profile?.name || user.displayName || user.email?.split("@")[0] || "Administrator";

  document.querySelector("[data-user-name]").textContent = userName;
  document.querySelector("[data-user-email]").textContent = user.email || "Department administrator";
  document.querySelector("#todayDate").textContent = formatDate();
  document.querySelector("#protectedContent").removeAttribute("hidden");
  enableSignOut();
}

initialiseDashboard().catch((error) => {
  if (error.message !== "Firebase has not been configured.") console.error(error);
});
