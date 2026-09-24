// DevStore website interactions. No dependencies, no trackers.
// Everything here is progressive enhancement: the download links work without JavaScript.
(() => {
  "use strict";

  const REPO = "THRISHAL12345/devstore-app";
  const DOWNLOAD = `https://github.com/${REPO}/releases/latest/download/DevStore-Setup-x64.exe`;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

  let catalog = { tools: [], recipes: [], categories: [] };
  let release = { version: "0.1.1" };
  const catalogReady = fetch("assets/catalog.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => {
      catalog = data;
      return true;
    })
    .catch(() => false);

  requestAnimationFrame(() => document.documentElement.classList.add("loaded"));

  /* ------------------------------------------------------------ release info */

  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      const version = String(data.tag_name || "").replace(/^v/, "");
      if (!/^\d+\.\d+\.\d+/.test(version)) return;
      release.version = version;
      const asset = (data.assets || []).find((a) => a.name === "DevStore-Setup-x64.exe");
      const date = data.published_at
        ? new Date(data.published_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";
      const size = asset ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : "";
      $("#release-meta").textContent = [`v${version}`, date, size, "x64", "no admin rights"]
        .filter(Boolean)
        .join(" · ");
      $("#release-meta-2").textContent = [`v${version}`, size, "free", "no account", "no telemetry"]
        .filter(Boolean)
        .join(" · ");
      $("#eyebrow-text").textContent = `v${version} is out — see what's new`;
      if (typeof data.html_url === "string" && data.html_url.startsWith("https://github.com/"))
        $("#eyebrow").href = data.html_url;
      $("#mu-version").textContent = version;
    })
    .catch(() => {
      /* offline or rate limited: keep the static text */
    });

  /* ------------------------------------------------------------ scroll-driven bits */

  const progress = $("#progress");
  const nav = $("#nav");
  const stage = $("#stage");
  const rain = $("#rain");
  let rainOpacity = 1;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    nav.classList.toggle("scrolled", scrollY > 30);
    if (stage && !reduceMotion) {
      const top = stage.getBoundingClientRect().top;
      stage.style.setProperty(
        "--p",
        clamp((innerHeight * 0.9 - top) / (innerHeight * 0.6)).toFixed(3),
      );
    }
    rainOpacity = clamp(1 - scrollY / (innerHeight * 1.1));
    rain.style.opacity = String(0.4 * rainOpacity);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // Reveal on scroll, staggered among siblings.
  const revealer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        revealer.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const el of $$(".reveal")) {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 6) * 0.07}s`);
    revealer.observe(el);
  }

  // Footer wordmark fills with the gradient when it comes into view.
  const mark = $(".footer-mark");
  new IntersectionObserver(([e]) => mark.classList.toggle("lit", e.isIntersecting), {
    threshold: 0.6,
  }).observe(mark);

  /* ------------------------------------------------------------ scramble headline */

  const GLYPHS = "!#$%&*+-=?@^_~/\\|[]{}01";
  function scramble(el, to, duration = 34) {
    return new Promise((resolve) => {
      if (reduceMotion) {
        el.textContent = to;
        return resolve();
      }
      const from = el.textContent;
      const len = Math.max(from.length, to.length);
      const q = Array.from({ length: len }, (_, i) => {
        const start = Math.floor(Math.random() * (duration * 0.4));
        return {
          from: from[i] || "",
          to: to[i] || "",
          start,
          end: start + 8 + Math.floor(Math.random() * duration * 0.6),
        };
      });
      let frame = 0;
      const tick = () => {
        let out = "";
        let done = 0;
        for (const c of q) {
          if (frame >= c.end) {
            out += c.to;
            done++;
          } else if (frame >= c.start) {
            out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          } else out += c.from;
        }
        el.textContent = out;
        if (done === q.length) return resolve();
        frame++;
        requestAnimationFrame(tick);
      };
      tick();
    });
  }
  const word = $("#scramble");
  (async () => {
    const words = ["install", "update", "upgrade", "plan"];
    let i = 0;
    await sleep(1400);
    for (;;) {
      if (document.hidden) {
        await sleep(1000);
        continue;
      }
      i = (i + 1) % words.length;
      await scramble(word, words[i]);
      await sleep(2300);
    }
  })();

  /* ------------------------------------------------------------ code rain of package IDs */

  (async () => {
    if (reduceMotion) return;
    await catalogReady;
    const ids = catalog.tools.map((t) => t.packageId).filter(Boolean);
    const words = ids.length ? ids : ["Git.Git", "OpenJS.NodeJS.LTS", "Python.Python.3.14"];
    const ctx = rain.getContext("2d");
    const FS = 14;
    let cols = [];
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = rain.clientWidth;
      h = rain.clientHeight;
      rain.width = w * dpr;
      rain.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 ${FS}px "JetBrains Mono", monospace`;
      const n = Math.ceil(w / (FS * 1.8));
      cols = Array.from({ length: n }, () => ({
        y: Math.floor(Math.random() * -40),
        s: words[Math.floor(Math.random() * words.length)],
        k: 0,
        cyan: Math.random() < 0.25,
      }));
    };
    resize();
    addEventListener("resize", resize);
    let last = 0;
    let burst = 0;
    window.__devstoreRainBurst = () => (burst = performance.now() + 6000);
    const draw = (now) => {
      requestAnimationFrame(draw);
      const fast = now < burst;
      if (now - last < (fast ? 28 : 60) || document.hidden || rainOpacity <= 0.01) return;
      last = now;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      cols.forEach((c, i) => {
        if (c.y >= 0) {
          const ch = c.s[c.k % c.s.length];
          ctx.fillStyle = c.cyan ? "rgba(34,211,238,0.85)" : "rgba(163,230,53,0.85)";
          ctx.fillText(ch, i * FS * 1.8, c.y * FS);
          c.k++;
        }
        c.y++;
        if (c.y * FS > h && Math.random() > (fast ? 0.9 : 0.975)) {
          c.y = Math.floor(Math.random() * -20);
          c.k = 0;
          c.s = words[Math.floor(Math.random() * words.length)];
        }
      });
    };
    requestAnimationFrame(draw);
  })();

  /* ------------------------------------------------------------ cursor, magnetic, tilt */

  if (finePointer && !reduceMotion) {
    const cursor = $(".cursor");
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let rx = mx;
    let ry = my;
    addEventListener("pointermove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      cursor.classList.toggle(
        "hover",
        !!e.target.closest("a, button, summary, input, .chip, .card, .belt-item"),
      );
    });
    document.addEventListener("pointerleave", () => cursor.classList.add("hidden"));
    document.addEventListener("pointerenter", () => cursor.classList.remove("hidden"));
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();

    for (const el of $$(".magnetic")) {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.32}px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    }

    for (const el of $$(".tilt")) {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--x", `${px * 100}%`);
        el.style.setProperty("--y", `${py * 100}%`);
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 7}deg) translateY(-3px)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    }
  }

  /* ------------------------------------------------------------ small feature-card animations */

  (async () => {
    const el = $("#mini-typing");
    const queries = ["pyth", "rust", "redis alt", "docker"];
    let i = 0;
    for (;;) {
      const q = queries[i++ % queries.length];
      for (let n = 1; n <= q.length; n++) {
        el.textContent = q.slice(0, n);
        await sleep(110);
      }
      await sleep(1600);
      for (let n = q.length; n >= 0; n--) {
        el.textContent = q.slice(0, n);
        await sleep(45);
      }
      await sleep(300);
      if (reduceMotion) {
        el.textContent = queries[0];
        return;
      }
    }
  })();

  (async () => {
    // Illustrative only: the real app shows the manifest's SHA-256.
    const el = $("#mini-hash");
    const HEX = "0123456789abcdef";
    const rnd = (n) =>
      Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join("");
    for (;;) {
      const target = `${rnd(10)}…${rnd(6)}`;
      if (reduceMotion) {
        el.textContent = target;
        return;
      }
      await scramble(el, target, 40);
      await sleep(3200);
    }
  })();

  /* ------------------------------------------------------------ catalog-driven UI */

  catalogReady.then((ok) => {
    if (!ok) return;
    const { tools, recipes } = catalog;

    // Two belts of tools scrolling in opposite directions.
    const make = (t) => {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "belt-item";
      const g = document.createElement("span");
      g.className = "glyph";
      g.textContent = t.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2);
      const name = document.createElement("span");
      name.textContent = t.name;
      const small = document.createElement("small");
      small.textContent = t.packageId || supportLabel(t.support)[0];
      a.append(g, name, small);
      a.addEventListener("click", () => runInTerminal(`info ${t.id}`));
      a.setAttribute("aria-label", `Show ${t.name} in the demo terminal`);
      return a;
    };
    const half = Math.ceil(tools.length / 2);
    for (const [id, list] of [
      ["#belt-a", tools.slice(0, half)],
      ["#belt-b", tools.slice(half)],
    ]) {
      const row = $(id);
      // Duplicate once for a seamless loop; the copy is hidden from assistive tech.
      for (const t of list) row.append(make(t));
      for (const t of list) {
        const c = make(t);
        c.setAttribute("aria-hidden", "true");
        c.tabIndex = -1;
        row.append(c);
      }
    }

    const envs = $("#env-chips");
    for (const r of recipes) {
      const s = document.createElement("span");
      s.textContent = r.name.replace(/ \(.*\)$/, "");
      envs.append(s);
    }

    // Honest count-up metrics.
    const values = {
      tools: tools.length,
      official: tools.filter((t) => t.officialHost).length,
      recipes: recipes.length,
      zero: 0,
    };
    const counter = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          counter.unobserve(e.target);
          const el = e.target;
          const key = el.dataset.count;
          const to = values[key];
          const from = key === "zero" ? 12 : 0;
          if (reduceMotion) {
            el.textContent = String(to);
            continue;
          }
          const t0 = performance.now();
          requestAnimationFrame(function tick(now) {
            const t = clamp((now - t0) / 1400);
            const eased = 1 - Math.pow(1 - t, 4);
            el.textContent = String(Math.round(from + (to - from) * eased));
            if (t < 1) requestAnimationFrame(tick);
          });
        }
      },
      { threshold: 0.6 },
    );
    for (const el of $$("[data-count]")) {
      if (!reduceMotion) el.textContent = el.dataset.count === "zero" ? "12" : "0";
      counter.observe(el);
    }
  });

  /* ------------------------------------------------------------ sticky "how it works" */

  const howPath = $("#how-path");
  const stepObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const step = e.target.dataset.step;
        $$(".how-step").forEach((s) => s.classList.toggle("active", s === e.target));
        $$(".how-img").forEach((img) => img.classList.toggle("active", img.dataset.step === step));
        howPath.textContent = e.target.dataset.path;
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  $$(".how-step").forEach((s) => stepObserver.observe(s));

  /* ------------------------------------------------------------ demo terminal */

  const body = $("#term-body");
  const form = $("#term-form");
  const input = $("#term-in");
  const history = [];
  let historyIndex = 0;
  let busy = false;

  /** Appends one output line. Parts are strings or [text, className] pairs; text is never parsed as HTML. */
  function out(parts, cls = "") {
    const div = document.createElement("div");
    div.className = `l ${cls}`;
    for (const p of [].concat(parts === undefined ? [""] : parts)) {
      if (Array.isArray(p)) {
        const s = document.createElement("span");
        s.className = p[1];
        s.textContent = p[0];
        div.append(s);
      } else div.append(document.createTextNode(p));
    }
    body.append(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  function box(rows, title) {
    const div = document.createElement("div");
    div.className = "l box";
    if (title) {
      const h = document.createElement("div");
      h.className = "hl";
      h.textContent = title;
      h.style.marginBottom = "6px";
      div.append(h);
    }
    const kv = document.createElement("div");
    kv.className = "kv";
    for (const [k, v, cls] of rows) {
      const a = document.createElement("span");
      a.textContent = k;
      const b = document.createElement("span");
      b.textContent = v;
      if (cls) b.className = cls;
      kv.append(a, b);
    }
    div.append(kv);
    body.append(div);
    body.scrollTop = body.scrollHeight;
  }
  function link(text, href) {
    const div = out([]);
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.className = "hl";
    div.append(a);
    return div;
  }

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  function findTool(q) {
    if (!q) return null;
    const n = norm(q);
    return (
      catalog.tools.find((t) => t.id === q.toLowerCase()) ||
      catalog.tools.find((t) => norm(t.id) === n || norm(t.name) === n) ||
      catalog.tools.find((t) => norm(t.packageId || "") === n) ||
      catalog.tools.find((t) => norm(t.id).startsWith(n) || norm(t.name).startsWith(n)) ||
      null
    );
  }
  function search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.tools
      .map((t) => {
        const hay = `${t.id} ${t.name} ${t.tags.join(" ")} ${t.publisher}`.toLowerCase();
        const deep = `${t.summary} ${t.categories.join(" ")}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (t.name.toLowerCase().startsWith(w)) score += 5;
          if (hay.includes(w)) score += 3;
          else if (deep.includes(w)) score += 1;
          else return null;
        }
        return { t, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
      .map((r) => r.t);
  }
  const supportLabel = (s) =>
    s === "native"
      ? ["native", "ok"]
      : s === "wslOrContainer"
        ? ["WSL / container", "warn"]
        : ["not on Windows", "err"];

  function toolRow(t) {
    const [label, cls] = supportLabel(t.support);
    out(
      [
        [t.id, "hl"],
        [t.name, "name"],
        [label, cls],
      ],
      "row",
    );
  }

  const COMMANDS = {
    help: {
      desc: "show this list",
      run() {
        out("DevStore demo shell. Commands:", "muted");
        for (const [name, c] of Object.entries(COMMANDS)) {
          if (c.hidden) continue;
          out(["  ", [`${name}${c.args ? ` ${c.args}` : ""}`.padEnd(26), "ok"], [c.desc, "dim"]]);
        }
        out("Tab completes · ↑/↓ history · Ctrl+K opens the palette", "dim");
      },
    },
    search: {
      args: "<query>",
      desc: "search the catalog",
      run(arg) {
        if (!arg) return out("usage: search <query>   e.g. search python", "warn");
        const alt = arg.match(/^(?:alternatives?|alt)\s+(?:to\s+)?(.+)$|^(.+?)\s+alternatives?$/i);
        if (alt) return COMMANDS.alternatives.run(alt[1] || alt[2]);
        const results = search(arg);
        if (!results.length)
          return out([`no tools match "${arg}". try `, ["search database", "ok"]], "muted");
        const native = results.filter((t) => t.support === "native").length;
        out([
          [`${results.length} result${results.length === 1 ? "" : "s"}`, "ok"],
          [` · ${native} run natively on Windows`, "dim"],
        ]);
        results.slice(0, 8).forEach(toolRow);
        if (results.length > 8) out(`  … and ${results.length - 8} more`, "dim");
        if (results[0])
          out(
            ["next: ", [`info ${results[0].id}`, "ok"], " or ", [`install ${results[0].id}`, "ok"]],
            "dim",
          );
      },
    },
    info: {
      args: "<tool>",
      desc: "details about a tool",
      run(arg) {
        const t = findTool(arg);
        if (!t) return notFound(arg, "info");
        const [label, cls] = supportLabel(t.support);
        box(
          [
            ["publisher", t.publisher],
            ["summary", t.summary],
            ["license", t.license],
            ["windows", label, cls],
            [
              "package",
              t.packageId ? `winget · ${t.packageId}` : "not installable through DevStore",
              t.packageId ? "hl" : "warn",
            ],
            [
              "official",
              t.officialHost ? `✓ ${t.officialHost}` : "no recorded official host",
              t.officialHost ? "ok" : "dim",
            ],
            ["categories", t.categories.map(catName).join(", ")],
            ["alternatives", t.alternatives.map((a) => a.id).join(", ") || "—"],
          ],
          `${t.name}  (${t.id})`,
        );
        for (const c of t.caveats) out(["⚠ ", c], "warn");
        if (t.packageId) out(["next: ", [`install ${t.id}`, "ok"]], "dim");
        else if (t.alternatives.length) out(["next: ", [`alternatives ${t.id}`, "ok"]], "dim");
      },
    },
    install: {
      args: "<tool>",
      desc: "show the install plan (demo)",
      async run(arg) {
        const t = findTool(arg);
        if (!t) return notFound(arg, "install");
        if (!t.packageId || t.support !== "native") {
          out([
            ["✗ ", "err"],
            `${t.name} doesn't run natively on Windows`,
            t.support === "wslOrContainer" ? " (use WSL or a container)." : ".",
          ]);
          const natives = t.alternatives
            .map((a) => findTool(a.id))
            .filter((a) => a && a.support === "native");
          if (natives.length)
            out(["  native alternatives: ", [natives.map((a) => a.id).join(", "), "ok"]]);
          return;
        }
        out(`resolving ${t.packageId} from winget…`, "dim");
        await sleep(450);
        box(
          [
            ["tool", t.name],
            ["source", `winget · ${t.packageId}`, "hl"],
            [
              "trust",
              t.officialHost
                ? `✓ official source · ${t.officialHost}`
                : "winget community repository",
              t.officialHost ? "ok" : "",
            ],
            ["license", t.license],
            ["arch", t.architectures.join(", ") || "x64"],
            ["admin", "the installer may show a Windows prompt; you can decline"],
            ["command", `winget install --id ${t.packageId} --exact --source winget`],
          ],
          "INSTALL PLAN — nothing runs until you press Install",
        );
        for (const c of t.caveats) out(["⚠ ", c], "warn");
        await sleep(350);
        const line = out(["▶ simulating what the app does next  ", ["", "bar"]], "muted");
        const bar = line.querySelector(".bar");
        bar.append(document.createElement("i"));
        await sleep(1500);
        out([["✓ ", "ok"], "verified: ", [t.name, "hl"], " would be detected after install"]);
        out([
          ["demo only — nothing was installed. ", "dim"],
          ["type ", "dim"],
          ["download", "ok"],
          [" to get DevStore.", "dim"],
        ]);
      },
    },
    alternatives: {
      args: "<tool>",
      desc: "find alternatives",
      run(arg) {
        const t = findTool(arg);
        if (!t) return notFound(arg, "alternatives");
        const ids = new Set(t.alternatives.map((a) => a.id));
        for (const o of catalog.tools) if (o.alternatives.some((a) => a.id === t.id)) ids.add(o.id);
        const list = [...ids].map(findTool).filter(Boolean);
        if (!list.length) return out(`no alternatives recorded for ${t.name}.`, "muted");
        out([
          [`${list.length} alternatives to ${t.name}`, "ok"],
          [` · ${list.filter((a) => a.support === "native").length} native on Windows`, "dim"],
        ]);
        list.forEach(toolRow);
      },
    },
    envs: {
      desc: "list ready-made environments",
      run() {
        out([[`${catalog.recipes.length} environments`, "ok"]]);
        for (const r of catalog.recipes) out(["  ", [r.id.padEnd(16), "hl"], r.name]);
        out(["next: ", ["env web-react", "ok"]], "dim");
      },
    },
    env: {
      args: "<id>",
      desc: "what an environment installs",
      run(arg) {
        const r =
          catalog.recipes.find((x) => x.id === (arg || "").toLowerCase()) ||
          catalog.recipes.find((x) => norm(x.id).startsWith(norm(arg || "")) && arg);
        if (!r) return out(["usage: env <id>  —  see ", ["envs", "ok"]], "warn");
        out([[r.name, "hl"]]);
        out(r.summary, "dim");
        for (const i of r.items) {
          const t = findTool(i.id);
          out([
            "  ",
            [i.role === "required" ? "●" : "○", i.role === "required" ? "ok" : "dim"],
            ` ${(t ? t.name : i.id).padEnd(26)}`,
            [i.role, "dim"],
          ]);
        }
      },
    },
    categories: {
      desc: "browse categories",
      run() {
        for (const c of catalog.categories) {
          const n = catalog.tools.filter((t) => t.categories.includes(c.id)).length;
          out(["  ", [String(n).padStart(3), "ok"], "  ", c.name]);
        }
      },
    },
    doctor: {
      desc: "check your PATH (sample)",
      async run() {
        out("reading PATH (machine + user)…", "dim");
        await sleep(500);
        out([
          ["sample output", "warn"],
          [" — a browser can't read your PATH; the app does it locally, read-only.", "dim"],
        ]);
        await sleep(300);
        out([["⚠ ", "warn"], "java: an older JRE comes before your JDK on PATH"]);
        out([["⚠ ", "warn"], "python: 3 copies found; the Microsoft Store stub is first"]);
        out([["✓ ", "ok"], "git, node, pnpm: one copy each"]);
        out([["✓ ", "ok"], "nothing executed · nothing changed"]);
      },
    },
    download: {
      desc: "get DevStore for Windows",
      run() {
        out([["↓ ", "ok"], `DevStore v${release.version} for Windows (x64, ~3 MB)`]);
        link(DOWNLOAD, DOWNLOAD);
      },
    },
    neofetch: {
      desc: "about this store",
      run() {
        const art = [
          "   ▄▄▄▄▄▄▄   ",
          "  █ ▀▄ ▄▀ █  ",
          "  █  ▄▀▄  █  ",
          "  █ ▀▀▀▀▀ █  ",
          "   ▀▀▀▀▀▀▀   ",
        ];
        const info = [
          [["devstore", "ok"], "@", ["windows", "hl"]],
          ["version   ", [release.version, "hl"]],
          ["tools     ", [String(catalog.tools.length), "hl"]],
          ["official  ", [String(catalog.tools.filter((t) => t.officialHost).length), "hl"]],
          ["envs      ", [String(catalog.recipes.length), "hl"]],
        ];
        art.forEach((a, i) => out([[a, "ok"], "  ", ...[].concat(info[i] || [])]));
      },
    },
    clear: {
      desc: "clear the screen",
      run() {
        body.textContent = "";
      },
    },
    history: {
      hidden: true,
      run() {
        history.forEach((h, i) => out(["  ", [String(i + 1).padStart(3), "dim"], "  ", h]));
      },
    },
    whoami: { hidden: true, run: () => out("a developer who reads the plan first.", "hl") },
    sudo: {
      hidden: true,
      run: () => out([["denied. ", "err"], "DevStore never elevates silently. Not even for you."]),
    },
    rm: {
      hidden: true,
      run: () =>
        out([
          ["blocked. ", "err"],
          "this shell doesn't run destructive commands. Neither does the app.",
        ]),
    },
    exit: {
      hidden: true,
      run: () => out("there is no escape. (the download button is right up there.)", "muted"),
    },
    vim: {
      hidden: true,
      run: () =>
        out(["opening vim… just kidding. You'd never get out. Try ", ["install neovim", "ok"]]),
    },
    ls: { hidden: true, run: () => COMMANDS.categories.run() },
    ping: { hidden: true, run: () => out("pong · 0 ms · all local", "ok") },
    matrix: {
      hidden: true,
      run() {
        window.__devstoreRainBurst?.();
        scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        out("wake up, developer… (look up)", "ok");
      },
    },
  };
  const ALIASES = {
    "?": "help",
    s: "search",
    i: "info",
    alt: "alternatives",
    cls: "clear",
    recipes: "envs",
    winget: "install",
  };

  function catName(id) {
    return (catalog.categories.find((c) => c.id === id) || { name: id }).name;
  }
  function notFound(arg, cmd) {
    if (!arg) return out(`usage: ${cmd} <tool>   e.g. ${cmd} git`, "warn");
    const guesses = search(arg).slice(0, 3);
    out([
      ["✗ ", "err"],
      `no tool called "${arg}".`,
      guesses.length ? " did you mean: " : "",
      [guesses.map((g) => g.id).join(", "), "ok"],
    ]);
  }

  async function exec(raw) {
    const line = raw.trim();
    out(line, "cmd");
    if (!line) return;
    history.push(line);
    historyIndex = history.length;
    let [name, ...rest] = line.replace(/^devstore\s+/i, "").split(/\s+/);
    name = name.toLowerCase();
    if (name === "winget" && rest[0] === "install")
      rest = rest.slice(1).filter((a) => !a.startsWith("-"));
    const cmd = COMMANDS[name] || COMMANDS[ALIASES[name]];
    if (!cmd) {
      out([["command not found: ", "err"], name, ["  — try ", "dim"], ["help", "ok"]]);
      return;
    }
    await cmd.run(rest.join(" ").trim());
  }

  async function runInTerminal(cmd, scroll = true) {
    if (scroll)
      $("#demo").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    await boot();
    while (busy) await sleep(100);
    busy = true;
    input.value = "";
    await sleep(scroll ? 500 : 0);
    for (const ch of cmd) {
      input.value += ch;
      await sleep(28 + Math.random() * 30);
    }
    await sleep(160);
    input.value = "";
    await exec(cmd);
    busy = false;
    if (finePointer) input.focus({ preventScroll: true });
  }

  let booted = null;
  function boot() {
    booted ||= (async () => {
      const ok = await catalogReady;
      out([
        ["DevStore demo shell", "ok"],
        [` · v${release.version}`, "dim"],
      ]);
      await sleep(250);
      if (!ok) {
        out("couldn't load the catalog; some commands won't work.", "err");
        return;
      }
      out(
        [
          `loaded `,
          [String(catalog.tools.length), "hl"],
          " tools · ",
          [String(catalog.recipes.length), "hl"],
          " environments · ",
          [String(catalog.categories.length), "hl"],
          " categories",
        ],
        "muted",
      );
      await sleep(250);
      out(
        ["type ", ["help", "ok"], " or click a command above. nothing here installs anything."],
        "dim",
      );
      out("");
    })();
    return booted;
  }
  new IntersectionObserver(
    ([e], obs) => {
      if (e.isIntersecting) {
        obs.disconnect();
        boot();
      }
    },
    { threshold: 0.3 },
  ).observe($("#term"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = input.value;
    input.value = "";
    busy = true;
    await boot();
    await exec(v);
    busy = false;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      body.textContent = "";
    }
  });
  function complete() {
    const v = input.value;
    const parts = v.split(" ");
    let pool;
    let prefix;
    if (parts.length === 1) {
      pool = Object.keys(COMMANDS).filter((c) => !COMMANDS[c].hidden);
      prefix = parts[0];
    } else {
      pool = parts[0] === "env" ? catalog.recipes.map((r) => r.id) : catalog.tools.map((t) => t.id);
      prefix = parts[parts.length - 1];
    }
    const hits = pool.filter((p) => p.startsWith(prefix.toLowerCase()));
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      input.value = parts.join(" ") + (parts.length === 1 ? " " : "");
    } else if (hits.length > 1) {
      let common = hits[0];
      for (const h of hits) while (!h.startsWith(common)) common = common.slice(0, -1);
      if (common.length > prefix.length) {
        parts[parts.length - 1] = common;
        input.value = parts.join(" ");
      } else {
        out(v, "cmd");
        out(hits.slice(0, 24).join("   "), "dim");
      }
    }
  }
  body.addEventListener("click", () => {
    if (!getSelection().toString()) input.focus({ preventScroll: true });
  });
  $$("[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => runInTerminal(b.dataset.cmd, false)),
  );

  /* ------------------------------------------------------------ Ctrl+K palette */

  const palette = $("#palette");
  const pIn = $("#palette-in");
  const pList = $("#palette-list");
  let pItems = [];
  let pActive = 0;
  let lastFocus = null;
  const SECTIONS = [
    ["Try the live demo", "#demo"],
    ["Features", "#features"],
    ["How it works", "#how"],
    ["Install steps", "#install"],
    ["FAQ", "#faq"],
    ["Download DevStore", "#download"],
  ];
  function openPalette() {
    lastFocus = document.activeElement;
    palette.hidden = false;
    pIn.value = "";
    renderPalette();
    pIn.focus();
  }
  function closePalette() {
    palette.hidden = true;
    lastFocus?.focus?.({ preventScroll: true });
  }
  function renderPalette() {
    const q = pIn.value.trim();
    const tools = q ? search(q).slice(0, 7) : [];
    const secs = SECTIONS.filter(([label]) => !q || label.toLowerCase().includes(q.toLowerCase()));
    pItems = [
      ...tools.map((t) => ({
        group: "Tools",
        label: t.name,
        hint: t.packageId || supportLabel(t.support)[0],
        run: () => runInTerminal(`info ${t.id}`),
      })),
      ...secs.map(([label, hash]) => ({
        group: "Jump to",
        label,
        hint: hash,
        run: () => $(hash).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }),
      })),
    ];
    if (q)
      pItems.push({
        group: "Demo",
        label: `Run "search ${q}" in the terminal`,
        hint: "enter",
        run: () => runInTerminal(`search ${q}`),
      });
    pActive = 0;
    pList.textContent = "";
    let group = "";
    if (!pItems.length) {
      const li = document.createElement("li");
      li.className = "pal-empty";
      li.textContent = "No matches.";
      pList.append(li);
    }
    pItems.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        const g = document.createElement("li");
        g.className = "pal-group";
        g.setAttribute("role", "presentation");
        g.textContent = group;
        pList.append(g);
      }
      const li = document.createElement("li");
      li.className = "pal-item";
      li.id = `pal-${i}`;
      li.setAttribute("role", "option");
      const label = document.createElement("span");
      label.textContent = item.label;
      const hint = document.createElement("span");
      hint.className = "hint";
      hint.textContent = item.hint;
      li.append(label, hint);
      li.addEventListener("mousemove", () => setActive(i));
      li.addEventListener("click", () => choose(i));
      pList.append(li);
    });
    setActive(0);
  }
  function setActive(i) {
    pActive = i;
    $$(".pal-item", pList).forEach((el, n) => el.setAttribute("aria-selected", String(n === i)));
    pIn.setAttribute("aria-activedescendant", pItems.length ? `pal-${i}` : "");
    $(`#pal-${i}`)?.scrollIntoView({ block: "nearest" });
  }
  function choose(i) {
    const item = pItems[i];
    closePalette();
    item?.run();
  }
  pIn.addEventListener("input", renderPalette);
  pIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((pActive + 1) % Math.max(pItems.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((pActive - 1 + pItems.length) % Math.max(pItems.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(pActive);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    }
  });
  palette.addEventListener("mousedown", (e) => {
    if (e.target === palette) closePalette();
  });
  $$("[data-open-palette]").forEach((b) => b.addEventListener("click", openPalette));
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (
      e.key === "/" &&
      palette.hidden &&
      !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")
    ) {
      e.preventDefault();
      openPalette();
    }
  });
})();
