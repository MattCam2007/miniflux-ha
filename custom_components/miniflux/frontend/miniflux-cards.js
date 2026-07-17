var Z=globalThis,Q=Z.ShadowRoot&&(Z.ShadyCSS===void 0||Z.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,fe=Symbol(),Re=new WeakMap,F=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==fe)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(Q&&t===void 0){let i=e!==void 0&&e.length===1;i&&(t=Re.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&Re.set(e,t))}return t}toString(){return this.cssText}},Ie=r=>new F(typeof r=="string"?r:r+"",void 0,fe),y=(r,...t)=>{let e=r.length===1?r[0]:t.reduce((i,s,o)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[o+1],r[0]);return new F(e,r,fe)},De=(r,t)=>{if(Q)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let i=document.createElement("style"),s=Z.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,r.appendChild(i)}},ge=Q?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(let i of t.cssRules)e+=i.cssText;return Ie(e)})(r):r;var{is:yt,defineProperty:vt,getOwnPropertyDescriptor:bt,getOwnPropertyNames:$t,getOwnPropertySymbols:wt,getPrototypeOf:Et}=Object,X=globalThis,Le=X.trustedTypes,Ct=Le?Le.emptyScript:"",xt=X.reactiveElementPolyfillSupport,U=(r,t)=>r,_e={toAttribute(r,t){switch(t){case Boolean:r=r?Ct:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Ue=(r,t)=>!yt(r,t),Fe={attribute:!0,type:String,converter:_e,reflect:!1,useDefault:!1,hasChanged:Ue};Symbol.metadata??=Symbol("metadata"),X.litPropertyMetadata??=new WeakMap;var b=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Fe){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&vt(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){let{get:s,set:o}=bt(this.prototype,t)??{get(){return this[e]},set(n){this[e]=n}};return{get:s,set(n){let a=s?.call(this);o?.call(this,n),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Fe}static _$Ei(){if(this.hasOwnProperty(U("elementProperties")))return;let t=Et(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(U("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(U("properties"))){let e=this.properties,i=[...$t(e),...wt(e)];for(let s of i)this.createProperty(s,e[s])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(let[e,i]of this.elementProperties){let s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let i=new Set(t.flat(1/0).reverse());for(let s of i)e.unshift(ge(s))}else t!==void 0&&e.push(ge(t));return e}static _$Eu(t,e){let i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return De(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){let i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){let o=(i.converter?.toAttribute!==void 0?i.converter:_e).toAttribute(e,i.type);this._$Em=t,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){let i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){let o=i.getPropertyOptions(s),n=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:_e;this._$Em=s;let a=n.fromAttribute(e,o.type);this[s]=a??this._$Ej?.get(s)??a,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(t!==void 0){let n=this.constructor;if(s===!1&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??Ue)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),o!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,o]of this._$Ep)this[s]=o;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[s,o]of i){let{wrapped:n}=o,a=this[s];n!==!0||this._$AL.has(s)||a===void 0||this.C(s,void 0,o,a)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(e)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};b.elementStyles=[],b.shadowRootOptions={mode:"open"},b[U("elementProperties")]=new Map,b[U("finalized")]=new Map,xt?.({ReactiveElement:b}),(X.reactiveElementVersions??=[]).push("2.1.2");var ye=globalThis,Oe=r=>r,ee=ye.trustedTypes,Ne=ee?ee.createPolicy("lit-html",{createHTML:r=>r}):void 0,ve="$lit$",$=`lit$${Math.random().toFixed(9).slice(2)}$`,be="?"+$,At=`<${be}>`,T=document,N=()=>T.createComment(""),z=r=>r===null||typeof r!="object"&&typeof r!="function",$e=Array.isArray,qe=r=>$e(r)||typeof r?.[Symbol.iterator]=="function",me=`[ 	
\f\r]`,O=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ze=/-->/g,We=/>/g,x=RegExp(`>|${me}(?:([^\\s"'>=/]+)(${me}*=${me}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Be=/'/g,Ve=/"/g,Ge=/^(?:script|style|textarea|title)$/i,we=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),l=we(1),qt=we(2),Gt=we(3),w=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),je=new WeakMap,A=T.createTreeWalker(T,129);function Ke(r,t){if(!$e(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ne!==void 0?Ne.createHTML(t):t}var Ye=(r,t)=>{let e=r.length-1,i=[],s,o=t===2?"<svg>":t===3?"<math>":"",n=O;for(let a=0;a<e;a++){let d=r[a],p,f,c=-1,u=0;for(;u<d.length&&(n.lastIndex=u,f=n.exec(d),f!==null);)u=n.lastIndex,n===O?f[1]==="!--"?n=ze:f[1]!==void 0?n=We:f[2]!==void 0?(Ge.test(f[2])&&(s=RegExp("</"+f[2],"g")),n=x):f[3]!==void 0&&(n=x):n===x?f[0]===">"?(n=s??O,c=-1):f[1]===void 0?c=-2:(c=n.lastIndex-f[2].length,p=f[1],n=f[3]===void 0?x:f[3]==='"'?Ve:Be):n===Ve||n===Be?n=x:n===ze||n===We?n=O:(n=x,s=void 0);let h=n===x&&r[a+1].startsWith("/>")?" ":"";o+=n===O?d+At:c>=0?(i.push(p),d.slice(0,c)+ve+d.slice(c)+$+h):d+$+(c===-2?a:h)}return[Ke(r,o+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]},W=class r{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0,a=t.length-1,d=this.parts,[p,f]=Ye(t,e);if(this.el=r.createElement(p,i),A.currentNode=this.el.content,e===2||e===3){let c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(s=A.nextNode())!==null&&d.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(let c of s.getAttributeNames())if(c.endsWith(ve)){let u=f[n++],h=s.getAttribute(c).split($),_=/([.?@])?(.*)/.exec(u);d.push({type:1,index:o,name:_[2],strings:h,ctor:_[1]==="."?ie:_[1]==="?"?se:_[1]==="@"?re:k}),s.removeAttribute(c)}else c.startsWith($)&&(d.push({type:6,index:o}),s.removeAttribute(c));if(Ge.test(s.tagName)){let c=s.textContent.split($),u=c.length-1;if(u>0){s.textContent=ee?ee.emptyScript:"";for(let h=0;h<u;h++)s.append(c[h],N()),A.nextNode(),d.push({type:2,index:++o});s.append(c[u],N())}}}else if(s.nodeType===8)if(s.data===be)d.push({type:2,index:o});else{let c=-1;for(;(c=s.data.indexOf($,c+1))!==-1;)d.push({type:7,index:o}),c+=$.length-1}o++}}static createElement(t,e){let i=T.createElement("template");return i.innerHTML=t,i}};function S(r,t,e=r,i){if(t===w)return t;let s=i!==void 0?e._$Co?.[i]:e._$Cl,o=z(t)?void 0:t._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),o===void 0?s=void 0:(s=new o(r),s._$AT(r,e,i)),i!==void 0?(e._$Co??=[])[i]=s:e._$Cl=s),s!==void 0&&(t=S(r,s._$AS(r,t.values),s,i)),t}var te=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??T).importNode(e,!0);A.currentNode=s;let o=A.nextNode(),n=0,a=0,d=i[0];for(;d!==void 0;){if(n===d.index){let p;d.type===2?p=new P(o,o.nextSibling,this,t):d.type===1?p=new d.ctor(o,d.name,d.strings,this,t):d.type===6&&(p=new oe(o,this,t)),this._$AV.push(p),d=i[++a]}n!==d?.index&&(o=A.nextNode(),n++)}return A.currentNode=T,s}p(t){let e=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}},P=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=S(this,t,e),z(t)?t===m||t==null||t===""?(this._$AH!==m&&this._$AR(),this._$AH=m):t!==this._$AH&&t!==w&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):qe(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==m&&z(this._$AH)?this._$AA.nextSibling.data=t:this.T(T.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=W.createElement(Ke(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{let o=new te(s,this),n=o.u(this.options);o.p(e),this.T(n),this._$AH=o}}_$AC(t){let e=je.get(t.strings);return e===void 0&&je.set(t.strings,e=new W(t)),e}k(t){$e(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,i,s=0;for(let o of t)s===e.length?e.push(i=new r(this.O(N()),this.O(N()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let i=Oe(t).nextSibling;Oe(t).remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},k=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=m,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=m}_$AI(t,e=this,i,s){let o=this.strings,n=!1;if(o===void 0)t=S(this,t,e,0),n=!z(t)||t!==this._$AH&&t!==w,n&&(this._$AH=t);else{let a=t,d,p;for(t=o[0],d=0;d<o.length-1;d++)p=S(this,a[i+d],e,d),p===w&&(p=this._$AH[d]),n||=!z(p)||p!==this._$AH[d],p===m?t=m:t!==m&&(t+=(p??"")+o[d+1]),this._$AH[d]=p}n&&!s&&this.j(t)}j(t){t===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},ie=class extends k{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===m?void 0:t}},se=class extends k{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==m)}},re=class extends k{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=S(this,t,e,0)??m)===w)return;let i=this._$AH,s=t===m&&i!==m||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==m&&(i===m||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},oe=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){S(this,t)}},Je={M:ve,P:$,A:be,C:1,L:Ye,R:te,D:qe,V:S,I:P,H:k,N:se,U:re,B:ie,F:oe},Tt=ye.litHtmlPolyfillSupport;Tt?.(W,P),(ye.litHtmlVersions??=[]).push("3.3.3");var Ze=(r,t,e)=>{let i=e?.renderBefore??t,s=i._$litPart$;if(s===void 0){let o=e?.renderBefore??null;i._$litPart$=s=new P(t.insertBefore(N(),o),o,void 0,e??{})}return s._$AI(r),s};var Ee=globalThis,g=class extends b{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ze(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return w}};g._$litElement$=!0,g.finalized=!0,Ee.litElementHydrateSupport?.({LitElement:g});var St=Ee.litElementPolyfillSupport;St?.({LitElement:g});(Ee.litElementVersions??=[]).push("4.2.2");var ne=class extends g{setConfig(t){}getCardSize(){return 2}getGridOptions(){return{rows:2,columns:12}}render(){return l`
      <ha-card header="Miniflux — frontend delivery spike">
        <div class="card-content">
          <p class="ok">Bundle loaded and rendering inside Home Assistant.</p>
          <p>
            This confirms the F-U1 delivery pipeline: build → static path →
            Lovelace resource → real card render — with zero manual resource
            setup.
          </p>
          <p>
            Temporary spike card, not a Phase 1 feature card. Safe to remove
            once C3 (feed manager) and C4 (category manager) land.
          </p>
        </div>
      </ha-card>
    `}};ne.styles=y`
    :host {
      display: block;
    }
    p {
      margin: 0 0 8px 0;
      color: var(--primary-text-color);
    }
    p:last-child {
      margin-bottom: 0;
    }
    .ok {
      color: var(--success-color, #4caf50);
      font-weight: 600;
    }
  `;var Qe="miniflux-spike-card";customElements.define(Qe,ne);window.customCards=window.customCards??[];window.customCards.push({type:Qe,name:"Miniflux Spike (delivery test)",description:"Temporary card proving the F-U1 bundle delivery pipeline. Remove after real-HA validation."});var kt="miniflux",Ce=class extends Error{constructor(){super("No Miniflux instance is configured."),this.name="NoInstanceConfiguredError"}},xe=class extends Error{constructor(e){super(`Multiple Miniflux instances are configured (${e.join(", ")}); specify config_entry_id.`);this.configEntryIds=e;this.name="AmbiguousInstanceError"}},Ae=class extends Error{constructor(e){super(`Unknown config_entry_id: ${e}`);this.configEntryId=e;this.name="UnknownInstanceError"}},Xe=new WeakMap;function Te(r){let t=Xe.get(r.entities);if(t)return t;let e=new Set,i=[];for(let s of Object.values(r.entities))s.platform!==kt||!s.config_entry_id||e.has(s.config_entry_id)||(e.add(s.config_entry_id),i.push(s.config_entry_id));return Xe.set(r.entities,i),i}function E(r,t){let e=Te(r);if(t!==void 0){if(!e.includes(t))throw new Ae(t);return t}if(e.length===1)return e[0];throw e.length===0?new Ce:new xe(e)}var Mt=new Set(["service_validation_error","invalid_format","not_found"]),B=class extends Error{constructor(t){super(t.message),this.name="MinifluxApiError",this.retriable=t.retriable}};function et(r,t){return typeof r=="object"&&r!==null&&t in r&&typeof r[t]=="string"}function Ht(r){if(et(r,"message")){let t=et(r,"code")?r.code:void 0;return{message:r.message,retriable:t===void 0||!Mt.has(t)}}return{message:String(r),retriable:!0}}async function Se(r){try{return await r}catch(t){throw new B(Ht(t))}}function tt(r){return Object.fromEntries(Object.entries(r).filter(([,t])=>t!==void 0))}var R=class{async callWithResponse(t,e,i,s){let o=E(t,i.config_entry_id),n=tt({...s,config_entry_id:o}),{response:a}=await Se(t.callService("miniflux",e,n,void 0,!0,!0));return a}async callVoid(t,e,i,s){let o=E(t,i.config_entry_id),n=tt({...s,config_entry_id:o});await Se(t.callService("miniflux",e,n,void 0,!0,!1))}async getFeeds(t,e={}){return this.callWithResponse(t,"get_feeds",e,{category:e.category,only_with_errors:e.only_with_errors})}async getCategories(t,e={}){return this.callWithResponse(t,"get_categories",e,{})}async countEntries(t,e={}){return this.callWithResponse(t,"count_entries",e,{category:e.category,feed:e.feed,status:e.status,starred:e.starred})}async createFeed(t,e){return this.callWithResponse(t,"create_feed",e,{feed_url:e.feed_url,category:e.category,crawler:e.crawler})}async updateFeed(t,e){let{feed:i,title:s,category:o,feed_url:n,disabled:a,crawler:d}=e;return this.callVoid(t,"update_feed",e,{feed:i,title:s,category:o,feed_url:n,disabled:a,crawler:d})}async deleteFeed(t,e){return this.callVoid(t,"delete_feed",e,{feed:e.feed})}async refreshFeed(t,e){return this.callVoid(t,"refresh_feed",e,{feed:e.feed})}async refreshAllFeeds(t,e={}){return this.callVoid(t,"refresh_all_feeds",e,{})}async discoverFeeds(t,e){return this.callWithResponse(t,"discover_feeds",e,{url:e.url})}async markAllRead(t,e){return this.callVoid(t,"mark_all_read",e,{feed:e.feed,category:e.category,everything:e.everything})}async createCategory(t,e){return this.callWithResponse(t,"create_category",e,{title:e.title})}async updateCategory(t,e){return this.callVoid(t,"update_category",e,{category:e.category,title:e.title})}async deleteCategory(t,e){return this.callVoid(t,"delete_category",e,{category:e.category})}};var V=class extends g{constructor(){super(...arguments);this.message="";this.confirmLabel="Delete";this.cancelLabel="Cancel";this.triggerLabel="\u{1F5D1}";this.triggerAriaLabel="Delete";this.requireHold=!1;this.holdMs=900;this.disabled=!1;this._phase="idle";this._holdProgress=0;this._open=()=>{this._phase="confirming"};this._cancel=()=>{this._reset(),this.dispatchEvent(new CustomEvent("mf-cancel",{bubbles:!0,composed:!0}))};this._onConfirmClick=()=>{this._confirmNow()};this._startHold=()=>{let e=Date.now();this._holdRaf=setInterval(()=>{this._holdProgress=Math.min(1,(Date.now()-e)/this.holdMs)},16),this._holdTimer=setTimeout(()=>{this._confirmNow()},this.holdMs)};this._cancelHold=()=>{this._clearHold()}}_clearHold(){this._holdTimer&&(clearTimeout(this._holdTimer),this._holdTimer=void 0),this._holdRaf&&(clearInterval(this._holdRaf),this._holdRaf=void 0),this._holdProgress=0}_reset(){this._clearHold(),this._phase="idle"}_confirmNow(){this._reset(),this.dispatchEvent(new CustomEvent("mf-confirm",{bubbles:!0,composed:!0}))}render(){return this._phase==="idle"?l`<button
        class="trigger"
        aria-label=${this.triggerAriaLabel}
        ?disabled=${this.disabled}
        @click=${this._open}
      >
        ${this.triggerLabel}
      </button>`:l`
      <div class="panel" role="group" aria-label=${this.triggerAriaLabel}>
        <p class="message">${this.message}</p>
        <div class="actions">
          <button class="cancel" @click=${this._cancel}>${this.cancelLabel}</button>
          ${this.requireHold?l`<button
                class="confirm"
                aria-label="${this.confirmLabel}, press and hold to confirm"
                @pointerdown=${this._startHold}
                @pointerup=${this._cancelHold}
                @pointerleave=${this._cancelHold}
              >
                <span class="hold-progress" style="width:${this._holdProgress*100}%"></span>
                ${this.confirmLabel} (hold)
              </button>`:l`<button class="confirm" @click=${this._onConfirmClick}>
                ${this.confirmLabel}
              </button>`}
        </div>
      </div>
    `}};V.properties={message:{},confirmLabel:{attribute:"confirm-label"},cancelLabel:{attribute:"cancel-label"},triggerLabel:{attribute:"trigger-label"},triggerAriaLabel:{attribute:"trigger-aria-label"},requireHold:{type:Boolean,attribute:"require-hold"},holdMs:{type:Number,attribute:"hold-ms"},disabled:{type:Boolean},_phase:{state:!0},_holdProgress:{state:!0}},V.styles=y`
    :host {
      display: inline-block;
    }
    button {
      min-height: 44px;
      min-width: 44px;
      padding: 0 12px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
    }
    button.confirm {
      background: var(--error-color, #db4437);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
      position: relative;
      overflow: hidden;
    }
    button.confirm .hold-progress {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.35);
      transform-origin: left;
      pointer-events: none;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      background: var(--card-background-color, #fff);
    }
    .message {
      margin: 0;
      color: var(--primary-text-color);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `;customElements.define("mf-confirm",V);var Pt="binary_sensor.miniflux_reachable",j=class extends g{get _reachable(){return this.hass?.states[Pt]?.state==="on"}render(){return this._reachable?l``:l`
      <div class="banner" role="status" aria-live="polite">
        <span class="icon" aria-hidden="true">&#9888;</span>
        <span>Miniflux is unreachable. Showing last-known data; actions are disabled.</span>
      </div>
    `}};j.properties={hass:{}},j.styles=y`
    :host {
      display: block;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--warning-color, #ff9800);
      color: var(--text-primary-color, #fff);
    }
    .icon {
      font-weight: 700;
    }
  `;customElements.define("mf-offline",j);var Rt=6e3,q=class extends g{constructor(){super(...arguments);this._toasts=[];this._nextId=1;this._timers=new Map}show(e,i={}){let s=this._nextId++,o=i.timeoutMs??Rt;this._toasts=[...this._toasts,{id:s,message:e,undo:i.undo}],this._timers.set(s,setTimeout(()=>this._dismiss(s),o))}_dismiss(e){clearTimeout(this._timers.get(e)),this._timers.delete(e),this._toasts=this._toasts.filter(i=>i.id!==e)}_onUndoClick(e){e.undo?.(),this._dismiss(e.id)}render(){return l`
      <div class="toasts" aria-live="assertive">
        ${this._toasts.map(e=>l`
            <div class="toast">
              <span>${e.message}</span>
              ${e.undo?l`<button @click=${()=>this._onUndoClick(e)}>Undo</button>`:""}
            </div>
          `)}
      </div>
    `}};q.properties={_toasts:{state:!0}},q.styles=y`
    :host {
      display: block;
    }
    .toasts {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--primary-text-color, #212121);
      color: var(--text-primary-color, #fff);
    }
    button {
      min-height: 44px;
      min-width: 44px;
      background: transparent;
      color: inherit;
      border: none;
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  `;customElements.define("mf-toast-host",q);var it={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},st=r=>(...t)=>({_$litDirective$:r,values:t}),ae=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};var{I:It}=Je,rt=r=>r;var ot=()=>document.createComment(""),I=(r,t,e)=>{let i=r._$AA.parentNode,s=t===void 0?r._$AB:t._$AA;if(e===void 0){let o=i.insertBefore(ot(),s),n=i.insertBefore(ot(),s);e=new It(o,n,r,r.options)}else{let o=e._$AB.nextSibling,n=e._$AM,a=n!==r;if(a){let d;e._$AQ?.(r),e._$AM=r,e._$AP!==void 0&&(d=r._$AU)!==n._$AU&&e._$AP(d)}if(o!==s||a){let d=e._$AA;for(;d!==o;){let p=rt(d).nextSibling;rt(i).insertBefore(d,s),d=p}}}return e},C=(r,t,e=r)=>(r._$AI(t,e),r),Dt={},nt=(r,t=Dt)=>r._$AH=t,at=r=>r._$AH,de=r=>{r._$AR(),r._$AA.remove()};var dt=(r,t,e)=>{let i=new Map;for(let s=t;s<=e;s++)i.set(r[s],s);return i},lt=st(class extends ae{constructor(r){if(super(r),r.type!==it.CHILD)throw Error("repeat() can only be used in text expressions")}dt(r,t,e){let i;e===void 0?e=t:t!==void 0&&(i=t);let s=[],o=[],n=0;for(let a of r)s[n]=i?i(a,n):n,o[n]=e(a,n),n++;return{values:o,keys:s}}render(r,t,e){return this.dt(r,t,e).values}update(r,[t,e,i]){let s=at(r),{values:o,keys:n}=this.dt(t,e,i);if(!Array.isArray(s))return this.ut=n,o;let a=this.ut??=[],d=[],p,f,c=0,u=s.length-1,h=0,_=o.length-1;for(;c<=u&&h<=_;)if(s[c]===null)c++;else if(s[u]===null)u--;else if(a[c]===n[h])d[h]=C(s[c],o[h]),c++,h++;else if(a[u]===n[_])d[_]=C(s[u],o[_]),u--,_--;else if(a[c]===n[_])d[_]=C(s[c],o[_]),I(r,d[_+1],s[c]),c++,_--;else if(a[u]===n[h])d[h]=C(s[u],o[h]),I(r,s[c],s[u]),u--,h++;else if(p===void 0&&(p=dt(n,h,_),f=dt(a,c,u)),p.has(a[c]))if(p.has(a[u])){let v=f.get(n[h]),M=v!==void 0?s[v]:null;if(M===null){let H=I(r,s[c]);C(H,o[h]),d[h]=H}else d[h]=C(M,o[h]),I(r,s[c],M),s[v]=null;h++}else de(s[u]),u--;else de(s[c]),c++;for(;h<=_;){let v=I(r,d[_+1]);C(v,o[h]),d[h++]=v}for(;c<=u;){let v=s[c++];v!==null&&de(v)}return this.ut=n,nt(r,d),w}});var G=class extends g{constructor(){super(...arguments);this.items=[];this.itemHeight=48;this.height="520px";this.bufferRows=5;this._scrollTop=0;this._onScroll=e=>{this._scrollTop=e.target.scrollTop}}get _viewportHeightPx(){let e=Number.parseInt(this.height,10);return Number.isFinite(e)?e:0}get _range(){let e=this.items.length,i=Math.max(0,Math.floor(this._scrollTop/this.itemHeight)-this.bufferRows),s=Math.ceil(this._viewportHeightPx/this.itemHeight)+this.bufferRows*2,o=Math.min(e,i+s);return{start:i,end:o}}render(){let{start:e,end:i}=this._range,s=this.items.length*this.itemHeight,o=e*this.itemHeight,n=this.items.slice(e,i);return l`
      <div class="viewport" style="height:${this.height}" @scroll=${this._onScroll}>
        <div class="spacer" style="height:${s}px">
          <div class="window" style="transform:translateY(${o}px)">
            ${lt(n,a=>a.id,(a,d)=>this.renderItem(a,e+d))}
          </div>
        </div>
      </div>
    `}};G.properties={items:{attribute:!1},itemHeight:{type:Number,attribute:"item-height"},height:{},bufferRows:{type:Number,attribute:"buffer-rows"},renderItem:{attribute:!1},_scrollTop:{state:!0}},G.styles=y`
    :host {
      display: block;
    }
    .viewport {
      overflow-y: auto;
      position: relative;
    }
    .spacer {
      position: relative;
    }
    .window {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
    }
  `;customElements.define("mf-virtual-list",G);function Lt(r){let t=Object.entries(r).filter(([,e])=>e!==void 0).sort(([e],[i])=>e.localeCompare(i));return JSON.stringify(t)}function ct(r,t,e={}){return`${r}\0${t}\0${Lt(e)}`}function le(r,t,e){return r.startsWith(`${t}\0${e}\0`)}var ce=class{constructor(t=()=>Date.now()){this.now=t;this.records=new Map}get(t){let e=this.records.get(t);if(e){if(this.now()>=e.expiresAt){this.records.delete(t);return}return e.value}}set(t,e,i){this.records.set(t,{value:e,expiresAt:this.now()+i})}invalidate(t){this.records.delete(t)}invalidateWhere(t){for(let e of this.records.keys())t(e)&&this.records.delete(e)}keysWhere(t){let e=this.now(),i=[];for(let[s,o]of this.records)e<o.expiresAt&&t(s)&&i.push(s);return i}clear(){this.records.clear()}};var Ft=["miniflux_new_entries","miniflux_entry_saved","miniflux_feed_error","miniflux_feed_recovered"],Ut=["sensor.miniflux_unread_entries","sensor.miniflux_starred_entries","sensor.miniflux_feeds_with_errors","binary_sensor.miniflux_reachable"];var he=class{constructor(){this.listeners=new Set;this.lastEntityTick=new Map;this.unsubscribes=[];this.adminAttached=!1}onInvalidate(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notify(){for(let t of this.listeners)t()}scheduleDebouncedNotify(){clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.debounceTimer=void 0,this.notify()},2e3)}async attachAdminEvents(t){if(!this.adminAttached){this.adminAttached=!0;try{for(let e of Ft){let i=await t.connection.subscribeEvents(()=>{this.scheduleDebouncedNotify()},e);this.unsubscribes.push(i)}}catch{}}}detach(){clearTimeout(this.debounceTimer),this.debounceTimer=void 0;for(let t of this.unsubscribes.splice(0))t();this.adminAttached=!1,this.lastEntityTick.clear()}onHassUpdate(t){let e=!1;for(let i of Ut){let s=t.states[i]?.last_changed;s!==void 0&&this.lastEntityTick.get(i)!==s&&(this.lastEntityTick.set(i,s),e=!0)}e&&this.notify()}notifyLocalMutation(){this.notify()}};var K="get_feeds",ke="get_categories",D=class{constructor(){this.cache=new ce;this.bus=new he;this.bus.onInvalidate(()=>this.cache.clear())}async query(t,e,i,s,o){let n=ct(t,e,i),a=this.cache.get(n);if(a!==void 0)return a;let d=await o();return this.cache.set(n,d,s),d}keysFor(t,e){return this.cache.keysWhere(i=>le(i,t,e))}invalidateFeeds(t){this.cache.invalidateWhere(e=>le(e,t,K))}invalidateCategories(t){this.cache.invalidateWhere(e=>le(e,t,ke))}invalidateFeedsAndCategories(t){this.invalidateFeeds(t),this.invalidateCategories(t)}notifyLocalMutation(){this.bus.notifyLocalMutation()}async attach(t){await this.bus.attachAdminEvents(t)}onHassUpdate(t){this.bus.onHassUpdate(t)}detach(){this.bus.detach()}};var ht="__mf_create_new__",Y=class extends g{constructor(){super(...arguments);this.store=new D;this.api=new R;this.emit="id";this.allowCreate=!1;this._categories=[];this._creating=!1;this._onChange=e=>{let i=e.target;if(i.value===ht){this._creating=!0;return}let s=this._categories.find(o=>String(this._refValue(o))===i.value);s&&this._emitPicked(this._refValue(s))};this._onCreateSubmit=async e=>{e.preventDefault();let i=this.hass,n=e.target.elements.namedItem("title").value.trim();if(!n)return;let a=E(i,this.configEntryId),{category_id:d}=await this.api.createCategory(i,{title:n,config_entry_id:a});this.store.invalidateCategories(a),this.store.notifyLocalMutation(),await this._load(i),this._creating=!1,this._emitPicked(this.emit==="title"?n:d)};this._cancelCreate=()=>{this._creating=!1}}willUpdate(e){e.has("hass")&&this.hass&&this._load(this.hass)}async _load(e){let i=E(e,this.configEntryId),{categories:s}=await this.store.query(i,ke,{},3e5,()=>this.api.getCategories(e,{config_entry_id:i}));this._categories=s}_refValue(e){return this.emit==="title"?e.title:e.id}_emitPicked(e){this.value=e,this.dispatchEvent(new CustomEvent("mf-picked",{detail:{value:e},bubbles:!0,composed:!0}))}render(){return this._creating?l`
        <form class="create-row" @submit=${this._onCreateSubmit}>
          <input
            name="title"
            type="text"
            placeholder="New category name"
            aria-label="New category name"
            autofocus
          />
          <button type="submit">Create</button>
          <button type="button" @click=${this._cancelCreate}>Cancel</button>
        </form>
      `:l`
      <select aria-label="Category" @change=${this._onChange}>
        <option value="" ?selected=${this.value===void 0}>Select a category…</option>
        ${this._categories.map(e=>{let i=this._refValue(e),s=e.feed_count===0?" (empty)":"";return l`<option value=${i} ?selected=${this.value===i}>
            ${e.title}${s}
          </option>`})}
        ${this.allowCreate?l`<option value=${ht}>+ New category…</option>`:""}
      </select>
    `}};Y.properties={hass:{},store:{},api:{},configEntryId:{attribute:"config-entry-id"},emit:{},value:{},allowCreate:{type:Boolean,attribute:"allow-create"},_categories:{state:!0},_creating:{state:!0}},Y.styles=y`
    :host {
      display: inline-block;
    }
    select,
    input,
    button {
      min-height: 44px;
      font: inherit;
      color: var(--primary-text-color);
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      padding: 0 8px;
    }
    .create-row {
      display: flex;
      gap: 8px;
    }
  `;customElements.define("mf-category-picker",Y);async function Me(r,t,e,i,s){let o=new Map;for(let n of t){let a=r.get(n);o.set(n,a),a!==void 0&&r.set(n,e(a),i)}try{return await s(),{ok:!0}}catch(n){for(let[a,d]of o)d===void 0?r.invalidate(a):r.set(a,d,i);return{ok:!1,error:n}}}var pt="__uncategorized__",Ot="Uncategorized";function ut(r){let t=r.trim();return t?t[0].toUpperCase():"?"}function ft(r){let t=new Map;for(let s of r){let o=s.category_id??pt,n=s.category_id===null?Ot:s.category_title??"",a=t.get(o);a?a.feeds.push(s):t.set(o,{key:o,title:n,feeds:[s]})}let e=[...t.values()].sort((s,o)=>s.title.localeCompare(o.title)),i=e.findIndex(s=>s.key===pt);if(i!==-1){let[s]=e.splice(i,1);e.push(s)}return e}function gt(r,t){if(!r)return"Never checked";let e=new Date(r),i=t.getTime()-e.getTime();if(i<0)return"Just now";let s=Math.floor(i/6e4);if(s<1)return"Just now";if(s<60)return`${s}m ago`;let o=Math.floor(s/60);return o<24?`${o}h ago`:`${Math.floor(o/24)}d ago`}function _t(r,t){let e={};return t.title!==r.title&&(e.title=t.title),t.category!==void 0&&t.category!==r.category_id&&(e.category=t.category),t.feed_url!==r.feed_url&&(e.feed_url=t.feed_url),t.disabled!==r.disabled&&(e.disabled=t.disabled),e.crawler=t.crawler,e}function mt(r){window.customCards=window.customCards??[],window.customCards.push(r)}var Nt=100,zt=56,He={step:"closed",siteUrl:"",candidates:[],crawler:!1},pe=class extends g{constructor(){super(...arguments);this.store=new D;this.api=new R;this._config={type:"custom:miniflux-feed-manager-card"};this._feeds=[];this._wizard=He;this._pendingRefresh=new Set;this._deletePreviewCounts=new Map}createRenderRoot(){return this}setConfig(e){this._config={type:e.type,config_entry_id:e.config_entry_id,group_by:e.group_by??"category",category:e.category,show_add:e.show_add??!0,show_delete:e.show_delete??!0,require_hold:e.require_hold??!1,height:e.height??"520px"}}static getStubConfig(){return{type:"custom:miniflux-feed-manager-card"}}static getConfigElement(){return document.createElement("miniflux-feed-manager-card-editor")}getCardSize(){return 6}getGridOptions(){return{rows:6,columns:12}}get _configEntryId(){return E(this.hass,this._config.config_entry_id)}get _toastHost(){return this.querySelector("mf-toast-host")}willUpdate(e){e.has("hass")&&this.hass&&(this.store.onHassUpdate(this.hass),this.store.attach(this.hass),this._loadFeeds())}async _loadFeeds(){let e=this.hass,i=this._configEntryId,s={};this._config.category!==void 0&&(s.category=this._config.category);let o=new Map(this._feeds.map(a=>[a.id,a.checked_at])),{feeds:n}=await this.store.query(i,K,s,3e5,()=>this.api.getFeeds(e,{config_entry_id:i,category:this._config.category}));this._feeds=n;for(let a of n)this._pendingRefresh.has(a.id)&&o.get(a.id)!==a.checked_at&&this._pendingRefresh.delete(a.id)}async _refreshFeed(e){let i=this.hass;this._pendingRefresh=new Set(this._pendingRefresh).add(e.id);try{await this.api.refreshFeed(i,{feed:e.id,config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),await this._loadFeeds()}catch(s){this._pendingRefresh=new Set([...this._pendingRefresh].filter(o=>o!==e.id)),this._toastHost?.show(this._errorMessage(s))}}async _refreshAll(){let e=this.hass;try{await this.api.refreshAllFeeds(e,{config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),await this._loadFeeds()}catch(i){this._toastHost?.show(this._errorMessage(i))}}async _markFeedRead(e){let i=this.hass;try{await this.api.markAllRead(i,{feed:e.id,config_entry_id:this._configEntryId}),this.store.notifyLocalMutation()}catch(s){this._toastHost?.show(this._errorMessage(s))}}async _toggleDisabled(e){let i=this.hass,s=this._configEntryId,o=this.store.keysFor(s,K),n=!e.disabled,a=await Me(this.store.cache,o,d=>({feeds:d.feeds.map(p=>p.id===e.id?{...p,disabled:n}:p)}),3e5,()=>this.api.updateFeed(i,{feed:e.id,disabled:n,config_entry_id:s}));a.ok?await this._loadFeeds():this._toastHost?.show(this._errorMessage(a.error))}async _prepareDelete(e){let i=this.hass;try{let{total:s}=await this.api.countEntries(i,{feed:e.id,config_entry_id:this._configEntryId});this._deletePreviewCounts=new Map(this._deletePreviewCounts).set(e.id,s)}catch{this._deletePreviewCounts=new Map(this._deletePreviewCounts).set(e.id,0)}}async _deleteFeed(e){let i=this.hass,s=this._configEntryId;try{await this.api.deleteFeed(i,{feed:e.id,config_entry_id:s}),this.store.invalidateFeedsAndCategories(s),this.store.notifyLocalMutation(),await this._loadFeeds()}catch(o){this._toastHost?.show(this._errorMessage(o))}}_errorMessage(e){return e instanceof B?e.message:String(e)}_openWizard(){this._wizard={...He,step:"discover"}}_closeWizard(){this._wizard=He}_isDirectFeedUrl(e){return/\.(xml|rss|atom)(\?.*)?$/i.test(e.trim())}async _discover(e){let i=this.hass;if(this._isDirectFeedUrl(e)){this._wizard={...this._wizard,siteUrl:e,step:"configure",selectedFeedUrl:e,error:void 0};return}try{let{feeds:s}=await this.api.discoverFeeds(i,{url:e,config_entry_id:this._configEntryId});this._wizard={...this._wizard,siteUrl:e,candidates:s,error:void 0}}catch(s){this._wizard={...this._wizard,error:this._errorMessage(s)}}}_pickCandidate(e){this._wizard={...this._wizard,step:"configure",selectedFeedUrl:e,error:void 0}}async _createFeed(){let e=this.hass;try{await this.api.createFeed(e,{feed_url:this._wizard.selectedFeedUrl,category:this._wizard.category,crawler:this._wizard.crawler,config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),this.store.notifyLocalMutation(),await this._loadFeeds(),this._closeWizard()}catch(i){this._wizard={...this._wizard,error:this._errorMessage(i)}}}_openEdit(e){this._editing={feed:e,title:e.title,category:e.category_id??void 0,feedUrl:e.feed_url,disabled:e.disabled,crawler:!1}}_closeEdit(){this._editing=void 0}async _saveEdit(){if(!this._editing)return;let e=this.hass,i=this._configEntryId,{feed:s,title:o,category:n,feedUrl:a,disabled:d,crawler:p}=this._editing,f=_t(s,{title:o,category:n,feed_url:a,disabled:d,crawler:p}),c="category"in f;if("title"in f&&!c){let h=this.store.keysFor(i,K),_=this._feeds,v=H=>H.map(ue=>ue.id===s.id?{...ue,title:o}:ue);this._feeds=v(this._feeds),this._closeEdit();let M=await Me(this.store.cache,h,H=>({feeds:v(H.feeds)}),3e5,()=>this.api.updateFeed(e,{feed:s.id,...f,config_entry_id:i}));M.ok||(this._feeds=_,this._toastHost?.show(this._errorMessage(M.error)));return}try{await this.api.updateFeed(e,{feed:s.id,...f,config_entry_id:i}),this.store.invalidateFeedsAndCategories(i),this.store.notifyLocalMutation(),await this._loadFeeds(),this._closeEdit()}catch(h){this._toastHost?.show(this._errorMessage(h))}}_renderRow(e){let i=this._pendingRefresh.has(e.id),s=this._config.show_delete,o=this._deletePreviewCounts.get(e.id);return l`
      <div class="feed-row ${e.disabled?"feed-row--disabled":""}" data-feed-id=${e.id}>
        <span class="avatar" aria-hidden="true">${ut(e.title)}</span>
        <span class="title">${e.title}</span>
        ${e.disabled?l`<span class="badge badge--paused" title="Disabled">⏸</span>`:""}
        ${e.parsing_error_count>0?l`<span class="badge badge--error" title=${e.parsing_error_message}>⚠</span>`:""}
        <span class="unread">${e.unread}</span>
        <span class="age">${gt(e.checked_at,new Date)}</span>

        ${e.disabled?l`<button
              class="enable-button"
              @click=${()=>this._toggleDisabled(e)}
            >
              Enable
            </button>`:l`<button
              class="disable-button"
              aria-label="Disable ${e.title}"
              @click=${()=>this._toggleDisabled(e)}
            >
              Disable
            </button>`}

        <button
          class="refresh-button"
          aria-label="Refresh ${e.title}"
          ?disabled=${i}
          @click=${()=>this._refreshFeed(e)}
        >
          ${i?"\u2026":"\u27F3"}
        </button>
        <button class="mark-read-button" aria-label="Mark ${e.title} read" @click=${()=>this._markFeedRead(e)}>
          ✓
        </button>
        <button class="edit-button" aria-label="Edit ${e.title}" @click=${()=>this._openEdit(e)}>
          ✎
        </button>
        ${s?l`<mf-confirm
              trigger-label="🗑"
              trigger-aria-label="Delete ${e.title}"
              confirm-label="Delete"
              .requireHold=${this._config.require_hold}
              message=${o===void 0?`Delete ${e.title}?`:`Delete ${e.title} and its ${o} entries?`}
              @click=${()=>this._prepareDelete(e)}
              @mf-confirm=${()=>this._deleteFeed(e)}
            ></mf-confirm>`:""}
      </div>
    `}_renderList(){let e=this._config.height??"520px";if(this._feeds.length>Nt){let s=this._feeds.map(o=>({...o}));return l`<mf-virtual-list
        .items=${s}
        item-height=${zt}
        height=${e}
        .renderItem=${o=>this._renderRow(o)}
      ></mf-virtual-list>`}if(this._config.group_by==="none")return l`<div class="feed-list" style="max-height:${e};overflow-y:auto">
        ${this._feeds.map(s=>this._renderRow(s))}
      </div>`;let i=ft(this._feeds);return l`<div class="feed-list" style="max-height:${e};overflow-y:auto">
      ${i.map(s=>l`
          <div class="feed-group">
            <h3 class="feed-group__title">${s.title}</h3>
            ${s.feeds.map(o=>this._renderRow(o))}
          </div>
        `)}
    </div>`}_renderWizard(){return this._wizard.step==="closed"?l``:this._wizard.step==="discover"?l`
        <div class="wizard" role="dialog" aria-label="Add feed">
          ${this._wizard.error?l`<p class="error" role="alert">${this._wizard.error}</p>`:""}
          <input
            class="wizard-url"
            type="text"
            placeholder="Site or feed URL"
            .value=${this._wizard.siteUrl}
            @change=${e=>this._discover(e.target.value)}
          />
          <ul class="candidates">
            ${this._wizard.candidates.map(e=>l`<li>
                <button @click=${()=>this._pickCandidate(e.url)}>${e.title} (${e.type})</button>
              </li>`)}
          </ul>
          <button class="wizard-cancel" @click=${()=>this._closeWizard()}>Cancel</button>
        </div>
      `:l`
      <div class="wizard" role="dialog" aria-label="Add feed">
        ${this._wizard.error?l`<p class="error" role="alert">${this._wizard.error}</p>`:""}
        <p class="wizard-feed-url">${this._wizard.selectedFeedUrl}</p>
        <mf-category-picker
          .hass=${this.hass}
          .store=${this.store}
          .api=${this.api}
          allow-create
          @mf-picked=${e=>this._wizard={...this._wizard,category:e.detail.value}}
        ></mf-category-picker>
        <label>
          <input
            type="checkbox"
            .checked=${this._wizard.crawler}
            @change=${e=>this._wizard={...this._wizard,crawler:e.target.checked}}
          />
          Use crawler
        </label>
        <button class="wizard-subscribe" @click=${()=>this._createFeed()}>Subscribe</button>
        <button class="wizard-cancel" @click=${()=>this._closeWizard()}>Cancel</button>
      </div>
    `}_updateEditing(e){this._editing&&(this._editing={...this._editing,...e})}_renderEditSheet(){if(!this._editing)return l``;let e=this._editing,i=e.feedUrl!==e.feed.feed_url;return l`
      <div class="edit-sheet" role="dialog" aria-label="Edit ${e.feed.title}">
        <label>
          Title
          <input
            type="text"
            .value=${e.title}
            @change=${s=>this._updateEditing({title:s.target.value})}
          />
        </label>
        <mf-category-picker
          .hass=${this.hass}
          .store=${this.store}
          .api=${this.api}
          .value=${e.category}
          allow-create
          @mf-picked=${s=>this._updateEditing({category:s.detail.value})}
        ></mf-category-picker>
        <label>
          Feed URL
          <input
            type="text"
            .value=${e.feedUrl}
            @change=${s=>this._updateEditing({feedUrl:s.target.value})}
          />
        </label>
        ${i?l`<p class="caution" role="alert">Changing the feed URL changes its source.</p>`:""}
        <label>
          <input
            type="checkbox"
            .checked=${e.disabled}
            @change=${s=>this._updateEditing({disabled:s.target.checked})}
          />
          Disabled
        </label>
        <label>
          <input
            type="checkbox"
            .checked=${e.crawler}
            @change=${s=>this._updateEditing({crawler:s.target.checked})}
          />
          Use crawler
        </label>
        <button class="save-button" @click=${()=>this._saveEdit()}>Save</button>
        <button class="cancel-button" @click=${()=>this._closeEdit()}>Cancel</button>
      </div>
    `}render(){return l`
      <ha-card header="Miniflux Feeds">
        <mf-offline .hass=${this.hass}></mf-offline>
        <div class="toolbar">
          ${this._config.show_add?l`<button class="add-button" @click=${()=>this._openWizard()}>＋ Add feed</button>`:""}
          <button class="refresh-all-button" @click=${()=>this._refreshAll()}>⟳ Refresh all</button>
        </div>
        ${this._renderList()}
        ${this._renderWizard()}
        ${this._renderEditSheet()}
        <mf-toast-host></mf-toast-host>
      </ha-card>
    `}};pe.properties={hass:{},_config:{state:!0},_feeds:{state:!0},_wizard:{state:!0},_editing:{state:!0},_pendingRefresh:{state:!0},_deletePreviewCounts:{state:!0}};customElements.define("miniflux-feed-manager-card",pe);mt({type:"miniflux-feed-manager-card",name:"Miniflux Feed Manager",description:"Create, edit, delete, refresh, and manage every Miniflux feed."});var J=class extends g{constructor(){super(...arguments);this._config={};this._onEntryPickerChange=e=>{let i=e.target;this._valueChanged({config_entry_id:i.value})}}setConfig(e){this._config=e}get availableConfigEntryIds(){return this.hass?Te(this.hass):[]}get _showEntryPicker(){return this.availableConfigEntryIds.length>1}_valueChanged(e){this._config={...this._config,...e},this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._config},bubbles:!0,composed:!0}))}render(){return l`
      ${this._showEntryPicker?l`
            <div class="entry-picker">
              <label for="config-entry-id">Miniflux instance</label>
              <select id="config-entry-id" @change=${this._onEntryPickerChange}>
                ${this.availableConfigEntryIds.map(e=>l`<option value=${e} ?selected=${this._config.config_entry_id===e}>
                      ${e}
                    </option>`)}
              </select>
            </div>
          `:""}
      ${this.renderCardFields()}
    `}};J.properties={hass:{},_config:{state:!0}};var Pe=class extends J{renderCardFields(){let t=this._config;return l`
      <label>
        Group by
        <select
          @change=${e=>this._valueChanged({group_by:e.target.value})}
        >
          <option value="category" ?selected=${(t.group_by??"category")==="category"}>
            Category
          </option>
          <option value="none" ?selected=${t.group_by==="none"}>None</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${t.show_add??!0}
          @change=${e=>this._valueChanged({show_add:e.target.checked})}
        />
        Show add-feed wizard
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${t.show_delete??!0}
          @change=${e=>this._valueChanged({show_delete:e.target.checked})}
        />
        Show delete
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${t.require_hold??!1}
          @change=${e=>this._valueChanged({require_hold:e.target.checked})}
        />
        Require hold-to-confirm on delete
      </label>
    `}};customElements.define("miniflux-feed-manager-card-editor",Pe);
