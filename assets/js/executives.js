(async () => {
  const ctx = await C360.shell("executives");
  if (!ctx) return;
  const admin = ctx.session.role === "admin";
  const { esc, highlight, fmtDate, initials } = C360;
  const $ = (id) => document.getElementById(id);

  let execs = [], vendors = [], users = [];

  async function load() {
    try {
      [execs, vendors, users] = await Promise.all([C360.executives.all(), C360.vendors.all(), C360.users.all()]);
      return true;
    } catch {
      $("empty").hidden = false;
      $("empty").textContent = "Could not load data files. Serve the site over HTTP (see README).";
      return false;
    }
  }

  const statsFor = (id) => {
    const mine = vendors.filter((v) => v.executiveId === id);
    return { total: mine.length, active: mine.filter((v) => v.status === "Active").length };
  };

  function renderKpis() {
    const counts = execs.map((e) => ({ e, ...statsFor(e.id) }));
    const top = counts.slice().sort((a, b) => b.total - a.total)[0];
    const assigned = vendors.filter((v) => execs.some((e) => e.id === v.executiveId)).length;
    const kpi = (label, value, sub) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
    $("kpis").innerHTML =
      kpi("Executives", execs.length, "partners in the team") +
      kpi("Vendors owned", assigned, `${vendors.length - assigned} unassigned`) +
      kpi("Avg. per executive", execs.length ? (assigned / execs.length).toFixed(1) : "0", "vendors") +
      kpi("Top network", top ? esc(top.e.name.split(" ")[0]) : "—", top ? `${top.total} vendors · ${esc(top.e.sector || "")}` : "");
  }

  function render() {
    const term = $("q").value.trim();
    const t = term.toLowerCase();
    const sort = $("sort").value;
    const list = execs
      .filter((e) => !t || [e.name, e.designation, e.sector, e.phone, e.email].some((f) => String(f || "").toLowerCase().includes(t)))
      .map((e) => ({ e, ...statsFor(e.id) }))
      .sort((a, b) =>
        sort === "name" ? a.e.name.localeCompare(b.e.name)
        : sort === "joined" ? String(a.e.joinedOn).localeCompare(String(b.e.joinedOn))
        : b.total - a.total || a.e.name.localeCompare(b.e.name)
      );

    $("empty").hidden = list.length > 0;
    $("grid").innerHTML = list
      .map(({ e, total, active }) => `
        <article class="exec-card">
          <div class="top">
            <div class="avatar">${esc(initials(e.name))}</div>
            <div><h3>${highlight(e.name, term)}</h3><p>${highlight(e.designation || "Executive", term)}</p></div>
          </div>
          <div class="body">
            <dl>
              <dt>Sector</dt><dd>${highlight(e.sector || "—", term)}</dd>
              <dt>Phone</dt><dd><a href="tel:${esc(e.phone)}">${highlight(e.phone, term)}</a></dd>
              <dt>Email</dt><dd>${e.email ? `<a href="mailto:${esc(e.email)}">${highlight(e.email, term)}</a>` : "—"}</dd>
              <dt>Joined</dt><dd>${fmtDate(e.joinedOn)}</dd>
              <dt>ID</dt><dd>${esc(e.id)}</dd>
            </dl>
            <div class="muted" style="font-size:.82rem">${esc(e.bio || "")}</div>
          </div>
          <div class="exec-stats">
            <div><b>${total}</b><span>Vendors</span></div>
            <div><b>${active}</b><span>Active</span></div>
          </div>
          <div class="actions">
            <a class="btn btn-ghost btn-sm" href="vendors.html?exec=${encodeURIComponent(e.id)}">View vendors →</a>
            ${admin ? `<button class="btn btn-ghost btn-sm" data-edit="${esc(e.id)}">Edit</button>
                       <button class="btn btn-danger btn-sm" data-del="${esc(e.id)}">Delete</button>` : ""}
          </div>
        </article>`)
      .join("");
  }

  // ---------- admin: add / edit / delete ----------
  const dlg = $("formDlg"), form = $("eForm");
  let editing = null;

  function openForm(e = null) {
    editing = e;
    form.reset();
    $("fError").style.display = "none";
    $("fTitle").textContent = e ? `Edit ${e.name}` : "Add Executive";
    $("saveBtn").textContent = e ? "Save changes" : "Add executive";
    $("loginFields").hidden = !!e;
    for (const el of form.elements) if (el.name && e && el.name in e) el.value = e[el.name] ?? "";
    if (!e) form.elements.joinedOn.value = new Date().toISOString().slice(0, 10);
    dlg.showModal();
    $("ename").focus();
  }

  function fail(msg) {
    $("fError").textContent = msg;
    $("fError").style.display = "block";
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const val = (n) => form.elements[n].value.trim();
    if (!val("name") || !val("phone")) return fail("Name and phone are required.");
    const record = { name: val("name"), designation: val("designation"), phone: val("phone"), email: val("email"), sector: val("sector"), joinedOn: val("joinedOn"), bio: val("bio") };

    if (editing) {
      C360.executives.update(editing.id, record);
      C360.toast("Executive updated");
    } else {
      const username = val("username"), password = val("password");
      if (username && !password) return fail("Enter a password for the new login, or leave both login fields empty.");
      if (username && users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return fail(`Username "${username}" is already taken.`);
      const id = C360.nextId(execs, "E").replace(/^E0(\d\d)$/, "E$1");
      C360.executives.add({ id, ...record });
      if (username) C360.users.add({ username, password, role: "executive", executiveId: id });
      C360.toast(username ? `Executive added with login "${username}"` : "Executive added");
    }
    dlg.close();
    await refresh();
  });

  $("grid").addEventListener("click", async (ev) => {
    const editId = ev.target.closest("[data-edit]")?.dataset.edit;
    const delId = ev.target.closest("[data-del]")?.dataset.del;
    if (editId) openForm(execs.find((x) => x.id === editId));
    if (delId) {
      const e = execs.find((x) => x.id === delId);
      const { total } = statsFor(delId);
      if (total) return C360.toast(`Reassign ${e.name}'s ${total} vendor(s) before deleting.`);
      if (delId === ctx.session.executiveId) return C360.toast("You cannot delete your own executive record.");
      if (!confirm(`Delete ${e.name}? This is stored in this browser only.`)) return;
      C360.executives.remove(delId);
      users.filter((u) => u.executiveId === delId).forEach((u) => C360.users.remove(u.username));
      await refresh();
      C360.toast("Executive deleted");
    }
  });

  dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === dlg) dlg.close(); });
  $("q").addEventListener("input", render);
  $("sort").addEventListener("change", render);

  if (admin) {
    $("adminTools").hidden = false;
    $("addBtn").onclick = () => openForm();
    $("exportBtn").onclick = () => C360.download("executives.json", execs);
  } else {
    $("roBadge").hidden = false;
  }

  async function refresh() {
    if (!(await load())) return;
    renderKpis();
    render();
  }
  refresh();
})();
