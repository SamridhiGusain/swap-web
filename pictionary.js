// Pictionary: random 1-on-1 matchmaking + live drawing over Supabase Realtime (no database tables needed).
window.Game=(()=>{
const WORDS="apple,house,bicycle,guitar,umbrella,book,chair,clock,tree,flower,fish,cat,dog,car,boat,phone,hat,shoes,pizza,cake,sun,moon,star,key,door,lamp,table,cup,bridge,mountain,rocket,camera,glasses,ring,balloon,candle,ladder,bed,bus,train,airplane,kite,drum,piano,pencil,scissors,teapot,television,watch,bag,spoon,bottle,cow,elephant,butterfly,snowman,rainbow,castle,robot".split(',');
const TURNS=6,SECS=60,COLORS=['#1f2328','#e5484d','#3a6fe0','#2e9e5b','#f08c00','#8a4fd1'];
let el,lobby,room,st='idle',G=null,cv,cx,buf=[],pen={c:COLORS[0],w:4},down=false,last=null,inviting=false,matchT,note='';
const q=s=>el.querySelector(s),name=()=>(typeof prof!=='undefined'&&prof.name)||'Player',nm=id=>id===me.id?'You':(G.players.find(p=>p.id===id)?.name||'Player');
const css=document.createElement('style');css.textContent=`.gbox{max-width:420px;margin:40px auto;text-align:center}.gp{max-width:820px;margin:0 auto}.gh{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-weight:600}.gtime{color:var(--acc)}.gword{text-align:center;font-size:22px;letter-spacing:.15em;margin:10px 0;min-height:34px}#gc{width:100%;aspect-ratio:8/5;background:#fff;border:1px solid var(--line);border-radius:14px;touch-action:none;display:block;cursor:crosshair}.gt{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.gsw{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);padding:0}.glog{margin-top:10px;max-height:110px;overflow:auto;color:var(--mute);font-size:14px}.gin{display:flex;gap:8px;margin-top:10px}.gl{margin-top:14px}`;document.head.append(css);

function ui(){
  if(st=='idle')el.innerHTML=`<div class="gbox"><h1>Pictionary</h1><p class="sub">${note||'Get matched with a random member who is online right now. Take turns drawing and guessing.'}</p><button class="btn" data-g="find">Find a player</button></div>`;
  else if(st=='search')el.innerHTML=`<div class="gbox"><h1>Looking for a player…</h1><p class="sub">Keep this page open. The game starts as soon as someone else joins.</p><button class="btn ghost" data-g="cancel">Cancel</button></div>`;
  else if(st=='end'){const s=G?G.players.map(p=>`<p><b>${esc(nm(p.id))}</b>: ${G.scores[p.id]}</p>`).join(''):'';const w=G&&[...G.players].sort((a,b)=>G.scores[b.id]-G.scores[a.id])[0];
    el.innerHTML=`<div class="gbox"><h1>${G&&G.scores[G.players[0].id]==G.scores[G.players[1].id]?"It's a tie":w&&w.id==me.id?'You won!':'Game over'}</h1>${s}<p class="sub">${esc(note)}</p><button class="btn" data-g="again">Play again</button> <button class="btn ghost" data-g="leave">Back</button></div>`}
  else{
    el.innerHTML=`<div class="gp"><div class="gh"><div id="gs"></div><div id="gt" class="gtime"></div></div><div id="gw" class="gword"></div><canvas id="gc" width="800" height="500"></canvas>
    <div class="gt" id="gtools">${COLORS.map(c=>`<button class="gsw" data-g="col" data-c="${c}" style="background:${c}" aria-label="Colour"></button>`).join('')}<button class="btn ghost sm" data-g="eraser">Eraser</button><button class="btn ghost sm" data-g="clear">Clear</button><button class="btn ghost sm" data-g="skip">Skip word</button></div>
    <div class="gin" id="gin"><input id="gguess" placeholder="Type your guess" autocomplete="off" aria-label="Your guess"><button class="btn" data-g="guess">Guess</button></div>
    <div class="glog" id="glog"></div><div class="gl"><button class="btn ghost sm" data-g="leave">Leave game</button></div></div>`;
    cv=q('#gc');cx=cv.getContext('2d');cx.lineCap='round';cx.lineJoin='round';
    const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]};
    const can=()=>G&&G.phase=='draw'&&G.drawer==me.id;
    cv.onpointerdown=e=>{if(!can())return;down=true;last=pos(e);cv.setPointerCapture(e.pointerId);seg(last,last)};
    cv.onpointermove=e=>{if(!down||!can())return;const p=pos(e);seg(last,p);last=p};
    cv.onpointerup=cv.onpointercancel=()=>{down=false;flush()};
    q('#gguess').onkeydown=e=>{if(e.key=='Enter')guess()};
    refresh();
  }
}
function paint(a,b,c,w){cx.strokeStyle=c;cx.lineWidth=w;cx.beginPath();cx.moveTo(a[0]*800,a[1]*500);cx.lineTo(b[0]*800,b[1]*500);cx.stroke()}
function seg(a,b){paint(a,b,pen.c,pen.w);buf.push([+a[0].toFixed(3),+a[1].toFixed(3),+b[0].toFixed(3),+b[1].toFixed(3)])}
function flush(){if(buf.length&&room){send('draw',{c:pen.c,w:pen.w,s:buf})}buf=[]}
const clearCv=()=>{if(cx){cx.clearRect(0,0,800,500)}};
const send=(event,payload)=>room&&room.send({type:'broadcast',event,payload});
function log(t){const l=q('#glog');if(l){l.insertAdjacentHTML('beforeend',`<div>${esc(t)}</div>`);l.scrollTop=l.scrollHeight}}
function refresh(){
  if(!G||st!='play'||!q('#gs'))return;const dr=G.drawer==me.id,p=G.phase;
  q('#gs').textContent=G.players.map(x=>(x.id==me.id?'You':x.name)+': '+G.scores[x.id]).join('  ·  ')+'  ·  Turn '+Math.min(G.turn+1,TURNS)+'/'+TURNS;
  q('#gw').textContent=p=='draw'?(dr?G.word.toUpperCase():'_ '.repeat(G.len).trim()+'  ('+G.len+' letters)'):(G.shown?G.shown.toUpperCase():'…');
  q('#gtools').style.display=dr&&p=='draw'?'flex':'none';q('#gin').style.display=!dr&&p=='draw'?'flex':'none';
}
function beginTurn(){
  G.phase='draw';G.word=WORDS[Math.random()*WORDS.length|0];G.len=G.word.length;G.endAt=Date.now()+SECS*1000;G.drawer=me.id;G.shown=null;
  clearCv();send('turn',{turn:G.turn,drawer:me.id,len:G.len,secs:SECS});log('Your turn to draw!');refresh();
}
function finish(ok,who){
  if(!G||G.phase!='draw')return;G.phase='wait';const rem=Math.max(0,(G.endAt-Date.now())/1000);
  if(ok){G.scores[who]+=10+Math.ceil(rem/6);G.scores[me.id]+=5}
  const p={ok,who,word:G.word,scores:G.scores};send('result',p);onResult(p);
}
function onResult(p){
  G.scores=p.scores;G.phase='wait';G.shown=p.word;
  log(p.ok?`${nm(p.who)} guessed "${p.word}"!`:`Time's up. The word was "${p.word}".`);refresh();
  const r=room;setTimeout(()=>{if(!G||room!==r||G.phase!='wait')return;G.turn++;
    if(G.turn>=TURNS){st='end';note='';ui();return}
    G.drawer=G.players[G.turn%2].id;G.shown=null;if(G.drawer==me.id)beginTurn();else{clearCv();refresh()}},3500);
}
function guess(){
  const i=q('#gguess'),t=i.value.trim();if(!t||!G||G.phase!='draw')return;i.value='';log('You: '+t);send('guess',{from:me.id,text:t});
}
function onEv(ev,p){
  if(!G)return;
  if(ev=='turn'){G.turn=p.turn;G.drawer=p.drawer;G.len=p.len;G.endAt=Date.now()+p.secs*1000;G.phase='draw';G.word=null;G.shown=null;clearCv();log(nm(p.drawer)+' is drawing. Guess the word!');refresh()}
  else if(ev=='draw'){p.s.forEach(s=>paint([s[0],s[1]],[s[2],s[3]],p.c,p.w))}
  else if(ev=='clear')clearCv();
  else if(ev=='guess'){log(nm(p.from)+': '+p.text);if(G.phase=='draw'&&G.drawer==me.id&&p.text.trim().toLowerCase()==G.word)finish(true,p.from)}
  else if(ev=='result')onResult(p);
}
function onSync(){
  const pr=room.presenceState(),ids=Object.keys(pr).sort();
  if(!G&&ids.length==2){
    clearTimeout(matchT);G={players:ids.map(id=>({id,name:pr[id][0].name})),scores:{},turn:0,phase:'wait',drawer:ids[0],room};
    ids.forEach(id=>G.scores[id]=0);st='play';ui();if(G.drawer==me.id)setTimeout(()=>{if(G&&G.turn==0&&G.phase=='wait')beginTurn()},900);
  }else if(G&&ids.length<2&&st=='play'){st='end';note='Your opponent left the game.';ui()}
}
function enterRoom(id){
  room=sb.channel('pic:'+id,{config:{presence:{key:me.id}}});room.on('presence',{event:'sync'},onSync);
  ['turn','draw','clear','guess','result'].forEach(ev=>room.on('broadcast',{event:ev},({payload})=>onEv(ev,payload)));
  room.subscribe(s=>{if(s=='SUBSCRIBED')room.track({name:name()})});
  lobby&&lobby.track({name:name(),t:Date.now(),s:'busy'});setTimeout(leaveLobby,3000);
  matchT=setTimeout(()=>{if(!G){cleanup();startSearch()}},12000);
}
function check(){
  if(room||inviting||!lobby)return;
  const l=Object.entries(lobby.presenceState()).map(([id,v])=>({id,...v[0]})).filter(p=>p.s=='waiting').sort((a,b)=>a.t-b.t||a.id.localeCompare(b.id));
  const i=l.findIndex(p=>p.id==me.id);
  if(i>=0&&i%2==0&&l[i+1]){inviting=true;const id=crypto.randomUUID();lobby.send({type:'broadcast',event:'match',payload:{a:me.id,b:l[i+1].id,room:id}});enterRoom(id)}
}
function startSearch(){
  st='search';note='';ui();
  lobby=sb.channel('pic-lobby',{config:{presence:{key:me.id}}});
  lobby.on('presence',{event:'sync'},check).on('broadcast',{event:'match'},({payload})=>{if(payload.b==me.id&&st=='search'&&!room)enterRoom(payload.room)});
  lobby.subscribe(s=>{if(s=='SUBSCRIBED')lobby.track({name:name(),t:Date.now(),s:'waiting'})});
}
function leaveLobby(){if(lobby){sb.removeChannel(lobby);lobby=null}}
function cleanup(){clearTimeout(matchT);if(room){sb.removeChannel(room);room=null}leaveLobby();G=null;inviting=false;down=false;buf=[]}
setInterval(()=>{
  if(!G||st!='play'||!q('#gt'))return;
  if(G.phase=='draw'){const r=Math.max(0,Math.ceil((G.endAt-Date.now())/1000));q('#gt').textContent=r+'s';if(r==0&&G.drawer==me.id)finish(false)}else q('#gt').textContent='';
},250);
setInterval(flush,150);
function click(e){
  const b=e.target.closest('[data-g]');if(!b)return;const a=b.dataset.g;
  if(a=='find'||a=='again'){cleanup();startSearch()}
  else if(a=='cancel'||a=='leave'){cleanup();st='idle';note='';ui()}
  else if(a=='col'){flush();pen={c:b.dataset.c,w:4}}
  else if(a=='eraser'){flush();pen={c:'#ffffff',w:26}}
  else if(a=='clear'){clearCv();send('clear',{})}
  else if(a=='skip'){if(G&&G.drawer==me.id)finish(false)}
  else if(a=='guess')guess();
}
return{show(){el=document.getElementById('game');if(!el.dataset.i){el.dataset.i=1;el.addEventListener('click',click);ui()}}};
})();
