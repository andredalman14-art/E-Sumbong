(() => {
  const params = new URLSearchParams(location.search);
  const genericId = params.get("id");
  const requestedReference = params.get("reference") || params.get("reference_number") || params.get("complaintReference") || params.get("complaint_reference") || params.get("ref") || (/^BC-/i.test(genericId || "") ? genericId : null);
  const requestedHearingId = params.get("hearingId") || params.get("hearing_id") || params.get("scheduleId") || (!/^BC-/i.test(genericId || "") ? genericId : null);
  const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const fallbackDemos = {
    "BC-2025-0042": { resident_name: "Elena Villanueva", hearing_date: "2025-03-05", hearing_time: "9:00 AM", hearing_location: "Barangay Session Hall", category: "Noise", hearing_type: "Initial Hearing" },
    "BC-2025-0041": { resident_name: "Ramon Garcia", hearing_date: "2025-03-18", hearing_time: "10:00 AM", hearing_location: "Barangay Session Hall", category: "Noise", hearing_type: "Mediation Hearing" },
    "BC-2025-0044": { resident_name: "Liza Navarro", hearing_date: "2025-03-18", hearing_time: "10:00 AM", hearing_location: "Barangay Session Hall", category: "Noise", hearing_type: "Initial Hearing" },
    "BC-2025-0043": { resident_name: "Ana Bautista", hearing_date: "2025-03-21", hearing_time: "1:30 PM", hearing_location: "Barangay Session Hall", category: "Property Dispute", hearing_type: "Initial Hearing" },
  };
  const formatDate = (raw) => {
    if (!raw) return "—";
    const text = String(raw);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const date = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3], 12) : new Date(raw);
    return Number.isNaN(date.valueOf()) ? text : date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  };
  const formatTime = (raw) => {
    if (!raw) return "—";
    const match = String(raw).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return String(raw);
    const period = (match[3] || (+match[1] >= 12 ? "PM" : "AM")).toUpperCase();
    return `${+match[1] % 12 || 12}:${match[2]} ${period}`;
  };
  const byId = (id) => document.getElementById(id);
  const setText = (id, text) => { const node = byId(id); if (node) node.textContent = text || "—"; };
  const getArray = (value) => Array.isArray(value) ? value : [];
  const sameId = (left, right) => left != null && right != null && String(left) === String(right);

  async function loadDetails() {
    let complaints = getArray(read("barangayComplaintRecords"));
    let schedules = getArray(read("barangayHearingSchedules"));
    let activities = [];
    let apiHearings = [];
    let apiComplaints = [];
    let apiActivities = [];

    if (typeof API_BASE_URL !== "undefined") {
      try {
        const [hearingResponse, complaintResponse, activityResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/hearings`, { signal: AbortSignal.timeout(3500) }),
          fetch(`${API_BASE_URL}/complaints`, { signal: AbortSignal.timeout(3500) }),
          fetch(`${API_BASE_URL}/activity-logs`, { signal: AbortSignal.timeout(3500) }),
        ]);
        if (hearingResponse.ok) apiHearings = getArray(await hearingResponse.json());
        if (complaintResponse.ok) apiComplaints = getArray(await complaintResponse.json());
        if (activityResponse.ok) apiActivities = getArray(await activityResponse.json());
        if (apiComplaints.length) complaints = apiComplaints;
      } catch { /* The page can still show locally saved records when the API is offline. */ }
    }

    const byReferenceOrId = (collection, id, ref) => collection.find((item) =>
      (id && (sameId(item.hearing_id, id) || sameId(item.id, id))) ||
      (ref && (item.reference === ref || item.reference_number === ref || item.complaintReference === ref)));
    const hearing = byReferenceOrId(apiHearings, requestedHearingId, requestedReference) ||
      byReferenceOrId(schedules, requestedHearingId, requestedReference);
    const resolvedReference = requestedReference || hearing?.reference_number || hearing?.reference || hearing?.complaintReference;
    const complaint = complaints.find((item) =>
      (resolvedReference && (item.reference === resolvedReference || item.reference_number === resolvedReference)) ||
      (hearing?.complaint_id && sameId(item.complaint_id, hearing.complaint_id)));
    const localComplaint = getArray(read("barangayComplaintRecords")).find((item) => item.reference === resolvedReference);
    const record = complaint || localComplaint;
    const schedule = hearing || record?.hearingSchedule || record?.scheduledHearing || record?.hearing || fallbackDemos[resolvedReference] || {};
    const reference = resolvedReference || record?.reference_number || record?.reference || schedule.reference_number;
    const resident = record?.resident_name || record?.resident || record?.fullName || schedule.resident_name || schedule.resident || schedule.residentName;
    const category = record?.category || schedule.category;
    const date = schedule.hearing_date || schedule.date || schedule.hearingDate || schedule.scheduledDate;
    const time = schedule.hearing_time || schedule.time || schedule.hearingTime || schedule.scheduledTime;
    const dateTime = `${formatDate(date)} · ${formatTime(time)}`;
    const type = schedule.hearing_type || schedule.type || schedule.hearingType;
    const location = schedule.hearing_location || schedule.venue || schedule.location || schedule.hearingLocation;
    const personnel = schedule.assigned_personnel_name || schedule.assignedPersonnel || schedule.personnel || record?.assigned_personnel_name || record?.assigned;
    const notify = schedule.notify_resident ?? schedule.notifyResident;
    const notificationStatus = schedule.notification_status || schedule.notificationStatus || (notify === false ? "Not requested" : "Pending");
    const hearingStatus = schedule.status || "Scheduled";
    const complaintDescription = record?.description || record?.complaint_description || record?.notes || "No complaint description is available.";

    setText("detailsReference", reference);
    setText("detailsResident", resident);
    setText("detailsCategory", category);
    setText("detailsType", type);
    setText("detailsDateTime", dateTime === "— · —" ? "—" : dateTime);
    setText("detailsLocation", location);
    setText("detailsPersonnel", personnel);
    setText("detailsDescription", complaintDescription);
    setText("detailsContextReference", reference);
    setText("detailsContextCategory", category);
    setText("hearingStatusBadge", /upcoming|scheduled/i.test(hearingStatus) ? "Scheduled" : hearingStatus);

    const notification = byId("detailsNotification");
    notification.textContent = notificationStatus;
    notification.className = "hearing-notification-status" + (/pending/i.test(notificationStatus) ? " pending" : /not requested/i.test(notificationStatus) ? " not-requested" : "");

    const complaintUrl = reference ? `complaint-details.html?reference=${encodeURIComponent(reference)}` : "complaints.html";
    byId("viewComplaintDetails").href = complaintUrl;
    byId("rescheduleHearing").href = reference ? `route-complaint.html?reference=${encodeURIComponent(reference)}&reschedule=1` : "hearing-calendar.html";

    const hearingId = schedule.hearing_id || schedule.id;
    activities = apiActivities.filter((item) => {
      const relatedToHearing = hearingId
        ? sameId(item.hearing_id, hearingId)
        : (record?.complaint_id && sameId(item.complaint_id, record.complaint_id)) ||
          (reference && (item.reference_number === reference || item.reference === reference));
      return relatedToHearing && /hearing|notification/i.test(item.activity || item.title || "");
    });
    const created = schedule.created_at || schedule.scheduledAt || schedule.createdAt || schedule.dateCreated;
    const createdLabel = created ? new Date(created).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }) : "Hearing record";
    let history;
    if (activities.length) {
      history = activities.slice().reverse().map((item) => ({
        title: item.activity || item.title || "Hearing activity",
        date: item.created_at ? new Date(item.created_at).toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" }) : item.date || createdLabel,
        detail: item.remarks || item.detail || item.new_status || "Hearing record updated.",
        tag: item.new_status || "Recorded",
      }));
    } else if (reference && schedule.hearing_date) {
      history = [
        { title: "Hearing schedule created", date: createdLabel, detail: `${type || "Hearing"} created for ${reference}.`, tag: "Scheduled" },
        { title: "Hearing date and time confirmed", date: createdLabel, detail: `${dateTime} at ${location || "the selected location"}.`, tag: "Confirmed" },
        { title: "Assigned personnel recorded", date: createdLabel, detail: personnel || "Personnel assignment saved.", tag: "Recorded" },
        ...(notify === false ? [] : [{ title: /pending/i.test(notificationStatus) ? "Resident notification pending" : "Resident notification sent", date: createdLabel, detail: /pending/i.test(notificationStatus) ? "The resident notification is queued for delivery." : "The hearing schedule was delivered to the resident.", tag: notificationStatus, pending: /pending/i.test(notificationStatus) }]),
      ];
    } else {
      history = [{ title: "Hearing record not found", date: "", detail: "Return to the Hearing Schedule and open a specific hearing record.", tag: "Unavailable" }];
    }
    byId("hearingTimeline").innerHTML = history.map((item, index) => `<li><span class="hearing-history-index">${index + 1}</span><div class="hearing-history-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.date || "—")}</small><p>${escapeHtml(item.detail || "—")}</p></div><span class="hearing-history-tag${item.pending ? " pending" : ""}">${escapeHtml(item.tag)}</span></li>`).join("");
  }

  loadDetails().catch((error) => console.error("Could not load hearing details:", error));
})();
