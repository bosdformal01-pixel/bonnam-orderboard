// 배민 전표 → 주문판 → 전표 출력 끝까지 시험 (가짜 COM 칸·가짜 저장소)
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.join(__dirname,'..'), OUT=process.argv[3]||'out';
fs.mkdirSync(OUT,{recursive:true});
const srv=http.createServer((q,s)=>{let p=path.join(ROOT,q.url.split('?')[0].split('#')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){s.statusCode=404;s.end();return;}s.end(d);});}).listen(8770);

// ---------- 시험 주문 만들기 ----------
let seed=+(process.env.SEED||20261025); const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
const pick=a=>a[Math.floor(rnd()*a.length)], ri=(a,b)=>a+Math.floor(rnd()*(b-a+1));
// [배민 이름, 주문판 이름, 값, 고를 수 있는 옵션 [이름, 값, 어디 (sandwich/salad/hide/drink)]]
const SAND=[
 ["바질 아보카도 샌드위치","바질아보카도샌드위치",8500,[["통밀식빵 샌드위치",0,"hide"],["기본 뚱샌드",0,"hide"],["양상추 많이",1000,"sandwich"],["아보카도 추가",2500,"sandwich"],["토마토 빼기",0,"sandwich"],["치즈 1장 추가",700,"sandwich"]]],
 ["깻잎불고기 샌드위치","깻잎불고기샌드위치",8500,[["우유식빵 샌드위치",0,"sandwich"],["기본 뚱샌드",0,"hide"],["깻잎 빼기",0,"sandwich"],["계란후라이 추가",700,"sandwich"]]],
 ["치폴레 새우&크래미 샌드위치","치폴레새우샌드위치",8500,[["통밀식빵 샌드위치",0,"hide"],["피클 빼기",0,"sandwich"],["치즈 2장 추가",1000,"sandwich"]]],
 ["햄에그 샌드위치","햄에그샌드위치",6500,[["통밀식빵 샌드위치",0,"hide"],["양상추 적게",0,"sandwich"]]],
 ["베이컨에그 샌드위치","베이컨에그샌드위치",7000,[["에그마요 추가",1500,"sandwich"]]]];
const SAL=[
 ["복남이 샐러드","복남이샐러드",8500,[["오리엔탈 드레싱",0,"hide"],["에그마요 추가",1500,"salad"],["견과류",0,"salad"]]],
 ["연어 샐러드","연어 샐러드",9500,[["유자 드레싱",0,"salad"],["아보카도 추가",2500,"salad"]]],
 ["아보카도 샐러드","아보카도 샐러드",9500,[["오리엔탈 드레싱",0,"hide"],["스위트콘",0,"salad"]]],
 ["(현미밥)오리훈제 샐러드","현미밥 오리훈제 샐러드",9500,[["발사믹 드레싱",0,"salad"],["계란 추가",700,"salad"]]]];
const SETSAND=[["햄치즈에그 샌드위치",0],["바질아보카도 샌드위치",1000],["깻잎불고기 샌드위치",1000],["게살 샌드위치",500]];
const SETDRINK=[["해독주스 250보틀",2000,"해독주스 250ml"],["토당주스 250보틀",2000,"토당주스 250ml"],["아이스 아메리카노",2000,"아이스 아메리카노"]];
const DRINK=[["토당주스(피로야가라)","토당주스 (보틀)",4000,[["500ml",3000,"drink"]]],["아메리카노","아메리카노",3000,[["ICE",0,"drink"]]],["수제레몬에이드","수제레몬에이드",4500,[]]];
const SET1="1인세트 (샌드위치반+샐러드반+음료) (1인분)", SET2="2인세트 (반반샌드위치 2개+샐러드 2개+음료 2개) (2인분)";
function makeOrder(n){
  const items=[];
  const add=(menu,board,price,qty,opts,kind)=>items.push({menu,board,price,qty,opts,kind});
  const optsFrom=list=>list.filter(()=>rnd()<0.6).map(([v,p,w])=>({v,p,w}));
  // 1인세트는 꼭 (1~3줄, 옵션 다르게)
  for(let k=0,K=ri(1,3);k<K;k++){
    const s=pick(SETSAND), d=pick(SETDRINK), o=[{v:s[0],p:s[1],w:"sandwich"},{v:"+견과류",p:0,w:"salad"}];
    if(rnd()<0.5)o.push({v:"스위트콘",p:0,w:"salad"});
    o.push({v:d[0],p:d[1],w:"drink",as:d[2]});
    o.push(rnd()<0.6?{v:"오리엔탈 드레싱",p:0,w:"hide"}:{v:"유자 드레싱",p:0,w:"salad"});
    add(SET1,"1인세트",11000,ri(1,4),o,"set");
  }
  if(rnd()<0.5||n%3===2)add(SET2,"2인세트",14500,ri(1,2),[{v:"바질아보카도 샌드위치",p:2000,w:"sandwich"}],"set");
  let food=()=>items.reduce((s,i)=>s+(i.price+i.opts.reduce((t,o)=>t+o.p,0))*i.qty,0);
  while(food()<130000||items.length<5){
    const r=rnd(), [m,b,p,ol]=r<0.4?pick(SAND):r<0.75?pick(SAL):pick(DRINK);
    if(items.some(i=>i.menu===m))continue;
    add(m,b,p,ri(1,5),optsFrom(ol),r<0.4?"sandwich":r<0.75?"salad":"drink");
  }
  // 섞기 (이름 나뉨 시험은 긴 2인세트를 맨 앞에)
  for(let k=items.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[items[k],items[j]]=[items[j],items[k]];}
  if(n%3===2){const k=items.findIndex(i=>i.menu===SET2); if(k>0)items.unshift(items.splice(k,1)[0]);}
  const fee=pick([0,3000,4200]);
  return {no:"T"+String(n).padStart(2,"0")+"TEST"+ri(100,999),items,fee,food:food()};
}
// ---------- 배민 전표 글자 (42칸) ----------
const cw=s=>[...s].reduce((n,c)=>n+(c.charCodeAt(0)>0x7f?2:1),0);
const W=42, num=v=>v.toLocaleString("ko-KR");
const padL=(s,w)=>" ".repeat(Math.max(0,w-cw(s)))+s;
function line(left,qty,amt){ // 이름 + 수량 + 금액, 안 들어가면 수량·금액을 다음 줄로 (배민처럼)
  const right=(qty!=null?padL(String(qty),4):"    ")+padL(amt,8);
  if(cw(left)+cw(right)+1>W)return [left,padL(right,W)];
  return [left+" ".repeat(W-cw(left)-cw(right))+right];
}
function splitName(s,w){let a="",n=0;for(const c of s){if(n+cw(c)>w)break;a+=c;n+=cw(c);}return [a,s.slice(a.length)];}
function slipText(o,variant){
  const L=[];
  L.push("배달 주문전표","주문번호 : "+o.no,"------------------------------------------","배달주소 : 시험시 시험구 시험로 1","안심번호 : 050-1234-5678","안심번호는 주문접수 후 최대 3시간 동안 유","효합니다.","------------------------------------------","요청사항:","가게 : 요청사항 없음","배달 : 문 앞에 놔주세요.","------------------------------------------");
  L.push("메뉴"+padL("수량    금액",W-cw("메뉴")),"------------------------------------------");
  o.items.forEach((it,ix)=>{
    let nm=it.menu;
    // 일부러 길게: 이름이 한 줄을 넘으면 배민이 이름을 두 줄로 나누는 경우도 시험
    // 42칸을 넘는 이름은 42칸에서 낱말 중간이라도 끊고, 아니면 낱말 사이에서 끊어요
    if(variant==="split"&&ix===0){let a,b; if(cw(nm)>W){[a,b]=splitName(nm,W);} else {const k=nm.lastIndexOf(" ",Math.floor(nm.length*0.6)); a=nm.slice(0,k); b=nm.slice(k+1);} L.push(a); L.push(...line(b,it.qty,num(it.price*it.qty)));}
    else L.push(...line(nm,it.qty,num(it.price*it.qty)));
    it.opts.forEach((op,k)=>{
      const amt=num(op.p*it.qty);
      // 금액이 다음 줄로 내려가는 옵션 (오늘 500ml 처럼)
      if((variant==="optwrap"&&k%2===0)||op.v==="500ml"){L.push(" └ "+op.v); L.push(padL(amt,W));}
      else L.push(...line(" └ "+op.v,null,amt));
    });
  });
  const cnt=o.items.reduce((s,i)=>s+i.qty,0);
  L.push("------------------------------------------", ...line("주문금액",cnt,num(o.food)));
  L.push("------------------------------------------", ...line("배달팁",null,num(o.fee)), ...line("└ 기본 배달팁",null,num(o.fee)));
  L.push("------------------------------------------", ...line("총 결제금액",null,num(o.food+o.fee)),"------------------------------------------","");
  return L.join("\n");
}
// ---------- 돌리기 ----------
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1100,height:900}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/gstatic/,r=>r.abort());
  await pg.goto('http://localhost:8770/index.html#counter'); await pg.waitForTimeout(600);
  await pg.evaluate(()=>{
    window.__com4=[]; window.__added=[];
    const port={writable:null,readable:null,
      open:async function(){this.writable=new WritableStream({write(c){window.__com4.push(Array.from(c));}});},
      close:async function(){this.writable=null;}};
    relay.on=true; relay.tx=port; serPort=port; relay.last=0;
    let n=0; col={add:async body=>{const id="test"+(++n); orders.push(Object.assign({id},body)); window.__added.push(id); return {id};},
      where:()=>({get:async()=>({docs:[]})})};
  });
  const report=[]; const N=+(process.argv[4]||10);
  for(let t=1;t<=N;t++){
    const o=makeOrder(t), variant=["plain","optwrap","split"][t%3];
    const text=slipText(o,variant);
    fs.writeFileSync(path.join(OUT,`주문${t}_배민전표.txt`),text);
    const res=await pg.evaluate(async([text,o])=>{
      const map=ksMap(), bytes=[0x1b,0x40];
      for(const ch of text){ if(ch==="\n"){bytes.push(0x0a,0x0d);continue;} const k=ch.charCodeAt(0); if(k<0x80)bytes.push(k); else{const m=map.get(ch); if(!m)throw new Error("인코딩 안 됨: "+ch); bytes.push(...m);} }
      bytes.push(0x1b,0x64,3,0x1d,0x56,0x42,0x00);
      window.__com4=[]; const before=window.__added.length;
      // 시리얼처럼 64바이트씩 잘라서 들여보내기
      for(let i=0;i<bytes.length;i+=64){relayGot(new Uint8Array(bytes.slice(i,i+64))); await new Promise(r=>setTimeout(r,15));}
      for(let k=0;k<80&&window.__added.length===before;k++)await new Promise(r=>setTimeout(r,100));
      await new Promise(r=>setTimeout(r,300));
      const pass=[].concat(...window.__com4);
      const passOK=pass.length===bytes.length&&pass.every((x,i)=>x===bytes[i]);
      const id=window.__added[window.__added.length-1]; const ord=orders.find(x=>x.id===id);
      if(!ord||window.__added.length===before)return {fail:["주문판에 안 들어옴"]};
      // 주문판 전표 뽑기
      window.__com4=[]; await printSlip(ord); await new Promise(r=>setTimeout(r,300));
      const sb=new Uint8Array([].concat(...window.__com4)), slip=escText(sb);
      const tix={}; ["salad","sandwich"].forEach(st=>{tix[st]=needs(ord)[st]?ticket(ord,st).innerText:"";});
      return {ord:JSON.parse(JSON.stringify(ord)),passOK,passLen:pass.length,slip,slipCut:sb.length>3&&sb[sb.length-3]===0x56,tix,
        parsed:parseSlip(escText(new Uint8Array(bytes)))};
    },[text,o]);
    const fail=[...(res.fail||[])];
    if(!res.fail){
      const ord=res.ord, P=res.parsed;
      if(!res.passOK)fail.push("COM4로 넘긴 배민 전표가 원본과 다름");
      if(ord.check)fail.push("확인 경고: "+ord.check);
      if(P.items.length!==o.items.length)fail.push(`메뉴 줄 수 ${P.items.length}/${o.items.length}`);
      o.items.forEach((it,i)=>{
        const p=P.items[i]||{opts:[]}, oi=ord.items[i]||{opts:[]};
        if((p.name||"").replace(/\s/g,"")!==it.menu.replace(/\s/g,""))fail.push(`${i+1}번째 이름 '${p.name}' ≠ '${it.menu}'`);
        if(p.qty!==it.qty)fail.push(`${it.menu} 수량 ${p.qty}≠${it.qty}`);
        if(p.price!==it.price*it.qty)fail.push(`${it.menu} 금액 ${p.price}≠${it.price*it.qty}`);
        if(p.opts.length!==it.opts.length||p.opts.some((x,k)=>x.v!==it.opts[k].v||x.p!==it.opts[k].p*it.qty))fail.push(`${it.menu} 옵션 다름: `+JSON.stringify(p.opts));
        if(oi.name!==it.board)fail.push(`'${it.menu}' → 주문판 '${oi.name}' (기대 '${it.board}')`);
        const unit=it.price+it.opts.reduce((s,x)=>s+x.p,0); if(oi.unit!==unit)fail.push(`${it.board} 단가 ${oi.unit}≠${unit}`);
        if(oi.qty!==it.qty)fail.push(`${it.board} 주문판 수량 ${oi.qty}`);
        // 어느 바에 뜨나
        const bars=it.kind==="set"?["salad","sandwich"]:it.kind==="salad"?["salad"]:["sandwich"];
        bars.forEach(st=>{if(!res.tix[st].includes(it.board))fail.push(`${it.board} 가 ${st==="salad"?"샐러드바":"샌드위치바"}에 없음`);});
        ["salad","sandwich"].filter(st=>!bars.includes(st)).forEach(st=>{
          const lines=res.tix[st].split("\n").filter(l=>l.trim()===it.board||l.includes(it.board)&&!l.includes("("));
          if(lines.some(l=>l.trim()===it.board))fail.push(`${it.board} 가 ${st==="salad"?"샐러드바":"샌드위치바"}에도 뜸`);
        });
        it.opts.forEach(op=>{
          const want=op.as||op.v.replace(/^\+/,"+"), sal=res.tix.salad, san=res.tix.sandwich;
          if(op.w==="hide"){if(it.kind!=="drink"&&(sal+san).split("\n").some(l=>l.includes(op.v)&&!/요청/.test(l)&&l.trim()===op.v))fail.push(`기본 옵션 '${op.v}' 가 찍힘`);}
          else if(op.w==="drink"){if(!san.includes(want.replace(/^ICE$/,"ICE")))fail.push(`음료 '${want}' 가 샌드위치바에 없음`); if(it.kind==="set"&&!sal.includes(want))fail.push(`세트 음료 '${want}' 가 샐러드바 '같이 나갈 음료'에 없음`);}
          else{const t=op.w==="salad"?sal:san; const short=op.v.replace(/ 샌드위치$/,"").replace(/^\+/,""); if(!t.includes(short))fail.push(`옵션 '${op.v}' 가 ${op.w==="salad"?"샐러드바":"샌드위치바"}에 없음`);}
        });
      });
      const total=ord.items.reduce((s,i)=>s+i.unit*i.qty,0)+(ord.fee||0);
      if(total!==o.food+o.fee)fail.push(`합계 ${total}≠${o.food+o.fee}`);
      if(ord.total!==o.food+o.fee)fail.push(`주문 합계칸 ${ord.total}≠${o.food+o.fee}`);
      if(!res.slip.includes(num(o.food+o.fee)))fail.push("주문판 전표에 합계 없음");
      o.items.forEach(it=>{if(!res.slip.includes(it.board))fail.push(`주문판 전표에 '${it.board}' 없음`);});
      if(!res.slipCut)fail.push("주문판 전표 자르기 명령 없음");
      fs.writeFileSync(path.join(OUT,`주문${t}_주문판전표.txt`),res.slip);
      fs.writeFileSync(path.join(OUT,`주문${t}_샐러드바.txt`),res.tix.salad);
      fs.writeFileSync(path.join(OUT,`주문${t}_샌드위치바.txt`),res.tix.sandwich);
    }
    report.push({t,variant,no:o.no,lines:o.items.length,qty:o.items.reduce((s,i)=>s+i.qty,0),sets:o.items.filter(i=>i.menu===SET1).reduce((s,i)=>s+i.qty,0),total:o.food+o.fee,ok:!fail.length,fail});
    console.log(`주문 ${t} (${variant}) ${o.no} 메뉴 ${o.items.length}줄 ${num(o.food+o.fee)}원 → ${fail.length?"실패\n  - "+fail.join("\n  - "):"성공"}`);
  }
  fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,1));
  console.log(`\n${report.filter(r=>r.ok).length}/${report.length} 성공`+(errs.length?"\n페이지 오류: "+errs.join(" | "):""));
  await b.close(); srv.close();
})();
