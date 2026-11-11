// 샐러드가 샌드위치바로 / 샌드위치가 샐러드바로 가는 경우를 모든 조합으로 찾아요 (2026-11-10 선정님 요청)
//   node tests/bar-combos.js            (결과: 몇 건 중 몇 건 성공, 실패는 모양별로 묶어서)
// ① 주문판에서 직접 넣는 주문: 모든 메뉴 × 옵션 하나씩·여러 개 → 어느 바 표에 메뉴와 옵션이 뜨는지
// ② 배달앱 주문: 모든 메뉴 × 배달앱 이름 모양 (띄어쓰기, 괄호, 꼬리표, '애/에' 헷갈림) × 옵션 모양 → 어느 바에 뜨는지
// ③ 반반 세트 (1인세트·2인세트) 안의 배달앱 옵션: 주문판 모든 옵션 글자를 넣어 보고 샌드위치 것은 샌드위치바, 샐러드 것은 샐러드바에만
// ④ 주문판에 없는 메뉴: 이름에 '샌드위치·토스트·음료' 면 샌드위치바, '샐러드' 면 샐러드바, 세트나 낱말이 없으면 두 바 모두
// 프린터·저장소는 안 써요.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2]||path.join(__dirname,'..'), PORT=+(process.env.PORT||8791);
const srv=http.createServer((q,s)=>{let p=path.join(ROOT,q.url.split('?')[0].split('#')[0]);if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){s.statusCode=404;s.end();return;}s.end(d);});}).listen(PORT);

(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  await pg.route(/gstatic/,r=>r.abort());
  await pg.goto(`http://localhost:${PORT}/index.html#counter`); await pg.waitForTimeout(600);
  const out=await pg.evaluate(()=>{
    const fails={}; let n=0, ok=0;
    const bad=(key,ex)=>{(fails[key]=fails[key]||{n:0,ex}).n++;};
    const BARS=["salad","sandwich"];
    // 이 메뉴 줄이 어느 바 표에 뜨는지, 옵션 하나하나가 어느 바 표에 뜨는지 (바 표와 같은 계산)
    const where=i=>BARS.filter(st=>itemsFor({items:[i]},st).length);
    const optWhere=(i,v)=>BARS.filter(st=>itemsFor({items:[i]},st).length&&barOpts(i,st).some(o=>o.v===v));
    const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
    const want=st=>st==="both"?["salad","sandwich"]:[st];
    const check=(tag,cond,ex)=>{n++; if(cond)ok++; else bad(tag,ex);};

    // 옵션 글자의 바: 샌드위치 메뉴 옵션에만 있으면 샌드위치바, 샐러드 메뉴 옵션에만 있으면 샐러드바, 둘 다면 '애매'
    const optBar=new Map(); const addOB=(v,st)=>{const k=nsp(v); const s=optBar.get(k)||new Set(); s.add(st); optBar.set(k,s);};
    Object.values(MENU_IDX).forEach(mi=>mi.groups.forEach(g=>{const gg=G[g]; if(!gg||!gg.o)return;
      const st=gg.st||(gg.drink?"sandwich":mi.st); if(st==="both")return; gg.o.forEach(o=>addOB(o[0],st));}));
    MENU.forEach(c=>c.items.forEach(([nm,,,ist])=>{const st=ist||c.st; if(st!=="both")addOB(nm,st);}));

    // ① 주문판에서 직접 넣는 주문
    Object.entries(MENU_IDX).forEach(([menu,mi])=>{
      const all=[]; mi.groups.forEach(g=>(G[g]&&G[g].o?G[g].o:[]).forEach(o=>all.push({gid:g,v:o[0]})));
      const sets=[[]].concat(all.map(o=>[o])); if(all.length>=3)sets.push(all.slice(0,3));
      sets.forEach(opts=>{
        const it=scanItem({menu,qty:1,options:opts.map(o=>({group:o.gid,value:o.v}))}).item;
        check("① 주문판 메뉴 바: "+menu,same(where(it),want(mi.st)),{menu,opts:opts.map(o=>o.v),got:where(it)});
        if(mi.st==="both")shownOpts(it).forEach(o=>{
          const g=G[o.gid]||{}, ex=g.st?[g.st]:g.drink?["sandwich"]:null;
          check("① 반반 세트 옵션 바: "+menu+" / "+(g.l||o.gid),!!ex&&same(optWhere(it,o.v),ex),{menu,opt:o.v,group:g.l,got:optWhere(it,o.v)});
        });
      });
    });

    // ② 배달앱 이름 모양
    const VSWAP={1:5,5:1,3:7,7:3}; // ㅐ↔ㅔ, ㅒ↔ㅖ
    const swapV=s=>[...s].map(c=>{const k=c.charCodeAt(0)-0xAC00; if(k<0||k>11171)return c; const v=Math.floor(k/28)%21; return VSWAP[v]==null?c:String.fromCharCode(c.charCodeAt(0)+(VSWAP[v]-v)*28);}).join("");
    const spaced=s=>s.replace(/(샌드위치|샐러드|토스트|주스|세트)$/,m=>" "+m).replace(/\s+/g," ").trim();
    const shapes=m=>[m,m.replace(/\s/g,""),spaced(m),"[인기] "+m,"(신메뉴)"+m,m+" (1인분)","[new] "+spaced(m),swapV(m),swapV(spaced(m))];
    Object.entries(MENU_IDX).forEach(([menu,mi])=>{
      if(mi.half)return; // 반반 세트는 ③
      const all=[]; mi.groups.forEach(g=>(G[g]&&G[g].o?G[g].o:[]).forEach(o=>all.push([o[0],o[1]||0])));
      const optSets=[[]].concat(all.map(o=>[o]));
      [...new Set(shapes(menu))].forEach(name=>optSets.forEach(opts=>[o=>o,o=>"+"+o,o=>"옵션 선택: "+o].forEach(fmt=>{
        if(!opts.length&&fmt!==optSets[0])return;
        const it=appItem({name,qty:1,price:mi.base,opts:opts.map(([v,p])=>({v:fmt(v),p}))});
        check("② 배달앱 메뉴 바: "+(name===menu?"이름 그대로":"이름 모양 바뀜"),same(where(it),want(mi.st)),{menu,name,opts,got:where(it),name2:it.name});
      })));
    });

    // ③ 반반 세트 안의 배달앱 옵션 (배민 '1인세트 (샌드위치반+샐러드반+음료) (1인분)' 같은 이름)
    const SETNAMES={"1인세트":["1인세트 (샌드위치반+샐러드반+음료) (1인분)","1인세트"],"2인세트":["2인세트 (반반샌드위치 2개+샐러드 2개+음료 2개) (2인분)","2인세트"]};
    const vague=[];
    Object.entries(SETNAMES).forEach(([menu,names])=>names.forEach(name=>optBar.forEach((sts,k)=>{
      // 원래 글자 하나 찾기 (nsp 키 → 보기 좋은 글자)
      const v=[...Object.values(G)].flatMap(g=>g.o||[]).map(o=>o[0]).concat(Object.keys(MENU_IDX)).find(x=>nsp(x)===k)||k;
      if(sts.size>1){if(name===names[0]&&menu==="1인세트")vague.push(v); return;}
      const st=[...sts][0];
      if(/^기본\s/.test(v))return; // '기본 OO' 0원은 기본값이라 어느 바에도 안 찍어요
      [v,"+"+v,"선택: "+v].forEach(ov=>{
        const it=appItem({name,qty:1,price:11000,opts:[{v:ov,p:0}]});
        // 메뉴는 두 바 모두, 그 옵션 글자는 그 바에만
        const shown=BARS.filter(b=>itemsFor({items:[it]},b).length&&barOpts(it,b).some(o=>nsp(o.v).includes(nsp(v))||nsp(v).includes(nsp(o.v))));
        check("③ 세트 옵션 바: "+(st==="salad"?"샐러드 것":"샌드위치·음료 것"),same(where(it),["salad","sandwich"])&&same(shown,[st]),{menu:name,opt:ov,want:st,got:shown,opts:it.opts.map(o=>o.v+"@"+(o.st||"-"))});
      });
    })));

    // ④ 주문판에 없는 메뉴 이름
    const UNK=[["새우 바질 샌드위치","sandwich"],["시즌 한정 크림치즈 토스트","sandwich"],["블루베리 베이글","sandwich"],["햄치즈 크로와상","sandwich"],["망고 주스","sandwich"],["레몬 아이스티","sandwich"],["바나나 스무디","sandwich"],["카페 라떼 (L)","sandwich"],["제로콜라 500ml","sandwich"],
      ["리코타 단호박 샐러드","salad"],["(현미밥)닭갈비 샐러드","salad"],["연어 포케","both"],["그릭 요거트 볼","both"],
      ["샌드위치+샐러드 세트","both"],["점심 세트","both"],["알 수 없는 메뉴","both"]];
    UNK.forEach(([name,st])=>{const it=appItem({name,qty:1,price:7000,opts:[{v:"통밀식빵 샌드위치",p:0}]});
      check("④ 없는 메뉴 바: "+name,same(where(it),want(st)),{name,want:st,got:where(it),name2:it.name});});
    return {n,ok,fails,vague};
  });
  console.log(`${out.n}건 중 ${out.ok}건 성공 (${(out.ok/out.n*100).toFixed(2)}%)`);
  Object.entries(out.fails).sort((a,b)=>b[1].n-a[1].n).forEach(([k,v])=>console.log(`\n실패 ${v.n}건: ${k}\n  예: ${JSON.stringify(v.ex)}`));
  if(out.vague.length)console.log(`\n(참고) 샐러드·샌드위치 옵션에 둘 다 있는 글자 ${out.vague.length}개: 세트 안에서는 샐러드바로 가요 → ${out.vague.join(", ")}`);
  await b.close(); srv.close();
  process.exit(out.ok===out.n?0:1);
})();
