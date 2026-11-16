import {Chess} from 'chess.js';
import {reviewGame,CLS,wpm,fmt} from './core.js';
const $=s=>document.querySelector(s);
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}};
const SAMPLE='[Event "Opera Game"]\n[Site "Paris FRA"]\n[Date "1858.??.??"]\n[White "Paul Morphy"]\n[Black "Duke of Brunswick & Count Isouard"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';
let G=null,R=null,ply=0,flip=false,busy=false,abort=false,depth=+(ls('rw-d')||12),lib=[];
try{lib=JSON.parse(ls('rw-lib')||'[]');}catch(e){}
const TXT={brilliant:'a brilliant move',great:'a great move',best:'the best move',excellent:'an excellent move',good:'a good move',book:'a book move',inaccuracy:'an inaccuracy',mistake:'a mistake',miss:'a miss',blunder:'a blunder'};
function parse(pgn){const c=new Chess();c.loadPgn(pgn);const mv=c.history({verbose:true});if(!mv.length)throw new Error('No moves found in that PGN');const h=c.header();
 return{id:Date.now(),pgn,moves:mv,fens:[mv[0].before,...mv.map(m=>m.after)],h,title:(h.White||'White')+' vs '+(h.Black||'Black'),an:null};}
function grid(fen){return fen.split(' ')[0].split('/').map(row=>{const r=[];for(const ch of row){if(/\d/.test(ch))for(let k=0;k<+ch;k++)r.push('');else r.push((ch===ch.toLowerCase()?'b':'w')+ch.toUpperCase());}return r;});}
const san=(fen,u)=>{try{return new Chess(fen).move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san;}catch(e){return u;}};
const pvSan=(fen,pv)=>{const g=new Chess(fen),o=[];for(const u of pv.slice(0,5)){try{o.push(g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san);}catch(e){break;}}return o.join(' ');};
function xy(u){const f=u.charCodeAt(0)-97,r=+u[1];return[(flip?7-f:f)+.5,(flip?r-1:8-r)+.5];}
function drawBoard(){
 const g=grid(G.fens[ply]),m=ply?G.moves[ply-1]:null,r0=R&&ply?R.mv[ply-1]:null;let h='';
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const rr=flip?7-r:r,cc=flip?7-c:c,sq='abcdefgh'[cc]+(8-rr),p=g[rr][cc],hl=m&&(sq===m.from||sq===m.to);
  h+=`<div class="sq ${(rr+cc)%2?'d':'l'}${hl?' h':''}" style="left:${c*12.5}%;top:${r*12.5}%">`+(c===0?`<i class="rk">${8-rr}</i>`:'')+(r===7?`<i class="fl">${'abcdefgh'[cc]}</i>`:'')+(p?`<b class="p ${p}"></b>`:'')+(r0&&sq===m.to?`<u class="bd" style="background:${CLS[r0.cls][1]}">${CLS[r0.cls][0]}</u>`:'')+'</div>';}
 if(r0&&['inaccuracy','mistake','miss','blunder'].includes(r0.cls)&&r0.best){
  const[x1,y1]=xy(r0.best.slice(0,2)),[x2,y2]=xy(r0.best.slice(2,4)),d=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/d,uy=(y2-y1)/d,bx=x2-ux*.38,by=y2-uy*.38;
  h+=`<svg class="ar" viewBox="0 0 8 8"><g fill="#81b64c" stroke="#81b64c" opacity=".85"><line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke-width=".17" stroke-linecap="round"/><polygon stroke="none" points="${x2},${y2} ${bx-uy*.24},${by+ux*.24} ${bx+uy*.24},${by-ux*.24}"/></g></svg>`;}
 $('#board').innerHTML=h;
}
function evalBar(){
 const l=R?G.an.pos[ply].lines[0]:null,w=l?wpm(l.cp):50,lw=w>=50,lead=lw!==flip,e=$('#ebw');
 e.style.height=w+'%';e.style.top=flip?'0':'auto';e.style.bottom=flip?'auto':'0';
 const b=$('#ebl');b.textContent=l?fmt(l).replace('+','').replace('−','-'):'';b.style.color=lw?'#222':'#eee';b.style.top=lead?'auto':'0';b.style.bottom=lead?'0':'auto';
}
function players(){
 const h=G.h,fm=c=>`<span>${c==='w'?'⬜':'⬛'} ${h[c==='w'?'White':'Black']||(c==='w'?'White':'Black')} <small>${h[c==='w'?'WhiteElo':'BlackElo']&&h[c==='w'?'WhiteElo':'BlackElo']!=='?'?'('+h[c==='w'?'WhiteElo':'BlackElo']+')':''}</small></span>${R?`<i>${R.acc[c].toFixed(1)}%</i>`:''}`;
 $('#pTop').innerHTML=fm(flip?'w':'b');$('#pBot').innerHTML=fm(flip?'b':'w');
}
function coach(){
 let ic='♞',col='#3d3a37',t='',s='';
 if(!ply){t=R&&R.opening?R.opening:G.title;s=(G.h.Date&&!G.h.Date.includes('?')?G.h.Date+' · ':'')+(G.h.Result||'')+' · '+G.moves.length+' moves';}
 else{const m=G.moves[ply-1];
  if(!R){t=m.san;s='Run “Review game” for engine analysis.';}
  else{const r=R.mv[ply-1],c=CLS[r.cls],pos=G.an.pos;ic=c[0];col=c[1];t=`<b>${m.san}</b> is ${TXT[r.cls]}`;
   const bad=['inaccuracy','mistake','miss','blunder'].includes(r.cls);
   s=(bad?`Best was <b>${san(G.fens[ply-1],r.best)}</b>. `:'')+`Eval ${fmt(pos[ply].lines[0])} · ${pvSan(G.fens[ply],pos[ply].lines[0].pv)}`;
   if(r.cls==='book')s=R.opening;}}
 $('#coach').innerHTML=`<div class="ic" style="background:${col}">${ic}</div><div><p>${t}</p><small>${s}</small></div>`;
}
function revCard(){
 const e=$('#rev');
 if(busy){e.innerHTML=`<p id="pg" style="margin:0">Analyzing…</p><div class="bar"><i id="pb"></i></div><button data-a="cancel">Cancel</button>`;return;}
 if(!R){e.innerHTML=`<button class="pri" data-a="review" style="width:100%;padding:13px">Review game</button><div class="row" style="align-items:center">Depth <select id="dp">${[[10,'Fast'],[12,'Standard'],[14,'Deep'],[16,'Very deep']].map(([d,n])=>`<option value="${d}"${d===depth?' selected':''}>${d} · ${n}</option>`).join('')}</select></div><small style="color:var(--mut)">Stockfish 19 runs on your phone. No internet needed.</small>`;return;}
 const k=Object.keys(CLS),f=c=>(R.cnt[c]);
 e.innerHTML=`<b>Game review</b><div class="acc"><div style="background:#e8e8e8;color:#222">White<b>${R.acc.w.toFixed(1)}</b>accuracy</div><div style="background:#403d39">Black<b>${R.acc.b.toFixed(1)}</b>accuracy</div></div><table>`+k.map(x=>`<tr><td>${f('w')[x]||0}</td><td><span class="dot" style="background:${CLS[x][1]}">${CLS[x][0]}</span>${CLS[x][2]}</td><td>${f('b')[x]||0}</td></tr>`).join('')+`</table>`;
}
function graph(){
 const g=$('#graph');if(!R){g.innerHTML='';return;}
 const P=G.an.pos,n=P.length-1,pts=P.map((p,i)=>(i/n*100).toFixed(1)+','+(40-wpm(p.lines[0].cp)*.4).toFixed(1));
 g.innerHTML=`<path d="M0,40 L${pts.join(' L')} L100,40Z" fill="#e8e8e8"/><line x1="${ply/n*100}" x2="${ply/n*100}" y1="0" y2="40" stroke="#81b64c" stroke-width=".9"/>`;
}
function moveList(){
 let h='';G.moves.forEach((m,i)=>{if(i%2===0)h+=`<span class="n">${i/2+1}.</span>`;const r=R&&R.mv[i];
  h+=`<a data-a="go" data-p="${i+1}" class="${ply===i+1?'on':''}">${r?`<em style="color:${CLS[r.cls][1]}">${CLS[r.cls][0]}</em>`:''}${m.san}</a>`;});
 const e=$('#moves');e.innerHTML=h;const a=e.querySelector('.on');if(a)e.scrollTop=a.offsetTop-90;
}
function render(){drawBoard();evalBar();players();coach();revCard();graph();moveList();}
function openGame(g){G=g;R=g.an?reviewGame(g.moves,g.an.pos):null;ply=0;flip=false;$('#modal').style.display='none';render();}
function persist(){const i=lib.findIndex(x=>x.id===G.id);const e={id:G.id,pgn:G.pgn,an:G.an,title:G.title,date:new Date().toISOString().slice(0,10)};if(i>=0)lib[i]=e;else lib.unshift(e);lib=lib.slice(0,25);ls('rw-lib',JSON.stringify(lib));}
function libList(){$('#lib').innerHTML=lib.length?'<p style="color:var(--mut);margin:14px 0 2px">Saved games</p>'+lib.map(x=>`<div class="g" data-a="open" data-id="${x.id}"><span>${x.title}<br><small>${x.date}${x.an?' · reviewed':''}</small></span><button data-a="del" data-id="${x.id}">✕</button></div>`).join(''):'';}
function tryLoad(txt){try{const g=parse(txt);const old=lib.find(x=>x.pgn===txt);if(old&&old.an){g.id=old.id;g.an=old.an;}$('#err').textContent='';openGame(g);}catch(e){$('#err').textContent='Could not read that PGN: '+(e.message||e).toString().slice(0,120);}}
class Engine{
 constructor(){this.w=new Worker('engine/stockfish.js');this.q=[];this.w.onmessage=e=>{const l=String(e.data);this.q=this.q.filter(f=>!f(l));if(this.cb)this.cb(l);};}
 send(c){this.w.postMessage(c);}
 wait(re){return new Promise(r=>this.q.push(l=>re.test(l)&&(r(),true)));}
 async init(){const a=this.wait(/^uciok/);this.send('uci');await a;this.send('setoption name MultiPV value 2');const b=this.wait(/^readyok/);this.send('isready');await b;}
 go(fen,d){return new Promise(res=>{const L={};this.cb=l=>{
  if(l.startsWith('info')&&l.includes(' pv ')){const k=+((l.match(/multipv (\d+)/)||[])[1]||1),s=l.match(/score (cp|mate) (-?\d+)/);if(!s)return;L[k]={t:s[1],v:+s[2],pv:l.split(' pv ')[1].trim().split(/\s+/)};}
  else if(l.startsWith('bestmove')){this.cb=null;res(L);}};
  this.send('position fen '+fen);this.send('go depth '+d);});}
 kill(){this.w.terminate();}
}
async function evalFen(eng,fen,d){
 const c=new Chess(fen);
 if(c.isCheckmate())return{lines:[{cp:c.turn()==='w'?-10000:10000,mate:0,pv:[]}]};
 if(c.isGameOver())return{lines:[{cp:0,mate:null,pv:[]}]};
 const L=await eng.go(fen,d),sg=c.turn()==='w'?1:-1,lines=[];
 for(const k of Object.keys(L).sort()){const x=L[k];lines.push(x.t==='cp'?{cp:x.v*sg,mate:null,pv:x.pv.slice(0,8)}:{cp:sg*(x.v>0?1:-1)*(10000-Math.abs(x.v)*10),mate:sg*x.v,pv:x.pv.slice(0,8)});}
 return{lines};
}
async function run(){
 if(busy||!G)return;busy=true;abort=false;revCard();const g=G,eng=new Engine(),pos=[];
 try{await eng.init();
  for(let i=0;i<g.fens.length&&!abort;i++){pos.push(await evalFen(eng,g.fens[i],depth));
   const p=$('#pb');if(p){p.style.width=(i+1)/g.fens.length*100+'%';$('#pg').textContent='Analyzing position '+(i+1)+' of '+g.fens.length;}}
  if(!abort){g.an={pos,depth};if(G===g){R=reviewGame(g.moves,pos);persist();}}
 }catch(e){toastErr('Engine failed to start: '+e);}
 eng.kill();busy=false;if(G===g)render();
}
function toastErr(m){$('#coach').innerHTML=`<div class="ic" style="background:#fa412d">!</div><div><p>${m}</p></div>`;}
const go=p=>{ply=Math.max(0,Math.min(G.moves.length,p));render();};
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a;
 if(a==='imp'){libList();$('#modal').style.display='flex';}
 else if(a==='close')$('#modal').style.display='none';
 else if(a==='load')tryLoad($('#pgn').value);
 else if(a==='sample')tryLoad(SAMPLE);
 else if(a==='file')$('#fi').click();
 else if(a==='open'){const x=lib.find(v=>v.id==t.dataset.id);if(x)tryLoad(x.pgn);}
 else if(a==='del'){e.stopPropagation();lib=lib.filter(v=>v.id!=t.dataset.id);ls('rw-lib',JSON.stringify(lib));libList();}
 else if(!G)return;
 else if(a==='go')go(+t.dataset.p);else if(a==='first')go(0);else if(a==='prev')go(ply-1);else if(a==='next')go(ply+1);else if(a==='last')go(G.moves.length);
 else if(a==='flip'){flip=!flip;render();}
 else if(a==='review')run();else if(a==='cancel'){abort=true;}
});
document.addEventListener('change',e=>{if(e.target.id==='dp'){depth=+e.target.value;ls('rw-d',depth);}});
$('#fi').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('#pgn').value=r.result;tryLoad(r.result);};r.readAsText(f);e.target.value='';});
$('#graph').addEventListener('click',e=>{if(!R)return;const b=e.currentTarget.getBoundingClientRect();go(Math.round((e.clientX-b.left)/b.width*G.moves.length));});
addEventListener('keydown',e=>{if(!G||e.target.tagName==='TEXTAREA')return;if(e.key==='ArrowLeft')go(ply-1);else if(e.key==='ArrowRight')go(ply+1);else if(e.key==='ArrowUp')go(0);else if(e.key==='ArrowDown')go(G.moves.length);});
if(lib.length)tryLoad(lib[0].pgn);else{tryLoad(SAMPLE);}
