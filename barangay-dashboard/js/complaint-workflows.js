(() => {
  document.addEventListener("DOMContentLoaded", async () => {
    const page = document.body.dataset.page;
    if (!["request-information", "update-status", "route-complaint"].includes(page)) return;
    const user = typeof requireAuth === "function" ? requireAuth() : null;
    if (!user) return;
    const ref = new URLSearchParams(location.search).get("ref") || new URLSearchParams(location.search).get("reference");
    const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || "—"; };
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const date = value => value ? new Date(value).toLocaleDateString(undefined, {month:"short",day:"numeric",year:"numeric"}) : "—";
    const safe = value => value || "—";
    const response = await fetch(`${API_BASE_URL}/complaints`);
    if (!response.ok) throw new Error("Unable to load complaint records.");
    const records = await response.json();
    const complaint = records.find(item => item.reference_number === ref);
    if (!complaint) {
      document.querySelector(".content")?.prepend(Object.assign(document.createElement("p"), {className:"workflow-record-error", textContent:"Complaint record could not be found. Return to Complaint Management and select a complaint."}));
      return;
    }

    const name = user.full_name || user.name || "Maria Santos";
    document.querySelectorAll(".profile-copy strong, .profile-popover-head b").forEach(el => el.textContent = name);
    if (page === "request-information") {
      text("requestReference", complaint.reference_number); text("requestResident", complaint.resident_name);
      text("requestCategory", complaint.category); text("requestSubmitted", date(complaint.created_at));
      text("requestCurrentStatus", complaint.status); text("requestDescription", complaint.description);
      const logsResponse = await fetch(`${API_BASE_URL}/activity-logs?complaint_id=${complaint.complaint_id}`).catch(() => null);
      if (logsResponse?.ok) {
        const logs = await logsResponse.json();
        const requests = logs.filter(log => /information requested/i.test(log.activity || ""));
        const body = document.getElementById("previousRequestsBody");
        if (body) body.innerHTML = requests.length ? requests.map(log => `<tr><td>${date(log.created_at)}</td><td>${(log.remarks || "Additional information requested").split("\n")[0].replace(/^Reason: /,"")}</td><td>${safe(log.new_status)}</td></tr>`).join("") : '<tr><td colspan="3">No previous information requests.</td></tr>';
      }
      const form = document.getElementById("informationRequestForm");
      const overlay = document.getElementById("requestModalOverlay");
      const confirm = document.getElementById("confirmAndSendRequest");
      const close = () => { if (overlay) overlay.hidden = true; };
      ["closeRequestConfirm","cancelRequestConfirm"].forEach(id => document.getElementById(id)?.addEventListener("click", close));
      form?.addEventListener("submit", event => {
        event.preventDefault();
        const missing = [...form.querySelectorAll('[name="missingInfo"]:checked')].map(input => input.value);
        const info = document.getElementById("requestedInformation")?.value.trim();
        const validation = document.getElementById("requestValidation");
        if (!missing.length || !info) { if (validation) validation.hidden = false; return; }
        if (validation) validation.hidden = true;
        text("confirmRequestReference", complaint.reference_number);
        text("confirmRequestDeadline", document.getElementById("responseDeadline")?.value || "No deadline selected");
        if (overlay) overlay.hidden = false;
      });
      confirm?.addEventListener("click", async () => {
        confirm.disabled = true; confirm.textContent = "Sending…";
        try {
          const result = await fetch(`${API_BASE_URL}/complaints/${complaint.complaint_id}/information-requests`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({reason:document.getElementById("requestReason")?.value, information:document.getElementById("requestedInformation")?.value, missing_items:[...form.querySelectorAll('[name="missingInfo"]:checked')].map(i=>i.value), request_date:document.getElementById("requestDate")?.value, response_deadline:document.getElementById("responseDeadline")?.value, notification_message:document.getElementById("residentNotification")?.value, updated_by:user.personnel_id})
          });
          if (!result.ok) throw new Error((await result.json()).error || "Could not send request.");
          close(); document.getElementById("requestSuccessDialog").hidden = false;
        } catch (error) { alert(error.message || "Could not save the information request."); }
        finally { confirm.disabled = false; confirm.textContent = "Confirm & Send"; }
      });
      document.getElementById("viewUpdatedRequest")?.addEventListener("click", () => location.assign(`complaint-details.html?reference=${encodeURIComponent(complaint.reference_number)}`));
    }

    if (page === "update-status") {
      text("updateReference", complaint.reference_number); text("updateResident", complaint.resident_name);
      text("updateCategory", complaint.category); text("updateDate", date(complaint.created_at));
      text("updateLocation", complaint.incident_location); text("updateAssigned", complaint.assigned_personnel_name);
      text("currentStatusBadge", complaint.status); text("transitionFrom", complaint.status);
      const dateInput = document.getElementById("actionDate"); if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
      const peopleResponse = await fetch(`${API_BASE_URL}/personnel`).catch(()=>null);
      if (peopleResponse?.ok) {
        const people = await peopleResponse.json(), select = document.getElementById("actionAssignee");
        if (select) select.innerHTML = people.map(p => `<option value="${p.personnel_id}" ${p.personnel_id===complaint.assigned_to?"selected":""}>${p.full_name}</option>`).join("");
      }
      const newStatus = document.getElementById("newComplaintStatus");
      const overlay = document.getElementById("statusModalOverlay");
      const close = () => { if (overlay) overlay.hidden=true; };
      ["closeStatusConfirm","cancelStatusConfirm"].forEach(id=>document.getElementById(id)?.addEventListener("click",close));
      newStatus?.addEventListener("change",()=>{text("transitionTo",newStatus.value || "None"); text("confirmPreviousStatus",complaint.status); text("confirmNewStatus",newStatus.value || "None");});
      document.getElementById("statusUpdateForm")?.addEventListener("submit",event=>{
        event.preventDefault();
        const validation=document.getElementById("statusValidation");
        if(!newStatus?.value){if(validation)validation.hidden=false;return;}
        if(validation)validation.hidden=true;
        text("confirmStatusReference",complaint.reference_number); text("confirmPreviousStatus",complaint.status); text("confirmNewStatus",newStatus.value);
        if(overlay)overlay.hidden=false;
      });
      document.getElementById("confirmStatusUpdate")?.addEventListener("click",async event=>{
        const button=event.currentTarget;button.disabled=true;button.textContent="Updating…";
        try {
          const payload={status:newStatus.value, action_summary:document.getElementById("actionSummary")?.value, action_date:dateInput?.value, assigned_to:Number(document.getElementById("actionAssignee")?.value)||null, remarks:document.getElementById("actionRemarks")?.value, channel:document.querySelector('[name="channel"]:checked')?.value, notify_resident:document.getElementById("notifyResident")?.checked, resident_message:document.getElementById("residentMessage")?.value, acknowledgment:document.querySelector('[name="acknowledgment"]:checked')?.value, acknowledgment_notes:document.getElementById("acknowledgmentNotes")?.value, updated_by:user.personnel_id};
          const result=await fetch(`${API_BASE_URL}/complaints/${complaint.complaint_id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
          if(!result.ok)throw new Error((await result.json()).error||"Could not update status.");
          close();text("successStatusReference",complaint.reference_number);document.getElementById("statusSuccessDialog").hidden=false;
        } catch(error){alert(error.message||"Could not update complaint status.");}
        finally{button.disabled=false;button.innerHTML="Confirm Update";}
      });
      document.getElementById("returnToComplaintManagement")?.addEventListener("click",()=>location.assign(`complaints.html?ref=${encodeURIComponent(complaint.reference_number)}`));
    }

    if (page === "route-complaint") {
      text("routeReference",complaint.reference_number); text("routeResident",complaint.resident_name);
      text("routeContact",complaint.contact_number); text("routeCategory",complaint.category);
      text("routeDateSubmitted",date(complaint.created_at));
      text("routeIncidentDate", [date(complaint.incident_date),complaint.incident_time].filter(Boolean).join(" · "));
      text("routeLocation",complaint.incident_location); text("routePeople",complaint.persons_involved);
      text("routeDescription",complaint.description);
      const peopleResponse=await fetch(`${API_BASE_URL}/personnel`).catch(()=>null);
      const personnelRows=peopleResponse?.ok ? await peopleResponse.json() : [];
      const routeAssignee=document.getElementById("routeAssignee");
      const hearingAssignee=document.getElementById("hearingPersonnel");
      if(personnelRows.length){
        const options=personnelRows.map(p=>`<option value="${p.personnel_id}" ${Number(p.personnel_id)===Number(complaint.assigned_to)?"selected":""}>${escapeHtml(p.role)} · ${escapeHtml(p.full_name)}</option>`).join("");
        if(routeAssignee)routeAssignee.innerHTML=options;
        if(hearingAssignee)hearingAssignee.innerHTML=`<option value="">Select Personnel</option>${options}`;
      }
      const documentList = complaint.supporting_documents || complaint.attachments || [];
      const documentTarget = document.getElementById("routeDocuments");
      if (documentTarget) {
        const docs = Array.isArray(documentList) ? documentList : [];
        documentTarget.innerHTML = docs.length
          ? docs.map(file => {
              const label = typeof file === "string" ? file : (file.name || file.filename || "Attachment");
              const href = typeof file === "string" ? file : (file.url || file.path || "#");
              return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
            }).join(" · ")
          : "No supporting documents attached.";
      }
      const overlay=document.getElementById("routeConfirmOverlay");
      const dialog=overlay?.querySelector(".route-confirm-dialog");
      const routeConfirm=document.getElementById("routeConfirmContent");
      const routeSuccess=document.getElementById("routeSuccessContent");
      const scheduleForm=document.getElementById("scheduleHearingContent");
      const review=document.getElementById("hearingReviewContent");
      const conflict=document.getElementById("hearingConflictContent");
      const hearingSuccess=document.getElementById("hearingSuccessSummary");
      const hearingActions=document.getElementById("hearingSuccessActions");
      let savedHearingId=null;
      const showState=state=>{
        if(routeConfirm)routeConfirm.hidden=state!=="route";
        if(routeSuccess)routeSuccess.hidden=state!=="route-success"&&state!=="hearing-success";
        if(scheduleForm)scheduleForm.hidden=state!=="schedule";
        if(review)review.hidden=state!=="review";
        if(conflict)conflict.hidden=state!=="conflict";
        if(state==="schedule")dialog?.classList.add("schedule-hearing-dialog");
        else dialog?.classList.remove("schedule-hearing-dialog");
        if(state==="review")dialog?.classList.add("hearing-review-dialog");
        else dialog?.classList.remove("hearing-review-dialog");
        if(state==="conflict")dialog?.classList.add("hearing-conflict-dialog");
        else dialog?.classList.remove("hearing-conflict-dialog");
        if(state==="hearing-success")dialog?.classList.add("hearing-success-dialog");
        else dialog?.classList.remove("hearing-success-dialog");
        if(overlay)overlay.hidden=false;
      };
      const closeOverlay=()=>{if(overlay)overlay.hidden=true;};
      const decisionInputs=[...document.querySelectorAll('[name="routingDecision"]')];
      const scheduleButton=document.getElementById("forwardComplaintButton");
      function updateDecision(){
        const schedule=document.querySelector('[name="routingDecision"]:checked')?.value==="Schedule for Hearing";
        if(scheduleButton)scheduleButton.innerHTML=schedule?'Schedule Hearing <b>›</b>':'Forward Complaint <b>›</b>';
      }
      decisionInputs.forEach(input=>input.addEventListener("change",updateDecision));
      updateDecision();
      document.getElementById("routeComplaintForm")?.addEventListener("submit",event=>{
        event.preventDefault();
        const decision=document.querySelector('[name="routingDecision"]:checked')?.value||"Forward for Evaluation";
        if(decision==="Schedule for Hearing"){
          text("scheduleReference",complaint.reference_number);text("scheduleResident",complaint.resident_name);text("scheduleCategory",complaint.category);
          const availability=document.getElementById("hearingAvailability");if(availability){availability.hidden=true;availability.textContent="";}
          showState("schedule");return;
        }
        text("confirmRouteReference",complaint.reference_number);
        text("confirmRouteAssignee",routeAssignee?.selectedOptions[0]?.textContent);
        showState("route");
      });
      ["closeRouteConfirm","cancelRouteConfirm","closeScheduleHearing","cancelScheduleHearing"].forEach(id=>document.getElementById(id)?.addEventListener("click",closeOverlay));
      overlay?.addEventListener("click",event=>{if(event.target===overlay)closeOverlay();});
      document.getElementById("confirmRouteComplaint")?.addEventListener("click",async event=>{
        const button=event.currentTarget;button.disabled=true;button.textContent="Forwarding…";
        try{
          const decision=document.querySelector('[name="routingDecision"]:checked')?.value||"Forward for Evaluation";
          const result=await fetch(`${API_BASE_URL}/complaints/${complaint.complaint_id}/route`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assigned_to:Number(routeAssignee?.value),status:decision==="Refer for Further Action"?"Referred":"Under Review",decision,routing_notes:document.getElementById("routingNotes")?.value,updated_by:user.personnel_id})});
          if(!result.ok)throw new Error((await result.json()).error||"Could not route complaint.");
          text("successRouteReference",complaint.reference_number);showState("route-success");
        }catch(error){alert(error.message||"Could not route complaint.");}
        finally{button.disabled=false;button.textContent="Confirm & Forward";}
      });
      const localDate=value=>{if(!value)return "—";const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);const parsed=match?new Date(+match[1],+match[2]-1,+match[3],12):new Date(value);return Number.isNaN(parsed.valueOf())?String(value):parsed.toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric"});};
      const localTime=value=>{if(!value)return "—";const [hour,minute]=value.split(":").map(Number);const d=new Date();d.setHours(hour,minute,0,0);return d.toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"});};
      function fillHearingReview(){
        const dateValue=document.getElementById("hearingDate")?.value,timeValue=document.getElementById("hearingTime")?.value;
        text("reviewHearingReference",complaint.reference_number);text("reviewHearingResident",complaint.resident_name);
        text("reviewHearingType",document.getElementById("hearingType")?.value);
        text("reviewHearingDateTime",`${localDate(dateValue)} · ${localTime(timeValue)}`);
        text("reviewHearingLocation",document.getElementById("hearingLocation")?.value);
        text("reviewHearingPersonnel",hearingAssignee?.selectedOptions[0]?.textContent);
        text("reviewHearingNotification",document.getElementById("notifyResidentHearing")?.checked?"In-App and SMS":"Not sent");
      }
      document.getElementById("checkHearingAvailability")?.addEventListener("click",async event=>{
        const button=event.currentTarget, dateValue=document.getElementById("hearingDate")?.value, timeValue=document.getElementById("hearingTime")?.value, personnelId=Number(hearingAssignee?.value), locationValue=document.getElementById("hearingLocation")?.value;
        const availability=document.getElementById("hearingAvailability");
        if(!dateValue||!timeValue||!personnelId){if(availability){availability.textContent="Select a hearing date, time, and assigned personnel.";availability.hidden=false;}return;}
        button.disabled=true;button.textContent="Checking…";
        try{
          const response=await fetch(`${API_BASE_URL}/hearings/check-availability`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({hearing_date:dateValue,hearing_time:timeValue,hearing_location:locationValue,assigned_personnel_id:personnelId})});
          const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not check hearing availability.");
          if(result.available){fillHearingReview();showState("review");return;}
          const item=result.conflict||{};
          text("conflictSelectedDate",localDate(dateValue));text("conflictSelectedTime",localTime(timeValue));
          text("conflictSelectedPersonnel",item.personnel_name||hearingAssignee?.selectedOptions[0]?.textContent);
          text("conflictReference",item.reference_number);text("conflictType",item.hearing_type||"Hearing Appointment");
          text("conflictDateTime",`${localDate(item.hearing_date||dateValue)} · ${localTime(item.hearing_time)}`);text("conflictLocation",item.hearing_location);
          showState("conflict");
        }catch(error){if(availability){availability.textContent=error.message||"Could not check availability. Try again.";availability.hidden=false;}}
        finally{button.disabled=false;button.textContent="Check Availability";}
      });
      document.getElementById("backToHearingForm")?.addEventListener("click",()=>showState("schedule"));
      ["cancelHearingConflict","chooseAnotherHearing"].forEach(id=>document.getElementById(id)?.addEventListener("click",()=>showState("schedule")));
      document.getElementById("confirmHearingSchedule")?.addEventListener("click",async event=>{
        const button=event.currentTarget;button.disabled=true;button.textContent="Saving…";
        try{
          const response=await fetch(`${API_BASE_URL}/hearings`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({complaint_id:complaint.complaint_id,hearing_type:document.getElementById("hearingType")?.value,hearing_date:document.getElementById("hearingDate")?.value,hearing_time:document.getElementById("hearingTime")?.value,hearing_location:document.getElementById("hearingLocation")?.value,assigned_personnel_id:Number(hearingAssignee?.value),notify_resident:document.getElementById("notifyResidentHearing")?.checked,additional_instructions:document.getElementById("hearingInstructions")?.value,updated_by:user.personnel_id})});
          const saved=await response.json();if(!response.ok)throw new Error(saved.error||"Could not save the hearing schedule.");
          savedHearingId=saved.hearing_id;text("successRouteReference",complaint.reference_number);
          text("routeSuccessTitle","Hearing Scheduled Successfully");
          const successCopy=document.querySelector("#routeSuccessContent > p");if(successCopy)successCopy.textContent="The complaint status is now For Hearing and the schedule has been added to the hearing calendar.";
          text("successHearingDateTime",`${localDate(saved.hearing_date||document.getElementById("hearingDate")?.value)} · ${localTime(saved.hearing_time||document.getElementById("hearingTime")?.value)}`);
          text("successHearingLocation",saved.hearing_location||document.getElementById("hearingLocation")?.value);
          text("successHearingNotification",saved.notify_resident?"Pending":"Not requested");
          text("successHearingComplaintStatus","For Hearing");
          if(routeSuccess)routeSuccess.hidden=false;if(hearingSuccess)hearingSuccess.hidden=false;
          document.getElementById("returnToComplaintManagement").hidden=true;if(hearingActions)hearingActions.hidden=false;
          showState("hearing-success");
        }catch(error){const availability=document.getElementById("hearingAvailability");if(availability){availability.textContent=error.message||"Could not save the hearing schedule.";availability.hidden=false;}showState("schedule");}
        finally{button.disabled=false;button.textContent="Confirm Schedule";}
      });
      document.getElementById("viewHearingCalendar")?.addEventListener("click",()=>location.assign(`hearing-calendar.html?hearingId=${encodeURIComponent(savedHearingId||"")}&reference=${encodeURIComponent(complaint.reference_number)}`));
      document.getElementById("viewHearingDetails")?.addEventListener("click",()=>location.assign(`hearing-details.html?hearingId=${encodeURIComponent(savedHearingId||"")}&reference=${encodeURIComponent(complaint.reference_number)}`));
      document.getElementById("returnToComplaintManagement")?.addEventListener("click",()=>location.assign(`complaints.html?ref=${encodeURIComponent(complaint.reference_number)}`));
      document.getElementById("saveRouteDraft")?.addEventListener("click",()=>{localStorage.setItem(`route-draft-${complaint.complaint_id}`,JSON.stringify({assigned_to:document.getElementById("routeAssignee")?.value,notes:document.getElementById("routingNotes")?.value}));alert("Routing draft saved on this device.");});
    }
  });
})();
