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
  hall:   { name:'Chánh điện', icon:'🏯', image:'hall', flicker:true },
  bamboo: { name:'Rừng trúc', icon:'🎋', image:'bamboo', front:bambooFront, cushion:['#4a3a22','#8a7448','#b59d6a'] },
  lotus:  { name:'Hồ sen đêm trăng', icon:'🌕', paint:paintLotus, back:lotusBack, front:lotusFront, cushion:['#3a120c','#7a2a1a','#a8442a'] },
  peak:   { name:'Đỉnh núi bình minh', icon:'🌄', paint:paintPeak, back:peakBack, front:peakFront, cushion:['#6a3410','#b5652a','#e39a52'] },
};
for (const [id, s] of Object.entries(SCENES)){ s.id = id; s.st = {}; }
// Painted backdrop for a scene: the hall photo itself, or a 1080×1920 canvas painted once (null until the images load).
function sceneBackdrop(s, img){
  if (s.image) return img[s.image]?.naturalWidth ? img[s.image] : null;
  if (s.canvas) return s.canvas;
  if (!img.buddha?.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  s.paint(c.getContext('2d'), img); return s.canvas = c;
}
function sceneBack(g, s, t, dt, a){ if (s.back) s.back(g, t, dt, a, s.st); if (s.paint) flames(g, t, a); }
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
Object.assign(window, { SCENES, sceneBackdrop, sceneBack, sceneFront, sceneCushion });
})();
