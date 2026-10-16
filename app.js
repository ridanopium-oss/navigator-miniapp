'use strict';
const $=id=>document.getElementById(id),tg=window.Telegram?.WebApp,canvas=$('screen'),ctx=canvas.getContext('2d');
const edges=[[1,2],[2,3],[3,4],[4,5],[4,6],[6,7],[7,8],[8,9],[4,10],[10,11],[11,12],[12,13],[1,14],[14,15],[15,16],[1,17],[17,18],[18,19]];
const flagNames=['Дистанция','Полоса HP','Полоса брони','Цвета ролей','Цвет за стенами','Линии к админам','Счётчик игроков','Счётчик админов','Счётчик медиа','Ники админов'];
let state=null,lastImage=null,lastTime='',friendsKey='',onlineKey='',running=false,authenticated=false;
const controls=[],colorControls=[];
const pagesHost=location.hostname.endsWith('.github.io');
let apiBase=(window.NAVIGATOR_API||'').replace(/\/$/,''),sessionToken='';
const fromMenu=new URLSearchParams(location.search).get('api');
if(fromMenu){try{const url=new URL(fromMenu);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&['','/'].includes(url.pathname)){apiBase=url.origin;try{localStorage.setItem('navigator_api',apiBase);}catch{}}}catch{}}
if(pagesHost&&!apiBase){try{apiBase=localStorage.getItem('navigator_api')||'';}catch{}}
function headers(json=false){return{...(json?{'Content-Type':'application/json'}:{}),...(sessionToken?{'Authorization':'Bearer '+sessionToken}:{})};}
async function post(path,payload){const response=await fetch(apiBase+path,{method:'POST',credentials:'omit',headers:headers(true),body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка запроса');return data;}
function showConnection(){if(!pagesHost&&!apiBase)return;$('connection').classList.remove('hidden');$('server-url').value=apiBase;}
$('connection').addEventListener('submit',async event=>{event.preventDefault();try{const url=new URL($('server-url').value.trim());if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('Нужен корневой HTTPS-адрес подключения');running=false;apiBase=url.origin;sessionToken='';try{localStorage.setItem('navigator_api',apiBase);}catch{}await start();}catch(e){error(e.message);}});
function error(message){$('error').textContent=message;}
async function change(key,value){try{await post('/api/options',{key,value});error('');}catch(e){error(e.message);}}
for(let key=0;key<flagNames.length;key++){
 const label=document.createElement('label'),input=document.createElement('input');label.append(document.createTextNode(flagNames[key]));input.type='checkbox';input.addEventListener('change',()=>change(key,input.checked));label.append(input);$('flags').append(label);controls.push(input);
}
for(const [key,name] of [[20,'Обычные игроки'],[22,'Медиа'],[23,'Лидеры'],[24,'Тестеры'],[25,'Тон за стенами']]){
 const label=document.createElement('label'),input=document.createElement('input');label.append(document.createTextNode(name));input.type='color';input.addEventListener('change',()=>{const rgb=parseInt(input.value.slice(1),16),packed=((rgb&255)<<16)|(rgb&0xff00)|((rgb>>16)&255);change(key,(0xe1000000|packed)>>>0);});label.append(input);$('color-inputs').append(label);colorControls.push({key,input});
}
for(let i=0;i<3;i++){
 const row=document.createElement('div');row.className='row';row.append(document.createTextNode(['Игроки','Админы','Медиа'][i]));
 for(let axis=0;axis<2;axis++){const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='0';input.max='100';input.step='1';input.id=`position-${i}-${axis}`;input.addEventListener('change',()=>change(10+i*2+axis,Math.max(0,Math.min(100,Number(input.value)))/100));label.append(document.createTextNode(axis?'Y %':'X %'),input);row.append(label);}$('positions').append(row);
}
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b===button));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.id!==button.dataset.tab));}));
$('toggle').addEventListener('click',async()=>{try{await post('/api/toggle',{});}catch(e){error(e.message);}});
$('fullscreen').addEventListener('click',()=>{try{if(tg?.isVersionAtLeast?.('8.0'))tg.requestFullscreen();else if(!document.fullscreenElement)$('viewer').requestFullscreen?.();else document.exitFullscreen?.();}catch(e){error(e.message);}});
async function friend(name,add){try{await post('/api/friends',{name,add});error('');}catch(e){error(e.message);}}
$('friend-form').addEventListener('submit',async event=>{event.preventDefault();const input=$('friend-name');await friend(input.value.trim(),true);input.value='';});
function listFriends(names,people){
 const key=JSON.stringify(names);if(key!==friendsKey){friendsKey=key;$('friend-list').replaceChildren();for(const name of names){const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');row.className='row';text.className='name';text.textContent=name;button.textContent='Убрать';button.addEventListener('click',()=>friend(name,false));row.append(text,button);$('friend-list').append(row);}}
 const online=[...new Map(people.filter(p=>p.name).map(p=>[p.name,p])).values()].sort((a,b)=>a.distance-b.distance),onlineState=JSON.stringify(online.map(p=>[p.name,names.includes(p.name)]));
 if(onlineState!==onlineKey){onlineKey=onlineState;$('online').replaceChildren();for(const p of online){const row=document.createElement('div'),text=document.createElement('span'),button=document.createElement('button');row.className='row';text.textContent=p.name;button.textContent=names.includes(p.name)?'Убрать':'В друзья';button.addEventListener('click',()=>friend(p.name,!names.includes(p.name)));row.append(text,button);$('online').append(row);}if(!online.length)$('online').textContent='Имена появятся после включения и чтения метаданных. Неизвестные имена не подставляются.';}
}
function unpack(color){return[color&255,(color>>>8)&255,(color>>>16)&255,(color>>>24)&255];}
function css(color){const c=unpack(color);return`rgba(${c[0]},${c[1]},${c[2]},${c[3]/255})`;}
function roleColor(p,hidden,settings,friendly){if(friendly)return'rgba(70,235,105,.88)';if(p.role==='admin')return css(0xe14b4bff);const index=settings.flags[3]?({media:2,leader:3,tester:4}[p.role]||0):0;let c=unpack(settings.colors[index]);if(settings.flags[4]&&hidden){const tone=unpack(settings.hidden);if(!index)return css(settings.hidden);const luminance=Math.floor((54*tone[0]+183*tone[1]+19*tone[2])/256),factor=.45+.55*luminance/255;c=c.map((v,i)=>i<3?Math.round(v*factor):Math.min(v,tone[3]));}return`rgba(${c[0]},${c[1]},${c[2]},${c[3]/255})`;}
function text(value,x,y,color,center=false){ctx.font='14px sans-serif';ctx.textAlign=center?'center':'left';ctx.fillStyle='rgba(0,0,0,.8)';ctx.fillText(value,x+1,y+1);ctx.fillStyle=color;ctx.fillText(value,x,y);}
function line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineWidth=width+1.5;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.stroke();ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
function render(data,image){
 if(!image||!data.image){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
 canvas.width=data.width;canvas.height=data.height;ctx.drawImage(image,0,0,canvas.width,canvas.height);
 if(!data.enabled||!data.settings)return;
 const w=canvas.width,h=canvas.height,s=data.settings,friendSet=new Set(data.friends||[]);
 for(const p of data.people||[]){const friendly=friendSet.has(p.name),points=p.joints.map(p=>p?[p[0]*w,p[1]*h]:null),valid=points.filter(Boolean);if(!valid.length)continue;
  for(const ei of p.edges){const [a,b]=edges[ei];if(points[a]&&points[b])line(points[a],points[b],roleColor(p,Boolean(p.hidden&(1<<ei)),s,friendly));}
  if(friendly)continue;
  if(p.role==='admin'&&s.flags[5]&&points[3])line([w/2,h-24],points[3],css(0xe14b4bff),1.25);
  if(p.role==='admin'&&s.flags[9]&&p.name&&points[5])text(p.name,points[5][0],points[5][1]-14,css(0xe14b4bff),true);
  const top=Math.min(...valid.map(p=>p[1])),bottom=Math.max(...valid.map(p=>p[1]));let x=Math.max(...valid.map(p=>p[0]))+5;
  function bar(value,color){if(bottom-top<4)return;ctx.fillStyle='rgba(0,0,0,.9)';ctx.fillRect(x-1,top-1,5,bottom-top+2);ctx.fillStyle='#282828';ctx.fillRect(x,top,3,bottom-top);ctx.fillStyle=color;const fraction=Math.max(0,Math.min(100,value))/100;ctx.fillRect(x,bottom-(bottom-top)*fraction,3,(bottom-top)*fraction);x+=7;}
  if(s.flags[1]&&p.hp!==null)bar(p.hp,'#50dc69');if(s.flags[2]&&p.armour>0)bar(p.armour,'#55afff');
  if(s.flags[0]&&points[0])text(`${Math.round(p.distance)} m`,points[0][0],bottom+18,roleColor(p,false,s,false),true);
 }
 for(let i=0;i<3;i++)if(s.flags[6+i])text(`${['Players','Admins','Media'][i]}: ${i&&data.partial?'>=':''}${[data.players,data.admins,data.media][i]}`,s.positions[i][0]*w,s.positions[i][1]*h+14,css(i===1?0xe14b4bff:s.colors[i===2?2:0]));
}
function update(data){state=data;const connected=data.connected,image=data.image;$('status').textContent=connected?(data.enabled?'Подключено · скелеты включены':'Подключено · скелеты выключены'):'Нет подключения к аддону';$('message').classList.toggle('hidden',Boolean(image));$('message').textContent=connected?'Ожидание картинки GTA. Окно игры должно быть активно; поддерживается SDR D3D11.':'Ожидание GTA и аддона данных. Запусти игру и установи новую .addon64.';
 if(data.settings){const s=data.settings;controls.forEach((input,i)=>{if(document.activeElement!==input)input.checked=s.flags[i];});for(const {key,input}of colorControls){const c=unpack(key===25?s.hidden:s.colors[key-20]);if(document.activeElement!==input)input.value='#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');}for(let i=0;i<3;i++)for(let a=0;a<2;a++){const input=$(`position-${i}-${a}`);if(document.activeElement!==input)input.value=Math.round(s.positions[i][a]*100);}}
 listFriends(data.friends||[],data.people||[]);
}
async function poll(){if(!running)return;try{const response=await fetch(apiBase+'/api/frame?after='+encodeURIComponent(lastTime),{credentials:'omit',headers:headers()});const data=await response.json();if(!response.ok){if(response.status===401)running=false;throw Error(data.error);}if(data.jpeg){const image=new Image();image.src='data:image/jpeg;base64,'+data.jpeg;await image.decode();lastImage=image;lastTime=String(data.time);}if(!data.image){lastImage=null;lastTime='';}update(data);render(data,lastImage);error('');}catch(e){error(e.message);lastImage=null;ctx.clearRect(0,0,canvas.width,canvas.height);$('message').classList.remove('hidden');$('message').textContent='Соединение потеряно. Ожидаю повторного подключения…';showConnection();}if(running)setTimeout(poll,document.hidden?1000:100);}
async function start(){tg?.ready();tg?.expand();if(pagesHost&&!apiBase){showConnection();$('status').textContent='Укажи адрес подключения с ПК';return;}if(!tg?.initData){$('status').textContent='Нужен вход через Telegram';return;}try{const login=await post('/api/login',{initData:tg.initData});if(!login.token)throw Error('Обнови Navigator на ПК до версии с поддержкой Pages');sessionToken=login.token;authenticated=true;running=true;$('connection').classList.add('hidden');poll();}catch(e){error(e.message);$('status').textContent='Доступ не разрешён';showConnection();}}
start();
