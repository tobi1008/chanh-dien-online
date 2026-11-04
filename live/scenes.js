/* Scenes the hall can switch to (overlay + thumbnails in the control panel).
   Every scene keeps the hall painting's layout, so seats, the walk to the altar and the camera line up in all of them:
   Buddha statue at (410,470)–(670,795) (photo backdrops are scaled and cropped so their censer lands there too), altar table top at y≈985 with the censer at (540,968), the abbot at y 1100,
   altar spots at y 1175, seated crowd on y 1215–1845. The painted parts are drawn once to an offscreen canvas
   (paint); back() runs every frame behind the people, front() in front of them. Both get the alpha to draw at,
   so two scenes can cross-fade. */
(function(){
const W = 1080, H = 1920, TAU = Math.PI*2;
function rng(seed){ let s = seed % 2147483647; return () => (s = s*16807 % 2147483647) / 2147483647; }
function vgrad(g, y0, y1, stops){ const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([k,c]) => gr.addColorStop(k, c)); return gr; }
function rgrad(g, x, y, r0, r1, stops){ const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([k,c]) => gr.addColorStop(k, c)); return gr; }
function ell(g, x, y, rx, ry){ g.beginPath(); g.ellipse(x, y, Math.max(.1,rx), Math.max(.1,ry), 0, 0, TAU); }
function vignette(g, a){ g.fillStyle = rgrad(g, 540, 1000, 500, 1250, [[0,'rgba(0,0,0,0)'],[1,`rgba(0,0,0,${a})`]]); g.fillRect(0, 0, W, H); }

/* ---------------- altar: plinth under the statue, table, censer, candles, fruit, flowers ---------------- */
function altar(g, buddha, o){
  // contact shadow on the ground
  g.fillStyle = rgrad(g, 540, 1160, 10, 360, [[0,'rgba(0,0,0,.45)'],[1,'rgba(0,0,0,0)']]); g.save(); g.scale(1,.3); ell(g, 540, 1160/.3, 360, 360); g.fill(); g.restore();
  const s = o.stone;   // [dark, mid, light]
  const block = (x0, x1, y0, y1) => {
    g.fillStyle = vgrad(g, y0, y1, [[0,s[2]],[.25,s[1]],[1,s[0]]]); g.fillRect(x0, y0, x1-x0, y1-y0);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, y0, x1-x0, 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, y1-3, x1-x0, 3);
  };
  block(405, 675, 900, 946); block(445, 635, 812, 902); block(420, 660, 784, 814);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; g.strokeRect(470, 826, 140, 62);       // carved panel
  g.strokeStyle = 'rgba(255,240,200,.22)'; g.beginPath(); g.arc(540, 857, 18, 0, TAU); g.stroke();
  if (buddha?.naturalWidth) g.drawImage(buddha, 410, 470);
  // table
  const t = o.table;   // [dark, mid, light, trim]
  g.fillStyle = vgrad(g, 970, 996, [[0,t[2]],[1,t[1]]]);
  g.beginPath(); g.moveTo(300,972); g.lineTo(780,972); g.lineTo(802,996); g.lineTo(278,996); g.closePath(); g.fill();
  g.fillStyle = vgrad(g, 996, 1150, [[0,t[1]],[1,t[0]]]); g.fillRect(282, 996, 516, 150);
  g.fillStyle = t[0]; g.fillRect(288, 1146, 30, 20); g.fillRect(762, 1146, 30, 20);
  g.strokeStyle = t[3]; g.lineWidth = 3; g.strokeRect(300, 1012, 480, 120);
  g.lineWidth = 1.5; g.strokeRect(310, 1022, 460, 100);
  g.fillStyle = t[3]; g.fillRect(278, 994, 524, 4);
  if (o.cloth){                                           // red runner with a gold border and a lotus seal
    g.fillStyle = '#8e1f14'; g.beginPath(); g.moveTo(440,975); g.lineTo(640,975); g.lineTo(648,996); g.lineTo(648,1112); g.lineTo(540,1130); g.lineTo(432,1112); g.lineTo(432,996); g.closePath(); g.fill();
    g.strokeStyle = '#e2b04f'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#e2b04f'; ell(g, 540, 1052, 30, 30); g.fill(); g.fillStyle = '#8e1f14'; ell(g, 540, 1052, 23, 23); g.fill();
    g.fillStyle = '#e2b04f'; for (let i=-2;i<=2;i++){ g.save(); g.translate(540,1060); g.rotate(i*.42); g.beginPath(); g.ellipse(0,-12,6,13,0,0,TAU); g.fill(); g.restore(); }
  }
  // vases with lotus, fruit plates, candle holders, censer
  for (const x of [345, 735]){
    g.strokeStyle = '#3f6b3a'; g.lineWidth = 3;
    for (const [dx,h] of [[-14,95],[0,120],[16,88]]){ g.beginPath(); g.moveTo(x, 940); g.quadraticCurveTo(x+dx*.4, 940-h*.5, x+dx, 940-h); g.stroke(); lotusFlower(g, x+dx, 940-h, .55); }
    g.fillStyle = '#3f7a45'; for (const d of [-1,1]){ g.beginPath(); g.ellipse(x+d*24, 905, 20, 8, d*.5, 0, TAU); g.fill(); }
    g.fillStyle = vgrad(g, 932, 994, [[0,'#f2f5f8'],[1,'#b9c4d2']]);
    g.beginPath(); g.moveTo(x-10,932); g.quadraticCurveTo(x-28,962,x-16,994); g.lineTo(x+16,994); g.quadraticCurveTo(x+28,962,x+10,932); g.closePath(); g.fill();
    g.fillStyle = '#3b5ea8'; g.fillRect(x-20, 958, 40, 6); g.fillRect(x-17, 980, 34, 4);
  }
  for (const x of [412, 668]){
    brass(g, x, 976, 26);
    for (const [dx,dy] of [[-16,0],[0,0],[16,0],[-8,-16],[8,-16],[0,-31]]){ g.fillStyle = rgrad(g, x+dx-4, 964+dy-4, 1, 13, [[0,'#ffc56a'],[1,'#d8701c']]); ell(g, x+dx, 964+dy, 11, 11); g.fill(); }
  }
  for (const x of [475, 605]){ brass(g, x, 978, 14); g.fillStyle = vgrad(g, 943, 976, [[0,'#e04a2c'],[1,'#a32616']]); g.fillRect(x-6, 943, 12, 33); g.fillStyle = '#2a1206'; g.fillRect(x-1, 937, 2, 6); }
  g.fillStyle = '#3d2a10'; g.fillRect(508, 985, 6, 13); g.fillRect(566, 985, 6, 13); g.fillRect(537, 988, 6, 11);
  g.fillStyle = vgrad(g, 958, 996, [[0,'#e0b45c'],[.5,'#a77a32'],[1,'#5a3a14']]);
  g.beginPath(); g.moveTo(488,960); g.quadraticCurveTo(486,996,540,996); g.quadraticCurveTo(594,996,592,960); g.closePath(); g.fill();
  g.strokeStyle = '#c99a4a'; g.lineWidth = 4; for (const d of [-1,1]){ g.beginPath(); g.arc(540+d*54, 968, 9, d<0?Math.PI*.5:-Math.PI*.5, d<0?Math.PI*1.5:Math.PI*.5); g.stroke(); }
  g.fillStyle = '#e3bb68'; ell(g, 540, 960, 53, 9); g.fill(); g.fillStyle = '#4a3a2a'; ell(g, 540, 961, 45, 6); g.fill();
}
function brass(g, x, y, r){
  g.fillStyle = '#b8873a'; g.fillRect(x-3, y, 6, 996-y); ell(g, x, 995, r*.6, 3); g.fill();
  g.fillStyle = '#e0b45c'; ell(g, x, y, r, r*.22); g.fill();
}
function lotusFlower(g, x, y, k){
  for (const [a,l,c] of [[-.9,26,'#e48aa6'],[.9,26,'#e48aa6'],[-.45,30,'#f2a9c0'],[.45,30,'#f2a9c0'],[0,34,'#ffd0de']]){
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.fillStyle = c; g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(-13,-l*.55,0,-l); g.quadraticCurveTo(13,-l*.55,0,0); g.fill(); g.restore();
  }
}

/* ---------------- bamboo (photo backdrop, assets/bamboo.jpg) ---------------- */
function leaf(g, x, y, len, ang, w){
  g.save(); g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0,0); g.quadraticCurveTo(len*.3, -w, len, 0); g.quadraticCurveTo(len*.3, w, 0, 0); g.fill(); g.restore();
}
function bambooFront(g, t, dt, a, st){
  st.leaves ||= [];
  if (st.leaves.length < 9 && Math.random() < dt*.8) st.leaves.push({ x:Math.random()*W, y:-30, vx:20+Math.random()*30, vy:50+Math.random()*40, r:Math.random()*TAU, vr:(Math.random()-.5)*3, s:.7+Math.random()*.6, ph:Math.random()*TAU });
  g.save(); g.globalAlpha = a;
  for (let i=st.leaves.length-1;i>=0;i--){ const l = st.leaves[i];
    l.x += (l.vx + Math.sin(t*1.4+l.ph)*40)*dt; l.y += l.vy*dt; l.r += l.vr*dt;
    if (l.y > H+40){ st.leaves.splice(i,1); continue; }
    g.fillStyle = i%3 ? '#7fa64f' : '#c2b35a'; leaf(g, l.x, l.y, 30*l.s, l.r, 5*l.s);
  }
  // sun motes
  g.globalCompositeOperation = 'lighter';
  for (let i=0;i<18;i++){ const x = (i*173 + t*12*(1+i%3)) % W, y = 500 + ((i*311) % 900) + Math.sin(t*.7+i)*30;
    g.globalAlpha = a*(.25+.25*Math.sin(t*1.7+i*2)); g.fillStyle = '#fff6c8'; ell(g, x, y, 2.4, 2.4); g.fill(); }
  g.restore();
}

/* ---------------- lotus pond under the moon ---------------- */
function ridge(g, r, y, amp, color, step){
  g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
  let h = 0; for (let x = 0; x <= W+step; x += step){ h = h*.7 + (r()-.5)*amp; g.lineTo(x, y + h + Math.sin(x*.006+y)*amp*.8); }
  g.lineTo(W, H); g.closePath(); g.fill();
}
function pad(g, x, y, rx, c){
  g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, rx*.32, 0, .25, TAU-.05); g.lineTo(x, y); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); for (let i=0;i<6;i++){ const a = .6+i*1; g.moveTo(x, y); g.lineTo(x+Math.cos(a)*rx*.85, y+Math.sin(a)*rx*.27); } g.stroke();
}
const DECK = { vy:-75, top:990 };
const deckX = (xb, y) => 540 + (xb-540)*((y-DECK.vy)/(H-DECK.vy));     // plank line through xb at the bottom edge
const LOTUS_POSTS = [[1050],[1290],[1640]].map(([y]) => y);
function paintLotus(g, img){
  const r = rng(1508);
  g.fillStyle = vgrad(g, 0, 980, [[0,'#060a1d'],[.5,'#111b40'],[.85,'#26305f'],[1,'#3c4074']]); g.fillRect(0, 0, W, 980);
  for (let i=0;i<260;i++){ const y = r()*900, s = r(); g.fillStyle = `rgba(255,250,235,${.25+s*.7})`; ell(g, r()*W, y, .6+s*1.4, .6+s*1.4); g.fill(); }
  // moon behind the statue
  g.fillStyle = rgrad(g, 540, 600, 180, 760, [[0,'rgba(255,240,205,.42)'],[.35,'rgba(200,200,240,.14)'],[1,'rgba(120,130,200,0)']]); g.fillRect(0, 0, W, 1100);
  g.fillStyle = rgrad(g, 500, 540, 20, 215, [[0,'#fffdf4'],[.75,'#f6efd8'],[1,'#e6dab8']]); ell(g, 540, 600, 212, 212); g.fill();
  for (const [x,y,rr] of [[470,520,40],[600,560,55],[520,690,32],[640,670,26],[430,620,22]]){ g.fillStyle = rgrad(g, x, y, 0, rr, [[0,'rgba(190,178,150,.16)'],[1,'rgba(190,178,150,0)']]); ell(g, x, y, rr, rr); g.fill(); }
  g.fillStyle = 'rgba(170,170,210,.22)'; for (const [x,y,w] of [[380,700,260],[700,760,220],[520,815,300]]){ ell(g, x, y, w, 10); g.fill(); }
  // mountains and mist over the water
  ridge(g, r, 880, 40, '#2a3264', 26);
  g.fillStyle = vgrad(g, 860, 980, [[0,'rgba(170,180,230,0)'],[1,'rgba(170,180,230,.18)']]); g.fillRect(0, 860, W, 120);
  ridge(g, r, 935, 28, '#1a2150', 22);
  // water
  g.fillStyle = vgrad(g, 960, H, [[0,'#283066'],[.3,'#161d46'],[1,'#080c24']]); g.fillRect(0, 960, W, H-960);
  for (let i=0;i<320;i++){ const y = 965+Math.pow(r(),1.6)*950, k = (y-960)/960; g.fillStyle = `rgba(190,200,255,${.05+.08*(1-k)})`; g.fillRect(r()*W, y, 20+r()*90*(1+k), 1+k*2); }
  for (let y=968; y<1260; y+=5){ const k = (y-968)/292, w = 40+k*160; g.fillStyle = `rgba(255,240,200,${.4*(1-k)})`; g.fillRect(540-w/2+(r()-.5)*40, y, w*(.4+r()*.6), 2); }
  // lotus in the water beside the deck
  for (let i=0;i<70;i++){
    const y = 975+Math.pow(r(),1.3)*700, side = r()<.5 ? -1 : 1, edge = deckX(side<0 ? -40 : 1120, y), k = .35+(y-975)/600;
    const x = side<0 ? r()*(edge-30*k) : edge+30*k + r()*(W-edge);
    if (side<0 ? x > edge-20 : x < edge+20) continue;
    pad(g, x, y, (22+r()*22)*k, r()<.5 ? '#244b37' : '#1d3d2e');
    if (r() < .28){ g.strokeStyle = '#2c5a3c'; g.lineWidth = 2*k; g.beginPath(); g.moveTo(x, y); g.lineTo(x+4*k, y-34*k); g.stroke(); lotusFlower(g, x+4*k, y-30*k, .8*k); }
  }
  // deck
  const top = DECK.top;
  g.fillStyle = '#21140c'; g.beginPath(); g.moveTo(deckX(-40,top), top); g.lineTo(deckX(1120,top), top); g.lineTo(1120+8, H); g.lineTo(-48, H); g.closePath(); g.fill();
  const N = 15;
  for (let i=0;i<N;i++){
    const xa = -40 + 1160*i/N, xb = -40 + 1160*(i+1)/N, l = .8+r()*.35;
    g.fillStyle = vgrad(g, top, H, [[0,`rgb(${92*l|0},${60*l|0},${36*l|0})`],[1,`rgb(${60*l|0},${38*l|0},${22*l|0})`]]);
    g.beginPath(); g.moveTo(deckX(xa,top)+1, top); g.lineTo(deckX(xb,top)-1, top); g.lineTo(xb-2, H); g.lineTo(xa+2, H); g.closePath(); g.fill();
    for (let y = top + r()*200; y < H; y += 260+r()*300){ g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(deckX(xa,y), y, deckX(xb,y)-deckX(xa,y), 2); }
  }
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgrad(g, 540, 1000, 40, 700, [[0,'rgba(200,190,255,.16)'],[1,'rgba(200,190,255,0)']]); g.fillRect(0, 990, W, 930);
  g.restore();
  g.fillStyle = '#4a2e1a'; for (const d of [-1,1]){ g.beginPath(); g.moveTo(deckX(d<0?-40:1120,top), top); g.lineTo(d<0?-40:1120, H); g.lineTo(d<0?-40-14*d:1120-14*d, H); g.lineTo(deckX(d<0?-40:1120,top)-3*d, top); g.closePath(); g.fill(); }
  // posts (their lanterns glow in back())
  for (const y of LOTUS_POSTS) for (const d of [-1,1]){
    const k = .45+(y-990)/900, x = deckX(d<0?-40:1120, y) + d*-14*k;
    g.fillStyle = '#2a1a0e'; g.fillRect(x-7*k, y-170*k, 14*k, 170*k); g.fillStyle = '#5a3a20'; g.fillRect(x-7*k, y-170*k, 4*k, 170*k);
    g.fillStyle = '#1c120a'; g.fillRect(x-14*k, y-178*k, 28*k, 10*k);
  }
  altar(g, img.buddha, { stone:['#262a40','#3c4160','#6e7396'], table:['#3f120a','#6e1d10','#94301c','#d9a443'], cloth:false });
  vignette(g, .45);
}
const lanternAt = () => { const out = []; for (const y of LOTUS_POSTS) for (const d of [-1,1]){ const k = .45+(y-990)/900; out.push([deckX(d<0?-40:1120, y) - d*14*k, y-205*k, k]); } return out; };
function lotusBack(g, t, dt, a, st){
  st.lanterns ||= lanternAt();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i=0;i<26;i++){ const y = 972 + i*11, k = i/26, w = (40+k*170)*(.5+.5*Math.sin(t*2.1+i*1.7));
    g.globalAlpha = a*.35*(1-k); g.fillStyle = '#fff1c8'; g.fillRect(540-w/2 + Math.sin(t*1.3+i)*18, y, w, 2); }
  for (let i=0;i<14;i++){ const x = (i*317)%W, y = (i*211)%820; g.globalAlpha = a*Math.max(0, Math.sin(t*(.8+i%4*.3)+i*3))*.9; g.fillStyle = '#fffbe8'; ell(g, x, y, 2.2, 2.2); g.fill(); }
  // floating lotus lanterns (hoa đăng) in the side water
  for (let i=0;i<6;i++){ const side = i%2 ? 1 : -1, y = 1000 + (i>>1)*95 + Math.sin(t*.6+i)*4, edge = deckX(side<0?-40:1120, y);
    const x = side<0 ? edge*(.3+.4*((Math.sin(t*.05+i*2)+1)/2)) : edge + (W-edge)*(.3+.4*((Math.sin(t*.05+i*2)+1)/2)), k = .5+(y-990)/500;
    g.globalAlpha = a*.55; g.fillStyle = rgrad(g, x, y-8*k, 2, 50*k, [[0,'rgba(255,190,90,.9)'],[1,'rgba(255,150,60,0)']]); g.fillRect(x-50*k, y-58*k, 100*k, 100*k);
    g.globalAlpha = a; g.globalCompositeOperation = 'source-over'; lotusFlower(g, x, y, .9*k); g.globalCompositeOperation = 'lighter'; }
  for (const [x, y, k] of st.lanterns){
    const f = .8+.2*Math.sin(t*7+x)*Math.sin(t*11.3+y);
    g.globalAlpha = a*.5*f; g.fillStyle = rgrad(g, x, y, 4, 120*k, [[0,'rgba(255,170,80,.9)'],[1,'rgba(255,120,40,0)']]); g.fillRect(x-120*k, y-120*k, 240*k, 240*k);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = a;
    g.fillStyle = '#b8321c'; ell(g, x, y, 17*k, 22*k); g.fill(); g.fillStyle = '#ffcf7a'; ell(g, x, y, 9*k, 15*k); g.fill();
    g.fillStyle = '#2a1206'; g.fillRect(x-10*k, y-25*k, 20*k, 5*k); g.fillRect(x-10*k, y+20*k, 20*k, 5*k);
    g.globalCompositeOperation = 'lighter';
  }
  g.restore();
}
function fireflies(g, t, dt, a, st, n, area){
  st.ff ||= Array.from({ length:n }, (_, i) => ({ x:Math.random()*W, y:area[0]+Math.random()*(area[1]-area[0]), ph:Math.random()*TAU, sp:.5+Math.random() }));
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of st.ff){
    f.x += Math.cos(t*f.sp+f.ph)*22*dt; f.y += Math.sin(t*f.sp*.8+f.ph*2)*16*dt;
    if (f.x < -20) f.x = W+20; if (f.x > W+20) f.x = -20; f.y = Math.max(area[0], Math.min(area[1], f.y));
    const on = Math.max(0, Math.sin(t*f.sp*2+f.ph));
    g.globalAlpha = a*on*.9; g.fillStyle = rgrad(g, f.x, f.y, 0, 14, [[0,'rgba(220,255,150,.95)'],[1,'rgba(160,255,90,0)']]); g.fillRect(f.x-14, f.y-14, 28, 28);
  }
  g.restore();
}
const lotusFront = (g, t, dt, a, st) => fireflies(g, t, dt, a, st, 26, [900, 1880]);

/* ---------------- mountain top above the clouds, sunrise ---------------- */
function cloudBand(g, r, y, h, lit, body, shade){
  for (let x = -80; x < W+80; x += 30+r()*50){
    const rr = h*(.45+r()*.6), cy = y + r()*h*.35;
    g.fillStyle = vgrad(g, cy-rr, cy+rr, [[0,lit],[.45,body],[1,shade]]); ell(g, x, cy, rr*1.3, rr); g.fill();
  }
}
function pine(g, r){
  g.strokeStyle = '#2b1d16'; g.lineCap = 'round';
  g.lineWidth = 34; g.beginPath(); g.moveTo(1110, 1150); g.bezierCurveTo(1010, 1000, 1080, 760, 990, 560); g.stroke();
  g.lineWidth = 16;
  for (const [x0,y0,x1,y1] of [[1000,600,820,520],[1015,700,880,690],[995,560,930,400],[1040,850,920,860]]){ g.beginPath(); g.moveTo(x0,y0); g.quadraticCurveTo((x0+x1)/2, y1-30, x1, y1); g.stroke(); }
  // needle pads: a flat cloud of small tufts, dark underneath, lit by the sunrise on top
  for (const [x,y,w] of [[800,505,120],[880,670,100],[930,385,110],[1010,470,130],[900,840,100],[1050,640,90]]){
    for (let i=0;i<34;i++){ const u = (r()-.5)*2, top = i > 20;
      g.fillStyle = top ? (r()<.5 ? '#3d6a44' : '#4f7a4a') : (r()<.5 ? '#16301f' : '#1f3a2a');
      g.beginPath(); g.ellipse(x+u*w*.55, y+(top ? -w*.08 : 0)+(r()-.5)*w*.12*(1-Math.abs(u)), w*.16, w*.06, (r()-.5)*.5, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,190,120,.28)'; for (let i=0;i<5;i++){ ell(g, x-w*.3+r()*w*.4, y-w*.11, w*.1, w*.025); g.fill(); }
  }
}
function stoneLantern(g, x, y, k){
  g.fillStyle = 'rgba(0,0,0,.3)'; ell(g, x, y, 46*k, 12*k); g.fill();
  const part = (w, y0, y1, c) => { g.fillStyle = c; g.fillRect(x-w*k/2, y-y1*k, w*k, (y1-y0)*k); };
  part(60, 0, 20, '#8a7a68'); part(26, 20, 90, '#9a8a76'); part(56, 90, 104, '#8a7a68'); part(44, 104, 150, '#a89680');
  g.fillStyle = '#3a2a1e'; g.fillRect(x-12*k, y-142*k, 24*k, 30*k);
  g.fillStyle = '#7c6c5a'; g.beginPath(); g.moveTo(x-50*k, y-150*k); g.lineTo(x+50*k, y-150*k); g.lineTo(x+18*k, y-182*k); g.lineTo(x-18*k, y-182*k); g.closePath(); g.fill();
  g.fillStyle = '#8a7a68'; ell(g, x, y-190*k, 9*k, 9*k); g.fill();
}
const PEAK_LANTERNS = [[80,1330,.95],[1000,1330,.95]];
function paintPeak(g, img){
  const r = rng(4242);
  g.fillStyle = vgrad(g, 0, 1040, [[0,'#1b2156'],[.28,'#4a3a7e'],[.52,'#a5588c'],[.72,'#ee8a60'],[.86,'#ffcf8a'],[1,'#ffe9c2']]); g.fillRect(0, 0, W, 1040);
  for (let i=0;i<60;i++){ const y = r()*300; g.fillStyle = `rgba(255,255,255,${.2+r()*.5})`; ell(g, r()*W, y, .8, .8); g.fill(); }
  g.fillStyle = rgrad(g, 540, 650, 80, 680, [[0,'rgba(255,236,170,.9)'],[.3,'rgba(255,190,110,.35)'],[1,'rgba(255,150,90,0)']]); g.fillRect(0, 0, W, 1100);
  g.fillStyle = rgrad(g, 540, 650, 10, 105, [[0,'#fffbec'],[.8,'#fff0c4'],[1,'#ffd98a']]); ell(g, 540, 650, 100, 100); g.fill();
  g.fillStyle = 'rgba(255,200,170,.3)'; for (const [x,y,w] of [[220,420,240],[860,360,200],[640,470,180],[300,560,160]]){ ell(g, x, y, w, 12); g.fill(); }
  // peaks poking through the clouds
  for (const [x, w, h, c] of [[140,260,240,'#6d5590'],[380,200,170,'#7b5c96'],[760,300,260,'#6a5290'],[980,220,200,'#735896']]){
    g.fillStyle = c; g.beginPath(); g.moveTo(x-w, 900); let px = x-w;
    while (px < x){ px += 20+r()*30; g.lineTo(Math.min(px, x), 900-h*(1-(x-px)/w)+(r()-.5)*24); }
    while (px < x+w){ px += 20+r()*30; g.lineTo(Math.min(px, x+w), 900-h*(1-(px-x)/w)+(r()-.5)*24); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,190,140,.25)'; g.beginPath(); g.moveTo(x, 900-h); g.lineTo(x+w*.45, 900-h*.55); g.lineTo(x+w*.1, 900); g.closePath(); g.fill();
  }
  // sea of clouds
  cloudBand(g, r, 860, 50, '#ffe2c0', '#e9b7b6', '#a58fbd');
  cloudBand(g, r, 915, 70, '#ffd9b4', '#e0a9b0', '#9a83b4');
  cloudBand(g, r, 980, 90, '#ffe6c8', '#e6b4b4', '#a88fba');
  // terrace
  const top = 1030, vy = 300;
  const lx = (xb, y) => 540 + (xb-540)*((y-vy)/(H-vy));
  const rows = [top]; for (let i=1;i<=9;i++) rows.push(top + (H-top)*Math.pow(i/9, 1.5));
  for (let i=0;i<9;i++) for (let j=-4;j<4;j++){
    const y0 = rows[i], y1 = rows[i+1], xa = 540+j*200, xb = 540+(j+1)*200, l = .88+r()*.18;
    g.fillStyle = vgrad(g, y0, y1, [[0,`rgb(${196*l|0},${172*l|0},${148*l|0})`],[1,`rgb(${170*l|0},${146*l|0},${124*l|0})`]]);
    g.beginPath(); g.moveTo(lx(xa,y0)+1, y0+1); g.lineTo(lx(xb,y0)-1, y0+1); g.lineTo(lx(xb,y1)-1, y1-1); g.lineTo(lx(xa,y1)+1, y1-1); g.closePath(); g.fill();
  }
  g.fillStyle = vgrad(g, top, H, [[0,'rgba(80,50,40,0)'],[1,'rgba(40,24,30,.55)']]); g.fillRect(0, top, W, H-top);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgrad(g, 540, 1040, 20, 760, [[0,'rgba(255,190,120,.35)'],[1,'rgba(255,160,100,0)']]); g.fillRect(0, top, W, H-top);
  g.restore();
  // balustrade along the back edge of the terrace
  g.fillStyle = '#8f7a6a'; g.fillRect(0, 1004, W, 9); g.fillStyle = '#6e5a4e'; g.fillRect(0, 1013, W, 4);
  for (let x = 12; x < W; x += 46){ g.fillStyle = '#7d6a5c'; g.fillRect(x, 1013, 12, 20); g.fillStyle = '#a28d7a'; g.fillRect(x, 1013, 3, 20); }
  g.fillStyle = '#6a574a'; g.fillRect(0, 1030, W, 4);
  pine(g, r);
  for (const [x, y, k] of PEAK_LANTERNS) stoneLantern(g, x, y, k);
  altar(g, img.buddha, { stone:['#6e5a52','#9c8676','#d6bfa4'], table:['#5b4a42','#86705f','#bca48c','#e2b04f'], cloth:true });
  vignette(g, .3);
}
function peakBack(g, t, dt, a, st){
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i=0;i<10;i++){ const ang = -Math.PI/2 + (i-4.5)*.3 + Math.sin(t*.08+i)*.04;
    g.globalAlpha = a*(.03+.02*Math.sin(t*.4+i*1.7)); g.fillStyle = '#ffe4b0';
    g.beginPath(); g.moveTo(540, 650); g.lineTo(540+Math.cos(ang-.05)*1200, 650+Math.sin(ang-.05)*1200); g.lineTo(540+Math.cos(ang+.05)*1200, 650+Math.sin(ang+.05)*1200); g.closePath(); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // slow cloud wisps over the peaks
  for (let i=0;i<5;i++){ const x = ((t*(6+i*2) + i*260) % (W+500)) - 250, y = 720 + i*28;
    g.globalAlpha = a*.35; g.fillStyle = rgrad(g, x, y, 5, 160, [[0,'rgba(255,228,214,.9)'],[1,'rgba(255,228,214,0)']]); g.save(); g.translate(x, y); g.scale(1, .22); ell(g, 0, 0, 160, 160); g.fill(); g.restore(); }
  // a small flock every so often
  const c = (t % 45) / 45;
  if (c < .55){ const k = c/.55, bx = -80 + k*(W+160), by = 470 - k*140;
    g.globalAlpha = a*.8; g.strokeStyle = '#3a2440'; g.lineWidth = 2.4;
    for (const [dx,dy] of [[0,0],[-26,14],[-48,26],[-22,-14],[-44,-24]]){ const f = Math.sin(t*9+dx)*5, x = bx+dx, y = by+dy;
      g.beginPath(); g.moveTo(x-9, y-f); g.quadraticCurveTo(x-4, y-4, x, y); g.quadraticCurveTo(x+4, y-4, x+9, y-f); g.stroke(); } }
  // stone lantern flames
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, k] of PEAK_LANTERNS){ const f = .8+.2*Math.sin(t*8+x)*Math.sin(t*12.7);
    g.globalAlpha = a*.6*f; g.fillStyle = rgrad(g, x, y-128*k, 2, 70*k, [[0,'rgba(255,200,110,1)'],[1,'rgba(255,140,60,0)']]); g.fillRect(x-70*k, y-198*k, 140*k, 140*k); }
  g.restore();
}
function peakFront(g, t, dt, a, st){
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i=0;i<22;i++){ const y = 1900 - ((t*(14+i%5*5) + i*137) % 1100), x = (i*211 % W) + Math.sin(t*.6+i)*30;
    g.globalAlpha = a*(.25+.3*Math.sin(t*1.3+i))*Math.min(1, (1900-y)/200); g.fillStyle = '#ffd98a'; ell(g, x, y, 2.6, 2.6); g.fill(); }
  g.restore();
}

/* ---------------- helpers shared by the scenes below ---------------- */
// Branching tree: each limb is a tapered, slightly bent polygon; tip(x, y, angle) is called at the ends for leaves or flowers.
function tree(g, r, x, y, ang, len, w, depth, col, tip){
  const x1 = x + Math.cos(ang)*len, y1 = y + Math.sin(ang)*len, nx = -Math.sin(ang), ny = Math.cos(ang), w1 = w*.66;
  const bend = (r()-.5)*len*.3, mx = (x+x1)/2 + nx*bend, my = (y+y1)/2 + ny*bend;
  g.fillStyle = col; g.beginPath();
  g.moveTo(x+nx*w/2, y+ny*w/2); g.quadraticCurveTo(mx+nx*(w+w1)/4, my+ny*(w+w1)/4, x1+nx*w1/2, y1+ny*w1/2);
  g.lineTo(x1-nx*w1/2, y1-ny*w1/2); g.quadraticCurveTo(mx-nx*(w+w1)/4, my-ny*(w+w1)/4, x-nx*w/2, y-ny*w/2); g.closePath(); g.fill();
  if (depth <= 0){ tip(x1, y1, ang); return; }
  const n = r() < .3 ? 3 : 2;
  for (let i=0;i<n;i++) tree(g, r, x1, y1, ang + (i-(n-1)/2)*(.45+r()*.4) + (r()-.5)*.3, len*(.66+r()*.2), w1, depth-1, col, tip);
  if (depth < 3 && r() < .6) tip(x1, y1, ang);
}
// paving in perspective: columns converge on (540, vy), rows get deeper towards the bottom; c0/c1 = rgb at the back/front
function paving(g, r, top, vy, colW, nRows, c0, c1, joint){
  const lx = (xb, y) => 540 + (xb-540)*((y-vy)/(H-vy));
  const rows = [top]; for (let i=1;i<=nRows;i++) rows.push(top + (H-top)*Math.pow(i/nRows, 1.5));
  const n = Math.ceil(700/colW);
  g.fillStyle = joint; g.fillRect(0, top, W, H-top);
  for (let i=0;i<nRows;i++) for (let j=-n;j<n;j++){
    const y0 = rows[i], y1 = rows[i+1], off = i%2 ? colW/2 : 0, xa = 540+j*colW+off, xb = xa+colW, l = .9+r()*.16, k = i/nRows;
    const c = c0.map((v,m) => (v + (c1[m]-v)*k)*l | 0);
    g.fillStyle = `rgb(${c})`;
    g.beginPath(); g.moveTo(lx(xa,y0)+1.5, y0+1.5); g.lineTo(lx(xb,y0)-1.5, y0+1.5); g.lineTo(lx(xb,y1)-1.5, y1-1.5); g.lineTo(lx(xa,y1)+1.5, y1-1.5); g.closePath(); g.fill();
  }
}
// pagoda roof: ridge at y, eaves w wide and h below, corners curling up
function roof(g, cx, y, w, h, tile, snow){
  const hw = w/2, path = (dy) => { g.beginPath(); g.moveTo(cx-hw*.5, y); g.lineTo(cx+hw*.5, y);
    g.quadraticCurveTo(cx+hw*.78, y+h*.85, cx+hw+26, y+h-26+dy); g.quadraticCurveTo(cx+hw-6, y+h-4, cx+hw-22, y+h);
    g.lineTo(cx-hw+22, y+h); g.quadraticCurveTo(cx-hw+6, y+h-4, cx-hw-26, y+h-26+dy); g.quadraticCurveTo(cx-hw*.78, y+h*.85, cx-hw*.5, y); g.closePath(); };
  g.fillStyle = tile; path(0); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  for (let i=1;i<14;i++){ const u = i/14-.5; g.beginPath(); g.moveTo(cx+u*hw*1.0, y+3); g.lineTo(cx+u*(w-40), y+h-4); g.stroke(); }
  g.fillStyle = '#1a1a24'; g.fillRect(cx-hw*.52, y-9, hw*1.04, 11);
  if (snow){ g.save(); path(0); g.clip(); g.fillStyle = vgrad(g, y, y+h, [[0,'#f4f7ff'],[.55,'#dfe7f7'],[.56,'rgba(220,230,250,0)']]); g.fillRect(cx-hw-40, y-12, w+80, h+12); g.restore();
    g.fillStyle = '#f4f7ff'; g.fillRect(cx-hw*.53, y-15, hw*1.06, 8); }
}
function falling(st, key, n, make){ const a = st[key] ||= []; while (a.length < n) a.push(make(true)); return a; }

/* ---------------- bodhi tree at sunset ---------------- */
function bodhiLeaf(g, x, y, s, ang){
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-13, -2, -13, 15, 0, 30); g.bezierCurveTo(13, 15, 13, -2, 0, 0); g.fill(); g.restore();
}
function paintBodhi(g, img){
  const r = rng(808);
  g.fillStyle = vgrad(g, 0, 1010, [[0,'#2e2450'],[.35,'#93507a'],[.62,'#ee8758'],[.82,'#ffc46e'],[1,'#ffe6ac']]); g.fillRect(0, 0, W, 1010);
  g.fillStyle = rgrad(g, 540, 930, 40, 700, [[0,'rgba(255,240,190,.95)'],[.25,'rgba(255,200,120,.45)'],[1,'rgba(255,150,90,0)']]); g.fillRect(0, 0, W, 1100);
  ridge(g, r, 920, 22, '#8a4f68', 30);
  for (const [x, k] of [[180,1],[905,.8]]){                                     // far stupas on the plain
    g.fillStyle = '#6e3c56'; ell(g, x, 905-26*k, 26*k, 22*k); g.fill(); g.fillRect(x-30*k, 900-8*k, 60*k, 12*k);
    g.beginPath(); g.moveTo(x-5*k, 880-30*k); g.lineTo(x, 880-78*k); g.lineTo(x+5*k, 880-30*k); g.fill(); }
  ridge(g, r, 965, 14, '#5e3450', 24);
  // meadow
  g.fillStyle = vgrad(g, 990, H, [[0,'#a88a3e'],[.25,'#6e6a2c'],[1,'#2a2a12']]); g.fillRect(0, 990, W, H-990);
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgrad(g, 540, 1000, 10, 700, [[0,'rgba(255,200,110,.45)'],[1,'rgba(255,170,80,0)']]); g.fillRect(0, 990, W, 930); g.restore();
  g.save(); g.scale(1, .7); g.fillStyle = rgrad(g, 540, 1520/.7, 60, 560, [[0,'rgba(110,78,40,.5)'],[1,'rgba(110,78,40,0)']]); g.fillRect(0, 1000/.7, W, 920/.7); g.restore();   // trodden earth where people sit
  for (let i=0;i<500;i++){ const y = 1000+r()*920, s = .4+(y-1000)/700, x = r()*W;
    g.strokeStyle = r()<.5 ? 'rgba(200,170,80,.5)' : 'rgba(60,70,24,.6)'; g.lineWidth = 1.5*s;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+(r()-.5)*8*s, y-8*s, x+(r()-.5)*10*s, y-(10+r()*14)*s); g.stroke(); }
  // the tree: trunk and roots behind the statue, canopy over the whole top
  const bark = vgrad(g, 300, 1040, [[0,'#2b1a12'],[1,'#3d2618']]);
  g.fillStyle = bark; g.beginPath(); g.moveTo(300, 1040); g.bezierCurveTo(430, 980, 450, 760, 470, 430); g.lineTo(610, 430); g.bezierCurveTo(630, 760, 650, 980, 780, 1040); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,170,90,.25)'; g.beginPath(); g.moveTo(735, 1030); g.bezierCurveTo(630, 960, 615, 760, 604, 430); g.lineTo(612, 430); g.bezierCurveTo(628, 760, 650, 970, 770, 1036); g.fill();
  const leaves = [];
  for (const [x, y, a, len, w] of [[540,450,-1.57,150,120],[520,470,-2.5,230,70],[560,470,-.64,230,70],[500,520,-2.95,260,52],[580,520,-.2,260,52]])
    tree(g, r, x, y, a, len, w, 4, '#2e1d14', (tx, ty) => leaves.push([tx, ty]));
  for (const [x, y] of leaves) for (let i=0;i<26;i++){
    const lx = x+(r()-.5)*150, ly = y+(r()-.5)*90, rim = ly > 380 && r() < .4;
    g.fillStyle = rim ? (r()<.5 ? '#b69032' : '#8c8a2c') : ['#1c3418','#24421e','#2f5424','#1f3a1a'][i%4];
    bodhiLeaf(g, lx, ly, .9+r()*.7, (r()-.5)*1.4);
  }
  altar(g, img.buddha, { stone:['#5a4438','#8a6c58','#c8a68a'], table:['#4a3428','#6e5040','#a07c62','#e2b04f'], cloth:true });
  vignette(g, .35);
}
function bodhiFront(g, t, dt, a, st){
  const fall = falling(st, 'l', 7, first => ({ x:Math.random()*W, y:first ? Math.random()*H : -40, vy:40+Math.random()*30, ph:Math.random()*TAU, s:.8+Math.random()*.5 }));
  g.save(); g.globalAlpha = a;
  fall.forEach((l, i) => { l.y += l.vy*dt; l.x += Math.sin(t*1.2+l.ph)*30*dt; if (l.y > H+40) fall[i] = { ...l, y:-40, x:Math.random()*W };
    g.fillStyle = i%2 ? '#c9a23a' : '#7d8a2e'; bodhiLeaf(g, l.x, l.y, l.s, Math.sin(t*2+l.ph)*.9); });
  g.globalCompositeOperation = 'lighter';
  for (let i=0;i<16;i++){ const x = (i*197 + t*10) % W, y = 700 + (i*263 % 1000) + Math.sin(t*.8+i)*24;
    g.globalAlpha = a*(.25+.25*Math.sin(t*1.5+i)); g.fillStyle = '#ffe2a0'; ell(g, x, y, 2.4, 2.4); g.fill(); }
  g.restore();
}

/* ---------------- snowy temple courtyard at dusk ---------------- */
function snowPine(g, r, x, y, h){
  g.fillStyle = '#3a2a20'; g.fillRect(x-6, y-h*.2, 12, h*.2);
  for (let i=0;i<5;i++){ const k = i/5, w = h*(.3-k*.05), ty = y-h*.15-k*h*.8, tier = h*.3;
    g.fillStyle = '#16302a'; g.beginPath(); g.moveTo(x, ty-tier); g.lineTo(x+w, ty); g.lineTo(x-w, ty); g.closePath(); g.fill();
    g.fillStyle = '#eef3ff'; g.beginPath(); g.moveTo(x, ty-tier); g.lineTo(x+w*.55, ty-tier*.45); g.quadraticCurveTo(x, ty-tier*.3, x-w*.6, ty-tier*.4); g.closePath(); g.fill(); }
}
const SNOW_WINDOWS = [[300,880],[390,880],[690,880],[780,880]];
function paintSnow(g, img){
  const r = rng(1225);
  g.fillStyle = vgrad(g, 0, 1000, [[0,'#0b1430'],[.55,'#22325e'],[1,'#56648e']]); g.fillRect(0, 0, W, 1000);
  for (let i=0;i<120;i++){ g.fillStyle = `rgba(255,255,255,${.2+r()*.5})`; ell(g, r()*W, r()*600, .9, .9); g.fill(); }
  ridge(g, r, 760, 60, '#3e4c78', 34);
  g.fillStyle = 'rgba(235,242,255,.5)'; for (let i=0;i<40;i++){ ell(g, r()*W, 720+r()*60, 30+r()*50, 6); g.fill(); }
  ridge(g, r, 830, 30, '#2c385e', 26);
  // temple hall behind the statue
  g.fillStyle = '#3a1410'; g.fillRect(200, 800, 680, 210);
  for (const x of [215, 340, 460, 620, 740, 865]){ g.fillStyle = '#7a1e14'; g.fillRect(x-12, 800, 24, 210); g.fillStyle = '#a3321e'; g.fillRect(x-12, 800, 6, 210); }
  for (const [x, y] of SNOW_WINDOWS){ g.fillStyle = '#ffb766'; g.fillRect(x-40, y-50, 80, 100);
    g.strokeStyle = '#5a1e10'; g.lineWidth = 4; for (let i=1;i<4;i++){ g.beginPath(); g.moveTo(x-40+i*20, y-50); g.lineTo(x-40+i*20, y+50); g.stroke(); g.beginPath(); g.moveTo(x-40, y-50+i*25); g.lineTo(x+40, y-50+i*25); g.stroke(); } }
  roof(g, 540, 735, 880, 80, '#262636', true);
  g.fillStyle = '#3a1410'; g.fillRect(330, 650, 420, 90);
  roof(g, 540, 600, 560, 70, '#262636', true);
  // pines on both sides
  for (const [x, y, h] of [[40,1080,560],[150,1030,380],[1040,1080,560],[930,1030,380]]) snowPine(g, r, x, y, h);
  // snowy courtyard, path swept clear
  g.fillStyle = vgrad(g, 1000, H, [[0,'#cfd9ee'],[.5,'#b5c2de'],[1,'#8592b4']]); g.fillRect(0, 1000, W, H-1000);
  for (let i=0;i<260;i++){ const y = 1000+r()*920, s = .4+(y-1000)/700; g.fillStyle = r()<.5 ? 'rgba(255,255,255,.16)' : 'rgba(110,125,170,.08)'; ell(g, r()*W, y, (30+r()*80)*s, (5+r()*9)*s); g.fill(); }
  g.fillStyle = vgrad(g, 1190, H, [[0,'rgba(127,138,166,.55)'],[1,'rgba(90,101,132,.7)']]);
  g.beginPath(); g.moveTo(500, 1190); g.lineTo(580, 1190); g.lineTo(680, H); g.lineTo(400, H); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; for (let y=1200; y<H; y += 40+(y-1190)*.08){ const k = (y-1190)/730; g.fillRect(500-k*100, y, 80+k*200, 2+k*2); }
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgrad(g, 540, 960, 30, 520, [[0,'rgba(255,170,90,.35)'],[1,'rgba(255,150,80,0)']]); g.fillRect(0, 700, W, 800); g.restore();
  for (const [x, y, k] of PEAK_LANTERNS){ stoneLantern(g, x, y, k); g.fillStyle = '#f4f7ff'; g.beginPath(); g.moveTo(x-50*k, y-150*k); g.quadraticCurveTo(x, y-200*k, x+50*k, y-150*k); g.fill(); }
  altar(g, img.buddha, { stone:['#4a5068','#747a94','#c4cadc'], table:['#3f120a','#6e1d10','#94301c','#d9a443'], cloth:false });
  g.fillStyle = '#f4f7ff'; g.fillRect(405, 897, 270, 5); g.fillRect(420, 781, 240, 5);                     // snow on the plinth
  vignette(g, .4);
}
function snowBack(g, t, dt, a, st){
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x, y] of SNOW_WINDOWS){ g.globalAlpha = a*(.35+.1*Math.sin(t*5+x)*Math.sin(t*7.3)); g.fillStyle = rgrad(g, x, y, 10, 110, [[0,'rgba(255,180,90,.8)'],[1,'rgba(255,140,60,0)']]); g.fillRect(x-110, y-110, 220, 220); }
  for (const [x, y, k] of PEAK_LANTERNS){ g.globalAlpha = a*.6*(.85+.15*Math.sin(t*8+x)); g.fillStyle = rgrad(g, x, y-128*k, 2, 80*k, [[0,'rgba(255,200,110,1)'],[1,'rgba(255,140,60,0)']]); g.fillRect(x-80*k, y-208*k, 160*k, 160*k); }
  g.restore();
}
function snowFront(g, t, dt, a, st){
  const flakes = falling(st, 'f', 140, first => { const z = Math.random(); return { x:Math.random()*W, y:first ? Math.random()*H : -10, z, ph:Math.random()*TAU }; });
  g.save(); g.fillStyle = '#ffffff';
  for (const f of flakes){ f.y += (40+f.z*110)*dt; f.x += (Math.sin(t*.9+f.ph)*20 + 12)*dt*(.5+f.z);
    if (f.y > H+10){ f.y = -10; f.x = Math.random()*W; } if (f.x > W+10) f.x = -10;
    g.globalAlpha = a*(.45+.5*f.z); ell(g, f.x, f.y, 1.4+f.z*3.4, 1.4+f.z*3.4); g.fill(); }
  g.restore();
}

/* ---------------- waterfall in the mountains ---------------- */
function cliff(g, r, pts, c){
  g.fillStyle = vgrad(g, 0, 1100, [[0,c[0]],[1,c[1]]]); g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,26,24,.35)'; g.lineWidth = 3;
  const xs = pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  for (let i=0;i<26;i++){ const x = x0+r()*(x1-x0), y = 150+r()*850; g.beginPath(); g.moveTo(x, y); g.lineTo(x+(r()-.5)*40, y+30+r()*70); g.stroke(); }
  for (let i=0;i<26;i++){ const x = x0+r()*(x1-x0), y = 120+r()*900; for (let j=0;j<9;j++){ g.fillStyle = r()<.5 ? 'rgba(62,112,52,.55)' : 'rgba(96,146,66,.5)'; ell(g, x+(r()-.5)*50, y+(r()-.5)*24, 5+r()*12, 3+r()*6); g.fill(); } }
}
const FALL = { x0:440, x1:640, top:170, bot:930 };
function paintFall(g, img){
  const r = rng(3131);
  g.fillStyle = vgrad(g, 0, 700, [[0,'#7fbfe8'],[1,'#e2f2fa']]); g.fillRect(0, 0, W, 1000);
  ridge(g, r, 420, 50, '#9db8c8', 30);
  // the falls between two cliffs, pool at the foot
  g.fillStyle = vgrad(g, FALL.top, FALL.bot, [[0,'#dff3fb'],[1,'#ffffff']]);
  g.beginPath(); g.moveTo(FALL.x0+30, FALL.top); g.lineTo(FALL.x1-30, FALL.top); g.lineTo(FALL.x1+20, FALL.bot); g.lineTo(FALL.x0-20, FALL.bot); g.closePath(); g.fill();
  for (let i=0;i<70;i++){ const x = FALL.x0+r()*(FALL.x1-FALL.x0); g.fillStyle = `rgba(120,170,200,${.15+r()*.25})`; g.fillRect(x, FALL.top+r()*500, 2+r()*3, 60+r()*200); }
  cliff(g, r, [[-20,140],[180,90],[330,150],[455,160],[430,520],[420,960],[-20,1060]], ['#6e7a70','#3f4a44']);
  cliff(g, r, [[1100,120],[900,80],[760,140],[625,170],[650,520],[660,960],[1100,1060]], ['#6a766c','#3b4640']);
  for (const [x, y, s] of [[150,95,1],[300,140,.8],[860,90,1],[980,130,.9]]) tree(g, r, x, y, -1.57, 50*s, 12*s, 3, '#3a2a1e', (tx, ty) => { g.fillStyle = '#2f6a34'; ell(g, tx, ty, 26*s, 18*s); g.fill(); g.fillStyle = '#4f8f44'; ell(g, tx-6*s, ty-6*s, 14*s, 9*s); g.fill(); });
  g.fillStyle = vgrad(g, 900, 1040, [[0,'#5fa7b4'],[1,'#2f6f7e']]); g.beginPath(); g.ellipse(540, 960, 400, 70, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)'; for (let i=0;i<40;i++){ ell(g, FALL.x0-20+r()*(FALL.x1-FALL.x0+40), 925+r()*30, 14+r()*26, 6+r()*8); g.fill(); }
  // rocky riverbank
  g.fillStyle = vgrad(g, 1000, H, [[0,'#8a8a78'],[.4,'#6b6a58'],[1,'#3a3a2e']]); g.beginPath(); g.moveTo(0, 1030); g.quadraticCurveTo(540, 990, W, 1030); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  for (let i=0;i<380;i++){ const y = 1010+r()*910, s = .35+(y-1000)/650, l = .7+r()*.5;
    g.fillStyle = `rgb(${150*l|0},${146*l|0},${128*l|0})`; ell(g, r()*W, y, (8+r()*26)*s, (4+r()*10)*s); g.fill(); }
  for (let i=0;i<70;i++){ const y = 1020+r()*900, s = .5+(y-1000)/700, x = r()<.5 ? r()*230 : W-r()*230;
    g.strokeStyle = r()<.5 ? '#4f8a3e' : '#3a6e30'; g.lineWidth = 2*s;
    for (let j=0;j<6;j++){ const a = -Math.PI/2 + (j-2.5)*.35; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+Math.cos(a)*20*s, y+Math.sin(a)*30*s, x+Math.cos(a)*36*s, y+Math.sin(a)*34*s+10*s); g.stroke(); } }
  // flat stone where the altar stands
  g.fillStyle = '#5e5d50'; ell(g, 540, 1120, 380, 95); g.fill(); g.fillStyle = vgrad(g, 1020, 1200, [[0,'#a8a690'],[1,'#8a8874']]); ell(g, 540, 1108, 372, 86); g.fill();
  altar(g, img.buddha, { stone:['#55574c','#86887a','#c2c4b2'], table:['#4f5046','#7a7c6c','#aeb09c','#d2b46a'], cloth:true });
  vignette(g, .3);
}
function fallBack(g, t, dt, a, st){
  g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,.55)';
  for (let i=0;i<34;i++){ const x = FALL.x0 + ((i*53) % (FALL.x1-FALL.x0)), len = 80+(i*37 % 120), y = FALL.top + ((t*(380+(i%5)*40) + i*97) % (FALL.bot-FALL.top+len)) - len;
    const k = (Math.min(FALL.bot, Math.max(FALL.top, y)) - FALL.top)/(FALL.bot-FALL.top), xx = x + (x-540)*k*.25;
    g.fillRect(xx, Math.max(FALL.top, y), 3, Math.min(len, FALL.bot-Math.max(FALL.top, y))); }
  for (let i=0;i<9;i++){ const x = FALL.x0-60 + ((i*41 + t*14*(i%2?1:-1)) % 320 + 320) % 320, y = 900 - ((t*12 + i*30) % 90);
    g.globalAlpha = a*.5*(1-(900-y)/90); g.fillStyle = rgrad(g, x, y, 4, 60, [[0,'rgba(255,255,255,.9)'],[1,'rgba(255,255,255,0)']]); g.fillRect(x-60, y-60, 120, 120); }
  g.restore();
}
function fallFront(g, t, dt, a, st){
  g.save(); g.globalAlpha = a;
  for (let i=0;i<3;i++){ const x = 540 + Math.sin(t*.23+i*2.1)*420 + Math.sin(t*1.1+i)*40, y = 1250 + Math.sin(t*.31+i*1.7)*260, f = Math.abs(Math.sin(t*14+i));
    g.fillStyle = ['#ffd54a','#8fd0ff','#ffffff'][i];
    for (const d of [-1,1]){ g.beginPath(); g.ellipse(x+d*7*f, y, 8*f+1, 6, d*.4, 0, TAU); g.fill(); } g.fillStyle = '#2a2a2a'; g.fillRect(x-1, y-5, 2, 10); }
  g.restore();
}

/* ---------------- spring courtyard with yellow apricot blossom (mai vàng) ---------------- */
function blossom(g, x, y, s, rot){
  g.fillStyle = '#ffd23a'; for (let i=0;i<5;i++){ const a = rot + i*TAU/5; ell(g, x+Math.cos(a)*s*.55, y+Math.sin(a)*s*.55, s*.5, s*.5); g.fill(); }
  g.fillStyle = '#e8801a'; ell(g, x, y, s*.26, s*.26); g.fill();
}
const SPRING_LANTERNS = [[110,430],[250,500],[830,500],[970,430]];
function paintSpring(g, img){
  const r = rng(2026);
  g.fillStyle = vgrad(g, 0, 950, [[0,'#86c2e8'],[.6,'#cfe8f2'],[1,'#fdf3da']]); g.fillRect(0, 0, W, 1000);
  g.fillStyle = 'rgba(255,255,255,.8)'; for (const [x,y,w] of [[260,360,140],[820,300,170],[560,420,110]]) for (let i=0;i<6;i++){ ell(g, x+(i-2.5)*w*.3, y+(i%2)*8, w*.35, w*.18); g.fill(); }
  ridge(g, r, 820, 40, '#9cc08a', 30); ridge(g, r, 880, 26, '#7ea86c', 26);
  // temple wall with a tiled cap behind the altar
  g.fillStyle = vgrad(g, 900, 1010, [[0,'#efe2c4'],[1,'#d8c6a0']]); g.fillRect(0, 905, W, 105);
  g.fillStyle = '#9a3a22'; g.fillRect(0, 888, W, 22); g.fillStyle = '#7a2a16'; for (let x=0;x<W;x+=18) g.fillRect(x, 888, 3, 22);
  for (let x=60;x<W;x+=160){ g.fillStyle = 'rgba(120,80,40,.35)'; g.fillRect(x, 935, 50, 50); g.strokeStyle = '#b08850'; g.lineWidth = 3; g.beginPath(); g.arc(x+25, 960, 16, 0, TAU); g.stroke(); }
  // brick courtyard (gạch Bát Tràng)
  paving(g, r, 1010, 260, 120, 12, [196,104,70], [150,70,46], '#7a3a24');
  g.fillStyle = vgrad(g, 1010, H, [[0,'rgba(255,230,180,.15)'],[1,'rgba(40,10,0,.35)']]); g.fillRect(0, 1010, W, H-1010);
  // potted chrysanthemums along the front sides
  for (const [x, y, k] of [[70,1560,1],[1010,1560,1],[150,1280,.75],[930,1280,.75]]){
    g.fillStyle = '#2f6a30'; ell(g, x, y-110*k, 70*k, 46*k); g.fill();
    for (let i=0;i<22;i++){ const a = r()*TAU, d = r()*60*k; g.fillStyle = r()<.5 ? '#ffc21a' : '#ffdb4d'; ell(g, x+Math.cos(a)*d, y-110*k+Math.sin(a)*d*.6-10*k, 10*k, 10*k); g.fill(); }
    g.fillStyle = vgrad(g, y-70*k, y, [[0,'#3a5fa0'],[1,'#22386a']]); g.beginPath(); g.moveTo(x-48*k, y-70*k); g.lineTo(x+48*k, y-70*k); g.lineTo(x+34*k, y); g.lineTo(x-34*k, y); g.closePath(); g.fill();
    g.fillStyle = '#e8eef8'; g.fillRect(x-44*k, y-58*k, 88*k, 8*k);
  }
  // two apricot trees framing the top
  const flowers = [];
  tree(g, r, -10, 1100, -1.2, 330, 46, 5, '#3a2416', (x, y) => flowers.push([x, y]));
  tree(g, r, 1090, 1100, -1.94, 330, 46, 5, '#3a2416', (x, y) => flowers.push([x, y]));
  for (const [x, y] of flowers){ if (y > 1000) continue; for (let i=0;i<7;i++){ const bx = x+(r()-.5)*70, by = y+(r()-.5)*50;
    if (r() < .2){ g.fillStyle = '#6a8a2a'; ell(g, bx, by, 4, 6); g.fill(); } else blossom(g, bx, by, 7+r()*5, r()*TAU); } }
  altar(g, img.buddha, { stone:['#7a6a58','#a89480','#e0ceb4'], table:['#5a160c','#8a2414','#b0381e','#e2b04f'], cloth:false });
  vignette(g, .25);
}
function springBack(g, t, dt, a, st){
  g.save(); g.globalAlpha = a;
  SPRING_LANTERNS.forEach(([x, y], i) => {
    const sw = Math.sin(t*1.1+i*1.3)*.06; g.save(); g.translate(x, y-70); g.rotate(sw);
    g.strokeStyle = '#3a2416'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 40); g.stroke();
    g.fillStyle = '#d4261a'; ell(g, 0, 80, 32, 40); g.fill(); g.fillStyle = 'rgba(255,200,120,.35)'; ell(g, -8, 74, 12, 30); g.fill();
    g.fillStyle = '#e2b04f'; g.fillRect(-18, 38, 36, 6); g.fillRect(-18, 116, 36, 6);
    g.strokeStyle = '#d4261a'; g.lineWidth = 3; for (let j=-2;j<=2;j++){ g.beginPath(); g.moveTo(j*4, 122); g.lineTo(j*5, 150+Math.sin(t*2+j)*2); g.stroke(); }
    g.restore(); });
  g.restore();
}
function springFront(g, t, dt, a, st){
  const fall = falling(st, 'p', 14, first => ({ x:Math.random()*W, y:first ? Math.random()*H : -20, vy:45+Math.random()*35, ph:Math.random()*TAU, s:5+Math.random()*4 }));
  g.save(); g.globalAlpha = a;
  fall.forEach((p, i) => { p.y += p.vy*dt; p.x += (Math.sin(t*1.3+p.ph)*35 + 10)*dt; if (p.y > H+20){ p.y = -20; p.x = Math.random()*W; }
    if (i%3) { g.fillStyle = '#ffd23a'; g.save(); g.translate(p.x, p.y); g.rotate(t*2+p.ph); ell(g, 0, 0, p.s*.6, p.s*.35); g.fill(); g.restore(); }
    else blossom(g, p.x, p.y, p.s, t+p.ph); });
  g.restore();
}

/* ---------------- shared live bits ---------------- */
// candle flames on the painted altars (the hall painting has its own)
function flames(g, t, a){
  g.save();
  for (const x of [475, 605]){ const f = Math.sin(t*13+x)*Math.sin(t*7.7);
    g.globalAlpha = a; g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgrad(g, x, 930, 1, 40, [[0,'rgba(255,200,110,.7)'],[1,'rgba(255,150,60,0)']]); g.fillRect(x-40, 890, 80, 80);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#ffd36a';
    g.beginPath(); g.moveTo(x, 917+f*2); g.quadraticCurveTo(x+6, 932, x, 938); g.quadraticCurveTo(x-6, 932, x, 917+f*2); g.fill(); }
  g.restore();
}

const SCENES = {
  hall:   { name:'Chánh điện', icon:'🏯', image:'hall', flicker:true, buddhaScale:1.4 },
  bamboo: { name:'Rừng trúc', icon:'🎋', image:'bamboo', front:bambooFront, cushion:['#4a3a22','#8a7448','#b59d6a'] },
  lotus:  { name:'Hồ sen đêm trăng', icon:'🌕', paint:paintLotus, back:lotusBack, front:lotusFront, cushion:['#3a120c','#7a2a1a','#a8442a'] },
  peak:   { name:'Đỉnh núi bình minh', icon:'🌄', paint:paintPeak, back:peakBack, front:peakFront, cushion:['#6a3410','#b5652a','#e39a52'] },
  bodhi:  { name:'Cội Bồ Đề hoàng hôn', icon:'🌳', paint:paintBodhi, front:bodhiFront, cushion:['#4a2a14','#8a5a2a','#c08a4a'] },
  snow:   { name:'Sân chùa tuyết', icon:'❄️', paint:paintSnow, back:snowBack, front:snowFront, cushion:['#3a1a3a','#6a3060','#9a5088'] },
  fall:   { name:'Thác nước', icon:'💧', paint:paintFall, back:fallBack, front:fallFront, cushion:['#2a3a2a','#4a6a44','#7a9a6a'] },
  spring: { name:'Mai vàng ngày xuân', icon:'🌼', paint:paintSpring, back:springBack, front:springFront, cushion:['#5a3a06','#b08020','#e8c050'] },
};
for (const [id, s] of Object.entries(SCENES)){ s.id = id; s.st = {}; }
// Backgrounds uploaded from the panel (assets/bg), scene id "bg:<file>": the photo cropped to fill 9:16. With SCENE_OPTS.bgAltar the
// altar and statue are painted on top, so offerings, the fortune draw and the gift close-up still have somewhere to go.
const SCENE_OPTS = { bgAltar: true };     // set by the page from settings.bgAltar
function customScene(file){
  const id = 'bg:' + file; if (SCENES[id]) return SCENES[id];
  const im = new Image(); im.src = '/assets/bg/' + encodeURIComponent(file);
  return SCENES[id] = { id, st:{}, name: file.replace(/\.[^.]+$/, ''), icon:'🖼️', custom: im, cushion:['#4a2a14','#8a5a2a','#c08a4a'] };
}
function paintCustom(g, s, img){
  const im = s.custom, k = Math.max(W/im.naturalWidth, H/im.naturalHeight), w = im.naturalWidth*k, h = im.naturalHeight*k;
  g.drawImage(im, (W-w)/2, (H-h)/2, w, h);
  if (SCENE_OPTS.bgAltar) altar(g, img.buddha, { stone:['#5a4438','#8a6c58','#c8a68a'], table:['#5a160c','#8a2414','#b0381e','#e2b04f'], cloth:true });
}
// Painted backdrop for a scene: the hall photo itself, or a 1080×1920 canvas painted once (null until the images load).
// buddhaScale: the statue (cut from the hall painting, at 410,470) painted again larger over itself, standing on the same plinth.
function sceneBackdrop(s, img){
  if (s.image && !s.buddhaScale) return img[s.image]?.naturalWidth ? img[s.image] : null;
  if (s.custom){
    if (!s.custom.naturalWidth || !img.buddha?.naturalWidth) return null;
    if (s.canvas && s.canvasAltar === SCENE_OPTS.bgAltar) return s.canvas;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    paintCustom(c.getContext('2d'), s, img); s.canvasAltar = SCENE_OPTS.bgAltar; return s.canvas = c;
  }
  if (s.canvas) return s.canvas;
  if (s.image){
    const bg = img[s.image], b = img.buddha;
    if (!bg?.naturalWidth || !b?.naturalWidth) return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.drawImage(bg, 0, 0, W, H);
    const w = b.naturalWidth*s.buddhaScale, h = b.naturalHeight*s.buddhaScale;
    g.drawImage(b, 540-w/2, 470+b.naturalHeight-h, w, h);
    return s.canvas = c;
  }
  if (!img.buddha?.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  s.paint(c.getContext('2d'), img); return s.canvas = c;
}
function sceneBack(g, s, t, dt, a){ if (s.back) s.back(g, t, dt, a, s.st); if (s.paint || (s.custom && SCENE_OPTS.bgAltar)) flames(g, t, a); }
function sceneFront(g, s, t, dt, a){ if (s.front) s.front(g, t, dt, a, s.st); }
// prayer mat under a seated person (painted scenes only: the hall painting has its own cushions)
function sceneCushion(g, s, x, y, k, a){
  if (!s.cushion) return; const c = s.cushion;
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(0,0,0,.3)'; ell(g, x, y+5*k, 62*k, 18*k); g.fill();
  g.fillStyle = c[0]; ell(g, x, y+2*k, 56*k, 16*k); g.fill();
  g.fillStyle = vgrad(g, y-14*k, y+6*k, [[0,c[2]],[1,c[1]]]); ell(g, x, y-4*k, 54*k, 14*k); g.fill();
  g.restore();
}
/* ---------------- outfits ---------------- */
// Every character sprite wears grey lay robes (áo lam). Other outfits recolour only those grey pixels, keeping their
// shading: hair, skin, the book, the cushion and the monk's robe are not grey, so they stay as painted.
const OUTFITS = {
  lam:    { name:'Áo lam xám' },
  blue:   { name:'Áo lam xanh', ramp:['#16263f','#4f78a8','#b9d4f0'] },
  brown:  { name:'Áo nâu', ramp:['#2e1a0e','#7a4f2c','#d1a070'] },
  white:  { name:'Áo trắng', ramp:['#6c707c','#c9ccd4','#ffffff'] },
  yellow: { name:'Áo tràng vàng', ramp:['#5a3a06','#c08a1e','#ffe08a'] },
  rose:   { name:'Áo hồng phấn', ramp:['#4a1f2c','#b0687c','#f6c6d2'] },
};
const hex = c => [1,3,5].map(i => parseInt(c.slice(i, i+2), 16));
const recolored = new Map();
// a canvas copy of img in that outfit (cached), or img itself for the original / until the image has loaded
function outfitImg(img, id){
  const o = OUTFITS[id]; if (!o?.ramp || !img?.naturalWidth) return img;
  const key = img.src + '|' + id; let c = recolored.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, [lo, mid, hi] = o.ramp.map(hex);
  for (let i = 0; i < p.length; i += 4){
    if (p[i+3] < 10) continue;
    const r = p[i], gg = p[i+1], b = p[i+2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = .3*r + .59*gg + .11*b;
    if (mx - mn > 30 || l < 55 || l > 240 || b < r - 6) continue;
    const t = Math.min(1, Math.max(0, (l - 60) / 170)), [A, B, k] = t < .5 ? [lo, mid, t*2] : [mid, hi, t*2 - 1];
    p[i] = A[0] + (B[0]-A[0])*k; p[i+1] = A[1] + (B[1]-A[1])*k; p[i+2] = A[2] + (B[2]-A[2])*k;
  }
  g.putImageData(d, 0, 0); recolored.set(key, c); return c;
}
Object.assign(window, { SCENES, SCENE_OPTS, customScene, sceneBackdrop, sceneBack, sceneFront, sceneCushion, OUTFITS, outfitImg });
})();
