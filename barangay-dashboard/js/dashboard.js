document.addEventListener("DOMContentLoaded", async () => {
  // 1. Require active login session & populate topbar user profile
  const currentUser = requireAuth();
  if (!currentUser) return;

  populateUserProfile(currentUser);
  bindLogoutButtons();

  // 2. Fetch live data from PostgreSQL via Express API
  try {
    const [complaintsRes, hearingsRes, logsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/complaints`),
      fetch(`${API_BASE_URL}/hearings`),
      fetch(`${API_BASE_URL}/activity-logs`),
    ]);

    const complaints = complaintsRes.ok ? await complaintsRes.json() : [];
    const hearings = hearingsRes.ok ? await hearingsRes.json() : [];
    const logs = logsRes.ok ? await logsRes.json() : [];

    renderStatCards(complaints);
    renderRecentComplaints(complaints);
    renderStatusOverview(complaints);
    renderCategoryOverview(complaints);
    renderUpcomingHearings(hearings);
    renderRecentActivity(logs);
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
});

// Populate logged-in personnel name, role, and avatar initial
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

// Normalize status labels & CSS badge classes
function getStatusMeta(rawStatus) {
  const s = (rawStatus || "Received").toLowerCase();
  if (s === "received" || s === "submitted") {
    return { label: "Submitted", css: "submitted", bucket: "Submitted" };
  }
  if (s.includes("verification")) {
    return {
      label: "For Verification",
      css: "verification",
      bucket: "For Verification",
    };
  }
  if (s.includes("review")) {
    return { label: "Under Review", css: "review", bucket: "Under Review" };
  }
  if (s.includes("hearing") || s === "rescheduled") {
    return {
      label: rawStatus === "Rescheduled" ? "Rescheduled" : "For Hearing",
      css: "hearing",
      bucket: "For Hearing",
    };
  }
  if (s === "referred") {
    return { label: "Referred", css: "referred", bucket: "Referred" };
  }
  if (s === "resolved" || s === "closed") {
    return { label: "Resolved", css: "resolved", bucket: "Resolved" };
  }
  return { label: rawStatus, css: "submitted", bucket: "Submitted" };
}

// 1. Update Top KPI Stat Cards
function renderStatCards(complaints) {
  const counts = {
    All: complaints.length,
    Submitted: 0,
    "For Verification": 0,
    "Under Review": 0,
    "For Hearing": 0,
    Resolved: 0,
  };

  complaints.forEach((c) => {
    const meta = getStatusMeta(c.status);
    if (counts[meta.bucket] !== undefined) {
      counts[meta.bucket]++;
    }
  });

  document.querySelectorAll(".stats-grid .stat-card").forEach((card) => {
    const filter = card.dataset.filter;
    const countEl = card.querySelector("strong");
    if (countEl && counts[filter] !== undefined) {
      countEl.textContent = counts[filter];
    }
  });
}

// 2. Render Recent Complaint Submissions Table
function renderRecentComplaints(complaints) {
  const tbody = document.querySelector(".complaint-table tbody");
  if (!tbody) return;

  if (complaints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;">No complaints recorded in database yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = complaints
    .slice(0, 6)
    .map((c) => {
      const meta = getStatusMeta(c.status);
      const submittedDate = formatShortDate(c.created_at || c.incident_date);
      const assignedName = c.assigned_personnel_name || "Unassigned";

      return `
        <tr tabindex="0" data-id="${c.reference_number}">
          <td class="reference">${c.reference_number}</td>
          <td>
            <strong>${escapeHtml(c.resident_name)}</strong>
            <small>${escapeHtml(c.incident_location)}</small>
          </td>
          <td>${escapeHtml(c.category)}</td>
          <td>${submittedDate}</td>
          <td><span class="status ${meta.css}">${meta.label}</span></td>
          <td>${escapeHtml(assignedName)}</td>
          <td>
            <button class="row-open" aria-label="Open ${c.reference_number}">›</button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Navigate to complaints page with selected case reference on click
  tbody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = `complaints.html?ref=${encodeURIComponent(row.dataset.id)}`;
    });
  });
}

// 3. Render Complaint Status Overview Progress Bars
function renderStatusOverview(complaints) {
  const container = document.querySelector(".status-list");
  if (!container) return;

  const total = complaints.length || 1;
  const buckets = [
    "For Verification",
    "Under Review",
    "For Hearing",
    "Rescheduled",
    "Referred",
    "Resolved",
  ];

  const counts = Object.fromEntries(buckets.map((b) => [b, 0]));
  complaints.forEach((c) => {
    if (c.status === "Rescheduled") {
      counts["Rescheduled"]++;
    } else {
      const meta = getStatusMeta(c.status);
      if (counts[meta.bucket] !== undefined) counts[meta.bucket]++;
    }
  });

  container.innerHTML = buckets
    .map((label) => {
      const count = counts[label];
      const pct = Math.round((count / total) * 100);
      return `
        <div class="status-item">
          <div><span>${label}</span><b>${count}</b></div>
          <i><em style="width: ${pct}%"></em></i>
        </div>
      `;
    })
    .join("");
}

// 4. Render Complaint Categories Progress Bars
function renderCategoryOverview(complaints) {
  const container = document.querySelector(".category-list");
  if (!container) return;

  const categoryMap = {};
  complaints.forEach((c) => {
    const cat = c.category || "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const entries = Object.entries(categoryMap);
  if (entries.length === 0) return;

  const maxCount = Math.max(...entries.map(([, count]) => count), 1);

  container.innerHTML = entries
    .map(([category, count]) => {
      const pct = Math.round((count / maxCount) * 100);
      return `
        <div class="category">
          <span>${escapeHtml(category)}</span>
          <i><em style="width: ${pct}%"></em></i>
          <b>${count}</b>
        </div>
      `;
    })
    .join("");
}

// 5. Render Upcoming Hearings Panel
function renderUpcomingHearings(hearings) {
  const container = document.querySelector(".hearing-list");
  if (!container) return;

  const activeHearings = hearings.filter(
    (h) => h.status !== "Completed" && h.status !== "Cancelled",
  );

  if (activeHearings.length === 0) {
    container.innerHTML = `<p style="padding:12px 0;color:#64748b;font-size:0.9rem;">No upcoming hearings scheduled.</p>`;
    return;
  }

  container.innerHTML = activeHearings
    .slice(0, 4)
    .map((h) => {
      const dateStr = formatShortDate(h.hearing_date);
      const timeStr = formatTime12h(h.hearing_time);
      return `
        <button class="hearing-card" data-id="${h.reference_number}" data-hearing-id="${h.hearing_id}">
          <span class="hearing-icon"><img src="assets/images/figma-icon-11.svg" alt="" /></span>
          <span>
            <strong>${h.reference_number}</strong>
            <small>${dateStr} • ${timeStr}</small>
          </span>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll(".hearing-card").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = `hearing-calendar.html?hearingId=${card.dataset.hearingId}`;
    });
  });
}

// 6. Render Recent Personnel Activity Panel
function renderRecentActivity(logs) {
  const container = document.querySelector(".activity-list");
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `<p style="padding:12px 0;color:#64748b;font-size:0.9rem;">No recent activity logged.</p>`;
    return;
  }

  container.innerHTML = logs
    .slice(0, 5)
    .map((log) => {
      const actor = log.updated_by_name || "System";
      const dateStr = formatNumericDate(log.created_at);
      return `
        <div class="activity-item">
          <i></i>
          <span>
            <strong>${escapeHtml(log.activity)}</strong>
            <small>${escapeHtml(actor)} • ${dateStr}</small>
          </span>
        </div>
      `;
    })
    .join("");
}

// Formatting Helpers
function formatShortDate(dateValue) {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumericDate(dateValue) {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [hh, mm] = timeStr.split(":");
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${mm} ${ampm}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
