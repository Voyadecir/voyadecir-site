/**
 * asst-widget.js - Floating Clara assistant widget (site-wide)
 * - Fully multilingual via window.voyT + window.VD_LANG
 * - Uses backend /api/assistant for answers
 * - Creates support tickets via /api/support when user reports an issue
 */
(function () {
  "use strict";

  const API_BASE = "https://ai-translator-i5jb.onrender.com";
  const ASSIST_URL = API_BASE + "/api/assistant";
  const SUPPORT_URL = API_BASE + "/api/support";

  const LS_LANG = "voyadecir_lang";
  const MAX_OFFTOPIC = 2;

  const $ = (s, r=document) => r.querySelector(s);

  function getLang() {
    return window.VD_LANG ||
      (function(){
        try { return localStorage.getItem(LS_LANG) || sessionStorage.getItem(LS_LANG) || "en"; } catch(e){ return "en"; }
      })();
  }

  function t(key, fallback) {
    try {
      if (typeof window.voyT === "function") return window.voyT(key, fallback);
    } catch(e){}
    return fallback;
  }

  function looksLikeIssue(msg){
    const s = (msg||"").toLowerCase();
    return /(bug|issue|problem|broken|not working|error|doesn'?t work|glitch|crash|stuck|freeze|failed|problema|no funciona|error|falló)/.test(s);
  }

  async function postJson(url, payload){
    const res = await fetch(url, {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>null);
    if(!res.ok) throw new Error((data && data.detail && data.detail.message) || "Request failed");
    return data;
  }

  function buildUI(){
    if ($(".asst-fab")) return;

    const fab = document.createElement("button");
    fab.className = "asst-fab glass";
    fab.type = "button";
    fab.setAttribute("aria-label", t("assistant.open", "Open assistant"));
    fab.textContent = t("assistant.fab", "Clara");

    const panel = document.createElement("div");
    panel.className = "asst-panel glass";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.hidden = true;

    panel.innerHTML = `
      <div class="asst-head">
        <div class="asst-title" data-asst-title>${t("assistant.title","Clara, your assistant")}</div>
        <button class="asst-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="asst-body" data-asst-body></div>
      <div class="asst-foot">
        <input class="asst-input" type="text" data-asst-input placeholder="${t("assistant.placeholder","Type your message…")}" />
        <button class="asst-send glass-button" type="button" data-asst-send>${t("assistant.send","Send")}</button>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(fab);

    const body = panel.querySelector("[data-asst-body]");
    const input = panel.querySelector("[data-asst-input]");
    const sendBtn = panel.querySelector("[data-asst-send]");
    const closeBtn = panel.querySelector(".asst-close");

    let offTopicCount = 0;

    function addMsg(text, who="bot"){
      const div=document.createElement("div");
      div.className = "asst-msg " + (who==="user" ? "user" : "bot");
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    function setStrings(){
      fab.textContent = t("assistant.fab","Clara");
      panel.querySelector("[data-asst-title]").textContent = t("assistant.title","Clara, your assistant");
      input.setAttribute("placeholder", t("assistant.placeholder","Type your message…"));
      sendBtn.textContent = t("assistant.send","Send");
    }

    async function send(){
      const msg = (input.value || "").trim();
      if(!msg) return;
      input.value="";
      addMsg(msg,"user");

      const lang = getLang();
      addMsg(t("assistant.typing","Typing…"),"bot");
      const typingEl = body.lastElementChild;

      try{
        const resp = await postJson(ASSIST_URL, { message: msg, lang });
        typingEl.remove();

        // Soft redirect behavior
        if(!/voyadecir|translate|translation|mail|bill|ocr|assistant|clara|app|android|ios/i.test(msg)){
          offTopicCount += 1;
          if(offTopicCount <= MAX_OFFTOPIC){
            addMsg(resp.reply,"bot");
            addMsg(t("assistant.offtopic","Quick note: I can answer a couple general questions, but I’m mainly here for Voyadecir help and translation."),"bot");
          } else {
            addMsg(t("assistant.offtopic","Quick note: I can answer a couple general questions, but I’m mainly here for Voyadecir help and translation."),"bot");
          }
        } else {
          offTopicCount = 0;
          addMsg(resp.reply,"bot");
        }

        // Create support ticket if it looks like a bug report
        if(looksLikeIssue(msg)){
          try{
            const ticket = await postJson(SUPPORT_URL, { message: msg, lang, page: location.pathname, userAgent: navigator.userAgent });
            addMsg(`${t("assistant.ticket_ack","Got it. I’ve created a support request for Voyadecir.")} ${t("assistant.ticket_label","Ticket")}: ${ticket.ticket_id}`,"bot");
          } catch(e){
            // fallback: still acknowledge
            addMsg(t("assistant.ticket_ack","Got it. I’ve created a support request for Voyadecir."),"bot");
          }
        }

      } catch(err){
        typingEl.remove();
        addMsg("Server error. Please try again.","bot");
      }
    }

    fab.addEventListener("click", ()=>{
      panel.hidden = !panel.hidden;
      if(!panel.hidden && body.childElementCount===0){
        addMsg(t("assistant.greeting","Hi! I’m Clara."),"bot");
      }
      if(!panel.hidden){
        setTimeout(()=>input.focus(), 50);
      }
    });

    closeBtn.addEventListener("click", ()=>{ panel.hidden=true; });
    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e)=>{
      if(e.key==="Enter") send();
    });

    window.addEventListener("voyadecir:lang-changed", setStrings);

    // Initial strings
    setStrings();
  }

  window.addEventListener("DOMContentLoaded", buildUI);
})();
