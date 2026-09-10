import { requireAuthenticatedUser, enableSignOut } from "./auth-guard.js";
import { renderNavigation } from "./layout.js";

async function initialiseProtectedPage() {
  renderNavigation();
  const user = await requireAuthenticatedUser();
  const userName = user.displayName || user.email?.split("@")[0] || "Administrator";

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = userName;
  });
  document.querySelectorAll("[data-user-email]").forEach((element) => {
    element.textContent = user.email || "Department administrator";
  });
  document.querySelector("#protectedContent")?.removeAttribute("hidden");
  enableSignOut();
}

initialiseProtectedPage().catch((error) => {
  // Redirect is already initiated for configuration and signed-out states.
  if (error.message !== "Firebase has not been configured.") console.error(error);
});
