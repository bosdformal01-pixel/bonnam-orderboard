// 앱으로 설치하기 위한 작은 파일이에요. 아무것도 저장해 두지 않아서 늘 최신 주문판이 열려요.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",()=>{});
