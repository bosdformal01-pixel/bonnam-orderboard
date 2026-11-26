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
        const vs=payChoices().map(c=>c.v), hasAll=vs.includes("현금")&&vs.includes("카드")&&vs.includes("장부|동구청|총무과");
        // 초성 'ㅊㅁ' 를 치면 총무과가 나와요
        $("resPay").value="ㅊㅁ"; $("resPay").dispatchEvent(new Event("input"));
        const hit=[...$("resPayList").querySelectorAll("button")].find(b=>b.firstChild.textContent==="총무과"); if(hit)hit.click();
        await saveRes(); const bk=got[0]||{};
        openRes(); fill(); setPay("현금"); $("resWho").value="OO웨딩홀"; await saveRes(); const cs=got[1]||{};
        return {noPay,hasAll,bk:[bk.org,bk.dept,bk.pay,ledCounts(bk)],cs:[cs.dept,cs.pay,ledCounts(cs)],n:got.length};
      });
      ok(/결제를 골라/.test(rv.noPay)&&rv.hasAll,"예약: 결제 칸에 현금·카드·장부(과)가 다 있고, 안 고르면 저장 안 됨, 초성으로 찾기");
      ok(rv.n===2&&rv.bk.join()==="동구청,총무과,장부,true"&&rv.cs.join()==="OO웨딩홀,현금,false","예약: 장부는 과 잔액에, 현금은 장부 밖 ("+JSON.stringify(rv)+")");
      // 전화번호 칸 (2026-11-11): 4개면 뒷자리 그대로, 7개면 앞에 052, 8개면 앞에 010 붙여 전체 번호로
      const pf=await pg.evaluate(async()=>{
        const cases=[["1234","1234"],["12345678","010-1234-5678"],["1234-5678","010-1234-5678"],["01012345678","010-1234-5678"],["010-1234-5678","010-1234-5678"],["1234567","052-123-4567"],["234-5678","052-234-5678"],["0522345678","052-234-5678"],["052-123-4567","052-123-4567"],["",""]];
        const bad=cases.filter(([i,o])=>phoneFull(i)!==o).map(([i,o])=>i+"→"+phoneFull(i)+"(원래 "+o+")");
        if(typeof resMode!=="undefined"&&resMode)closeRes&&closeRes();
        const got=[]; col={add:async b=>{got.push(b);return {id:"p"};},doc:()=>({update:async()=>{}}),where:()=>({where:()=>({onSnapshot:()=>()=>{}}),onSnapshot:()=>()=>{},get:async()=>({docs:[]})})};
        const save=async v=>{resetForm(); pickDept(GUEST); draft.items.push({name:MENU[0].items[0][0],unit:5000,qty:1,opts:[],st:"sandwich",note:""}); setKind("배달"); draft.kindSet=true; $("phone4").value=v; $("orderForm").requestSubmit(); for(let i=0;i<30&&got.length<want;i++)await new Promise(r=>setTimeout(r,100));};
        let want=1; await save("98765432"); want=2; await save("4321");
        return {bad,a:got[0]&&[got[0].phone,got[0].phone4],b:got[1]&&[got[1].phone,got[1].phone4]};
      });
      ok(!pf.bad.length&&pf.a&&pf.a.join()==="010-9876-5432,5432"&&pf.b&&pf.b.join()===",4321","전화번호: 8자리면 010 붙여 저장, 4자리면 뒷자리만 ("+JSON.stringify(pf)+")");
      // 전표에 요청사항 안 찍기 (2026-11-13): 주문 메모·메뉴별 요청은 화면에만
      const sl=await pg.evaluate(()=>{
        const o={id:"s",day:today(),createdAt:Date.now(),no:7,org:"동구청",dept:"총무과",kind:"배달",due:"12:00",memo:"수저 10개 메모시험",items:[{name:MENU[0].items[0][0],qty:1,unit:5000,st:"sandwich",opts:[],note:"소스 따로 노트시험"}],total:5000,fee:0,done:{}};
        const t=escText(slipBytes(o)), h=slipNode(o).textContent;
        return {bytes:/메모시험|노트시험|요청/.test(t), html:/메모시험|노트시험|요청/.test(h), name:t.includes(MENU[0].items[0][0])};
      });
      ok(!sl.bytes&&!sl.html&&sl.name,"전표: 요청사항(주문 메모·메뉴별 요청)은 안 찍고 메뉴는 찍음 ("+JSON.stringify(sl)+")");
      // 외상 잔액 영수증 (2026-11-26): 이름·지금 잔액·최근 내역, 요청사항은 안 찍음. 학교(후불)는 이번 달 쌓인 금액
      const lr=await pg.evaluate(()=>{
        const now=Date.now(), H=3600e3, keep=led;
        led={acc:[{k:"개인|시험손님",org:"개인",name:"시험손님",floor:"",start:87200,startAt:now-9*24*H},{k:"학교|시험학교",org:"학교",name:"시험학교",floor:"",start:0,startAt:now-2*H}],
          pays:[{id:"p1",k:"개인|시험손님",amt:50000,at:now-2*24*H,memo:"계좌이체"}],cpDay:null};
        const mk=(id,k,org,dept,ago,total)=>({id,day:today(),createdAt:now-ago*H,org,dept,kind:"포장",items:[{name:"햄에그샌드위치",qty:2,unit:7000,opts:[],note:"노트시험"}],total,fee:0,done:{}});
        ledOrd.set("개인|시험손님",{from:"",list:[mk("o1","","개인","시험손님",5*24,14000)]});
        ledOrd.set("학교|시험학교",{from:"",list:[mk("o2","","학교","시험학교",1,14000)]});
        const t=k=>{const a=ledAcc(k); return escText(ledRcptBytes(ledRcpt(a,ledCalc(a))));};
        const p=t("개인|시험손님"), s=t("학교|시험학교"); led=keep;
        return {p:/시험손님/.test(p)&&/지금 잔액\s+\+123,200원/.test(p)&&/-14,000원\s+잔액 \+73,200원/.test(p)&&/입금 · 계좌이체/.test(p)&&!/노트시험|요청/.test(p),
          s:/쌓인 금액\s+\+14,000원/.test(s), cut:p.includes("[ 외상 잔액 ]")};
      });
      ok(lr.p&&lr.s&&lr.cut,"잔액 영수증: 이름·잔액·내역 찍고 요청사항 뺌, 학교는 쌓인 금액 ("+JSON.stringify(lr)+")");
      // 달콤 샌드 (2026-11-24, 이름은 2026-11-25): 안 고르면 '달콤 에그', 단호박·감자 고르면 '달콤 단호박'·'달콤 감자' (+500). 옵션 줄엔 안 찍음
      const dk=await pg.evaluate(()=>{
        resetForm(); const groups=MENU_IDX["달콤 샌드위치"].groups; openOpt({name:"달콤 샌드위치",base:7000,st:"sandwich",groups},null);
        const first=[...$("optGroups").querySelectorAll(".og")][0], on=[...first.querySelectorAll(".chip")].filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.firstChild.textContent);
        $("optAdd").click(); const egg=draft.items[draft.items.length-1];
        openOpt({name:"달콤 샌드위치",base:7000,st:"sandwich",groups},null);
        [...$("optGroups").querySelectorAll(".og")][0].querySelectorAll(".chip")[1].click(); $("optAdd").click(); const pk=draft.items[draft.items.length-1];
        const pkTxt=itemsText({items:[pk]}), pkIdx=draft.items.indexOf(pk);
        // 담은 '달콤 단호박'을 눌러 감자로 바꾸면 이름도 '달콤 감자'
        const it=draft.items[pkIdx]; openOpt({name:it.name,base:it.base,st:it.st,groups:it.groups},pkIdx);
        [...$("optGroups").querySelectorAll(".og")][0].querySelectorAll(".chip")[2].click(); $("optAdd").click();
        const ch=draft.items[pkIdx], rb=rebuildItem(ch);
        const slip=escText(slipBytes({id:"d",day:today(),createdAt:Date.now(),no:3,org:"동구청",dept:"총무과",kind:"포장",items:[egg,ch],total:14500,fee:0,done:{}}));
        return {g0:first.dataset.g,on,eggTxt:itemsText({items:[egg]}),eggUnit:egg.unit,pkTxt,pkUnit:pk.unit,chTxt:itemsText({items:[ch]}),chUnit:ch.unit,rbGroups:rb.groups.length,picked:$("picked")?$("picked").textContent.includes("달콤 감자"):null,slipEgg:slip.includes("달콤 에그"),slipGam:slip.includes("달콤 감자"),slipSand:/달콤 샌드위치|\(감자\)/.test(slip)};
      });
      ok(dk.g0==="dalkomType"&&dk.on.join()==="에그"&&dk.eggUnit===7000&&dk.eggTxt==="달콤 에그 1"&&dk.pkUnit===7500&&/^달콤 단호박 1/.test(dk.pkTxt)&&!/\(단호박\)/.test(dk.pkTxt)&&/^달콤 감자 1/.test(dk.chTxt)&&dk.chUnit===7500&&dk.rbGroups>0&&dk.slipEgg&&dk.slipGam&&!dk.slipSand,"달콤 샌드: 안 고르면 달콤 에그, 단호박·감자는 이름으로 +500, 고치면 이름도 바뀜 ("+JSON.stringify(dk)+")");
      // 단체⑤ (2026-11-26): 샌드위치 반개 + 샐러드 + 과일 + 음료, 10,000원부터, 샌드위치 종류엔 값 안 붙음, 두 곳 다
      const g5=await pg.evaluate(()=>{
        resetForm(); const n="단체⑤ 박스: 샌드위치 반개 + 샐러드 + 과일 + 음료", m=MENU_IDX[n]; if(!m)return {none:1};
        openOpt({name:n,base:m.base,st:m.st,groups:m.groups},null); $("optAdd").click(); const miss=$("optMsg").textContent;
        const ogs=[...$("optGroups").querySelectorAll(".og")]; const sand=ogs[0].querySelectorAll(".chip"), dr=ogs[1].querySelectorAll(".chip");
        sand[0].click(); dr[0].click(); $("optAdd").click(); const it=draft.items[draft.items.length-1];
        return {st:m.st,price:m.base,groups:m.groups,miss,unit:it&&it.unit,name:it&&it.name,txt:it&&itemsText({items:[it]})};
      });
      ok(g5.st==="both"&&g5.price===10000&&g5.groups.join()==="grpSand5,grpDrink"&&/샌드위치 반개/.test(g5.miss)&&g5.unit===11000&&/깻잎불고기/.test(g5.txt),"단체⑤: 10,000원부터, 샌드위치 값 안 붙고 음료만 더함, 두 곳 다 ("+JSON.stringify(g5)+")");
      // 만드는 중 배달지 찾기 (2026-11-24): 초성·글자로 찾고, 찾는 칸은 다시 그려도 그대로
      const mk=await pg.evaluate(()=>{
        const mkO=(id,org,dept,floor)=>({id,day:today(),createdAt:Date.now(),no:1,org,dept,floor,kind:"배달",items:[{name:MENU[0].items[0][0],qty:1,unit:5000,st:"sandwich",opts:[]}],total:5000,done:{}});
        orders=[mkO("a","동구청","총무과","3층"),mkO("b","동구청","안전총괄과","4층"),mkO("c","보건소","건강증진과","2층")]; kindF="";
        renderCounter(); const inp=document.querySelector("#orderList .mksearch"), head=inp&&inp.closest(".sec");
        const rows=()=>[...document.querySelectorAll("#orderList .orow .d")].map(x=>x.textContent);
        inp.focus(); inp.value="ㅊㅁ"; inp.dispatchEvent(new Event("input")); const r1=rows();
        renderCounter(); const keep=document.activeElement===inp&&inp.isConnected;
        inp.value="4층"; inp.dispatchEvent(new Event("input")); const r2=rows();
        inp.value="ㅋㅋㅋ"; inp.dispatchEvent(new Event("input")); const none=rows().length, note=!!document.querySelector("#orderList .mknote");
        inp.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})); const r3=rows();
        return {head:head&&head.textContent,r1,keep,r2,none,note,r3:r3.length};
      });
      ok(mk.head==="만드는 중 3건"&&mk.r1.length===1&&/총무과/.test(mk.r1[0])&&mk.keep&&mk.r2.length===1&&/안전총괄과/.test(mk.r2[0])&&mk.none===0&&!mk.note&&mk.r3===3,"만드는 중: 배달지 찾기 (초성·층, 다시 그려도 칸 유지) ("+JSON.stringify(mk)+")");
    }
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(fails.length?`\n실패 ${fails.length}건`:"\n모두 성공"); process.exit(fails.length?1:0);
})();
