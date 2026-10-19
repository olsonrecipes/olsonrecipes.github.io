// Olson Family Recipes: open pages that are encrypted with the family password.
// The password is turned into a key in the browser (PBKDF2), the key decrypts the
// page (AES-GCM), and the key is remembered on this device so other pages open
// without asking again.
(function () {
  "use strict";
  var STORE = "olson-key";
  var site = document.querySelector(".site");
  var root = (site && site.getAttribute("data-root")) || "";
  var data = JSON.parse(document.getElementById("locked").textContent);
  var lock = document.getElementById("lock");
  var form = document.getElementById("lock-form");
  var pw = document.getElementById("lock-pw");
  var go = document.getElementById("lock-go");
  var err = document.getElementById("lock-err");
  var subtle = window.crypto && window.crypto.subtle;

  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toB64(buf) {
    var a = new Uint8Array(buf), s = "";
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function remembered() {
    try { return localStorage.getItem(STORE) || sessionStorage.getItem(STORE); } catch (e) { return null; }
  }
  function remember(value) {
    try { localStorage.setItem(STORE, value); return; } catch (e) { /* fall through */ }
    try { sessionStorage.setItem(STORE, value); } catch (e) { /* only this page, then */ }
  }
  function forget() {
    try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch (e) { /* nothing stored */ }
  }

  function decrypt(key, box) {
    return subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.ct))
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
  function derive(password) {
    var secret = new TextEncoder().encode(password.trim().toLowerCase());
    return subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle.deriveKey(
        { name: "PBKDF2", salt: fromB64(data.salt), iterations: data.iter, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    });
  }

  function open(key) {
    return decrypt(key, data.page).then(function (text) {
      var page = JSON.parse(text);
      var index = window.RECIPES_LOCKED ? decrypt(key, window.RECIPES_LOCKED) : Promise.resolve("[]");
      return index.then(function (idx) {
        window.RECIPES = JSON.parse(idx);
        document.title = page.title;
        site.innerHTML = page.html;
        var s = document.createElement("script");
        s.src = root + "assets/site.js";
        document.body.appendChild(s);
      });
    });
  }
  function ask() {
    lock.hidden = false;
    pw.focus();
  }

  if (!subtle || !window.TextDecoder) {
    lock.hidden = false;
    form.innerHTML = "<p>This browser is too old to open this page. Try a current version of Safari, Chrome, Edge or Firefox.</p>";
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    go.disabled = true;
    var key;
    derive(pw.value)
      .then(function (k) { key = k; return open(key); })
      .then(function () { return subtle.exportKey("raw", key); })
      .then(function (raw) { remember(toB64(raw)); })
      .catch(function () {
        go.disabled = false;
        err.hidden = false;
        pw.select();
      });
  });

  var saved = remembered();
  if (saved) {
    subtle.importKey("raw", fromB64(saved), "AES-GCM", true, ["decrypt"])
      .then(open)
      .catch(function () { forget(); ask(); });   // password changed since last visit
  } else {
    ask();
  }
})();
