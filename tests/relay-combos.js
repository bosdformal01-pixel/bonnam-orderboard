// 쿠팡이츠·요기요 전표: 주문판 모든 메뉴 × 모든 옵션 × 줄바꿈 모양 × 앞뒤 메뉴를 전부 조합해서 읽어 봐요 (2026-10-27)
//   node tests/relay-combos.js            (결과: 몇 건 중 몇 건 성공, 실패는 모양별로 묶어서)
// 전표 글자 읽기(parseSlip)와 주문판 메뉴·옵션 연결(appMenuName, appOpt)만 봐요. 프린터·저장소는 안 써요.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.join(__dirname,'..'), PORT=+(process.env.PORT||8790);
const srv=http.createServer((q,s)=>{let p=path.join(ROOT,q.url.split('?')[0].split('#')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){s.statusCode=404;s.end();return;}s.end(d);});}).listen(PORT);

(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  await pg.route(/gstatic/,r=>r.abort());
  await pg.goto(`http://localhost:${PORT}/index.html#counter`); await pg.waitForTimeout(600);
  const out=await pg.evaluate(()=>{
    const W={"쿠팡이츠":40,"요기요":42}, num=v=>v.toLocaleString("ko-KR"), padL=(s,w)=>" ".repeat(Math.max(0,w-cw(s)))+s;
    // 쿠팡이츠: 이름 수량 금액 (넘치면 oneline / qtynext / namenext), 옵션 " + 이름 수량 금액"
    const cpL=(l,q,a)=>{const r=padL(String(q),4)+padL(a,9); return l+" ".repeat(Math.max(1,40-cw(l)-cw(r)))+r;};
    function cpItem(L,name,q,a,opts,v){
      const k=name.lastIndexOf(" ");
      if(cw(name)+14<=40||v==="oneline"||k<1)L.push(cpL(name,q,a));
      else if(v==="qtynext"){L.push(name.slice(0,k)); L.push(cpL(name.slice(k+1),q,a));}
      else {L.push(cpL(name.slice(0,k),q,a)); L.push(name.slice(k+1));}
      opts.forEach(([ov,op])=>L.push(cpL(" + "+ov,q,num(op*q))));
    }
    // 요기요: 메뉴명 칸 28칸에서 낱말 중간이라도 끊고 나머지는 다음 줄, 옵션 "- 이름 수량 [금액]"
    const yoL=(l,q,a)=>{let a1="",n=0;for(const c of l){if(n+cw(c)>28)break;a1+=c;n+=cw(c);} const rest=l.slice(a1.length);
      const t=a1+" ".repeat(30-cw(a1))+String(q)+(a?padL(a,11):""); return rest?[t,rest]:[t];};
    function yoItem(L,name,q,a,opts){L.push(...yoL(name,q,a)); opts.forEach(([ov,op])=>L.push(...yoL("- "+ov,q,op?num(op*q):"")));}
    function slip(app,v,items,fee){
      const L=[], food=items.reduce((s,it)=>s+it.price*it.q+it.opts.reduce((t,o)=>t+o[1]*it.q,0),0);
      if(app==="쿠팡이츠"){
        L.push("coupang eats    [고객용]","----------------------------------------","      ABCD12","","----------------------------------------","메뉴                       수량     금액","----------------------------------------");
        items.forEach(it=>cpItem(L,it.name,it.q,num(it.price*it.q),it.opts,v));
        L.push("----------------------------------------","주문금액"+padL(num(food),40-cw("주문금액")),"----------------------------------------","요청사항: 수저포크X","");
      } else {
        L.push("[고객용]","요기요 요기배달 [실속]","------------------------------------------","주문번호: #1234","------------------------------------------","메뉴명                      수량      가격","------------------------------------------");
        items.forEach(it=>yoItem(L,it.name,it.q,num(it.price*it.q),it.opts));
        L.push("배달료:"+padL(num(fee),42-cw("배달료:")),"[요기패스X 적용 주문]","------------------------------------------","합계:"+padL(num(food+fee),42-cw("합계:")),"------------------------------------------","");
      }
      // 프린터로 들어오는 바이트처럼 (요기요는 글자 사이 0x00)
      const map=ksMap(), by=[0x1b,0x40], nul=app==="요기요";
      for(const ch of L.join("\n")){ if(ch==="\n"){by.push(0x0d,0x0a);continue;} const k=ch.charCodeAt(0); if(k<0x80)by.push(k); else by.push(...map.get(ch)); if(nul)by.push(0);}
      return {text:escText(new Uint8Array(by)),food};
    }
    const ns=s=>String(s).replace(/\s/g,"");
    const PREV={name:"깻잎불고기 샌드위치",board:"깻잎불고기샌드위치",price:8500,q:2,opts:[["기본 뚱 샌드",0]]};
    const NEXT={none:null,
      short:{name:"아메리카노",board:"아메리카노",price:3000,q:1,opts:[]},
      long:{name:"[new] 치폴레 새우&크래미 샌드위치",board:"치폴레새우샌드위치",price:9000,q:1,opts:[]},
      opt:{name:"치킨스파이시 샌드위치",board:"치킨스파이시샌드위치",price:7500,q:1,opts:[["통밀식빵 샌드위치",0]]}};
    const LAYOUT=[["쿠팡이츠","oneline"],["쿠팡이츠","qtynext"],["쿠팡이츠","namenext"],["요기요","cut28"]];
    const fails={}, mapMiss={}; let n=0, ok=0;
    const bad=(key,ex)=>{(fails[key]=fails[key]||{n:0,ex}).n++;};
    Object.entries(MENU_IDX).forEach(([menu,mi])=>{
      // 이 메뉴의 옵션: 없음 + 각 옵션 하나씩 + 맨 앞 두 개 같이
      const all=[]; (mi.groups||[]).forEach(g=>(G[g]?G[g].o:[]).forEach(o=>all.push([o[0],o[1]||0])));
      const optSets=[[]].concat(all.map(o=>[o])); if(all.length>=2)optSets.push(all.slice(0,2));
      // 앱 이름 모양: 그대로 / [new] 꼬리표 / 띄어쓰기 넣은 긴 이름 ("(1인분)" 붙임)
      const names=[menu,"[new] "+menu,menu+" (1인분)"];
      optSets.forEach(opts=>names.forEach(name=>[1,3].forEach(q=>LAYOUT.forEach(([app,v])=>Object.entries(NEXT).forEach(([nk,nx])=>{
        const it={name,board:menu,price:mi.base,q,opts}, items=[PREV,it].concat(nx?[nx]:[]);
        const {text,food}=slip(app,v,items,3000), p=parseSlip(text); n++;
        const tag=`${app}/${v}/다음:${nk}`, f=[];
        if(p.src!==app)f.push("앱");
        if(p.check)f.push("경고");
        if(p.items.length!==items.length)f.push("메뉴 줄 수");
        items.forEach((x,k)=>{const y=p.items[k]; if(!y){return;}
          if(appMenuName(y.name)!==x.board)f.push(k===1?"메뉴 이름":"앞뒤 메뉴 이름");
          if(y.qty!==x.q||y.price!==x.price*x.q)f.push("수량·금액");
          if(y.opts.length!==x.opts.length||y.opts.some((o,j)=>ns(o.v)!==ns(x.opts[j][0])||o.p!==x.opts[j][1]*x.q))f.push("옵션");});
        if(f.length){bad(tag+" → "+[...new Set(f)].join("+"),{menu,name,opts,q,text,got:p.items});}
        else ok++;
        // 옵션이 주문판 옵션으로 연결되는지 (안 되면 '요청'으로 들어가요)
        if(!f.length&&opts.length===1&&v!=="qtynext"&&nk==="none"&&q===1){const y=p.items[1]; const m=appOpt(menu,y.opts[0].v); if(ns(m)!==ns(opts[0][0]))mapMiss[menu+" / "+opts[0][0]]=m;}
      })))));
    });
    return {n,ok,fails,mapMiss};
  });
  console.log(`${out.n}건 중 ${out.ok}건 성공 (${(out.ok/out.n*100).toFixed(2)}%)`);
  Object.entries(out.fails).sort((a,b)=>b[1].n-a[1].n).forEach(([k,v])=>{console.log(`\n실패 ${v.n}건: ${k}\n  예: ${v.ex.menu} '${v.ex.name}' ×${v.ex.q} 옵션 ${JSON.stringify(v.ex.opts)}\n  읽은 것: ${JSON.stringify(v.ex.got.map(i=>[i.name,i.qty,i.price,i.opts.map(o=>o.v+":"+o.p)]))}\n`+v.ex.text.split("\n").map(l=>"  | "+l).join("\n"));});
  const mm=Object.entries(out.mapMiss); if(mm.length){console.log(`\n주문판 옵션으로 연결 안 되는 옵션 ${mm.length}개:`); mm.forEach(([k,v])=>console.log("  "+k+" → "+v));}
  if(process.env.OUT)fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));
  await b.close(); srv.close();
  process.exit(out.ok===out.n?0:1);
})();
