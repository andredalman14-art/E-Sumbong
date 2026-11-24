(() => {
  const KEY = "barangayComplaintRecords";
  const pageSize = 6;
  const rows = document.querySelector("#activityRows");
  const search = document.querySelector("#activitySearch");
  const actionSelect = document.querySelector("#actionFilter");
  const personnelSelect = document.querySelector("#personnelFilter");
  const dateInput = document.querySelector("#dateFilter");
  const empty = document.querySelector("#activityEmpty");
  const summary = document.querySelector("#recordSummary");
  const pager = document.querySelector("#pagination");
  let page = 1;
  let applied = { query:"", action:"", person:"", date:"" };
  const examples = [
    {reference:"BC-2026-0048",activity:"New online complaint received through the resident portal.",action:"Complaint Received",personnel:"System",previous:"—",next:"Submitted",date:"3/11/2026, 9:30 AM"},
    {reference:"BC-2026-0047",activity:"Requested exact incident location and contact details from resident.",action:"Missing Details Requested",personnel:"Maria Santos",previous:"Submitted",next:"For Verification",date:"3/10/2026, 12:15 PM"},
    {reference:"BC-2026-0046",activity:"Complaint verified and forwarded to Barangay Captain for determination.",action:"Routed to Captain",personnel:"Maria Santos",previous:"For Verification",next:"Under Review",date:"3/9/2026, 2:40 PM"},
    {reference:"BC-2026-0045",activity:"Initial mediation hearing scheduled at Barangay Session Hall.",action:"Hearing Scheduled",personnel:"Maria Santos",previous:"Under Review",next:"For Hearing",date:"3/8/2026, 10:00 AM"},
    {reference:"BC-2026-0044",activity:"Hearing postponed due to schedule conflict; resident notified via Phone Call.",action:"Hearing Rescheduled",personnel:"Maria Santos",previous:"For Hearing",next:"Rescheduled",date:"3/7/2026, 4:30 PM"},
    {reference:"BC-2026-0042",activity:"Mediation completed and resident acknowledged resolution in person.",action:"Status & Notice Updated",personnel:"Maria Santos",previous:"For Hearing",next:"Resolved",date:"3/5/2026, 3:15 PM"},
  ];
  const esc = (v) => String(v ?? "—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const asDate = value => { const d=new Date(String(value||"").replace(/\s*[·•]\s*/," ")); return Number.isNaN(d.getTime()) ? null : d; };
  function loadRecords(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}}
  function makeData(){
    const records=loadRecords(), items=[];
    records.forEach(record=>{
      const history=Array.isArray(record.activityHistory)?record.activityHistory:[];
      history.forEach(event=>{
        const original=String(event.title||"Complaint Submitted");
        const detail=String(event.detail||original);
        const statusMatch=detail.match(/(?:status changed from|from) (.+?) to (.+?)(?:\.|$)/i);
        items.push({reference:record.reference||record.referenceNumber||"—",activity:detail,action:original,personnel:event.by||"Maria Santos",previous:event.previousStatus||statusMatch?.[1]||"—",next:event.newStatus||statusMatch?.[2]||record.status||"—",date:event.date||record.dateRegistered||record.date||""});
      });
      if(!history.length){items.push({reference:record.reference||"—",activity:`${record.category||"Complaint"} complaint submitted by the resident.`,action:"Complaint Received",personnel:record.recordedBy||"System",previous:"—",next:record.status||"Submitted",date:record.dateRegistered||record.date||""});}
    });
    return items.length?items.sort((a,b)=>(asDate(b.date)?.getTime()||0)-(asDate(a.date)?.getTime()||0)):examples;
  }
  let data=makeData();
  function options(select,values,label){const keep=select.value;select.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(values.includes(keep))select.value=keep;}
  function populateFilters(){options(actionSelect,[...new Set(data.map(x=>x.action))].sort(),"All Actions");options(personnelSelect,[...new Set(data.map(x=>x.personnel))].sort(),"All Staff");}
  function getFiltered(){return data.filter(item=>{
    const hay=[item.reference,item.activity,item.action,item.personnel].join(" ").toLowerCase();
    if(applied.query&&!hay.includes(applied.query.toLowerCase()))return false;
    if(applied.action&&item.action!==applied.action)return false;
    if(applied.person&&item.personnel!==applied.person)return false;
    if(applied.date){const chosen=applied.date, d=asDate(item.date);if(!d||d.toISOString().slice(0,10)!==chosen)return false;}
    return true;
  });}
  function initials(name){return name==="System"?"SY":name.split(/\s+/).map(s=>s[0]).join("").slice(0,2).toUpperCase();}
  function render(){const list=getFiltered(), pages=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(page,pages);const start=(page-1)*pageSize, visible=list.slice(start,start+pageSize);rows.innerHTML=visible.map(item=>`<tr><td>${esc(item.reference)}</td><td>${esc(item.activity)}</td><td>${esc(item.action)}</td><td><span class="personnel"><span class="personnel-avatar">${esc(initials(item.personnel))}</span>${esc(item.personnel)}</span></td><td><span class="status-pill" data-status="${esc(item.previous)}">${esc(item.previous)}</span></td><td><span class="status-pill" data-status="${esc(item.next)}">${esc(item.next)}</span></td><td>${esc(item.date)}</td></tr>`).join("");empty.hidden=visible.length>0;summary.textContent=list.length?`Showing ${start+1}–${start+visible.length} of ${list.length} auditable records`:"Showing 0 auditable records";pager.innerHTML="";const add=(label,target,current=false,disabled=false)=>{const b=document.createElement("button");b.textContent=label;b.classList.toggle("current",current);b.disabled=disabled;b.setAttribute("aria-label",label==="‹"?"Previous page":label==="›"?"Next page":"Page "+label);b.onclick=()=>{page=target;render()};pager.append(b)};add("‹",Math.max(1,page-1),false,page===1);const nums=pages<=5?Array.from({length:pages},(_,i)=>i+1):[1,2,3,pages];let last=0;nums.forEach(n=>{if(n>last+1){const span=document.createElement("span");span.textContent="…";pager.append(span)}add(String(n),n,n===page);last=n});add("›",Math.min(pages,page+1),false,page===pages);}
  document.querySelector("#applyFilters").addEventListener("click",()=>{applied={query:search.value.trim(),action:actionSelect.value,person:personnelSelect.value,date:dateInput.value};page=1;render()});
  search.addEventListener("keydown",e=>{if(e.key==="Enter")document.querySelector("#applyFilters").click()});
  const exportButton=document.querySelector("#exportButton"), menu=document.querySelector("#exportMenu");
  exportButton.addEventListener("click",()=>{menu.hidden=!menu.hidden;exportButton.setAttribute("aria-expanded",String(!menu.hidden))});
  document.addEventListener("click",e=>{if(!e.target.closest(".export-wrap")){menu.hidden=true;exportButton.setAttribute("aria-expanded","false")}});
  function downloadCsv(){const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const body=[ ["Reference","Activity","Action","Personnel","Previous","New","Date & Time"],...getFiltered().map(x=>[x.reference,x.activity,x.action,x.personnel,x.previous,x.next,x.date]) ].map(row=>row.map(quote).join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+body],{type:"text/csv;charset=utf-8"}));a.download="complaint-activity-log.csv";a.click();URL.revokeObjectURL(a.href);}
  document.querySelectorAll("[data-export]").forEach(btn=>btn.addEventListener("click",()=>{menu.hidden=true;if(btn.dataset.export==="csv")downloadCsv();else window.print()}));
  populateFilters();render();
})();
