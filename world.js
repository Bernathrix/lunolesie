const $ = id => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');
const saveKey = 'lunolesye-farm-v1';
let state, player, running = false, saved = null;
let nearby = null;
let nextTick = 0;
const held = new Set();
const start = { x: 300, y: 306, area: 'farm' };
const forest = [
  { x: 33, y: 275, icon: '↩', name: 'Выход на ферму', actions: [['farm','Вернуться на ферму']] },
  { x: 336, y: 158, icon: '✨', name: 'Лунная поляна', actions: [['glade','Осмотреть поляну']] },
  { x: 505, y: 93, icon: '🍄', name: 'Светящиеся грибы', actions: [['mushrooms','Осмотреть грибы']] }
];
const icons = {buy:'🌰',sell:'🪙',craft:'🏮',deliver:'🤝',rescue:'🌱',
  plant:'🌱',water:'💧',harvest:'🎃',moon:'🌙',farm:'↩',glade:'✨',mushrooms:'🍄'};
const spriteIndex = Object.fromEntries(['🏡','🌙','🛠','👻','🌲','🌱','🎃','🪙','🌰','🏮','✨','↩','🍄'].map((icon,i)=>[icon,[2,3,4,5,7,9,10,12,13,14,15,2,16][i]]));
const actionSprites = {moon:11,plant:13,rescue:13,deliver:5,water:15,farm:2,clock:3};
function uiIcon(index) {
  return `<img class="sprite-icon" alt="" src="${artIcon(index ?? 15)}">`;
}
const locations = [
  { x: 105, y: 75, icon: '🏡', name: 'Магазин', actions: [['buy','Купить семя · 4'],['sell','Продать тыкву · +10']] },
  { x: 296, y: 75, icon: '🌙', name: 'Алтарь', actions: [['clock', s => s.night ? 'Начать новый день' : 'Завершить день']] },
  { x: 475, y: 75, icon: '🛠', name: 'Верстак', actions: [['craft','Сделать фонарь']] },
  { x: 427, y: 272, icon: '👻', name: 'Дух леса', actions: [['deliver','Отдать фонарь'],['rescue','Попросить семя']] },
  { x: 173, y: 180, bed: 0 }, { x: 251, y: 180, bed: 1 },
  { x: 173, y: 238, bed: 2 }, { x: 251, y: 238, bed: 3 }
];
const keys = {w:'up',a:'left',s:'down',d:'right',arrowup:'up',arrowleft:'left',arrowdown:'down',arrowright:'right',ц:'up',ф:'left',ы:'down',в:'right'};
try {
  const data = JSON.parse(localStorage.getItem(saveKey));
  if (data?.version === 1 && data.state?.beds?.length === 4 &&
      Number.isFinite(data.player?.x) && Number.isFinite(data.player?.y)) saved = data;
} catch {}

function menu() {
  running = false;
  held.clear();
  $('game').hidden = true;
  $('menu').hidden = false;
  $('play').textContent = saved ? 'Играть · продолжить' : 'Играть';
  $('new').hidden = !saved;
}
function writeSave(show = false) {
  saved = { version: 1, state, player };
  try {
    localStorage.setItem(saveKey, JSON.stringify(saved));
    if (show) $('feedback').textContent = 'Игра сохранена.';
    return true;
  } catch {
    if (show) $('feedback').textContent = 'Браузер не разрешил сохранить игру на диске.';
    return false;
  }
}
function begin(data) {
  state = data ? structuredClone(data.state) : newGame();
  state.time ??= state.night ? clock.evening : clock.morning;
  nextTick = performance.now() + clock.interval;
  player = data ? { ...start, ...data.player } : { ...start };
  running = true;
  nearby = null;
  $('menu').hidden = true;
  $('game').hidden = false;
  $('feedback').textContent = 'Подойди к магазину, чтобы купить семена.';
  refresh();
  writeSave();
}
$('play').onclick = () => begin(saved);
$('new').onclick = () => {
  if (confirm('Начать новую игру и заменить сохранение?')) begin(null);
};
$('save').onclick = () => writeSave(true);
function leave() {
  const persisted = writeSave();
  menu();
  $('menu-status').textContent = persisted ? 'Прогресс сохранён.' : 'Прогресс доступен до закрытия вкладки.';
}
$('back').onclick = leave;
addEventListener('pagehide', () => { if (running) writeSave(); });

function currentObjects() { return player.area === 'forest' ? forest : locations; }
function canInteract(action, bed) {
  return ['farm','glade','mushrooms'].includes(action) || allowed(state, action, bed);
}
function selectNearby() {
  let closest = null;
  let best = 50;
  for (const loc of currentObjects()) {
    const distance = Math.hypot(loc.x - player.x, loc.y - player.y);
    if (distance < best) { best = distance; closest = loc; }
  }
  return closest;
}
function actionsFor(loc) {
  if (!loc) return [];
  if (loc.bed === undefined) {
    return loc.actions.filter(([action]) => action !== 'rescue' || allowed(state, action));
  }
  const bed = state.beds[loc.bed];
  if (!bed) return [['plant','Посадить']];
  if (bed.age < rules.growth) return [['water','Полить']];
  return state.night ? [['moon','Превратить порталом'],['harvest','Собрать']] : [['harvest','Собрать']];
}
function renderInteraction() {
  $('action-tip').hidden = true;
  const panel = $('interaction');
  panel.hidden = !nearby;
  if (nearby) {
    panel.style.left = `clamp(62px, ${nearby.x / 6}%, calc(100% - 62px))`;
    panel.style.top = `${(nearby.y + 27) / 3.6}%`;
  }
  $('actions').replaceChildren(...actionsFor(nearby).map(([action,label]) => {
    const button = document.createElement('button');
    const caption = typeof label === 'function' ? label(state) : label;
    const icon = icons[action] ?? (state.night ? '☀️' : '🌙');
    button.innerHTML = uiIcon(actionSprites[action] ?? spriteIndex[icon], icon);
    button.title = caption;
    button.setAttribute('aria-label', caption);
    button.disabled = !canInteract(action, nearby.bed);
    const showTip = () => {
      $('action-tip').textContent = caption;
      $('action-tip').hidden = false;
    };
    button.onmouseenter = button.onfocus = showTip;
    button.onmouseleave = button.onblur = () => { $('action-tip').hidden = true; };
    button.onclick = () => interact(action);
    return button;
  }));
}
const inventoryItems = [
  ['coins','🪙','Монеты'], ['seeds','🌰','Семена тыквы'],
  ['pumpkins','🎃','Тыква'], ['moon','🌙','Лунная тыква'],
  ['lantern','🏮','Фонарь'], ['charges','✨','Заряды портала']
];
function renderInventory(s) {
  const inventory = $('inventory');
  if (!inventory.children.length) {
    for (const [, icon] of inventoryItems) {
      const slot = document.createElement('span');
      slot.tabIndex = 0;
      const index = icon === '🌙' ? 11 : spriteIndex[icon];
      slot.innerHTML = `<span class="item-icon" aria-hidden="true">${uiIcon(index, icon)}</span><span class="count"></span>`;
      inventory.append(slot);
    }
  }
  inventoryItems.forEach(([key,,name], i) => {
    const slot = inventory.children[i];
    const label = `${name} · ${s[key]}`;
    slot.dataset.label = label;
    slot.setAttribute('aria-label', label);
    slot.lastElementChild.textContent = s[key];
    slot.className = s[key] ? 'slot' : 'slot empty';
  });
}
function renderClock() {
  const minutes = state.time % 1440;
  const hh = String(Math.floor(minutes / 60)).padStart(2,'0');
  const mm = String(minutes % 60).padStart(2,'0');
  $('stats').textContent = `День ${state.day} · ${hh}:${mm} · ${state.night ? 'Ночь' : 'День'}`;
}
function refresh() {
  const s = state;
  $('area').textContent = player.area === 'forest' ? 'Лунный лес' : 'Ферма';
  renderClock();
  renderInventory(s);
  $('quest').textContent = player.area === 'forest' ? 'Исследуй поляну. Выход на ферму слева.' : s.won ? 'Тропа открыта. Пройди через ворота справа.' : s.lantern ? 'Отнеси фонарь духу у ворот.' : s.moon ? 'Сделай фонарь на верстаке.' : 'Выращивай тыкву два политых дня. Ночью преврати её порталом прямо на грядке.';
  nearby = selectNearby();
  renderInteraction();
}
function interact(action) {
  const loc = selectNearby();
  if (!loc || !actionsFor(loc).some(([a]) => a === action)) return;
  if (action === 'farm') { travel('farm'); return; }
  if (action === 'glade' || action === 'mushrooms') {
    $('feedback').textContent = action === 'glade'
      ? 'На поляне тихо мерцают цветы. Ты добрался до сердца лунного леса.'
      : 'Синие грибы освещают лесную тропу.';
    return;
  }
  const message = act(state, action, loc.bed);
  if (!message) return;
  if (action === 'clock') nextTick = performance.now() + clock.interval;
  $('feedback').textContent = message;
  refresh();
  writeSave();
}
addEventListener('keydown', e => {
  if (!running) return;
  const key = e.key.toLowerCase();
  if (keys[key]) { e.preventDefault(); held.add(keys[key]); }
  if (key === 'escape') leave();
  if ((key === 'e' || key === 'у') && !e.repeat) {
    const loc = selectNearby();
    const option = actionsFor(loc).find(([a]) => canInteract(a, loc.bed));
    if (option) interact(option[0]);
  }
});
addEventListener('keyup', e => held.delete(keys[e.key.toLowerCase()]));
addEventListener('blur', () => held.clear());
for (const button of document.querySelectorAll('[data-move]')) {
  const dir = button.dataset.move;
  button.style.touchAction = 'none';
  button.onpointerdown = e => { button.setPointerCapture(e.pointerId); held.add(dir); };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => held.delete(dir);
  button.onclick = e => { if (e.detail === 0 && running) step(dir, 18); };
}
function travel(area) {
  player = { area, x: area === 'forest' ? 83 : 480, y: 275 };
  held.clear();
  $('map-tip').hidden = true;
  $('feedback').textContent = area === 'forest' ? 'Ты вошёл в лунный лес.' : 'Ты вернулся на ферму.';
  refresh();
  writeSave();
}
canvas.addEventListener('pointermove', e => {
  if (!running) return;
  const bounds = canvas.getBoundingClientRect();
  const x = (e.clientX-bounds.left)*600/bounds.width;
  const y = (e.clientY-bounds.top)*360/bounds.height;
  const loc = currentObjects().find(o => Math.abs(o.x-x)<30 && Math.abs(o.y-y)<26);
  const tip = $('map-tip');
  tip.hidden = !loc;
  if (!loc) return;
  tip.textContent = loc.name ?? `Грядка ${loc.bed+1}`;
  tip.style.left = Math.max(0, Math.min(e.clientX-bounds.left+12, bounds.width-tip.offsetWidth))+'px';
  tip.style.top = Math.max(0, e.clientY-bounds.top-36)+'px';
});
canvas.addEventListener('pointerleave', () => { $('map-tip').hidden = true; });
function step(dir, amount) {
  const dx = Number(dir === 'right') - Number(dir === 'left');
  const dy = Number(dir === 'down') - Number(dir === 'up');
  const x = Math.max(16, Math.min(584, player.x + dx * amount));
  const y = Math.max(19, Math.min(339, player.y + dy * amount));
  const crosses = (player.x < 511) !== (x < 511);
  if (player.area === 'forest' || !crosses || (state.won && y >= 251 && y <= 300)) player.x = x;
  player.y = y;
  const loc = selectNearby();
  if (loc !== nearby) { nearby = loc; renderInteraction(); }
  if (player.area === 'farm' && player.x > 548 && state.won) travel('forest');
  else if (player.area === 'forest' && player.x < 25 && y >= 251 && y <= 300) travel('farm');
}
function rect(x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); }
function draw() {
  const forest = player.area === 'forest';
  const colors = palettes[forest ? 'forest' : state.night ? 'night' : 'day'];
  ctx.imageSmoothingEnabled = false;
  rect(0,0,600,360,colors[0]);
  for(let y=0;y<360;y+=12) for(let x=0;x<600;x+=12) {
    const v=(x*73+y*37+x*y*13)%109;
    if(v<45) rect(x+v%5,y+v%7,3+v%4,2,colors[1]);
    if(v<18) rect(x+4,y+6,2,3,colors[2]);
    if(v===0) rect(x+8,y+2,2,2,forest?'#af9ce5':'#eac985');
  }
  function paintTrails(routes) {
    for(const [width,color] of [[26,colors[5]],[20,colors[4]]]) {
      ctx.beginPath();ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=width;
      ctx.strokeStyle=color;
      for(const points of routes) {
        ctx.moveTo(...points[0]);
        for(let i=1;i<points.length-1;i++) {
          const [x,y]=points[i], [nx,ny]=points[i+1];
          ctx.quadraticCurveTo(x,y,(x+nx)/2,(y+ny)/2);
        }
        ctx.lineTo(...points.at(-1));
      }
      ctx.stroke();
    }
    for(let y=2;y<360;y+=6) for(let x=2;x<600;x+=7) {
      const grain=(x*37+y*17+x*y)%89;
      if(grain<20 && ctx.isPointInStroke(x,y)) {
        rect(x,y,grain%3+1,1,grain<8?colors[5]+'88':'#fff3cd50');
      }
    }
  }
  const scenery = forest
    ? [[25,40],[76,57],[133,34],[191,58],[249,31],[306,44],[368,29],[422,51],[483,36],[552,49],[578,115],[559,199],[563,303],[496,327],[426,307],[363,334],[190,325],[107,335],[49,318]]
    : [[22,36],[63,27],[153,32],[198,32],[236,25],[352,26],[391,38],[549,52],[578,95],[38,324],[86,340],[137,326],[221,329],[388,332],[444,331],[565,330]];
  if(forest) {
    paintTrails([[[0,275],[82,275],[145,268],[213,235],[291,177],[336,158],[403,155],[455,129],[505,93]]]);
    for(const [x,y] of [[142,229],[218,284],[286,131],[358,187],[464,184],[525,130]]) {
      pixelAsset(ctx,16,x-12,y-12,24);
    }
  } else {
    paintTrails([
      [[106,105],[119,129],[185,132],[293,132],[391,129],[456,122],[475,100]],
      [[296,95],[293,132],[311,166],[311,221],[320,269],[368,278],[445,276],[600,276]],
      [[296,345],[301,302],[320,269]]
    ]);
    for(let y=20;y<360;y+=32) {
      if(state.won && y>=244 && y<=298) continue;
      scenery.push([511,y]);
    }
    rect(136,150,149,116,colors[3]);
    rect(140,153,142,109,colors[5]);
    for(let i=0;i<4;i++) {
      const loc=locations.find(o=>o.bed===i);
      const crop=state.beds[i];
      const {x,y}=loc;
      rect(x-26,y-22,52,44,loc===nearby?'#e5c988':'#68433d');
      rect(x-24,y-20,48,40,crop?.wet?'#513c47':'#895b46');
      for(let j=-12;j<=12;j+=8) {
        rect(x-21,y+j,42,2,crop?.wet?'#72515a':'#aa7556');
        rect(x-19,y+j+3,38,2,'#61443e');
      }
      if(crop) pixelAsset(ctx,crop.age===2?(state.night?11:10):9,x-19,y-22,38);
    }
    if(!state.won) {
      rect(503,252,15,48,'#684841');rect(505,253,10,46,'#b48b61');
      for(let y=256;y<298;y+=9) rect(505,y,10,2,'#e8bd80');
    }
  }
  const entities=scenery.map(([x,y])=>({x,y,id:7,size:51}));
  for(const loc of currentObjects()) {
    if(loc.bed!==undefined) continue;
    if(loc===nearby) {
      ctx.strokeStyle='#f7d58e';ctx.lineWidth=2;
      ctx.strokeRect(loc.x-20,loc.y-16,40,32);
    }
    entities.push({x:loc.x,y:loc.y,id:spriteIndex[loc.icon]??15,size:loc.icon==='🏡'?76:52});
  }
  entities.push({...player,id:8,size:39});
  entities.sort((a,b)=>a.y-b.y);
  for(const {x,y,id,size} of entities) pixelAsset(ctx,id,x-size/2,y-size*.78,size);
  if (!forest && state.night && state.charges) {
    const phase = performance.now()/500;
    for(let i=0;i<3;i++) {
      const angle=phase+i*Math.PI*2/3;
      const x=296+Math.cos(angle)*24;
      const y=65+Math.sin(angle)*13;
      pixelAsset(ctx,15,x-5,y-5,10);
    }
  }
}

let previous = performance.now();
function frame(now) {
  const amount = Math.min(40, now-previous)*0.14 / Math.sqrt(Math.max(1, held.size));
  previous = now;
  if (running) {
    if (now >= nextTick) {
      nextTick = now + clock.interval;
      const message = advanceTime(state);
      if (message) {
        $('feedback').textContent = message;
        refresh();
        writeSave();
      } else renderClock();
    }
    ctx.imageSmoothingEnabled = false;
    for (const dir of held) step(dir, amount);
    draw();
  }
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);
