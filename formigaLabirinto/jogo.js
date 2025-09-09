// ===== CONFIGURAÇÃO DAS FASES =====
// Agora TODAS as fases usam porcentagem p/ ficar responsivo.
// Fase 1 mantém paredes “decorativas” (sem colisão).
const FASES = [
  { // Fase 1 (Fácil)
    startPct:{x:0.18, y:0.47},   // ajuste fino à vontade
    goalPct: {x:0.80, y:0.38},
    bg: null,
    walls:[
      // moldura do tabuleiro (desenho)
      {x:0,y:0,w:720,h:12},{x:0,y:508,w:720,h:12},{x:0,y:0,w:12,h:520},{x:708,y:0,w:12,h:520},
      // “patinho”
      {x:180,y:80,w:360,h:12},{x:180,y:428,w:360,h:12},
      {x:180,y:80,w:12,h:146},{x:180,y:320,w:12,h:108},
      {x:528,y:80,w:12,h:146},{x:528,y:320,w:12,h:108},
      {x:240,y:140,w:228,h:12},{x:240,y:140,w:12,h:120},
      {x:192,y:260,w:220,h:12},{x:460,y:200,w:12,h:220},
      {x:388,y:200,w:84,h:12},{x:240,y:320,w:180,h:12},{x:240,y:320,w:12,h:84},
      {x:300,y:200,w:60,h:12},{x:300,y:380,w:84,h:12},{x:420,y:260,w:52,h:12}
    ]
  },
  { // Fase 2 (Médio) — abelha/colmeia como fundo
    bg: 'fase2.jpg',
    startPct: {x: 0.06, y: 0.38},
    goalPct:  {x: 0.92, y: 0.94},
    walls:[]
  },
  { // Fase 3 (Difícil) — conto de fadas como fundo
    bg: 'fase3.jpg',
    startPct: {x: 0.12, y: 0.18},
    goalPct:  {x: 0.88, y: 0.18},
    walls:[]
  }
];

// ===== UTIL =====
const intersects = (a,b)=>!(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

// ===== JOGO =====
(function(){
  const maze = document.getElementById('labirinto');
  const ant  = document.getElementById('ant');
  const goal = document.getElementById('goal');
  const pad  = document.getElementById('start');
  const msg  = document.getElementById('msg');
  const faseSel = document.getElementById('fase');
  const btnReiniciar = document.getElementById('reiniciar');
  const btnProx = document.getElementById('proxima');
  const btnLimpar = document.getElementById('limpar-trilha');
  const bgEl = document.getElementById('bg');

  // canvas da trilha
  const canvas = document.getElementById('trail');
  const ctx = canvas.getContext('2d');

  function resizeCanvas(){
    const w = maze.clientWidth, h = maze.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let faseAtual = 0;
  let dragging = false;
  let offset = {x:0,y:0};
  let lastPos = null; // último ponto da trilha (centro da formiga)

  function localPointer(ev){
    const r = maze.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    return {x,y};
  }

  function clearWalls(){ maze.querySelectorAll('.wall').forEach(w=>w.remove()); }
  function drawWalls(walls){
    for(const w of walls){
      const d = document.createElement('div');
      d.className='wall';
      d.style.left = w.x+'px';
      d.style.top  = w.y+'px';
      d.style.width  = w.w+'px';
      d.style.height = w.h+'px';
      maze.appendChild(d);
    }
  }
  function place(el,x,y){ el.style.left = x+'px'; el.style.top = y+'px'; }
  function placePct(el, pct){
    // usa o tamanho atual do elemento para centralizar bem
    const rect = el.getBoundingClientRect();
    const maxX = maze.clientWidth - rect.width;
    const maxY = maze.clientHeight - rect.height;
    place(el, Math.round(maxX * pct.x), Math.round(maxY * pct.y));
  }

  function clearTrail(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    lastPos = null;
  }

  function loadFase(i){
    faseAtual = i;
    faseSel.value = String(i);
    btnProx.classList.add('hidden');
    msg.innerHTML = '';
    clearTrail();

    const f = FASES[i];

    // fundo
    if(f.bg){
      bgEl.style.backgroundImage = `url('${f.bg}')`;
      bgEl.style.opacity = '1';
    }else{
      bgEl.style.backgroundImage = 'none';
      bgEl.style.opacity = '0';
    }

    // paredes (decor)
    clearWalls();
    if(f.walls && f.walls.length) drawWalls(f.walls);

    // posiciona start/goal e a formiga (porcentagens)
    const padPct = f.startPct ? {x: Math.max(0, f.startPct.x - 0.03), y: Math.max(0, f.startPct.y - 0.03)} : {x:0.02,y:0.9};
    if(f.startPct){
      placePct(pad, padPct);
      placePct(ant, f.startPct);
    }
    if(f.goalPct) placePct(goal, f.goalPct);
  }

  function antCenter(){
    return {
      x: ant.offsetLeft + ant.offsetWidth/2,
      y: ant.offsetTop  + ant.offsetHeight/2
    };
  }

  // ===== Arraste (Pointer Events only — tablet friendly) =====
  function startDrag(ev){
    ev.preventDefault();
    ant.setPointerCapture?.(ev.pointerId); // garante captura no iPad/Android
    const p = localPointer(ev);
    offset.x = p.x - ant.offsetLeft;
    offset.y = p.y - ant.offsetTop;
    dragging = true;

    const c = antCenter();
    lastPos = {x:c.x, y:c.y}; // inicia trilha no centro atual
  }

  function moveDrag(ev){
    if(!dragging) return;
    ev.preventDefault();

    const p = localPointer(ev);
    let nx = p.x - offset.x;
    let ny = p.y - offset.y;

    const antRect = ant.getBoundingClientRect();
    const maxX = maze.clientWidth - antRect.width;
    const maxY = maze.clientHeight - antRect.height;
    nx = clamp(nx,0,maxX);
    ny = clamp(ny,0,maxY);

    // desenha trilha do centro anterior ao novo centro
    const cx = nx + ant.offsetWidth/2;
    const cy = ny + ant.offsetHeight/2;

    if(lastPos){
      ctx.strokeStyle = '#facc15'; // amarelo
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    lastPos = {x:cx, y:cy};

    // aplica posição
    ant.style.left = nx+'px';
    ant.style.top  = ny+'px';

    // chegou?
    if(intersects(ant.getBoundingClientRect(), goal.getBoundingClientRect())){
      dragging = false;
      msg.innerHTML = `<span class="ok">✅ Muito bem! Fase ${faseAtual+1} concluída.</span>`;
      if(faseAtual < FASES.length-1) btnProx.classList.remove('hidden');
      else btnProx.classList.add('hidden');
    }
  }

  function endDrag(ev){
    dragging = false;
    try { ant.releasePointerCapture?.(ev.pointerId); } catch(e){}
  }

  // ===== Controles =====
  faseSel.addEventListener('change', e=> loadFase(parseInt(e.target.value,10)));
  btnReiniciar.addEventListener('click', ()=> loadFase(faseAtual));
  btnProx.addEventListener('click', ()=> { if(faseAtual < FASES.length-1) loadFase(faseAtual+1); });
  btnLimpar.addEventListener('click', clearTrail);

  // evitar drag “fantasma” de imagem
  ant.addEventListener('dragstart', e => e.preventDefault());

  // Listeners (Pointer Events apenas)
  ant.addEventListener('pointerdown', startDrag, {passive:false});
  window.addEventListener('pointermove', moveDrag, {passive:false});
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // pré-carrega imagens
  ['formiga.gif','formigueiro.jpg','fase2.jpg','fase3.jpg'].forEach(s=>{ const i=new Image(); i.src=s; });

  // inicial
  loadFase(0);
})();
