import { History_Module } from "./history";

const any_window = window as any;
module Web_Module {
  export module methods {
    export function get_credits() {
      const coin_image = document.querySelector("img[src*='coin.svg']") as HTMLImageElement;
      const coin_amount = coin_image.previousElementSibling as HTMLSpanElement;
      
      return +coin_amount.innerText;
    };
    export function decrement_credit() {
      const coin_image = document.querySelector("img[src*='coin.svg']") as HTMLImageElement;
      const coin_amount = coin_image.previousElementSibling as HTMLSpanElement;

      coin_amount.innerText = `${+coin_amount.innerText - 1}`;
    };
    export function show_results() {
      const results_wrapper = document.querySelector<HTMLDivElement>(".boi_results");
      results_wrapper.style.removeProperty("display");
    };
    export function hide_results() {
      const results_wrapper = document.querySelector<HTMLDivElement>(".boi_results");
      results_wrapper.style.setProperty("display", "none");
    };
    export async function update_history(predefined_index?: number) {
      const history_select = document.querySelector(".boi_search > .history") as HTMLSelectElement;
      const amount_indicator = history_select.querySelector("[role='amount_indicator']") as HTMLOptionElement;
      const enter_query_input = document.querySelector(".boi_search > .enter_query") as HTMLInputElement;
      if(predefined_index) {
        show_results();
      };
      history_select.options.selectedIndex = predefined_index || 0;
      history_select.querySelectorAll("option:not([role='amount_indicator'])").forEach(item => item.remove());

      const query_snapshots = await History_Module.methods.query_snapshots(enter_query_input.value);
      if(!query_snapshots.length) {
        hide_results();
        amount_indicator.innerText = "No history snapshots";
        history_select.setAttribute("disabled", "");
        return;
      };
      const extract_time = (target: Date) => {
        const hours = target.getHours().toString().padStart(2, "0");
        const minutes = target.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      };

      const extract_full_date = (target: Date) => {
        const year = target.getFullYear();
        const month = (target.getMonth() + 1).toString().padStart(2, "0");
        const day = target.getDate().toString().padStart(2, "0");
        return `${year}.${month}.${day}`;
      };

      amount_indicator.innerText = `Available: ${query_snapshots.length} history snapshots`;
      for(const single_entry of Object.values(query_snapshots)) {
        const entry_date = new Date(+`0x${single_entry.tid}`);
        
        const new_option = document.createElement("option");
        new_option.setAttribute("tid", single_entry.tid);
        new_option.innerText = `${extract_full_date(entry_date)} | ${extract_time(entry_date)} | ${single_entry.snapshot.length} entries`;

        history_select.appendChild(new_option);
      };
      history_select.removeAttribute("disabled");
    };
    export function render_snapshot(target_snapshot: History_Module.typings.Entry["snapshot"]) {
      document.querySelector(".boi_results > #mirror").outerHTML = `<div id="mirror" style="display: none"></div>`;
      document.querySelector(".boi_results > #map").outerHTML = `<div id="map" style="display: none"></div>`;
      const result_mirror = document.querySelector(".boi_results > #mirror") as HTMLDivElement;
      const result_map = document.querySelector(".boi_results > #map") as HTMLDivElement;

      let google_data = [];
      let strava_data = [];
      let airbnb_data = {"listing": [], "reviews_from_guest": []};
      
      target_snapshot.forEach((item: Record<string, any>) => {
        if(item.module == "google" && item.data.advanced_data.m) {
          google_data = item.data.advanced_data.m.photos.concat(item.data.advanced_data.m.reviews);
        };
        if(item.module == "strava") {
          strava_data = item.data.advanced_location;
        };
        if(item.module == "airbnb") {
          airbnb_data = item.data.loc;
        };
      });

      if(google_data.length || strava_data.length || airbnb_data.listing.length || airbnb_data.reviews_from_guest.length) {
        result_map.style.display = "block";
        any_window.initMap(google_data, strava_data, airbnb_data);
      };
      result_mirror.style.display = "block";

      any_window.monaco.editor.create(result_mirror, {
        scrollBeyondLastLine: false,
        automaticLayout: true,
        language: "json",
        readOnly: true,
        minimap: {
          enabled: false,
        },
        theme: "vs-dark",
        value: JSON.stringify(target_snapshot, null, 2),
      });

      return true;
    };
    export function build_ui() {
      const main_wrapper = document.querySelector("#main");
      const footer_wrapper = document.querySelector("#footer");
      const [top_section, bottom_section] = main_wrapper.children;

      const bottom_wrapper = document.createElement("div");
      bottom_wrapper.classList.add("boi_bottom");

      bottom_wrapper.append(bottom_section);
      bottom_wrapper.append(footer_wrapper);

      main_wrapper.appendChild(bottom_wrapper);
      const is_logout = document.querySelector("a[href='/login']");
      if(is_logout) {
        top_section.innerHTML = `
          <div class="boi_section">
            <h1>Login to your account to use the service</h1>
          </div>
        `;
        return;
      };
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
    };
    export function initialize(sitekey: string) {
      build_ui();

      const hcaptcha_renderer = document.querySelector(".boi_search > .hcaptcha_renderer") as HTMLDivElement; 
      const captcha_id = any_window.hcaptcha.render(hcaptcha_renderer, {
        theme: "dark",
        sitekey,
      });

      const new_snapshot_button = document.querySelector(".boi_search > .submitter > .new_snapshot") as HTMLButtonElement;
      const enter_query_input = document.querySelector(".boi_search > .enter_query") as HTMLInputElement;
      const history_select = document.querySelector(".boi_search > .history") as HTMLSelectElement;
      const tos_checkbox = document.querySelector(".boi_search > .submitter > .accept_tos > #tos") as HTMLInputElement;

      async function register_snapshot(captcha_result: { key: string, response: string }) {
        decrement_credit();
        new_snapshot_button.innerText = "Making snapshot...";
        const lookup_request = await fetch("https://osint.industries/email", {
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          "body": new URLSearchParams({
            "query": enter_query_input.value,
            "terms": "on",
            "g-recaptcha-response": captcha_result.response,
            "h-captcha-response": captcha_result.response,
          }),
        });
        const lookup_text = await lookup_request.text();
        const lookup_html = new DOMParser().parseFromString(lookup_text, "text/html");
        const script_with_data = [...lookup_html.body.querySelectorAll("script")].find(item => item.innerHTML.includes("jsonData"));
        const [json_with_data] = script_with_data.innerHTML.match(/(?<=const jsonData = )(.*)(?=;)/gm);
        
        const snapshot = JSON.parse(json_with_data) as History_Module.typings.Entry["snapshot"];
        await History_Module.methods.archive_snapshot({
          snapshot,
          query: enter_query_input.value,
        });

        await update_history(1);
        render_snapshot(snapshot);

        new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
        new_snapshot_button.removeAttribute("disabled");
        tos_checkbox.removeAttribute("disabled");
      };

      function cancel_operation() {
        new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
        new_snapshot_button.removeAttribute("disabled");
        tos_checkbox.removeAttribute("disabled");
      };

      const alerts_modal = any_window.Swal.mixin({
        showConfirmButton: false,
        timerProgressBar: true,
        position: 'top-end',
        timer: 2500,
        toast: true,
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
        if(user_credits <= 0) {
          return alerts_modal.fire({
            icon: "error",
            title: "You don't have enough credits",
          })
        };
        new_snapshot_button.innerText = `Waiting for captcha...`;
        new_snapshot_button.setAttribute("disabled", "");
        tos_checkbox.setAttribute("disabled", "");

        any_window.hcaptcha.execute(captcha_id, { async: true })
          .then(register_snapshot)
          .catch(cancel_operation);
      });

      tos_checkbox.addEventListener("change", function() {
        if(tos_checkbox.checked) {
          new_snapshot_button.innerText = "Make new snapshot (-1 credit)";
          new_snapshot_button.removeAttribute("disabled");
          return;
        };
        new_snapshot_button.innerText = "You have to accept the rules";
        new_snapshot_button.setAttribute("disabled", "");
      });
    };
  };
};

export {
  Web_Module
};
