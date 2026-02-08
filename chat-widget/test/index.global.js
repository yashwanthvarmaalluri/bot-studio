"use strict";(()=>{var m="bot-studio-widget-styles",p={launcherLabel:"Chat with us",theme:"light",title:"Assistant",welcomeMessage:"Hi there! I\u2019m here to help. Ask me anything about our services.",subtitle:"Powered by Bot Studio",accentColor:"#2563eb",position:"bottom-right",panelHeight:640},y=`
.bot-widget-root {
  all: initial;
  font-family: "Inter", system-ui, sans-serif;
}
.bot-widget-root *,
.bot-widget-root *::before,
.bot-widget-root *::after {
  box-sizing: border-box;
}
.bot-widget-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
  z-index: 2147480000;
  animation: bot-enter 280ms ease-out;
}
.bot-widget-container[data-theme="dark"] { color-scheme: dark; }

.bot-widget-container[data-position="bottom-left"] {
  right: auto;
  left: 24px;
}

.bot-widget-launcher {
  border: none;
  border-radius: 9999px;
  padding: 12px 18px;
  background: var(--bot-primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.24);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.01em;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}
.bot-widget-launcher:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.3);
}
.bot-widget-launcher:active {
  transform: translateY(0);
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.22);
}

.bot-widget-panel {
  width: min(380px, calc(100vw - 40px));
  height: min(var(--bot-panel-height), calc(100vh - 96px));
  display: none;
  flex-direction: column;
  background: var(--bot-surface);
  color: var(--bot-text);
  border-radius: 18px;
  border: 1px solid var(--bot-border);
  box-shadow: 0 32px 70px rgba(15, 23, 42, 0.28);
  overflow: hidden;
  transform-origin: bottom right;
  animation: bot-scale-in 200ms ease-out;
  backdrop-filter: blur(18px);
}
.bot-widget-panel[data-open="true"] {
  display: flex;
}

.bot-widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  background: linear-gradient(135deg, var(--bot-primary), var(--bot-primary-soft));
  color: #fff;
}

.bot-widget-body {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  background: var(--bot-surface-alt);
  scrollbar-width: thin;
}
.bot-widget-body::-webkit-scrollbar {
  width: 6px;
}
.bot-widget-body::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.25);
  border-radius: 999px;
}

.bot-widget-message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
  font-size: 0.95rem;
  transition: transform 120ms ease;
}
.bot-widget-message[data-role="user"] {
  align-self: flex-end;
  background: var(--bot-primary);
  color: #fff;
  border-bottom-right-radius: 8px;
}
.bot-widget-message[data-role="assistant"] {
  align-self: flex-start;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.32);
  color: var(--bot-text);
  border-bottom-left-radius: 8px;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
}
.bot-widget-message[data-error="true"] {
  border-color: #ef4444;
  background: #fee2e2;
  color: #991b1b;
}

.bot-widget-footer {
  padding: 18px 20px;
  border-top: 1px solid var(--bot-border);
  background: var(--bot-surface);
  display: flex;
  gap: 10px;
}
.bot-widget-input {
  flex: 1;
  min-height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  padding: 12px 14px;
  background: var(--bot-surface-alt);
  color: var(--bot-text);
  resize: none;
  font-size: 0.94rem;
  line-height: 1.45;
  transition: border 140ms ease, box-shadow 140ms ease;
}
.bot-widget-input:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.55);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
}
.bot-widget-send {
  width: 50px;
  border-radius: 14px;
  border: none;
  background: var(--bot-primary);
  color: #fff;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 1.05rem;
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}
.bot-widget-send:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(37, 99, 235, 0.25);
}
.bot-widget-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.bot-widget-loading {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--bot-primary);
}
.bot-widget-loading span {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  animation: bot-dot 1s infinite ease-in-out;
}
.bot-widget-loading span:nth-child(2) { animation-delay: .2s; }
.bot-widget-loading span:nth-child(3) { animation-delay: .4s; }
@keyframes bot-dot {
  0%, 80%, 100% { transform: scale(.6); }
  40% { transform: scale(1); }
}

@keyframes bot-enter {
  from { transform: translateY(12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes bot-scale-in {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`,b=class{constructor(e){this.root=null;this.container=null;this.panel=null;this.launcher=null;this.messagesBody=null;this.input=null;this.sendButton=null;this.messages=[];this.sending=!1;var o,t,r,s,a,d,i;if(!e.chatbotId)throw new Error("Chatbot ID is required");if(!e.apiBaseUrl)throw new Error("API base URL is required");this.options={...p,...e},(o=this.options).launcherLabel||(o.launcherLabel=p.launcherLabel),(t=this.options).title||(t.title=p.title),(r=this.options).subtitle||(r.subtitle=p.subtitle),(s=this.options).welcomeMessage||(s.welcomeMessage=p.welcomeMessage),(a=this.options).accentColor||(a.accentColor=p.accentColor),(d=this.options).position||(d.position=p.position),(i=this.options).panelHeight||(i.panelHeight=p.panelHeight)}mount(){typeof document!="undefined"&&(this.injectStyles(),this.createDom(),this.options.welcomeMessage&&this.pushMessage({id:this.id(),role:"assistant",content:this.options.welcomeMessage}))}destroy(){var e;(e=this.root)==null||e.remove(),this.root=null,this.container=null,this.panel=null,this.launcher=null,this.messagesBody=null,this.input=null,this.sendButton=null,this.messages=[]}injectStyles(){if(document.getElementById(m))return;let e=document.createElement("style");e.id=m,e.textContent=y,document.head.appendChild(e)}createDom(){var i,c;this.root=document.createElement("div"),this.root.className="bot-widget-root",this.container=document.createElement("div"),this.container.className="bot-widget-container",this.container.dataset.theme=this.options.theme,this.container.dataset.position=(i=this.options.position)!=null?i:"bottom-right";let e=(c=this.options.accentColor)!=null?c:p.accentColor;this.container.style.setProperty("--bot-primary",e),this.container.style.setProperty("--bot-primary-soft",this.options.theme==="dark"?"rgba(99, 102, 241, 0.82)":"rgba(59, 130, 246, 0.82)"),this.container.style.setProperty("--bot-panel-height",`${this.options.panelHeight}px`),this.options.theme==="dark"?(this.container.style.setProperty("--bot-surface","#0f172a"),this.container.style.setProperty("--bot-surface-alt","rgba(15, 23, 42, 0.78)"),this.container.style.setProperty("--bot-text","#e2e8f0"),this.container.style.setProperty("--bot-border","rgba(148, 163, 184, 0.28)")):(this.container.style.setProperty("--bot-surface","#f8fafc"),this.container.style.setProperty("--bot-surface-alt","#ffffff"),this.container.style.setProperty("--bot-text","#0f172a"),this.container.style.setProperty("--bot-border","rgba(15, 23, 42, 0.1)")),this.panel=document.createElement("div"),this.panel.className="bot-widget-panel",this.panel.dataset.open="false";let o=document.createElement("div");o.className="bot-widget-header";let t=document.createElement("div");t.style.display="flex",t.style.flexDirection="column",t.style.gap="4px";let r=document.createElement("strong");if(r.textContent=this.options.title,r.style.fontSize="1.06rem",this.options.subtitle){let l=document.createElement("span");l.textContent=this.options.subtitle,l.style.fontSize="0.75rem",l.style.opacity="0.75",t.appendChild(r),t.appendChild(l)}else t.appendChild(r);let s=document.createElement("button");s.type="button",s.textContent="\xD7",s.style.cssText="background:rgba(255,255,255,0.18);border:none;color:#fff;width:32px;height:32px;border-radius:999px;font-size:20px;cursor:pointer;",s.addEventListener("click",()=>this.togglePanel(!1)),o.appendChild(t),o.appendChild(s),this.messagesBody=document.createElement("div"),this.messagesBody.className="bot-widget-body";let a=document.createElement("div");a.className="bot-widget-footer",this.input=document.createElement("textarea"),this.input.className="bot-widget-input",this.input.placeholder="Type your message\u2026",this.input.addEventListener("keydown",l=>{l.key==="Enter"&&!l.shiftKey&&(l.preventDefault(),this.handleSend())}),this.sendButton=document.createElement("button"),this.sendButton.className="bot-widget-send",this.sendButton.type="button",this.sendButton.innerHTML="\u27A4",this.sendButton.addEventListener("click",()=>this.handleSend()),a.appendChild(this.input),a.appendChild(this.sendButton),this.panel.appendChild(o),this.panel.appendChild(this.messagesBody),this.panel.appendChild(a),this.launcher=document.createElement("button"),this.launcher.className="bot-widget-launcher",this.launcher.type="button",this.launcher.textContent=this.options.launcherLabel;let d=document.createElement("span");d.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',d.style.display="inline-flex",this.launcher.prepend(d),this.launcher.addEventListener("click",()=>this.togglePanel()),this.container.appendChild(this.panel),this.container.appendChild(this.launcher),this.root.appendChild(this.container),document.body.appendChild(this.root)}togglePanel(e){if(!this.panel)return;let o=e!=null?e:this.panel.dataset.open!=="true";this.panel.dataset.open=o?"true":"false",o&&setTimeout(()=>{var t;return(t=this.input)==null?void 0:t.focus()},20)}async handleSend(){var r;let e=(r=this.input)==null?void 0:r.value.trim();if(!e||this.sending)return;this.input&&(this.input.value="");let o={id:this.id(),role:"user",content:e};this.pushMessage(o);let t={id:this.id(),role:"assistant",content:"",pending:!0};this.pushMessage(t),this.sending=!0,this.refreshMessages();try{let s=await this.sendToApiStream(e,i=>{this.appendToMessage(t.id,i)}),a=this.getMessageById(t.id),d=s.response||(a==null?void 0:a.content)||"";this.updateMessage(t.id,{pending:!1,content:d,sources:s.sources})}catch(s){let a=s instanceof Error?s.message:"Unknown error";this.updateMessage(t.id,{pending:!1,error:!0,content:`Failed to fetch reply. ${a}`})}finally{this.sending=!1,this.refreshMessages()}}async sendToApiStream(e,o){let t=`${this.options.apiBaseUrl.replace(/\/$/,"")}/api/chat/${encodeURIComponent(this.options.chatbotId)}/stream`,r=this.messages.filter(n=>(n.role==="user"||n.role==="assistant")&&!!n.content).slice(-10).map(n=>({role:n.role,content:n.content})),s=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:e,history:r})});if(!s.ok){let n=await s.text().catch(()=>"");throw new Error(n||`HTTP ${s.status}`)}if(!s.body)throw new Error("Streaming body is not supported in this browser.");let a=s.body.getReader(),d=new TextDecoder("utf-8"),i="",c=null,l=()=>{let n=i.indexOf(`
`);for(;n>=0;){let u=i.slice(0,n).trim();if(i=i.slice(n+1),u){let h;try{h=JSON.parse(u)}catch(f){console.error("Failed to parse stream event:",f),n=i.indexOf(`
`);continue}if(h.type==="delta")o(h.data||"");else if(h.type==="final")c=h.data;else if(h.type==="error")throw new Error(h.message||"Streaming error")}n=i.indexOf(`
`)}};for(;;){let{value:n,done:u}=await a.read();if(u)break;i+=d.decode(n,{stream:!0}),l()}if(i+=d.decode(),l(),!c)throw new Error("Streaming ended without a final message.");return c}pushMessage(e){this.messages.push(e),this.refreshMessages()}updateMessage(e,o){this.messages=this.messages.map(t=>t.id===e?{...t,...o}:t)}appendToMessage(e,o){this.messages=this.messages.map(t=>t.id===e?{...t,pending:!1,content:`${t.content||""}${o}`}:t),this.refreshMessages()}getMessageById(e){return this.messages.find(o=>o.id===e)}refreshMessages(){if(this.messagesBody){this.messagesBody.innerHTML="";for(let e of this.messages){let o=document.createElement("div");if(o.className="bot-widget-message",o.dataset.role=e.role,e.error&&(o.dataset.error="true"),e.pending)o.innerHTML=`
          <div class="bot-widget-loading">
            <span></span><span></span><span></span>
          </div>
        `;else if(e.role==="assistant"&&typeof this.options.markdownRenderer=="function")try{let t=this.options.markdownRenderer(e.content||"");typeof t=="string"?o.innerHTML=t:t&&typeof t.nodeType=="number"?o.appendChild(t):o.textContent=e.content}catch{o.textContent=e.content}else o.textContent=e.content;this.messagesBody.appendChild(o)}this.messagesBody.scrollTop=this.messagesBody.scrollHeight}}id(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}};function x(g){let e=new b(g);return e.mount(),e}if(typeof window!="undefined"){let g=window;if(!g.BotStudioWidget){let e=[];g.BotStudioWidget={init(o){let t=x(o);return e.push(t),t},destroyAll(){for(;e.length;){let o=e.pop();o==null||o.destroy()}},instances:e}}}})();
//# sourceMappingURL=index.global.js.map