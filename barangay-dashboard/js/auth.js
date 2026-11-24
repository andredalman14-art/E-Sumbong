document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("personnelLoginForm");
  const roleButtons = document.querySelectorAll(".role-option");
  const requestedRoleInput = document.getElementById("requestedRole");

  const identifierInput = document.getElementById("loginIdentifier");
  const passwordInput = document.getElementById("loginPassword");
  const passwordToggle = document.getElementById("passwordToggle");

  const identifierError = document.getElementById("identifierError");
  const passwordError = document.getElementById("passwordError");
  const loginFeedback = document.getElementById("loginFeedback");

  // Verification Modal Elements
  const verifyModal = document.getElementById("identityVerifyModal");
  const verifyForm = document.getElementById("identityVerifyForm");
  const verifyIdentityText = document.getElementById("verifyIdentity");
  const verifyPasswordInput = document.getElementById("verifyPassword");
  const verifyPasswordError = document.getElementById("verifyPasswordError");
  const officialUseCheckbox = document.getElementById("officialUse");
  const verifyConsentError = document.getElementById("verifyConsentError");
  const verifyFeedback = document.getElementById("verifyFeedback");
  const verifyClose = document.getElementById("verifyClose");
  const verifyCancel = document.getElementById("verifyCancel");

  let pendingUser = null;
  let pendingPassword = "";

  // 1. Role Selector Buttons
  roleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      roleButtons.forEach((b) => {
        b.classList.remove("is-selected");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
      requestedRoleInput.value = btn.dataset.role;
    });
  });

  // 2. Show / Hide Password Toggle
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      passwordToggle.setAttribute("aria-pressed", String(isHidden));
      passwordToggle.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password",
      );
    });
  }

  // 3. Step 1: Primary Login Form -> Check PostgreSQL via Express API
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Reset errors
      identifierError.hidden = true;
      passwordError.hidden = true;
      loginFeedback.hidden = true;
      loginFeedback.textContent = "";

      const email = identifierInput.value.trim();
      const password = passwordInput.value;
      const role = requestedRoleInput.value;

      let hasError = false;
      if (!email) {
        identifierError.hidden = false;
        hasError = true;
      }
      if (password.length < 8) {
        passwordError.hidden = false;
        hasError = true;
      }
      if (hasError) return;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role }),
        });

        const data = await response.json();

        if (!response.ok) {
          loginFeedback.textContent =
            data.error || "Invalid email, password, or selected role.";
          loginFeedback.hidden = false;
          return;
        }

        // Credentials valid -> Open Staff Identity Verification Modal
        pendingUser = data.user;
        pendingPassword = password;

        verifyIdentityText.textContent = `${pendingUser.full_name} • ${pendingUser.role} (${pendingUser.email})`;
        verifyPasswordInput.value = "";
        officialUseCheckbox.checked = false;
        verifyPasswordError.hidden = true;
        verifyConsentError.hidden = true;
        verifyFeedback.hidden = true;
        verifyModal.hidden = false;
        verifyPasswordInput.focus();
      } catch (err) {
        loginFeedback.textContent =
          'Cannot connect to backend server. Make sure "node server.js" is running.';
        loginFeedback.hidden = false;
      }
    });
  }

  // 4. Step 2: Staff Identity Verification Modal -> Save Session & Redirect
  if (verifyForm) {
    verifyForm.addEventListener("submit", (e) => {
      e.preventDefault();

      verifyPasswordError.hidden = true;
      verifyConsentError.hidden = true;
      verifyFeedback.hidden = true;

      const reentered = verifyPasswordInput.value;
      let hasModalError = false;

      if (!reentered || reentered !== pendingPassword) {
        verifyPasswordError.hidden = false;
        hasModalError = true;
      }

      if (!officialUseCheckbox.checked) {
        verifyConsentError.hidden = false;
        hasModalError = true;
      }

      if (hasModalError || !pendingUser) return;

      saveCurrentUser(pendingUser);
      window.location.href = "dashboard.html";
    });
  }

  // Close Modal Handlers
  const closeVerifyModal = () => {
    verifyModal.hidden = true;
    pendingUser = null;
    pendingPassword = "";
  };

  if (verifyClose) verifyClose.addEventListener("click", closeVerifyModal);
  if (verifyCancel) verifyCancel.addEventListener("click", closeVerifyModal);
});
