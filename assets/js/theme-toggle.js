/**
 * theme-toggle.js
 * Toggles html[data-theme] between light/dark and persists choice.
 * Works with the SVG day/night toggle (animated via CSS).
 */
(function(){
  "use strict";
  const KEY="voyadecir_theme";

  function setTheme(next){
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch(e) {}
    try { window.dispatchEvent(new CustomEvent("voyadecir:theme-changed", {detail:{theme:next}})); } catch(e){}
  }

  function getTheme(){
    return document.documentElement.dataset.theme || "light";
  }

  function toggle(){
    const cur=getTheme();
    setTheme(cur==="dark" ? "light" : "dark");
  }

  function init(){
    const btn=document.querySelector(".theme-toggle");
    if(!btn) return;
    btn.addEventListener("click", toggle);
    btn.addEventListener("keydown", (e)=>{
      if(e.key==="Enter" || e.key===" ") { e.preventDefault(); toggle(); }
    });
  }

  window.addEventListener("DOMContentLoaded", init);
})();
