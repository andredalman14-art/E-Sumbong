(() => {
  const page = document.body.dataset.authPage;
  const AUTH_API = window.PERSONNEL_AUTH_CONFIG || {};
  const endpoints = {
    login: AUTH_API.loginEndpoint || "/api/personnel/auth/login",
    logout: AUTH_API.logoutEndpoint || "/api/personnel/auth/logout",
    recovery: AUTH_API.recoveryEndpoint || "/api/personnel/auth/password-reset-requests",
    accountRequest: AUTH_API.accountRequestEndpoint || "/api/personnel/auth/account-requests",
  };
  const feedback = (element, message, type = "error") => {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("success", type === "success");
    element.hidden = !message;
  };
  const passwordToggleIcons = {
    show: '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
    hide: '<svg class="eye-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.1 0 9.5 7 9.5 7a16 16 0 0 1-2.7 3.4M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 7 9.5 7a10 10 0 0 0 4-.8"/></svg>',
  };
  const togglePasswordVisibility = (button, field) => {
    const show = field.type === "password";
    field.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    button.innerHTML = show ? passwordToggleIcons.hide : passwordToggleIcons.show;
  };
  const request = async (url, payload) => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await response.json(); } catch { /* an empty response is valid for errors */ }
    return { response, data };
  };
  const serviceError = (error) => {
    if (error instanceof TypeError || error?.name === "AbortError")
      return "The personnel authentication service is unavailable. Sign-in needs a configured server service.";
    return "We could not complete your request. Please try again later.";
  };

  document.querySelectorAll(".role-options").forEach((group) => {
    const hidden = group.closest("fieldset")?.querySelector('input[name="requestedRole"]');
    group.querySelectorAll("[data-role]").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("[data-role]").forEach((option) => {
          const selected = option === button;
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-pressed", String(selected));
        });
        if (hidden) hidden.value = button.dataset.role;
      });
    });
  });

  if (page === "login") {
    const form = document.getElementById("personnelLoginForm");
    const identifier = document.getElementById("loginIdentifier");
    const password = document.getElementById("loginPassword");
    const rememberMe = document.getElementById("rememberMe");
    const feedbackBox = document.getElementById("loginFeedback");
    const submit = document.getElementById("loginSubmit");
    const submitLabel = submit.querySelector("span");
    const roleField = document.getElementById("requestedRole");

    document.getElementById("passwordToggle").addEventListener("click", (event) => {
      togglePasswordVisibility(event.currentTarget, password);
    });

    const modal = document.getElementById("identityVerifyModal");
    const verifyForm = document.getElementById("identityVerifyForm");
    const verifyPassword = document.getElementById("verifyPassword");
    const verifyFeedback = document.getElementById("verifyFeedback");
    const verifySubmit = document.getElementById("verifySubmit");
    const verifyLabel = verifySubmit.querySelector("span");
    const officialUse = document.getElementById("officialUse");
    const pageContent = document.querySelector(".auth-layout");
    const openModal = () => {
      document.getElementById("verifyIdentity").textContent = `${identifier.value.trim()} · ${roleField.value}`;
      modal.hidden = false;
      pageContent.inert = true;
      document.body.classList.add("verify-open");
      verifyPassword.value = "";
      officialUse.checked = false;
      feedback(verifyFeedback, "");
      document.getElementById("verifyPasswordError").hidden = true;
      document.getElementById("verifyConsentError").hidden = true;
      verifyPassword.focus();
    };
    const closeModal = () => { modal.hidden = true; pageContent.inert = false; document.body.classList.remove("verify-open"); submit.focus(); };
    ["verifyClose", "verifyCancel"].forEach(id => document.getElementById(id).addEventListener("click", closeModal));
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      feedback(feedbackBox, "");
      const identifierValue = identifier.value.trim();
      const passwordValue = password.value;
      const identifierInvalid = !identifierValue;
      const passwordInvalid = passwordValue.length < 8;
      document.getElementById("identifierError").hidden = !identifierInvalid;
      document.getElementById("passwordError").hidden = !passwordInvalid;
      identifier.setAttribute("aria-invalid", String(identifierInvalid));
      password.setAttribute("aria-invalid", String(passwordInvalid));
      if (identifierInvalid || passwordInvalid) {
        (identifierInvalid ? identifier : password).focus();
        return;
      }

      openModal();
    });
    verifyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      feedback(verifyFeedback, "");
      const passwordInvalid = !verifyPassword.value || verifyPassword.value !== password.value;
      const consentInvalid = !officialUse.checked;
      document.getElementById("verifyPasswordError").hidden = !passwordInvalid;
      document.getElementById("verifyConsentError").hidden = !consentInvalid;
      verifyPassword.setAttribute("aria-invalid", String(passwordInvalid));
      if (passwordInvalid || consentInvalid) { (passwordInvalid ? verifyPassword : officialUse).focus(); return; }
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submitLabel.textContent = "VERIFYING…";
      verifySubmit.disabled = true;
      verifySubmit.setAttribute("aria-busy", "true");
      verifyLabel.textContent = "Verifying…";
      try {
        const { response, data } = await request(endpoints.login, {
          identifier: identifier.value.trim(),
          password: password.value,
          rememberMe: rememberMe.checked,
          requestedRole: roleField.value,
        });
        if (response.status === 401) {
          feedback(verifyFeedback, "The email or username and password do not match an account.");
        } else if (response.status === 403) {
          feedback(verifyFeedback, "Your account does not have permission to access this portal.");
        } else if (!response.ok) {
          feedback(verifyFeedback, [404, 405, 501].includes(response.status)
            ? "The personnel authentication service is not configured. Sign-in is unavailable until the server endpoint is connected."
            : serviceError(new Error("Authentication request failed")));
        } else {
          const assignedRole = data?.user?.role;
          const allowedRoles = ["Desk Staff", "Barangay Secretary", "Barangay Captain"];
          if (!data?.user || !allowedRoles.includes(assignedRole)) {
            feedback(verifyFeedback, "The server did not return a valid personnel account. Sign-in was not completed.");
            try { await fetch(endpoints.logout, { method: "POST", credentials: "include", cache: "no-store" }); } catch { /* no client token is retained */ }
          } else if (assignedRole !== roleField.value) {
            feedback(verifyFeedback, `This account is assigned to ${assignedRole}. Choose that role to continue.`);
            try { await fetch(endpoints.logout, { method: "POST", credentials: "include", cache: "no-store" }); } catch { /* no client token is retained */ }
          } else {
            // Dashboard is the only existing personnel landing page. The server must enforce route permissions.
            location.assign("dashboard.html");
          }
        }
      } catch (error) {
        feedback(verifyFeedback, serviceError(error));
      } finally {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submitLabel.textContent = "LOGIN";
        verifySubmit.disabled = false;
        verifySubmit.removeAttribute("aria-busy");
        verifyLabel.textContent = "Verify & Continue";
      }
    });
    [identifier, password].forEach((input) => input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      const error = document.getElementById(input === identifier ? "identifierError" : "passwordError");
      if (error) error.hidden = true;
      feedback(feedbackBox, "");
    }));
  }

  if (page === "recovery") {
    const form = document.getElementById("recoveryForm");
    const email = document.getElementById("recoveryEmail");
    const submit = document.getElementById("recoverySubmit");
    const label = submit.querySelector(".auth-submit-text");
    const feedbackBox = document.getElementById("recoveryFeedback");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const valid = email.checkValidity() && Boolean(email.value.trim());
      document.getElementById("recoveryEmailError").hidden = valid;
      if (!valid) { email.setAttribute("aria-invalid", "true"); email.focus(); return; }
      submit.disabled = true;
      label.textContent = "SENDING…";
      feedback(feedbackBox, "");
      try {
        const { response } = await request(endpoints.recovery, { email: email.value.trim() });
        if (response.ok) feedback(feedbackBox, "If this email is associated with an active personnel account, recovery instructions will be sent.", "success");
        else feedback(feedbackBox, [404, 405, 501].includes(response.status) ? "Password recovery is not configured. Please contact the portal administrator." : "We could not submit your recovery request. Please try again later.");
      } catch (error) { feedback(feedbackBox, serviceError(error)); }
      finally { submit.disabled = false; label.textContent = "SEND RECOVERY INSTRUCTIONS"; }
    });
  }

  if (page === "account-request") {
    const form = document.getElementById("accountRequestForm");
    const firstName = document.getElementById("requestFirstName");
    const lastName = document.getElementById("requestLastName");
    const email = document.getElementById("requestEmail");
    const role = document.getElementById("requestRole");
    const contact = document.getElementById("requestContact");
    const accountPassword = document.getElementById("requestPassword");
    const confirmPassword = document.getElementById("requestPasswordConfirm");
    const submit = document.getElementById("requestSubmit");
    const label = submit.querySelector(".auth-submit-text");
    const feedbackBox = document.getElementById("requestFeedback");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const passwordValid = accountPassword.value.length >= 10 && /[A-Za-z]/.test(accountPassword.value) && /\d/.test(accountPassword.value) && /[^A-Za-z0-9]/.test(accountPassword.value);
      const fields = [["requestFirstNameError", Boolean(firstName.value.trim()), firstName], ["requestLastNameError", Boolean(lastName.value.trim()), lastName], ["requestEmailError", email.checkValidity() && Boolean(email.value.trim()), email], ["requestRoleError", Boolean(role.value), role], ["requestContactError", Boolean(contact.value.trim()), contact], ["requestPasswordError", passwordValid, accountPassword], ["requestPasswordConfirmError", passwordValid && confirmPassword.value === accountPassword.value, confirmPassword]];
      fields.forEach(([id, valid, input]) => { document.getElementById(id).hidden = valid; input.setAttribute("aria-invalid", String(!valid)); });
      const consentValid = document.getElementById("termsAccepted").checked && document.getElementById("privacyAccepted").checked;
      document.getElementById("consentError").hidden = consentValid;
      const invalid = fields.find(([, valid]) => !valid);
      if (invalid || !consentValid) { (invalid?.[2] || document.getElementById("termsAccepted")).focus(); return; }
      submit.disabled = true;
      label.textContent = "SUBMITTING…";
      feedback(feedbackBox, "");
      try {
        const { response } = await request(endpoints.accountRequest, {
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          fullName: `${firstName.value.trim()} ${lastName.value.trim()}`,
          email: email.value.trim(),
          requestedRole: role.value,
          contactNumber: contact.value.trim(),
          password: accountPassword.value,
          termsAccepted: true,
          privacyAccepted: true,
        });
        if (response.ok) { feedback(feedbackBox, "Your application was submitted for administrator review. Portal access is not active until an administrator approves it.", "success"); form.reset(); }
        else feedback(feedbackBox, [404, 405, 501].includes(response.status) ? "Account registration is not configured. Please contact the portal administrator." : "We could not submit your request. Please try again later.");
      } catch (error) { feedback(feedbackBox, serviceError(error)); }
      finally { submit.disabled = false; label.textContent = "Create Account"; }
    });
    [firstName, lastName, email, role, contact, accountPassword, confirmPassword].forEach(input => {
      const clearFieldState = () => { input.removeAttribute("aria-invalid"); feedback(feedbackBox, ""); };
      input.addEventListener("input", clearFieldState);
      input.addEventListener("change", clearFieldState);
    });
    document.querySelectorAll("[data-password-toggle]").forEach(button => button.addEventListener("click", () => {
      const field = document.getElementById(button.dataset.passwordToggle);
      togglePasswordVisibility(button, field);
    }));
    document.querySelectorAll("[data-policy]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); const terms = link.dataset.policy === "terms"; document.getElementById("policyTitle").textContent = terms ? "Terms and Conditions" : "Privacy Policy"; document.getElementById("policyText").textContent = terms ? "Personnel account applications are reviewed by an authorized administrator. Choosing a role requests consideration only; it does not grant access. Use the portal only for official barangay duties and protect confidential resident information." : "Personnel information is collected to review and administer account access. Complaint information is confidential and must only be accessed for authorized barangay work. The application server must apply its approved retention and security policies."; document.getElementById("policyDialog").showModal(); }));
  }
})();
