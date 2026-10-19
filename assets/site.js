// Olson Family Recipes: search, check-offs and keep-screen-on.
(function () {
  "use strict";
  var site = document.querySelector(".site");
  var root = (site && site.getAttribute("data-root")) || "";
  var recipes = window.RECIPES || [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "");
  }

  // ---------- search ----------
  var q = document.getElementById("q");
  var box = document.getElementById("results");
  var prepared = recipes.map(function (r) {
    return { r: r, t: norm(r.t), by: norm(r.by), c: norm(r.c), k: norm(r.k) };
  });
  var active = -1;

  function score(p, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (p.t.indexOf(t) === 0) total += 8;
      else if (p.t.indexOf(" " + t) >= 0) total += 6;
      else if (p.t.indexOf(t) >= 0) total += 4;
      else if (p.by.indexOf(t) >= 0 || p.c.indexOf(t) >= 0) total += 3;
      else if (p.k.indexOf(t) >= 0) total += 1;
      else return 0;
    }
    return total;
  }
  function setActive(i) {
    var links = box.querySelectorAll("a");
    links.forEach(function (a, j) { a.classList.toggle("is-active", j === i); });
    active = i;
  }
  function render() {
    var raw = q.value.trim();
    var v = norm(raw);
    if (!v) { box.hidden = true; box.innerHTML = ""; active = -1; return; }
    var terms = v.split(/\s+/);
    var hits = prepared
      .map(function (p) { return [score(p, terms), p.r]; })
      .filter(function (x) { return x[0] > 0; })
      .sort(function (a, b) { return b[0] - a[0] || a[1].t.localeCompare(b[1].t); })
      .slice(0, 12);
    box.innerHTML = hits.length
      ? hits.map(function (h) {
          var r = h[1];
          return '<a href="' + root + "recipes/" + r.s + '.html"><span class="rt">' + esc(r.t) +
            '</span><span class="rby">' + esc(r.c) + (r.by ? " · " + esc(r.by) : "") + "</span></a>";
        }).join("")
      : '<p class="none">No recipes match “' + esc(raw) + '”.</p>';
    box.hidden = false;
    setActive(-1);
  }
  if (q && box) {
    q.addEventListener("input", render);
    q.addEventListener("focus", function () { if (q.value.trim()) render(); });
    q.addEventListener("keydown", function (e) {
      var links = box.querySelectorAll("a");
      if (e.key === "ArrowDown" && links.length) { e.preventDefault(); setActive(Math.min(active + 1, links.length - 1)); }
      else if (e.key === "ArrowUp" && links.length) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === "Enter") {
        var target = links[active >= 0 ? active : 0];
        if (target) { e.preventDefault(); location.href = target.href; }
      } else if (e.key === "Escape") { q.value = ""; render(); }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".search")) box.hidden = true;
    });
  }

  // ---------- sticky bar: height, shadow, current chapter ----------
  var mast = document.querySelector(".masthead");
  var strip = document.querySelector(".tabs-inner");
  function measure() {
    if (mast) document.documentElement.style.setProperty("--mast-h", mast.offsetHeight + "px");
  }
  measure();
  if (mast && "ResizeObserver" in window) new ResizeObserver(measure).observe(mast);
  // Phones: the bar slides away while scrolling down and comes back on any
  // scroll up. On wider screens it stays put.
  var phone = window.matchMedia ? window.matchMedia("(max-width: 51.99rem)") : { matches: false };
  var lastY = window.scrollY, quietUntil = 0, scrollTick = false;
  function setHidden(h) { if (mast) mast.classList.toggle("is-hidden", h); }
  function searching() { return (q && document.activeElement === q) || (box && !box.hidden); }
  function onScroll() {
    scrollTick = false;
    if (!mast) return;
    var y = window.scrollY, dy = y - lastY;
    mast.classList.toggle("is-stuck", y > 4);
    var atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (!phone.matches || y <= mast.offsetHeight || searching() || Date.now() < quietUntil) setHidden(false);
    else if (dy > 4) setHidden(true);
    else if (dy < -4 && !atBottom) setHidden(false);   // ignore the bounce at the bottom
    if (Math.abs(dy) > 4 || y <= 0) lastY = y;
  }
  window.addEventListener("scroll", function () {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  // Jumping to a chapter scrolls down, but the bar should stay visible.
  function hold() { quietUntil = Date.now() + 700; setHidden(false); lastY = window.scrollY; }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href*='#']");
    if (a && a.pathname === location.pathname) hold();
  });
  window.addEventListener("hashchange", hold);
  if (mast) mast.addEventListener("focusin", function () { setHidden(false); });
  if (phone.addEventListener) phone.addEventListener("change", function () { setHidden(false); });
  onScroll();
  // Arriving on a link to a chapter: land on it with the bar showing. (Locked
  // pages are filled in after the browser's own jump, so this does it again.)
  if (location.hash) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) { hold(); target.scrollIntoView(); }
  }

  // Keep the highlighted tab visible in the sideways-scrolling strip.
  function showTab(tab, smooth) {
    if (!strip || !tab) return;
    var left = tab.offsetLeft - strip.offsetLeft, pad = 24;
    if (left < strip.scrollLeft + pad || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth - pad) {
      var x = left - (strip.clientWidth - tab.offsetWidth) / 2;
      if (strip.scrollTo) strip.scrollTo({ left: x, behavior: smooth ? "smooth" : "auto" });
      else strip.scrollLeft = x;
    }
  }
  showTab(document.querySelector(".tab.is-current"), false);

  // Home page: highlight the chapter being read (the last one whose heading
  // has passed a line a third of the way down the screen).
  var chapters = Array.prototype.slice.call(document.querySelectorAll(".chapter[id^='ch-']"));
  if (chapters.length && strip) {
    var tabFor = {}, shown = null, ticking = false;
    strip.querySelectorAll(".tab[data-ch]").forEach(function (t) { tabFor[t.getAttribute("data-ch")] = t; });
    function spy() {
      ticking = false;
      var line = (mast ? mast.getBoundingClientRect().bottom : 0) + window.innerHeight * 0.3;
      var cur = null;
      chapters.forEach(function (c) { if (c.getBoundingClientRect().top <= line) cur = c.id.slice(3); });
      if (cur === shown) return;
      shown = cur;
      Object.keys(tabFor).forEach(function (k) {
        var on = k === cur;
        tabFor[k].classList.toggle("is-current", on);
        if (on) { tabFor[k].setAttribute("aria-current", "true"); showTab(tabFor[k], true); }
        else tabFor[k].removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(spy); }
    }, { passive: true });
    window.addEventListener("resize", spy);
    spy();
  }

  // ---------- recipe page: check-offs ----------
  var art = document.querySelector("article.recipe");
  if (!art) return;
  var key = "olson-checks:" + art.getAttribute("data-slug");
  var state = {};
  try { state = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { state = {}; }
  var items = Array.prototype.slice.call(art.querySelectorAll(".ingredients li, .directions li"));
  items.forEach(function (li, i) {
    li.tabIndex = 0;
    li.setAttribute("role", "checkbox");
    var on = !!state[i];
    li.classList.toggle("done", on);
    li.setAttribute("aria-checked", on ? "true" : "false");
  });
  function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* not stored */ } }
  function toggle(li) {
    var i = items.indexOf(li);
    var on = !li.classList.contains("done");
    li.classList.toggle("done", on);
    li.setAttribute("aria-checked", on ? "true" : "false");
    if (on) state[i] = 1; else delete state[i];
    save();
  }
  art.addEventListener("click", function (e) {
    var li = e.target.closest(".ingredients li, .directions li");
    if (li && !e.target.closest("a")) toggle(li);
  });
  art.addEventListener("keydown", function (e) {
    var li = e.target.closest(".ingredients li, .directions li");
    if (li && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggle(li); }
  });
  var reset = document.getElementById("reset");
  if (reset) reset.addEventListener("click", function () {
    items.forEach(function (li) { li.classList.remove("done"); li.setAttribute("aria-checked", "false"); });
    state = {};
    try { localStorage.removeItem(key); } catch (e) { /* nothing stored */ }
  });

  // ---------- keep the screen on while cooking ----------
  var wake = document.getElementById("wake");
  if (!wake || !("wakeLock" in navigator)) return;
  wake.hidden = false;
  var lock = null, wanted = false;
  function label() {
    var on = !!lock;
    wake.setAttribute("aria-pressed", on ? "true" : "false");
    wake.textContent = on ? "Screen stays on" : "Keep screen on";
  }
  function acquire() {
    return navigator.wakeLock.request("screen").then(function (l) {
      lock = l;
      lock.addEventListener("release", function () { lock = null; label(); });
      label();
    }).catch(function () {
      lock = null; wanted = false; label();
      wake.textContent = "Can’t keep the screen on here";
      wake.disabled = true;
    });
  }
  wake.addEventListener("click", function () {
    if (lock) { wanted = false; lock.release(); }
    else { wanted = true; acquire(); }
  });
  document.addEventListener("visibilitychange", function () {
    if (wanted && !lock && document.visibilityState === "visible") acquire();
  });
})();
