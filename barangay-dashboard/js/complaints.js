document.addEventListener("DOMContentLoaded", async () => {
  const currentUser = requireAuth();
  if (!currentUser) return;

  populateUserProfile(currentUser);
  bindLogoutButtons();

  // State
  let allComplaints = [];
  let personnelList = [];
  let activeTab = "All Complaints";
  let sortDescending = true;
  let selectedComplaint = null;

  // DOM Elements
  const tbody = document.getElementById("complaintRows");
  const emptyState = document.getElementById("complaintEmpty");
  const searchInput = document.getElementById("complaintSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  const sortButton = document.getElementById("sortComplaints");
  const tabs = document.querySelectorAll(".complaint-tab");

  // Selected Complaint Bottom Panel
  const selectedPanel = document.getElementById("selectedComplaintPanel");
  const selectedRefEl = document.getElementById("selectedReference");
  const selectedDescEl = document.getElementById("selectedDescription");
  const requestBtn = document.querySelector(
    '[data-complaint-action="request"]',
  );
  const updateBtn = document.querySelector('[data-complaint-action="update"]');
  const routeBtn = document.querySelector('[data-complaint-action="route"]');
  const walkinBtn = document.querySelector('[data-complaint-action="walkin"]');

  // Modal Elements
  const modalBackdrop = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");
  const modalClose = modalBackdrop?.querySelector(".modal-close");

  // Initial Load from PostgreSQL
  await loadData();

  async function loadData() {
    try {
      const [compRes, persRes] = await Promise.all([
        fetch(`${API_BASE_URL}/complaints`),
        fetch(`${API_BASE_URL}/personnel`).catch(() => null),
      ]);

      allComplaints = compRes.ok ? await compRes.json() : [];
      personnelList =
        persRes && persRes.ok
          ? await persRes.json()
          : [
              {
                personnel_id: 1,
                full_name: "Maria Santos",
                role: "Barangay Secretary",
              },
              {
                personnel_id: 2,
                full_name: "Hon. Roberto Dela Cruz",
                role: "Barangay Captain",
              },
              {
                personnel_id: 3,
                full_name: "Kagawad Leonardo Ramos",
                role: "Kagawad",
              },
            ];

      // Pre-select complaint if passed via ?ref=BC-2025-XXXX from dashboard
      const urlRef = new URLSearchParams(window.location.search).get("ref");
      if (urlRef) {
        const match = allComplaints.find((c) => c.reference_number === urlRef);
        if (match) selectedComplaint = match;
      }

      if (!selectedComplaint && allComplaints.length > 0) {
        selectedComplaint = allComplaints[0];
      }

      renderTable();
      updateSelectedPanel();
    } catch (err) {
      showToast("Failed to load complaints from server.");
      console.error(err);
    }
  }

  // Filter & Sort Pipeline
  function getFilteredComplaints() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const cat = (categoryFilter?.value || "").trim().toLowerCase();
    const stat = (statusFilter?.value || "").trim().toLowerCase();

    return allComplaints
      .filter((c) => {
        // 1. Tab filter
        const normStatus = normalizeStatus(c.status);
        if (activeTab === "New Submissions" && normStatus !== "New Submission")
          return false;
        if (
          activeTab === "For Verification" &&
          normStatus !== "For Verification"
        )
          return false;
        if (activeTab === "Active Complaints" && normStatus === "Resolved")
          return false;
        if (activeTab === "Resolved Complaints" && normStatus !== "Resolved")
          return false;

        // 2. Search query
        if (query) {
          const hay =
            `${c.reference_number} ${c.resident_name} ${c.incident_location} ${c.category}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }

        // 3. Category dropdown (partial match handles "Noise" vs "Noise / Public Disturbance")
        if (cat && !(c.category || "").toLowerCase().includes(cat))
          return false;

        // 4. Status dropdown
        if (stat && normStatus.toLowerCase() !== stat) return false;

        return true;
      })
      .sort((a, b) => {
        const idA = a.complaint_id || 0;
        const idB = b.complaint_id || 0;
        return sortDescending ? idB - idA : idA - idB;
      });
  }

  // Render Table Rows
  function renderTable() {
    if (!tbody) return;
    const rows = getFilteredComplaints();

    if (rows.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    tbody.innerHTML = rows
      .map((c) => {
        const isSelected =
          selectedComplaint &&
          selectedComplaint.complaint_id === c.complaint_id;
        const badge = getStatusBadge(c.status);
        const dateFiled = formatDate(c.created_at || c.incident_date);
        const assigned = c.assigned_personnel_name || "Unassigned";

        return `
          <tr tabindex="0" data-complaint-id="${c.complaint_id}" class="${isSelected ? "is-selected" : ""}" style="cursor:pointer;">
            <td class="reference">${escapeHtml(c.reference_number)}</td>
            <td>
              <strong class="cell-primary">${escapeHtml(c.resident_name)}</strong>
              <small class="cell-sub">${escapeHtml(c.incident_location || "Location not specified")}</small>
            </td>
            <td>${escapeHtml(c.category)}</td>
            <td>${dateFiled}</td>
            <td><span class="status ${badge.css}">${badge.label}</span></td>
            <td>${escapeHtml(assigned)}</td>
            <td>
              <div class="complaint-row-actions">
                <button type="button" class="complaint-row-action complaint-details-action" data-view-id="${c.complaint_id}" aria-label="View ${escapeHtml(c.reference_number)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                </button>
                <button type="button" class="complaint-row-action complaint-delete-action" data-delete-id="${c.complaint_id}" aria-label="Delete ${escapeHtml(c.reference_number)}">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M9 7V4.8C9 3.8 9.8 3 10.8 3h2.4C14.2 3 15 3.8 15 4.8V7"/>
                    <path d="M18.5 7l-1 12.2c-.1 1.1-1 1.8-2 1.8H8.5c-1 0-1.9-.7-2-1.8L5.5 7"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    // Row click -> Select complaint
    tbody.querySelectorAll("tr[data-complaint-id]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        const id = Number(tr.dataset.complaintId);
        selectedComplaint =
          allComplaints.find((c) => c.complaint_id === id) || null;
        renderTable();
        updateSelectedPanel();

        const viewButton = e.target.closest("[data-view-id]");
        if (viewButton) {
          e.stopPropagation();
          const id = Number(viewButton.dataset.viewId);
          const complaint = allComplaints.find((item) => item.complaint_id === id);
          if (complaint) {
            window.location.href = `complaint-details.html?reference=${encodeURIComponent(complaint.reference_number)}`;
          }
          return;
        }

        const deleteButton = e.target.closest("[data-delete-id]");
        if (deleteButton) {
          e.stopPropagation();
          const id = Number(deleteButton.dataset.deleteId);
          const complaint = allComplaints.find((item) => item.complaint_id === id);
          if (complaint) openDeleteModal(complaint);
        }
      });
    });
  }

  // Update Bottom Selected Complaint Action Bar
  function updateSelectedPanel() {
    if (!selectedPanel) return;

    if (!selectedComplaint) {
      selectedRefEl.textContent = "No complaint selected";
      selectedDescEl.textContent =
        "Click any row above to inspect or route a record.";
      return;
    }

    selectedRefEl.textContent = `${selectedComplaint.reference_number} — ${selectedComplaint.resident_name}`;
    selectedDescEl.textContent = selectedComplaint.description;

    const encodedRef = encodeURIComponent(selectedComplaint.reference_number);
    if (requestBtn)
      requestBtn.href = `request-information.html?ref=${encodedRef}`;
    if (updateBtn) updateBtn.href = `update-status.html?ref=${encodedRef}`;
    if (routeBtn) routeBtn.href = `route-complaint.html?ref=${encodedRef}`;
    if (walkinBtn) walkinBtn.href = "record-walkin.html";
  }

  // Tab & Filter Listeners
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      activeTab = tab.dataset.complaintTab;
      renderTable();
    });
  });

  if (searchInput) searchInput.addEventListener("input", renderTable);
  if (categoryFilter) categoryFilter.addEventListener("change", renderTable);
  if (statusFilter) statusFilter.addEventListener("change", renderTable);

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      sortDescending = !sortDescending;
      sortButton.textContent = sortDescending
        ? "Newest first ↓"
        : "Oldest first ↑";
      renderTable();
    });
  }

  // ---------------------------------------------------------
  // MODAL 1: RECORD WALK-IN COMPLAINT (POST /api/complaints)
  // ---------------------------------------------------------
  if (walkinBtn && walkinBtn.tagName === "BUTTON") {
    walkinBtn.addEventListener("click", () => {
      const nextNum = String(allComplaints.length + 48).padStart(4, "0");
      const suggestedRef = `BC-2026-${nextNum}`;
      const today = new Date().toISOString().split("T")[0];

      openModal(`
        <h2 id="modalTitle" style="margin-bottom:4px;">Record Walk-In Complaint</h2>
        <p style="color:#64748b;font-size:0.9rem;margin-bottom:16px;">Log a resident concern directly into the centralized database.</p>
        <form id="walkinForm" style="display:grid;gap:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Reference Number</label>
              <input type="text" name="reference_number" value="${suggestedRef}" required class="auth-input" style="width:100%;" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Category</label>
              <select name="category" required class="auth-input" style="width:100%;">
                <option value="Noise / Public Disturbance">Noise / Public Disturbance</option>
                <option value="Garbage / Sanitation">Garbage / Sanitation</option>
                <option value="Property Dispute">Property Dispute</option>
                <option value="Safety">Safety</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">First Name *</label>
              <input type="text" name="first_name" placeholder="First name" required class="auth-input" style="width:100%;" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Last Name *</label>
              <input type="text" name="last_name" placeholder="Last name" required class="auth-input" style="width:100%;" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Contact Number</label>
            <input type="text" name="contact_number" placeholder="+63 9XX XXX XXXX" class="auth-input" style="width:100%;" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Incident Date *</label>
              <input type="date" name="incident_date" value="${today}" required class="auth-input" style="width:100%;" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Incident Time</label>
              <input type="time" name="incident_time" value="14:00" class="auth-input" style="width:100%;" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Incident Location *</label>
            <input type="text" name="incident_location" placeholder="Purok / Street / Landmark" required class="auth-input" style="width:100%;" />
          </div>

          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Persons Involved</label>
            <input type="text" name="persons_involved" placeholder="Respondent name(s) if known" class="auth-input" style="width:100%;" />
          </div>

          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Complaint Description *</label>
            <textarea name="description" rows="3" required placeholder="Describe the complaint details..." class="auth-input" style="width:100%;"></textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button type="button" class="button button-light" id="cancelWalkin">Cancel</button>
            <button type="submit" class="button button-primary">Save Complaint</button>
          </div>
        </form>
      `);

      document
        .getElementById("cancelWalkin")
        ?.addEventListener("click", closeModal);
      document
        .getElementById("walkinForm")
        ?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const payload = Object.fromEntries(fd.entries());
          payload.resident_name =
            `${String(payload.first_name || "").trim()} ${String(payload.last_name || "").trim()}`.trim();
          payload.contact_number = payload.contact_number || "";

          try {
            const res = await fetch(`${API_BASE_URL}/complaints`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const err = await res.json();
              alert(err.error || "Could not save complaint.");
              return;
            }

            const created = await res.json();
            selectedComplaint = created;
            closeModal();
            await loadData();
            showToast(`Walk-in complaint ${created.reference_number} saved.`);
          } catch (err) {
            alert("Backend server unreachable.");
          }
        });
    });
  }

  // ---------------------------------------------------------
  // MODAL 2: ROUTE COMPLAINT (PATCH /api/complaints/:id/route)
  // ---------------------------------------------------------
  if (routeBtn && routeBtn.tagName === "BUTTON") {
    routeBtn.addEventListener("click", () => {
      if (!selectedComplaint) {
        showToast("Please select a complaint first.");
        return;
      }

      const personnelOptions = personnelList
        .map(
          (p) =>
            `<option value="${p.personnel_id}" ${
              selectedComplaint.assigned_to === p.personnel_id ? "selected" : ""
            }>${escapeHtml(p.full_name)} (${escapeHtml(p.role)})</option>`,
        )
        .join("");

      openModal(`
        <h2 id="modalTitle" style="margin-bottom:4px;">Route Complaint • ${escapeHtml(selectedComplaint.reference_number)}</h2>
        <p style="color:#64748b;font-size:0.9rem;margin-bottom:16px;">Assign handling officer and update workflow stage for <strong>${escapeHtml(selectedComplaint.resident_name)}</strong>.</p>
        <form id="routeForm" style="display:grid;gap:12px;">
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Assign To Personnel</label>
            <select name="assigned_to" required class="auth-input" style="width:100%;">
              ${personnelOptions}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">New Workflow Status</label>
              <select name="status" required class="auth-input" style="width:100%;">
                <option value="Under Review" ${selectedComplaint.status === "Under Review" ? "selected" : ""}>For Review / Under Review</option>
                <option value="For Verification" ${selectedComplaint.status === "For Verification" ? "selected" : ""}>For Verification</option>
                <option value="Hearing Scheduled" ${selectedComplaint.status === "Hearing Scheduled" ? "selected" : ""}>For Hearing</option>
                <option value="Referred">Referred to Lupon / Agency</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Routing Decision</label>
              <select name="decision" class="auth-input" style="width:100%;">
                <option value="Proceed to Mediation">Proceed to Mediation</option>
                <option value="Field Inspection Required">Field Inspection Required</option>
                <option value="Escalate to Barangay Captain">Escalate to Barangay Captain</option>
                <option value="Refer to Lupon Tagapamayapa">Refer to Lupon Tagapamayapa</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px;">Routing Notes</label>
            <textarea name="routing_notes" rows="3" placeholder="Instructions for the assigned personnel..." class="auth-input" style="width:100%;">${escapeHtml(selectedComplaint.routing_notes || "")}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px;">
            <button type="button" class="button button-light" id="cancelRoute">Cancel</button>
            <button type="submit" class="button button-primary">Confirm Routing</button>
          </div>
        </form>
      `);

      document
        .getElementById("cancelRoute")
        ?.addEventListener("click", closeModal);
      document
        .getElementById("routeForm")
        ?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const payload = {
            assigned_to: Number(fd.get("assigned_to")),
            status: fd.get("status"),
            decision: fd.get("decision"),
            routing_notes: fd.get("routing_notes"),
            updated_by: currentUser.personnel_id,
          };

          try {
            const res = await fetch(
              `${API_BASE_URL}/complaints/${selectedComplaint.complaint_id}/route`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );

            if (!res.ok) {
              alert(
                "Failed to route complaint. Make sure PATCH /api/complaints/:id/route is added to server.js.",
              );
              return;
            }

            closeModal();
            await loadData();
            showToast(
              `${selectedComplaint.reference_number} routed successfully.`,
            );
          } catch (err) {
            alert("Backend server unreachable.");
          }
        });
    });
  }

  // ---------------------------------------------------------
  // MODAL 3: COMPLAINT DETAILS PREVIEW
  // ---------------------------------------------------------
  function openDeleteModal(c) {
    modalBackdrop.className = "modal-backdrop delete-confirmation";
    openModal(`
      <div class="delete-dialog-content">
        <span class="delete-dialog-icon"><img src="assets/images/delete-trash.svg" alt="" /></span>
        <h2 id="modalTitle">Delete Complaint?</h2>
        <p class="delete-dialog-copy">Are you sure you want to delete this complaint? This action cannot be undone.</p>
        <div class="delete-dialog-summary">
          <div><span>Reference Number</span><strong>${escapeHtml(c.reference_number)}</strong></div>
          <div><span>Resident</span><strong>${escapeHtml(c.resident_name)}</strong></div>
        </div>
        <div class="delete-dialog-actions">
          <button type="button" id="cancelDelete">Cancel</button>
          <button type="button" class="delete-confirm" id="confirmDelete"><img src="assets/images/delete-trash-small.svg" alt="" />Delete Complaint</button>
        </div>
      </div>
    `);

    document.getElementById("cancelDelete")?.addEventListener("click", closeModal);
    document.getElementById("confirmDelete")?.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/complaints/${c.complaint_id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || "Failed to delete complaint.");
          closeModal();
          return;
        }
        if (selectedComplaint?.complaint_id === c.complaint_id) {
          selectedComplaint = null;
        }
        closeModal();
        await loadData();
        showToast(`${c.reference_number} deleted successfully.`);
      } catch (err) {
        showToast("Database server unreachable.");
        closeModal();
      }
    });
  }

  function openComplaintDetailsModal(c) {
    openModal(`
      <p style="font-size:0.75rem;font-weight:700;color:#123f2f;letter-spacing:0.06em;">COMPLAINT RECORD</p>
      <h2 id="modalTitle" style="margin:4px 0 12px;">${escapeHtml(c.reference_number)} — ${escapeHtml(c.resident_name)}</h2>
      <div style="display:grid;gap:8px;font-size:0.9rem;background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:16px;">
        <div><strong>Category:</strong> ${escapeHtml(c.category)}</div>
        <div><strong>Status:</strong> ${escapeHtml(c.status)} (${escapeHtml(c.verification_status || "Verified")})</div>
        <div><strong>Contact:</strong> ${escapeHtml(c.contact_number || "N/A")}</div>
        <div><strong>Location:</strong> ${escapeHtml(c.incident_location)}</div>
        <div><strong>Persons Involved:</strong> ${escapeHtml(c.persons_involved || "None specified")}</div>
        <div><strong>Assigned To:</strong> ${escapeHtml(c.assigned_personnel_name || "Unassigned")}</div>
        <div><strong>Description:</strong><p style="margin:4px 0 0;color:#334155;">${escapeHtml(c.description)}</p></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <a href="hearing-calendar.html?ref=${encodeURIComponent(c.reference_number)}" class="button button-primary">Schedule Hearing</a>
        <button type="button" class="button button-light" id="closeDetailsBtn">Close</button>
      </div>
    `);
    document
      .getElementById("closeDetailsBtn")
      ?.addEventListener("click", closeModal);
  }

  // Modal & Toast Helpers
  function openModal(html) {
    if (!modalBackdrop || !modalContent) return;
    modalContent.innerHTML = html;
    modalBackdrop.hidden = false;
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.hidden = true;
    modalBackdrop.className = "modal-backdrop";
    modalContent.innerHTML = "";
  }

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  function showToast(message) {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
});

// Status Normalizer & Badges
function normalizeStatus(raw) {
  const s = (raw || "Received").toLowerCase();
  if (s === "received" || s === "submitted" || s === "new submission")
    return "New Submission";
  if (s.includes("verification")) return "For Verification";
  if (s.includes("review")) return "For Review";
  if (s.includes("hearing") || s === "rescheduled") return "For Hearing";
  if (s === "resolved" || s === "closed") return "Resolved";
  return raw;
}

function getStatusBadge(raw) {
  const norm = normalizeStatus(raw);
  if (norm === "New Submission")
    return { label: "New Submission", css: "submitted" };
  if (norm === "For Verification")
    return { label: "For Verification", css: "verification" };
  if (norm === "For Review") return { label: "For Review", css: "review" };
  if (norm === "For Hearing") return { label: "For Hearing", css: "hearing" };
  if (norm === "Resolved") return { label: "Resolved", css: "resolved" };
  return { label: raw, css: "referred" };
}

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function populateUserProfile(user) {
  const initial = (user.full_name || "P").trim().charAt(0).toUpperCase();
  const topAvatar = document.querySelector("#profileButton .avatar");
  const topName = document.querySelector("#profileButton .profile-copy strong");
  const topRole = document.querySelector("#profileButton .profile-copy small");
  if (topAvatar) topAvatar.textContent = initial;
  if (topName) topName.textContent = user.full_name;
  if (topRole) topRole.textContent = user.role;

  const popAvatar = document.querySelector("#profilePanel .avatar.large");
  const popName = document.querySelector(
    "#profilePanel .profile-popover-head b",
  );
  const popRole = document.querySelector(
    "#profilePanel .profile-popover-head small",
  );
  if (popAvatar) popAvatar.textContent = initial;
  if (popName) popName.textContent = user.full_name;
  if (popRole) popRole.textContent = user.role;
}

function bindLogoutButtons() {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
