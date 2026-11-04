// 주문판 앱 파일 (안정성 2026-11-04): 인터넷이 끊겨도 주문판 화면이 열리게 마지막으로 받은 파일을 이 기기에 저장해 둬요.
// 인터넷이 되면 늘 새 파일을 먼저 받아요 (고친 게 바로 반영돼요). 4초 안에 안 오면 저장해 둔 걸 열어요.
const C="bn-app-v1";
const CORE=["./","index.html","config.js","manifest-counter.json","manifest-salad.json","manifest-sandwich.json",
  "icons/counter-192.png","icons/salad-192.png","icons/sandwich-192.png"];
const LIBS=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/ajax\/libs\/)/;
self.addEventListener("install",e=>{self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))));});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
function timeout(p,ms){return new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error("timeout")),ms); p.then(r=>{clearTimeout(t);ok(r);},e=>{clearTimeout(t);no(e);});});}
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET")return;
  const u=new URL(r.url);
  // 버전이 붙은 라이브러리(firebase·엑셀): 저장해 둔 것 먼저
  if(LIBS.test(r.url)){e.respondWith(caches.open(C).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok||res.type==="opaque")c.put(r,res.clone()); return res;}))));return;}
  if(u.origin!==self.location.origin)return;
  // 주문판 파일: 새 것 먼저, 안 되면 저장해 둔 것
  e.respondWith((async()=>{
    const c=await caches.open(C);
    try{const res=await timeout(fetch(r),r.mode==="navigate"?4000:8000); if(res.ok&&!u.search)c.put(r,res.clone()); return res;} // ?v= 같은 새 버전 확인은 저장 안 해요
    catch(err){
      const hit=await c.match(r,{ignoreSearch:true})||(r.mode==="navigate"?await c.match("index.html")||await c.match("./"):null);
      return hit||Response.error();
    }
  })());
});
