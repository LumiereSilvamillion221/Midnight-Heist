let ctx,nb;
const C=()=>{if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ctx=new A();const n=Math.floor(ctx.sampleRate*.2);nb=ctx.createBuffer(1,n,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}
 if(ctx.state==='suspended')ctx.resume();return ctx;};
function tap(c,t,f,q,dur,v){const s=c.createBufferSource();s.buffer=nb;const b=c.createBiquadFilter();b.type='bandpass';b.frequency.value=f;b.Q.value=q;const g=c.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(b);b.connect(g);g.connect(c.destination);s.start(t);s.stop(t+dur);}
function osc(c,t,f,dur,v,type,f2){const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+.02);}
export function sfx(n,v){v=v==null?.7:v;
 try{const c=C();if(!c)return;const t=c.currentTime+.01;
  switch(n){
   case'move':tap(c,t,1100,1.2,.07,v*1.1);osc(c,t,200,.09,v*.5,'sine',90);break;
   case'capture':tap(c,t,1500,.9,.1,v*1.6);osc(c,t,160,.14,v*.7,'sine',60);tap(c,t+.045,900,1,.07,v*.9);break;
   case'castle':tap(c,t,1100,1.2,.07,v);osc(c,t,200,.09,v*.4,'sine',90);tap(c,t+.12,1000,1.2,.07,v);osc(c,t+.12,180,.09,v*.4,'sine',80);break;
   case'check':tap(c,t,1100,1.2,.07,v);osc(c,t+.05,880,.18,v*.35,'triangle');osc(c,t+.12,1320,.22,v*.3,'triangle');break;
   case'promote':[523,659,784,1047].forEach((f,i)=>osc(c,t+i*.07,f,.16,v*.3,'triangle'));break;
   case'end':tap(c,t,1100,1.2,.07,v);[784,659,523,392].forEach((f,i)=>osc(c,t+.1+i*.12,f,.3,v*.3,'sine'));break;
   case'done':osc(c,t,880,.25,v*.3);osc(c,t+.12,1175,.4,v*.3);break;
   case'tick':tap(c,t,2400,2,.02,v*.5);break;}
 }catch(e){}
}
