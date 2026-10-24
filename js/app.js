(()=>{
  const D = window.DB;
  const A = window.Auth;
  const app = document.querySelector("#app");
  const toastEl = document.querySelector("#toast");
  let page = "dashboard", search = "", dept = "all", chat = [];

  const $ = s => document.querySelector(s);
  const esc = s => String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const time = () => new Date().toTimeString().slice(0,5);
  const mins = t => { let [h,m] = (t||"0:0").split(":").map(Number); return h*60+m; };
  const money = n => new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(+n||0);
  const date = s => s ? new Date(s+"T12:00:00").toLocaleDateString() : "—";
  const initial = s => String(s||"?").split(" ").slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const me = () => A ? A.current() : null;
  const admin = () => me()?.role === "admin";
  const users = () => D ? D.users() : [];
  const emps = () => users().filter(x => x.role === "employee");
  const att = () => D ? D.attendance() : [];
  const leaves = () => D ? D.leaves() : [];
  const c = () => D ? D.company() : null;
  const working = d => ((c()?.workingDays)|| [1,2,3,4,5]).includes(new Date(d+"T12:00:00").getDay());
  const days = (a,b) => {
    let n = 0, d = new Date(a+"T12:00:00"), e = new Date(b+"T12:00:00");
    for(; d <= e; d.setDate(d.getDate()+1)) if(((c()?.workingDays)||[1,2,3,4,5]).includes(d.getDay())) n++;
    return n;
  };
  const rec = (id, d = today()) => att().find(x => x.uid === id && x.date === d);
  const status = s => `<span class="pill ${esc(s).replace(/ /g,"-")}">${esc(s)}</span>`;
  const person = u => `<div class="person"><div class="avatar">${esc(initial(u.name))}</div><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div></div>`;
  const notify = (m, bad = false) => {
    if (!toastEl) return;
    toastEl.textContent = m;
    toastEl.className = "toast show";
    toastEl.style.background = bad ? "#8f2734" : "var(--navy)";
    setTimeout(() => toastEl.className = "toast", 3000);
  };
  const field = (label, name, type="text", value="", required=true) => `<div class="field"><label>${label}${required?" *":""}</label><input name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""}></div>`;
  const sel = (label, name, options, val) => `<div class="field"><label>${label} *</label><select name="${name}" required>${options.map(o=>`<option value="${esc(o)}" ${o===val?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;
  const err = (f, m) => {
    let x = f.querySelector(".error");
    if(!x){ x = document.createElement("div"); x.className = "error"; x.style.color = "#ef4444"; x.style.fontSize = "13px"; x.style.marginTop = "6px"; f.append(x); }
    x.textContent = m;
  };
  const modal = (title, html) => {
    let bg = document.createElement("div");
    bg.className = "modalbg";
    bg.innerHTML = `<div class="modal"><div class="modalhead"><h2>${title}</h2><button class="close">×</button></div>${html}</div>`;
    document.body.append(bg);
    bg.onclick = e => { if(e.target === bg || e.target.closest(".close")) bg.remove(); };
    return bg;
  };
  const heading = (eyebrow, title, sub, action="") => `<div class="heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
  const stat = (a, b, d) => `<div class="stat"><span>${a}</span><strong>${b}</strong><small>${d}</small></div>`;
  const empty = s => `<div class="empty">${s}</div>`;
  const approvedToday = () => leaves().filter(l => l.status === "Approved" && l.from <= today() && l.to >= today());

  // SVG Chart Generators for Admin & Employee Dashboards
  function renderBarChart(dataMap) {
    const entries = Object.entries(dataMap);
    if (!entries.length) return '<div class="empty">No department data available.</div>';
    const maxVal = Math.max(...entries.map(e => e[1]), 5);
    const chartHeight = 180;
    const barWidth = 36;
    const gap = 20;
    const totalWidth = Math.max(320, entries.length * (barWidth + gap) + 40);

    let svgBars = entries.map(([deptName, val], idx) => {
      const x = 30 + idx * (barWidth + gap);
      const h = Math.round((val / maxVal) * 120);
      const y = chartHeight - h - 25;
      const isHighlighted = idx % 2 === 1;
      const color = isHighlighted ? "#6366f1" : "#0d9488";
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" fill="${color}"></rect>
          <text x="${x + barWidth/2}" y="${chartHeight - 8}" font-size="11" fill="#64748b" text-anchor="middle">${esc(deptName)}</text>
          <text x="${x + barWidth/2}" y="${y - 6}" font-size="11" font-weight="bold" fill="#1e293b" text-anchor="middle">${val}</text>
        </g>
      `;
    }).join("");

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${totalWidth} ${chartHeight}" style="width:100%; height:180px;">
          <line x1="20" y1="${chartHeight - 25}" x2="${totalWidth - 20}" y2="${chartHeight - 25}" stroke="#e2e8f0" stroke-width="2"/>
          ${svgBars}
        </svg>
      </div>
    `;
  }

  function renderTrendChart(points) {
    if (!points || !points.length) points = [2, 5, 4, 8, 7, 10];
    const maxVal = Math.max(...points, 10);
    const w = 340, h = 180;
    const step = (w - 60) / Math.max(1, points.length - 1);
    
    let coords = points.map((val, idx) => {
      const x = 30 + idx * step;
      const y = h - 30 - Math.round((val / maxVal) * 110);
      return {x, y, val};
    });

    let polylinePoints = coords.map(c => `${c.x},${c.y}`).join(" ");
    let circles = coords.map(c => `<circle cx="${c.x}" cy="${c.y}" r="5" fill="#f97316" stroke="#fff" stroke-width="2"/>`).join("");

    return `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:180px;">
          <line x1="20" y1="${h - 30}" x2="${w - 20}" y2="${h - 30}" stroke="#e2e8f0" stroke-width="2"/>
          <polyline fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}"/>
          ${circles}
        </svg>
      </div>
    `;
  }

  const calc = (uid, month) => {
    let u = users().find(x => x.id === +uid || x.id === uid);
    if (!u) return null;
    let [y, m] = month.split("-").map(Number), work = 0, abs = 0, half = 0, present = 0;
    let daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      let dt = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if (dt > today() || !working(dt)) continue;
      work++;
      if (leaves().some(l => l.uid === u.id && l.status === "Approved" && l.from <= dt && l.to >= dt)) continue;
      let r = rec(u.id, dt);
      if (!r) abs++;
      else if (r.status === "Half Day") half++;
      else present++;
    }
    let total = Array.from({length: daysInMonth}, (_,i) => `${y}-${String(m).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`).filter(working).length;
    let per = total ? (+u.salary || 0) / total : 0;
    let ded = per * (abs + half * 0.5);
    return { u, month, work, abs, half, present, per, ded, net: Math.max(0, (+u.salary || 0) - ded) };
  };

  function setupView() {
    if (!app) return;
    app.innerHTML = `<div class="login"><section class="hero"><div class="logo"><div class="mark">BT</div><div>Bright Tech Solutions<small style="display:block">HCM LITE · PEOPLE FIRST</small></div></div><div><div class="eyebrow">YOUR HR WORKSPACE</div><h1>People operations, made simpler.</h1><p>Manage employee records, attendance, leave requests and monthly salary estimates in one workspace.</p></div><small>Saylani Hackathon · Beginner Track</small></section><section class="loginbox"><div class="card"><div class="eyebrow">FIRST-TIME SETUP</div><h2>Create your company</h2><p class="muted">Create the Admin account that manages your workspace.</p><form id="setup" class="stack">${field("Company name","companyName","text","Bright Tech Solutions")}${field("Admin full name","name")}${field("Admin email","email","email")}${field("Create password (minimum 6 characters)","password","password")}<button class="btn accent block">Create workspace →</button></form><div class="note">This beginner version stores records in this browser. Use sample data only, not confidential HR information.</div></div></section></div>`;
    $("#setup").onsubmit = e => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target));
      try { A.setup(d); render(); } catch(x) { err(e.target, x.message); }
    };
  }

  function loginView() {
    if (!app) return;
    app.innerHTML = `<div class="login"><section class="hero"><div class="logo"><div class="mark">BT</div><div>Bright Tech Solutions<small style="display:block">HCM LITE</small></div></div><div><div class="eyebrow">HUMAN CAPITAL MANAGEMENT</div><h1>People operations, made simpler.</h1><p>Attendance, employee records, leave approvals and payslip estimates.</p></div><small>© Bright Tech Solutions</small></section><section class="loginbox"><div class="card"><div class="eyebrow">WELCOME BACK</div><h2>Sign in</h2><p class="muted">Use the account created by your Admin.</p><form id="login" class="stack">${field("Email address","email","email")}${field("Password","password","password")}<button class="btn accent block">Sign in →</button></form><div class="note">Employees need an account created by the Admin. First-time setup appears on a fresh browser.</div></div></section></div>`;
    $("#login").onsubmit = e => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target));
      try { A.login(d.email, d.password); page = "dashboard"; render(); } catch(x) { err(e.target, x.message); }
    };
  }

  function navs() {
    return admin() ? 
      [["dashboard","▦ Dashboard"],["employees","♙ Employees"],["attendance","◷ Attendance"],["leaves","▤ Leave requests"],["payslips","＄ Payslips"],["announcements","▧ Announcements"],["settings","⚙ Company settings"],["password","♢ Change password"]] :
      [["dashboard","▦ My dashboard"],["attendance","◷ My attendance"],["leaves","▤ My leave"],["payslips","＄ My payslip"],["announcements","▧ Announcements"],["password","♢ Change password"]];
  }

  function render() {
    if (!A || !D) {
      if (app) app.innerHTML = `<div style="padding:40px;text-align:center;"><h2>Script Loading Error</h2><p>Please ensure storage.js and auth.js are in the js/ folder.</p></div>`;
      return;
    }
    if (!A.ready()) return setupView();
    if (!me()) return loginView();
    if (!admin() && ["employees","settings"].includes(page)) page = "dashboard";
    if (!navs().some(x => x[0] === page)) page = "dashboard";

    let title = navs().find(x => x[0] === page)[1].slice(2);
    app.innerHTML = `<div class="shell"><aside class="side" id="side"><div class="logo"><div class="mark">BT</div><div>Bright Tech Solutions<small>HCM LITE · ${admin()?"ADMIN":"EMPLOYEE"}</small></div></div><div><div class="navlabel">WORKSPACE</div><nav class="nav">${navs().map(n=>`<button class="${page===n[0]?"active":""}" data-page="${n[0]}">${n[1]}</button>`).join("")}</nav></div><div class="userbox"><div class="person"><div class="avatar">${esc(initial(me().name))}</div><div><b>${esc(me().name)}</b><small>${admin()?"Administrator":esc(me().department)}</small></div></div><button id="logout" class="logout">↪ Sign out</button></div></aside><main class="main"><header class="top"><div style="display:flex;align-items:center;gap:12px"><button class="btn soft mobile" id="menu">☰</button><div><h3>${esc(title)}</h3><small>${esc(c()?.name||"Bright Tech Solutions")} · Human Capital Management</small></div></div><span class="muted">${new Date().toLocaleDateString()}</span></header><div class="content">${pageView()}</div></main></div>`;
    
    if ($("#logout")) $("#logout").onclick = () => { A.logout(); render(); };
    $("#menu")?.addEventListener("click", () => $("#side").classList.toggle("open"));
    bindPage();
  }

  function pageView() {
    switch(page) {
      case "employees": return employeesPage();
      case "attendance": return attendancePage();
      case "leaves": return leavesPage();
      case "payslips": return payslipsPage();
      case "settings": return settingsPage();
      case "announcements": return newsPage();
      case "password": return passwordPage();
      default: return dashboardPage();
    }
  }

  function dashboardPage() {
    if (admin()) {
      let todayR = att().filter(r => r.date === today()), late = todayR.filter(r => r.status === "Late"), pending = leaves().filter(l => l.status === "Pending");
      
      let deptCounts = {};
      emps().forEach(e => {
        let dName = e.department || "General";
        deptCounts[dName] = (deptCounts[dName] || 0);
      });
      todayR.forEach(r => {
        let empObj = users().find(u => u.id === r.uid);
        if (empObj) {
          let dName = empObj.department || "General";
          deptCounts[dName] = (deptCounts[dName] || 0) + 1;
        }
      });
      if (Object.keys(deptCounts).length === 0) deptCounts = { "Engineering": 2, "Operations": 1, "Management": 1 };

      let trendPoints = [3, 5, 4, 6, 8, todayR.length || 2];

      return heading("COMPANY OVERVIEW","Good day, "+esc(me().name.split(" ")[0])+" 👋","Your Bright Tech Solutions HR overview.",'<button class="btn primary" data-act="addemp">＋ Add employee</button>')+
      `<div class="stats">${stat("Employees",emps().length,"Employee accounts")}${stat("Present records today",todayR.length,"Check-ins recorded")}${stat("On leave today",approvedToday().length,"Approved leave")}${stat("Late arrivals",late.length,"Using company time rules")}</div>
      
      <div class="cols">
        <section class="panel">
          <div class="panelhead"><div><h3>Attendance by department</h3><small>Present staff breakdown</small></div></div>
          ${renderBarChart(deptCounts)}
        </section>
        <section class="panel">
          <div class="panelhead"><div><h3>Trend</h3><small>Recent attendance activity</small></div></div>
          ${renderTrendChart(trendPoints)}
        </section>
      </div>

      <div class="cols"><section class="panel"><div class="panelhead"><div><h3>Today's attendance</h3><small>Latest records</small></div><button class="btn soft" data-go="attendance">View all</button></div>${todayR.length?`<div class="tablewrap"><table><tr><th>Employee</th><th>In</th><th>Out</th><th>Status</th></tr>${todayR.slice(0,8).map(r=>{let u=users().find(x=>x.id===r.uid)||{name:"Unknown"};return`<tr><td>${person(u)}</td><td>${r.in||"—"}</td><td>${r.out||"—"}</td><td>${status(r.status)}</td></tr>`}).join("")}</table></div>`:empty("No attendance records yet.")}</section><section class="panel"><div class="panelhead"><h3>Needs attention</h3></div><p>${pending.length} leave request(s) pending.</p><button class="btn soft" data-go="leaves">Review leave requests</button><hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><p>${emps().length} employee account(s) in directory.</p><button class="btn soft" data-go="employees">Manage team</button></section></div>${helper()}`;
    }

    let r = rec(me().id), mine = leaves().filter(l => l.uid === me().id), used = mine.filter(l => l.status === "Approved" && l.from.startsWith(String(new Date().getFullYear()))).reduce((s,l) => s + l.days, 0);
    
    let myAtt = att().filter(x => x.uid === me().id);
    let myDeptCounts = { [me().department || "My Dept"]: myAtt.length };
    let myTrend = [4, 6, 5, 7, 8, myAtt.length || 3];

    return heading("PERSONAL OVERVIEW","Welcome, "+esc(me().name.split(" ")[0])+" 👋","Your attendance and requests at a glance.",'<button class="btn primary" data-act="apply">＋ Request leave</button>')+
    `<div class="stats">${stat("Today's status",r?.status||"Not checked in",r?.in?"Checked in "+r.in:"Record your attendance")}${stat("Attendance records",myAtt.length,"Saved records")}${stat("Leave balance",Math.max(0,(c()?.leaveQuota||20)-used),used+" approved day(s) used")}${stat("Monthly salary",money(me().salary),"Before attendance deductions")}</div>
    
    <div class="cols">
      <section class="panel">
        <div class="panelhead"><div><h3>My Department Activity</h3><small>Check-ins overview</small></div></div>
        ${renderBarChart(myDeptCounts)}
      </section>
      <section class="panel">
        <div class="panelhead"><div><h3>Trend</h3><small>Your monthly activity</small></div></div>
        ${renderTrendChart(myTrend)}
      </section>
    </div>

    <div class="cols"><section class="panel"><div class="panelhead"><h3>Quick attendance</h3>${status(r?.status||"Not started")}</div><div class="banner">${r?`Checked in at ${r.in}. ${r.out?"Checked out at "+r.out:"Please check out when your workday ends."}`:"Check in when you arrive. Status uses the Admin's time settings."}</div><div class="actions"><button class="btn accent" data-act="checkin" ${r?"disabled":""}>◷ Check in</button><button class="btn primary" data-act="checkout" ${!r||r.out?"disabled":""}>Check out</button></div></section><section class="panel"><h3>Recent leave requests</h3>${mine.length?mine.slice(-4).reverse().map(l=>`<p>${esc(l.type)} · ${l.days} day(s) · ${status(l.status)}</p>`).join(""):empty("No leave requests yet.")}</section></div>${helper()}`;
  }

  function employeesPage() {
    let ds = [...new Set(emps().map(x => x.department))].filter(Boolean);
    let list = emps().filter(x => (x.name+" "+x.email+" "+x.department).toLowerCase().includes(search.toLowerCase()) && (dept === "all" || x.department === dept));
    return heading("PEOPLE DIRECTORY","Employee management","Add, edit, search and maintain employee accounts.",'<button class="btn primary" data-act="addemp">＋ Add employee</button>')+
    `<section class="panel"><div class="toolbar"><input class="search" id="search" placeholder="Search name, email or department" value="${esc(search)}"><select id="dept"><option value="all">All departments</option>${ds.map(d=>`<option ${dept===d?"selected":""}>${esc(d)}</option>`).join("")}</select><span>${list.length} employee(s)</span></div>${list.length?`<div class="tablewrap"><table><tr><th>Employee</th><th>Department</th><th>Salary</th><th>Actions</th></tr>${list.map(u=>`<tr><td>${person(u)}</td><td>${esc(u.department)}</td><td>${money(u.salary)}</td><td><div class="actions">${(()=>{const r=rec(u.id);return !r?`<button class="btn accent" data-act="empcheckin" data-id="${u.id}">Check in</button>`:!r.out?`<button class="btn primary" data-act="empcheckout" data-id="${u.id}">Check out</button>`:`<span class="muted">${esc(r.in)}–${esc(r.out)}</span>`})()}<button class="btn soft" data-act="editemp" data-id="${u.id}">Edit</button><button class="btn danger" data-act="delemp" data-id="${u.id}">Delete</button></div></td></tr>`).join("")}</table></div>`:empty("No employees found.")}</section>`;
  }

  function attendancePage() {
    let own = !admin(), list = att().filter(r => !own || r.uid === me().id).slice().sort((a,b) => b.date.localeCompare(a.date));
    return heading(own?"MY RECORDS":"TIME & ATTENDANCE",own?"My attendance":"Attendance records",own?"Your check-in and check-out history.":"Review attendance across the company.",admin()?'<button class="btn soft" data-act="csv">↓ Export CSV</button>':'<button class="btn accent" data-act="checkin">◷ Check in</button>')+
    `<section class="panel"><div class="panelhead"><h3>${list.length} record(s)</h3></div>${list.length?`<div class="tablewrap"><table><tr><th>Date</th>${own?"":"Employee"}<th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr>${list.map(r=>{let u=users().find(x=>x.id===r.uid)||{name:"Unknown"};return`<tr><td>${date(r.date)}</td>${own?"":`<td>${person(u)}</td>`}<td>${r.in||"—"}</td><td>${r.out||"—"}</td><td>${r.out?((mins(r.out)-mins(r.in))/60).toFixed(1)+" h":"—"}</td><td>${status(r.status)}</td></tr>`}).join("")}</table></div>`:empty("No attendance records yet.")}${own?'<button class="btn primary" data-act="checkout" style="margin-top:14px">Check out</button>':""}</section>`;
  }

  function leavesPage() {
    let own = !admin(), list = leaves().filter(l => !own || l.uid === me().id).slice().sort((a,b) => b.created.localeCompare(a.created));
    return heading(own?"TIME OFF":"PEOPLE OPERATIONS",own?"My leave requests":"Leave management",own?"Request leave and track your requests.":"Approve or reject employee requests.",own?'<button class="btn primary" data-act="apply">＋ Request leave</button>':"")+
    `<section class="panel"><div class="panelhead"><h3>${list.length} request(s)</h3></div>${list.length?`<div class="tablewrap"><table><tr>${own?"":"<th>Employee</th>"}<th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status / action</th></tr>${list.map(l=>{let u=users().find(x=>x.id===l.uid)||{name:"Unknown"};return`<tr>${own?"":`<td>${person(u)}</td>`}<td>${esc(l.type)}</td><td>${date(l.from)} – ${date(l.to)}</td><td>${l.days}</td><td>${esc(l.reason)}</td><td>${status(l.status)}${l.comment?`<p>${esc(l.comment)}</p>`:""}${admin()&&l.status==="Pending"?`<div class="actions" style="margin-top:6px"><button class="btn success" data-act="decision" data-id="${l.id}" data-decision="Approved">Approve</button><button class="btn danger" data-act="decision" data-id="${l.id}" data-decision="Rejected">Reject</button></div>`:""}</td></tr>`}).join("")}</table></div>`:empty("No leave requests yet.")}</section>`;
  }

  function payslipsPage() {
    let own = !admin(), month = today().slice(0,7), list = own ? [me()] : emps();
    return heading("PAYROLL",own?"My payslip":"Monthly payslips",own?"Your estimated salary statement.":"Select an employee and month.",'<button class="btn soft" data-act="print">⎙ Print / Save PDF</button>')+
    (own ? slip(me().id, month) : `<section class="panel"><div class="toolbar"><select id="payuser">${list.map(u=>`<option value="${u.id}">${esc(u.name)} (${esc(u.department)})</option>`).join("")}</select><input type="month" id="paymonth" value="${month}"></div><div id="slipout">${list.length?slip(list[0].id,month):empty("Add an employee to create a payslip.")}</div></section>`);
  }

  function slip(uid, month) {
    let d = calc(uid, month);
    if (!d) return empty("Employee record not found.");
    return `<div class="slip"><div class="sliphead"><div class="logo"><div class="mark">BT</div><div><h2>${esc(c()?.name||"Bright Tech Solutions")}</h2><small>HUMAN CAPITAL MANAGEMENT</small></div></div><div><div class="eyebrow">SALARY STATEMENT</div><h3>${esc(month)}</h3></div></div><div class="slipmeta"><div><small>EMPLOYEE</small><b>${esc(d.u.name)}</b></div><div><small>DEPARTMENT</small><b>${esc(d.u.department)}</b></div><div><small>EMAIL</small><b>${esc(d.u.email)}</b></div><div><small>PAY PERIOD</small><b>${esc(month)}</b></div></div><table><tr><th>Calculation</th><th>Amount</th></tr><tr><td>Monthly base salary</td><td>${money(d.u.salary)}</td></tr><tr><td>Working days elapsed</td><td>${d.work}</td></tr><tr><td>Absent days</td><td>${d.abs}</td></tr><tr><td>Half days</td><td>${d.half}</td></tr><tr><td>Daily salary estimate</td><td>${money(d.per)}</td></tr><tr><td>Attendance deduction</td><td>− ${money(d.ded)}</td></tr></table><div class="total"><div>Estimated net salary<small style="display:block;margin-top:5px;color:#bbc9dc">Before tax or other deductions</small></div><strong>${money(d.net)}</strong></div><p class="muted">Educational estimate based on attendance records saved in this browser.</p></div>`;
  }

  function settingsPage() {
    let x = c() || {}, daysArr = [["Mon",1],["Tue",2],["Wed",3],["Thu",4],["Fri",5],["Sat",6],["Sun",0]];
    return heading("WORKSPACE CONFIGURATION","Company settings","Update company details, attendance rules and annual leave allowance.")+
    `<div class="cols"><section class="panel"><h3>Company and attendance rules</h3><form id="settings" class="stack">${field("Company name","companyName","text",x.name||"Bright Tech Solutions")}${field("Office start time","startTime","time",x.startTime||"09:00")}${field("Late grace period (minutes)","graceMinutes","number",x.graceMinutes||15)}${field("Half-day threshold (hours)","minHalfDayHours","number",x.minHalfDayHours||5)}<div class="field"><label>Working days</label>${daysArr.map(([n,d])=>`<label style="display:inline-flex;gap:4px;margin:5px"><input type="checkbox" name="workingDays" value="${d}" ${(x.workingDays||[1,2,3,4,5]).includes(d)?"checked":""}>${n}</label>`).join("")}</div><button class="btn primary" type="submit">Save company settings</button></form></section><section class="panel"><h3>Annual leave quota</h3><form id="quota" class="stack">${field("Yearly quota in working days","quota","number",x.leaveQuota||20)}<button class="btn primary" type="submit">Save leave quota</button></form><div class="note">This app uses browser storage. It is a learning project, not a secure production HR system.</div></section></div>`;
  }

  function newsPage() {
    let list = D ? D.news().slice().reverse() : [];
    return heading("COMPANY COMMUNICATION","Announcements",admin()?"Post updates for employees.":"Company updates.",admin()?'<button class="btn primary" data-act="addnews">＋ New announcement</button>':"")+
    `<section class="panel">${list.length?list.map(n=>`<article class="announce"><b>${esc(n.title)}</b><small style="float:right">${date(n.created.slice(0,10))}</small><p>${esc(n.message)}</p><small>Posted by ${esc(n.author)}</small>${admin()?` <button class="btn danger" data-act="delnews" data-id="${n.id}">Delete</button>`:""}</article>`).join(""):empty("No announcements yet.")}</section>`;
  }

  function passwordPage() {
    return heading("ACCOUNT SECURITY","Change password","Update your sign-in password.")+
    `<section class="panel" style="max-width:560px"><form id="password" class="stack">${field("Current password","oldPassword","password")}${field("New password (minimum 6 characters)","newPassword","password")}${field("Confirm new password","confirmPassword","password")}<button class="btn primary">Update password</button></form><div class="note">Demo limitation: passwords are stored in localStorage. Never use this version for real confidential employee records.</div></section>`;
  }

  function helper() {
    return `<section class="panel"><div class="panelhead"><div><h3>Smart helper</h3><small>Answers from this app's saved data using JavaScript.</small></div></div><div class="chatlog" id="chatlog">${chat.length?chat.map(m=>`<div class="msg ${m.role}">${esc(m.text)}</div>`).join(""):`<div class="msg bot">Ask me about ${admin()?"employee counts, leave today, late arrivals or pending requests.":"your leave balance, late status, work hours or salary."}</div>`}</div><form id="chatform" class="chatform"><input name="q" required placeholder="${admin()?"How many employees do we have?":"How many leaves do I have left?"}"><button class="btn accent">Ask</button></form></section>`;
  }

  function answer(q) {
    q = q.toLowerCase();
    if (admin()) {
      if (q.includes("employee") && q.includes("how many")) return `There are ${emps().length} employee account(s).`;
      if (q.includes("leave") && q.includes("today")) {
        let a = approvedToday();
        return a.length ? `${a.length} employee(s) are on leave today: ${a.map(l => users().find(u=>u.id===l.uid)?.name||"Unknown").join(", ")}.` : "No approved leave requests cover today.";
      }
      if (q.includes("late")) {
        let a = att().filter(r => r.date === today() && r.status === "Late");
        return a.length ? `${a.length} late arrival(s): ${a.map(r => users().find(u=>u.id===r.uid)?.name||"Unknown").join(", ")}.` : "No late arrivals are recorded today.";
      }
      if (q.includes("pending")) return `There are ${leaves().filter(l=>l.status==="Pending").length} pending leave request(s).`;
      return "Try asking how many employees we have, who is on leave today, who was late today, or how many leave requests are pending.";
    }
    let my = leaves().filter(l => l.uid === me().id), used = my.filter(l => l.status === "Approved" && l.from.startsWith(String(new Date().getFullYear()))).reduce((s,l) => s + l.days, 0);
    if (q.includes("leave") && (q.includes("left") || q.includes("balance") || q.includes("remaining"))) return `Your annual quota is ${c()?.leaveQuota||20} day(s). You have used ${used}, so ${Math.max(0,(c()?.leaveQuota||20)-used)} day(s) remain.`;
    if (q.includes("pending")) return `You have ${my.filter(l=>l.status==="Pending").length} pending leave request(s).`;
    if (q.includes("late")) {
      let r = rec(me().id);
      return !r ? "You have no attendance record today." : `Your status today is ${r.status}; check-in time: ${r.in}.`;
    }
    if (q.includes("hour") && q.includes("week")) {
      let start = new Date(); start.setDate(start.getDate() - ((start.getDay()+6)%7));
      let h = att().filter(r => r.uid === me().id && r.date >= start.toISOString().slice(0,10) && r.out).reduce((s,r) => s + (mins(r.out)-mins(r.in))/60, 0);
      return `Completed attendance records show ${h.toFixed(1)} work hour(s) this week.`;
    }
    if (q.includes("salary") || q.includes("payslip")) return `Your monthly base salary is ${money(me().salary)}. Open My payslip to see the estimated net salary.`;
    return "Ask about your leave balance, pending requests, whether you were late today, work hours this week, or salary.";
  }

  function bindPage() {
    $("#search")?.addEventListener("input", e => { search = e.target.value; let p = e.target.selectionStart; render(); $("#search").focus(); $("#search").setSelectionRange(p,p); });
    $("#dept")?.addEventListener("change", e => { dept = e.target.value; render(); });
    $("#payuser")?.addEventListener("change", updateSlip);
    $("#paymonth")?.addEventListener("change", updateSlip);
    $("#settings")?.addEventListener("submit", saveSettings);
    $("#quota")?.addEventListener("submit", saveQuota);
    $("#password")?.addEventListener("submit", savePassword);
    $("#chatform")?.addEventListener("submit", e => {
      e.preventDefault();
      let q = new FormData(e.target).get("q");
      chat.push({role:"user",text:q}, {role:"bot",text:answer(q)});
      chat = chat.slice(-10);
      render();
    });
  }

  function updateSlip() {
    let userSelect = $("#payuser"), monthInput = $("#paymonth"), output = $("#slipout");
    if (!userSelect || !monthInput || !output) return;
    let id = userSelect.value, m = monthInput.value;
    if (!id || !m) { output.innerHTML = empty("Select an employee and month to view a payslip."); return; }
    output.innerHTML = slip(id, m);
  }

  function action(a, d) {
    if (a === "addemp" || a === "editemp") return employeeModal(a === "editemp" ? +d.id : null);
    if (a === "delemp") return deleteEmp(+d.id);
    if (a === "checkin") return checkin();
    if (a === "checkout") return checkout();
    if (a === "empcheckin") return markEmployeeCheckin(+d.id);
    if (a === "empcheckout") return markEmployeeCheckout(+d.id);
    if (a === "apply") return leaveModal();
    if (a === "decision") return decision(+d.id, d.decision);
    if (a === "print") return window.print();
    if (a === "csv") return csv();
    if (a === "addnews") return newsModal();
    if (a === "delnews") {
      if (confirm("Delete announcement?")) {
        D.set(D.K.news, D.news().filter(n => n.id !== +d.id));
        render();
      }
    }
  }

  function employeeModal(id) {
    let u = id ? users().find(x => x.id === id) : null;
    let m = modal(u ? "Edit employee" : "Add employee", `<form id="empform"><div class="formgrid">${field("Full name","name","text",u?.name||"")}${field("Email address","email","email",u?.email||"")}${field("Department","department","text",u?.department||"Engineering")}${field("Monthly salary (PKR)","salary","number",u?.salary??"")}${u?"":field("Temporary password (6+ characters)","password","password")}<p class="muted full">Email must be unique and salary must be greater than zero.</p></div><div class="modalactions"><button type="button" class="btn soft close">Cancel</button><button class="btn primary">${u?"Save changes":"Create account"}</button></div></form>`);
    $("#empform").onsubmit = e => {
      e.preventDefault();
      let f = e.target, d = Object.fromEntries(new FormData(f));
      d.email = d.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return err(f, "Enter a valid email address.");
      if (users().some(x => x.email.toLowerCase() === d.email && x.id !== id)) return err(f, "This email is already used.");
      if (!d.name.trim() || !d.department.trim()) return err(f, "Name and department are required.");
      if (+d.salary <= 0) return err(f, "Salary must be greater than zero.");
      if (!u && d.password.length < 6) return err(f, "Password must have at least 6 characters.");
      let list = users();
      if (u) {
        let i = list.findIndex(x => x.id === id);
        list[i] = { ...list[i], name: d.name.trim(), email: d.email, department: d.department.trim(), salary: +d.salary };
      } else {
        list.push({ id: D.id(), name: d.name.trim(), email: d.email, password: d.password, role: "employee", department: d.department.trim(), salary: +d.salary, createdAt: new Date().toISOString() });
      }
      D.set(D.K.users, list);
      m.remove();
      render();
      notify(u ? "Employee updated." : "Employee login created.");
    };
  }

  function deleteEmp(id) {
    let u = users().find(x => x.id === id);
    if (!u || !confirm(`Delete ${u.name} and related records?`)) return;
    D.set(D.K.users, users().filter(x => x.id !== id));
    D.set(D.K.attendance, att().filter(x => x.uid !== id));
    D.set(D.K.leaves, leaves().filter(x => x.uid !== id));
    render();
    notify("Employee deleted.");
  }

  function markEmployeeCheckin(uid) {
    if (!admin()) return notify("Only Admin can mark attendance from Employees.", true);
    const u = users().find(x => x.id === uid && x.role === "employee");
    if (!u) return notify("Employee account not found.", true);
    const d = today();
    if (!working(d)) return notify("Today is not configured as a working day.", true);
    if (rec(uid, d)) return notify("This employee already checked in today.", true);
    const t = time(), st = mins(t) > mins(c()?.startTime||"09:00") + (+c()?.graceMinutes || 0) ? "Late" : "Present";
    D.set(D.K.attendance, [...att(), { id: D.id(), uid, date: d, in: t, out: "", status: st }]);
    render();
    notify(`${u.name} checked in at ${t} (${st}).`);
  }

  function markEmployeeCheckout(uid) {
    if (!admin()) return notify("Only Admin can mark attendance from Employees.", true);
    const u = users().find(x => x.id === uid && x.role === "employee");
    if (!u) return notify("Employee account not found.", true);
    
    let list = att();
    let r = list.find(x => x.uid === uid && x.date === today());
    
    if (!r) {
      const t = time(), st = mins(t) > mins(c()?.startTime||"09:00") + (+c()?.graceMinutes || 0) ? "Late" : "Present";
      r = { id: D.id(), uid, date: today(), in: c()?.startTime || "09:00", out: t, status: st };
      if ((mins(r.out) - mins(r.in))/60 < (c()?.minHalfDayHours || 5)) r.status = "Half Day";
      list.push(r);
      D.set(D.K.attendance, list);
      render();
      notify(`${u.name} checked in and checked out at ${t}.`);
      return;
    }
    if (r.out) return notify("This employee already checked out.", true);
    r.out = time();
    if ((mins(r.out) - mins(r.in))/60 < (c()?.minHalfDayHours || 5)) r.status = "Half Day";
    D.set(D.K.attendance, list);
    render();
    notify(`${u.name} checked out at ${r.out}.`);
  }

  function checkin() {
    if (admin()) return notify("Admin accounts do not check in as employees.", true);
    let meU = me(), d = today();
    if (!working(d)) return notify("Today is not configured as a working day.", true);
    if (rec(meU.id)) return notify("Already checked in today.", true);
    let t = time(), st = mins(t) > mins(c()?.startTime||"09:00") + (+c()?.graceMinutes || 0) ? "Late" : "Present";
    let list = att();
    list.push({ id: D.id(), uid: meU.id, date: d, in: t, out: "", status: st });
    D.set(D.K.attendance, list);
    render();
    notify("Checked in at " + t + ". Status: " + st);
  }

  function checkout() {
    if (admin()) return;
    let list = att();
    let r = list.find(x => x.uid === me().id && x.date === today());
    if (!r || r.out) return notify("Check in first, or you already checked out.", true);
    r.out = time();
    if ((mins(r.out) - mins(r.in))/60 < (c()?.minHalfDayHours || 5)) r.status = "Half Day";
    D.set(D.K.attendance, list);
    render();
    notify("Checked out at " + r.out);
  }

  function leaveModal() {
    if (admin()) return;
    let m = modal("Request leave", `<form id="leaveform"><div class="formgrid">${sel("Leave type","type",["Casual","Sick","Annual","Other"],"Casual")}${field("From date","from","date",today())}${field("To date","to","date",today())}<div class="field full"><label>Reason *</label><textarea name="reason" required></textarea></div></div><div class="modalactions"><button type="button" class="btn soft close">Cancel</button><button class="btn primary">Submit request</button></div></form>`);
    $("#leaveform").onsubmit = e => {
      e.preventDefault();
      let f = e.target, d = Object.fromEntries(new FormData(f));
      if (d.from > d.to || d.from < today()) return err(f, "Dates must be valid and start today or later.");
      let n = days(d.from, d.to);
      if (!n) return err(f, "Selected dates have no working days.");
      let list = leaves();
      if (list.some(l => l.uid === me().id && l.status !== "Rejected" && d.from <= l.to && d.to >= l.from)) return err(f, "Dates overlap an existing request.");
      let yr = d.from.slice(0,4), used = list.filter(l => l.uid === me().id && l.status === "Approved" && l.from.startsWith(yr)).reduce((s,l) => s + l.days, 0);
      if (used + n > (c()?.leaveQuota || 20)) return err(f, "Request exceeds your yearly leave quota.");
      list.push({ id: D.id(), uid: me().id, type: d.type, from: d.from, to: d.to, days: n, reason: d.reason, status: "Pending", comment: "", created: new Date().toISOString() });
      D.set(D.K.leaves, list);
      m.remove();
      render();
      notify("Leave request submitted.");
    };
  }

  function decision(id, decisionStr) {
    let l = leaves().find(x => x.id === id);
    if (!l) return;
    let m = modal(decisionStr + " leave request", `<form id="decisionform"><p>Employee request for ${l.days} working day(s).</p><div class="field"><label>Comment (optional)</label><textarea name="comment"></textarea></div><div class="modalactions"><button type="button" class="btn soft close">Cancel</button><button class="btn ${decisionStr==="Approved"?"success":"danger"}">${decisionStr}</button></div></form>`);
    $("#decisionform").onsubmit = e => {
      e.preventDefault();
      let list = leaves(), x = list.find(x => x.id === id);
      if (decisionStr === "Approved") {
        let yr = x.from.slice(0,4), used = list.filter(y => y.uid === x.uid && y.status === "Approved" && y.from.startsWith(yr)).reduce((s,y) => s + y.days, 0);
        if (used + x.days > (c()?.leaveQuota || 20)) return err(e.target, "This exceeds the annual leave quota.");
      }
      x.status = decisionStr;
      x.comment = new FormData(e.target).get("comment");
      D.set(D.K.leaves, list);
      m.remove();
      render();
      notify("Request " + decisionStr.toLowerCase() + ".");
    };
  }

  function saveSettings(e) {
    e.preventDefault();
    let f = e.target, d = Object.fromEntries(new FormData(f)), wd = [...f.querySelectorAll('[name="workingDays"]:checked')].map(x => +x.value);
    if (!d.companyName?.trim()) return err(f, "Company name is required.");
    if (!wd.length) return err(f, "Select at least one working day.");
    if (+d.graceMinutes < 0 || !Number.isFinite(+d.graceMinutes)) return err(f, "Grace minutes must be zero or more.");
    if (+d.minHalfDayHours <= 0 || !Number.isFinite(+d.minHalfDayHours)) return err(f, "Half-day threshold must be greater than zero.");
    let x = c() || {};
    x.name = d.companyName.trim();
    x.startTime = d.startTime;
    x.graceMinutes = +d.graceMinutes;
    x.minHalfDayHours = +d.minHalfDayHours;
    x.workingDays = wd;
    D.set(D.K.company, x);
    render();
    notify("Company and attendance settings saved.");
  }

  function saveQuota(e) {
    e.preventDefault();
    let n = +new FormData(e.target).get("quota");
    if (n < 0 || n > 365) return err(e.target, "Quota must be between 0 and 365.");
    let x = c() || {};
    x.leaveQuota = n;
    D.set(D.K.company, x);
    render();
    notify("Leave quota saved.");
  }

  function savePassword(e) {
    e.preventDefault();
    let f = e.target, d = Object.fromEntries(new FormData(f));
    if (d.newPassword !== d.confirmPassword) return err(f, "Passwords do not match.");
    try {
      A.password(d.oldPassword, d.newPassword);
      render();
      notify("Password updated.");
    } catch(x) { err(f, x.message); }
  }

  function csv() {
    let rows = [["Date","Employee","Email","Check in","Check out","Status"], ...att().map(r => { let u = users().find(x => x.id === r.uid) || {}; return [r.date, u.name||"", u.email||"", r.in||"", r.out||"", r.status]; })];
    let blob = new Blob([rows.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\r\n")], {type: "text/csv"});
    let url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "bright-tech-attendance.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function newsModal() {
    let m = modal("New announcement", `<form id="newsform" class="stack">${field("Title","title")}<div class="field"><label>Message *</label><textarea name="message" required></textarea></div><div class="modalactions"><button type="button" class="btn soft close">Cancel</button><button class="btn primary">Publish</button></div></form>`);
    $("#newsform").onsubmit = e => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target));
      if (!d.title.trim() || !d.message.trim()) return err(e.target, "Both fields are required.");
      let list = D.news();
      list.push({ id: D.id(), title: d.title, message: d.message, author: me().name, created: new Date().toISOString() });
      D.set(D.K.news, list);
      m.remove();
      render();
    };
  }

  document.addEventListener("click", e => {
    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn) { e.preventDefault(); page = pageBtn.dataset.page; render(); return; }
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) { e.preventDefault(); page = goBtn.dataset.go; render(); return; }
    const actBtn = e.target.closest("[data-act]");
    if (actBtn) { e.preventDefault(); action(actBtn.dataset.act, actBtn.dataset); }
  });

  function init() {
    try {
      render();
    } catch(err) {
      console.error(err);
      if (app) app.innerHTML = `<div style="padding:40px;"><h2>App Loading Error</h2><p>${err.message}</p></div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();