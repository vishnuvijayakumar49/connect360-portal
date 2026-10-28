(async () => {
  const ctx = await C360.shell("vendors");
  if (!ctx) return;
  const { session } = ctx;
  const admin = session.role === "admin";
  const { esc, highlight, fmtDate, statusClass } = C360;

  const STATUSES = ["Active", "Onboarding", "Prospect", "On Hold"];
  const BASE_CATEGORIES = ["Hospital", "Jewellery", "Hotel", "Restaurant", "IT Services", "Vehicle Services", "Banking & Finance", "Insurance", "Manufacturing", "Manpower & HR", "Construction", "Textiles", "Education", "Other"];

  const $ = (id) => document.getElementById(id);
  const q = $("q"), fCategory = $("fCategory"), fExec = $("fExec"), fStatus = $("fStatus");

  let vendors = [], execs = [], execById = {};

  async function load() {
    try {
      [vendors, execs] = await Promise.all([C360.vendors.all(), C360.executives.all()]);
    } catch (e) {
      $("rows").innerHTML = "";
      $("empty").hidden = false;
      $("empty").textContent = "Could not load data files. Serve the site over HTTP (see README).";
      return false;
    }
    execById = Object.fromEntries(execs.map((e) => [e.id, e]));
    return true;
  }

  function fillSelect(sel, options, keep = true) {
    const current = sel.value;
    const first = sel.options[0];
    sel.innerHTML = "";
    if (first && keep) sel.appendChild(first);
    options.forEach(([v, t]) => sel.add(new Option(t, v)));
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  }

  function categories() {
    return [...new Set([...BASE_CATEGORIES, ...vendors.map((v) => v.category)])].filter(Boolean).sort();
  }

  function populateFilters() {
    const used = [...new Set(vendors.map((v) => v.category))].sort();
    fillSelect(fCategory, used.map((c) => [c, c]));
    fillSelect(fExec, execs.map((e) => [e.id, e.name]));
    fillSelect(fStatus, STATUSES.map((s) => [s, s]));
    $("categoryList").innerHTML = categories().map((c) => `<option value="${esc(c)}">`).join("");
    fillSelect($("status"), STATUSES.map((s) => [s, s]), false);
    fillSelect($("executiveId"), execs.map((e) => [e.id, e.name]), false);
  }

  function renderKpis() {
    const active = vendors.filter((v) => v.status === "Active").length;
    const pipeline = vendors.filter((v) => v.status === "Onboarding" || v.status === "Prospect").length;
    const cats = new Set(vendors.map((v) => v.category)).size;
    const kpi = (label, value, sub) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
    $("kpis").innerHTML =
      kpi("Total vendors", vendors.length, `across ${execs.length} executives`) +
      kpi("Active partners", active, `${vendors.length ? Math.round((active / vendors.length) * 100) : 0}% of network`) +
      kpi("Categories", cats, "service types covered") +
      kpi("In pipeline", pipeline, "onboarding + prospects");
  }

  const SEARCH_FIELDS = ["name", "category", "profile", "remarks", "contactPerson", "phone", "email", "area", "address"];
  function matches(v, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    return SEARCH_FIELDS.some((f) => String(v[f] || "").toLowerCase().includes(t)) ||
      (v.services || []).some((s) => s.toLowerCase().includes(t)) ||
      (execById[v.executiveId]?.name || "").toLowerCase().includes(t);
  }

  // When a search hits the profile or remarks, show that snippet under the vendor name.
  function snippet(v, term) {
    if (!term) return "";
    for (const f of ["remarks", "profile"]) {
      const text = v[f] || "";
      const i = text.toLowerCase().indexOf(term.toLowerCase());
      if (i >= 0) {
        const start = Math.max(0, i - 40);
        const piece = (start ? "…" : "") + text.slice(start, i + term.length + 60) + (i + term.length + 60 < text.length ? "…" : "");
        return `<div class="vsub"><em>${f === "remarks" ? "Remarks" : "Profile"}:</em> ${highlight(piece, term)}</div>`;
      }
    }
    return "";
  }

  function render() {
    const term = q.value.trim();
    const list = vendors
      .filter((v) => matches(v, term))
      .filter((v) => !fCategory.value || v.category === fCategory.value)
      .filter((v) => !fExec.value || v.executiveId === fExec.value)
      .filter((v) => !fStatus.value || v.status === fStatus.value)
      .sort((a, b) => a.name.localeCompare(b.name));

    $("count").textContent = `Showing ${list.length} of ${vendors.length} vendors`;
    $("empty").hidden = list.length > 0;
    $("rows").innerHTML = list
      .map((v) => {
        const ex = execById[v.executiveId];
        return `<tr data-id="${esc(v.id)}" tabindex="0">
          <td><div class="vname">${highlight(v.name, term)}</div><div class="vsub">${highlight(v.area || "", term)}</div>${snippet(v, term)}</td>
          <td><span class="cat">${esc(v.category)}</span></td>
          <td><div class="tags">${(v.services || []).map((s) => `<span class="tag">${highlight(s, term)}</span>`).join("")}</div></td>
          <td><div>${highlight(v.contactPerson || "—", term)}</div><div class="vsub" style="white-space:nowrap">${esc(v.phone)}</div></td>
          <td>${ex ? esc(ex.name) : '<span class="muted">Unassigned</span>'}</td>
          <td><span class="status ${statusClass(v.status)}">${esc(v.status)}</span></td>
          <td class="vsub">${fmtDate(v.onboardedOn)}</td>
        </tr>`;
      })
      .join("");

    const params = new URLSearchParams();
    if (term) params.set("q", term);
    if (fCategory.value) params.set("category", fCategory.value);
    if (fExec.value) params.set("exec", fExec.value);
    if (fStatus.value) params.set("status", fStatus.value);
    history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  }

  const canEdit = (v) => admin || v.executiveId === session.executiveId;

  // ---------- detail ----------
  const detailDlg = $("detailDlg");
  function openDetail(id) {
    const v = vendors.find((x) => x.id === id);
    if (!v) return;
    const ex = execById[v.executiveId];
    $("dTitle").textContent = v.name;
    $("dBody").innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <span class="cat">${esc(v.category)}</span>
        <span class="status ${statusClass(v.status)}">${esc(v.status)}</span>
        <span class="vsub">ID ${esc(v.id)}</span>
      </div>
      <dl class="detail-grid">
        <dt>Contact person</dt><dd>${esc(v.contactPerson || "—")}</dd>
        <dt>Contact number</dt><dd><a href="tel:${esc(v.phone)}">${esc(v.phone)}</a></dd>
        <dt>Email</dt><dd>${v.email ? `<a href="mailto:${esc(v.email)}">${esc(v.email)}</a>` : "—"}</dd>
        <dt>Address</dt><dd>${esc(v.address || "—")}</dd>
        <dt>Executive</dt><dd>${ex ? `${esc(ex.name)} <span class="vsub">· ${esc(ex.phone)}</span>` : "Unassigned"}</dd>
        <dt>Onboarded on</dt><dd>${fmtDate(v.onboardedOn)}</dd>
        <dt>Services</dt><dd><div class="tags">${(v.services || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("") || "—"}</div></dd>
      </dl>
      <div class="detail-block"><h4>Profile</h4><p>${esc(v.profile || "No profile yet.")}</p></div>
      <div class="detail-block"><h4>Remarks</h4><p>${esc(v.remarks || "No remarks yet.")}</p></div>`;
    $("dFoot").innerHTML =
      (admin ? `<button class="btn btn-danger" id="delBtn">Delete</button>` : "") +
      (canEdit(v) ? `<button class="btn btn-navy" id="editBtn">Edit vendor</button>` : `<span class="vsub">Only ${esc(ex?.name || "the owner")} or an admin can edit this vendor.</span>`) +
      `<button class="btn btn-ghost" data-close>Close</button>`;
    $("dFoot").querySelector("#editBtn")?.addEventListener("click", () => { detailDlg.close(); openForm(v); });
    $("dFoot").querySelector("#delBtn")?.addEventListener("click", async () => {
      if (!confirm(`Delete ${v.name}? This is stored in this browser only.`)) return;
      C360.vendors.remove(v.id);
      detailDlg.close();
      await refresh();
      C360.toast("Vendor deleted");
    });
    detailDlg.showModal();
  }

  // ---------- add / edit ----------
  const formDlg = $("formDlg"), form = $("vForm");
  let editing = null;
  function openForm(v = null) {
    editing = v;
    form.reset();
    $("fError").style.display = "none";
    $("fTitle").textContent = v ? `Edit ${v.name}` : "Add Vendor / Service";
    $("saveBtn").textContent = v ? "Save changes" : "Add vendor";
    const data = v || { status: "Prospect", executiveId: session.executiveId };
    for (const el of form.elements) {
      if (!el.name) continue;
      el.value = el.name === "services" ? (data.services || []).join(", ") : data[el.name] ?? "";
    }
    // Executives can only assign vendors to themselves.
    form.executiveId.disabled = !admin;
    formDlg.showModal();
    $("name").focus();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (n) => form.elements[n].value.trim();
    const missing = ["name", "category", "phone"].filter((n) => !val(n));
    if (missing.length) {
      $("fError").textContent = "Please fill in vendor name, category and contact number.";
      $("fError").style.display = "block";
      return;
    }
    const record = {
      name: val("name"), category: val("category"), status: val("status"),
      services: val("services").split(",").map((s) => s.trim()).filter(Boolean),
      contactPerson: val("contactPerson"), phone: val("phone"), email: val("email"),
      area: val("area"), address: val("address"),
      executiveId: admin ? val("executiveId") : (editing?.executiveId || session.executiveId),
      onboardedOn: val("onboardedOn"), profile: val("profile"), remarks: val("remarks"),
    };
    if (editing) {
      C360.vendors.update(editing.id, record);
      C360.toast("Vendor updated");
    } else {
      C360.vendors.add({ id: C360.nextId(vendors, "V"), ...record });
      C360.toast("Vendor added");
    }
    formDlg.close();
    await refresh();
  });

  // ---------- wiring ----------
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === d) d.close(); })
  );
  $("rows").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(tr.dataset.id); });
  $("rows").addEventListener("keydown", (e) => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(tr.dataset.id); } });
  [q].forEach((el) => el.addEventListener("input", render));
  [fCategory, fExec, fStatus].forEach((el) => el.addEventListener("change", render));
  $("clearBtn").onclick = () => { q.value = ""; fCategory.value = fExec.value = fStatus.value = ""; render(); };
  $("addBtn").onclick = () => openForm();

  if (admin) {
    $("adminTools").hidden = false;
    $("exportBtn").onclick = () => C360.download("vendors.json", vendors);
    $("resetBtn").onclick = async () => {
      if (!confirm("Discard all vendor changes stored in this browser?")) return;
      C360.vendors.reset();
      await refresh();
      C360.toast("Local changes cleared");
    };
  }

  async function refresh() {
    if (!(await load())) return;
    populateFilters();
    renderKpis();
    render();
  }

  if (await load()) {
    populateFilters();
    const p = new URLSearchParams(location.search);
    q.value = p.get("q") || "";
    fCategory.value = p.get("category") || "";
    fExec.value = p.get("exec") || "";
    fStatus.value = p.get("status") || "";
    renderKpis();
    render();
  }
})();
