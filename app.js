(() => {
  const $ = (id) => document.getElementById(id);
  const number = (value) => Number(value || 0);
  const fmt = (value) => number(value).toLocaleString("th-TH");
  let allRows = [];
  let refreshTimer = null;
  let currentScript = null;

  function normalizeRow(row) {
    const get = (...keys) => {
      for (const key of keys) if (row[key] !== undefined) return row[key];
      return "";
    };
    return {
      "ปี": number(get("ปี", "year", "Year")),
      "อำเภอ": String(get("อำเภอ", "district", "District") || ""),
      "หมู่บ้าน/ชุมชน": number(get("หมู่บ้าน/ชุมชน", "หมู่บ้าน", "ชุมชน", "villages")),
      "ผู้ป่วยเข้ารับบำบัด": number(get("ผู้ป่วยเข้ารับบำบัด", "ผู้เข้ารับบำบัด", "จำนวนผู้ป่วย", "patients", "total"))
    };
  }

  function setStatus(message, live = false) {
    $("connectionLabel").textContent = message;
    $("connectionLabel").previousElementSibling.style.background = live ? "#71e0bb" : "#f4c36a";
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `sisaketCallback_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("หมดเวลารอข้อมูลจาก Google Apps Script"));
      }, 20000);
      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
        if (currentScript === script) currentScript = null;
      }
      window[callbackName] = (payload) => {
        cleanup();
        if (payload && payload.success === false) reject(new Error(payload.error || "API error"));
        else resolve(payload);
      };
      script.onerror = () => { cleanup(); reject(new Error("เชื่อมต่อ Apps Script ไม่สำเร็จ")); };
      script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}&t=${Date.now()}`;
      currentScript = script;
      document.head.appendChild(script);
    });
  }

  async function loadData() {
    const apiUrl = (window.APP_CONFIG?.API_URL || "").trim();
    if (!apiUrl) {
      allRows = (window.SAMPLE_DATA || []).map(normalizeRow);
      setStatus("ข้อมูลตัวอย่าง · ยังไม่ได้ตั้งค่า API", false);
      $("lastUpdated").textContent = "โหมดตัวอย่าง";
      render();
      return;
    }
    $("refreshBtn").disabled = true;
    $("refreshBtn").textContent = "กำลังโหลด…";
    try {
      const payload = await jsonp(apiUrl);
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error("รูปแบบข้อมูลจาก API ไม่ถูกต้อง");
      allRows = rows.map(normalizeRow).filter(r => r["อำเภอ"]);
      setStatus("เชื่อมต่อ Google Sheets แล้ว", true);
      $("lastUpdated").textContent = `อัปเดต ${new Date().toLocaleTimeString("th-TH")}`;
      render();
    } catch (error) {
      console.error(error);
      setStatus(`เชื่อมต่อไม่สำเร็จ: ${error.message}`, false);
      $("lastUpdated").textContent = "ใช้ข้อมูลตัวอย่างแทน";
      if (!allRows.length) allRows = (window.SAMPLE_DATA || []).map(normalizeRow);
      render();
    } finally {
      $("refreshBtn").disabled = false;
      $("refreshBtn").textContent = "↻ รีเฟรช";
    }
  }

  function filteredRows() {
    const year = $("yearFilter").value;
    const district = $("districtFilter").value;
    const search = $("searchInput").value.trim().toLowerCase();
    return allRows.filter(row =>
      (year === "all" || String(row["ปี"]) === year) &&
      (district === "all" || row["อำเภอ"] === district) &&
      row["อำเภอ"].toLowerCase().includes(search)
    );
  }

  function fillFilters() {
    const years = [...new Set(allRows.map(r => String(r["ปี"])))].filter(Boolean).sort();
    const districts = [...new Set(allRows.map(r => r["อำเภอ"]))].filter(Boolean).sort((a,b) => a.localeCompare(b,"th"));
    const yearValue = $("yearFilter").value || "all";
    const districtValue = $("districtFilter").value || "all";
    $("yearFilter").innerHTML = '<option value="all">ทุกปี</option>' + years.map(y => `<option value="${y}">${y}</option>`).join("");
    $("districtFilter").innerHTML = '<option value="all">ทุกอำเภอ</option>' + districts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
    $("yearFilter").value = years.includes(yearValue) ? yearValue : "all";
    $("districtFilter").value = districts.includes(districtValue) ? districtValue : "all";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }

  function drawBarChart(canvas, entries) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width = Math.max(320, canvas.clientWidth * devicePixelRatio);
    const h = canvas.height = 310 * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const width = w / devicePixelRatio, height = 310;
    ctx.clearRect(0,0,width,height);
    const left = 105, right = 12, top = 10, rowH = 26;
    const max = Math.max(1, ...entries.map(x => x.value));
    ctx.font = '11px "Noto Sans Thai", Tahoma, sans-serif';
    entries.forEach((item, i) => {
      const y = top + i * rowH;
      const barW = (width-left-right) * item.value / max;
      ctx.fillStyle = "#718594"; ctx.textAlign = "right";
      ctx.fillText(item.label.length > 13 ? item.label.slice(0,13)+"…" : item.label, left-10, y+14);
      ctx.fillStyle = "#168f83";
      ctx.beginPath(); ctx.roundRect(left,y,Math.max(2,barW),15,5); ctx.fill();
      ctx.fillStyle = "#193344"; ctx.textAlign = "left";
      ctx.fillText(fmt(item.value), Math.min(width-32,left+barW+5), y+13);
    });
  }

  function drawLineChart(canvas, entries) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width = Math.max(320, canvas.clientWidth * devicePixelRatio);
    const h = canvas.height = 310 * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const width = w / devicePixelRatio, height = 310;
    ctx.clearRect(0,0,width,height);
    if (!entries.length) return;
    const left=48,right=22,top=25,bottom=48, max=Math.max(1,...entries.map(x=>x.value));
    ctx.font = '11px "Noto Sans Thai", Tahoma, sans-serif';
    ctx.strokeStyle="#e2eaf0"; ctx.fillStyle="#738594";
    for(let i=0;i<4;i++){ const y=height-bottom-(height-top-bottom)*i/3; ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(fmt(Math.round(max*i/3)),left-8,y+4); }
    const points=entries.map((e,i)=>({x: entries.length===1?(left+width-right)/2:left+i*(width-left-right)/(entries.length-1), y:height-bottom-(height-top-bottom)*e.value/max, ...e}));
    ctx.strokeStyle="#168f83";ctx.lineWidth=3;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    points.forEach(p=>{ctx.fillStyle="#168f83";ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#193344";ctx.textAlign="center";ctx.fillText(fmt(p.value),p.x,p.y-12);ctx.fillStyle="#738594";ctx.fillText(p.label,p.x,height-18);});
  }

  function render() {
    fillFilters();
    const rows = filteredRows();
    const total = rows.reduce((s,r)=>s+r["ผู้ป่วยเข้ารับบำบัด"],0);
    const villages = rows.reduce((s,r)=>s+r["หมู่บ้าน/ชุมชน"],0);
    const districts = new Set(rows.map(r=>r["อำเภอ"])).size;
    const avg = rows.length ? Math.round(total/rows.length) : 0;
    const kpis = [
      ["ผู้ป่วยเข้ารับบำบัด",total,"รวมตามตัวกรอง"],
      ["หมู่บ้าน/ชุมชน",villages,"ผลรวมจากรายการข้อมูล"],
      ["อำเภอที่มีข้อมูล",districts,"จำนวนอำเภอไม่ซ้ำ"],
      ["เฉลี่ยต่อรายการ",avg,"ผู้เข้ารับบำบัด / รายการ"]
    ];
    $("kpiGrid").innerHTML = kpis.map((k,i)=>`<article class="kpi"><div class="kpi-accent" style="${i===1?"background:#d69e2e":""}"></div><div class="kpi-label">${k[0]}</div><div class="kpi-value">${fmt(k[1])}</div><div class="kpi-note">${k[2]}</div></article>`).join("");

    const byDistrict = {};
    rows.forEach(r => byDistrict[r["อำเภอ"]] = (byDistrict[r["อำเภอ"]]||0)+r["ผู้ป่วยเข้ารับบำบัด"]);
    const top = Object.entries(byDistrict).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,10);
    drawBarChart($("districtChart"),top);

    const byYear = {};
    rows.forEach(r => byYear[r["ปี"]] = (byYear[r["ปี"]]||0)+r["ผู้ป่วยเข้ารับบำบัด"]);
    drawLineChart($("yearChart"),Object.entries(byYear).map(([label,value])=>({label,value})).sort((a,b)=>Number(a.label)-Number(b.label)));

    $("dataRows").innerHTML = rows.slice().sort((a,b)=>b["ปี"]-a["ปี"]||a["อำเภอ"].localeCompare(b["อำเภอ"],"th")).map(r=>
      `<tr><td><span class="year-pill">${escapeHtml(r["ปี"])}</span></td><td>${escapeHtml(r["อำเภอ"])}</td><td class="numeric">${fmt(r["หมู่บ้าน/ชุมชน"])}</td><td class="numeric"><b>${fmt(r["ผู้ป่วยเข้ารับบำบัด"])}</b></td></tr>`
    ).join("") || '<tr><td colspan="4" class="empty">ไม่พบข้อมูล</td></tr>';
    $("rowCount").textContent = `แสดง ${fmt(rows.length)} จาก ${fmt(allRows.length)} รายการ`;
  }

  ["yearFilter","districtFilter"].forEach(id => $(id).addEventListener("change",render));
  $("searchInput").addEventListener("input",render);
  $("refreshBtn").addEventListener("click",loadData);
  $("resetBtn").addEventListener("click",()=>{$("yearFilter").value="all";$("districtFilter").value="all";$("searchInput").value="";render();});
  window.addEventListener("resize",()=>render());
  loadData();
  const interval = Number(window.APP_CONFIG?.REFRESH_INTERVAL_MS || 15000);
  if (interval > 0) refreshTimer = setInterval(loadData,interval);
})();
