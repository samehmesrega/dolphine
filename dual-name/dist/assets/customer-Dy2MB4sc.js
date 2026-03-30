import{c as T,b as A,f as N,B as z,V as x,C as B}from"./AmbigramBuilder-Ccoo7KR_.js";function I(t,e){t.innerHTML=`
    <div class="customer-inputs">
      <div class="customer-input-group">
        <label for="name1">Name 1</label>
        <input type="text" id="name1" maxlength="15" placeholder="e.g. JAMES" autocomplete="off" spellcheck="false" />
      </div>
      <div class="customer-input-group">
        <label for="name2">Name 2</label>
        <input type="text" id="name2" maxlength="15" placeholder="e.g. SARAH" autocomplete="off" spellcheck="false" />
      </div>
    </div>
    <div class="customer-warning" id="length-warning">Add hearts ♥ to balance the letters in both names</div>
    <button class="customer-generate-btn" id="btn-generate">Generate Preview</button>
  `;const n=t.querySelector("#name1"),o=t.querySelector("#name2"),s=t.querySelector("#btn-generate"),c=t.querySelector("#length-warning");function h(){const r=n.value.trim(),l=o.value.trim();r&&l&&r.length!==l.length?c.classList.add("active"):c.classList.remove("active")}n.addEventListener("input",h),o.addEventListener("input",h);function f(r){r.key==="Enter"&&e.onGenerate()}return n.addEventListener("keydown",f),o.addEventListener("keydown",f),s.addEventListener("click",()=>e.onGenerate()),{getNames(){return{name1:n.value.trim(),name2:o.value.trim()}},setNames(r,l){n.value=r,o.value=l},setLoading(r){s.disabled=r,s.textContent=r?"Generating...":"Generate Preview"},hide(){t.style.display="none"}}}const H="*",d={fontFile:"OverpassMono-Bold.ttf",fontSize:72,cornerRadius:5,baseThickness:2,heartStyle:9,inscriptionText:""},i=document.getElementById("preview-area"),a=T(i);a.animate();const g=document.createElement("div");g.className="customer-loading";g.innerHTML='<div class="spinner"></div><span>Generating your preview...</span>';i.appendChild(g);const w=document.createElement("div");w.className="customer-placeholder";w.innerHTML=`
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
  <span>Type two names and tap <strong>Generate</strong><br>to create your custom 3D piece</span>
`;i.appendChild(w);const v=document.createElement("div");v.className="customer-drag-hint";v.innerHTML=`
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
  <span>Drag to rotate</span>
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
`;i.appendChild(v);let b=!1;function M(){b||(b=!0,v.classList.add("hidden"))}i.addEventListener("pointerdown",M);i.addEventListener("touchstart",M,{passive:!0});const u=document.createElement("div");u.className="customer-error";i.appendChild(u);const p=I(document.getElementById("customer-controls"),{onGenerate:C});let m=null,L="#4361ee";async function C(){const{name1:t,name2:e}=p.getNames();if(!t||!e){k("Please enter both names.");return}p.setLoading(!0),g.classList.add("active"),w.style.display="none",y("preview-loading");try{const n=await A({textA:t,textB:e,fontUrl:`/fonts/${d.fontFile}`,fontSize:d.fontSize,cornerRadius:d.cornerRadius,baseHeight:d.baseThickness,heartStyle:d.heartStyle,inscriptionText:d.inscriptionText});m&&(a.scene.remove(m),D(m)),m=n,S(L),a.scene.add(n),N(a.camera,n,a.controls);const o=new z().setFromObject(n),s=o.getCenter(new x),c=o.getSize(new x),h=Math.max(c.x,c.z,c.y*.5),f=a.camera.fov*(Math.PI/180),r=h/2/Math.tan(f/2)*1.5,l=o.min.y,E=Math.PI/4;a.camera.position.set(s.x-r*Math.cos(E),l,s.z+r*Math.sin(E)),a.camera.lookAt(s.x,s.y,s.z),a.controls.target.copy(s),a.controls.update(),b||v.classList.add("visible"),a.renderer.render(a.scene,a.camera);const G=a.renderer.domElement.toDataURL("image/jpeg",.8);y("preview-ready",{name1:t,name2:e,color:L,screenshot:G})}catch(n){console.error("Generation failed:",n),k("Failed to generate. Try different names."),y("preview-error",{message:n.message})}p.setLoading(!1),g.classList.remove("active")}function S(t){if(L=t,!m)return;const e=new B(t);m.traverse(n=>{n.isMesh&&n.material&&n.material.color.copy(e)})}function k(t){u.textContent=t,u.classList.add("active"),setTimeout(()=>u.classList.remove("active"),4e3)}function y(t,e={}){window.parent!==window&&window.parent.postMessage({source:"dual-name",type:t,...e},H)}function D(t){t.traverse(e=>{e.geometry&&e.geometry.dispose(),e.material&&(Array.isArray(e.material)?e.material.forEach(n=>n.dispose()):e.material.dispose())})}window.addEventListener("message",t=>{const e=t.data;!e||e.source!=="dual-name-parent"||(e.type==="change-color"&&e.hex&&S(e.hex),e.type==="set-names"&&e.name1&&e.name2&&(p.setNames(e.name1,e.name2),p.hide(),C()))});y("iframe-ready");
