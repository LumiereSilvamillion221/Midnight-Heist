import {Chess} from 'chess.js';
import {reviewGame,CLS,wpm,fmt} from './core.js';
import {sfx} from './sfx.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}};
const jp=(k,d)=>{try{return JSON.parse(ls(k)||'null')||d;}catch(e){return d;}};
const IC={first:'<path d="M6 5v14"/><path d="M18 6l-8 6 8 6z"/>',prev:'<path d="M15 6l-6 6 6 6"/>',next:'<path d="M9 6l6 6-6 6"/>',last:'<path d="M18 5v14"/><path d="M6 6l8 6-8 6z"/>',play:'<path d="M8 5l11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',flip:'<path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4"/>',gear:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',imp:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>'};
const svg=(k,s)=>`<svg viewBox="0 0 24 24" width="${s||22}" height="${s||22}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
const SAMPLE='[Event "Opera Game"]\n[Site "Paris FRA"]\n[Date "1858.??.??"]\n[White "Paul Morphy"]\n[Black "Duke of Brunswick & Count Isouard"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';
const TH={green:['#eeeed2','#769656','Green'],brown:['#f0d9b5','#b58863','Brown'],blue:['#dee3e6','#8ca2ad','Blue'],purple:['#efefef','#8877b7','Purple'],slate:['#d7dbe0','#5e6a7a','Slate']};
const DEF={snd:true,vol:70,hap:true,theme:'green',pieces:'cburnett',coords:true,arrow:'bad',evalbar:true,lines:2,speed:900,awake:true};
let S=Object.assign({},DEF,jp('rw-set',{}));const saveS=()=>ls('rw-set',JSON.stringify(S));
const EH=(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())?window.Capacitor.registerPlugin('EngineHost'):null;
const BI=Object.assign({id:'sf',name:'Stockfish 19 Lite (built-in)',kind:'wasm',args:'',opts:'',lim:'depth',val:12},jp('rw-b',{}));
let ENG=jp('rw-eng',[]),engSel=ls('rw-engsel')||'sf',lib=jp('rw-lib',[]),oex=[];
const saveE=()=>{ls('rw-eng',JSON.stringify(ENG));ls('rw-engsel',engSel);};
const allEng=()=>[BI,...ENG],curEng=()=>allEng().find(e=>e.id===engSel)||BI;
let G=null,R=null,ply=0,flip=false,busy=false,abort=false,timer=null,live=null;
const TXT={brilliant:'a brilliant move',great:'a great move',best:'the best move',excellent:'an excellent move',good:'a good move',book:'a book move',inaccuracy:'an inaccuracy',mistake:'a mistake',miss:'a miss',blunder:'a blunder'};
const hap=ms=>{if(!S.hap)return;try{if(EH)EH.haptic({ms});else if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}};
function snd(m){if(S.snd){const t=m.san;sfx(/#/.test(t)?'end':/\+/.test(t)?'check':/^O-O/.test(t)?'castle':/=/.test(t)?'promote':/x/.test(t)?'capture':'move',S.vol/100);}hap(m.san.includes('x')?24:10);}
function parse(pgn){const c=new Chess();c.loadPgn(pgn);const mv=c.history({verbose:true});if(!mv.length)throw new Error('No moves found in that PGN');const h=c.header();
 return{id:Date.now(),pgn,moves:mv,fens:[mv[0].before,...mv.map(m=>m.after)],h,title:(h.White||'White')+' vs '+(h.Black||'Black'),an:null};}
function grid(fen){return fen.split(' ')[0].split('/').map(row=>{const r=[];for(const ch of row){if(/\d/.test(ch))for(let k=0;k<+ch;k++)r.push('');else r.push((ch===ch.toLowerCase()?'b':'w')+ch.toUpperCase());}return r;});}
const san=(fen,u)=>{try{return new Chess(fen).move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]}).san;}catch(e){return u;}};
function pvText(fen,pv){const g=new Chess(fen),p=fen.split(' ');let n=+p[5]||1,w=p[1]==='w',o=[],f=true;
 for(const u of pv.slice(0,8)){let m;try{m=g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});}catch(e){break;}o.push(w?n+'. '+m.san:(f?n+'… ':'')+m.san);f=false;if(!w)n++;w=!w;}return o.join(' ');}
function xy(u){const f=u.charCodeAt(0)-97,r=+u[1];return[(flip?7-f:f)+.5,(flip?r-1:8-r)+.5];}
function applyTheme(){const b=$('#board'),t=TH[S.theme]||TH.green;b.style.setProperty('--l',t[0]);b.style.setProperty('--d',t[1]);b.className='set-'+S.pieces+(S.coords?'':' nc');$('#eb').style.display=S.evalbar?'':'none';}
function drawBoard(){
 const g=grid(G.fens[ply]),m=ply?G.moves[ply-1]:null,r0=R&&ply?R.mv[ply-1]:null;let h='';
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const rr=flip?7-r:r,cc=flip?7-c:c,sq='abcdefgh'[cc]+(8-rr),p=g[rr][cc],hl=m&&(sq===m.from||sq===m.to);
  h+=`<div class="sq ${(rr+cc)%2?'d':'l'}${hl?' h':''}" style="left:${c*12.5}%;top:${r*12.5}%">`+(c===0?`<i class="rk">${8-rr}</i>`:'')+(r===7?`<i class="fl">${'abcdefgh'[cc]}</i>`:'')+(p?`<b class="p ${p}"></b>`:'')+(r0&&sq===m.to?`<u class="bd" style="background:${CLS[r0.cls][1]}">${CLS[r0.cls][0]}</u>`:'')+'</div>';}
 const bad=r0&&(S.arrow==='all'?!['best','brilliant','great','book'].includes(r0.cls):S.arrow==='bad'&&['inaccuracy','mistake','miss','blunder'].includes(r0.cls));
 if(bad&&r0.best){const[x1,y1]=xy(r0.best.slice(0,2)),[x2,y2]=xy(r0.best.slice(2,4)),d=Math.hypot(x2-x1,y2-y1),ux=(x2-x1)/d,uy=(y2-y1)/d,bx=x2-ux*.38,by=y2-uy*.38;
  h+=`<svg class="ar" viewBox="0 0 8 8"><g fill="#81b64c" stroke="#81b64c" opacity=".85"><line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke-width=".17" stroke-linecap="round"/><polygon stroke="none" points="${x2},${y2} ${bx-uy*.24},${by+ux*.24} ${bx+uy*.24},${by-ux*.24}"/></g></svg>`;}
 $('#board').innerHTML=h;
}
function evalBar(){
 const l=R?G.an.pos[ply].lines[0]:null,w=l?wpm(l.cp):50,lw=w>=50,lead=lw!==flip,e=$('#ebw');
 e.style.height=w+'%';e.style.top=flip?'0':'auto';e.style.bottom=flip?'auto':'0';
 const b=$('#ebl');b.textContent=l?fmt(l).replace('+','').replace('−','-'):'';b.style.color=lw?'#222':'#eee';b.style.top=lead?'auto':'0';b.style.bottom=lead?'0':'auto';
}
function players(){
 const h=G.h,fm=c=>{const n=h[c==='w'?'White':'Black']||(c==='w'?'White':'Black'),el=h[c==='w'?'WhiteElo':'BlackElo'];
  return`<span><b class="av ${c}">${esc(n[0]||'?').toUpperCase()}</b><span>${esc(n)} <small>${el&&el!=='?'?'('+esc(el)+')':''}</small></span></span>${R?`<i>${R.acc[c].toFixed(1)}%</i>`:''}`;};
 $('#pTop').innerHTML=fm(flip?'w':'b');$('#pBot').innerHTML=fm(flip?'b':'w');
}
function navHTML(){$('#nav').innerHTML=[['flip'],['first'],['prev'],['auto',timer?'pause':'play'],['next'],['last']].map(([a,i])=>`<button data-a="${a}"${a==='auto'&&timer?' class="on"':''} aria-label="${a}">${svg(i||a)}</button>`).join('');}
function coach(){
 let ic='♞',col='#3b3834',t='',s='';
 if(!ply){t=esc(R&&R.opening?R.opening:G.title);s=esc((G.h.Date&&!G.h.Date.includes('?')?G.h.Date+' · ':'')+(G.h.Result||'')+' · '+G.moves.length+' moves');}
 else{const m=G.moves[ply-1];
  if(!R){t=esc(m.san);s='Tap “Review game” for engine analysis.';}
  else{const r=R.mv[ply-1],c=CLS[r.cls],pos=G.an.pos;ic=c[0];col=c[1];t=`<b>${esc(m.san)}</b> is ${TXT[r.cls]}`;
   const bad=['inaccuracy','mistake','miss','blunder'].includes(r.cls);
   s=(bad?`Best was <b>${esc(san(G.fens[ply-1],r.best))}</b>. `:'')+`Eval ${esc(fmt(pos[ply].lines[0]))}`;if(r.cls==='book')s=esc(R.opening);}}
 $('#coach').innerHTML=`<div class="ic" style="background:${col}">${ic}</div><div><p>${t}</p><small>${s}</small></div>`;
}
const ring=(v,c)=>`<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#403d39" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(163.4*v/100).toFixed(1)} 163.4" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">${v.toFixed(0)}</text></svg>`;
function revCard(){
 const e=$('#rev'),c=curEng();
 if(busy){e.innerHTML=`<h3>Reviewing</h3><p id="pg" style="margin:0">Starting engine…</p><div class="bar"><i id="pb"></i></div><button data-a="cancel">Cancel</button>`;return;}
 if(!R){e.innerHTML=`<button class="pri" data-a="review" style="width:100%;padding:14px;font-size:16px">Review game</button><p style="margin:10px 0 0;color:var(--mut);font-size:13px">Engine: <b style="color:var(--ink)">${esc(c.name)}</b> · ${c.lim} ${c.val}<br>Change it in ⚙ Settings. Works fully offline.</p>`;return;}
 const k=Object.keys(CLS),f=x=>R.cnt[x];
 e.innerHTML=`<h3>Game review</h3><div class="acc"><div>${ring(R.acc.w,'#e9e8e4')}<b>White</b>accuracy</div><div>${ring(R.acc.b,'#81b64c')}<b>Black</b>accuracy</div></div><table>`+k.map(x=>`<tr><td>${f('w')[x]||0}</td><td><span class="dot" style="background:${CLS[x][1]}">${CLS[x][0]}</span>${CLS[x][2]}</td><td>${f('b')[x]||0}</td></tr>`).join('')+`</table><div class="row" style="justify-content:space-between;align-items:center"><small style="color:var(--mut)">${esc(G.an.eng)} · ${esc(G.an.lim)}</small><button data-a="review">Re-run</button></div>`;
}
function linesCard(){const e=$('#lines');if(!R){e.style.display='none';return;}e.style.display='';
 e.innerHTML='<h3>Engine lines</h3>'+G.an.pos[ply].lines.slice(0,S.lines).map(l=>`<div class="ln"><i class="${l.cp>=0?'w':'b'}">${esc(fmt(l))}</i><span>${esc(pvText(G.fens[ply],l.pv))}</span></div>`).join('');}
function keyCard(){const e=$('#key'),K=[];if(R)R.mv.forEach((r,i)=>{if(['brilliant','great','mistake','miss','blunder'].includes(r.cls))K.push([i,r]);});
 e.style.display=K.length?'':'none';e.innerHTML='<h3>Key moments</h3><div class="chips">'+K.map(([i,r])=>`<a class="chip" data-a="go" data-p="${i+1}"><span class="dot" style="background:${CLS[r.cls][1]};margin:0">${CLS[r.cls][0]}</span>${Math.floor(i/2)+1}${i%2?'…':'.'} ${esc(G.moves[i].san)}</a>`).join('')+'</div>';}
function graph(){
 const g=$('#graph');if(!R){g.innerHTML='';return;}
 const P=G.an.pos,n=P.length-1,pts=P.map((p,i)=>(i/n*100).toFixed(1)+','+(40-wpm(p.lines[0].cp)*.4).toFixed(1));
 g.innerHTML=`<path d="M0,40 L${pts.join(' L')} L100,40Z" fill="#e9e8e4"/><line x1="${ply/n*100}" x2="${ply/n*100}" y1="0" y2="40" stroke="#81b64c" stroke-width=".9"/>`;
}
function moveList(){
 let h='';G.moves.forEach((m,i)=>{if(i%2===0)h+=`<span class="n">${i/2+1}.</span>`;const r=R&&R.mv[i];
  h+=`<a data-a="go" data-p="${i+1}" class="${ply===i+1?'on':''}">${r?`<em style="color:${CLS[r.cls][1]}">${CLS[r.cls][0]}</em>`:''}${esc(m.san)}</a>`;});
 const e=$('#moves');e.innerHTML=h;const a=e.querySelector('.on');if(a)e.scrollTop=a.offsetTop-90;
}
function render(){applyTheme();drawBoard();evalBar();players();navHTML();coach();revCard();linesCard();keyCard();graph();moveList();}
function stopAuto(){if(timer){clearInterval(timer);timer=null;navHTML();}}
function go(p,quiet){const n=Math.max(0,Math.min(G.moves.length,p));if(n===ply)return stopAuto();const fwd=n>0&&Math.abs(n-ply)===1;ply=n;render();if(!quiet&&ply>0)snd(G.moves[ply-1]);if(fwd&&ply===G.moves.length)stopAuto();}
function auto(){if(timer)return stopAuto();if(ply>=G.moves.length)go(0,true);timer=setInterval(()=>go(ply+1),S.speed);navHTML();}
function openGame(g){stopAuto();if(busy){abort=true;if(live)live.kill();}G=g;R=g.an?reviewGame(g.moves,g.an.pos):null;ply=0;flip=false;closeM();render();}
function persist(g){const i=lib.findIndex(x=>x.id===g.id),e={id:g.id,pgn:g.pgn,an:g.an,title:g.title,date:new Date().toISOString().slice(0,10)};if(i>=0)lib[i]=e;else lib.unshift(e);lib=lib.slice(0,25);ls('rw-lib',JSON.stringify(lib));}
const openM=h=>{$('#mc').innerHTML=h;$('#modal').style.display='flex';},closeM=()=>{$('#modal').style.display='none';};
function libList(){return lib.length?'<div class="sec">Saved games</div>'+lib.map(x=>`<div class="g" data-a="open" data-id="${x.id}"><span>${esc(x.title)}<br><small>${esc(x.date)}${x.an?' · reviewed':''}</small></span><button class="ib" data-a="del" data-id="${x.id}">${svg('x',18)}</button></div>`).join(''):'';}
function impView(){openM(`<div class="mh">Import a game<button class="ib" data-a="close">${svg('x')}</button></div><textarea id="pgn" placeholder="Paste a PGN here"></textarea><div class="err" id="err"></div><div class="row"><button class="pri" data-a="load">Load PGN</button><button data-a="file">Open .pgn file</button><button data-a="sample">Sample game</button></div>`+libList());}
function tryLoad(txt){try{const g=parse(txt),old=lib.find(x=>x.pgn===txt);if(old&&old.an){g.id=old.id;g.an=old.an;}openGame(g);sfx('tick',S.vol/100);}catch(e){const el=$('#err');if(el)el.textContent='Could not read that PGN: '+String(e.message||e).slice(0,120);}}
// ---- engines ----
class WasmT{constructor(){this.w=new Worker('engine/stockfish.js');this.w.onmessage=e=>this.onl&&this.onl(String(e.data));}post(c){this.w.postMessage(c);}close(){this.w.terminate();}}
class NatT{constructor(c){this.id='e'+Date.now();EH.addListener('line',e=>{if(e.id===this.id&&this.onl)this.onl(e.line);}).then(h=>{this.h=h;});this.ready=EH.start({id:this.id,path:c.path,args:(c.args||'').split(/\s+/).filter(Boolean)});}
 post(c){this.ready.then(()=>EH.send({id:this.id,cmd:c}));}close(){EH.stop({id:this.id});if(this.h)this.h.remove();}}
class Engine{
 constructor(c){this.c=c;this.t=c.kind==='wasm'?new WasmT():new NatT(c);this.q=[];this.t.onl=l=>{this.q=this.q.filter(f=>!f(l));if(this.cb)this.cb(l);};}
 send(x){this.t.post(x);}
 wait(re,ms){return new Promise((res,rej)=>{this.rej=rej;const to=setTimeout(()=>rej(new Error('Engine did not answer ('+re+')')),ms);this.q.push(l=>re.test(l)&&(clearTimeout(to),res(),true));});}
 async init(){const a=this.wait(/^uciok/,60000);this.send('uci');await a;
  for(const ln of(this.c.opts||'').split('\n')){const m=ln.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/);if(m)this.send('setoption name '+m[1]+' value '+m[2]);}
  this.send('setoption name MultiPV value '+S.lines);const b=this.wait(/^readyok/,240000);this.send('isready');await b;this.send('ucinewgame');}
 go(fen,lim,v){return new Promise((res,rej)=>{this.rej=rej;const L={};this.cb=l=>{
  if(l.startsWith('info')&&l.includes(' pv ')){const k=+((l.match(/multipv (\d+)/)||[])[1]||1),s=l.match(/score (cp|mate) (-?\d+)/);if(!s)return;L[k]={t:s[1],v:+s[2],pv:l.split(' pv ')[1].trim().split(/\s+/)};}
  else if(l.startsWith('bestmove')){this.cb=null;res(L);}};
  this.send('position fen '+fen);this.send('go '+lim+' '+v);});}
 kill(){try{this.t.close();}catch(e){}if(this.rej)this.rej(new Error('stopped'));}
}
async function evalFen(eng,fen,lim,v){
 const c=new Chess(fen);
 if(c.isCheckmate())return{lines:[{cp:c.turn()==='w'?-10000:10000,mate:0,pv:[]}]};
 if(c.isGameOver())return{lines:[{cp:0,mate:null,pv:[]}]};
 const L=await eng.go(fen,lim,v),sg=c.turn()==='w'?1:-1,lines=[];
 for(const k of Object.keys(L).sort()){const x=L[k];lines.push(x.t==='cp'?{cp:x.v*sg,mate:null,pv:x.pv.slice(0,8)}:{cp:sg*(x.v>0?1:-1)*(10000-Math.abs(x.v)*10),mate:sg*x.v,pv:x.pv.slice(0,8)});}
 if(!lines.length)throw new Error('The engine returned no evaluation');
 return{lines};
}
const toastErr=m=>{$('#coach').innerHTML=`<div class="ic" style="background:#fa412d">!</div><div><p>${esc(m)}</p></div>`;};
async function run(){
 if(busy||!G)return;stopAuto();const g=G,c=curEng(),pR=R,pA=g.an;busy=true;abort=false;R=null;g.an=null;render();
 let eng=null,lock=null;try{if(S.awake&&navigator.wakeLock)lock=await navigator.wakeLock.request('screen');}catch(e){}
 const pos=[];
 try{eng=live=new Engine(c);await eng.init();
  for(let i=0;i<g.fens.length&&!abort;i++){pos.push(await evalFen(eng,g.fens[i],c.lim,c.val));
   const p=$('#pb');if(p){p.style.width=(i+1)/g.fens.length*100+'%';$('#pg').textContent='Analyzing position '+(i+1)+' of '+g.fens.length;}}
  if(!abort){g.an={pos,eng:c.name,lim:c.lim+' '+c.val};persist(g);if(G===g){R=reviewGame(g.moves,pos);sfx('done',S.vol/100);hap(30);}}
  else{g.an=pA;}
 }catch(e){g.an=pA;if(!abort&&G===g)setTimeout(()=>toastErr('Engine problem: '+(e.message||e)),0);}
 if(G===g&&!R&&g.an)R=reviewGame(g.moves,g.an.pos);
 if(eng)eng.kill();live=null;try{if(lock)lock.release();}catch(e){}busy=false;if(G===g||G)render();
}
// ---- settings ----
function setHTML(){
 const sw=(k,l)=>`<label class="set"><span>${l}</span><input type="checkbox" data-s="${k}"${S[k]?' checked':''}></label>`;
 const sel=(k,l,o)=>`<label class="set"><span>${l}</span><select data-s="${k}">${o.map(([v,n])=>`<option value="${v}"${String(S[k])===String(v)?' selected':''}>${n}</option>`).join('')}</select></label>`;
 const c=curEng(),nat=c.kind!=='wasm';
 return`<div class="mh">Settings<button class="ib" data-a="close">${svg('x')}</button></div>
<div class="sec">Sound & feel</div>${sw('snd','Sound effects')}<label class="set"><span>Volume</span><input type="range" data-s="vol" min="0" max="100" step="5" value="${S.vol}"></label>${sw('hap','Vibration on moves')}${sel('speed','Auto-play speed',[[600,'Fast'],[900,'Normal'],[1500,'Slow'],[2200,'Very slow']])}
<div class="sec">Board</div>${sel('theme','Board colors',Object.entries(TH).map(([k,v])=>[k,v[2]]))}${sel('pieces','Piece set',[['cburnett','Classic'],['merida','Merida']])}${sw('coords','Coordinates')}${sw('evalbar','Evaluation bar')}${sel('arrow','Best-move arrow',[['bad','After mistakes'],['all','After any non-best move'],['off','Off']])}
<div class="sec">Review</div>${sel('lines','Engine lines shown',[[1,'1'],[2,'2'],[3,'3']])}${sw('awake','Keep screen on while reviewing')}
<div class="sec">Engines</div>
${allEng().map(e=>`<div class="g" data-a="esel" data-id="${esc(e.id)}"><span><b>${esc(e.name)}</b><br><small>${e.kind==='wasm'?'Runs inside the app (WebAssembly)':'Native · '+esc(e.path)}</small></span><span>${e.id===c.id?'<b style="color:var(--grn)">✓ Active</b>':''}${e.id!=='sf'?`<button class="ib" data-a="edel" data-id="${esc(e.id)}">${svg('x',18)}</button>`:''}</span></div>`).join('')}
<div class="fld"><small>Limit per position</small><div class="row" style="margin:0"><select data-e="lim"><option value="depth"${c.lim==='depth'?' selected':''}>Depth</option><option value="nodes"${c.lim==='nodes'?' selected':''}>Nodes</option><option value="movetime"${c.lim==='movetime'?' selected':''}>Time (ms)</option></select><input type="number" data-e="val" value="${c.val}" min="1" style="width:110px"></div></div>
${nat?`<div class="fld"><small>Name</small><input type="text" data-e="name" value="${esc(c.name)}"></div><div class="fld"><small>Arguments (for example --weights=/path/to/net.pb.gz)</small><input type="text" data-e="args" value="${esc(c.args)}"></div><div class="fld"><small>UCI options, one per line as Name=Value</small><textarea data-e="opts">${esc(c.opts)}</textarea></div>`:''}
${EH?`<div class="row"><button data-a="eimp">Import engine file</button><button data-a="fimp">Import network file</button><button data-a="oex">Find OEX engines</button></div><div id="oexl"></div><div class="err" id="emsg" style="color:var(--mut)"></div>`:`<p style="color:var(--mut);font-size:13px">Importing Stockfish, Leela (Lc0) and other UCI or OEX engines works in the Android app.</p>`}
<div class="sec">Data</div><div class="row"><button data-a="clr">Delete saved games</button></div><small style="color:var(--mut)">Rookwise Review · Stockfish (GPLv3) · chess.js · piece sets by Colin M.L. Burnett and Armando Hernandez Marroquin.</small>`;
}
const openSet=()=>openM(setHTML());
const note=t=>{const e=$('#emsg');if(e)e.textContent=t;};
async function addNative(r){const c={id:'n'+Date.now(),name:r.name.replace(/\.[^.]+$/,''),kind:'native',path:r.path,args:'',opts:'',lim:'depth',val:12};ENG.push(c);engSel=c.id;saveE();openSet();note('Imported “'+c.name+'”. It is now the active engine. Run Review game to test it.');}
async function nat(fn){try{await fn();}catch(e){const m=String((e&&e.message)||e);if(!/cancel/i.test(m))note('Failed: '+m.slice(0,160));}}
document.addEventListener('click',async e=>{
 const t=e.target.closest('[data-a]');if(!t)return;const a=t.dataset.a;
 if(a==='imp')impView();else if(a==='set')openSet();else if(a==='close')closeM();
 else if(a==='load')tryLoad($('#pgn').value);else if(a==='sample')tryLoad(SAMPLE);else if(a==='file')$('#fi').click();
 else if(a==='open'){const x=lib.find(v=>v.id==t.dataset.id);if(x)tryLoad(x.pgn);}
 else if(a==='del'){e.stopPropagation();lib=lib.filter(v=>v.id!=t.dataset.id);ls('rw-lib',JSON.stringify(lib));impView();}
 else if(a==='esel'){engSel=t.dataset.id;saveE();openSet();}
 else if(a==='edel'){e.stopPropagation();const c=ENG.find(v=>v.id===t.dataset.id);if(c&&EH)try{EH.remove({path:c.path});}catch(x){}ENG=ENG.filter(v=>v.id!==t.dataset.id);if(engSel===t.dataset.id)engSel='sf';saveE();openSet();}
 else if(a==='eimp')nat(async()=>addNative(await EH.pickFile({kind:'engine'})));
 else if(a==='fimp')nat(async()=>{const c=curEng();if(c.kind==='wasm'){note('Select or import a native engine first.');return;}const r=await EH.pickFile({kind:'file'});
  if(/\.(pb|gz|onnx|bin)$/i.test(r.name))c.args=((c.args||'')+' --weights='+r.path).trim();else c.opts=((c.opts||'')+'\nEvalFile='+r.path).trim();saveE();openSet();note('Imported '+r.name+' and added it to this engine’s settings.');});
 else if(a==='oex')nat(async()=>{const r=await EH.listOex();oex=r.engines||[];$('#oexl').innerHTML=oex.length?oex.map((x,i)=>`<div class="g" data-a="oeximp" data-i="${i}"><span>${esc(x.name)}<br><small>${esc(x.pkg)}</small></span><button>Import</button></div>`).join(''):'<small style="color:var(--mut)">No OEX engine apps found. Install an OEX engine app (for example a Stockfish or Lc0 OEX app) and try again.</small>';});
 else if(a==='oeximp')nat(async()=>{const x=oex[+t.dataset.i];note('Importing '+x.name+'…');addNative(await EH.importOex({file:x.file,pkg:x.pkg}));});
 else if(a==='clr'){lib=[];ls('rw-lib','[]');}
 else if(!G)return;
 else if(a==='go')go(+t.dataset.p);else if(a==='first')go(0,true);else if(a==='prev')go(ply-1);else if(a==='next')go(ply+1);else if(a==='last')go(G.moves.length,true);
 else if(a==='auto')auto();else if(a==='flip'){flip=!flip;render();}
 else if(a==='review')run();else if(a==='cancel'){abort=true;if(live)live.kill();}
});
document.addEventListener('input',e=>{const t=e.target;
 if(t.dataset.s){const k=t.dataset.s;S[k]=t.type==='checkbox'?t.checked:(t.type==='range'||!isNaN(t.value)&&t.value!==''&&typeof DEF[k]==='number')?+t.value:t.value;saveS();if(G){render();if(timer){stopAuto();auto();}}if(k==='snd'||k==='vol')sfx('tick',S.vol/100);}
 else if(t.dataset.e){const c=curEng();c[t.dataset.e]=t.type==='number'?+t.value||1:t.value;if(c.id==='sf')ls('rw-b',JSON.stringify({lim:c.lim,val:c.val}));else saveE();if(G&&!busy)revCard();}});
$('#fi').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{tryLoad(r.result);};r.readAsText(f);e.target.value='';});
$('#graph').addEventListener('click',e=>{if(!R)return;const b=e.currentTarget.getBoundingClientRect();go(Math.round((e.clientX-b.left)/b.width*G.moves.length),true);});
addEventListener('keydown',e=>{if(!G||/TEXTAREA|INPUT|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowLeft')go(ply-1);else if(e.key==='ArrowRight')go(ply+1);else if(e.key==='ArrowUp')go(0,true);else if(e.key==='ArrowDown')go(G.moves.length,true);else if(e.key===' ')auto();});
$('#hImp').innerHTML=svg('imp');$('#hSet').innerHTML=svg('gear');
tryLoad(lib.length?lib[0].pgn:SAMPLE);
