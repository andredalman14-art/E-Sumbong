(() => {
  const params = new URLSearchParams(location.search);
  const reference = params.get("reference") || params.get("reference_number") || params.get("ref");
  const safeRead = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const text = (value, fallback = "—") => value || fallback;
  const dateLabel = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };
  const getJson = async (path) => {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(3500) });
      return response.ok ? await response.json() : [];
    } catch { return []; }
  };
  const setText = (id, value, fallback) => { const node = document.getElementById(id); if (node) node.textContent = text(value, fallback); };

  async function load() {
    const [apiComplaints, apiActivities] = await Promise.all([getJson("/complaints"), getJson("/activity-logs")]);
    const localComplaints = safeRead("barangayComplaintRecords");
    const records = Array.isArray(apiComplaints) && apiComplaints.length ? apiComplaints : Array.isArray(localComplaints) ? localComplaints : [];
    const record = records.find((item) => item.reference_number === reference || item.reference === reference);
    if (!record) {
      setText("detailReference", reference);
      setText("detailReferenceCopy", reference);
      setText("detailDescription", "This complaint could not be loaded. Return to the hearing calendar and open the selected record again.");
      document.getElementById("noDocuments").hidden = false;
      document.getElementById("hearingTimeline").innerHTML = "";
      return;
    }
    const ref = record.reference_number || record.reference;
    const status = record.status || "Submitted";
    const statusBadge = document.getElementById("detailStatusTop");
    statusBadge.textContent = status;
    statusBadge.className = `status ${String(status).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    setText("detailReference", ref);
    setText("detailReferenceCopy", ref);
    setText("detailResident", record.resident_name || record.resident || record.fullName);
    setText("detailDate", dateLabel(record.created_at || record.dateRegistered || record.date));
    setText("detailCategory", record.category);
    setText("detailCurrentStatus", status);
    const residentAddress = record.resident_address || record.complete_address || record.completeAddress;
    const purok = record.purok_location || record.purok;
    setText("detailLocation", [residentAddress, purok, record.incident_location].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ") || record.location);
    setText("detailContact", record.contact_number || record.contactNumber || record.phone);
    setText("detailSubmission", record.submission_method || record.submissionMethod || "Online");
    setText("detailDescription", record.description || record.complaint_description || record.notes);

    const additional = record.additional_information || record.additionalInformation || record.extra_information;
    const extra = document.getElementById("extraInformation");
    extra.hidden = !additional;
    if (additional) setText("detailAdditional", additional);

    const inputDocs = record.supporting_documents || record.supportingDocuments || record.documents || [];
    const docs = Array.isArray(inputDocs) ? inputDocs : inputDocs ? [inputDocs] : [];
    const docHost = document.getElementById("documentList");
    docHost.innerHTML = docs.length ? docs.map((doc) => {
      const name = typeof doc === "string" ? doc : doc.name || doc.filename || "Supporting document";
      const href = typeof doc === "object" ? doc.url || doc.path || "#" : "#";
      return `<a class="route-document" href="${esc(href)}"${href === "#" ? "" : ' target="_blank" rel="noopener"'}>${esc(name)}</a>`;
    }).join("") : "";
    document.getElementById("noDocuments").hidden = docs.length > 0;

    const activities = Array.isArray(apiActivities) ? apiActivities.filter((item) => item.reference_number === ref) : [];
    const localHistory = Array.isArray(record.activityHistory) ? record.activityHistory : [];
    const history = activities.length ? activities.map((item) => ({
      title: item.activity || item.title || "Complaint updated",
      by: item.updated_by_name || item.by || "System",
      detail: item.remarks || item.detail || item.new_status || "Complaint record updated.",
      date: dateLabel(item.created_at || item.date),
    })) : localHistory.map((item) => ({ title: item.title, by: item.by, detail: item.detail, date: item.date }));
    if (!history.length) history.push({ title: "Complaint Submitted", by: record.recordedBy || "System Record", detail: `Complaint registered through ${record.submission_method || record.submissionMethod || "resident submission"}.`, date: dateLabel(record.created_at || record.dateRegistered || record.date) });
    document.getElementById("activityTimeline").innerHTML = history.map((item) => `<li><strong>${esc(item.title)}</strong><small>${esc(item.date || "—")}</small><p><b>${esc(item.by || "System")}</b> · ${esc(item.detail || "—")}</p></li>`).join("");
    document.getElementById("editRegisteredDetails").addEventListener("click", () => { location.href = `edit-complaint.html?reference=${encodeURIComponent(ref)}`; });
    document.querySelectorAll(".details-back-top,.details-footer a").forEach((link) => { link.href = `complaints.html?ref=${encodeURIComponent(ref)}`; });
    const editSuccess = sessionStorage.getItem("complaintDetailsUpdated");
    if (editSuccess) {
      sessionStorage.removeItem("complaintDetailsUpdated");
      const toast = document.getElementById("toastRegion");
      if (toast) { const message = document.createElement("div"); message.className = "toast"; message.textContent = editSuccess; toast.appendChild(message); setTimeout(() => message.remove(), 4000); }
    }
  }

  document.getElementById("modal")?.addEventListener("click", (event) => {
    if (event.target.id === "modal" || event.target.closest(".modal-close") || event.target.closest('[data-action="close-modal"]')) event.currentTarget.hidden = true;
  });
  document.querySelector(".modal-close")?.addEventListener("click", () => { document.getElementById("modal").hidden = true; });
  load().catch((error) => console.error("Could not load complaint details:", error));
})();
