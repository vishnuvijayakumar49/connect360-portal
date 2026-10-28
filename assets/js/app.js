/*
 * Connect360 shared runtime: data stores, auth, page shell, helpers.
 *
 * Data comes from the JSON text files in /data. Because a static Vercel site
 * cannot write files, changes made in the UI are kept as an "overlay" in
 * localStorage and merged on top of the JSON at load time. When a real backend
 * arrives, only store() needs to be swapped for API calls.
 */
const C360 = (() => {
  const SESSION_KEY = "c360.session";

  // ---------- storage helpers (never throw) ----------
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: changes last until reload */
    }
  }
  function lsDel(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  // ---------- data stores ----------
  const cache = {};
  async function loadJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(path, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
        return r.json();
      });
    }
    return cache[path];
  }

  function store(file, key, idField = "id") {
    const emptyOverlay = () => ({ added: [], updated: {}, deleted: [] });
    const read = () => ({ ...emptyOverlay(), ...lsGet(key, {}) });
    return {
      async all() {
        const base = await loadJSON(file);
        const o = read();
        const apply = (x) => (o.updated[x[idField]] ? { ...x, ...o.updated[x[idField]] } : x);
        return base
          .filter((x) => !o.deleted.includes(x[idField]))
          .map(apply)
          .concat(o.added.filter((x) => !o.deleted.includes(x[idField])));
      },
      add(item) {
        const o = read();
        o.added.push(item);
        lsSet(key, o);
      },
      update(id, patch) {
        const o = read();
        const i = o.added.findIndex((x) => x[idField] === id);
        if (i >= 0) o.added[i] = { ...o.added[i], ...patch };
        else o.updated[id] = { ...(o.updated[id] || {}), ...patch };
        lsSet(key, o);
      },
      remove(id) {
        const o = read();
        const i = o.added.findIndex((x) => x[idField] === id);
        if (i >= 0) o.added.splice(i, 1);
        else o.deleted.push(id);
        lsSet(key, o);
      },
      hasLocalChanges() {
        const o = read();
        return o.added.length + o.deleted.length + Object.keys(o.updated).length > 0;
      },
      reset() {
        lsDel(key);
      },
    };
  }

  const vendors = store("data/vendors.json", "c360.overlay.vendors");
  const executives = store("data/executives.json", "c360.overlay.executives");
  const users = store("data/users.json", "c360.overlay.users", "username");

  function nextId(list, prefix) {
    const max = list.reduce((m, x) => Math.max(m, parseInt(String(x.id).replace(/\D/g, ""), 10) || 0), 0);
    return prefix + String(max + 1).padStart(3, "0");
  }

  // ---------- auth (client-side demo only — NOT secure) ----------
  async function login(username, password) {
    const list = await users.all();
    const u = list.find((x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password);
    if (!u) return null;
    const session = { username: u.username, role: u.role, executiveId: u.executiveId };
    lsSet(SESSION_KEY, session);
    return session;
  }
  function session() {
    return lsGet(SESSION_KEY, null);
  }
  function logout() {
    lsDel(SESSION_KEY);
    location.href = "index.html";
  }
  const isAdmin = () => session()?.role === "admin";

  // ---------- helpers ----------
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    return safe.replace(re, "<mark>$1</mark>");
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  }
  const statusClass = (s) => String(s || "").toLowerCase().replace(/\s+/g, "-");

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- icons ----------
  const ICONS = {
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-4M13 17V9M18 17V5"/>',
    rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3c6.67 0 6.67-10 0-10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    trend: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    laptop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 13l4-4 3 3 5-5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    factory: '<path d="M2 20V8l6 4V8l6 4V4h8v16z"/><path d="M2 20h20"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18"/><path d="M9 20v-6h6v6"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  function renderIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  }

  const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M52 20A24 24 0 1 0 55 38" fill="none" stroke="#C9A04A" stroke-width="7" stroke-linecap="round"/>
    <path d="M44 11l14-1-4 13z" fill="#C9A04A"/>
    <path d="M43 27a12 12 0 1 0 1 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
  const brand = (href) =>
    `<a class="brand" href="${href}">${LOGO}<span><span class="word">Connect<b>360</b></span><small>BUSINESS SOLUTIONS</small></span></a>`;

  // ---------- page shell ----------
  async function shell(active, { requireAuth = true } = {}) {
    const s = session();
    if (requireAuth && !s) {
      location.replace("index.html");
      return null;
    }
    let me = null;
    if (s) {
      const execs = await executives.all().catch(() => []);
      me = execs.find((e) => e.id === s.executiveId) || null;
    }
    const links = s
      ? [["vendors", "vendors.html", "Vendors"], ["executives", "executives.html", "Executives"], ["about", "about.html", "About"], ["contact", "contact.html", "Contact"]]
      : [["about", "about.html", "About"], ["contact", "contact.html", "Contact"]];

    const header = document.getElementById("site-header");
    header.className = "site-header";
    header.innerHTML = `<div class="container bar">
        ${brand(s ? "vendors.html" : "index.html")}
        <button class="menu-toggle" aria-label="Menu">☰</button>
        <nav class="nav">${links.map(([k, h, t]) => `<a href="${h}" class="${k === active ? "active" : ""}">${t}</a>`).join("")}</nav>
        <div class="user-chip">${
          s
            ? `<div class="who">${esc(me?.name || s.username)}<span>${s.role === "admin" ? "Admin" : "Executive"}</span></div>
               <button class="btn btn-outline-light btn-sm" id="logoutBtn">Log out</button>`
            : `<a class="btn btn-gold btn-sm" href="index.html">Log in</a>`
        }</div>
      </div>`;
    header.querySelector(".menu-toggle").onclick = () => header.classList.toggle("open");
    header.querySelector("#logoutBtn")?.addEventListener("click", logout);

    const footer = document.getElementById("site-footer");
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = `<div class="container bar">
          ${brand("about.html")}
          <div class="foot-info">
            <span>Thrissur, Kerala (Operating across India)</span>
            <span>+91 98765 43210</span>
            <span>info@connect360.in</span>
            <span>www.connect360.in</span>
          </div>
          <span>© ${new Date().getFullYear()} Connect360 Business Solutions</span>
        </div>`;
    }
    renderIcons();
    return { session: s, me };
  }

  return { vendors, executives, users, nextId, login, session, logout, isAdmin, esc, highlight, fmtDate, initials, statusClass, toast, download, icon, renderIcons, brand, shell };
})();
