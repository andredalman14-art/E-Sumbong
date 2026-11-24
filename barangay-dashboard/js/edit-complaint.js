document.addEventListener("DOMContentLoaded", async () => {
  const user = requireAuth();
  if (!user) return;

  const params = new URLSearchParams(location.search);
  const reference = params.get("reference") || params.get("ref");
  const detailsUrl = ref => `complaint-details.html?reference=${encodeURIComponent(ref || reference || "")}`;
  const form = document.getElementById("editComplaintForm");
  const errorMessage = document.getElementById("editFormError");
  const saveModal = document.getElementById("saveConfirmModal");
  const discardModal = document.getElementById("discardModal");
  const saveButton = document.getElementById("confirmSave");
  const fields = {
    first_name: "editFirstName",
    last_name: "editLastName",
    contact_number: "editContactNumber",
    resident_address: "editCompleteAddress",
    purok_location: "editPurok",
    category: "editCategory",
    incident_location: "editIncidentLocation",
    incident_date: "editIncidentDate",
    incident_time: "editIncidentTime",
    description: "editDescription",
  };
  const dateInput = value => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.valueOf()) ? String(value).slice(0,10) : d.toISOString().slice(0,10);
  };
  const dateLabel = value => value ? new Date(value).toLocaleString("en-PH", {dateStyle:"medium",timeStyle:"short"}) : "—";
  const setText = (id,value) => { const el=document.getElementById(id); if(el) el.textContent=value || "—"; };
  const currentValues = () => Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,document.getElementById(id)?.value.trim() || ""]));

  document.querySelectorAll(".profile-copy strong,.profile-popover-head b").forEach(el=>el.textContent=user.full_name || user.name || el.textContent);
  document.querySelectorAll(".profile-copy small").forEach(el=>el.textContent=user.role || el.textContent);

  let record;
  let baseline;
  try {
    const response=await fetch(`${API_BASE_URL}/complaints`);
    if(!response.ok) throw new Error("Could not load complaints from the database.");
    const records=await response.json();
    record=records.find(item=>item.reference_number===reference);
    if(!record) throw new Error("The selected complaint could not be found.");
  } catch(error) {
    errorMessage.hidden=false;
    errorMessage.textContent=error.message || "Could not load the selected complaint.";
    form.querySelectorAll("input,select,textarea,button[type='submit']").forEach(el=>el.disabled=true);
    return;
  }

  const nameParts = String(record.resident_name || "").trim().split(/\s+/).filter(Boolean);
  const formValues = {
    first_name: nameParts.shift() || "",
    last_name: nameParts.join(" "),
    contact_number: record.contact_number || "",
    resident_address: record.resident_address || record.complete_address || record.incident_location || "",
    purok_location: record.purok_location || record.purok || record.incident_location || "",
    category: record.category || "",
    incident_location: record.incident_location || "",
    incident_date: dateInput(record.incident_date),
    incident_time: String(record.incident_time || "").slice(0,5),
    description: record.description || "",
  };
  Object.entries(fields).forEach(([key,id])=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(key==="category" && formValues[key] && ![...el.options].some(option=>option.value===formValues[key])) {
      el.add(new Option(formValues[key],formValues[key]));
    }
    el.value=formValues[key];
  });
  baseline={...formValues};
  const detailLink=document.getElementById("detailsBreadcrumb");
  if(detailLink)detailLink.href=detailsUrl(record.reference_number);
  const cancelLink=document.getElementById("cancelEdit");
  if(cancelLink)cancelLink.href=detailsUrl(record.reference_number);
  setText("editReference",record.reference_number);
  setText("editSubmittedAt",dateLabel(record.created_at));
  setText("editSubmissionMethod",record.submission_method || record.submissionMethod || "Online");
  setText("editOriginalStatus",record.status);
  setText("confirmComplaintReference",record.reference_number);

  const dirty=()=>JSON.stringify(currentValues())!==JSON.stringify(baseline);
  const goBack=()=>location.assign(detailsUrl(record.reference_number));
  const openDiscard=()=>{discardModal.hidden=false;};
  const closeSave=()=>{saveModal.hidden=true;};
  const closeDiscard=()=>{discardModal.hidden=true;};
  const errors={
    first_name:["errorFirstName",v=>!!v],
    last_name:["errorLastName",v=>!!v],
    contact_number:["errorContactNumber",v=>!!v],
    resident_address:["errorCompleteAddress",v=>!!v],
    purok_location:["errorPurok",v=>!!v],
    category:["errorCategory",v=>!!v],
    incident_location:["errorIncidentLocation",v=>!!v],
    incident_date:["errorIncidentDate",v=>!!v],
    incident_time:["errorIncidentTime",v=>!!v],
    description:["errorDescription",v=>!!v],
  };
  function validate(){
    const values=currentValues();let valid=true;let first=null;
    Object.entries(errors).forEach(([key,[errorId,predicate]])=>{
      const errorEl=document.getElementById(errorId),input=document.getElementById(fields[key]),bad=!predicate(values[key]);
      if(errorEl)errorEl.hidden=!bad;
      input?.setAttribute("aria-invalid",String(bad));
      if(bad){valid=false;first ||= input;}
    });
    if(errorMessage)errorMessage.hidden=valid;
    if(!valid){closeSave();first?.focus();}
    return valid;
  }
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const values=currentValues();
    setText("confirmResidentName",[values.first_name,values.last_name].filter(Boolean).join(" "));
    setText("confirmComplaintCategory",values.category);
    document.getElementById("saveConfirmError").hidden=true;
    saveModal.hidden=false;
    saveButton.focus();
  });
  document.getElementById("cancelSaveConfirm").addEventListener("click",closeSave);
  saveModal.addEventListener("click",event=>{if(event.target===saveModal)closeSave();});
  document.getElementById("cancelEdit").addEventListener("click",event=>{
    event.preventDefault();
    if(dirty())openDiscard();else goBack();
  });
  document.getElementById("continueEditing").addEventListener("click",closeDiscard);
  document.getElementById("closeDiscard").addEventListener("click",closeDiscard);
  document.getElementById("discardChanges").addEventListener("click",goBack);
  discardModal.addEventListener("click",event=>{if(event.target===discardModal)closeDiscard();});
  saveButton.addEventListener("click",async()=>{
    if(!validate())return;
    const values=currentValues();
      const changed=Object.keys(values).some(key=>values[key]!==baseline[key]);
    if(!changed){closeSave();goBack();return;}
    saveButton.disabled=true;
    saveButton.querySelector(".confirm-save-label").textContent="Saving…";
    const failure=document.getElementById("saveConfirmError");
    failure.hidden=true;
    try{
      const response=await fetch(`${API_BASE_URL}/complaints/${record.complaint_id}/details`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...values,resident_name:[values.first_name,values.last_name].filter(Boolean).join(" "),updated_by:user.personnel_id})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error || "Could not save complaint changes.");
      sessionStorage.setItem("complaintDetailsUpdated","Complaint details updated successfully.");
      location.assign(detailsUrl(record.reference_number));
    }catch(error){
      failure.textContent=error.message || "Could not save complaint changes. Please try again.";
      failure.hidden=false;
    }finally{
      saveButton.disabled=false;
      saveButton.querySelector(".confirm-save-label").textContent="Confirm & Save";
    }
  });
});

