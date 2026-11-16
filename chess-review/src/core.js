import {Chess} from 'chess.js';
export const wpm=cp=>50+50*(2/(1+Math.exp(-.00368208*cp))-1);
export const fmt=l=>l.mate!=null?(l.cp>0?'+':'-')+'M'+Math.abs(l.mate):(l.cp>0?'+':l.cp<0?'−':'')+Math.abs(l.cp/100).toFixed(2);
export const CLS={brilliant:['!!','#1baca6','Brilliant'],great:['!','#5c8bb0','Great'],best:['★','#96bc4b','Best'],excellent:['+','#96bc4b','Excellent'],good:['✓','#a3b18a','Good'],book:['b','#a88865','Book'],inaccuracy:['?!','#f7c631','Inaccuracy'],mistake:['?','#ffa459','Mistake'],miss:['×','#ff7769','Miss'],blunder:['??','#fa412d','Blunder']};
const V={p:1,n:3,b:3,r:5,q:9};
const mat=(fen,c)=>{let s=0;for(const ch of fen.split(' ')[0]){const l=ch.toLowerCase();if(V[l]&&((ch===l)===(c==='b')))s+=V[l];}return s;};
const bal=(fen,c)=>mat(fen,c)-mat(fen,c==='w'?'b':'w');
const OP=[['e4','King’s Pawn Opening'],['e4 e5','Open Game'],['e4 e5 Nf3 Nc6 Bb5','Ruy Lopez'],['e4 e5 Nf3 Nc6 Bc4','Italian Game'],['e4 e5 Nf3 Nc6 Bc4 Bc5','Giuoco Piano'],['e4 e5 Nf3 Nc6 d4','Scotch Game'],['e4 e5 Nf3 Nc6 Nc3 Nf6','Four Knights Game'],['e4 e5 Nf3 Nf6','Petrov’s Defense'],['e4 e5 Nf3 d6','Philidor Defense'],['e4 e5 f4','King’s Gambit'],['e4 e5 Bc4','Bishop’s Opening'],['e4 e5 Nc3','Vienna Game'],['e4 e5 d4','Center Game'],['e4 c5','Sicilian Defense'],['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6','Sicilian: Najdorf'],['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4','Sicilian: Open'],['e4 c5 Nf3 e6','Sicilian: French Variation'],['e4 c5 c3','Sicilian: Alapin'],['e4 e6','French Defense'],['e4 e6 d4 d5 Nc3','French: Classical'],['e4 e6 d4 d5 e5','French: Advance'],['e4 c6','Caro-Kann Defense'],['e4 c6 d4 d5 e5','Caro-Kann: Advance'],['e4 c6 d4 d5 Nc3 dxe4 Nxe4','Caro-Kann: Classical'],['e4 d5','Scandinavian Defense'],['e4 d6','Pirc Defense'],['e4 Nf6','Alekhine Defense'],['e4 Nf6 e5 Nd5 d4 d6','Alekhine: Modern'],['e4 g6','Modern Defense'],['d4','Queen’s Pawn Opening'],['d4 d5','Closed Game'],['d4 d5 c4','Queen’s Gambit'],['d4 d5 c4 e6','Queen’s Gambit Declined'],['d4 d5 c4 dxc4','Queen’s Gambit Accepted'],['d4 d5 c4 c6','Slav Defense'],['d4 d5 Bf4','London System'],['d4 Nf6 Bf4','London System'],['d4 d5 Nf3 Nf6 Bf4','London System'],['d4 d5 Nf3 Nf6 e3','Colle System'],['d4 Nf6','Indian Defense'],['d4 Nf6 c4 g6','King’s Indian Defense'],['d4 Nf6 c4 e6 Nc3 Bb4','Nimzo-Indian Defense'],['d4 Nf6 c4 e6 Nf3 b6','Queen’s Indian Defense'],['d4 f5','Dutch Defense'],['c4','English Opening'],['Nf3','Réti Opening'],['f4','Bird’s Opening'],['b3','Nimzo-Larsen Attack'],['g3','King’s Fianchetto Opening']].map(([m,n])=>[m.split(' '),n]);
export function opening(sans){let book=0,name='',nl=0;
 for(const[m,n]of OP){let k=0;while(k<m.length&&k<sans.length&&m[k]===sans[k])k++;if(k>book)book=k;if(k===m.length&&k>=nl){name=n;nl=k;}}
 return{book,name};}
export function reviewGame(moves,pos){
 const{book,name}=opening(moves.map(m=>m.san)),mv=[];let prev=0;
 moves.forEach((m,i)=>{
  const c=m.color==='w'?1:-1,A=pos[i].lines,B=pos[i+1].lines;
  const wb=wpm(A[0].cp*c),wa=wpm(B[0].cp*c),loss=Math.max(0,(wb-wa)/100),uci=m.from+m.to+(m.promotion||''),isBest=uci===A[0].pv[0];
  let cls=isBest||loss<.005?'best':loss<=.02?'excellent':loss<=.05?'good':loss<=.1?'inaccuracy':loss<=.2?'mistake':'blunder';
  if(cls==='best'&&A[1]&&wb-wpm(A[1].cp*c)>=15&&wb<95)cls='great';
  if((cls==='best'||cls==='excellent'||cls==='great')&&wa>=45){
   try{const g=new Chess(m.after);for(const u of B[0].pv.slice(0,4))g.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
    if(bal(g.fen(),m.color)-bal(m.before,m.color)<=-2)cls='brilliant';}catch(e){}}
  if((cls==='inaccuracy'||cls==='mistake')&&prev>=.1)cls='miss';
  if(i<book)cls='book';
  prev=loss;
  mv.push({cls,loss,best:A[0].pv[0],acc:Math.max(0,Math.min(100,103.1668*Math.exp(-4.354*loss)-3.1669))});
 });
 const acc={},cnt={w:{},b:{}};
 for(const c of['w','b']){const a=mv.filter((_,i)=>moves[i].color===c).map(x=>x.acc);
  acc[c]=a.length?(a.reduce((s,x)=>s+x,0)/a.length+a.length/a.reduce((s,x)=>s+1/Math.max(x,1),0))/2:0;}
 mv.forEach((x,i)=>{const t=cnt[moves[i].color];t[x.cls]=(t[x.cls]||0)+1;});
 return{mv,acc,cnt,opening:name};
}
