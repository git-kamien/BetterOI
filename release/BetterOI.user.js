// ==UserScript==
// @name         BetterOI
// @namespace    https://github.com/git-kamien/BetterOI/
// @version      1.0.0
// @author       Kamień
// @description  Yeah, such a good tool deserves to be even better!
// @match        https://osint.industries/
// @match        https://osint.industries/email
// ==/UserScript==

(function () {
  'use strict';

  const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);
  let idbProxyableTypes;
  let cursorAdvanceMethods;
  function getIdbProxyableTypes() {
    return idbProxyableTypes || (idbProxyableTypes = [
      IDBDatabase,
      IDBObjectStore,
      IDBIndex,
      IDBCursor,
      IDBTransaction
    ]);
  }
  function getCursorAdvanceMethods() {
    return cursorAdvanceMethods || (cursorAdvanceMethods = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey
    ]);
  }
  const cursorRequestMap = /* @__PURE__ */ new WeakMap();
  const transactionDoneMap = /* @__PURE__ */ new WeakMap();
  const transactionStoreNamesMap = /* @__PURE__ */ new WeakMap();
  const transformCache = /* @__PURE__ */ new WeakMap();
  const reverseTransformCache = /* @__PURE__ */ new WeakMap();
  function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
      const unlisten = () => {
        request.removeEventListener("success", success);
        request.removeEventListener("error", error);
      };
      const success = () => {
        resolve(wrap(request.result));
        unlisten();
      };
      const error = () => {
        reject(request.error);
        unlisten();
      };
      request.addEventListener("success", success);
      request.addEventListener("error", error);
    });
    promise.then((value) => {
      if (value instanceof IDBCursor) {
        cursorRequestMap.set(value, request);
      }
    }).catch(() => {
    });
    reverseTransformCache.set(promise, request);
    return promise;
  }
  function cacheDonePromiseForTransaction(tx) {
    if (transactionDoneMap.has(tx))
      return;
    const done = new Promise((resolve, reject) => {
      const unlisten = () => {
        tx.removeEventListener("complete", complete);
        tx.removeEventListener("error", error);
        tx.removeEventListener("abort", error);
      };
      const complete = () => {
        resolve();
        unlisten();
      };
      const error = () => {
        reject(tx.error || new DOMException("AbortError", "AbortError"));
        unlisten();
      };
      tx.addEventListener("complete", complete);
      tx.addEventListener("error", error);
      tx.addEventListener("abort", error);
    });
    transactionDoneMap.set(tx, done);
  }
  let idbProxyTraps = {
    get(target, prop, receiver) {
      if (target instanceof IDBTransaction) {
        if (prop === "done")
          return transactionDoneMap.get(target);
        if (prop === "objectStoreNames") {
          return target.objectStoreNames || transactionStoreNamesMap.get(target);
        }
        if (prop === "store") {
          return receiver.objectStoreNames[1] ? void 0 : receiver.objectStore(receiver.objectStoreNames[0]);
        }
      }
      return wrap(target[prop]);
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    has(target, prop) {
      if (target instanceof IDBTransaction && (prop === "done" || prop === "store")) {
        return true;
      }
      return prop in target;
    }
  };
  function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
  }
  function wrapFunction(func) {
    if (func === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype)) {
      return function(storeNames, ...args) {
        const tx = func.call(unwrap(this), storeNames, ...args);
        transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
        return wrap(tx);
      };
    }
    if (getCursorAdvanceMethods().includes(func)) {
      return function(...args) {
        func.apply(unwrap(this), args);
        return wrap(cursorRequestMap.get(this));
      };
    }
    return function(...args) {
      return wrap(func.apply(unwrap(this), args));
    };
  }
  function transformCachableValue(value) {
    if (typeof value === "function")
      return wrapFunction(value);
    if (value instanceof IDBTransaction)
      cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
      return new Proxy(value, idbProxyTraps);
    return value;
  }
  function wrap(value) {
    if (value instanceof IDBRequest)
      return promisifyRequest(value);
    if (transformCache.has(value))
      return transformCache.get(value);
    const newValue = transformCachableValue(value);
    if (newValue !== value) {
      transformCache.set(value, newValue);
      reverseTransformCache.set(newValue, value);
    }
    return newValue;
  }
  const unwrap = (value) => reverseTransformCache.get(value);
  function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
      request.addEventListener("upgradeneeded", (event) => {
        upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
      });
    }
    if (blocked) {
      request.addEventListener("blocked", (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion,
        event.newVersion,
        event
      ));
    }
    openPromise.then((db) => {
      if (terminated)
        db.addEventListener("close", () => terminated());
      if (blocking) {
        db.addEventListener("versionchange", (event) => blocking(event.oldVersion, event.newVersion, event));
      }
    }).catch(() => {
    });
    return openPromise;
  }
  const readMethods = ["get", "getKey", "getAll", "getAllKeys", "count"];
  const writeMethods = ["put", "add", "delete", "clear"];
  const cachedMethods = /* @__PURE__ */ new Map();
  function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase && !(prop in target) && typeof prop === "string")) {
      return;
    }
    if (cachedMethods.get(prop))
      return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, "");
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
      // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
      !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) || !(isWrite || readMethods.includes(targetFuncName))
    ) {
      return;
    }
    const method = async function(storeName, ...args) {
      const tx = this.transaction(storeName, isWrite ? "readwrite" : "readonly");
      let target2 = tx.store;
      if (useIndex)
        target2 = target2.index(args.shift());
      return (await Promise.all([
        target2[targetFuncName](...args),
        isWrite && tx.done
      ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
  }
  replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop)
  }));
  var History_Module;
  (function(History_Module2) {
    /* @__PURE__ */ (function(typings) {
    })(History_Module2.typings || (History_Module2.typings = {}));
    (function(methods) {
      async function open_history_db() {
        const database = await openDB("osint_history", 1, {
          upgrade(db) {
            const store = db.createObjectStore("archive", {
              keyPath: "tid"
            });
            store.createIndex("by_query", "query");
            store.createIndex("by_tid", "tid");
          }
        });
        return database;
      }
      methods.open_history_db = open_history_db;
      async function archive_snapshot(value) {
        const database = await open_history_db();
        const tid = (/* @__PURE__ */ new Date()).getTime().toString(16);
        return database.add("archive", {
          ...value,
          tid
        });
      }
      methods.archive_snapshot = archive_snapshot;
      async function query_snapshots(target_query) {
        const database = await open_history_db();
        const snapshots = await database.getAllFromIndex("archive", "by_query", target_query);
        return snapshots.sort((a, b) => {
          const a_date = /* @__PURE__ */ new Date(+`0x${a.tid}`);
          const b_date = /* @__PURE__ */ new Date(+`0x${b.tid}`);
          return Number(b_date) - Number(a_date);
        });
      }
      methods.query_snapshots = query_snapshots;
      async function query_snapshot(target_tid) {
        const database = await open_history_db();
        return await database.getFromIndex("archive", "by_tid", target_tid);
      }
      methods.query_snapshot = query_snapshot;
    })(History_Module2.methods || (History_Module2.methods = {}));
  })(History_Module || (History_Module = {}));
  const any_window = window;
  var Web_Module;
  (function(Web_Module2) {
    (function(methods) {
      function get_credits() {
        const coin_image = document.querySelector("img[src*='coin.svg']");
        const coin_amount = coin_image.previousElementSibling;
        return +coin_amount.innerText;
      }
      methods.get_credits = get_credits;
      function decrement_credit() {
        const coin_image = document.querySelector("img[src*='coin.svg']");
        const coin_amount = coin_image.previousElementSibling;
        coin_amount.innerText = `${+coin_amount.innerText - 1}`;
      }
      methods.decrement_credit = decrement_credit;
      function show_results() {
        const results_wrapper = document.querySelector(".boi_results");
        results_wrapper.style.removeProperty("display");
      }
      methods.show_results = show_results;
      function hide_results() {
        const results_wrapper = document.querySelector(".boi_results");
        results_wrapper.style.setProperty("display", "none");
      }
      methods.hide_results = hide_results;
      async function update_history(predefined_index) {
        const history_select = document.querySelector(".boi_search > .history");
        const amount_indicator = history_select.querySelector("[role='amount_indicator']");
        const enter_query_input = document.querySelector(".boi_search > .enter_query");
        if (predefined_index) {
          show_results();
        }
        history_select.options.selectedIndex = predefined_index || 0;
        history_select.querySelectorAll("option:not([role='amount_indicator'])").forEach((item) => item.remove());
        const query_snapshots = await History_Module.methods.query_snapshots(enter_query_input.value);
        if (!query_snapshots.length) {
          hide_results();
          amount_indicator.innerText = "No history snapshots";
          history_select.setAttribute("disabled", "");
          return;
        }
        const extract_time = (target) => {
          const hours = target.getHours().toString().padStart(2, "0");
          const minutes = target.getMinutes().toString().padStart(2, "0");
          return `${hours}:${minutes}`;
        };
        const extract_full_date = (target) => {
          const year = target.getFullYear();
          const month = (target.getMonth() + 1).toString().padStart(2, "0");
          const day = target.getDate().toString().padStart(2, "0");
          return `${year}.${month}.${day}`;
        };
        amount_indicator.innerText = `Available: ${query_snapshots.length} history snapshots`;
        for (const single_entry of Object.values(query_snapshots)) {
          const entry_date = /* @__PURE__ */ new Date(+`0x${single_entry.tid}`);
          const new_option = document.createElement("option");
          new_option.setAttribute("tid", single_entry.tid);
          new_option.innerText = `${extract_full_date(entry_date)} | ${extract_time(entry_date)} | ${single_entry.snapshot.length} entries`;
          history_select.appendChild(new_option);
        }
        history_select.removeAttribute("disabled");
      }
      methods.update_history = update_history;
      function render_snapshot(target_snapshot) {
        document.querySelector(".boi_results > #mirror").outerHTML = `<div id="mirror" style="display: none"></div>`;
        document.querySelector(".boi_results > #map").outerHTML = `<div id="map" style="display: none"></div>`;
        const result_mirror = document.querySelector(".boi_results > #mirror");
        const result_map = document.querySelector(".boi_results > #map");
        let google_data = [];
        let strava_data = [];
        let airbnb_data = { "listing": [], "reviews_from_guest": [] };
        target_snapshot.forEach((item) => {
          if (item.module == "google" && item.data.advanced_data.m) {
            google_data = item.data.advanced_data.m.photos.concat(item.data.advanced_data.m.reviews);
          }
          if (item.module == "strava") {
            strava_data = item.data.advanced_location;
          }
          if (item.module == "airbnb") {
            airbnb_data = item.data.loc;
          }
        });
        if (google_data.length || strava_data.length || airbnb_data.listing.length || airbnb_data.reviews_from_guest.length) {
          result_map.style.display = "block";
          any_window.initMap(google_data, strava_data, airbnb_data);
        }
        result_mirror.style.display = "block";
        any_window.monaco.editor.create(result_mirror, {
          scrollBeyondLastLine: false,
          automaticLayout: true,
          language: "json",
          readOnly: true,
          minimap: {
            enabled: false
          },
          theme: "vs-dark",
          value: JSON.stringify(target_snapshot, null, 2)
        });
        return true;
      }
      methods.render_snapshot = render_snapshot;
      function build_ui() {
        const main_wrapper = document.querySelector("#main");
        const footer_wrapper = document.querySelector("#footer");
        const [top_section, bottom_section] = main_wrapper.children;
        const bottom_wrapper = document.createElement("div");
        bottom_wrapper.classList.add("boi_bottom");
        bottom_wrapper.append(bottom_section);
        bottom_wrapper.append(footer_wrapper);
        main_wrapper.appendChild(bottom_wrapper);
        const is_logout = document.querySelector("a[href='/login']");
        if (is_logout) {
          top_section.innerHTML = `
          <div class="boi_section">
            <h1>Login to your account to use the service</h1>
          </div>
        `;
          return;
        }
        top_section.innerHTML = `
        <section class="shock-section pt-5 pb-5">
          <div class="container">
            <div class="boi_search">
              <input class="item_overlay enter_query" type="text" placeholder="Search for email or phone number">
              <select class="item_overlay history form-select" disabled>
                <option role="amount_indicator" selected disabled>No history snapshots</option>
              </select>
              <div class="submitter">
                <button class="item_overlay new_snapshot" type="submit" disabled>You have to accept the rules</button>
                <div class="accept_tos">
                  <input id="tos" class="form-check-input" type="checkbox" required>
                  <label for="tos">
                    I agree to the <a href="/terms" class="link purple primary-hover"><u>terms of use</u>.</a>
                  </label>
                </div>
              </div>
              <div class="hcaptcha_renderer"></div>
            </div>
            <div class="boi_results" style="display: none">
              <div id="map"></div> 
              <div id="mirror"></div>
            </div>
          </div>
        </section>
      `;
        return true;
      }
      methods.build_ui = build_ui;
      function initialize(sitekey) {
        build_ui();
        const hcaptcha_renderer = document.querySelector(".boi_search > .hcaptcha_renderer");
        const captcha_id = any_window.hcaptcha.render(hcaptcha_renderer, {
          theme: "dark",
          sitekey
        });
        const new_snapshot_button = document.querySelector(".boi_search > .submitter > .new_snapshot");
        const enter_query_input = document.querySelector(".boi_search > .enter_query");
        const history_select = document.querySelector(".boi_search > .history");
        const tos_checkbox = document.querySelector(".boi_search > .submitter > .accept_tos > #tos");
        async function register_snapshot(captcha_result) {
          decrement_credit();
          new_snapshot_button.innerText = "Making snapshot...";
          const lookup_request = await fetch("https://osint.industries/email", {
            "method": "POST",
            "headers": {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            "body": new URLSearchParams({
              "query": enter_query_input.value,
              "terms": "on",
              "g-recaptcha-response": captcha_result.response,
              "h-captcha-response": captcha_result.response
            })
          });
          const lookup_text = await lookup_request.text();
          const lookup_html = new DOMParser().parseFromString(lookup_text, "text/html");
          const script_with_data = [...lookup_html.body.querySelectorAll("script")].find((item) => item.innerHTML.includes("jsonData"));
          const [json_with_data] = script_with_data.innerHTML.match(new RegExp("(?<=const jsonData = )(.*)(?=;)", "gm"));
          const snapshot = JSON.parse(json_with_data);
          await History_Module.methods.archive_snapshot({
            snapshot,
            query: enter_query_input.value
          });
          await update_history(1);
          render_snapshot(snapshot);
          new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
          new_snapshot_button.removeAttribute("disabled");
          tos_checkbox.removeAttribute("disabled");
        }
        function cancel_operation() {
          new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
          new_snapshot_button.removeAttribute("disabled");
          tos_checkbox.removeAttribute("disabled");
        }
        const alerts_modal = any_window.Swal.mixin({
          showConfirmButton: false,
          timerProgressBar: true,
          position: "top-end",
          timer: 2500,
          toast: true
        });
        enter_query_input.addEventListener("input", async function() {
          return await update_history();
        });
        history_select.addEventListener("change", async function() {
          const selected_option = history_select.options[history_select.options.selectedIndex];
          const selected_tid = selected_option.getAttribute("tid");
          const { snapshot } = await History_Module.methods.query_snapshot(selected_tid);
          show_results();
          render_snapshot(snapshot);
        });
        new_snapshot_button.addEventListener("click", function() {
          const user_credits = get_credits();
          if (user_credits <= 0) {
            return alerts_modal.fire({
              icon: "error",
              title: "You don't have enough credits"
            });
          }
          new_snapshot_button.innerText = `Waiting for captcha...`;
          new_snapshot_button.setAttribute("disabled", "");
          tos_checkbox.setAttribute("disabled", "");
          any_window.hcaptcha.execute(captcha_id, { async: true }).then(register_snapshot).catch(cancel_operation);
        });
        tos_checkbox.addEventListener("change", function() {
          if (tos_checkbox.checked) {
            new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
            new_snapshot_button.removeAttribute("disabled");
            return;
          }
          new_snapshot_button.innerText = "You have to accept the rules";
          new_snapshot_button.setAttribute("disabled", "");
        });
      }
      methods.initialize = initialize;
    })(Web_Module2.methods || (Web_Module2.methods = {}));
  })(Web_Module || (Web_Module = {}));
  var BOI_Loader;
  ((BOI_Loader2) => {
    BOI_Loader2.stylesheet = `
    .swal2-popup {
      background: hsl(0deg, 0%, 20%) !important;
      color: white !important;
    }
    #main {
      flex-direction: column;
      display: flex;
      height: 100vh;
    }
    #footer {
      z-index: 9999;
    }
    .boi_search {
      margin-top: 5rem;
      display: flex;
    }
    .boi_search .item_overlay {
      background: hsl(0deg, 0%, 20%);
      font-size: 0.875rem;
      max-width: 15.625rem;
      min-width: 15.625rem;
    }
    .boi_search > .hcaptcha_renderer {
      pointer-events: none;
      opacity: 0;
    }
    .boi_search > .enter_query {
      border-radius: 8px;
      text-align: center;
      position: relative;
      height: 45px;
      border: none;
      color: white;
    }
    .boi_search > .history {
      margin-left: 1.25rem;
      position: relative;
      height: 2.8rem;
      border: none;
      color: white;
    }
    .boi_search > .submitter {
      flex-direction: column;
      margin-left: 1.25rem;
      text-align: center;
      display: flex;
      gap: 0.313rem;
    }
    .boi_search > .submitter > .new_snapshot:not(:disabled):hover {
      background: hsl(0deg, 0%, 25%)
    }
    .boi_search > .submitter > .new_snapshot {
      border-radius: 0.5rem;
      height: 2.813rem;
      border: none;
      color: white;
    }
    .boi_search > .submitter > .accept_tos {
      justify-content: center;
      user-select: none;
      display: flex;
      gap: 0.625rem;
    }

    .boi_bottom {
      justify-content: flex-end;
      flex-direction: column;
      display: flex;
      height: 100%;
      width: 100%;
    }

    .boi_results {
      flex-direction: column;
      margin-top: 3rem;
      display: flex;
      gap: 3rem;
    }
    .boi_results > #map,
    .boi_results > #mirror {
      height: 40rem;
    }

    @keyframes spin_keyframes {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
    .boi_section {
      justify-content: center;
      flex-direction: column;
      align-items: center;
      display: flex; 
      height: 35.625rem; 
      width: 100%;
      color: white;
    }
    .boi_loading {
      height: 5rem;
      width: 5rem;
    }
    .boi_loading > .line {
      transform-origin: 40px 40px;
      animation: spin_keyframes 1.2s linear infinite;
    }
    .boi_loading > .line:after {
      background: gold;
      position: absolute;
      content: "";
      height: 1.25rem;
      width: 0.25rem;
      left: 2.45rem;
      top: 0.25rem;
    }
    .boi_loading > .line:nth-child(1) {
      transform: rotate(0deg);
      animation-delay: -1.1s;
    }
    .boi_loading > .line:nth-child(2) {
      transform: rotate(30deg);
      animation-delay: -1.0s;
    }
    .boi_loading > .line:nth-child(3) {
      transform: rotate(60deg);
      animation-delay: -0.9s;
    }
    .boi_loading > .line:nth-child(4) {
      transform: rotate(90deg);
      animation-delay: -0.8s;
    }
    .boi_loading > .line:nth-child(5) {
      transform: rotate(120deg);
      animation-delay: -0.7s;
    }
    .boi_loading > .line:nth-child(6) {
      transform: rotate(150deg);
      animation-delay: -0.6s;
    }
    .boi_loading > .line:nth-child(7) {
      transform: rotate(180deg);
      animation-delay: -0.5s;
    }
    .boi_loading > .line:nth-child(8) {
      transform: rotate(210deg);
      animation-delay: -0.4s;
    }
    .boi_loading > .line:nth-child(9) {
      transform: rotate(240deg);
      animation-delay: -0.3s;
    }
    .boi_loading > .line:nth-child(10) {
      transform: rotate(270deg);
      animation-delay: -0.2s;
    }
    .boi_loading > .line:nth-child(11) {
      transform: rotate(300deg);
      animation-delay: -0.1s;
    }
    .boi_loading > .line:nth-child(12) {
      transform: rotate(330deg);
      animation-delay: 0s
    }

    .swal2-popup {
      background: hsl(0deg, 0%, 20%) !important;
      color: white !important;
    }
  `;
    let Installators;
    ((Installators2) => {
      function run_monaco_editor(callback) {
        const cdn_urls = {
          "css": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.41.0/min/vs/editor/editor.main.min.css",
          "js": "https://unpkg.com/monaco-editor@latest/min/vs/loader.js",
          "vs": "https://unpkg.com/monaco-editor@latest/min/vs"
        };
        const any_window2 = window;
        const stylesheet2 = document.createElement("link");
        stylesheet2.setAttribute("data-name", "vs/editor/editor.main");
        stylesheet2.href = cdn_urls.css;
        stylesheet2.rel = "stylesheet";
        document.head.appendChild(stylesheet2);
        const loader = document.createElement("script");
        loader.onload = function() {
          any_window2.MonacoEnvironment = {
            getWorkerUrl: function() {
              return `data:text/javascript;charset=utf-8,${encodeURIComponent(
              `
              self.MonacoEnvironment = {
                baseUrl: 'https://unpkg.com/monaco-editor@latest/min/'
              };
              importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');`
            )}`;
            }
          };
          any_window2.require.config({
            "paths": {
              "vs": cdn_urls.vs
            }
          });
          any_window2.require(["vs/editor/editor.main"], callback);
        };
        loader.src = cdn_urls.js;
        document.head.appendChild(loader);
      }
      Installators2.run_monaco_editor = run_monaco_editor;
      function run_sweet_alert2() {
        const cdn_urls = {
          "css": "https://cdn.jsdelivr.net/npm/sweetalert2@11.7.27/dist/sweetalert2.min.css",
          "js": "https://cdn.jsdelivr.net/npm/sweetalert2@11.7.27/dist/sweetalert2.all.min.js"
        };
        const stylesheet2 = document.createElement("link");
        stylesheet2.href = cdn_urls.css;
        stylesheet2.rel = "stylesheet";
        const main_script = document.createElement("script");
        main_script.src = cdn_urls.js;
        document.head.appendChild(stylesheet2);
        document.head.appendChild(main_script);
      }
      Installators2.run_sweet_alert2 = run_sweet_alert2;
      function run_map() {
        const cdn_urls = {
          "js": "https://osint.industries/assets/js/map.js"
        };
        const script_wrapper = document.createElement("script");
        script_wrapper.src = cdn_urls.js;
        document.head.appendChild(script_wrapper);
      }
      Installators2.run_map = run_map;
    })(Installators = BOI_Loader2.Installators || (BOI_Loader2.Installators = {}));
    function runner() {
      const any_window2 = window;
      const banner = document.querySelector(".banner");
      if (!banner.getAttribute("boi_injected")) {
        banner.setAttribute("boi_injected", "true");
        banner.innerHTML = `
        <div class="boi_section">
          <div class="boi_loading">
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
          </div>
          <span>Loading BetterOI</span>
        </div>
      `;
      }
      if (!any_window2.L) {
        return setTimeout(runner, 100);
      }
      const stylesheet2 = new Blob([BOI_Loader2.stylesheet], { type: "text/css" });
      const link_tag = document.createElement("link");
      link_tag.href = URL.createObjectURL(stylesheet2);
      link_tag.rel = "stylesheet";
      document.head.appendChild(link_tag);
      Installators.run_map();
      Installators.run_sweet_alert2();
      Installators.run_monaco_editor(function recursive() {
        if (!any_window2.swal) {
          return setTimeout(recursive, 100);
        }
        return Web_Module.methods.initialize("4a228ca4-461e-4b4d-a3c2-dd6860ee946e");
      });
    }
    BOI_Loader2.runner = runner;
  })(BOI_Loader || (BOI_Loader = {}));
  BOI_Loader.runner();

})();