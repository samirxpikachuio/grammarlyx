import{R as F,T as D}from"./deepseek-BqkivcBP.js";const z=["password","hidden","file","checkbox","radio","submit","button","image","reset","color","range"];function w(o){const n=o.tagName.toLowerCase();if(n==="input"){const t=o,e=(t.type||"text").toLowerCase();return!(z.includes(e)||t.readOnly||t.disabled)}if(n==="textarea"){const t=o;return!t.readOnly&&!t.disabled}return o.contentEditable==="true"||o.isContentEditable}function _(o){const n="input, textarea, [contenteditable]";document.querySelectorAll(n).forEach(s=>{w(s)&&o(s)});const e=new MutationObserver(s=>{for(const r of s)for(const a of r.addedNodes)a instanceof Element&&(w(a)?o(a):a.querySelectorAll(n).forEach(l=>{w(l)&&o(l)}))});return e.observe(document.body,{childList:!0,subtree:!0}),e}const O=[{id:"improve",label:"Improve"},{id:"grammar",label:"Fix Grammar"},{id:"translate",label:"Translate"},{id:"rephrase",label:"Rephrase"},{id:"shorten",label:"Shorten"},{id:"formal",label:"Formal"},{id:"more",label:"More"}],$=[{id:"clarity",label:"Clarity & Concision"},{id:"humanize",label:"Humanize"}];function W(o,n){switch(o){case"improve":return"improve";case"grammar":return"grammar";case"rephrase":return"paraphrase";case"shorten":return"shorten";case"formal":return"formal";case"more":return n;default:return null}}class G{container;shadowRoot;panelEl=null;panelField=null;activeTab="improve";activeSubTab="clarity";handlers=null;badgeEls=new Map;spellingBadgeEls=new Map;updateScheduled=!1;constructor(){this.container=document.createElement("div"),this.container.id="open-grammarly-root",this.container.style.position="fixed",this.container.style.top="0",this.container.style.left="0",this.container.style.width="100vw",this.container.style.height="100vh",this.container.style.pointerEvents="none",this.container.style.zIndex="2147483647",document.body.appendChild(this.container),this.shadowRoot=this.container.attachShadow({mode:"open"}),this.injectStyles(),document.addEventListener("mousedown",n=>{if(this.panelEl&&!this.container.contains(n.target)){const t=this.panelField?.element;if(t&&t.contains(n.target))return;this.closePanel()}}),window.addEventListener("scroll",()=>this.scheduleReposition(),{passive:!0,capture:!0}),window.addEventListener("resize",()=>this.scheduleReposition(),{passive:!0})}scheduleReposition(){this.updateScheduled||(this.updateScheduled=!0,requestAnimationFrame(()=>{this.repositionPanel(),this.repositionBadges(),this.updateScheduled=!1}))}injectStyles(){const n=document.createElement("style");n.textContent=`
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      /* ---- Language badge ---- */
      .og-lang-badge {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 4px;
        background: #111827;
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 999px;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        z-index: 2147483646;
        user-select: none;
      }
      .og-lang-badge:hover { background: #1f2937; }
      .og-lang-badge .og-lang-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #34d399;
      }

      /* ---- Spelling badge ---- */
      .og-spelling-badge {
        position: absolute;
        background: #dc2626;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 999px;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
        z-index: 2147483646;
        user-select: none;
        white-space: nowrap;
      }
      .og-spelling-badge:hover { background: #b91c1c; }

      /* ---- Docked panel ---- */
      .og-panel {
        position: fixed;
        width: 380px;
        max-width: 92vw;
        background: linear-gradient(180deg, #ecfdf7 0%, #ffffff 55%);
        border: 1px solid #d1fae5;
        border-radius: 18px;
        box-shadow: 0 12px 40px rgba(6, 78, 59, 0.18);
        pointer-events: auto;
        overflow: hidden;
        z-index: 2147483647;
        color: #0f172a;
        animation: og-panel-in 0.14s ease-out;
      }
      @keyframes og-panel-in {
        from { transform: translateY(6px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .og-tabs {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 10px 10px 8px;
        overflow-x: auto;
        scrollbar-width: none;
        border-bottom: 1px solid rgba(16, 185, 129, 0.15);
      }
      .og-tabs::-webkit-scrollbar { display: none; }
      .og-tab-btn {
        background: none;
        border: none;
        font-size: 13px;
        font-weight: 600;
        color: #6b7280;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .og-tab-btn:hover {
        background: rgba(16, 185, 129, 0.08);
        color: #065f46;
      }
      .og-tab-btn.og-tab-active {
        color: #047857;
        background: rgba(16, 185, 129, 0.12);
      }

      .og-panel-close {
        margin-left: auto;
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .og-panel-close:hover {
        background: rgba(0,0,0,0.05);
        color: #374151;
      }

      .og-panel-body {
        padding: 14px 16px 12px;
        max-height: 340px;
        overflow-y: auto;
      }

      .og-mode-heading {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #059669;
        margin-bottom: 8px;
      }

      .og-more-heading {
        margin-top: 14px;
        font-size: 11px;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .og-diff-text {
        font-size: 14px;
        line-height: 1.65;
        color: #1f2937;
        white-space: pre-wrap;
      }
      .og-diff-del {
        color: #9ca3af;
        text-decoration: line-through;
        text-decoration-color: #f87171;
      }
      .og-diff-ins {
        color: #047857;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.12);
        border-radius: 3px;
        padding: 0 2px;
      }

      .og-empty-state, .og-loading-state, .og-error-state {
        font-size: 13px;
        color: #6b7280;
        padding: 10px 2px 4px;
      }
      .og-error-state { color: #dc2626; }

      .og-loading-state {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .og-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #a7f3d0;
        border-top-color: #059669;
        border-radius: 50%;
        animation: og-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes og-spin { to { transform: rotate(360deg); } }

      .og-suggestion-item {
        border-bottom: 1px solid rgba(16, 185, 129, 0.1);
        padding: 10px 0;
      }
      .og-suggestion-item:last-child { border-bottom: none; }
      .og-suggestion-explanation {
        font-size: 11.5px;
        color: #6b7280;
        margin-top: 6px;
      }
      .og-suggestion-accept-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }
      .og-mini-accept {
        background: #d1fae5;
        color: #065f46;
        border: none;
        font-size: 11.5px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      .og-mini-accept:hover { background: #a7f3d0; }

      .og-panel-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 16px 14px;
      }
      .og-btn {
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: none;
      }
      .og-btn-primary { background: #059669; color: white; }
      .og-btn-primary:hover { background: #047857; }
      .og-btn-primary:disabled {
        background: #a7f3d0;
        color: #d1fae5;
        cursor: not-allowed;
      }
      .og-btn-icon {
        background: rgba(0,0,0,0.04);
        border: none;
        border-radius: 8px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #4b5563;
        flex-shrink: 0;
      }
      .og-btn-icon:hover { background: rgba(0,0,0,0.08); }

      /* ---- Translate tab ---- */
      .og-translate-select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #d1fae5;
        background: white;
        font-size: 13px;
        color: #1f2937;
        margin-bottom: 10px;
        cursor: pointer;
      }
      .og-translate-result {
        font-size: 14px;
        color: #1f2937;
        background: white;
        border: 1px solid #d1fae5;
        border-radius: 10px;
        padding: 10px 12px;
        white-space: pre-wrap;
        min-height: 40px;
      }
      .og-translate-detected {
        font-size: 11.5px;
        color: #6b7280;
        margin-top: 8px;
      }

      /* ---- Toast ---- */
      .og-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        max-width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: og-slide-in 0.3s ease-out;
        z-index: 2147483647;
      }
      .og-toast.og-error { background: #dc2626; }
      .og-toast.og-warning { background: #d97706; }
      .og-toast.og-success { background: #059669; }
      .og-toast-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        margin-left: auto;
        opacity: 0.7;
      }
      .og-toast-close:hover { opacity: 1; }
      .og-toast-action {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }
      .og-toast-action:hover { background: rgba(255,255,255,0.3); }
      @keyframes og-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `,this.shadowRoot.appendChild(n)}showLanguageBadge(n,t,e){const s=this.getElementId(n);this.hideLanguageBadge(n);const r=document.createElement("div");r.className="og-lang-badge",r.dataset.elementId=s,r.innerHTML='<span class="og-lang-dot"></span><span></span>',r.querySelector("span:last-child").textContent=t,r.addEventListener("mousedown",a=>{a.preventDefault(),a.stopPropagation(),e()}),this.shadowRoot.appendChild(r),this.badgeEls.set(s,r),this.positionBadge(n,r)}hideLanguageBadge(n){const t=this.getElementId(n),e=this.badgeEls.get(t);e&&(e.remove(),this.badgeEls.delete(t))}showSpellingBadge(n,t,e){const s=this.getElementId(n);this.hideSpellingBadge(n);const r=document.createElement("div");r.className="og-spelling-badge",r.textContent=`${t} misspelling${t>1?"s":""}`,r.addEventListener("mousedown",a=>{a.preventDefault(),a.stopPropagation(),e()}),this.shadowRoot.appendChild(r),this.spellingBadgeEls.set(s,r),this.positionSpellingBadge(n,r)}hideSpellingBadge(n){const t=this.getElementId(n),e=this.spellingBadgeEls.get(t);e&&(e.remove(),this.spellingBadgeEls.delete(t))}positionSpellingBadge(n,t){const e=n.getBoundingClientRect();t.style.left=`${e.right-10}px`,t.style.top=`${e.bottom+6}px`;const s=t.getBoundingClientRect();s.right>window.innerWidth&&(t.style.left=`${window.innerWidth-s.width-8}px`),s.left<0&&(t.style.left="8px")}positionBadge(n,t){const e=n.getBoundingClientRect();t.style.left=`${e.right-10}px`,t.style.top=`${e.top-10}px`;const s=t.getBoundingClientRect();s.right>window.innerWidth&&(t.style.left=`${window.innerWidth-s.width-8}px`),s.top<0&&(t.style.top=`${e.bottom+4}px`)}repositionBadges(){this.badgeEls.forEach((n,t)=>{const e=this.findFieldById(t);if(!e||!document.body.contains(e)){n.remove(),this.badgeEls.delete(t);return}this.positionBadge(e,n)}),this.spellingBadgeEls.forEach((n,t)=>{const e=this.findFieldById(t);if(!e||!document.body.contains(e)){n.remove(),this.spellingBadgeEls.delete(t);return}this.positionSpellingBadge(e,n)})}findFieldById(n){return document.querySelector(`[data-og-id="${n}"]`)}getElementId(n){return n.dataset.ogId||(n.dataset.ogId=Math.random().toString(36).substr(2,9)),n.dataset.ogId}openPanel(n,t,e){this.closePanel(),this.panelField=n,this.activeTab=t,this.handlers=e;const s=document.createElement("div");return s.className="og-panel",s.innerHTML=`
      <div class="og-tabs"></div>
      <div class="og-panel-body"></div>
      <div class="og-panel-footer"></div>
    `,this.shadowRoot.appendChild(s),this.panelEl=s,this.renderTabs(),this.repositionPanel(),t==="translate"?this.renderTranslatePrompt():t==="more"?this.renderMoreMenu():(this.renderLoading(),e.onRequestMode(t,null)),{setLoading:()=>this.renderLoading(),setCorrections:r=>this.renderCorrections(r),setTranslateResult:(r,a)=>this.renderTranslateResult(r,a),setRewriteResult:r=>this.renderRewriteResult(r),setError:r=>this.renderError(r),isOpen:()=>this.panelEl===s}}closePanel(){this.panelEl&&(this.panelEl.remove(),this.panelEl=null),this.panelField=null,this.handlers=null}isPanelOpenFor(n){return!!this.panelEl&&this.panelField?.element===n}getActiveTab(){return this.activeTab}repositionPanel(){if(!this.panelEl||!this.panelField)return;const n=this.panelField.element.getBoundingClientRect();let t=n.left,e=n.bottom+8;const s=this.panelEl.getBoundingClientRect(),r=s.width||380;t+r>window.innerWidth-10&&(t=Math.max(10,window.innerWidth-r-10)),e+200>window.innerHeight&&(e=Math.max(10,n.top-8-(s.height||220))),this.panelEl.style.left=`${t}px`,this.panelEl.style.top=`${e}px`}renderTabs(){if(!this.panelEl||!this.handlers)return;const n=this.handlers,t=this.panelEl.querySelector(".og-tabs");t.innerHTML="",O.forEach(s=>{const r=document.createElement("button");r.className="og-tab-btn"+(this.activeTab===s.id?" og-tab-active":""),r.textContent=s.label,r.addEventListener("mousedown",a=>{a.preventDefault(),a.stopPropagation(),this.activeTab=s.id,this.renderTabs(),s.id==="more"?this.renderMoreMenu():s.id==="translate"?this.renderTranslatePrompt():(this.renderLoading(),n.onRequestMode(s.id,null))}),t.appendChild(r)});const e=document.createElement("button");e.className="og-panel-close",e.textContent="×",e.addEventListener("mousedown",s=>{s.preventDefault(),s.stopPropagation(),this.closePanel()}),t.appendChild(e)}renderMoreMenu(){if(!this.panelEl||!this.handlers)return;const n=this.handlers,t=this.panelEl.querySelector(".og-panel-body"),e=this.panelEl.querySelector(".og-panel-footer");e.innerHTML="",t.innerHTML='<div class="og-mode-heading">Choose a mode</div>';const s=document.createElement("div");$.forEach(i=>{const l=document.createElement("button");l.className="og-tab-btn",l.style.display="block",l.style.width="100%",l.style.textAlign="left",l.style.padding="10px 8px",l.textContent=i.label,l.addEventListener("mousedown",c=>{c.preventDefault(),c.stopPropagation(),this.activeSubTab=i.id,this.renderLoading(),n.onRequestMode("more",i.id)}),s.appendChild(l)}),t.appendChild(s);const r=document.createElement("div");r.className="og-more-heading",r.textContent="Rewrite with tone",t.appendChild(r);const a=document.createElement("div");F.forEach(i=>{const l=document.createElement("button");l.className="og-tab-btn",l.style.display="block",l.style.width="100%",l.style.textAlign="left",l.style.padding="10px 8px",l.textContent=i.label,l.addEventListener("mousedown",c=>{c.preventDefault(),c.stopPropagation(),this.renderLoading(),n.onToneRequest(i.id)}),a.appendChild(l)}),t.appendChild(a),this.scheduleReposition()}renderLoading(){if(!this.panelEl)return;const n=this.panelEl.querySelector(".og-panel-body"),t=this.panelEl.querySelector(".og-panel-footer");n.innerHTML='<div class="og-loading-state"><span class="og-spinner"></span>Checking…</div>',t.innerHTML="",this.scheduleReposition()}renderError(n){if(!this.panelEl)return;const t=this.panelEl.querySelector(".og-panel-body"),e=this.panelEl.querySelector(".og-panel-footer");t.innerHTML='<div class="og-error-state"></div>',t.querySelector(".og-error-state").textContent=n,e.innerHTML="",this.scheduleReposition()}modeHeading(){if(this.activeTab==="more")return this.activeSubTab==="clarity"?"Clarity & Concision":"Humanize";switch(this.activeTab){case"improve":return"Improved version";case"grammar":return"Fix grammar errors";case"rephrase":return"Rephrase suggestions";case"shorten":return"Shorten wordy sentences";case"formal":return"Make it formal";default:return"Suggestions"}}renderCorrections(n){if(!this.panelEl||!this.handlers)return;const t=this.handlers,e=this.panelEl.querySelector(".og-panel-body"),s=this.panelEl.querySelector(".og-panel-footer");if(n.length===0){const a=this.activeTab==="grammar"?"✓ Nothing to change here — looks good!":"No changes suggested — try a different mode";e.innerHTML='<div class="og-empty-state"></div>',e.querySelector(".og-empty-state").textContent=a,s.innerHTML="",this.scheduleReposition();return}e.innerHTML='<div class="og-mode-heading"></div><div class="og-suggestion-list"></div>',e.querySelector(".og-mode-heading").textContent=this.modeHeading();const r=e.querySelector(".og-suggestion-list");if(n.forEach(a=>{const i=document.createElement("div");i.className="og-suggestion-item";const l=document.createElement("div");if(l.className="og-diff-text",l.appendChild(this.renderDiffSpan(a)),i.appendChild(l),a.explanation){const p=document.createElement("div");p.className="og-suggestion-explanation",p.textContent=a.explanation,i.appendChild(p)}const c=document.createElement("div");c.className="og-suggestion-accept-row";const u=document.createElement("button");u.className="og-mini-accept",u.textContent="Accept",u.addEventListener("mousedown",p=>{p.preventDefault(),p.stopPropagation(),t.onAccept(a)}),c.appendChild(u),i.appendChild(c),r.appendChild(i)}),s.innerHTML='<span style="font-size:12px;color:#6b7280;"></span>',s.querySelector("span").textContent=`${n.length} suggestion${n.length>1?"s":""}`,n.length>1&&this.activeTab!=="grammar"){const a=document.createElement("button");a.className="og-btn og-btn-primary",a.textContent="Accept All",a.addEventListener("mousedown",i=>{i.preventDefault(),i.stopPropagation(),t.onAcceptAll(n)}),s.appendChild(a)}this.scheduleReposition()}renderDiffSpan(n){const t=document.createDocumentFragment(),e=document.createElement("span");e.className="og-diff-del",e.textContent=n.original;const s=document.createElement("span");return s.className="og-diff-ins",s.textContent=n.suggestion,t.appendChild(e),t.appendChild(document.createTextNode(" ")),t.appendChild(s),t}renderTranslatePrompt(){if(!this.panelEl||!this.handlers)return;const n=this.handlers,t=this.panelEl.querySelector(".og-panel-body"),e=this.panelEl.querySelector(".og-panel-footer");e.innerHTML="",t.innerHTML=`
      <div class="og-mode-heading">Translate to</div>
      <select class="og-translate-select"></select>
    `;const s=t.querySelector(".og-translate-select");D.forEach(a=>{const i=document.createElement("option");i.value=a.name,i.textContent=a.name,s.appendChild(i)});const r=document.createElement("button");r.className="og-btn og-btn-primary",r.style.marginTop="10px",r.style.width="100%",r.textContent="Translate",r.addEventListener("mousedown",a=>{a.preventDefault(),a.stopPropagation(),this.renderLoading(),n.onTranslateRequest(s.value)}),t.appendChild(r),this.scheduleReposition()}renderTranslateResult(n,t){if(!this.panelEl||!this.handlers)return;const e=this.handlers,s=this.panelEl.querySelector(".og-panel-body"),r=this.panelEl.querySelector(".og-panel-footer");s.innerHTML=`
      <div class="og-mode-heading">Translated</div>
      <div class="og-translate-result"></div>
      <div class="og-translate-detected"></div>
    `,s.querySelector(".og-translate-result").textContent=n,s.querySelector(".og-translate-detected").textContent=`Detected source language: ${t}`,r.innerHTML="";const a=document.createElement("button");a.className="og-btn-icon",a.title="Copy translation",a.textContent="⧉",a.addEventListener("mousedown",l=>{l.preventDefault(),l.stopPropagation(),e.onCopy(n)}),r.appendChild(a);const i=document.createElement("button");i.className="og-btn og-btn-primary",i.textContent="Replace",i.addEventListener("mousedown",l=>{l.preventDefault(),l.stopPropagation(),e.onTranslateReplace(n)}),r.appendChild(i),this.scheduleReposition()}renderRewriteResult(n){if(!this.panelEl||!this.handlers)return;const t=this.handlers,e=this.panelEl.querySelector(".og-panel-body"),s=this.panelEl.querySelector(".og-panel-footer");e.innerHTML=`
      <div class="og-mode-heading">Rewritten</div>
      <div class="og-translate-result"></div>
    `,e.querySelector(".og-translate-result").textContent=n,s.innerHTML="";const r=document.createElement("button");r.className="og-btn-icon",r.title="Copy rewrite",r.textContent="⧉",r.addEventListener("mousedown",i=>{i.preventDefault(),i.stopPropagation(),t.onCopy(n)}),s.appendChild(r);const a=document.createElement("button");a.className="og-btn og-btn-primary",a.textContent="Replace",a.addEventListener("mousedown",i=>{i.preventDefault(),i.stopPropagation(),t.onToneReplace(n)}),s.appendChild(a),this.scheduleReposition()}showToast(n,t="info",e){this.shadowRoot.querySelectorAll(".og-toast").forEach(i=>i.remove());const s=document.createElement("div");s.className=`og-toast og-${t}`;let r=`<span>${n}</span>`;e?.action&&e?.onAction&&(r+=`<button class="og-toast-action">${e.action}</button>`),r+='<button class="og-toast-close">×</button>',s.innerHTML=r,s.querySelector(".og-toast-close")?.addEventListener("click",()=>s.remove()),e?.action&&e?.onAction&&s.querySelector(".og-toast-action")?.addEventListener("click",()=>{e.onAction(),s.remove()}),this.shadowRoot.appendChild(s);const a=e?.duration??(t==="error"?8e3:5e3);a>0&&setTimeout(()=>{this.shadowRoot.contains(s)&&s.remove()},a)}}const d=new G,v=new Set,C=new WeakMap,m=new WeakMap,R=new WeakMap,X=900,j=5,Y=12;let h=null,k=0;function g(o){return o instanceof HTMLInputElement||o instanceof HTMLTextAreaElement?o.value:o.innerText||o.textContent||""}function L(o,n,t){const e=document.createRange();let s=0,r=!1;for(let a=0;a<o.length;a++){const i=o[a].textContent?.length||0;if(!r&&n>=s&&n<=s+i&&(e.setStart(o[a],n-s),r=!0),r&&t<=s+i)return e.setEnd(o[a],t-s),e;s+=i}return null}function U(o){return o.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function A(o,n,t){if(!n)return null;const e=[],s=document.createTreeWalker(o,NodeFilter.SHOW_TEXT,null);let r;for(;r=s.nextNode();)e.push(r);if(e.length===0)return null;const a=e.map(u=>u.textContent).join("");let i=a.indexOf(n);if(i===-1){const p=new RegExp(U(n).replace(/\s+/g,"\\s*"),"i").exec(a);if(p){let x=p.index,E=p.index+p[0].length;const H=(p[0].match(/^\s*/)||[""])[0].length,I=(p[0].match(/\s*$/)||[""])[0].length;return x+=H,E-=I,E<=x?null:L(e,x,E)}return null}const l=Math.max(0,t-40),c=a.indexOf(n,l);return c!==-1&&(i=c),L(e,i,i+n.length)}function Z(o,n,t){try{n.deleteContents(),n.insertNode(document.createTextNode(t));const e=window.getSelection();return e&&e.removeAllRanges(),!0}catch{return!1}}function S(o,n,t,e,s){if(!e||s==null)return!1;if(o instanceof HTMLInputElement||o instanceof HTMLTextAreaElement){const r=o.value,a=r.substring(n,t);let i=n,l=t;if(a!==e){const c=r.indexOf(e);if(c===-1)return!1;i=c,l=c+e.length}return o.value=r.substring(0,i)+s+r.substring(l),o.dispatchEvent(new Event("input",{bubbles:!0})),!0}try{const r=A(o,e,n);if(r){if(document.activeElement===o&&document.hasFocus()){const c=g(o),u=window.getSelection();if(u){u.removeAllRanges(),u.addRange(r.cloneRange());let p=!1;try{p=document.execCommand("insertText",!1,s)}catch{p=!1}if(p&&g(o)!==c)return o.dispatchEvent(new Event("input",{bubbles:!0})),!0}}if(Z(o,r,s))return o.dispatchEvent(new Event("input",{bubbles:!0})),!0}const a=g(o),i=a.indexOf(e);if(i===-1)return!1;const l=a.slice(0,i)+s+a.slice(i+e.length);return T(o,l)?(o.dispatchEvent(new Event("input",{bubbles:!0})),!0):!1}catch{return!1}}function T(o,n){if(o instanceof HTMLInputElement||o instanceof HTMLTextAreaElement)return o.value=n,o.dispatchEvent(new Event("input",{bubbles:!0})),!0;try{if(document.activeElement===o&&document.hasFocus()){const t=g(o),e=window.getSelection();if(e){const s=document.createRange();s.selectNodeContents(o),e.removeAllRanges(),e.addRange(s);let r=!1;try{r=document.execCommand("insertText",!1,n)}catch{r=!1}if(r&&g(o)!==t)return o.dispatchEvent(new Event("input",{bubbles:!0})),!0}}for(;o.firstChild;)o.removeChild(o.firstChild);return o.appendChild(document.createTextNode(n)),o.dispatchEvent(new Event("input",{bubbles:!0})),!0}catch{return!1}}function N(o){const n=g(o);if(n.length<j){m.set(o,n);return}if(m.get(o)===n)return;const t=C.get(o);t&&window.clearTimeout(t);const e=window.setTimeout(()=>{m.set(o,n),V(o,n),J(o,n)},X);C.set(o,e)}async function V(o,n){if(d.isPanelOpenFor(o)&&d.getActiveTab()!=="grammar")return;const t=await chrome.runtime.sendMessage({type:"ANALYZE_TEXT",text:n});if(t)if(t.success){const e=t.data.corrections;if(P(o,e),e.length===0)return;d.isPanelOpenFor(o)?h?.setCorrections(e):f(o,"grammar")}else t.error&&!t.error.includes("disabled")&&d.showToast(`Check failed: ${t.error}`,"error")}async function J(o,n){if(n.trim().length<Y)return;const t=o._ogLangCheckedLength||0;if(Math.abs(n.length-t)<40&&R.has(o))return;o._ogLangCheckedLength=n.length;const e=await chrome.runtime.sendMessage({type:"DETECT_LANGUAGE",text:n});if(e?.success){const s=e.data.language;R.set(o,s),d.showLanguageBadge(o,s,()=>{f(o,"translate")})}}function f(o,n){return k=Date.now(),h=d.openPanel({element:o},n,{onRequestMode:(t,e)=>y(o,t,e),onAccept:t=>{if(!S(o,t.start,t.end,t.original,t.suggestion)){d.showToast("Could not apply that suggestion — the text has changed, try again","error");return}m.set(o,g(o)),y(o,d.getActiveTab(),null)},onAcceptAll:t=>{const e=[...t].sort((r,a)=>a.start-r.start);let s=0;for(const r of e)S(o,r.start,r.end,r.original,r.suggestion)||s++;s>0&&d.showToast(`Applied ${e.length-s} of ${e.length} suggestions`,"warning",{duration:4e3}),m.set(o,g(o)),y(o,d.getActiveTab(),null)},onTranslateRequest:t=>K(o,t),onTranslateReplace:t=>{const e=T(o,t);m.set(o,g(o)),d.closePanel(),h=null,e?d.showToast("Replaced","success",{duration:2e3}):d.showToast("Could not replace the text","error",{duration:4e3})},onToneRequest:t=>Q(o,t),onToneReplace:t=>{const e=T(o,t);m.set(o,g(o)),d.closePanel(),h=null,e?d.showToast("Replaced","success",{duration:2e3}):d.showToast("Could not replace the text","error",{duration:4e3})},onCopy:t=>{navigator.clipboard?.writeText(t).then(()=>{d.showToast("Copied to clipboard","success",{duration:2e3})}).catch(()=>{d.showToast("Could not copy — select and copy manually","warning")})}}),h}async function y(o,n,t){const e=g(o);if(!e.trim())return;const s=W(n,t);if(s)try{let r;if(s==="grammar"){const a=await chrome.runtime.sendMessage({type:"ANALYZE_TEXT",text:e});if(!a.success)throw new Error(a.error||"Check failed");r=a.data.corrections,P(o,r)}else{const a=await chrome.runtime.sendMessage({type:"ANALYZE_PANEL_MODE",text:e,mode:s});if(!a.success)throw new Error(a.error||"Request failed");r=a.data.corrections}h?.setCorrections(r)}catch(r){h?.setError(r.message||"Something went wrong")}}async function K(o,n){const t=g(o);if(t.trim()){chrome.runtime.sendMessage({type:"SAVE_TRANSLATE_TARGET",language:n});try{const e=await chrome.runtime.sendMessage({type:"TRANSLATE_TEXT",text:t,targetLanguage:n});if(!e.success)throw new Error(e.error||"Translation failed");h?.setTranslateResult(e.data.translated,e.data.detectedLanguage)}catch(e){h?.setError(e.message||"Translation failed")}}}async function Q(o,n){const t=g(o);if(t.trim())try{const e=await chrome.runtime.sendMessage({type:"REWRITE_TEXT",text:t,tone:n});if(!e.success)throw new Error(e.error||"Rewrite failed");h?.setRewriteResult(e.data.rewritten)}catch(e){h?.setError(e.message||"Rewrite failed")}}let M=!1;function ee(){if(M)return;M=!0;const o=document.createElement("style");o.id="og-spelling-highlight-style",o.textContent=`
    ::highlight(og-spelling) {
      background: rgba(239, 68, 68, 0.16);
      text-decoration: underline wavy #ef4444;
      text-decoration-skip-ink: none;
    }
  `,document.head.appendChild(o)}function te(){const o=window.CSS?.highlights;o&&o.delete("og-spelling")}function ne(o,n){if(o instanceof HTMLInputElement||o instanceof HTMLTextAreaElement)return;const t=window.CSS?.highlights;if(!t||typeof window.Highlight>"u")return;const e=n.filter(r=>r.type==="spelling").map(r=>A(o,r.original,r.start)).filter(r=>r!==null);if(e.length===0){t.delete("og-spelling");return}ee();const s=new window.Highlight(...e);t.set("og-spelling",s)}function P(o,n){ne(o,n);const t=n.filter(e=>e.type==="spelling").length;t>0?d.showSpellingBadge(o,t,()=>{d.isPanelOpenFor(o)||f(o,"grammar")}):d.hideSpellingBadge(o)}let b=null;function B(){b!==null&&window.clearTimeout(b),b=window.setTimeout(oe,220)}function oe(){b=null;const o=window.getSelection();if(!o||o.isCollapsed||o.rangeCount===0)return;const n=o.anchorNode;if(!n)return;const t=n.nodeType===Node.TEXT_NODE?n.parentElement:n;if(!t)return;const e=t.closest("input, textarea, [contenteditable]");if(!e||!q(e)||d.isPanelOpenFor(e)||Date.now()-k<2500)return;const s=g(e);!s.trim()||s.trim().length<2||f(e,"improve")}function se(o){const n=o.target;te(),d.hideSpellingBadge(n),N(n)}function re(o){const n=o.target;setTimeout(()=>N(n),100)}function q(o){const n=o.tagName.toLowerCase();return n==="input"||n==="textarea"||o.isContentEditable}_(o=>{v.has(o)||(o.addEventListener("input",se),o.addEventListener("paste",re),v.add(o))});chrome.runtime.onMessage.addListener((o,n,t)=>{if(o.type==="OPEN_PANEL"){const e=document.activeElement,s=e&&q(e)?e:Array.from(v).pop();if(!s){d.showToast("Click into a text field first","warning");return}f(s,"improve")}});document.addEventListener("mouseup",B);document.addEventListener("keyup",B);chrome.runtime.sendMessage({type:"PING"},()=>{chrome.runtime.lastError});
