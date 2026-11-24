(() => {
  const page = document.body.dataset.page;
  const links = [...document.querySelectorAll(".nav-link")];
  links.forEach((link) =>
    link.classList.toggle(
      "active",
      (page === "dashboard" && link.dataset.section === "Dashboard") ||
        (page === "activity-log" && link.dataset.section === "Activity Log") ||
        ((page === "hearing-calendar" || page === "hearing-details") &&
          link.dataset.section === "Hearing Calendar") ||
        (page !== "dashboard" &&
          page !== "activity-log" &&
          page !== "hearing-calendar" &&
          page !== "hearing-details" &&
          link.dataset.section === "Complaints"),
    ),
  );
  const sidebar = document.querySelector("#sidebar");
  const mobileMenu = document.querySelector("#mobileMenu");
  if (page !== "dashboard" && mobileMenu)
    mobileMenu.addEventListener("click", () =>
      sidebar.classList.toggle("open"),
    );

  function closePopovers() {
    document
      .querySelectorAll(".popover")
      .forEach((panel) => (panel.hidden = true));
    document
      .querySelectorAll("[aria-expanded]")
      .forEach((button) => button.setAttribute("aria-expanded", "false"));
  }
  const logoutDialog = document.createElement("dialog");
  logoutDialog.className = "logout-confirm-dialog";
  logoutDialog.id = "logoutConfirmDialog";
  logoutDialog.setAttribute("aria-labelledby", "logoutConfirmTitle");
  logoutDialog.innerHTML = `
    <div class="logout-confirm-icon"><img src="assets/images/logout-modal-icon.svg" alt="" /></div>
    <h2 id="logoutConfirmTitle">Are you sure you want to log out?</h2>
    <p>You are about to end your current personnel session. Do you want to continue?</p>
    <div class="logout-confirm-actions">
      <button type="button" class="logout-cancel" data-action="cancel-logout">Cancel</button>
      <button type="button" class="logout-accept" data-action="finish-logout"><img src="assets/images/logout-button-icon.svg" alt="" /><span>Yes, Log Out</span></button>
    </div>`;
  document.body.append(logoutDialog);
  logoutDialog.addEventListener("close", () => {
    document.body.style.overflow = "";
  });
  logoutDialog.addEventListener("click", (event) => {
    if (event.target === logoutDialog) logoutDialog.close();
  });

  document.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "logout") {
      event.preventDefault();
      closePopovers();
      if (!logoutDialog.open) {
        logoutDialog.showModal();
        document.body.style.overflow = "hidden";
        logoutDialog.querySelector("[data-action='cancel-logout']").focus();
      }
    } else if (action.dataset.action === "cancel-logout") {
      logoutDialog.close();
    } else if (action.dataset.action === "finish-logout") {
      action.disabled = true;
      action.querySelector("span").textContent = "Logging Out…";
      try {
        await fetch("/api/personnel/auth/logout", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* Continue to the sign-in page if the optional auth service is offline. */
      }
      location.assign("index.html");
    }
  });
  if (page === "dashboard") return;
  function bindPopover(buttonId, panelId) {
    const button = document.getElementById(buttonId),
      panel = document.getElementById(panelId);
    if (!button || !panel) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = panel.hidden;
      closePopovers();
      panel.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
    });
  }
  bindPopover("notificationButton", "notificationPanel");

  bindPopover("profileButton", "profilePanel");
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".popover-wrap")) closePopovers();
  });
  const modal = document.querySelector("#modal");
  modal?.querySelector(".modal-close")?.addEventListener("click", () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  });
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.hidden = true;
      document.body.style.overflow = "";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopovers();
      sidebar?.classList.remove("open");
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest(".nav-link");
    if (!link || page === "dashboard") return;
    if (
      link.dataset.section === "Dashboard" ||
      link.dataset.section === "Complaints" ||
      link.dataset.section === "Activity Log" ||
      link.dataset.section === "Hearing Calendar"
    )
      return;
    event.preventDefault();
    links.forEach((item) => item.classList.toggle("active", item === link));
    if (page !== "dashboard")
      location.href = "dashboard.html" + link.getAttribute("href");
    else if (window.toast)
      window.toast(link.dataset.section + " section selected");
  });
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "close-modal") {
      const modal = document.querySelector("#modal");
      if (modal) {
        modal.hidden = true;
        document.body.style.overflow = "";
      }
    }
    if (action.dataset.action === "mark-read") {
      const dot = document.querySelector(".notification-trigger i");
      if (dot) dot.style.display = "none";
      action.textContent = "All caught up";
    }
    if (
      action.dataset.action === "profile" ||
      action.dataset.action === "settings"
    ) {
      closePopovers();
      if (window.toast) window.toast(action.textContent + " opened");
    }
    if (action.dataset.action === "all-notifications" && window.toast)
      window.toast("You are viewing all notifications");
  });
})();
