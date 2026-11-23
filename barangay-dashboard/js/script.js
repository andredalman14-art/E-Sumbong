const complaintDetails = {
  "BC-2025-0048": {
    resident: "Elena Villanueva",
    category: "Noise",
    location: "Near the Purok 2 covered court",
    date: "March 11, 2025",
    status: "Submitted",
    assigned: "Maria Santos",
    summary:
      "The resident reported recurring late night noise near the covered court and requested barangay assistance.",
  },
  "BC-2025-0047": {
    resident: "Joel Mendoza",
    category: "Garbage / Cleanliness",
    location: "Vacant area beside Purok 5 pathway",
    date: "March 10, 2025",
    status: "For Verification",
    assigned: "Maria Santos",
    summary:
      "Improperly disposed household waste was reported along a shared pathway.",
  },
  "BC-2025-0046": {
    resident: "Marites Flores",
    category: "Property Disputes",
    location: "Boundary between two residential lots",
    date: "March 8, 2025",
    status: "Under Review",
    assigned: "Roberto Dela Cruz",
    summary: "A resident requested mediation over a disputed boundary marker.",
  },
  "BC-2025-0045": {
    resident: "Paolo Reyes",
    category: "Safety",
    location: "Dim pathway near a side street",
    date: "March 6, 2025",
    status: "Referred",
    assigned: "Roberto Dela Cruz",
    summary:
      "A report about inadequate pathway lighting has been referred for follow up.",
  },
  "BC-2025-0044": {
    resident: "Liza Navarro",
    category: "Noise",
    location: "Purok 4",
    date: "March 4, 2025",
    status: "For Hearing",
    assigned: "Maria Santos",
    summary: "The parties have been invited to attend a barangay hearing.",
  },
  "BC-2025-0041": {
    resident: "Ramon Garcia",
    category: "Property Disputes",
    location: "Purok 3",
    date: "March 1, 2025",
    status: "For Hearing",
    assigned: "Maria Santos",
    summary: "Mediation hearing scheduled for March 18 at 10:00 AM.",
  },
  "BC-2025-0043": {
    resident: "Ana Bautista",
    category: "Garbage / Cleanliness",
    location: "Purok 1",
    date: "March 2, 2025",
    status: "For Hearing",
    assigned: "Roberto Dela Cruz",
    summary: "Follow up hearing scheduled for March 21 at 1:30 PM.",
  },
};
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modalContent");
const toastRegion = document.querySelector("#toastRegion");
function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastRegion.append(el);
  setTimeout(() => el.remove(), 3200);
}
function openModal(title, body, actions = "") {
  modalContent.innerHTML = `<h2 id="modalTitle">${title}</h2>${body}${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
function openComplaint(id) {
  const d = complaintDetails[id];
  if (!d) {
    toast(`${id} hearing details opened`);
    return;
  }
  openModal(
    `Complaint ${id}`,
    `<p>${d.summary}</p><div class="modal-meta"><div><small>Resident</small><strong>${d.resident}</strong></div><div><small>Category</small><strong>${d.category}</strong></div><div><small>Location</small><strong>${d.location}</strong></div><div><small>Submitted</small><strong>${d.date}</strong></div><div><small>Status</small><strong>${d.status}</strong></div><div><small>Assigned personnel</small><strong>${d.assigned}</strong></div></div>`,
    `<button class="button button-light" data-action="close-modal">Close</button><button class="button button-primary" data-action="update-complaint" data-id="${id}">Update status</button>`,
  );
}
function closePopovers(except) {
  document.querySelectorAll(".popover").forEach((p) => {
    if (p !== except) p.hidden = true;
  });
  document.querySelectorAll("[aria-expanded]").forEach((b) => {
    if (!except || !except.contains(b))
      b.setAttribute("aria-expanded", "false");
  });
}
document.querySelector("#notificationButton").addEventListener("click", (e) => {
  e.stopPropagation();
  const p = document.querySelector("#notificationPanel");
  const show = p.hidden;
  closePopovers(p);
  p.hidden = !show;
  e.currentTarget.setAttribute("aria-expanded", String(show));
});
document.querySelector("#profileButton").addEventListener("click", (e) => {
  e.stopPropagation();
  const p = document.querySelector("#profilePanel");
  const show = p.hidden;
  closePopovers(p);
  p.hidden = !show;
  e.currentTarget.setAttribute("aria-expanded", String(show));
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".popover-wrap")) closePopovers();
});
document.querySelectorAll(".nav-link").forEach((link) =>
  link.addEventListener("click", (e) => {
    document
      .querySelectorAll(".nav-link")
      .forEach((n) => n.classList.remove("active"));
    link.classList.add("active");
    document.querySelector("#sidebar").classList.remove("open");
    const section = link.dataset.section;
    if (
      section !== "Dashboard" &&
      section !== "Complaints" &&
      section !== "Hearing Calendar" &&
      section !== "Activity Log"
    ) {
      e.preventDefault();
      toast(`${section} section selected`);
    } else if (
      section === "Complaints" ||
      section === "Hearing Calendar" ||
      section === "Activity Log"
    ) {
      toast(`${section} section selected`);
    }
  }),
);
document.querySelectorAll(".stat-card").forEach((card) =>
  card.addEventListener("click", () => {
    document
      .querySelectorAll(".stat-card")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    const filter = card.dataset.filter;
    let shown = 0;
    document.querySelectorAll(".complaint-table tbody tr").forEach((row) => {
      const d = complaintDetails[row.dataset.id];
      const match = filter === "All" || d?.status === filter;
      row.hidden = !match;
      if (match) shown++;
    });
    toast(
      filter === "All"
        ? "Showing all recent complaints"
        : `Showing ${shown} ${filter.toLowerCase()} complaint${shown === 1 ? "" : "s"}`,
    );
  }),
);
document
  .querySelectorAll(".complaint-table tbody tr,.hearing-card")
  .forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("button")) e.stopPropagation();
      openComplaint(row.dataset.id);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openComplaint(row.dataset.id);
      }
    });
  });
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  switch (action) {
    case "close-modal":
      closeModal();
      break;
    case "new-complaints":
      document.querySelector('[data-filter="Submitted"]').click();
      document
        .querySelector("#complaints")
        .scrollIntoView({ behavior: "smooth" });
      break;
    case "manage-schedules":
      document
        .querySelector("#hearings")
        .scrollIntoView({ behavior: "smooth" });
      toast("Upcoming hearing schedule");
      break;
    case "calendar":
      document
        .querySelector("#hearings")
        .scrollIntoView({ behavior: "smooth" });
      toast("Calendar view is ready");
      break;
    case "view-all":
      toast("Showing the latest complaint records");
      break;
    case "all-notifications":
      toast("You are viewing all notifications");
      closePopovers();
      break;
    case "mark-read":
      document.querySelector(".notification-trigger i").style.display = "none";
      button.textContent = "All caught up";
      toast("Notifications marked as read");
      break;
    case "profile":
    case "settings":
      toast(`${button.textContent} opened`);
      closePopovers();
      break;
    case "update-complaint":
      toast(`Status update for ${button.dataset.id} is ready`);
      closeModal();
      break;
  }
});
document
  .querySelector("#mobileMenu")
  .addEventListener("click", () =>
    document.querySelector("#sidebar").classList.toggle("open"),
  );
document.querySelector(".modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closePopovers();
    document.querySelector("#sidebar").classList.remove("open");
  }
});
