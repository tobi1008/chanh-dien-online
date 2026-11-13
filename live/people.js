/* People standing in line, seen from behind, hands joined: one picture per character in assets/people (3D renders,
   transparent background), plus pictures uploaded from the panel in assets/chars (skin "up:<file>").
   The áo dài picture is pink; the other áo dài colours (settings.outfits) are made from it by turning its pink pixels
   to the chosen colour, keeping their shading.

   PEOPLE.figure(skin, outfit, pose) returns a cached canvas, or null while the picture is still loading:
     { c, ox, oy, res, hip, top }
     c: the canvas · (ox, oy): pixel of the feet (bottom centre) · res: canvas pixels per unit (an adult is 300 units)
     hip: canvas row where a bow bends (everything above is lowered) · top: canvas row of the top of the head
   pose: 'stand' | 'w0'…'w3' (walking: a small sway and lift on w1 / w3) | 'kneel' (legs folded under the body)
   PEOPLE.ready(skin) resolves once that skin can be drawn.
   Used by overlay.html (the hall) and control.html (character list). */
(function(){
'use strict';
const OUTFITS = {
  hong:  { name:'Áo dài hồng',      top:'#ee8daa' },
  tim:   { name:'Áo dài tím',       top:'#b6a2dd' },
  la:    { name:'Áo dài xanh lá',   top:'#9cc792' },
  troi:  { name:'Áo dài xanh trời', top:'#9cc0ea' },
  trang: { name:'Áo dài trắng',     top:'#f1ede4' },
  vang:  { name:'Áo dài vàng',      top:'#eccb6e' },
  lam:   { name:'Áo dài lam',       top:'#8e9aa8' },
};
// skin → picture and height (1 = adult). master is the grey-robed monk with a halo (the overlay draws the glow).
const LOOKS = {
  woman:  { file:'ao-dai-hong.png', h:.97, recolor:true },
  man:    { file:'nam-ao-nau.png', h:1.04 },
  lady:   { file:'nu-khan-hong.png', h:.96 },
  granny: { file:'ba-cu-ao-nau.png', h:.93 },
  monk:   { file:'su-thay-ao-nau.png', h:1 },
  master: { file:'su-thay-ao-xam.png', h:1.01 },
  nun:    { file:'su-co-khan-xanh.png', h:.97 },
  child:  { file:'be-trai-ao-xanh.png', h:.7 },
};
const RES = 1.7;                                        // canvas pixels per unit

function ell(g, x, y, rx, ry){ g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI*2); }
const hex = c => [1,3,5].map(i => parseInt(c.slice(i, i+2), 16)/255);
function rgb2hsl(r, g, b){
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx+mn)/2, d = mx-mn;
  if (!d) return [0, 0, l];
  const s = d/(1-Math.abs(2*l-1));
  const h = mx === r ? ((g-b)/d + 6) % 6 : mx === g ? (b-r)/d + 2 : (r-g)/d + 4;
  return [h*60, s, l];
}
function hsl2rgb(h, s, l){
  const c = (1-Math.abs(2*l-1))*s, x = c*(1-Math.abs((h/60) % 2 - 1)), m = l-c/2;
  const [r, g, b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return [(r+m)*255, (g+m)*255, (b+m)*255];
}
const clamp01 = v => Math.max(0, Math.min(1, v));

/* pictures */
// Transparent margins are cut off so the feet stand on the floor. A picture without transparency (uploads: a photo on
// white, a green screen…) has its plain background removed by filling in from the edges with the corner colour.
const pics = new Map();
function load(src){
  let u = pics.get(src); if (u) return u;
  u = { img: new Image(), frames: new Map(), cuts: new Map() };
  u.ready = new Promise(ok => { u.img.onload = ok; u.img.onerror = ok; });
  u.img.src = src; pics.set(src, u); return u;
}
function cutOut(img, outfit){
  const k = Math.min(1, 900/img.naturalHeight), w = Math.max(1, Math.round(img.naturalWidth*k)), h = Math.max(1, Math.round(img.naturalHeight*k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data, at = (x, y) => (y*w + x)*4;
  const corners = [at(0,0), at(w-1,0), at(0,h-1), at(w-1,h-1)];
  if (corners.every(i => p[i+3] > 250)){                                  // no transparency: take the background away
    const ref = [0,1,2].map(j => corners.reduce((a, i) => a + p[i+j], 0)/4);
    const near = i => Math.abs(p[i]-ref[0]) + Math.abs(p[i+1]-ref[1]) + Math.abs(p[i+2]-ref[2]) < 70;
    if (corners.every(near)){
      const seen = new Uint8Array(w*h), st = [];
      for (let x = 0; x < w; x++) st.push(x, (h-1)*w + x); for (let y = 0; y < h; y++) st.push(y*w, y*w + w-1);
      const keep = p.slice(); let gone = 0;
      while (st.length){ const n = st.pop(); if (seen[n]) continue; seen[n] = 1; const i = n*4; if (!near(i)) continue;
        p[i+3] = 0; gone++; const x = n % w;
        if (x > 0) st.push(n-1); if (x < w-1) st.push(n+1); if (n >= w) st.push(n-w); if (n < w*(h-1)) st.push(n+w); }
      if (gone > w*h*.97) p.set(keep);                                    // nearly all of it went: it wasn't a background
    }
  }
  const o = OUTFITS[outfit];
  if (o && outfit !== 'hong'){                                            // pink áo dài → the chosen colour, same shading
    const [th, ts, tl] = rgb2hsl(...hex(o.top));
    for (let i = 0; i < p.length; i += 4){
      if (p[i+3] < 10) continue;
      const [hh, s, l] = rgb2hsl(p[i]/255, p[i+1]/255, p[i+2]/255);
      if (s < .16 || l < .18 || l > .97 || !(hh >= 300 || hh <= 6)) continue;   // pink only: skin, hair and the white trousers stay
      const [r, g2, b] = hsl2rgb(th, clamp01(s*ts/.5), clamp01(l + (tl-.68)*.9));
      p[i] = r; p[i+1] = g2; p[i+2] = b;
    }
  }
  g.putImageData(d, 0, 0);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[at(x,y)+3] > 24){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { c, x:0, y:0, w, h };
  return { c, x:x0, y:y0, w:x1-x0+1, h:y1-y0+1 };
}
function picFigure(src, height, outfit, pose){
  const u = load(src); if (!u.img.naturalWidth) return null;
  const kind = pose === 'kneel' ? 'kneel' : pose === 'w1' ? 'l' : pose === 'w3' ? 'r' : 'stand', key = kind + '|' + (outfit || '');
  let f = u.frames.get(key); if (f) return f;
  let cut = u.cuts.get(outfit || ''); if (!cut){ cut = cutOut(u.img, outfit); u.cuts.set(outfit || '', cut); }
  const { c: src2, x, y, w, h } = cut, Hp = 300*RES*height, Wp = w*Hp/h, pad = 30;
  const c = document.createElement('canvas'); c.width = Math.ceil(Wp + 2*pad); c.height = Math.ceil(Hp + pad);
  const g = c.getContext('2d'), ox = c.width/2, oy = Hp + pad*.6;
  g.fillStyle = 'rgba(0,0,0,.3)'; ell(g, ox, oy, Math.min(Wp*.45, 42*RES*height), 9*RES*height); g.fill();   // contact shadow
  let top = oy - Hp, hip = oy - Hp*.52;
  if (kind === 'kneel'){                                                  // legs folded: the lower part squeezed flat
    const upper = .56, legs = .12;
    g.drawImage(src2, x, y + h*upper, w, h*(1-upper), ox - Wp/2, oy - Hp*legs, Wp, Hp*legs);
    g.drawImage(src2, x, y, w, h*upper, ox - Wp/2, oy - Hp*(legs+upper), Wp, Hp*upper);
    top = oy - Hp*(legs+upper); hip = oy - Hp*legs;
  } else {
    g.save(); g.translate(ox, oy);
    if (kind !== 'stand'){ g.rotate((kind === 'l' ? -1 : 1)*.03); g.translate(0, -4*RES*height); }   // a step: sway and lift
    g.drawImage(src2, x, y, w, h, -Wp/2, -Hp, Wp, Hp); g.restore();
  }
  f = { c, ox, oy, res: RES, hip: Math.round(hip), top: Math.round(top) };
  if (u.frames.size > 60) u.frames.clear();
  u.frames.set(key, f); return f;
}
const srcOf = skin => String(skin).startsWith('up:') ? '/assets/chars/' + encodeURIComponent(skin.slice(3)) : '/assets/people/' + (LOOKS[skin] || LOOKS.man).file;
function figure(skin, outfit, pose = 'stand'){
  if (String(skin).startsWith('up:')) return picFigure(srcOf(skin), 1, '', pose) || figure('man', outfit, pose);   // still loading or deleted
  const L = LOOKS[skin] || LOOKS.man;
  return picFigure(srcOf(skin), L.h, L.recolor ? (OUTFITS[outfit] ? outfit : 'hong') : '', pose);
}
const ready = skin => load(srcOf(skin)).ready;
// Any picture the browser can open (jpg, png, webp, gif, bmp, avif…, any size), made ready for assets/chars before it is
// uploaded: plain background removed, cut close around the person, at most 800 px tall, saved as PNG.
function prepareUpload(file){
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file), img = new Image();
    const fail = () => { URL.revokeObjectURL(url); bad(new Error('Không đọc được ảnh này, hãy lưu lại thành .jpg hoặc .png')); };
    img.onerror = fail;
    img.onload = () => {
      URL.revokeObjectURL(url); if (!img.naturalWidth || !img.naturalHeight) return fail();
      const cut = cutOut(img, ''), k = Math.min(1, 800/cut.h), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(cut.w*k)); c.height = Math.max(1, Math.round(cut.h*k));
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cut.c, cut.x, cut.y, cut.w, cut.h, 0, 0, c.width, c.height);
      c.toBlob(b => b ? ok(b) : bad(new Error('Không chuyển được ảnh')), 'image/png');
    };
    img.src = url;
  });
}
for (const k in LOOKS) load(srcOf(k));                                    // start loading the whole set now
window.PEOPLE = { figure, ready, prepareUpload, OUTFITS, LOOKS, RES };
})();
