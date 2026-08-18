
document.querySelector(".menu")?.addEventListener("click",()=>document.querySelector(".side").classList.toggle("open"));
function filterRows(id,q){q=q.toLowerCase();document.querySelectorAll("#"+id+" tbody tr").forEach(r=>r.hidden=!r.innerText.toLowerCase().includes(q))}
