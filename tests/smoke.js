// 주문판 기본 시험 (안정성 2026-11-04): 세 화면이 오류 없이 열리는지, 인터넷이 끊겨도 주문 넣기가 멈추지 않는지 봐요.
//   node tests/smoke.js
// 저장소(Firebase)는 가짜를 써요. 실제 주문은 건드리지 않아요.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.join(__dirname,'..'), PORT=+(process.env.PORT||8780);
const srv=http.createServer((q,s)=>{let p=path.join(ROOT,q.url.split('?')[0].split('#')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){s.statusCode=404;s.end();return;}s.end(d);});}).listen(PORT);
const fails=[]; const ok=(c,m)=>{console.log((c?"성공 ":"실패 ")+m); if(!c)fails.push(m);};
(async()=>{
  const b=await chromium.launch();
  for(const m of ["counter","salad","sandwich"]){
    const pg=await b.newPage({viewport:{width:1100,height:800}}); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.route(/gstatic|googleapis|firebaseapp/,r=>r.abort());
    await pg.goto(`http://localhost:${PORT}/index.html#${m}`); await pg.waitForTimeout(800);
    ok(!errs.length, `#${m} 화면 열기`+(errs.length?" — "+errs.join(" | "):""));
    if(m==="counter"){
      ok(await pg.evaluate(()=>!!document.getElementById("orderForm")&&!!document.getElementById("bkBtn")&&MENU.length>0),"카운터: 주문 칸·메뉴·백업 버튼 있음");
      // 저장소가 대답하지 않을 때(인터넷 끊김) 주문 넣기가 3초 안에 끝나는지
      const r=await pg.evaluate(async()=>{
        col={add:()=>new Promise(()=>{}),doc:()=>({update:()=>new Promise(()=>{})}),where:()=>({onSnapshot:()=>()=>{},get:async()=>({docs:[]})})};
        pickDept(GUEST); draft.items.push({name:MENU[0].items[0][0],unit:MENU[0].items[0][1]||1000,qty:1,opts:[],st:"sandwich",note:""}); draft.kindSet=true;
        const t=Date.now(); $("orderForm").requestSubmit();
        for(let i=0;i<40&&$("submitBtn").disabled!==false||i<2;i++)await new Promise(r=>setTimeout(r,100));
        return {ms:Date.now()-t,toast:$("toast").textContent,enabled:!$("submitBtn").disabled};
      });
      ok(r.enabled&&r.ms<4000&&/이 컴퓨터에 먼저 저장/.test(r.toast),"끊김: 주문 넣기가 멈추지 않음 ("+r.ms+"ms, '"+r.toast+"')");
      // 예약 주문 결제 (2026-11-09): 장부/카드/현금을 꼭 고르고, 장부면 고른 과로 저장돼 외상 잔액에 잡혀요
      const rv=await pg.evaluate(async()=>{
        const got=[]; col={add:async b=>{got.push(b);return {id:"t"};},doc:()=>({update:async()=>{}}),where:()=>({where:()=>({onSnapshot:()=>()=>{}}),onSnapshot:()=>()=>{},get:async()=>({docs:[]})})};
        const fill=()=>{$("resDate").value=daysAgo(-2); $("resTime").value="12:00"; draft.items.push({name:MENU[0].items[0][0],unit:5000,qty:3,opts:[],st:"sandwich",note:""}); draft.kindSet=true;};
        openRes(); fill(); await saveRes(); const noPay=$("formMsg").textContent;
        const opts=[...$("resPay").options].map(o=>o.value), hasAll=opts.includes("현금")&&opts.includes("카드")&&opts.includes("장부|동구청|총무과");
        $("resPay").value="장부|동구청|총무과"; $("resPay").dispatchEvent(new Event("change")); await saveRes(); const bk=got[0]||{};
        openRes(); fill(); setPay("현금"); $("resWho").value="OO웨딩홀"; await saveRes(); const cs=got[1]||{};
        return {noPay,hasAll,bk:[bk.org,bk.dept,bk.pay,ledCounts(bk)],cs:[cs.dept,cs.pay,ledCounts(cs)],n:got.length};
      });
      ok(/결제를 골라/.test(rv.noPay)&&rv.hasAll,"예약: 결제 칸에 현금·카드·장부(과)가 다 있고, 안 고르면 저장 안 됨");
      ok(rv.n===2&&rv.bk.join()==="동구청,총무과,장부,true"&&rv.cs.join()==="OO웨딩홀,현금,false","예약: 장부는 과 잔액에, 현금은 장부 밖 ("+JSON.stringify(rv)+")");
    }
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(fails.length?`\n실패 ${fails.length}건`:"\n모두 성공"); process.exit(fails.length?1:0);
})();
