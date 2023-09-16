import { Web_Module } from "./web";

module BOI_Loader {
  export const stylesheet = `
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
  export module Installators {
    export function run_monaco_editor(callback: Function) {
      const cdn_urls = {
        "css": "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.41.0/min/vs/editor/editor.main.min.css",
        "js": "https://unpkg.com/monaco-editor@latest/min/vs/loader.js",
        "vs": "https://unpkg.com/monaco-editor@latest/min/vs",
      };

      const any_window = (window as any);
      const stylesheet = document.createElement("link");
      stylesheet.setAttribute("data-name", "vs/editor/editor.main");
      stylesheet.href = cdn_urls.css;
      stylesheet.rel = "stylesheet";
      document.head.appendChild(stylesheet);

      const loader = document.createElement("script");
      loader.onload = function() {
        any_window.MonacoEnvironment = { 
          getWorkerUrl: function() {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
              self.MonacoEnvironment = {
                baseUrl: 'https://unpkg.com/monaco-editor@latest/min/'
              };
              importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');`
            )}`;
          },
        };
        any_window.require.config({ 
          "paths": {
            "vs": cdn_urls.vs, 
          },
        });
        any_window.require(["vs/editor/editor.main"], callback);
      };
      loader.src = cdn_urls.js;
      document.head.appendChild(loader);
    };
    export function run_sweet_alert2() {
      const cdn_urls = {
        "css": "https://cdn.jsdelivr.net/npm/sweetalert2@11.7.27/dist/sweetalert2.min.css",
        "js": "https://cdn.jsdelivr.net/npm/sweetalert2@11.7.27/dist/sweetalert2.all.min.js",
      };
      const stylesheet = document.createElement("link");
      stylesheet.href = cdn_urls.css;
      stylesheet.rel = "stylesheet";
      
      const main_script = document.createElement("script");
      main_script.src = cdn_urls.js;

      document.head.appendChild(stylesheet);
      document.head.appendChild(main_script);
    };
    export function run_map() {
      const cdn_urls = {
        "js": "https://osint.industries/assets/js/map.js",
      };
      const script_wrapper = document.createElement("script");
      script_wrapper.src = cdn_urls.js;
      document.head.appendChild(script_wrapper);
    };
  };
  export function runner() {
    const any_window = window as any;   
    const banner = document.querySelector(".banner");
    if(!banner.getAttribute("boi_injected")) {
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
    };

    if(!any_window.L) {
      return setTimeout(runner, 100);
    };

    const stylesheet = new Blob([BOI_Loader.stylesheet], { type: "text/css"});
    const link_tag = document.createElement("link");
    link_tag.href = URL.createObjectURL(stylesheet);
    link_tag.rel = "stylesheet";
    document.head.appendChild(link_tag);

    Installators.run_map();
    Installators.run_sweet_alert2();
    Installators.run_monaco_editor(function recursive() {
      if(!any_window.swal) {
        return setTimeout(recursive, 100);
      };
      return Web_Module.methods.initialize("4a228ca4-461e-4b4d-a3c2-dd6860ee946e");
    });
  };
};

BOI_Loader.runner();
