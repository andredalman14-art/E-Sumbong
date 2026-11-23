(() => {
  const DRAFT_KEY = "barangayWalkInDraft";
  const RECORDS_KEY = "barangayComplaintRecords";
  const DELETED_KEY = "barangayDeletedComplaintReferences";
  const COUNTER_KEY = "barangayComplaintReferenceCounter";
  const LAST_KEY = "barangayLastRegisteredComplaint";
  const samples = [
    {
      reference: "BC-2025-0042",
      label: "Verified complaint",
      resident: "Elena Villanueva",
      residentType: "Poblacion resident",
      category: "Noise",
      date: "Mar 17, 2025",
      status: "For Review",
      assigned: "Maria Santos",
      notes: "Recurring late night noise near the covered court.",
      submissionMethod: "Online",
    },
    {
      reference: "BC-2025-0047",
      label: "Resident submission",
      resident: "Joel Mendoza",
      residentType: "Poblacion resident",
      category: "Garbage / Sanitation",
      date: "Mar 15, 2025",
      status: "For Verification",
      assigned: "Maria Santos",
      notes: "Improperly disposed waste beside the Purok 5 pathway.",
      submissionMethod: "Online",
    },
    {
      reference: "BC-2025-0039",
      label: "Resident submission",
      resident: "Marites Reyes",
      residentType: "Poblacion resident",
      category: "Property Dispute",
      date: "Mar 12, 2025",
      status: "For Hearing",
      assigned: "Maria Santos",
      notes: "Boundary marker disagreement between adjacent properties.",
      submissionMethod: "Online",
    },
    {
      reference: "BC-2025-0028",
      label: "Resident submission",
      resident: "Paolo Reyes",
      residentType: "Poblacion resident",
      category: "Safety",
      date: "Mar 8, 2025",
      status: "Resolved",
      assigned: "Maria Santos",
      notes: "Reported pathway safety issue.",
      submissionMethod: "Online",
    },
    {
      reference: "BC-2025-0018",
      label: "Resident submission",
      resident: "Liza Ramirez",
      residentType: "Poblacion resident",
      category: "Noise",
      date: "Mar 4, 2025",
      status: "For Hearing",
      assigned: "Maria Santos",
      notes: "Noise concern referred for hearing.",
      submissionMethod: "Online",
    },
  ];
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  const ATTACHMENT_DB = "barangayComplaintAttachments";
  function openAttachmentDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ATTACHMENT_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("files"))
          request.result.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function putAttachment(id, file) {
    const db = await openAttachmentDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").put({ id, file });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }
  async function getAttachment(id) {
    const db = await openAttachmentDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readonly");
      const request = transaction.objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result?.file || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }
  async function removeAttachment(id) {
    const db = await openAttachmentDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.objectStore("files").delete(id);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }
  function complaintFiles(record) {
    const input = record.supportingDocuments ?? record.documents ??
      (record.reference === "BC-2025-0042" ? [{ name: "incident-video.mp4", type: "video/mp4", size: "8.4 MB", sample: true }] : []);
    const files = Array.isArray(input) ? input : input ? [input] : [];
    return files.map((file, index) => typeof file === "string"
      ? { id: "legacy-" + index + "-" + file, name: file, url: "" }
      : { ...file, id: file.id || file.storageId || "legacy-" + index + "-" + (file.name || file.filename || "file"), name: file.name || file.filename || "Supporting document" });
  }
  function allRecords() {
    const deleted = new Set(read(DELETED_KEY, []));
    const stored = read(RECORDS_KEY, null);
    if (!Array.isArray(stored)) {
      save(RECORDS_KEY, samples.filter((item) => !deleted.has(item.reference)));
      return samples.filter((item) => !deleted.has(item.reference));
    }
    const map = new Map();
    stored.forEach((item) => map.set(item.reference, item));
    samples.forEach((item) => {
      if (!map.has(item.reference)) map.set(item.reference, item);
    });
    const merged = [...map.values()].filter((item) => !deleted.has(item.reference));
    if (merged.length !== stored.length) save(RECORDS_KEY, merged);
    return merged;
  }
  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function notice(message) {
    const region = document.querySelector("#toastRegion");
    if (!region) {
      alert(message);
      return;
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    region.append(el);
    setTimeout(() => el.remove(), 3000);
  }

  if (document.body.dataset.page === "record") {
    const form = document.querySelector("#walkinForm");
    const people = document.querySelector("#peopleList");
    const draft = read(DRAFT_KEY, {});
    const now = new Date();
    document.querySelector("#registrationTimestamp").textContent =
      new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(now);
    Object.entries(draft.fields || {}).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
    if (Array.isArray(draft.people) && draft.people.length) {
      people.innerHTML = "";
      draft.people.forEach((person) => addPerson(person));
    }
    function addPerson(person = {}) {
      const n = people.children.length + 1;
      const row = document.createElement("div");
      row.className = "person-row";
      row.innerHTML =
        '<div class="person-row-title"><strong>Individual ' +
        n +
        '</strong><button type="button" class="remove-person" aria-label="Remove individual">Remove</button></div><div class="person-fields"><label>Name <b>*</b><input name="personName" required value="' +
        esc(person.name) +
        '" placeholder="Full name"></label><label>Address / Location <b>*</b><input name="personAddress" required value="' +
        esc(person.address) +
        '" placeholder="Known address or location"></label><label>Relationship (optional)<input name="personRelationship" value="' +
        esc(person.relationship) +
        '" placeholder="e.g. Neighbor"></label></div>';
      people.append(row);
    }
    if (!people.children.length) addPerson();
    function collect() {
      const fields = {};
      [...form.elements].forEach((field) => {
        if (field.name && !field.name.startsWith("person"))
          fields[field.name] = field.value;
      });
      const persons = [...people.querySelectorAll(".person-row")]
        .map((row) => ({
          name: row.querySelector('[name="personName"]').value,
          address: row.querySelector('[name="personAddress"]').value,
          relationship: row.querySelector('[name="personRelationship"]').value,
        }))
        .filter((person) => person.name || person.address || person.relationship);
      return { fields, people: persons };
    }
    form.addEventListener("input", () => save(DRAFT_KEY, collect()));
    form.addEventListener("change", () => save(DRAFT_KEY, collect()));
    document
      .querySelector("#addPerson")
      .addEventListener("click", () => addPerson());
    people.addEventListener("click", (event) => {
      const remove = event.target.closest(".remove-person");
      if (!remove) return;
      remove.closest(".person-row").remove();
      [...people.children].forEach(
        (row, index) =>
          (row.querySelector(".person-row-title strong").textContent =
            "Individual " + (index + 1)),
      );
      save(DRAFT_KEY, collect());
    });
    document.querySelector("#clearWalkin").addEventListener("click", () => {
      if (!confirm("Clear all entered complaint details?")) return;
      form.reset();
      people.innerHTML = "";
      addPerson();
      localStorage.removeItem(DRAFT_KEY);
      document.querySelector("#walkinError").hidden = true;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) {
        document.querySelector("#walkinError").hidden = false;
        return;
      }
      document.querySelector("#walkinError").hidden = true;
      save(DRAFT_KEY, collect());
      location.href = "review-complaint.html";
    });
  }

  if (document.body.dataset.page === "review") {
    const draft = read(DRAFT_KEY, null);
    if (!draft) {
      location.replace("record-walkin.html");
      return;
    }
    const f = draft.fields || {};
    const set = (id, value) => {
      document.getElementById(id).textContent = value || "—";
    };
    set("reviewName", f.fullName);
    set("reviewContact", f.contactNumber);
    set("reviewAddress", f.completeAddress);
    set("reviewPurok", f.purok);
    set("reviewCategory", f.category);
    set(
      "reviewIncidentDate",
      (f.incidentDate || "") + " " + (f.incidentTime || ""),
    );
    set("reviewLocation", f.incidentLocation);
    set("reviewSubmission", "Walk-In");
    set("reviewDescription", f.description);
    set("reviewAdditional", f.additionalInformation);
    set("reviewInternal", f.internalNotes);
    document.querySelector("#reviewAdditionalBlock").hidden =
      !f.additionalInformation;
    document.querySelector("#reviewInternalBlock").hidden = !f.internalNotes;
    const personHost = document.querySelector("#reviewPeople");
    personHost.innerHTML =
      (draft.people || [])
        .filter(
          (person) => person.name || person.address || person.relationship,
        )
        .map(
          (person, index) =>
            '<div class="review-person"><i>' +
            (index + 1) +
            "</i><span><strong>" +
            esc(person.name) +
            "</strong> — " +
            esc(person.address) +
            (person.relationship
              ? " <em>(" + esc(person.relationship) + ")</em>"
              : "") +
            "</span></div>",
        )
        .join("") ||
      '<p class="review-muted">No additional individuals listed.</p>';
    document
      .querySelector("#editDetails")
      .addEventListener("click", () => (location.href = "record-walkin.html"));
    let registering = false;
    document
      .querySelector("#registerComplaint")
      .addEventListener("click", () => {
        if (registering) return;
        registering = true;
        const registered = allRecords();
        const currentYear = new Date().getFullYear();
        let counter = Number(localStorage.getItem(COUNTER_KEY) || 1);
        const prefix = "BC-" + currentYear + "-";
        registered.forEach((item) => {
          const ref = String(item.reference || "");
          if (ref.startsWith(prefix)) {
            const number = Number(ref.slice(prefix.length));
            if (Number.isFinite(number))
              counter = Math.max(counter, number + 1);
          }
        });
        let reference;
        do {
          reference =
            "BC-" + currentYear + "-" + String(counter++).padStart(4, "0");
        } while (registered.some((item) => item.reference === reference));
        localStorage.setItem(COUNTER_KEY, String(counter));
        const record = {
          reference,
          fullName: f.fullName,
          contactNumber: f.contactNumber,
          completeAddress: f.completeAddress,
          purok: f.purok,
          category: f.category,
          incidentLocation: f.incidentLocation,
          incidentDate: f.incidentDate,
          incidentTime: f.incidentTime,
          people: draft.people || [],
          description: f.description,
          additionalInformation: f.additionalInformation,
          internalNotes: f.internalNotes,
          submissionMethod: "Walk-In",
          recordedBy: "Maria Santos",
          registrationTimestamp: new Date().toISOString(),
          dateRegistered: new Intl.DateTimeFormat("en-PH", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date()),
          resident: f.fullName,
          residentType: f.purok,
          date: new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date()),
          status: "Submitted",
          assigned: "Maria Santos",
          label: "Walk-in complaint",
          notes: f.description,
        };
        registered.unshift(record);
        save(RECORDS_KEY, registered);
        save(LAST_KEY, record);
        localStorage.removeItem(DRAFT_KEY);
        location.href = "complaint-success.html";
      });
  }

  if (document.body.dataset.page === "success") {
    const record = read(LAST_KEY, null);
    if (!record) {
      document.querySelector("#successMissing").hidden = false;
      return;
    }
    document.querySelectorAll("[data-confirmation]").forEach((node) => {
      node.textContent = record[node.dataset.confirmation] || "—";
    });
    document.querySelector("#successReference").textContent = record.reference;
    document.querySelector("#printReference").textContent = record.reference;
    document.querySelector("[data-print=fullName]").textContent =
      record.fullName || record.resident || "—";
    document.querySelector("[data-print=category]").textContent =
      record.category || "—";
    document.querySelector("[data-print-date]").textContent =
      record.dateRegistered || "";
    document.querySelector("#successDate").textContent =
      record.dateRegistered ||
      new Date(record.registrationTimestamp).toLocaleString();
    document
      .querySelector("#printConfirmation")
      .addEventListener("click", () => window.print());
    document
      .querySelector("#returnComplaints")
      .addEventListener(
        "click",
        () =>
          (location.href =
            "complaint-details.html?reference=" + encodeURIComponent(record.reference)),
      );
  }

  if (document.body.dataset.page === "request-information") {
    const records = allRecords();
    const reference = new URLSearchParams(location.search).get("reference");
    const record = records.find((item) => item.reference === reference);
    if (!record) {
      location.replace("complaints.html");
      return;
    }
    const draftKey = "barangayInformationRequestDrafts";
    const drafts = read(draftKey, {});
    const draft = drafts[record.reference] || {};
    const form = document.querySelector("#informationRequestForm");
    const field = {
      reason: document.querySelector("#requestReason"),
      information: document.querySelector("#requestedInformation"),
      requestDate: document.querySelector("#requestDate"),
      deadline: document.querySelector("#responseDeadline"),
      message: document.querySelector("#residentNotification"),
    };
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value || "—";
    };
    const name = record.resident || record.fullName || "—";
    const currentStatus = record.status || "None";
    const statusClass = ({
      Submitted:"submitted", "New Submission":"submitted", "For Review":"review",
      "Under Review":"review", "For Verification":"verification", "For Hearing":"hearing",
      "For Additional Information":"verification", Resolved:"resolved", Referred:"referred",
    })[currentStatus] || "submitted";
    set("requestReference", record.reference);
    set("requestResident", name);
    set("requestCategory", record.category);
    set("requestSubmitted", record.dateRegistered || record.date);
    set("requestDescription", record.description || record.notes || "No complaint description was recorded.");
    const statusPill = document.querySelector("#requestCurrentStatus");
    statusPill.textContent = currentStatus;
    statusPill.className = "request-status-pill " + statusClass;
    if (draft.reason) field.reason.value = draft.reason;
    if (draft.information) field.information.value = draft.information;
    field.requestDate.value = draft.requestDate || "";
    field.deadline.value = draft.deadline || "";
    if (draft.message) field.message.value = draft.message;
    if (Array.isArray(draft.missingInfo)) {
      document.querySelectorAll('input[name="missingInfo"]').forEach((check) => {
        check.checked = draft.missingInfo.includes(check.value);
      });
    }
    function collectRequest() {
      return {
        reason: field.reason.value,
        information: field.information.value.trim(),
        requestDate: field.requestDate.value,
        deadline: field.deadline.value,
        message: field.message.value.trim(),
        missingInfo: [...document.querySelectorAll('input[name="missingInfo"]:checked')].map((check) => check.value),
      };
    }
    function renderPreviousRequests() {
      const body = document.querySelector("#previousRequestsBody");
      const requests = Array.isArray(record.informationRequests) ? record.informationRequests : [];
      const rows = [];
      if (record.reference === "BC-2025-0042") {
        rows.push({ date:"March 17, 2025", information:"Clear copy of resident identification", status:"Provided" });
      }
      requests.slice().reverse().forEach((item) => rows.push({
        date:item.requestDateLabel || item.requestDate || "—",
        information:item.information || (item.missingInfo || []).join(", ") || item.reason,
        status:item.status || "Pending",
      }));
      body.innerHTML = rows.length
        ? rows.map((item) => '<tr><td>' + esc(item.date) + '</td><td>' + esc(item.information) + '</td><td><span class="' + (item.status === "Provided" ? "request-provided-pill" : "request-pending-pill") + '">' + esc(item.status) + '</span></td></tr>').join("")
        : '<tr><td colspan="3" class="request-empty-row">No earlier information requests for this complaint.</td></tr>';
    }
    renderPreviousRequests();
    document.querySelector("#saveInformationDraft").addEventListener("click", () => {
      drafts[record.reference] = collectRequest();
      save(draftKey, drafts);
      notice("Information request draft saved.");
    });
    const requestOverlay = document.querySelector("#requestModalOverlay");
    const confirmRequestDialog = document.querySelector("#requestConfirmDialog");
    const requestSuccessDialog = document.querySelector("#requestSuccessDialog");
    let pendingRequest = null;
    let requestCommitted = false;
    function closeRequestConfirmation() {
      if (requestCommitted) return;
      requestOverlay.hidden = true;
      document.body.style.overflow = "";
    }
    document.querySelector("#cancelRequestConfirm").addEventListener("click", closeRequestConfirmation);
    document.querySelector("#closeRequestConfirm").addEventListener("click", closeRequestConfirmation);
    requestOverlay.addEventListener("click", (event) => {
      if (event.target === requestOverlay) closeRequestConfirmation();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !requestOverlay.hidden && !requestCommitted)
        closeRequestConfirmation();
    });
    document.querySelector("#viewUpdatedRequest").addEventListener("click", () => {
      location.href = "complaint-details.html?reference=" + encodeURIComponent(record.reference);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const request = collectRequest();
      if (!request.missingInfo.length || !request.information || !request.message) {
        document.querySelector("#requestValidation").hidden = false;
        return;
      }
      document.querySelector("#requestValidation").hidden = true;
      pendingRequest = request;
      document.querySelector("#confirmRequestReference").textContent = record.reference;
      document.querySelector("#confirmRequestDeadline").textContent = request.deadline
        ? new Date(request.deadline + "T12:00:00").toLocaleDateString("en-PH", { month:"long", day:"numeric", year:"numeric" })
        : "No deadline selected";
      requestSuccessDialog.hidden = true;
      confirmRequestDialog.hidden = false;
      requestOverlay.hidden = false;
      document.body.style.overflow = "hidden";
    });
    document.querySelector("#confirmAndSendRequest").addEventListener("click", () => {
      if (!pendingRequest || requestCommitted) return;
      const request = pendingRequest;
      const requestedAt = new Date();
      const dateLabel = request.requestDate
        ? new Date(request.requestDate + "T12:00:00").toLocaleDateString("en-PH", { month:"long", day:"numeric", year:"numeric" })
        : requestedAt.toLocaleDateString("en-PH", { month:"long", day:"numeric", year:"numeric" });
      request.requestDateLabel = dateLabel;
      request.requestedAt = requestedAt.toISOString();
      request.requestedBy = "Maria Santos";
      request.status = "Pending";
      if (!Array.isArray(record.informationRequests)) record.informationRequests = [];
      record.informationRequests.push(request);
      record.status = "For Additional Information";
      record.lastInformationRequest = request;
      const events = Array.isArray(record.activityHistory) ? record.activityHistory : [{
        title:"Complaint Submitted", by:record.recordedBy || "System Record",
        detail:(record.category || "Complaint") + " complaint submitted by the resident.",
        date:record.dateRegistered || record.date || "",
      }];
      events.push({
        title:"Additional information requested", by:"Maria Santos",
        detail:"Requested " + request.missingInfo.join(", ") + " from " + name + ".",
        date:dateLabel + " · " + requestedAt.toLocaleTimeString("en-PH", { hour:"numeric", minute:"2-digit" }),
      });
      record.activityHistory = events;
      save(RECORDS_KEY, records);
      delete drafts[record.reference];
      save(draftKey, drafts);
      requestCommitted = true;
      confirmRequestDialog.hidden = true;
      requestSuccessDialog.hidden = false;
      requestOverlay.hidden = false;
    });
  }

  if (document.body.dataset.page === "update-status") {
    const records = allRecords();
    const reference = new URLSearchParams(location.search).get("reference");
    const record = records.find((item) => item.reference === reference);
    if (!record) {
      location.replace("complaints.html");
      return;
    }
    const draftKey = "barangayComplaintStatusDrafts";
    const drafts = read(draftKey, {});
    const draft = drafts[record.reference] || {};
    const currentStatus = record.status || "None";
    const name = record.resident || record.fullName || "—";
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value || "—";
    };
    const statusClass = (value) => ({
      Submitted: "submitted", "New Submission": "submitted", "For Review": "review",
      "Under Review": "review", "For Verification": "verification", "For Hearing": "hearing",
      "For Additional Information": "verification", Resolved: "resolved", Referred: "referred",
    })[value] || "submitted";
    set("updateReference", record.reference);
    set("updateResident", name);
    set("updateCategory", record.category);
    set("updateDate", record.dateRegistered || record.date);
    set("updateLocation", record.incidentLocation || record.purok || record.residentType);
    set("updateAssigned", record.assigned || record.recordedBy || "Maria Santos");
    const currentBadge = document.querySelector("#currentStatusBadge");
    currentBadge.textContent = currentStatus;
    currentBadge.className = "status " + statusClass(currentStatus);
    const fromNode = document.querySelector("#transitionFrom");
    fromNode.textContent = currentStatus;
    fromNode.className = "transition-state " + statusClass(currentStatus);
    const form = document.querySelector("#statusUpdateForm");
    const controls = {
      newStatus: document.querySelector("#newComplaintStatus"),
      summary: document.querySelector("#actionSummary"),
      actionDate: document.querySelector("#actionDate"),
      assignee: document.querySelector("#actionAssignee"),
      remarks: document.querySelector("#actionRemarks"),
      notify: document.querySelector("#notifyResident"),
      message: document.querySelector("#residentMessage"),
      acknowledgmentNotes: document.querySelector("#acknowledgmentNotes"),
    };
    controls.newStatus.value = draft.newStatus || "";
    controls.summary.value = draft.summary || "";
    controls.actionDate.value = draft.actionDate || new Date().toISOString().slice(0, 10);
    controls.assignee.value = draft.assignee || record.assigned || "Maria Santos";
    controls.remarks.value = draft.remarks || "";
    controls.notify.checked = draft.notify !== false;
    controls.message.value = draft.message || "";
    controls.acknowledgmentNotes.value = draft.acknowledgmentNotes || "";
    const channelInput = document.querySelector('input[name="channel"][value="' + (draft.channel || "In-Person") + '"]');
    if (channelInput) channelInput.checked = true;
    const ackInput = document.querySelector('input[name="acknowledgment"][value="' + (draft.acknowledgment || "Acknowledged") + '"]');
    if (ackInput) ackInput.checked = true;
    const updateTransition = () => {
      const next = controls.newStatus.value || "None";
      const node = document.querySelector("#transitionTo");
      node.textContent = next;
      node.className = "transition-state next " + (controls.newStatus.value ? statusClass(next) : "");
    };
    controls.newStatus.addEventListener("change", updateTransition);
    updateTransition();
    const fileInput = document.querySelector("#supportingDocument");
    if (draft.documentName) set("uploadPrompt", draft.documentName);
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) set("uploadPrompt", fileInput.files[0].name);
    });
    function collectStatusForm() {
      return {
        newStatus: controls.newStatus.value,
        summary: controls.summary.value.trim(),
        actionDate: controls.actionDate.value,
        assignee: controls.assignee.value,
        remarks: controls.remarks.value.trim(),
        notify: controls.notify.checked,
        channel: document.querySelector('input[name="channel"]:checked')?.value || "In-Person",
        message: controls.message.value.trim(),
        acknowledgment: document.querySelector('input[name="acknowledgment"]:checked')?.value || "Acknowledged",
        acknowledgmentNotes: controls.acknowledgmentNotes.value.trim(),
        documentName: fileInput.files[0]?.name || draft.documentName || "",
      };
    }
    const timeline = document.querySelector("#statusHistory");
    const history = Array.isArray(record.activityHistory) && record.activityHistory.length
      ? record.activityHistory
      : [
          { title: "Complaint Submitted", by: record.recordedBy || "System Record", detail: (record.category || "Complaint") + " complaint submitted by the resident.", date: record.dateRegistered || record.date || "" },
          ...(!["Submitted", "New Submission", "None"].includes(currentStatus) ? [{ title: "Complaint Reviewed", by: "Maria Santos", detail: "Complaint details and supporting information were reviewed.", date: record.date || "" }] : []),
          ...(currentStatus === "For Hearing" ? [{ title: "Hearing Scheduled", by: "Maria Santos", detail: "Initial mediation hearing was scheduled and the resident was notified.", date: record.date || "" }] : []),
          ...(currentStatus === "Resolved" ? [{ title: "Complaint Resolved", by: "Maria Santos", detail: "The concern was resolved and the resident record was updated.", date: record.date || "" }] : []),
        ];
    timeline.innerHTML = history.map((item) => "<li><strong>" + esc(item.title || "Status updated") + "</strong><small>" + esc(item.date || "") + "</small><p><b>" + esc(item.by || "Maria Santos") + "</b> · " + esc(item.detail || "") + "</p></li>").join("");
    const detailsUrl = "complaint-details.html?reference=" + encodeURIComponent(record.reference);
    document.querySelector("#backToComplaintDetails").href = detailsUrl;
    document.querySelector("#saveStatusDraft").addEventListener("click", () => {
      drafts[record.reference] = collectStatusForm();
      save(draftKey, drafts);
      notice("Status update draft saved.");
    });
    const statusOverlay = document.querySelector("#statusModalOverlay");
    const confirmDialog = document.querySelector("#confirmStatusDialog");
    const successDialog = document.querySelector("#statusSuccessDialog");
    let pendingStatusUpdate = null;
    let statusCommitted = false;
    function closeStatusConfirmation() {
      if (!statusCommitted) {
        statusOverlay.hidden = true;
        document.body.style.overflow = "";
      }
    }
    document.querySelector("#cancelStatusConfirm").addEventListener("click", closeStatusConfirmation);
    document.querySelector("#closeStatusConfirm").addEventListener("click", closeStatusConfirmation);
    statusOverlay.addEventListener("click", (event) => {
      if (event.target === statusOverlay) closeStatusConfirmation();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !statusOverlay.hidden && !statusCommitted)
        closeStatusConfirmation();
    });
    document.querySelector("#returnToComplaintManagement").addEventListener("click", () => {
      location.href = "complaints.html?reference=" + encodeURIComponent(record.reference);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!controls.newStatus.value) {
        document.querySelector("#statusValidation").hidden = false;
        controls.newStatus.focus();
        return;
      }
      document.querySelector("#statusValidation").hidden = true;
      pendingStatusUpdate = collectStatusForm();
      const previous = document.querySelector("#confirmPreviousStatus");
      previous.textContent = currentStatus;
      previous.className = "status-confirm-pill " + statusClass(currentStatus);
      const next = document.querySelector("#confirmNewStatus");
      next.textContent = pendingStatusUpdate.newStatus;
      next.className = "status-confirm-pill " + statusClass(pendingStatusUpdate.newStatus);
      successDialog.hidden = true;
      confirmDialog.hidden = false;
      statusOverlay.hidden = false;
      document.body.style.overflow = "hidden";
    });
    document.querySelector("#confirmStatusUpdate").addEventListener("click", () => {
      if (!pendingStatusUpdate || statusCommitted) return;
      const values = pendingStatusUpdate;
      const transitionAt = new Date();
      const actionDate = values.actionDate
        ? new Date(values.actionDate + "T12:00:00").toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" })
        : transitionAt.toLocaleDateString("en-PH", { month:"short", day:"numeric", year:"numeric" });
      record.status = values.newStatus;
      record.assigned = values.assignee;
      record.lastStatusUpdate = {
        from: currentStatus, to: values.newStatus, actionSummary: values.summary,
        actionDate: values.actionDate, remarks: values.remarks, notify: values.notify,
        channel: values.channel, message: values.message,
        acknowledgment: values.acknowledgment, acknowledgmentNotes: values.acknowledgmentNotes,
        documentName: values.documentName,
      };
      const events = Array.isArray(record.activityHistory) ? record.activityHistory : history;
      events.push({
        title: values.summary || ("Status updated to " + values.newStatus),
        by: "Maria Santos",
        detail: "Status changed from " + currentStatus + " to " + values.newStatus + "." + (values.remarks ? " " + values.remarks : ""),
        date: actionDate + " · " + transitionAt.toLocaleTimeString("en-PH", { hour:"numeric", minute:"2-digit" }),
      });
      record.activityHistory = events;
      save(RECORDS_KEY, records);
      delete drafts[record.reference];
      save(draftKey, drafts);
      statusCommitted = true;
      confirmDialog.hidden = true;
      successDialog.hidden = false;
      document.querySelector("#successStatusReference").textContent = record.reference;
      statusOverlay.hidden = false;
    });
  }

  if (document.body.dataset.page === "edit-complaint") {
    const records = allRecords();
    const reference = new URLSearchParams(location.search).get("reference");
    const record = records.find((item) => item.reference === reference);
    const form = document.querySelector("#editComplaintForm");
    const detailUrl = "complaint-details.html?reference=" + encodeURIComponent(reference || "");
    const fieldMap = {
      fullName: ["editFullName", "Full Name"],
      contactNumber: ["editContactNumber", "resident's contact number"],
      completeAddress: ["editCompleteAddress", "complete address"],
      purok: ["editPurok", "Purok / Location"],
      category: ["editCategory", "complaint category"],
      incidentLocation: ["editIncidentLocation", "incident location"],
      incidentDate: ["editIncidentDate", "incident date"],
      incidentTime: ["editIncidentTime", "incident time"],
      description: ["editDescription", "complaint description"],
    };
    const byId = (id) => document.getElementById(id);
    const stagedFiles = new Map();
    const removedIds = new Set();
    let initialValues = {};
    let baseFiles = [];
    const idFor = (file) => file.storageId || file.id;
    const formatSize = (size) => typeof size === "number" ? (size / 1024 / 1024).toFixed(2) + " MB" : size || "Attachment";
    if (!record) {
      byId("editFormError").hidden = false;
      byId("editFormError").textContent = "The requested complaint could not be found. Return to Complaint Management and open a complaint.";
      form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((node) => node.disabled = true);
      byId("cancelEdit").href = "complaints.html";
    } else {
      const address = record.completeAddress || "";
      const purok = record.purok || (record.residentType !== "Poblacion resident" ? record.residentType : "") || "";
      const values = {
        fullName: record.fullName || record.resident || "",
        contactNumber: record.contactNumber || "",
        completeAddress: address,
        purok,
        category: record.category || "",
        incidentLocation: record.incidentLocation || "",
        incidentDate: record.incidentDate || "",
        incidentTime: record.incidentTime || "",
        description: record.description || record.notes || "",
      };
      Object.entries(fieldMap).forEach(([key, [id]]) => { byId(id).value = values[key]; });
      if (values.category && ![...byId("editCategory").options].some((option) => option.value === values.category)) {
        const option = document.createElement("option");
        option.value = values.category;
        option.textContent = values.category;
        byId("editCategory").append(option);
        byId("editCategory").value = values.category;
      }
      initialValues = { ...values };
      baseFiles = complaintFiles(record);
      byId("detailsBreadcrumb").href = detailUrl;
      byId("cancelEdit").href = detailUrl;
      byId("editReference").textContent = record.reference;
      byId("editSubmittedAt").textContent = record.dateRegistered || record.date || record.registrationTimestamp || "—";
      byId("editSubmissionMethod").textContent = record.submissionMethod || "Resident submission";
      byId("editOriginalStatus").textContent = record.status || "Submitted";

      const isDirty = () => {
        const changedField = Object.entries(fieldMap).some(([key, [id]]) => byId(id).value.trim() !== String(initialValues[key] || "").trim());
        return changedField || stagedFiles.size > 0 || removedIds.size > 0;
      };
      const closeDiscard = () => {
        byId("discardModal").hidden = true;
        document.body.style.overflow = "";
      };
      const renderFiles = () => {
        const host = byId("editAttachmentList");
        host.replaceChildren();
        const files = [
          ...baseFiles.filter((file) => !removedIds.has(idFor(file))).map((file) => ({ ...file, sourceId: idFor(file) })),
          ...[...stagedFiles.entries()].map(([id, file]) => ({ id, name: file.name, type: file.type, size: file.size, sourceId: id, pending: true })),
        ];
        byId("editNoAttachments").hidden = files.length > 0;
        files.forEach((file) => {
          const row = document.createElement("div");
          row.className = "edit-attachment";
          const icon = document.createElement("span");
          icon.className = "edit-attachment-icon";
          icon.textContent = file.type?.startsWith("image/") ? "▧" : "▤";
          const meta = document.createElement("span");
          meta.className = "edit-attachment-meta";
          const name = document.createElement("strong");
          name.textContent = file.name;
          const small = document.createElement("small");
          small.textContent = formatSize(file.size);
          meta.append(name, small);
          const actions = document.createElement("span");
          actions.className = "edit-attachment-actions";
          const view = document.createElement("button");
          view.type = "button";
          view.textContent = "View / Preview";
          view.addEventListener("click", async () => {
            try {
              const blob = file.pending ? stagedFiles.get(file.sourceId) : file.storageId ? await getAttachment(file.storageId) : null;
              const url = blob ? URL.createObjectURL(blob) : file.url;
              if (!url) return notice("This sample attachment has no preview file.");
              window.open(url, "_blank", "noopener");
              if (blob) setTimeout(() => URL.revokeObjectURL(url), 60000);
            } catch {
              notice("This attachment could not be opened.");
            }
          });
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "remove-attachment";
          remove.textContent = "Remove";
          remove.addEventListener("click", () => {
            if (file.pending) stagedFiles.delete(file.sourceId);
            else removedIds.add(file.sourceId);
            renderFiles();
          });
          actions.append(view, remove);
          row.append(icon, meta, actions);
          host.append(row);
        });
      };
      renderFiles();
      byId("editAttachments").addEventListener("change", (event) => {
        byId("errorAttachments").hidden = true;
        [...event.currentTarget.files].forEach((file) => {
          const validType = file.type.startsWith("image/") || /\.(pdf|doc|docx)$/i.test(file.name);
          if (!validType || file.size > 10 * 1024 * 1024) {
            byId("errorAttachments").hidden = false;
            byId("errorAttachments").textContent = "Choose an image, PDF, DOC, or DOCX file no larger than 10 MB.";
            return;
          }
          const id = "new-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
          stagedFiles.set(id, file);
        });
        event.currentTarget.value = "";
        renderFiles();
      });
      Object.entries(fieldMap).forEach(([key, [id]]) => {
        byId(id).addEventListener("input", () => {
          const field = byId(id).closest(".edit-field");
          field?.classList.remove("invalid");
          const error = byId("error" + key[0].toUpperCase() + key.slice(1));
          if (error) error.hidden = true;
          byId("editFormError").hidden = true;
        });
      });
      const validate = () => {
        let valid = true;
        Object.entries(fieldMap).forEach(([key, [id]]) => {
          const input = byId(id);
          const empty = !input.value.trim();
          const preservedLegacyBlank = empty && !String(initialValues[key] || "").trim();
          const invalid = (empty && !preservedLegacyBlank) || (!empty && !input.checkValidity());
          const error = byId("error" + key[0].toUpperCase() + key.slice(1));
          input.closest(".edit-field")?.classList.toggle("invalid", invalid);
          if (error) error.hidden = !invalid;
          if (invalid) valid = false;
        });
        byId("editFormError").hidden = valid;
        return valid;
      };
      byId("cancelEdit").addEventListener("click", (event) => {
        event.preventDefault();
        if (!isDirty()) return location.assign(detailUrl);
        byId("discardModal").hidden = false;
        document.body.style.overflow = "hidden";
        byId("continueEditing").focus();
      });
      byId("continueEditing").addEventListener("click", closeDiscard);
      byId("closeDiscard").addEventListener("click", closeDiscard);
      byId("discardChanges").addEventListener("click", () => location.assign(detailUrl));
      byId("discardModal").addEventListener("click", (event) => {
        if (event.target === byId("discardModal")) closeDiscard();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !byId("discardModal").hidden) closeDiscard();
      });
      const saveConfirmModal = byId("saveConfirmModal");
      const closeSaveConfirm = () => {
        saveConfirmModal.hidden = true;
        document.body.style.overflow = "";
        byId("saveConfirmError").hidden = true;
      };
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        byId("confirmComplaintReference").textContent = record.reference;
        byId("confirmResidentName").textContent = byId("editFullName").value.trim() || "—";
        byId("confirmComplaintCategory").textContent = byId("editCategory").value || "—";
        byId("saveConfirmError").hidden = true;
        saveConfirmModal.hidden = false;
        document.body.style.overflow = "hidden";
        byId("cancelSaveConfirm").focus();
      });
      byId("cancelSaveConfirm").addEventListener("click", closeSaveConfirm);
      saveConfirmModal.addEventListener("click", (event) => {
        if (event.target === saveConfirmModal) closeSaveConfirm();
      });
      document.addEventListener("keydown", (event) => {
        if (saveConfirmModal.hidden) return;
        if (event.key === "Escape") closeSaveConfirm();
        if (event.key === "Tab") {
          const controls = [byId("cancelSaveConfirm"), byId("confirmSave")].filter((control) => !control.disabled);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      });
      byId("confirmSave").addEventListener("click", async () => {
        if (!validate()) {
          closeSaveConfirm();
          form.querySelector(".edit-field.invalid input, .edit-field.invalid select, .edit-field.invalid textarea")?.focus();
          return;
        }
        const confirmSave = byId("confirmSave");
        const confirmSaveLabel = confirmSave.querySelector(".confirm-save-label");
        confirmSave.disabled = true;
        confirmSaveLabel.textContent = "Saving…";
        byId("saveConfirmError").hidden = true;
        byId("errorAttachments").hidden = true;
        const values = Object.fromEntries(Object.entries(fieldMap).map(([key, [id]]) => [key, byId(id).value.trim()]));
        const changedLabels = Object.entries(fieldMap).filter(([key]) => values[key] !== String(initialValues[key] || "").trim()).map(([, [, label]]) => label);
        const remainingFiles = baseFiles.filter((file) => !removedIds.has(idFor(file)));
        if (stagedFiles.size || removedIds.size) changedLabels.push("supporting documents");
        if (!changedLabels.length) {
          location.assign(detailUrl + "&updated=1");
          return;
        }
        const newStorageIds = [];
        try {
          const uploaded = [];
          for (const [id, file] of stagedFiles) {
            const storageId = record.reference + ":" + id;
            await putAttachment(storageId, file);
            newStorageIds.push(storageId);
            uploaded.push({ id, storageId, name: file.name, type: file.type || "application/octet-stream", size: file.size, uploadedAt: new Date().toISOString() });
          }
          const history = Array.isArray(record.activityHistory) ? [...record.activityHistory] : [];
          if (!history.length) {
            if (record.reference === "BC-2025-0042") {
              history.push(
                { title: "Complaint Submitted", by: "System Record", detail: "Resident submitted the complaint through the reporting portal.", date: "March 12, 2025 · 6:15 AM" },
                { title: "Complaint Reviewed", by: "Maria Santos", detail: "Complaint information and resident details were reviewed.", date: "March 12, 2025 · 2:40 PM" },
                { title: "Personnel Assigned", by: "Maria Santos", detail: "Assigned to Kagawad Lorenzo Ramos.", date: "March 18, 2025 · 9:05 AM" },
                { title: "Initial hearing scheduled", by: "Maria Santos", detail: "Recorded with status: Scheduled.", date: "March 18, 2025 · 10:20 AM" },
              );
            } else {
              history.push({ title: "Complaint Submitted", by: record.recordedBy || "System Record", detail: "Complaint registered through " + (record.submissionMethod || "resident submission") + ".", date: record.dateRegistered || record.date || "" });
            }
          }
          const changedDescription = changedLabels.length === 1
            ? changedLabels[0]
            : changedLabels.slice(0, -1).join(", ") + " and " + changedLabels[changedLabels.length - 1];
          const now = new Date();
          history.push({ title: "Complaint Details Updated", by: "Maria Santos", detail: "Maria Santos updated " + changedDescription + ".", date: new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(now) });
          const updated = {
            ...record,
            ...values,
            resident: values.fullName,
            fullName: values.fullName,
            description: values.description,
            notes: values.description,
            supportingDocuments: [...remainingFiles, ...uploaded],
            activityHistory: history,
          };
          const nextRecords = records.map((item) => item.reference === record.reference ? updated : item);
          save(RECORDS_KEY, nextRecords);
          await Promise.all(baseFiles.filter((item) => removedIds.has(idFor(item)) && item.storageId).map((item) => removeAttachment(item.storageId).catch(() => {})));
          location.assign(detailUrl + "&updated=1");
        } catch (error) {
          await Promise.all(newStorageIds.map((id) => removeAttachment(id).catch(() => {})));
          confirmSave.disabled = false;
          confirmSaveLabel.textContent = "Confirm & Save";
          byId("errorAttachments").hidden = false;
          byId("errorAttachments").textContent = error?.name === "QuotaExceededError"
            ? "Browser storage is full. Remove an attachment or choose a smaller file."
            : "Changes could not be saved. Check browser storage and try again.";
          byId("saveConfirmError").textContent = error?.name === "QuotaExceededError"
            ? "Browser storage is full. Remove an attachment or choose a smaller file, then try again."
            : "Changes could not be saved. Your edits are still here; please try again.";
          byId("saveConfirmError").hidden = false;
        }
      });
    }
  }

  if (document.body.dataset.page === "complaint-details") {
    // Keep detail panels in step with status updates saved from the management workflow.
    const records = allRecords();
    const ref = new URLSearchParams(location.search).get("reference");
    const record = records.find((item) => item.reference === ref) || records[0];
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value || "—";
    };
    if (!record) {
      set("detailReference", "No complaint selected");
      return;
    }
    const name = record.resident || record.fullName || "—";
    const status = record.status || "Submitted";
    const statusClass = ({
      Submitted: "submitted", "New Submission": "submitted", "For Review": "review",
      "Under Review": "review", "For Verification": "verification", "For Hearing": "hearing",
      "For Additional Information": "verification", Resolved: "resolved", Referred: "referred",
    })[status] || "submitted";
    const submittedDate = record.dateRegistered || record.date || "—";
    set("detailReference", record.reference);
    set("detailReferenceCopy", record.reference);
    set("detailResident", name);
    set("detailDate", submittedDate);
    set("detailCategory", record.category);
    set("detailCurrentStatus", status);
    set("detailLocation", [record.incidentLocation, record.completeAddress || record.purok || record.residentType].filter(Boolean).join(" · "));
    set("detailContact", record.contactNumber || "+63 917 625 1040");
    set("detailSubmission", record.submissionMethod || "Resident submission");
    set("detailDescription", record.description || record.notes || "No complaint description was recorded.");
    const statusNodes = [document.querySelector("#detailStatusTop")];
    statusNodes.forEach((node) => { node.textContent = status; node.className = "status " + statusClass; });
    if (record.additionalInformation) {
      document.querySelector("#extraInformation").hidden = false;
      set("detailAdditional", record.additionalInformation);
    }
    const files = complaintFiles(record);
    const documentList = document.querySelector("#documentList");
    documentList.replaceChildren();
    files.forEach((file) => {
      const row = document.createElement("div");
      row.className = "document-row";
      const icon = document.createElement("span");
      icon.className = "document-icon";
      icon.textContent = "▧";
      const copy = document.createElement("span");
      copy.className = "document-copy";
      const nameNode = document.createElement("strong");
      nameNode.textContent = file.name;
      const meta = document.createElement("small");
      const size = typeof file.size === "number" ? (file.size / 1024 / 1024).toFixed(2) + " MB" : file.size;
      meta.textContent = [file.type || "Attachment", size, file.uploadedAt ? "Uploaded " + new Date(file.uploadedAt).toLocaleDateString() : ""].filter(Boolean).join(" · ");
      copy.append(nameNode, meta);
      const preview = document.createElement("button");
      preview.className = "button button-light";
      preview.type = "button";
      preview.textContent = "View / Preview";
      preview.addEventListener("click", async () => {
        try {
          const blob = file.storageId ? await getAttachment(file.storageId) : null;
          const url = blob ? URL.createObjectURL(blob) : file.url;
          if (!url) return notice("This sample attachment has no preview file.");
          window.open(url, "_blank", "noopener");
          if (blob) setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
          notice("This attachment could not be opened.");
        }
      });
      row.append(icon, copy, preview);
      documentList.append(row);
    });
    document.querySelector("#noDocuments").hidden = files.length > 0;

    const sampleHistory = [
      ["Complaint Submitted", "System Record", "Resident submitted the complaint through the reporting portal.", "March 12, 2025 · 6:15 AM"],
      ["Complaint Reviewed", "Maria Santos", "Complaint information and resident details were reviewed.", "March 12, 2025 · 2:40 PM"],
      ["Personnel Assigned", "Maria Santos", "Assigned to Kagawad Lorenzo Ramos.", "March 18, 2025 · 9:05 AM"],
      ["Initial hearing scheduled", "Maria Santos", "Recorded with status: Scheduled.", "March 18, 2025 · 10:20 AM"],
    ];
    const history = Array.isArray(record.activityHistory) && record.activityHistory.length
      ? record.activityHistory.map((item) => [item.title, item.by, item.detail, item.date])
      : record.reference === "BC-2025-0042" ? sampleHistory
      : [["Complaint Submitted", record.recordedBy || "System Record", "Complaint registered through " + (record.submissionMethod || "resident submission") + ".", submittedDate]];
    document.querySelector("#activityTimeline").innerHTML = history.map((item) =>
      "<li><strong>" + esc(item[0]) + "</strong><small>" + esc(item[3]) + "</small><p><b>" + esc(item[1]) + "</b> · " + esc(item[2]) + "</p></li>"
    ).join("");
    document.querySelector("#editRegisteredDetails").addEventListener("click", () => {
      location.href = "edit-complaint.html?reference=" + encodeURIComponent(record.reference);
    });
    document.querySelector("#modal").addEventListener("click", (event) => {
      if (event.target.id === "modal" || event.target.closest('[data-action="close-modal"]') || event.target.closest(".modal-close")) {
        document.querySelector("#modal").hidden = true;
        document.body.style.overflow = "";
      }
    });
    if (new URLSearchParams(location.search).has("updated")) {
      notice("Complaint details updated successfully.");
      window.history.replaceState(null, "", "complaint-details.html?reference=" + encodeURIComponent(record.reference));
    }
  }

  if (document.body.dataset.page === "complaints") {
    let records = allRecords();
    let selected =
      new URLSearchParams(location.search).get("reference") ||
      records[0]?.reference ||
      "";
    let tab = "All Complaints";
    let newest = null;
    const body = document.querySelector("#complaintRows"),
      query = document.querySelector("#complaintSearch"),
      category = document.querySelector("#categoryFilter"),
      status = document.querySelector("#statusFilter");
    const cls = (value) =>
      ({
        Submitted: "new",
        "New Submission": "new",
        "For Review": "review",
        "Under Review": "review",
        "For Verification": "verify",
        "For Additional Information": "verify",
        "For Hearing": "hearing",
        Resolved: "resolved",
        Referred: "referred",
      })[value] || "submitted";
    function updateSelected() {
      const rec =
        records.find((item) => item.reference === selected) || records[0];
      if (!rec) return;
      selected = rec.reference;
      document.querySelector("#selectedReference").textContent =
        rec.reference + " · " + (rec.resident || rec.fullName);
      document.querySelector("#selectedDescription").textContent =
        (rec.status || "Submitted") +
        " · " +
        (rec.submissionMethod || "Resident submission");
      const updateLink = document.querySelector('[data-complaint-action="update"]');
      if (updateLink)
        updateLink.href = "update-status.html?reference=" + encodeURIComponent(rec.reference);
      const requestLink = document.querySelector('[data-complaint-action="request"]');
      if (requestLink)
        requestLink.href = "request-information.html?reference=" + encodeURIComponent(rec.reference);
    }
    function render() {
      const searchText = query.value.trim().toLowerCase();
      const visible = records
        .filter((rec) => {
          const tabMatch =
            tab === "All Complaints" ||
            (tab === "New Submissions" &&
              ["Submitted", "New Submission"].includes(rec.status)) ||
            (tab === "For Verification" && rec.status === "For Verification") ||
            (tab === "Active Complaints" && rec.status !== "Resolved") ||
            (tab === "Resolved Complaints" && rec.status === "Resolved");
          return (
            tabMatch &&
            (!searchText ||
              (rec.reference + " " + (rec.resident || rec.fullName))
                .toLowerCase()
                .includes(searchText)) &&
            (!category.value || rec.category === category.value) &&
            (!status.value || rec.status === status.value)
          );
        })
        .sort((a, b) =>
          newest === null
            ? 0
            : newest
              ? String(b.reference).localeCompare(String(a.reference))
              : String(a.reference).localeCompare(String(b.reference)),
        );
      body.innerHTML = visible
        .map(
          (rec) =>
            '<tr tabindex="0" data-reference="' +
            esc(rec.reference) +
            '" class="' +
            (rec.reference === selected ? "selected-row" : "") +
            '"><td><strong>' +
            esc(rec.reference) +
            '</strong><span class="cell-sub">' +
            esc(rec.label || "Resident submission") +
            '</span></td><td><span class="cell-primary">' +
            esc(rec.resident || rec.fullName) +
            '</span><span class="cell-sub">' +
            esc(rec.purok || rec.residentType || "Poblacion resident") +
            "</span></td><td>" +
            esc(rec.category) +
            "</td><td>" +
            esc(rec.date || rec.dateRegistered) +
            '</td><td><span class="complaint-status ' +
            cls(rec.status) +
            '">' +
            esc(rec.status) +
            "</span></td><td>" +
            esc(rec.assigned || rec.recordedBy || "Maria Santos") +
            '</td><td><button class="complaint-row-action" type="button" data-delete-reference="' +
            esc(rec.reference) +
            '" aria-label="Delete complaint ' +
            esc(rec.reference) +
            '"><img src="assets/images/complaint-trash-row.svg" alt=""></button></td></tr>',
        )
        .join("");
      document.querySelector("#complaintEmpty").hidden = visible.length > 0;
      updateSelected();
    }
    function openAction(titleText, content, submitText, onSubmit) {
      const modal = document.querySelector("#modal"),
        host = document.querySelector("#modalContent");
      host.innerHTML =
        '<h2 id="modalTitle">' +
        esc(titleText) +
        "</h2>" +
        content +
        '<div class="modal-actions"><button class="button button-light" data-action="close-modal">Cancel</button><button class="button button-primary" id="confirmComplaintAction">' +
        esc(submitText) +
        "</button></div>";
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      document
        .querySelector("#confirmComplaintAction")
        .addEventListener("click", () => {
          onSubmit();
          modal.hidden = true;
          document.body.style.overflow = "";
          render();
        });
    }
    function openDeleteConfirmation(rec) {
      const modal = document.querySelector("#modal");
      const host = document.querySelector("#modalContent");
      modal.classList.add("delete-confirmation");
      host.innerHTML =
        '<div class="delete-dialog-content"><div class="delete-dialog-icon"><img src="assets/images/delete-trash.svg" alt=""></div>' +
        '<h2 id="modalTitle">Delete Complaint?</h2>' +
        '<p class="delete-dialog-copy">Are you sure you want to delete this complaint? This action cannot be undone.</p>' +
        '<div class="delete-dialog-summary"><div><span>Reference Number</span><strong>' +
        esc(rec.reference) +
        '</strong></div><div><span>Resident</span><strong>' +
        esc(rec.resident || rec.fullName) +
        '</strong></div></div><div class="delete-dialog-actions"><button class="delete-cancel" type="button" data-action="close-modal">Cancel</button><button class="delete-confirm" type="button" id="confirmDeleteComplaint"><img src="assets/images/delete-trash-small.svg" alt="">Delete Complaint</button></div></div>';
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      document.querySelector("#confirmDeleteComplaint").addEventListener("click", () => {
        const deleted = new Set(read(DELETED_KEY, []));
        deleted.add(rec.reference);
        save(DELETED_KEY, [...deleted]);
        records = records.filter((item) => item.reference !== rec.reference);
        save(RECORDS_KEY, records);
        selected = records[0]?.reference || "";
        modal.hidden = true;
        modal.classList.remove("delete-confirmation");
        document.body.style.overflow = "";
        render();
        notice("Complaint " + rec.reference + " deleted.");
      });
    }
    document.querySelectorAll("[data-complaint-tab]").forEach((button) =>
      button.addEventListener("click", () => {
        tab = button.dataset.complaintTab;
        document.querySelectorAll("[data-complaint-tab]").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        render();
      }),
    );
    query.addEventListener("input", render);
    category.addEventListener("change", render);
    status.addEventListener("change", render);
    document
      .querySelector("#sortComplaints")
      .addEventListener("click", (event) => {
        newest = newest === true ? false : true;
        event.currentTarget.textContent = newest
          ? "Newest first"
          : "Oldest first";
        render();
      });
    body.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-reference]");
      if (row) {
        const deleteButton = event.target.closest(".complaint-row-action");
        if (deleteButton) {
          event.preventDefault();
          event.stopPropagation();
          const rec = records.find((item) => item.reference === deleteButton.dataset.deleteReference);
          if (rec) openDeleteConfirmation(rec);
          return;
        }
        location.href = "complaint-details.html?reference=" + encodeURIComponent(row.dataset.reference);
      }
    });
    body.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        const row = event.target.closest("tr[data-reference]");
        if (row) {
          event.preventDefault();
          location.href = "complaint-details.html?reference=" + encodeURIComponent(row.dataset.reference);
        }
      }
    });
    document.querySelectorAll("[data-complaint-action]").forEach((button) =>
      button.addEventListener("click", () => {
        const rec = records.find((item) => item.reference === selected);
        if (!rec) return;
        const action = button.dataset.complaintAction;
        if (action === "walkin") {
          location.href = "record-walkin.html";
          return;
        }
        if (action === "request") {
          location.href = "request-information.html?reference=" + encodeURIComponent(rec.reference);
          return;
        }
        if (action === "update") {
          location.href = "update-status.html?reference=" + encodeURIComponent(rec.reference);
          return;
        }
        if (action === "route") {
          location.href = "route-complaint.html?reference=" + encodeURIComponent(rec.reference);
          return;
        }
      }),
    );
    document.querySelector("#modal")?.addEventListener("click", (event) => {
      if (
        event.target.id === "modal" ||
        event.target.closest('[data-action="close-modal"]') ||
        event.target.closest(".modal-close")
      ) {
        event.currentTarget.hidden = true;
        event.currentTarget.classList.remove("delete-confirmation");
        document.body.style.overflow = "";
      }
    });
    document.addEventListener("keydown", (event) => {
      const modal = document.querySelector("#modal");
      if (event.key === "Escape" && modal && !modal.hidden) {
        modal.hidden = true;
        modal.classList.remove("delete-confirmation");
        document.body.style.overflow = "";
      }
    });
    render();
  }

  if (document.body.dataset.page === "route-complaint") {
    const records = allRecords();
    const reference = new URLSearchParams(location.search).get("reference");
    const record = records.find((item) => item.reference === reference) || records[0];
    const form = document.querySelector("#routeComplaintForm");
    const overlay = document.querySelector("#routeConfirmOverlay");
    const confirmContent = document.querySelector("#routeConfirmContent");
    const successContent = document.querySelector("#routeSuccessContent");
    const assignee = document.querySelector("#routeAssignee");
    const priority = document.querySelector("#routePriority");
    const routeDate = document.querySelector("#routeDate");
    const action = document.querySelector("#recommendedAction");
    const notes = document.querySelector("#routingNotes");
    const radios = [...document.querySelectorAll('input[name="routingDecision"]')];
    const draftMessage = document.querySelector("#routeDraftMessage");
    const selectedDecision = () => radios.find((item) => item.checked)?.value || "Forward for Evaluation";
    const officialLabel = () => assignee.value === "Roberto Dela Cruz"
      ? "Hon. Roberto Dela Cruz · Barangay Captain"
      : assignee.value === "Maria Santos"
        ? "Maria Santos · Barangay Secretary"
        : assignee.selectedOptions[0].textContent.trim();
    const setText = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value || "—";
    };
    const getPeople = (value) => {
      if (Array.isArray(value)) return value.map((person) => typeof person === "string" ? person : person.name).filter(Boolean).join(", ");
      return value || "Carlo Mendoza and two unidentified individuals";
    };
    const getDocuments = () => {
      const docs = record.supportingDocuments || record.documents || [];
      if (!docs.length) return '<span class="route-document">incident-video.mp4 <small>8.4 MB</small></span>';
      return (Array.isArray(docs) ? docs : [docs]).map((doc) => {
        const file = typeof doc === "string" ? doc : (doc.name || doc.filename || "Supporting document");
        const href = typeof doc === "object" && doc.url ? doc.url : "#";
        const size = typeof doc === "object" && doc.size ? " · " + esc(doc.size) : "";
        return '<a class="route-document" href="' + esc(href) + '"' + (href === "#" ? ' aria-label="' + esc(file) + '"' : ' target="_blank" rel="noopener"') + '>' + esc(file) + size + '</a>';
      }).join("");
    };
    const dateLabel = (value) => {
      if (!value) return "March 16, 2025 · 10:30 PM";
      const parsed = new Date(value);
      return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    };
    const storedDraft = record.routeDraft || {};
    setText("routeReference", record.reference);
    setText("routeResident", record.resident || record.fullName);
    setText("routeContact", record.contactNumber || "+63 917 625 1840");
    setText("routeCategory", record.category || "Noise / Public Disturbance");
    setText("routeDateSubmitted", record.dateRegistered || record.date || "March 17, 2025");
    setText("routeIncidentDate", dateLabel(record.incidentDateTime || record.incidentDate));
    setText("routeLocation", record.incidentLocation || record.completeAddress || record.purok || "Purok 4, Maharlika Street, Barangay Poblacion");
    setText("routePeople", getPeople(record.personsInvolved));
    setText("routeDescription", record.description || record.notes || "Repeated excessive noise and disruptive behavior were reported near the residence late at night. The resident attempted to resolve the concern directly before submitting this complaint.");
    document.querySelector("#routeDocuments").innerHTML = getDocuments();
    if (storedDraft.assigned) assignee.value = storedDraft.assigned;
    priority.value = storedDraft.priority || "Normal";
    routeDate.value = storedDraft.routingDate || "";
    action.value = storedDraft.recommendedAction || "For Evaluation";
    notes.value = storedDraft.notes || notes.value;
    if (storedDraft.decision) radios.forEach((radio) => { radio.checked = radio.value === storedDraft.decision; });
    const refreshDecisionUI = () => {
      document.querySelectorAll(".decision-option").forEach((label) => label.classList.toggle("selected", label.querySelector("input").checked));
      const words = { "Forward for Evaluation": "Forward Complaint", "Schedule for Hearing": "Schedule Hearing", "Refer for Further Action": "Refer Complaint" };
      document.querySelector("#forwardComplaintButton").innerHTML = esc(words[selectedDecision()]) + " <b>›</b>";
    };
    radios.forEach((radio) => radio.addEventListener("change", refreshDecisionUI));
    refreshDecisionUI();
    const routingData = () => ({ assigned: assignee.value, priority: priority.value, routingDate: routeDate.value, recommendedAction: action.value, notes: notes.value.trim(), decision: selectedDecision() });
    const persist = () => save(RECORDS_KEY, records);
    document.querySelector("#saveRouteDraft").addEventListener("click", () => {
      record.routeDraft = routingData();
      persist();
      draftMessage.hidden = false;
      window.setTimeout(() => { draftMessage.hidden = true; }, 2600);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const draft = routingData();
      setText("confirmRouteReference", record.reference);
      setText("confirmRouteAssignee", officialLabel());
      confirmContent.hidden = false;
      successContent.hidden = true;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      document.querySelector("#confirmRouteComplaint").focus();
    });
    const closeConfirm = () => { overlay.hidden = true; document.body.style.overflow = ""; };
    document.querySelector("#cancelRouteConfirm").addEventListener("click", closeConfirm);
    document.querySelector("#closeRouteConfirm").addEventListener("click", closeConfirm);
    overlay.addEventListener("click", (event) => { if (event.target === overlay && !successContent.hidden) return; if (event.target === overlay) closeConfirm(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.hidden && successContent.hidden) closeConfirm(); });
    document.querySelector("#confirmRouteComplaint").addEventListener("click", () => {
      const route = routingData();
      record.assigned = route.assigned;
      record.routing = { ...route, routedBy: "Maria Santos", routedAt: new Date().toISOString() };
      delete record.routeDraft;
      const nextStatus = route.decision === "Schedule for Hearing" ? "For Hearing" : route.decision === "Refer for Further Action" ? "Referred" : "For Review";
      record.status = nextStatus;
      const history = Array.isArray(record.activityHistory) ? record.activityHistory : [];
      history.push({ title: "Complaint routed", by: "Maria Santos", detail: route.decision + " · Assigned to " + route.assigned + ".", date: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) });
      record.activityHistory = history;
      persist();
      setText("successRouteReference", record.reference);
      confirmContent.hidden = true;
      successContent.hidden = false;
      document.querySelector("#returnToComplaintManagement").focus();
    });
    document.querySelector("#returnToComplaintManagement").addEventListener("click", () => {
      location.href = "complaints.html?reference=" + encodeURIComponent(record.reference);
    });
  }

  const form = document.querySelector("#managementForm");
  if (form)
    form.addEventListener("click", (event) => {
      if (event.target.closest('[data-complaint-action="close"]')) {
        const modal = document.querySelector("#modal");
        modal.hidden = true;
        document.body.style.overflow = "";
      }
    });
})();
