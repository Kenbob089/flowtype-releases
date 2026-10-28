(function () {
  var c = window.SITE_CONFIG || {};
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // site colour scheme: follows the system, the button overrides it
  var root = document.documentElement;
  try { var saved = localStorage.getItem("site-theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  var tb = document.getElementById("tbtn");
  if (tb) tb.addEventListener("click", function () {
    var cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    var next = cur === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("site-theme", next); } catch (e) {}
  });

  // config-driven bits
  $$("[data-version]").forEach(function (e) { e.textContent = c.version || ""; });
  if (c.downloadUrl) $$("[data-dl]").forEach(function (a) { a.href = c.downloadUrl; a.setAttribute("download", ""); });
  var y = document.getElementById("yr"); if (y) y.textContent = new Date().getFullYear();
  var box = document.querySelector("[data-contact]");
  if (box && (c.email || c.github)) {
    box.hidden = false;
    if (c.email) { var w = box.querySelector("[data-email-wrap]"); w.hidden = false; var a = box.querySelector("[data-email]"); a.href = "mailto:" + c.email; a.textContent = c.email; }
    if (c.github) { var g = box.querySelector("[data-gh-wrap]"); g.hidden = false; var b = box.querySelector("[data-gh]"); b.href = c.github; b.textContent = c.github.replace(/^https?:\/\//, ""); }
  }

  // header shadow + scroll progress
  var hd = document.querySelector("header.top, header.fh"), rings = document.querySelector(".rings"), pr = document.getElementById("prog");
  function onScroll() {
    var s = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if (hd) hd.classList.toggle("sc", s > 8);
    if (rings && !reduce) rings.style.setProperty("--py", Math.round(Math.min(s, 700) * -0.12) + "px");
    if (pr) pr.style.width = (h > 0 ? s / h * 100 : 0) + "%";
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // reveal on scroll
  var rvs = $$(".rv");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });
    rvs.forEach(function (e) { io.observe(e); });
  } else rvs.forEach(function (e) { e.classList.add("in"); });

  // typing preview ("natural" adds slips, fixes and pauses)
  var WRONG = { a: "s", s: "d", d: "f", e: "r", r: "t", t: "y", i: "o", o: "p", n: "m", m: "n", h: "j", l: "k", u: "i", c: "v", w: "e" };
  function visibleWatch(el) {
    var st = { v: true };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { st.v = es[0].isIntersecting; }).observe(el);
    return st;
  }
  function typer(el, opts) {
    var text = el.getAttribute("data-text") || "";
    var meter = opts.meter, vis = visibleWatch(el), run = 0;
    el.innerHTML = '<span class="t"></span><span class="caret"></span>';
    var t = el.firstChild;
    var api = { wpm: +el.getAttribute("data-wpm") || 62, natural: true };
    function prog(p) { if (meter) meter.style.width = Math.round(p * 100) + "%"; }
    if (reduce) { t.textContent = text; prog(.62); return api; }
    async function wait(ms) { await sleep(ms); while ((!vis.v || document.hidden)) await sleep(300); }
    api.go = async function () {
      var me = ++run, out = "", base = 12000 / (api.wpm * 5);
      t.textContent = ""; prog(0);
      for (var i = 0; i < text.length && me === run; i++) {
        var ch = text[i];
        if (api.natural && /[a-z]/.test(ch) && Math.random() < 0.05 && WRONG[ch]) {
          out += WRONG[ch]; t.textContent = out; await wait(base * rnd(.8, 1.6));
          await wait(rnd(240, 480));
          out = out.slice(0, -1); t.textContent = out; await wait(rnd(70, 130));
          if (me !== run) return;
        }
        out += ch; t.textContent = out; prog((i + 1) / text.length);
        var d = base * rnd(.6, 1.5);
        if (api.natural && ch === " " && Math.random() < 0.14) d += rnd(180, 480);
        if (".,".indexOf(ch) >= 0) d += rnd(120, 280);
        await wait(d);
      }
      if (me !== run) return;
      await wait(2600); if (me === run) api.go();
    };
    api.go();
    return api;
  }
  $$("[data-typer]").forEach(function (el) {
    var host = el.closest("[data-mock]") || document;
    typer(el, { meter: host.querySelector("[data-meter]") });
  });

  // typing-test card: types a paragraph, shows live speed, ends with result tiles
  $$("[data-tt]").forEach(function (card) {
    var accEl = card.querySelector("[data-acc]"), timeEl = card.querySelector("[data-time]"), txt = card.querySelector(".txt"), wpmEl = card.querySelector("[data-wpm-live]"), line = card.querySelector(".line i");
    var passage = card.getAttribute("data-passage"), vis = visibleWatch(card), run = 0;
    if (reduce) { txt.innerHTML = '<span class="d">' + passage.slice(0, 70) + '</span>' + passage.slice(70); card.classList.add("done"); return; }
    async function go() {
      var me = ++run, i = 0, t0 = performance.now(), typed = 0, bad = -1, slips = 0;
      card.classList.remove("done"); line.style.width = "0";
      function draw() {
        var done = passage.slice(0, i), rest = passage.slice(i);
        txt.innerHTML = '<span class="d">' + done.replace(/</g, "&lt;") + (bad >= 0 ? '<span class="x">' + passage[i] + "</span>" : "") + '</span><span class="caret"></span>' + rest.slice(bad >= 0 ? 1 : 0).replace(/</g, "&lt;");
      }
      draw();
      while (i < passage.length && me === run) {
        while (!vis.v || document.hidden) await sleep(300);
        if (bad < 0 && Math.random() < 0.025) { bad = i; slips++; draw(); await sleep(rnd(220, 420)); bad = -1; draw(); await sleep(rnd(100, 200)); continue; }
        i++; typed++; draw();
        line.style.width = (i / passage.length * 100) + "%";
        var el = (performance.now() - t0) / 60000;
        if (el > 0.003) wpmEl.textContent = Math.min(140, Math.round(typed / 5 / el));
        if (timeEl) timeEl.textContent = Math.round(el * 60) + "s";
        if (accEl) accEl.textContent = Math.round(100 * typed / (typed + slips)) + "%";
        var d = rnd(45, 110); if (passage[i - 1] === " " && Math.random() < .12) d += rnd(150, 350);
        await sleep(d);
      }
      if (me !== run) return;
      card.classList.add("done");
      await sleep(5200); if (me === run) go();
    }
    go();
  });

  // theme showcase: palettes are generated by the build and applied to the app window
  var showcase = document.querySelector("[data-showcase]");
  if (showcase) {
    var P = JSON.parse(showcase.getAttribute("data-palettes"));
    var win = showcase.querySelector(".win"), nameEl = showcase.querySelector(".thname");
    var cards = $$(".thc", showcase), seg = $$(".seg button", showcase);
    var cur = "Violet", mode = "dark", strip = win.querySelector(".strip");
    function apply() {
      var th = P[cur], p = th[mode], s = win.style;
      s.setProperty("--wbg", p.bg); s.setProperty("--wcard", p.card); s.setProperty("--wline", p.line); s.setProperty("--wtext", p.text);
      s.setProperty("--wmuted", p.muted); s.setProperty("--wacc", p.acc); s.setProperty("--wfg", p.fg); s.setProperty("--wfield", p.field);
      nameEl.textContent = cur + " · " + (mode === "dark" ? "Dark" : "Light");
      cards.forEach(function (b) {
        var q = P[b.getAttribute("data-n")][mode], t = b.style;
        t.setProperty("--b", q.bg); t.setProperty("--c", q.card); t.setProperty("--l", q.line); t.setProperty("--t", q.text); t.setProperty("--m", q.muted); t.setProperty("--a", q.acc);
        b.setAttribute("aria-pressed", b.getAttribute("data-n") === cur);
      });
      seg.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-m") === mode); });
      if (th.shapes) {
        strip.hidden = false;
        strip.innerHTML = th.shapes.map(function (sh, i) { return '<span style="color:' + th.cols[i % th.cols.length] + '">' + sh + "</span>"; }).join("");
      } else strip.hidden = true;
    }
    cards.forEach(function (b) { b.addEventListener("click", function () { cur = b.getAttribute("data-n"); apply(); }); });
    seg.forEach(function (b) { b.addEventListener("click", function () { mode = b.getAttribute("data-m"); apply(); }); });
    apply();
  }

  // mobile menu
  var m = document.querySelector(".menu"), nav = document.getElementById("nav");
  if (m && nav) m.addEventListener("click", function () { var o = nav.classList.toggle("open"); m.setAttribute("aria-expanded", o); });
})();
