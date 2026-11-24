document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
  if (typeof requireAuth === "function" && !requireAuth()) return;

  const params = new URLSearchParams(window.location.search);
  const requestedReference = params.get("ref") || "BC-2025-0042";
  const elements = {
    form: document.getElementById("referralForm"),
    loadMessage: document.getElementById("referralLoadMessage"),
    alert: document.getElementById("referralFormAlert"),
    office: document.getElementById("targetOffice"),
    otherOfficeField: document.getElementById("otherOfficeField"),
    otherOffice: document.getElementById("otherOfficeName"),
    officeAddress: document.getElementById("officeAddress"),
    instructions: document.getElementById("residentInstructions"),
    overlay: document.getElementById("referralSuccessOverlay"),
    confirm: document.getElementById("confirmReferral"),
    draft: document.getElementById("saveReferralDraft"),
  };
  const draftKey = `referralDraft:${requestedReference}`;
  let complaint = null;
  let user = currentUser;
  elements.confirm.disabled = true;
  elements.draft.disabled = true;

  function localDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function setText(id, value, fallback = "—") {
    const node = document.getElementById(id);
    if (node) node.textContent = value || fallback;
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }
  function displayDate(value) {
    if (!value) return "—";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = match ? new Date(+match[1], +match[2] - 1, +match[3], 12) : new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  }
  function officeLabel() {
    if (elements.office.value === "Other Responsible Office") return elements.otherOffice.value.trim();
    return elements.office.value;
  }
  const agencyGuidance = {
    "Philippine National Police (PNP) – Valencia City Police Station": {
      address: "Valencia City Police Station, Valencia City",
      instructions: "Please visit the Valencia City Police Station and present this referral slip to the receiving desk. Bring a valid ID and any relevant information requested by the officer.",
    },
    "Lupon Tagapamayapa (Formal Conciliation)": {
      address: "Barangay Poblacion Hall – Lupon Tagapamayapa Desk",
      instructions: "Please follow up with the Lupon Tagapamayapa desk at Barangay Poblacion Hall. Bring this referral slip and attend any scheduled conciliation meeting.",
    },
    "City Social Welfare and Development Office (CSWDO) / VAWC Desk": {
      address: "Valencia City Hall – CSWDO / VAWC Desk",
      instructions: "Please visit the CSWDO / VAWC Desk and present this referral slip. Ask the receiving staff about the next steps and any documents to bring.",
    },
    "City Environment & Natural Resources Office (CENRO)": {
      address: "City Environment & Natural Resources Office, Valencia City",
      instructions: "Please contact or visit the CENRO receiving office and present this referral slip. The office will advise you about the inspection or follow-up process.",
    },
    "City Engineering / Office of the Building Official": {
      address: "City Engineering Office, Valencia City",
      instructions: "Please visit the City Engineering / Office of the Building Official and present this referral slip to request the appropriate technical review.",
    },
    "Bureau of Fire Protection (BFP) / CDRRMO": {
      address: "Valencia City Fire Station / CDRRMO",
      instructions: "Please visit the BFP / CDRRMO receiving desk and present this referral slip. Follow the staff's instructions for safety assessment and follow-up.",
    },
  };

  function fillHeaderProfile() {
    if (!user) return;
    const name = user.full_name || user.name || "Personnel";
    const role = (user.role || "Personnel").replace(/^Barangay\s+/i, "");
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    setText("referralUserName", name);
    setText("referralUserRole", role);
    setText("referralPopoverName", name);
    setText("referralPopoverRole", user.role || role);
    setText("referralAvatar", initials, "P");
    setText("referralPopoverAvatar", initials, "P");
  }

  function applyAgencyDefaults(force = true) {
    const selected = elements.office.value;
    const guidance = agencyGuidance[selected];
    const isOther = selected === "Other Responsible Office";
    elements.otherOfficeField.hidden = !isOther;
    elements.otherOffice.required = isOther;
    if (!selected) return;
    if (guidance) {
      if (force || !elements.officeAddress.value) elements.officeAddress.value = guidance.address;
      if (force || !elements.instructions.value) elements.instructions.value = guidance.instructions;
    } else if (!isOther) {
      elements.officeAddress.value = "";
      elements.instructions.value = "";
    }
    validateField(elements.otherOffice);
  }

  function fieldFor(input) {
    return input.closest(".referral-field");
  }
  function validateField(input) {
    if (!input) return true;
    const field = fieldFor(input);
    const valid = input.type === "checkbox" || input.type === "radio"
      ? (!input.required || input.checked)
      : (!input.required || Boolean(input.value.trim()));
    if (field) field.classList.toggle("is-invalid", !valid);
    input.setAttribute("aria-invalid", String(!valid));
    return valid;
  }
  function validateForm() {
    const required = [...elements.form.querySelectorAll("input[required],select[required],textarea[required]")];
    let valid = required.map(validateField).every(Boolean);
    if (elements.office.value === "Other Responsible Office") {
      valid = validateField(elements.otherOffice) && valid;
    }
    elements.alert.classList.toggle("show", !valid);
    elements.alert.textContent = valid ? "" : "Complete all required referral and resident guidance fields before confirming.";
    if (!valid) required.find(input => !validateField(input))?.focus();
    return valid;
  }
  function persistDraft() {
    const data = {};
    elements.form.querySelectorAll("input,select,textarea").forEach(input => {
      if (input.type === "checkbox") data[input.id || `packet:${input.value}`] = input.checked;
      else if (input.type === "radio") {
        if (input.checked) data[input.name] = input.value;
      } else if (input.id) data[input.id] = input.value;
    });
    localStorage.setItem(draftKey, JSON.stringify(data));
  }
  function restoreDraft() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch { saved = null; }
    if (!saved) return;
    Object.entries(saved).forEach(([key, value]) => {
      const input = key.startsWith("packet:")
        ? [...elements.form.querySelectorAll(".referral-check input")].find(item => item.value === key.slice(7))
        : document.getElementById(key);
      if (input && input.type !== "radio" && input.type !== "checkbox") input.value = value;
      if (input?.type === "checkbox") input.checked = Boolean(value);
      if (key === "referralChannel") {
        const radio = [...elements.form.querySelectorAll('input[name="referralChannel"]')].find(item => item.value === value);
        if (radio) radio.checked = true;
      }
    });
    applyAgencyDefaults(false);
  }
  function serializeReferral() {
    const target = officeLabel();
    const included = [...elements.form.querySelectorAll(".referral-check input:checked")].map(item => item.value);
    const channel = elements.form.querySelector('input[name="referralChannel"]:checked')?.value || "In-Person (Printed Referral Slip)";
    return [
      "Referral for Further Action",
      `Target office: ${target}`,
      elements.receivingOfficer.value && `Specific unit / receiving officer: ${elements.receivingOfficer.value.trim()}`,
      `Endorsement reference: ${elements.endorsementReference.value}`,
      `Referral basis: ${elements.referralBasis.value}`,
      `Referral date: ${elements.referralDate.value}`,
      `Official remarks: ${elements.referralRemarks.value.trim()}`,
      `Documents included: ${included.join(", ") || "None selected"}`,
      `Receiving office address: ${elements.officeAddress.value.trim()}`,
      `Resident instructions: ${elements.instructions.value.trim()}`,
      `Resident informed by: ${channel}`,
      `Resident notified: ${document.getElementById("residentNotified").checked ? "Yes" : "No"}`,
    ].filter(Boolean).join("\n");
  }

  const requiredElements = {
    receivingOfficer: document.getElementById("receivingOfficer"),
    endorsementReference: document.getElementById("endorsementReference"),
    referralBasis: document.getElementById("referralBasis"),
    referralDate: document.getElementById("referralDate"),
    referralRemarks: document.getElementById("referralRemarks"),
  };
  Object.assign(elements, requiredElements);

  fillHeaderProfile();
  elements.office.addEventListener("change", applyAgencyDefaults);
  elements.form.addEventListener("input", event => {
    const field = fieldFor(event.target);
    if (field?.classList.contains("is-invalid")) validateField(event.target);
  });
  elements.form.addEventListener("change", event => {
    const field = fieldFor(event.target);
    if (field?.classList.contains("is-invalid")) validateField(event.target);
  });

  try {
    const response = await fetch(`${API_BASE_URL}/complaints`);
    if (!response.ok) throw new Error("Could not load complaints from the server.");
    const records = await response.json();
    complaint = records.find(record => record.reference_number === requestedReference);
    if (!complaint) throw new Error(`Complaint ${requestedReference} was not found.`);

    setText("referralCrumbReference", complaint.reference_number);
    setText("refComplaintNumber", complaint.reference_number);
    setText("refResidentName", complaint.resident_name);
    setText("refContactNumber", complaint.contact_number);
    setText("refCategory", complaint.category);
    setText("refIncidentLocation", complaint.incident_location);
    setText("refVerificationStatus", "Verified");
    setText("refDescription", complaint.description);
    setText("refIncidentAt", [displayDate(complaint.incident_date), complaint.incident_time].filter(value => value !== "—").join(" · "));
    setText("refPersonsInvolved", complaint.persons_involved);
    const documents = complaint.supporting_documents || complaint.documents || complaint.attachments || [];
    const documentItems = Array.isArray(documents) ? documents : documents ? [documents] : [];
    const docsNode = document.getElementById("refDocuments");
    docsNode.innerHTML = documentItems.length
      ? `<ul class="referral-docs">${documentItems.map(item => `<li>${escapeHTML(typeof item === "string" ? item : item.name || item.filename || "Supporting document")}</li>`).join("")}</ul>`
      : "No supporting documents attached.";

    const suffix = String(complaint.reference_number || "").match(/(\d{4})$/)?.[1] || "0001";
    const referralYear = new Date().getFullYear();
    elements.endorsementReference.value = `END-${referralYear}-${suffix}`;
    elements.referralDate.value = localDateValue();
    elements.referralRemarks.value = complaint.description
      ? `Based on the barangay's verification, ${complaint.description.trim()} The matter is respectfully referred to the receiving office for appropriate assessment and further action.`
      : "The complaint was verified by authorized barangay personnel and is respectfully referred to the receiving office for appropriate assessment and further action.";
    document.getElementById("backToRouting").href = `route-complaint.html?ref=${encodeURIComponent(complaint.reference_number)}`;
    document.getElementById("returnToComplaints").href = `complaints.html?ref=${encodeURIComponent(complaint.reference_number)}`;
    restoreDraft();
    elements.loadMessage.hidden = true;
    elements.form.hidden = false;
    elements.confirm.disabled = false;
    elements.draft.disabled = false;
  } catch (error) {
    elements.loadMessage.textContent = error.message || "Unable to load the selected complaint.";
    elements.loadMessage.setAttribute("role", "alert");
    elements.confirm.disabled = true;
    elements.draft.disabled = true;
  }

  elements.draft.addEventListener("click", () => {
    persistDraft();
    elements.alert.textContent = "Referral draft saved on this device.";
    elements.alert.classList.add("show");
    elements.alert.style.background = "#eef7f1";
    elements.alert.style.color = "#245b40";
    window.setTimeout(() => {
      elements.alert.classList.remove("show");
      elements.alert.removeAttribute("style");
    }, 3000);
  });

  elements.form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!complaint || !validateForm()) return;
    const formattedRemarks = serializeReferral();
    elements.confirm.disabled = true;
    elements.confirm.innerHTML = "Logging Referral…";
    try {
      const response = await fetch(`${API_BASE_URL}/complaints/${complaint.complaint_id}/route`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: complaint.assigned_to || null,
          status: "Referred",
          decision: "Refer for Further Action",
          routing_notes: formattedRemarks,
          updated_by: user?.personnel_id || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not log the complaint referral.");
      localStorage.removeItem(draftKey);
      setText("successComplaintReference", complaint.reference_number);
      setText("successTargetOffice", officeLabel());
      setText("printSlipResident", complaint.resident_name);
      setText("printSlipContact", complaint.contact_number);
      setText("printSlipOffice", officeLabel());
      setText("printSlipAddress", elements.officeAddress.value.trim());
      setText("printSlipReference", elements.endorsementReference.value);
      setText("printSlipInstructions", elements.instructions.value.trim());
      elements.overlay.hidden = false;
      document.querySelector(".referral-dialog")?.focus();
    } catch (error) {
      elements.alert.textContent = error.message || "Could not save the referral. Please try again.";
      elements.alert.style.background = "#fff1f0";
      elements.alert.style.color = "#a52e2e";
      elements.alert.classList.add("show");
    } finally {
      elements.confirm.disabled = false;
      elements.confirm.innerHTML = 'Confirm &amp; Log Referral <span aria-hidden="true">✓</span>';
    }
  });

  document.getElementById("printReferralSlip").addEventListener("click", () => {
    elements.overlay.classList.add("printing");
    window.print();
    window.setTimeout(() => elements.overlay.classList.remove("printing"), 500);
  });
  elements.overlay.addEventListener("click", event => {
    if (event.target === elements.overlay) elements.overlay.hidden = true;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.overlay.hidden) elements.overlay.hidden = true;
  });
});
