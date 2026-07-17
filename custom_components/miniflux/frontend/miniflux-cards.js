var X=globalThis,ee=X.ShadowRoot&&(X.ShadyCSS===void 0||X.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,me=Symbol(),De=new WeakMap,O=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==me)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(ee&&t===void 0){let i=e!==void 0&&e.length===1;i&&(t=De.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&De.set(e,t))}return t}toString(){return this.cssText}},Le=r=>new O(typeof r=="string"?r:r+"",void 0,me),v=(r,...t)=>{let e=r.length===1?r[0]:t.reduce((i,s,n)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[n+1],r[0]);return new O(e,r,me)},Fe=(r,t)=>{if(ee)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let i=document.createElement("style"),s=X.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,r.appendChild(i)}},ye=ee?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(let i of t.cssRules)e+=i.cssText;return Le(e)})(r):r;var{is:vt,defineProperty:bt,getOwnPropertyDescriptor:$t,getOwnPropertyNames:wt,getOwnPropertySymbols:Et,getPrototypeOf:Ct}=Object,te=globalThis,Ue=te.trustedTypes,xt=Ue?Ue.emptyScript:"",At=te.reactiveElementPolyfillSupport,N=(r,t)=>r,ve={toAttribute(r,t){switch(t){case Boolean:r=r?xt:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},Ne=(r,t)=>!vt(r,t),Oe={attribute:!0,type:String,converter:ve,reflect:!1,useDefault:!1,hasChanged:Ne};Symbol.metadata??=Symbol("metadata"),te.litPropertyMetadata??=new WeakMap;var $=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Oe){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let i=Symbol(),s=this.getPropertyDescriptor(t,i,e);s!==void 0&&bt(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){let{get:s,set:n}=$t(this.prototype,t)??{get(){return this[e]},set(o){this[e]=o}};return{get:s,set(o){let a=s?.call(this);n?.call(this,o),this.requestUpdate(t,a,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Oe}static _$Ei(){if(this.hasOwnProperty(N("elementProperties")))return;let t=Ct(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(N("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(N("properties"))){let e=this.properties,i=[...wt(e),...Et(e)];for(let s of i)this.createProperty(s,e[s])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[i,s]of e)this.elementProperties.set(i,s)}this._$Eh=new Map;for(let[e,i]of this.elementProperties){let s=this._$Eu(e,i);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let i=new Set(t.flat(1/0).reverse());for(let s of i)e.unshift(ye(s))}else t!==void 0&&e.push(ye(t));return e}static _$Eu(t,e){let i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Fe(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){let i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){let n=(i.converter?.toAttribute!==void 0?i.converter:ve).toAttribute(e,i.type);this._$Em=t,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){let i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){let n=i.getPropertyOptions(s),o=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:ve;this._$Em=s;let a=o.fromAttribute(e,n.type);this[s]=a??this._$Ej?.get(s)??a,this._$Em=null}}requestUpdate(t,e,i,s=!1,n){if(t!==void 0){let o=this.constructor;if(s===!1&&(n=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??Ne)(n,e)||i.useDefault&&i.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:n},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),n!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,n]of this._$Ep)this[s]=n;this._$Ep=void 0}let i=this.constructor.elementProperties;if(i.size>0)for(let[s,n]of i){let{wrapped:o}=n,a=this[s];o!==!0||this._$AL.has(s)||a===void 0||this.C(s,void 0,n,a)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(i=>i.hostUpdate?.()),this.update(e)):this._$EM()}catch(i){throw t=!1,this._$EM(),i}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[N("elementProperties")]=new Map,$[N("finalized")]=new Map,At?.({ReactiveElement:$}),(te.reactiveElementVersions??=[]).push("2.1.2");var $e=globalThis,ze=r=>r,ie=$e.trustedTypes,Ve=ie?ie.createPolicy("lit-html",{createHTML:r=>r}):void 0,we="$lit$",w=`lit$${Math.random().toFixed(9).slice(2)}$`,Ee="?"+w,Tt=`<${Ee}>`,M=document,V=()=>M.createComment(""),B=r=>r===null||typeof r!="object"&&typeof r!="function",Ce=Array.isArray,Ke=r=>Ce(r)||typeof r?.[Symbol.iterator]=="function",be=`[ 	
\f\r]`,z=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Be=/-->/g,We=/>/g,k=RegExp(`>|${be}(?:([^\\s"'>=/]+)(${be}*=${be}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),qe=/'/g,je=/"/g,Ye=/^(?:script|style|textarea|title)$/i,xe=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),l=xe(1),Gt=xe(2),Kt=xe(3),E=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),Ge=new WeakMap,S=M.createTreeWalker(M,129);function Je(r,t){if(!Ce(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Ve!==void 0?Ve.createHTML(t):t}var Ze=(r,t)=>{let e=r.length-1,i=[],s,n=t===2?"<svg>":t===3?"<math>":"",o=z;for(let a=0;a<e;a++){let d=r[a],h,u,c=-1,g=0;for(;g<d.length&&(o.lastIndex=g,u=o.exec(d),u!==null);)g=o.lastIndex,o===z?u[1]==="!--"?o=Be:u[1]!==void 0?o=We:u[2]!==void 0?(Ye.test(u[2])&&(s=RegExp("</"+u[2],"g")),o=k):u[3]!==void 0&&(o=k):o===k?u[0]===">"?(o=s??z,c=-1):u[1]===void 0?c=-2:(c=o.lastIndex-u[2].length,h=u[1],o=u[3]===void 0?k:u[3]==='"'?je:qe):o===je||o===qe?o=k:o===Be||o===We?o=z:(o=k,s=void 0);let p=o===k&&r[a+1].startsWith("/>")?" ":"";n+=o===z?d+Tt:c>=0?(i.push(h),d.slice(0,c)+we+d.slice(c)+w+p):d+w+(c===-2?a:p)}return[Je(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]},W=class r{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let n=0,o=0,a=t.length-1,d=this.parts,[h,u]=Ze(t,e);if(this.el=r.createElement(h,i),S.currentNode=this.el.content,e===2||e===3){let c=this.el.content.firstChild;c.replaceWith(...c.childNodes)}for(;(s=S.nextNode())!==null&&d.length<a;){if(s.nodeType===1){if(s.hasAttributes())for(let c of s.getAttributeNames())if(c.endsWith(we)){let g=u[o++],p=s.getAttribute(c).split(w),_=/([.?@])?(.*)/.exec(g);d.push({type:1,index:n,name:_[2],strings:p,ctor:_[1]==="."?re:_[1]==="?"?ne:_[1]==="@"?oe:P}),s.removeAttribute(c)}else c.startsWith(w)&&(d.push({type:6,index:n}),s.removeAttribute(c));if(Ye.test(s.tagName)){let c=s.textContent.split(w),g=c.length-1;if(g>0){s.textContent=ie?ie.emptyScript:"";for(let p=0;p<g;p++)s.append(c[p],V()),S.nextNode(),d.push({type:2,index:++n});s.append(c[g],V())}}}else if(s.nodeType===8)if(s.data===Ee)d.push({type:2,index:n});else{let c=-1;for(;(c=s.data.indexOf(w,c+1))!==-1;)d.push({type:7,index:n}),c+=w.length-1}n++}}static createElement(t,e){let i=M.createElement("template");return i.innerHTML=t,i}};function R(r,t,e=r,i){if(t===E)return t;let s=i!==void 0?e._$Co?.[i]:e._$Cl,n=B(t)?void 0:t._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),n===void 0?s=void 0:(s=new n(r),s._$AT(r,e,i)),i!==void 0?(e._$Co??=[])[i]=s:e._$Cl=s),s!==void 0&&(t=R(r,s._$AS(r,t.values),s,i)),t}var se=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??M).importNode(e,!0);S.currentNode=s;let n=S.nextNode(),o=0,a=0,d=i[0];for(;d!==void 0;){if(o===d.index){let h;d.type===2?h=new L(n,n.nextSibling,this,t):d.type===1?h=new d.ctor(n,d.name,d.strings,this,t):d.type===6&&(h=new ae(n,this,t)),this._$AV.push(h),d=i[++a]}o!==d?.index&&(n=S.nextNode(),o++)}return S.currentNode=M,s}p(t){let e=0;for(let i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}},L=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=R(this,t,e),B(t)?t===m||t==null||t===""?(this._$AH!==m&&this._$AR(),this._$AH=m):t!==this._$AH&&t!==E&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Ke(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==m&&B(this._$AH)?this._$AA.nextSibling.data=t:this.T(M.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=W.createElement(Je(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{let n=new se(s,this),o=n.u(this.options);n.p(e),this.T(o),this._$AH=n}}_$AC(t){let e=Ge.get(t.strings);return e===void 0&&Ge.set(t.strings,e=new W(t)),e}k(t){Ce(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,i,s=0;for(let n of t)s===e.length?e.push(i=new r(this.O(V()),this.O(V()),this,this.options)):i=e[s],i._$AI(n),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let i=ze(t).nextSibling;ze(t).remove(),t=i}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},P=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,n){this.type=1,this._$AH=m,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=m}_$AI(t,e=this,i,s){let n=this.strings,o=!1;if(n===void 0)t=R(this,t,e,0),o=!B(t)||t!==this._$AH&&t!==E,o&&(this._$AH=t);else{let a=t,d,h;for(t=n[0],d=0;d<n.length-1;d++)h=R(this,a[i+d],e,d),h===E&&(h=this._$AH[d]),o||=!B(h)||h!==this._$AH[d],h===m?t=m:t!==m&&(t+=(h??"")+n[d+1]),this._$AH[d]=h}o&&!s&&this.j(t)}j(t){t===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},re=class extends P{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===m?void 0:t}},ne=class extends P{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==m)}},oe=class extends P{constructor(t,e,i,s,n){super(t,e,i,s,n),this.type=5}_$AI(t,e=this){if((t=R(this,t,e,0)??m)===E)return;let i=this._$AH,s=t===m&&i!==m||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==m&&(i===m||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},ae=class{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){R(this,t)}},Qe={M:we,P:w,A:Ee,C:1,L:Ze,R:se,D:Ke,V:R,I:L,H:P,N:ne,U:oe,B:re,F:ae},kt=$e.litHtmlPolyfillSupport;kt?.(W,L),($e.litHtmlVersions??=[]).push("3.3.3");var Xe=(r,t,e)=>{let i=e?.renderBefore??t,s=i._$litPart$;if(s===void 0){let n=e?.renderBefore??null;i._$litPart$=s=new L(t.insertBefore(V(),n),n,void 0,e??{})}return s._$AI(r),s};var Ae=globalThis,f=class extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Xe(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return E}};f._$litElement$=!0,f.finalized=!0,Ae.litElementHydrateSupport?.({LitElement:f});var St=Ae.litElementPolyfillSupport;St?.({LitElement:f});(Ae.litElementVersions??=[]).push("4.2.2");var Mt="miniflux",Te=class extends Error{constructor(){super("No Miniflux instance is configured."),this.name="NoInstanceConfiguredError"}},ke=class extends Error{constructor(e){super(`Multiple Miniflux instances are configured (${e.join(", ")}); specify config_entry_id.`);this.configEntryIds=e;this.name="AmbiguousInstanceError"}},Se=class extends Error{constructor(e){super(`Unknown config_entry_id: ${e}`);this.configEntryId=e;this.name="UnknownInstanceError"}},et=new WeakMap;function Me(r){let t=et.get(r.entities);if(t)return t;let e=new Set,i=[];for(let s of Object.values(r.entities))s.platform!==Mt||!s.config_entry_id||e.has(s.config_entry_id)||(e.add(s.config_entry_id),i.push(s.config_entry_id));return et.set(r.entities,i),i}function b(r,t){let e=Me(r);if(t!==void 0){if(!e.includes(t))throw new Se(t);return t}if(e.length===1)return e[0];throw e.length===0?new Te:new ke(e)}var Rt=new Set(["service_validation_error","invalid_format","not_found"]),q=class extends Error{constructor(t){super(t.message),this.name="MinifluxApiError",this.retriable=t.retriable}};function tt(r,t){return typeof r=="object"&&r!==null&&t in r&&typeof r[t]=="string"}function Pt(r){if(tt(r,"message")){let t=tt(r,"code")?r.code:void 0;return{message:r.message,retriable:t===void 0||!Rt.has(t)}}return{message:String(r),retriable:!0}}async function Re(r){try{return await r}catch(t){throw new q(Pt(t))}}function it(r){return Object.fromEntries(Object.entries(r).filter(([,t])=>t!==void 0))}var x=class{async callWithResponse(t,e,i,s){let n=b(t,i.config_entry_id),o=it({...s,config_entry_id:n}),{response:a}=await Re(t.callService("miniflux",e,o,void 0,!0,!0));return a}async callVoid(t,e,i,s){let n=b(t,i.config_entry_id),o=it({...s,config_entry_id:n});await Re(t.callService("miniflux",e,o,void 0,!0,!1))}async getFeeds(t,e={}){return this.callWithResponse(t,"get_feeds",e,{category:e.category,only_with_errors:e.only_with_errors})}async getCategories(t,e={}){return this.callWithResponse(t,"get_categories",e,{})}async countEntries(t,e={}){return this.callWithResponse(t,"count_entries",e,{category:e.category,feed:e.feed,status:e.status,starred:e.starred})}async createFeed(t,e){return this.callWithResponse(t,"create_feed",e,{feed_url:e.feed_url,category:e.category,crawler:e.crawler})}async updateFeed(t,e){let{feed:i,title:s,category:n,feed_url:o,disabled:a,crawler:d}=e;return this.callVoid(t,"update_feed",e,{feed:i,title:s,category:n,feed_url:o,disabled:a,crawler:d})}async deleteFeed(t,e){return this.callVoid(t,"delete_feed",e,{feed:e.feed})}async refreshFeed(t,e){return this.callVoid(t,"refresh_feed",e,{feed:e.feed})}async refreshAllFeeds(t,e={}){return this.callVoid(t,"refresh_all_feeds",e,{})}async discoverFeeds(t,e){return this.callWithResponse(t,"discover_feeds",e,{url:e.url})}async markAllRead(t,e){return this.callVoid(t,"mark_all_read",e,{feed:e.feed,category:e.category,everything:e.everything})}async createCategory(t,e){return this.callWithResponse(t,"create_category",e,{title:e.title})}async updateCategory(t,e){return this.callVoid(t,"update_category",e,{category:e.category,title:e.title})}async deleteCategory(t,e){return this.callVoid(t,"delete_category",e,{category:e.category})}};var j=class extends f{constructor(){super(...arguments);this.message="";this.confirmLabel="Delete";this.cancelLabel="Cancel";this.triggerLabel="\u{1F5D1}";this.triggerAriaLabel="Delete";this.requireHold=!1;this.holdMs=900;this.disabled=!1;this._phase="idle";this._holdProgress=0;this._open=()=>{this._phase="confirming"};this._cancel=()=>{this._reset(),this.dispatchEvent(new CustomEvent("mf-cancel",{bubbles:!0,composed:!0}))};this._onConfirmClick=()=>{this._confirmNow()};this._startHold=()=>{let e=Date.now();this._holdRaf=setInterval(()=>{this._holdProgress=Math.min(1,(Date.now()-e)/this.holdMs)},16),this._holdTimer=setTimeout(()=>{this._confirmNow()},this.holdMs)};this._cancelHold=()=>{this._clearHold()}}_clearHold(){this._holdTimer&&(clearTimeout(this._holdTimer),this._holdTimer=void 0),this._holdRaf&&(clearInterval(this._holdRaf),this._holdRaf=void 0),this._holdProgress=0}_reset(){this._clearHold(),this._phase="idle"}_confirmNow(){this._reset(),this.dispatchEvent(new CustomEvent("mf-confirm",{bubbles:!0,composed:!0}))}render(){return this._phase==="idle"?l`<button
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
    `}};j.properties={message:{},confirmLabel:{attribute:"confirm-label"},cancelLabel:{attribute:"cancel-label"},triggerLabel:{attribute:"trigger-label"},triggerAriaLabel:{attribute:"trigger-aria-label"},requireHold:{type:Boolean,attribute:"require-hold"},holdMs:{type:Number,attribute:"hold-ms"},disabled:{type:Boolean},_phase:{state:!0},_holdProgress:{state:!0}},j.styles=v`
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
  `;customElements.define("mf-confirm",j);var Ht="binary_sensor.miniflux_reachable",G=class extends f{get _reachable(){return this.hass?.states[Ht]?.state==="on"}render(){return this._reachable?l``:l`
      <div class="banner" role="status" aria-live="polite">
        <span class="icon" aria-hidden="true">&#9888;</span>
        <span>Miniflux is unreachable. Showing last-known data; actions are disabled.</span>
      </div>
    `}};G.properties={hass:{}},G.styles=v`
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
  `;customElements.define("mf-offline",G);var It=6e3,K=class extends f{constructor(){super(...arguments);this._toasts=[];this._nextId=1;this._timers=new Map}show(e,i={}){let s=this._nextId++,n=i.timeoutMs??It;this._toasts=[...this._toasts,{id:s,message:e,undo:i.undo}],this._timers.set(s,setTimeout(()=>this._dismiss(s),n))}_dismiss(e){clearTimeout(this._timers.get(e)),this._timers.delete(e),this._toasts=this._toasts.filter(i=>i.id!==e)}_onUndoClick(e){e.undo?.(),this._dismiss(e.id)}render(){return l`
      <div class="toasts" aria-live="assertive">
        ${this._toasts.map(e=>l`
            <div class="toast">
              <span>${e.message}</span>
              ${e.undo?l`<button @click=${()=>this._onUndoClick(e)}>Undo</button>`:""}
            </div>
          `)}
      </div>
    `}};K.properties={_toasts:{state:!0}},K.styles=v`
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
  `;customElements.define("mf-toast-host",K);var st={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},rt=r=>(...t)=>({_$litDirective$:r,values:t}),de=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,i){this._$Ct=t,this._$AM=e,this._$Ci=i}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};var{I:Dt}=Qe,nt=r=>r;var ot=()=>document.createComment(""),F=(r,t,e)=>{let i=r._$AA.parentNode,s=t===void 0?r._$AB:t._$AA;if(e===void 0){let n=i.insertBefore(ot(),s),o=i.insertBefore(ot(),s);e=new Dt(n,o,r,r.options)}else{let n=e._$AB.nextSibling,o=e._$AM,a=o!==r;if(a){let d;e._$AQ?.(r),e._$AM=r,e._$AP!==void 0&&(d=r._$AU)!==o._$AU&&e._$AP(d)}if(n!==s||a){let d=e._$AA;for(;d!==n;){let h=nt(d).nextSibling;nt(i).insertBefore(d,s),d=h}}}return e},A=(r,t,e=r)=>(r._$AI(t,e),r),Lt={},at=(r,t=Lt)=>r._$AH=t,dt=r=>r._$AH,le=r=>{r._$AR(),r._$AA.remove()};var lt=(r,t,e)=>{let i=new Map;for(let s=t;s<=e;s++)i.set(r[s],s);return i},ct=rt(class extends de{constructor(r){if(super(r),r.type!==st.CHILD)throw Error("repeat() can only be used in text expressions")}dt(r,t,e){let i;e===void 0?e=t:t!==void 0&&(i=t);let s=[],n=[],o=0;for(let a of r)s[o]=i?i(a,o):o,n[o]=e(a,o),o++;return{values:n,keys:s}}render(r,t,e){return this.dt(r,t,e).values}update(r,[t,e,i]){let s=dt(r),{values:n,keys:o}=this.dt(t,e,i);if(!Array.isArray(s))return this.ut=o,n;let a=this.ut??=[],d=[],h,u,c=0,g=s.length-1,p=0,_=n.length-1;for(;c<=g&&p<=_;)if(s[c]===null)c++;else if(s[g]===null)g--;else if(a[c]===o[p])d[p]=A(s[c],n[p]),c++,p++;else if(a[g]===o[_])d[_]=A(s[g],n[_]),g--,_--;else if(a[c]===o[_])d[_]=A(s[c],n[_]),F(r,d[_+1],s[c]),c++,_--;else if(a[g]===o[p])d[p]=A(s[g],n[p]),F(r,s[c],s[g]),g--,p++;else if(h===void 0&&(h=lt(o,p,_),u=lt(a,c,g)),h.has(a[c]))if(h.has(a[g])){let y=u.get(o[p]),I=y!==void 0?s[y]:null;if(I===null){let D=F(r,s[c]);A(D,n[p]),d[p]=D}else d[p]=A(I,n[p]),F(r,s[c],I),s[y]=null;p++}else le(s[g]),g--;else le(s[c]),c++;for(;p<=_;){let y=F(r,d[_+1]);A(y,n[p]),d[p++]=y}for(;c<=g;){let y=s[c++];y!==null&&le(y)}return this.ut=o,at(r,d),E}});var Y=class extends f{constructor(){super(...arguments);this.items=[];this.itemHeight=48;this.height="520px";this.bufferRows=5;this._scrollTop=0;this._onScroll=e=>{this._scrollTop=e.target.scrollTop}}get _viewportHeightPx(){let e=Number.parseInt(this.height,10);return Number.isFinite(e)?e:0}get _range(){let e=this.items.length,i=Math.max(0,Math.floor(this._scrollTop/this.itemHeight)-this.bufferRows),s=Math.ceil(this._viewportHeightPx/this.itemHeight)+this.bufferRows*2,n=Math.min(e,i+s);return{start:i,end:n}}render(){let{start:e,end:i}=this._range,s=this.items.length*this.itemHeight,n=e*this.itemHeight,o=this.items.slice(e,i);return l`
      <div class="viewport" style="height:${this.height}" @scroll=${this._onScroll}>
        <div class="spacer" style="height:${s}px">
          <div class="window" style="transform:translateY(${n}px)">
            ${ct(o,a=>a.id,(a,d)=>this.renderItem(a,e+d))}
          </div>
        </div>
      </div>
    `}};Y.properties={items:{attribute:!1},itemHeight:{type:Number,attribute:"item-height"},height:{},bufferRows:{type:Number,attribute:"buffer-rows"},renderItem:{attribute:!1},_scrollTop:{state:!0}},Y.styles=v`
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
  `;customElements.define("mf-virtual-list",Y);function Ft(r){let t=Object.entries(r).filter(([,e])=>e!==void 0).sort(([e],[i])=>e.localeCompare(i));return JSON.stringify(t)}function ht(r,t,e={}){return`${r}\0${t}\0${Ft(e)}`}function ce(r,t,e){return r.startsWith(`${t}\0${e}\0`)}var he=class{constructor(t=()=>Date.now()){this.now=t;this.records=new Map}get(t){let e=this.records.get(t);if(e){if(this.now()>=e.expiresAt){this.records.delete(t);return}return e.value}}set(t,e,i){this.records.set(t,{value:e,expiresAt:this.now()+i})}invalidate(t){this.records.delete(t)}invalidateWhere(t){for(let e of this.records.keys())t(e)&&this.records.delete(e)}keysWhere(t){let e=this.now(),i=[];for(let[s,n]of this.records)e<n.expiresAt&&t(s)&&i.push(s);return i}clear(){this.records.clear()}};var Ut=["miniflux_new_entries","miniflux_entry_saved","miniflux_feed_error","miniflux_feed_recovered"],Ot=["sensor.miniflux_unread_entries","sensor.miniflux_starred_entries","sensor.miniflux_feeds_with_errors","binary_sensor.miniflux_reachable"];var pe=class{constructor(){this.listeners=new Set;this.lastEntityTick=new Map;this.unsubscribes=[];this.adminAttached=!1}onInvalidate(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notify(){for(let t of this.listeners)t()}scheduleDebouncedNotify(){clearTimeout(this.debounceTimer),this.debounceTimer=setTimeout(()=>{this.debounceTimer=void 0,this.notify()},2e3)}async attachAdminEvents(t){if(!this.adminAttached){this.adminAttached=!0;try{for(let e of Ut){let i=await t.connection.subscribeEvents(()=>{this.scheduleDebouncedNotify()},e);this.unsubscribes.push(i)}}catch{}}}detach(){clearTimeout(this.debounceTimer),this.debounceTimer=void 0;for(let t of this.unsubscribes.splice(0))t();this.adminAttached=!1,this.lastEntityTick.clear()}onHassUpdate(t){let e=!1;for(let i of Ot){let s=t.states[i]?.last_changed;s!==void 0&&this.lastEntityTick.get(i)!==s&&(this.lastEntityTick.set(i,s),e=!0)}e&&this.notify()}notifyLocalMutation(){this.notify()}};var J="get_feeds",U="get_categories",T=class{constructor(){this.cache=new he;this.bus=new pe;this.bus.onInvalidate(()=>this.cache.clear())}async query(t,e,i,s,n){let o=ht(t,e,i),a=this.cache.get(o);if(a!==void 0)return a;let d=await n();return this.cache.set(o,d,s),d}keysFor(t,e){return this.cache.keysWhere(i=>ce(i,t,e))}invalidateFeeds(t){this.cache.invalidateWhere(e=>ce(e,t,J))}invalidateCategories(t){this.cache.invalidateWhere(e=>ce(e,t,U))}invalidateFeedsAndCategories(t){this.invalidateFeeds(t),this.invalidateCategories(t)}notifyLocalMutation(){this.bus.notifyLocalMutation()}async attach(t){await this.bus.attachAdminEvents(t)}onHassUpdate(t){this.bus.onHassUpdate(t)}detach(){this.bus.detach()}};var pt="__mf_create_new__",Z=class extends f{constructor(){super(...arguments);this.store=new T;this.api=new x;this.emit="id";this.allowCreate=!1;this._categories=[];this._creating=!1;this._onChange=e=>{let i=e.target;if(i.value===pt){this._creating=!0;return}let s=this._categories.find(n=>String(this._refValue(n))===i.value);s&&this._emitPicked(this._refValue(s))};this._onCreateSubmit=async e=>{e.preventDefault();let i=this.hass,o=e.target.elements.namedItem("title").value.trim();if(!o)return;let a=b(i,this.configEntryId),{category_id:d}=await this.api.createCategory(i,{title:o,config_entry_id:a});this.store.invalidateCategories(a),this.store.notifyLocalMutation(),await this._load(i),this._creating=!1,this._emitPicked(this.emit==="title"?o:d)};this._cancelCreate=()=>{this._creating=!1}}willUpdate(e){e.has("hass")&&this.hass&&this._load(this.hass)}async _load(e){let i=b(e,this.configEntryId),{categories:s}=await this.store.query(i,U,{},3e5,()=>this.api.getCategories(e,{config_entry_id:i}));this._categories=s}_refValue(e){return this.emit==="title"?e.title:e.id}_emitPicked(e){this.value=e,this.dispatchEvent(new CustomEvent("mf-picked",{detail:{value:e},bubbles:!0,composed:!0}))}render(){return this._creating?l`
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
        ${this.allowCreate?l`<option value=${pt}>+ New category…</option>`:""}
      </select>
    `}};Z.properties={hass:{},store:{},api:{},configEntryId:{attribute:"config-entry-id"},emit:{},value:{},allowCreate:{type:Boolean,attribute:"allow-create"},_categories:{state:!0},_creating:{state:!0}},Z.styles=v`
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
  `;customElements.define("mf-category-picker",Z);async function Q(r,t,e,i,s){let n=new Map;for(let o of t){let a=r.get(o);n.set(o,a),a!==void 0&&r.set(o,e(a),i)}try{return await s(),{ok:!0}}catch(o){for(let[a,d]of n)d===void 0?r.invalidate(a):r.set(a,d,i);return{ok:!1,error:o}}}var ut="__uncategorized__",Nt="Uncategorized";function gt(r){let t=r.trim();return t?t[0].toUpperCase():"?"}function ft(r){let t=new Map;for(let s of r){let n=s.category_id??ut,o=s.category_id===null?Nt:s.category_title??"",a=t.get(n);a?a.feeds.push(s):t.set(n,{key:n,title:o,feeds:[s]})}let e=[...t.values()].sort((s,n)=>s.title.localeCompare(n.title)),i=e.findIndex(s=>s.key===ut);if(i!==-1){let[s]=e.splice(i,1);e.push(s)}return e}function _t(r,t){if(!r)return"Never checked";let e=new Date(r),i=t.getTime()-e.getTime();if(i<0)return"Just now";let s=Math.floor(i/6e4);if(s<1)return"Just now";if(s<60)return`${s}m ago`;let n=Math.floor(s/60);return n<24?`${n}h ago`:`${Math.floor(n/24)}d ago`}function mt(r,t){let e={};return t.title!==r.title&&(e.title=t.title),t.category!==void 0&&t.category!==r.category_id&&(e.category=t.category),t.feed_url!==r.feed_url&&(e.feed_url=t.feed_url),t.disabled!==r.disabled&&(e.disabled=t.disabled),e.crawler=t.crawler,e}function ue(r){window.customCards=window.customCards??[],window.customCards.push(r)}var zt=100,Vt=56,Pe={step:"closed",siteUrl:"",candidates:[],crawler:!1},ge=class extends f{constructor(){super(...arguments);this.store=new T;this.api=new x;this._config={type:"custom:miniflux-feed-manager-card"};this._feeds=[];this._wizard=Pe;this._pendingRefresh=new Set;this._deletePreviewCounts=new Map}createRenderRoot(){return this}setConfig(e){this._config={type:e.type,config_entry_id:e.config_entry_id,group_by:e.group_by??"category",category:e.category,show_add:e.show_add??!0,show_delete:e.show_delete??!0,require_hold:e.require_hold??!1,height:e.height??"520px"}}static getStubConfig(){return{type:"custom:miniflux-feed-manager-card"}}static getConfigElement(){return document.createElement("miniflux-feed-manager-card-editor")}getCardSize(){return 6}getGridOptions(){return{rows:6,columns:12}}get _configEntryId(){return b(this.hass,this._config.config_entry_id)}get _toastHost(){return this.querySelector("mf-toast-host")}willUpdate(e){e.has("hass")&&this.hass&&(this.store.onHassUpdate(this.hass),this.store.attach(this.hass),this._loadFeeds())}async _loadFeeds(){let e=this.hass,i=this._configEntryId,s={};this._config.category!==void 0&&(s.category=this._config.category);let n=new Map(this._feeds.map(a=>[a.id,a.checked_at])),{feeds:o}=await this.store.query(i,J,s,3e5,()=>this.api.getFeeds(e,{config_entry_id:i,category:this._config.category}));this._feeds=o;for(let a of o)this._pendingRefresh.has(a.id)&&n.get(a.id)!==a.checked_at&&this._pendingRefresh.delete(a.id)}async _refreshFeed(e){let i=this.hass;this._pendingRefresh=new Set(this._pendingRefresh).add(e.id);try{await this.api.refreshFeed(i,{feed:e.id,config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),await this._loadFeeds()}catch(s){this._pendingRefresh=new Set([...this._pendingRefresh].filter(n=>n!==e.id)),this._toastHost?.show(this._errorMessage(s))}}async _refreshAll(){let e=this.hass;try{await this.api.refreshAllFeeds(e,{config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),await this._loadFeeds()}catch(i){this._toastHost?.show(this._errorMessage(i))}}async _markFeedRead(e){let i=this.hass;try{await this.api.markAllRead(i,{feed:e.id,config_entry_id:this._configEntryId}),this.store.notifyLocalMutation()}catch(s){this._toastHost?.show(this._errorMessage(s))}}async _toggleDisabled(e){let i=this.hass,s=this._configEntryId,n=this.store.keysFor(s,J),o=!e.disabled,a=await Q(this.store.cache,n,d=>({feeds:d.feeds.map(h=>h.id===e.id?{...h,disabled:o}:h)}),3e5,()=>this.api.updateFeed(i,{feed:e.id,disabled:o,config_entry_id:s}));a.ok?await this._loadFeeds():this._toastHost?.show(this._errorMessage(a.error))}async _prepareDelete(e){let i=this.hass;try{let{total:s}=await this.api.countEntries(i,{feed:e.id,config_entry_id:this._configEntryId});this._deletePreviewCounts=new Map(this._deletePreviewCounts).set(e.id,s)}catch{this._deletePreviewCounts=new Map(this._deletePreviewCounts).set(e.id,0)}}async _deleteFeed(e){let i=this.hass,s=this._configEntryId;try{await this.api.deleteFeed(i,{feed:e.id,config_entry_id:s}),this.store.invalidateFeedsAndCategories(s),this.store.notifyLocalMutation(),await this._loadFeeds()}catch(n){this._toastHost?.show(this._errorMessage(n))}}_errorMessage(e){return e instanceof q?e.message:String(e)}_openWizard(){this._wizard={...Pe,step:"discover"}}_closeWizard(){this._wizard=Pe}_isDirectFeedUrl(e){return/\.(xml|rss|atom)(\?.*)?$/i.test(e.trim())}async _discover(e){let i=this.hass;if(this._isDirectFeedUrl(e)){this._wizard={...this._wizard,siteUrl:e,step:"configure",selectedFeedUrl:e,error:void 0};return}try{let{feeds:s}=await this.api.discoverFeeds(i,{url:e,config_entry_id:this._configEntryId});this._wizard={...this._wizard,siteUrl:e,candidates:s,error:void 0}}catch(s){this._wizard={...this._wizard,error:this._errorMessage(s)}}}_pickCandidate(e){this._wizard={...this._wizard,step:"configure",selectedFeedUrl:e,error:void 0}}async _createFeed(){let e=this.hass;try{await this.api.createFeed(e,{feed_url:this._wizard.selectedFeedUrl,category:this._wizard.category,crawler:this._wizard.crawler,config_entry_id:this._configEntryId}),this.store.invalidateFeeds(this._configEntryId),this.store.notifyLocalMutation(),await this._loadFeeds(),this._closeWizard()}catch(i){this._wizard={...this._wizard,error:this._errorMessage(i)}}}_openEdit(e){this._editing={feed:e,title:e.title,category:e.category_id??void 0,feedUrl:e.feed_url,disabled:e.disabled,crawler:!1}}_closeEdit(){this._editing=void 0}async _saveEdit(){if(!this._editing)return;let e=this.hass,i=this._configEntryId,{feed:s,title:n,category:o,feedUrl:a,disabled:d,crawler:h}=this._editing,u=mt(s,{title:n,category:o,feed_url:a,disabled:d,crawler:h}),c="category"in u;if("title"in u&&!c){let p=this.store.keysFor(i,J),_=this._feeds,y=D=>D.map(_e=>_e.id===s.id?{..._e,title:n}:_e);this._feeds=y(this._feeds),this._closeEdit();let I=await Q(this.store.cache,p,D=>({feeds:y(D.feeds)}),3e5,()=>this.api.updateFeed(e,{feed:s.id,...u,config_entry_id:i}));I.ok||(this._feeds=_,this._toastHost?.show(this._errorMessage(I.error)));return}try{await this.api.updateFeed(e,{feed:s.id,...u,config_entry_id:i}),this.store.invalidateFeedsAndCategories(i),this.store.notifyLocalMutation(),await this._loadFeeds(),this._closeEdit()}catch(p){this._toastHost?.show(this._errorMessage(p))}}_renderRow(e){let i=this._pendingRefresh.has(e.id),s=this._config.show_delete,n=this._deletePreviewCounts.get(e.id);return l`
      <div class="feed-row ${e.disabled?"feed-row--disabled":""}" data-feed-id=${e.id}>
        <span class="avatar" aria-hidden="true">${gt(e.title)}</span>
        <span class="title">${e.title}</span>
        ${e.disabled?l`<span class="badge badge--paused" title="Disabled">⏸</span>`:""}
        ${e.parsing_error_count>0?l`<span class="badge badge--error" title=${e.parsing_error_message}>⚠</span>`:""}
        <span class="unread">${e.unread}</span>
        <span class="age">${_t(e.checked_at,new Date)}</span>

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
              message=${n===void 0?`Delete ${e.title}?`:`Delete ${e.title} and its ${n} entries?`}
              @click=${()=>this._prepareDelete(e)}
              @mf-confirm=${()=>this._deleteFeed(e)}
            ></mf-confirm>`:""}
      </div>
    `}_renderList(){let e=this._config.height??"520px";if(this._feeds.length>zt){let s=this._feeds.map(n=>({...n}));return l`<mf-virtual-list
        .items=${s}
        item-height=${Vt}
        height=${e}
        .renderItem=${n=>this._renderRow(n)}
      ></mf-virtual-list>`}if(this._config.group_by==="none")return l`<div class="feed-list" style="max-height:${e};overflow-y:auto">
        ${this._feeds.map(s=>this._renderRow(s))}
      </div>`;let i=ft(this._feeds);return l`<div class="feed-list" style="max-height:${e};overflow-y:auto">
      ${i.map(s=>l`
          <div class="feed-group">
            <h3 class="feed-group__title">${s.title}</h3>
            ${s.feeds.map(n=>this._renderRow(n))}
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
    `}};ge.properties={hass:{},_config:{state:!0},_feeds:{state:!0},_wizard:{state:!0},_editing:{state:!0},_pendingRefresh:{state:!0},_deletePreviewCounts:{state:!0}};customElements.define("miniflux-feed-manager-card",ge);ue({type:"miniflux-feed-manager-card",name:"Miniflux Feed Manager",description:"Create, edit, delete, refresh, and manage every Miniflux feed."});var H=class extends f{constructor(){super(...arguments);this._config={};this._onEntryPickerChange=e=>{let i=e.target;this._valueChanged({config_entry_id:i.value})}}setConfig(e){this._config=e}get availableConfigEntryIds(){return this.hass?Me(this.hass):[]}get _showEntryPicker(){return this.availableConfigEntryIds.length>1}_valueChanged(e){this._config={...this._config,...e},this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._config},bubbles:!0,composed:!0}))}render(){return l`
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
    `}};H.properties={hass:{},_config:{state:!0}};var He=class extends H{renderCardFields(){let t=this._config;return l`
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
    `}};customElements.define("miniflux-feed-manager-card-editor",He);function yt(r,t){let e=r.map((i,s)=>({category:i,index:s}));return e.sort((i,s)=>{if(t==="title")return i.category.title.localeCompare(s.category.title);let n=t==="unread"?"unread":"feed_count",o=i.category[n],a=s.category[n];return o===null&&a===null?i.index-s.index:o===null?1:a===null?-1:o!==a?a-o:i.index-s.index}),e.map(i=>i.category)}var fe=class extends f{constructor(){super(...arguments);this.store=new T;this.api=new x;this._config={type:"custom:miniflux-category-manager-card"};this._categories=[];this._expanded=new Set;this._expandedFeeds=new Map;this._creating=!1;this._newTitle="";this._markReadPreview=new Map;this._deletePreview=new Map}createRenderRoot(){return this}setConfig(e){this._config={type:e.type,config_entry_id:e.config_entry_id,show_empty:e.show_empty??!0,show_delete:e.show_delete??!0,require_hold:e.require_hold??!0,sort:e.sort??"unread"}}static getStubConfig(){return{type:"custom:miniflux-category-manager-card"}}static getConfigElement(){return document.createElement("miniflux-category-manager-card-editor")}getCardSize(){return 5}getGridOptions(){return{rows:5,columns:12}}get _configEntryId(){return b(this.hass,this._config.config_entry_id)}get _toastHost(){return this.querySelector("mf-toast-host")}_errorMessage(e){return e.message}willUpdate(e){e.has("hass")&&this.hass&&(this.store.onHassUpdate(this.hass),this.store.attach(this.hass),this._loadCategories())}async _loadCategories(){let e=this.hass,i=this._configEntryId,{categories:s}=await this.store.query(i,U,{},3e5,()=>this.api.getCategories(e,{config_entry_id:i}));this._categories=s}_openCreate(){this._creating=!0,this._newTitle="",this._createError=void 0}async _submitCreate(){let e=this.hass,i=this._newTitle.trim();if(i)try{await this.api.createCategory(e,{title:i,config_entry_id:this._configEntryId}),this.store.invalidateCategories(this._configEntryId),this.store.notifyLocalMutation(),await this._loadCategories(),this._creating=!1}catch(s){this._createError=this._errorMessage(s)}}_cancelCreate(){this._creating=!1,this._createError=void 0}_startRename(e){this._renaming={categoryId:e.id,title:e.title}}_cancelRename(){this._renaming=void 0}async _submitRename(){let e=this.hass,i=this._configEntryId,{categoryId:s,title:n}=this._renaming,o=this.store.keysFor(i,U),a=this._categories;this._categories=this._categories.map(h=>h.id===s?{...h,title:n}:h),this._renaming=void 0;let d=await Q(this.store.cache,o,h=>({categories:h.categories.map(u=>u.id===s?{...u,title:n}:u)}),3e5,()=>this.api.updateCategory(e,{category:s,title:n,config_entry_id:i}));d.ok||(this._categories=a,this._toastHost?.show(this._errorMessage(d.error)))}async _prepareMarkRead(e){let i=this.hass;try{let{total:s}=await this.api.countEntries(i,{category:e.id,status:["unread"],config_entry_id:this._configEntryId});this._markReadPreview=new Map(this._markReadPreview).set(e.id,s)}catch{this._markReadPreview=new Map(this._markReadPreview).set(e.id,0)}}async _markCategoryRead(e){let i=this.hass;try{await this.api.markAllRead(i,{category:e.id,config_entry_id:this._configEntryId}),this.store.notifyLocalMutation()}catch(s){this._toastHost?.show(this._errorMessage(s))}}async _prepareDelete(e){let i=this.hass;try{let{feeds:s}=await this.api.getFeeds(i,{category:e.id,config_entry_id:this._configEntryId});this._deletePreview=new Map(this._deletePreview).set(e.id,s.length)}catch{this._deletePreview=new Map(this._deletePreview).set(e.id,0)}}async _deleteCategory(e){let i=this.hass,s=this._configEntryId;try{await this.api.deleteCategory(i,{category:e.id,config_entry_id:s}),this.store.invalidateFeedsAndCategories(s),this.store.notifyLocalMutation(),await this._loadCategories()}catch(n){this._toastHost?.show(this._errorMessage(n))}}async _toggleExpand(e){let i=this.hass;if(this._expanded.has(e.id)){this._expanded=new Set([...this._expanded].filter(n=>n!==e.id));return}this._expanded=new Set(this._expanded).add(e.id);let{feeds:s}=await this.api.getFeeds(i,{category:e.id,config_entry_id:this._configEntryId});this._expandedFeeds=new Map(this._expandedFeeds).set(e.id,s)}_renderRow(e){let i=this._renaming?.categoryId===e.id,s=this._expanded.has(e.id),n=this._markReadPreview.get(e.id),o=this._deletePreview.get(e.id);return l`
      <div class="category-row" data-category-id=${e.id}>
        <button class="expand-toggle" aria-label="Expand ${e.title}" @click=${()=>this._toggleExpand(e)}>
          ${s?"\u25BE":"\u25B8"}
        </button>

        ${i?l`
              <input
                class="rename-input"
                type="text"
                .value=${this._renaming.title}
                @change=${a=>this._renaming={...this._renaming,title:a.target.value}}
              />
              <button class="rename-save" @click=${()=>this._submitRename()}>Save</button>
              <button class="rename-cancel" @click=${()=>this._cancelRename()}>Cancel</button>
            `:l`
              <span class="title">${e.title}</span>
              <span class="feed-count">${e.feed_count===null?"\u2014":e.feed_count}</span>
              <span class="unread">${e.unread===null?"\u2014":e.unread}</span>
              <button class="rename-button" aria-label="Rename ${e.title}" @click=${()=>this._startRename(e)}>
                ✎
              </button>
              <mf-confirm
                trigger-label="✓"
                trigger-aria-label="Mark ${e.title} read"
                confirm-label="Mark read"
                message=${n===void 0?`Mark ${e.title} read?`:`Mark ${n} unread entries in ${e.title} as read?`}
                @click=${()=>this._prepareMarkRead(e)}
                @mf-confirm=${()=>this._markCategoryRead(e)}
              ></mf-confirm>
              ${this._config.show_delete?l`<mf-confirm
                    trigger-label="🗑"
                    trigger-aria-label="Delete ${e.title}"
                    confirm-label="Delete"
                    .requireHold=${this._config.require_hold}
                    message=${o===void 0?`Delete ${e.title}?`:`Delete ${e.title} \u2014 its ${o} feeds and their entries go with it?`}
                    @click=${()=>this._prepareDelete(e)}
                    @mf-confirm=${()=>this._deleteCategory(e)}
                  ></mf-confirm>`:""}
            `}
      </div>
      ${s?this._renderExpandedFeeds(e):""}
    `}_renderExpandedFeeds(e){let i=this._expandedFeeds.get(e.id);return i?i.length===0?l`<div class="expanded-feeds empty">No feeds.</div>`:l`
      <ul class="expanded-feeds">
        ${i.map(s=>l`<li data-feed-id=${s.id}>${s.title}</li>`)}
      </ul>
    `:l`<div class="expanded-feeds loading">Loading…</div>`}_renderCreateForm(){return l`
      <div class="create-row">
        ${this._createError?l`<p class="error" role="alert">${this._createError}</p>`:""}
        <input
          class="create-title"
          type="text"
          placeholder="Category name"
          .value=${this._newTitle}
          @change=${e=>this._newTitle=e.target.value}
        />
        <button class="create-submit" @click=${()=>this._submitCreate()}>Create</button>
        <button class="create-cancel" @click=${()=>this._cancelCreate()}>Cancel</button>
      </div>
    `}render(){let e=this._config.show_empty?this._categories:this._categories.filter(s=>(s.feed_count??0)>0),i=yt(e,this._config.sort??"unread");return l`
      <ha-card header="Miniflux Categories">
        <mf-offline .hass=${this.hass}></mf-offline>
        <div class="toolbar">
          <button class="add-button" @click=${()=>this._openCreate()}>＋ New category</button>
        </div>
        ${this._creating?this._renderCreateForm():""}
        <div class="category-list">${i.map(s=>this._renderRow(s))}</div>
        <mf-toast-host></mf-toast-host>
      </ha-card>
    `}};fe.properties={hass:{},_config:{state:!0},_categories:{state:!0},_expanded:{state:!0},_expandedFeeds:{state:!0},_renaming:{state:!0},_creating:{state:!0},_newTitle:{state:!0},_createError:{state:!0},_markReadPreview:{state:!0},_deletePreview:{state:!0}};customElements.define("miniflux-category-manager-card",fe);ue({type:"miniflux-category-manager-card",name:"Miniflux Category Manager",description:"Create, rename, delete, and mark categories read \u2014 including empty ones."});var Ie=class extends H{renderCardFields(){let t=this._config;return l`
      <label>
        Sort
        <select
          @change=${e=>this._valueChanged({sort:e.target.value})}
        >
          <option value="unread" ?selected=${(t.sort??"unread")==="unread"}>Unread</option>
          <option value="title" ?selected=${t.sort==="title"}>Title</option>
          <option value="feeds" ?selected=${t.sort==="feeds"}>Feeds</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${t.show_empty??!0}
          @change=${e=>this._valueChanged({show_empty:e.target.checked})}
        />
        Show empty categories
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
          .checked=${t.require_hold??!0}
          @change=${e=>this._valueChanged({require_hold:e.target.checked})}
        />
        Require hold-to-confirm on delete
      </label>
    `}};customElements.define("miniflux-category-manager-card-editor",Ie);
