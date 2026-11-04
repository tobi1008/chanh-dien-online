// Chánh Điện Tịnh Tâm — live server
// Runs on the streaming PC. Serves the overlay + control panel, listens to a TikTok LIVE room,
// keeps the list of seated viewers and pushes everything to the overlay over WebSocket.
// No voice: gifts, chants and notices are shown as banners on screen.
//
//   cd live && npm install && node server.mjs        → http://localhost:3000/live/control.html
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import * as wordFilter from './filter.mjs';
import { XAM } from './xam.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // repo root: serves /assets, /live
const PORT = +process.env.PORT || 3000;
// live/version.txt is written by pack/build-windows.sh; a plain checkout has none and never updates itself.
const VERSION = (() => { try { return fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim(); } catch { return 'dev'; } })();
const UPDATE_REPO = process.env.UPDATE_REPO || 'tobi1008/chanh-dien-online';    // GitHub Releases published by pack/release.sh

/* ------------------------------------------------------------------ state */
// action: what commenting a row's *starred* words does (see findAction). '' = the row is only shown.
const DEFAULT_GUIDE = [ { icon:'💬', text:'Bình luận để vào', action:'' }, { icon:'🙏', text:'*Dâng hương*', action:'incense' },
  { icon:'🪷', text:'*Dâng hoa*', action:'flower' }, { icon:'🔮', text:'*Quẻ tử vi*', action:'xam' }, { icon:'🙇', text:'*Lạy* · *Vái*', action:'bow' } ];
const settings = {
  title: 'Chánh Điện Tịnh Tâm',
  subtitle: 'Nam Mô A Di Đà Phật',
  music: true, mo: true, moBpm: 52,
  autoChant: true, chantEveryMin: 3,
  showEnter: true,                   // overlay shows "<avatar> <name> vừa vào" for everyone entering the live
  syncViewers: true,                 // keep the hall no fuller than TikTok's live viewer count (see syncSeats)
  prayerFromChat: true,              // show the giver's own recent comment as the prayer (filtered)
  filterOn: true,                    // profanity filter for names + comments
  filterMode: 'hide',                // hide: drop the comment · mask: show it with *** in place of bad words
  filterStrikes: 3,                  // bad comments before a viewer is removed and blocked (0 = never)
  filterExtra: '',                   // extra blocked words, comma separated
  xamOn: true,                       // "xin xăm", free, once per viewer
  audioOut: '',                      // overlay sound device name, e.g. "CABLE Input" (empty = Windows default speakers)
  scene: 'hall',                     // backdrop, see live/scenes.js
  sceneAuto: false, sceneEveryMin: 10,
  sceneOff: [],                      // scenes the auto switch skips (so scenes added later are in the rotation by default)
  outfits: ['lam'],                  // robes viewers wear, see OUTFITS in live/scenes.js; several = each viewer gets one of them
  track: '',                         // background music file in assets/music now playing
  musicAuto: true,                   // when a track ends, play a random other one not in musicOff (off = repeat the track)
  musicOff: [],                      // tracks the auto switch skips (so files added later are in the rotation by default)
  bgAltar: true,                     // uploaded backgrounds get the altar + statue painted on top (offerings need somewhere to go)
  guide: DEFAULT_GUIDE,              // the "how to join" card on the overlay; *word* is drawn in gold
};
const SCENE_NAMES = { hall:'Chánh điện', bamboo:'Rừng trúc', lotus:'Hồ sen đêm trăng', peak:'Đỉnh núi bình minh',
  bodhi:'Cội Bồ Đề hoàng hôn', snow:'Sân chùa tuyết', fall:'Thác nước', spring:'Mai vàng ngày xuân' }, SCENE_IDS = Object.keys(SCENE_NAMES);
// Backgrounds uploaded from the panel (or copied in) live in assets/bg; each one is a scene with id "bg:<file>".
const BG_DIR = path.join(ROOT, 'assets', 'bg');
function scanBg(){
  try { return fs.readdirSync(BG_DIR).filter(f => !f.startsWith('.') && /\.(jpe?g|png|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'vi')); }
  catch { return []; }
}
let bgFiles = scanBg();
const allScenes = () => [...SCENE_IDS, ...bgFiles.map(f => 'bg:' + f)];
const sceneName = id => SCENE_NAMES[id] || String(id).replace(/^bg:/, '').replace(/\.[^.]+$/, '');
const OUTFIT_IDS = ['lam', 'blue', 'brown', 'white', 'yellow', 'rose'];
// Settings survive restarts in live/config.json (git-ignored).
const CONFIG = path.join(__dirname, 'config.json');

const viewers = new Map();           // id -> { id, name, skin, avatar, coins, joinedAt, lastAt, lastText, lastTextAt }
// Merit (công đức) is kept apart from the seats: people leave the hall all the time, their merit must not leave with them.
// Survives restarts in live/merit.json (git-ignored); only the streamer's "Xoá bảng công đức" button empties it.
const MERIT_FILE = path.join(__dirname, 'merit.json');
const merit = new Map();             // id -> { name, coins }
try { for (const [id, m] of Object.entries(JSON.parse(fs.readFileSync(MERIT_FILE, 'utf8')))) if (m?.coins > 0) merit.set(id, { name: String(m.name || id).slice(0, 18), coins: +m.coins }); } catch {}
let meritSaveTimer = null;
function saveMerit(){
  clearTimeout(meritSaveTimer);
  meritSaveTimer = setTimeout(() => fs.writeFile(MERIT_FILE, JSON.stringify(Object.fromEntries(merit)), e => e && addLog('Không lưu được công đức: ' + e.message)), 1000);
}
const topMerit = () => [...merit].sort((a, b) => b[1].coins - a[1].coins).slice(0, 5).map(([id, m]) => ({ id, name: m.name, coins: m.coins }));
const blocked = new Map(), strikes = new Map();   // id -> name of viewers removed by the streamer or by the filter
const recentFiltered = [];                         // last 30 filtered comments, for a control panel opened later
const blockedList = () => [...blocked].map(([id, name]) => ({ id, name }));
const startedAt = Date.now();
let tiktok = null, tiktokState = { status: 'idle', uniqueId: '', error: '' };
const log = [];
function addLog(s){ const line = `[${new Date().toLocaleTimeString('vi-VN')}] ${s}`; log.push(line); if (log.length > 300) log.shift(); broadcast({ t:'log', line }, 'control'); console.log(line); }

// No seat limit: the hall grows 24 → 36 → 64 → 100, then in steps of 50 (the overlay packs the rows tighter).
const CAPS = [24, 36, 64, 100];
function capacity(){ const n = viewers.size; return CAPS.find(c => n <= c) || Math.ceil(n / 50) * 50; }

/* skins: sprites that exist in /assets. Walking strips exist for man / woman / granny. */
// A comment changes the outfit only when it IS the keyword (≤ 3 words), so "Nam mô A Di Đà Phật" never reads as "nam".
const SKIN_WORDS = [
  ['master', ['cao tăng','cao tang']], ['monk', ['sư','su','sư thầy','su thay','thầy','thay']], ['nun', ['ni','ni cô','ni co','sư cô','su co']],
  ['child', ['tiểu','tieu','chú tiểu','chu tieu','bé','be']], ['granny', ['bà','ba','áo nâu','ao nau','cụ','cu']],
  ['woman', ['nữ','nu','chị','chi','gái','gai']], ['man', ['nam','anh','trai']],
];
function skinFromText(t){
  const w = String(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!w || w.split(' ').length > 3) return null;
  for (const [skin, words] of SKIN_WORDS) if (words.some(k => w === k || w.startsWith(k + ' '))) return skin;
  return null;
}
const DEFAULT_SKINS = ['man', 'woman', 'woman', 'man', 'granny'];

/* comment commands */
// A comment containing a keyword triggers its action: incense / flower (walk up and offer), xam (draw a fortune),
// bow (walk up and bow three times before the altar, nothing in hand). Keywords are the built-in ones below plus the *starred* words of every menu row
// (settings.guide) that has an action, so what the overlay's menu tells viewers to type always works.
// Matching is by whole words. A comment typed with accents is matched with accents ("lấy" is not "lạy"); one typed
// without any accent is matched against the keywords stripped of theirs ("lay phat" is "lạy Phật").
const ACTIONS = ['xam', 'flower', 'incense', 'bow'];        // priority when one comment holds several
const BUILTIN_KEYWORDS = {
  incense: ['dâng hương', 'thắp nhang', 'thắp hương', 'dâng nhang'],
  flower: ['dâng hoa', 'dâng sen'],
  xam: ['quẻ tử vi', 'xin quẻ', 'xin xăm', 'rút xăm', 'gieo quẻ'],
  bow: ['lạy', 'lậy', 'vái'],
};
const plainWords = t => String(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const noMarks = t => t.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
const starred = text => String(text).split('*').filter((_, i) => i % 2).map(plainWords).filter(Boolean);
let keywords = [];
function buildKeywords(){
  const list = [];
  for (const a of ACTIONS){
    const words = new Set(BUILTIN_KEYWORDS[a].map(plainWords));
    for (const r of settings.guide) if (r.action === a) for (const w of starred(r.text)) words.add(w);
    for (const w of words) list.push({ action: a, w, bare: noMarks(w) });
  }
  keywords = list;
}
function findAction(text){
  const t = plainWords(text), bare = noMarks(t), marked = bare !== t;
  const hay = ' ' + (marked ? t : bare) + ' ';
  for (const a of ACTIONS) if (keywords.some(k => k.action === a && hay.includes(' ' + (marked ? k.w : k.bare) + ' '))) return a;
  return null;
}
// One trip to the altar (offering or bow) per person every 45 s, so spamming the words does not flood the altar.
const lastAct = new Map();
function cooled(id){
  const now = Date.now(); if (now - (lastAct.get(id) || 0) < 45_000) return false;
  lastAct.set(id, now); if (lastAct.size > 5000) lastAct.clear();
  return true;
}
const ACT_LOG = { incense: ['🙏', 'lên dâng hương'], flower: ['🪷', 'lên dâng hoa'], bow: ['🙇', 'lên vái lạy'] };

// "xin xăm" / "quẻ tử vi" draws a fortune stick (live/xam.mjs), free, but once per viewer for the whole live. Asking again puts a small
// bubble over that viewer's head only (no banner, no bell: the stream is shared by everyone), once per 30 s each.
const xamDrawn = new Set(), xamAsked = new Map();
function sendXam(v){
  const no = Math.floor(Math.random() * XAM.length), x = XAM[no];
  broadcast({ t:'xam', id: v.id, name: v.name, no: no + 1, level: x.level, poem: x.poem, meaning: x.meaning });
  addLog(`🎋 ${v.name} xin được xăm số ${no + 1} (${x.level})`);
}
function onXamAsk(v){
  if (!settings.xamOn) return;
  if (!xamDrawn.has(v.id)){ xamDrawn.add(v.id); return sendXam(v); }
  const before = xamAsked.get(v.id) || 0;
  xamAsked.set(v.id, Date.now()); if (xamAsked.size > 5000) xamAsked.clear();
  if (Date.now() - before > 30_000) broadcast({ t:'hint', id: v.id, text: '🔮 Mỗi người chỉ xin Quẻ 1 lần' });
}

function pub(v){ return { id:v.id, name:v.name, skin:v.skin, avatar:v.avatar||'', coins:v.coins }; }
function snapshot(){ return { t:'state', tracks: musicFiles, bgs: bgFiles, track: musicTrack(), musicSeq, settings, viewers:[...viewers.values()].map(pub), cap: capacity(), startedAt, tiktok: tiktokState, merit: topMerit(), version: VERSION, sceneAt }; }

function cleanName(name, id){
  name = String(name || id || '').slice(0, 18);
  return settings.filterOn && wordFilter.check(name).bad ? 'Phật tử ẩn danh' : name;
}
function seat(id, name, opts = {}){
  if (!id || blocked.has(id)) return { v:null, isNew:false };
  let v = viewers.get(id);
  if (v){ v.lastAt = Date.now(); if (opts.avatar) v.avatar = opts.avatar; return { v, isNew:false }; }
  v = { id, name: cleanName(name, id), skin: opts.skin || DEFAULT_SKINS[viewers.size % DEFAULT_SKINS.length],
        avatar: opts.avatar || '', coins: merit.get(id)?.coins || 0, joinedAt: Date.now(), lastAt: Date.now() };
  viewers.set(id, v);
  broadcast({ t:'join', v: pub(v), cap: capacity() });
  return { v, isNew:true };
}

/* ------------------------------------------------------------- events in */
// emotes: TikTok's own sticker icons, sent apart from the text as [{ i: position in the text, url }]
function onChat(id, name, text, avatar, emotes = []){
  if (!id || blocked.has(id)) return;
  text = String(text || '').slice(0, 200);
  emotes = emotes.filter(e => /^https:\/\//.test(e.url)).slice(0, 8).map(e => ({ i: clamp(e.i, 0, text.length), url: e.url.slice(0, 1000) }));
  if (!text.trim() && !emotes.length) return;
  let dirty = false;
  if (settings.filterOn){
    const r = wordFilter.check(text);
    if (r.bad){
      dirty = true;
      const n = (strikes.get(id) || 0) + 1; strikes.set(id, n);
      addLog(`🚫 Lọc bình luận của ${String(name || id).slice(0, 18)} (lần ${n}): ${r.clean}`);
      const f = { t:'filtered', id, name: cleanName(name, id), text: r.clean, n };
      recentFiltered.unshift(f); recentFiltered.length = Math.min(recentFiltered.length, 30);
      broadcast(f, 'control');
      if (settings.filterStrikes && n >= settings.filterStrikes){ block(id, `vi phạm ${n} lần`); return; }
      if (settings.filterMode === 'hide') return;
      text = r.clean;
    }
  }
  const want = dirty ? null : skinFromText(text);
  const { v, isNew } = seat(id, name, { avatar, skin: want || undefined });
  if (!v) return;
  if (!isNew && want && want !== v.skin){ v.skin = want; broadcast({ t:'skin', id, skin: want }); }
  // a masked comment is never read aloud as a prayer, nor a command ("xin xăm", "dâng hương", "nữ"…). A bow is: "Con lạy
  // Phật, cầu gia đình bình an" is exactly the prayer a gift banner should carry.
  const action = dirty ? null : findAction(text);
  if (!dirty && text.trim() && !want && (!action || action === 'bow')){ v.lastText = text; v.lastTextAt = Date.now(); }
  broadcast({ t:'chat', id, name: v.name, text, emotes: dirty ? [] : emotes });
  if (action === 'xam') onXamAsk(v);
  else if (action && cooled(id)){ broadcast({ t:'incense', id, name: v.name, kind: action }); addLog(`${ACT_LOG[action][0]} ${v.name} ${ACT_LOG[action][1]}`); }
}

// Someone opened the live: the overlay greets them by name + avatar and they take a seat in the hall.
function onEnter(id, name, avatar){
  if (!id || blocked.has(id)) return;
  if (settings.showEnter) broadcast({ t:'enter', id, name: cleanName(name, id), avatar: String(avatar || '').slice(0, 1000) });
  seat(id, name, { avatar });
}

function block(id, why){
  const v = viewers.get(id);
  blocked.set(id, v?.name || recentFiltered.find(f => f.id === id)?.name || id);
  if (v){ viewers.delete(id); broadcast({ t:'leave', id }); }
  addLog(`⛔ Đã chặn ${blocked.get(id)}${why ? ' (' + why + ')' : ''}`);
  broadcast({ t:'blocked', list: blockedList() }, 'control');
}
function unblock(id){ addLog(`↩︎ Bỏ chặn ${blocked.get(id) || id}`); blocked.delete(id); strikes.delete(id); broadcast({ t:'blocked', list: blockedList() }, 'control'); }

function onGift(id, name, giftName, count, diamonds, avatar){
  giftName = String(giftName || 'quà').slice(0, 30); count = Math.max(1, Math.min(9999, +count || 1));
  const { v } = seat(id, name, { avatar });
  if (!v) return;
  const coins = Math.max(1, (diamonds || 1) * (count || 1));
  v.coins += coins;
  merit.set(id, { name: v.name, coins: v.coins }); saveMerit();
  const own = settings.prayerFromChat && v.lastText && Date.now() - v.lastTextAt < 90_000 && v.lastText.length > 6;
  const prayer = own && !(settings.filterOn && wordFilter.check(v.lastText).bad) ? v.lastText : pickPrayer();
  const tier = coins >= 99 ? 3 : coins >= 10 ? 2 : 1;
  broadcast({ t:'gift', id, name: v.name, giftName, count, coins, total: v.coins, tier, prayer, merit: topMerit() });
}

function pickPrayer(){
  const P = ['Nguyện cầu gia đạo bình an, vạn sự cát tường', 'Nguyện cầu cha mẹ mạnh khỏe, sống lâu', 'Nguyện hồi hướng công đức cho khắp pháp giới chúng sinh',
             'Nguyện cầu thân tâm an lạc, phiền não tiêu trừ', 'Nguyện cầu công việc hanh thông, gia đình hạnh phúc'];
  return P[Math.floor(Math.random() * P.length)];
}
const CHANTS = [
  'Nam mô Bổn Sư Thích Ca Mâu Ni Phật. Nguyện đem công đức này, hướng về khắp tất cả, đệ tử và chúng sinh, đều trọn thành Phật đạo.',
  'Nam mô A Di Đà Phật. Nguyện sanh Tây Phương Tịnh Độ trung, cửu phẩm liên hoa vi phụ mẫu.',
  'Nam mô Đại Bi Quán Thế Âm Bồ Tát. Nguyện cho tất cả chúng sinh thân tâm an lạc, tai qua nạn khỏi.',
  'Quán Tự Tại Bồ Tát hành thâm Bát Nhã Ba La Mật Đa thời, chiếu kiến ngũ uẩn giai không, độ nhất thiết khổ ách.',
];
let chantIdx = 0, chantTimer = null;
function chant(){ const text = CHANTS[chantIdx++ % CHANTS.length]; broadcast({ t:'chant', text }); }
function scheduleChant(){ clearInterval(chantTimer); if (settings.autoChant) chantTimer = setInterval(chant, Math.max(1, settings.chantEveryMin) * 60_000); }

// Auto scene switch: every sceneEveryMin minutes, the next scene not in sceneOff. Picking a scene by hand restarts the wait.
let sceneTimer = null, sceneAt = 0;
function nextScene(){
  const ids = allScenes(), on = ids.filter(id => !settings.sceneOff.includes(id)), list = on.length ? on : ids;
  const next = list[(list.indexOf(settings.scene) + 1) % list.length];
  if (next !== settings.scene){ settings.scene = next; saveSettings(); addLog('🏞 Chuyển cảnh: ' + sceneName(next)); }
  scheduleScene(); broadcast({ t:'settings', settings, cap: capacity(), sceneAt });
}
// Background music: every audio file in assets/music is a track, files added while running show up by themselves.
// The server picks the track so every overlay window plays the same one; an overlay reports when it ended.
// musicSeq changes on every pick, so picking the same track again (only one in the rotation) still restarts it.
const MUSIC_DIR = path.join(ROOT, 'assets', 'music');
function scanMusic(){
  try { return fs.readdirSync(MUSIC_DIR).filter(f => !f.startsWith('.') && /\.(mp3|m4a|ogg|wav)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'vi')); }
  catch { return []; }
}
let musicFiles = scanMusic(), musicSeq = 0, musicBag = [], musicWatch = null, bgWatch = null;
function refreshMusic(){
  const l = scanMusic(); if (l.join('\n') === musicFiles.join('\n')) return;
  musicFiles = l; broadcast({ t:'tracks', tracks: l }); addLog(`🎵 Thư mục nhạc có ${l.length} bài`);
  if (settings.track && !l.includes(settings.track) && l.length) nextTrack();                  // the track playing was deleted
}
function refreshBg(){
  const l = scanBg(); if (l.join('\n') === bgFiles.join('\n')) return;
  bgFiles = l; broadcast({ t:'bgs', bgs: l }); addLog(`🖼 Có ${l.length} ảnh nền tự tải`);
  if (!allScenes().includes(settings.scene)){ settings.scene = 'hall'; saveSettings(); scheduleScene(); broadcast({ t:'settings', settings, cap: capacity(), sceneAt }); }
}
try { fs.watch(MUSIC_DIR, () => { clearTimeout(musicWatch); musicWatch = setTimeout(refreshMusic, 800); }); } catch {}
try { fs.mkdirSync(BG_DIR, { recursive: true }); fs.watch(BG_DIR, () => { clearTimeout(bgWatch); bgWatch = setTimeout(refreshBg, 800); }); } catch {}
const musicTrack = () => musicFiles.includes(settings.track) ? settings.track : musicFiles[0] || '';
const trackTitle = f => f.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
// random order, each ticked track once per round, never the same one twice in a row
function pickTrack(){
  const on = musicFiles.filter(f => !settings.musicOff.includes(f)), list = on.length ? on : musicFiles;
  musicBag = musicBag.filter(f => list.includes(f) && f !== settings.track);
  if (!musicBag.length){ musicBag = list.filter(f => f !== settings.track); for (let i = musicBag.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [musicBag[i], musicBag[j]] = [musicBag[j], musicBag[i]]; } }
  return musicBag.pop() || list[0];
}
function playTrack(name, why){
  if (!musicFiles.includes(name)) return;
  settings.track = name; musicSeq++; saveSettings(); addLog(`🎵 ${why}: ${trackTitle(name)}`);
  broadcast({ t:'track', track: name, seq: musicSeq }); broadcast({ t:'settings', settings, cap: capacity(), sceneAt });
}
const nextTrack = () => playTrack(pickTrack(), 'Chuyển bài');
function scheduleScene(){
  clearTimeout(sceneTimer); sceneAt = 0;
  if (!settings.sceneAuto) return;
  const ms = settings.sceneEveryMin * 60_000; sceneAt = Date.now() + ms; sceneTimer = setTimeout(nextScene, ms);
}

/* --------------------------------------------------------------- TikTok */
let TikTokLib = null;
let wantTikTok = '', retryTimer = null, retries = 0;
async function connectTikTok(uniqueId, isRetry){
  uniqueId = String(uniqueId || '').trim().replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/\/.*$/, '');
  if (!uniqueId) return;
  await disconnectTikTok(true);
  wantTikTok = uniqueId; if (!isRetry) retries = 0;
  tiktokState = { status: 'connecting', uniqueId, error: '' }; broadcast({ t:'tiktok', ...tiktokState });
  try {
    TikTokLib ||= await import('tiktok-live-connector');
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = TikTokLib;
    // enableExtendedGiftInfo is off: it fetches the gift list through Euler Stream, which now needs a paid plan.
    // The gift message already carries name + diamond value in `gift`.
    const conn = new TikTokLiveConnection(uniqueId, { enableExtendedGiftInfo: false, processInitialData: false });
    // tiktok-live-connector 2.x hands over raw v3 protobuf objects (displayId / content / gift / count / total);
    // the older names are kept as fallbacks so the handlers also work with legacy-shaped data.
    const pic = im => im?.urlList?.[0] || im?.url?.[0] || im?.mUrls?.[0] || '';
    const av = u => pic(u?.avatarThumb) || pic(u?.avatarMedium) || pic(u?.profilePicture) || '';
    const uid = u => u?.displayId || u?.uniqueId || (u?.id ? String(u.id) : '') || (u?.userId ? String(u.userId) : '');
    const nm = u => u?.nickname || u?.displayId || u?.uniqueId || 'ẩn danh';
    const emo = list => (list || []).map(e => ({ i: +(e.index ?? e.placeInComment) || 0, url: pic((e.emote || e).image) })).filter(e => e.url);
    conn.on(WebcastEvent.CHAT, d => onChat(uid(d.user), nm(d.user), d.content ?? d.comment, av(d.user), emo(d.emotes)));
    conn.on(WebcastEvent.EMOTE, d => onChat(uid(d.user), nm(d.user), '', av(d.user), emo(d.emoteList)));          // sticker-only comment
    conn.on(WebcastEvent.GIFT, d => {
      const g = d.gift || {}, old = d.giftDetails || {}, ext = d.extendedGiftInfo || {};
      const combo = g.combo || (g.type ?? old.giftType ?? ext.type) === 1;
      if (combo && !d.repeatEnd) return;                            // streak still running, wait for its last message
      const gname = g.name || old.giftName || ext.name || 'quà';
      const dia = +(g.diamondCount ?? old.diamondCount ?? ext.diamond_count ?? 1) || 1;
      const count = +d.repeatCount || 1;
      onGift(uid(d.user), nm(d.user), gname, count, dia, av(d.user));
      addLog(`🎁 ${nm(d.user)} tặng ${gname} x${count} (${dia * count} xu)`);
    });
    conn.on(WebcastEvent.MEMBER, d => onEnter(uid(d.user), nm(d.user), av(d.user)));
    conn.on(WebcastEvent.LIKE, d => {
      const id = uid(d.user); if (!id || blocked.has(id)) return;
      seat(id, nm(d.user), { avatar: av(d.user) });                  // liking proves they are still watching
      broadcast({ t:'like', id, n: +(d.count ?? d.likeCount) || 1 });
    });
    conn.on(WebcastEvent.ROOM_USER, d => setViewerCount(d.total ?? d.viewerCount));
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (tiktok !== conn) return;
      tiktok = null; tiktokState = { ...tiktokState, status: 'disconnected' }; broadcast({ t:'tiktok', ...tiktokState }); addLog('TikTok: mất kết nối');
      scheduleRetry();
    });
    conn.on(ControlEvent.ERROR, e => addLog('TikTok lỗi: ' + (e?.info || e?.message || e)));
    const st = await conn.connect();
    tiktok = conn; retries = 0;
    tiktokState = { status: 'connected', uniqueId, error: '', roomId: st?.roomId || '' };
    addLog(`✅ Đã kết nối live @${uniqueId}`);
  } catch (e) {
    tiktokState = { status: 'error', uniqueId, error: String(e?.message || e) };
    addLog(`❌ Không kết nối được @${uniqueId}: ${tiktokState.error}`);
    scheduleRetry();
  }
  broadcast({ t:'tiktok', ...tiktokState });
}
// Dropped connections retry on their own (10 s, 20 s … up to 2 min, 8 tries) until the streamer presses "Ngắt".
function scheduleRetry(){
  clearTimeout(retryTimer);
  if (!wantTikTok || retries >= 8) return;
  const wait = Math.min(120, 10 * 2 ** retries++);
  addLog(`↻ Thử kết nối lại @${wantTikTok} sau ${wait}s (lần ${retries}/8)`);
  retryTimer = setTimeout(() => connectTikTok(wantTikTok, true), wait * 1000);
}
async function disconnectTikTok(keepWanted){
  clearTimeout(retryTimer); if (!keepWanted) wantTikTok = '';
  if (tiktok){ const c = tiktok; tiktok = null; try { await c.disconnect(); } catch {} }
  tiktokState = { status:'idle', uniqueId:'', error:'' }; broadcast({ t:'tiktok', ...tiktokState });
  viewerCount = null; broadcast({ t:'viewers', n: null }, 'control');     // a stale count must not empty the hall
}

/* --------------------------------------------------------- viewer count */
// TikTok never says WHO left, only how many are watching (roomUser, every few seconds). So the hall is trimmed to that
// number: whoever has been quiet the longest stands up first, donors last. Anyone active in the last minute stays,
// because the count lags behind people who just came in. Someone who comes back simply sits down again.
let viewerCount = null;
function setViewerCount(n){
  n = Math.max(0, Math.round(+n || 0)); if (n === viewerCount) return;
  viewerCount = n; broadcast({ t:'viewers', n }, 'control');
}
function syncSeats(){
  if (!settings.syncViewers || viewerCount == null || viewers.size <= viewerCount) return;
  const cutoff = Date.now() - 60_000;
  const out = [...viewers.values()].filter(v => v.lastAt < cutoff)
    .sort((a, b) => (a.coins > 0) - (b.coins > 0) || a.lastAt - b.lastAt)
    .slice(0, viewers.size - viewerCount);
  if (!out.length) return;
  for (const v of out){ viewers.delete(v.id); broadcast({ t:'leave', id: v.id }); }
  addLog(`👋 ${out.length} người đã rời live (còn ${viewers.size} trong chánh điện / ${viewerCount} đang xem)`);
}
setInterval(syncSeats, 10_000);

function clearMerit(){
  merit.clear(); saveMerit();
  for (const v of viewers.values()) v.coins = 0;
  broadcast(snapshot()); addLog('Đã xoá bảng công đức');
}
function clearSeats(){ viewers.clear(); broadcast(snapshot()); addLog('Đã làm trống bồ đoàn'); }

/* -------------------------------------------------------------- updates */
// "Cập nhật" in the control panel: download the newest GitHub Release zip, unpack it with PowerShell, copy live/ and
// assets/ over this install, then exit with code 42 so Mo-Chanh-Dien.bat starts the new server. Kept as they are:
// node/, the .bat itself (cmd.exe reads a running .bat from disk line by line) and live/config.json + live/merit.json,
// which are not in the zip. The pages see a new version in the next 'state' and reload themselves.
let latest = null, updating = false;
const isNewer = (a, b) => { const n = v => String(v).replace(/^v/, '').split(/[.-]/).map(x => +x || 0);
  const x = n(a), y = n(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
function updateState(extra = {}){ broadcast({ t:'update', current: VERSION, latest: latest?.version || null,
  available: !!latest && VERSION !== 'dev' && isNewer(latest.version, VERSION), canInstall: process.platform === 'win32' && VERSION !== 'dev', updating, ...extra }, 'control'); }
async function checkUpdate(){
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { 'User-Agent': 'chanh-dien-live', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(r.status === 404 ? 'chưa có bản phát hành nào' : 'GitHub trả về ' + r.status);
    const rel = await r.json(), asset = rel.assets?.find(a => /windows-x64\.zip$/.test(a.name));
    if (!asset) throw new Error('bản phát hành không có file zip Windows');
    latest = { version: rel.tag_name.replace(/^v/, ''), url: asset.browser_download_url, sha256: asset.digest?.replace(/^sha256:/, '') || '', notes: String(rel.body || '').slice(0, 2000) };
    updateState({ notes: latest.notes });
  } catch (e) { updateState({ error: 'Không kiểm tra được cập nhật: ' + e.message }); }
}
async function installUpdate(){
  if (updating) return;
  if (process.platform !== 'win32' || VERSION === 'dev') return updateState({ error: 'Chỉ tự cập nhật được trên bản Windows đóng gói' });
  if (!latest || !isNewer(latest.version, VERSION)) return updateState({ error: 'Đang dùng bản mới nhất' });
  updating = true; updateState(); addLog(`⬇️ Đang tải bản ${latest.version}…`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chanhdien-'));
  try {
    const r = await fetch(latest.url, { headers: { 'User-Agent': 'chanh-dien-live' }, signal: AbortSignal.timeout(300_000) });
    if (!r.ok) throw new Error('tải về lỗi ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (latest.sha256 && createHash('sha256').update(buf).digest('hex') !== latest.sha256) throw new Error('file tải về bị lỗi (SHA-256 không khớp)');
    const zip = path.join(tmp, 'update.zip'); fs.writeFileSync(zip, buf);
    await new Promise((ok, fail) => execFile('powershell.exe', ['-NoProfile', '-Command', 'Expand-Archive -LiteralPath $env:CD_ZIP -DestinationPath $env:CD_OUT -Force'],
      { windowsHide: true, timeout: 120_000, env: { ...process.env, CD_ZIP: zip, CD_OUT: path.join(tmp, 'x') } }, e => e ? fail(new Error('giải nén lỗi: ' + e.message)) : ok()));
    const src = path.join(tmp, 'x', 'ChanhDienLive');
    if (!fs.existsSync(path.join(src, 'live', 'server.mjs'))) throw new Error('file zip không đúng cấu trúc');
    for (const dir of ['assets', 'live']) fs.cpSync(path.join(src, dir), path.join(ROOT, dir), { recursive: true, force: true });
    for (const f of ['HUONG-DAN.txt', 'LICENSE.txt', 'THIRD-PARTY-LICENSES.txt']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(ROOT, f));
    addLog(`✅ Đã cập nhật lên bản ${latest.version}, đang khởi động lại…`);
    clearTimeout(meritSaveTimer); fs.writeFileSync(MERIT_FILE, JSON.stringify(Object.fromEntries(merit)));
    saveSession();
    setTimeout(() => process.exit(42), 500);
  } catch (e) {
    updating = false; addLog('❌ Cập nhật thất bại: ' + e.message); updateState({ error: 'Cập nhật thất bại: ' + e.message });
  } finally { fs.rm(tmp, { recursive: true, force: true }, () => {}); }
}

// An update restarts the server mid-live: the seated viewers and the TikTok username are written to live/session.json
// just before, and the new server (started by Mo-Chanh-Dien.bat with CD_RESTARTED=1) seats them again and reconnects.
// A normal start ignores the file, so yesterday's crowd never reappears.
const SESSION_FILE = path.join(__dirname, 'session.json');
function saveSession(){
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify({ savedAt: Date.now(), tiktok: wantTikTok, viewers: [...viewers.values()], xam: [...xamDrawn] })); }
  catch (e) { addLog('Không lưu được danh sách bồ đoàn: ' + e.message); }
}
function restoreSession(){
  let s; try { s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); fs.rmSync(SESSION_FILE, { force: true }); } catch { return; }
  if (!process.env.CD_RESTARTED || !(Date.now() - s.savedAt < 10 * 60_000)) return;
  for (const p of Array.isArray(s.viewers) ? s.viewers.slice(0, 5000) : []){
    const id = String(p?.id || '').slice(0, 100); if (!id || blocked.has(id) || viewers.has(id)) continue;
    viewers.set(id, { id, name: cleanName(p.name, id), skin: String(p.skin || DEFAULT_SKINS[0]).slice(0, 20), avatar: String(p.avatar || '').slice(0, 1000),
      coins: merit.get(id)?.coins || 0, joinedAt: +p.joinedAt || Date.now(), lastAt: +p.lastAt || Date.now(),
      lastText: String(p.lastText || '').slice(0, 200), lastTextAt: +p.lastTextAt || 0 });
  }
  for (const id of Array.isArray(s.xam) ? s.xam.slice(0, 5000) : []) if (typeof id === 'string') xamDrawn.add(id.slice(0, 100));
  if (viewers.size){ broadcast(snapshot()); addLog(`↩︎ Đã đưa ${viewers.size} người về lại bồ đoàn sau khi cập nhật`); }
  if (s.tiktok) connectTikTok(String(s.tiktok).slice(0, 60));
}

/* ------------------------------------------------------------- control */
function onControl(m){
  switch (m.cmd){
    case 'connect': connectTikTok(m.uniqueId); break;
    case 'disconnect': disconnectTikTok(); addLog('Đã ngắt kết nối TikTok'); break;
    case 'chat': { const n = String(m.name || 'Khách').slice(0, 18); onChat('sim_' + n, n, String(m.text || 'Nam mô A Di Đà Phật').slice(0, 120)); break; }
    case 'gift': { const n = String(m.name || 'Khách').slice(0, 18); onGift('sim_' + n, n, String(m.gift || 'Hoa hồng').slice(0, 30), clamp(m.count, 1, 99), clamp(m.diamonds, 1, 50000)); break; }
    case 'viewers': setViewerCount(clamp(m.n, 0, 1e7)); syncSeats(); break;     // test: pretend TikTok reported this many viewers
    case 'enter': { const n = String(m.name || 'Khách').slice(0, 18); onEnter('sim_' + n, n, /^https:\/\//.test(m.avatar) ? m.avatar : ''); break; }
    case 'clear': clearSeats(); break;
    case 'clearMerit': clearMerit(); break;
    case 'checkUpdate': checkUpdate(); break;
    case 'installUpdate': installUpdate(); break;
    case 'bell': broadcast({ t:'bell' }); break;
    case 'mo': broadcast({ t:'mo1' }); break;
    case 'chant': chant(); break;
    case 'openOverlay': if (!openOverlayWindow()) broadcast({ t:'openOverlayHere' }, 'control'); break;
    case 'notice': if (m.text) broadcast({ t:'notice', text: String(m.text).slice(0, 300) }); break;
    case 'settings': {
      const was = [settings.scene, settings.sceneAuto, settings.sceneEveryMin].join();
      applySettings(m.settings || {}); saveSettings();
      if ([settings.scene, settings.sceneAuto, settings.sceneEveryMin].join() !== was) scheduleScene();
      scheduleChant(); broadcast({ t:'settings', settings, cap: capacity(), sceneAt }); break;
    }
    case 'nextScene': nextScene(); break;
    case 'deleteFile': deleteUpload(String(m.kind), String(m.name)); break;
    case 'playTrack': playTrack(String(m.name || ''), 'Phát bài'); break;
    case 'nextTrack': nextTrack(); break;
    case 'block': if (m.id) block(String(m.id), 'chặn tay'); break;
    case 'unblock': if (m.id) unblock(String(m.id)); break;
    case 'testFilter': { const r = wordFilter.check(String(m.text || '').slice(0, 200)); broadcast({ t:'filterTest', ...r }, 'control'); break; }
  }
}

// Only known keys, right types, sane ranges: the panel is local, but nothing from the socket is trusted blindly.
const SETTING_RULES = {
  title: v => String(v).slice(0, 40), subtitle: v => String(v).slice(0, 60),
  moBpm: v => clamp(v, 20, 120), chantEveryMin: v => clamp(v, 1, 60),
  music: Boolean, mo: Boolean, autoChant: Boolean, showEnter: Boolean, syncViewers: Boolean,
  prayerFromChat: Boolean, filterOn: Boolean, xamOn: Boolean,
  filterMode: v => v === 'mask' ? 'mask' : 'hide', filterStrikes: v => clamp(v, 0, 20), filterExtra: v => String(v).slice(0, 3000),
  audioOut: v => String(v).slice(0, 120),
  scene: v => allScenes().includes(v) ? v : 'hall', sceneAuto: Boolean, sceneEveryMin: v => clamp(v, 1, 240),
  sceneOff: v => allScenes().filter(id => Array.isArray(v) && v.includes(id)),
  bgAltar: Boolean,
  guide: v => { const l = (Array.isArray(v) ? v : []).slice(0, 8).map(r => ({ icon: String(r?.icon || '').slice(0, 8), text: String(r?.text || '').slice(0, 40),
      action: ACTIONS.includes(r?.action) ? r.action : r?.action === undefined ? guessAction(r?.text) : '' })).filter(r => r.icon || r.text);
    return l.length ? l : DEFAULT_GUIDE; },
  track: v => String(v).slice(0, 200), musicAuto: Boolean,
  musicOff: v => Array.isArray(v) ? v.slice(0, 500).map(f => String(f).slice(0, 200)) : [],
  outfits: v => { const l = OUTFIT_IDS.filter(id => Array.isArray(v) && v.includes(id)); return l.length ? l : ['lam']; },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
// menu rows saved before rows had an action: take it from the built-in keyword the row shows, if any
function guessAction(text){ const w = starred(text || ''); return ACTIONS.find(a => BUILTIN_KEYWORDS[a].some(k => w.includes(plainWords(k)))) || ''; }
function applySettings(o){
  if (Array.isArray(o.guide) && o.guide.length < 8 && o.guide.every(r => r && !('action' in r)) && !o.guide.some(r => guessAction(r.text) === 'bow'))
    o = { ...o, guide: [...o.guide, DEFAULT_GUIDE.at(-1)] };                                  // menu from before actions: show the new "Lạy · Vái"
  if (Array.isArray(o.sceneCycle) && !('sceneOff' in o)) o = { ...o, sceneOff: ['hall', 'bamboo', 'lotus', 'peak'].filter(id => !o.sceneCycle.includes(id)) };   // config.json from v2026.11.03
  for (const [k, fn] of Object.entries(SETTING_RULES)) if (k in o) settings[k] = fn(o[k]); wordFilter.setExtraWords(settings.filterExtra); buildKeywords(); }
function saveSettings(){ try { fs.writeFileSync(CONFIG, JSON.stringify(settings, null, 2)); } catch (e) { addLog('Không lưu được cài đặt: ' + e.message); } }
try { applySettings(JSON.parse(fs.readFileSync(CONFIG, 'utf8'))); } catch {}
buildKeywords();                                                              // also when there is no config.json yet
if (settings.musicAuto && musicFiles.length) settings.track = pickTrack();     // every live opens on a different track
scheduleChant(); scheduleScene();

/* -------------------------------------------------------------- server */
// Security notes (this file is meant to be shared publicly):
//  • listens on 127.0.0.1 only; nothing is reachable from the LAN or internet unless HOST is changed on purpose
//  • Host header must be localhost/127.0.0.1 (blocks DNS-rebinding pages from talking to the server)
//  • WebSocket only accepts pages served by this server (Origin check), so other sites open in the
//    same browser cannot send control commands
//  • static files: only /assets and /live, no dot-files, no node_modules, no server source, no path escapes
//  • no TikTok password, cookie or session is ever used or stored; only public room events are read
const HOST = process.env.HOST || '127.0.0.1';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.ogg':'audio/ogg', '.wav':'audio/wav', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
// When HOST is opened on purpose (e.g. 0.0.0.0 to reach it from another machine on the LAN), plain IP addresses are
// accepted too. Hostnames other than localhost stay blocked, which is what stops DNS-rebinding pages.
const LOOPBACK = ['127.0.0.1', 'localhost', '::1'].includes(HOST);
const isIpHost = h => /^(\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\]):\d+$/.test(h) && h.endsWith(':' + PORT);
const okHost = h => { h = String(h || '').toLowerCase(); return ALLOWED_HOSTS.has(h) || (!LOOPBACK && isIpHost(h)); };
const SEP = path.sep;
function resolveStatic(urlPath){
  let p = urlPath === '/' ? '/live/control.html' : urlPath;
  if (!/^\/(assets|live)\//.test(p)) return null;
  if (p.split('/').some(seg => seg.startsWith('.') || seg === 'node_modules')) return null;
  if (/\.(mjs|json|md|log)$/i.test(p) && !p.startsWith('/assets/')) return null;      // never serve server code / package files
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + SEP)) return null;
  return file;
}
/* -------------------------------------------------------------- uploads */
// The panel uploads music (assets/music) and backgrounds (assets/bg) as a plain POST of the file's bytes.
//  • same Host rule as everything else, plus an Origin from this server: pages on other sites can't post here
//  • a custom header, which a cross-site form can't send without a CORS preflight this server never answers
//  • known extensions only, checked against the file's first bytes; size capped; never overwrites (adds " (2)")
const startsWith = (b, s, at = 0) => b.length >= at + s.length && b.toString('latin1', at, at + s.length) === s;
const UPLOADS = {
  music: { dir: MUSIC_DIR, max: 60e6, ext: /\.(mp3|m4a|ogg|wav)$/i, label: 'nhạc .mp3 .m4a .ogg .wav', after: refreshMusic,
    sniff: b => startsWith(b, 'ID3') || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) || startsWith(b, 'ftyp', 4) || startsWith(b, 'OggS') || (startsWith(b, 'RIFF') && startsWith(b, 'WAVE', 8)) },
  bg: { dir: BG_DIR, max: 20e6, ext: /\.(jpe?g|png|webp)$/i, label: 'ảnh .jpg .png .webp', after: refreshBg,
    sniff: b => (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) || startsWith(b, '\x89PNG') || (startsWith(b, 'RIFF') && startsWith(b, 'WEBP', 8)) },
};
function cleanFileName(n){
  n = path.basename(String(n || '').normalize('NFC')).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/^[.\s]+/, '').trim();
  const ext = path.extname(n), base = n.slice(0, n.length - ext.length).slice(0, 100 - ext.length).trim();
  return base && ext.length <= 6 ? base + ext : '';
}
function freeName(dir, n){
  const ext = path.extname(n), base = n.slice(0, -ext.length || undefined);
  for (let i = 1; ; i++){ const f = i === 1 ? n : `${base} (${i})${ext}`; if (!fs.existsSync(path.join(dir, f))) return f; }
}
function onUpload(req, res, url){
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(o)); };
  const fail = (code, error) => { req.resume(); json(code, { error }); };
  let origin = ''; try { origin = new URL(req.headers.origin).host; } catch {}
  if (!okHost(origin) || req.headers['x-chanhdien'] !== 'upload') return fail(403, 'Không được phép');
  const u = UPLOADS[url.searchParams.get('kind')];
  if (!u) return fail(400, 'Sai loại file');
  const name = cleanFileName(url.searchParams.get('name'));
  if (!name || !u.ext.test(name)) return fail(415, 'Chỉ nhận ' + u.label);
  const len = +req.headers['content-length'];
  if (!len || len > u.max) return fail(413, `File quá lớn (tối đa ${u.max / 1e6} MB)`);
  const chunks = []; let got = 0;
  req.on('data', c => { got += c.length; if (got > u.max) req.destroy(); else chunks.push(c); });
  req.on('error', () => {});
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (!u.sniff(buf)) return json(415, { error: 'File không đúng định dạng ' + u.label });
    fs.mkdirSync(u.dir, { recursive: true });
    const f = freeName(u.dir, name);
    fs.writeFile(path.join(u.dir, f), buf, { flag: 'wx' }, err => {
      if (err) return json(500, { error: 'Không lưu được: ' + err.message });
      addLog(`⬆️ Đã tải lên ${f}`); u.after(); json(200, { ok: true, name: f });
    });
  });
}
function deleteUpload(kind, name){
  const u = UPLOADS[kind], list = kind === 'music' ? musicFiles : bgFiles;
  if (!u || !list.includes(name)) return;
  fs.unlink(path.join(u.dir, name), err => { if (err) return addLog(`❌ Không xóa được ${name}: ${err.message}`); addLog(`🗑 Đã xóa ${name}`); u.after(); });
}

const server = http.createServer((req, res) => {
  if (!okHost(req.headers.host)) { res.writeHead(421).end('wrong host'); return; }
  let url, p; try { url = new URL(req.url, 'http://x'); p = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (req.method === 'POST' && p === '/upload') return onUpload(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  const file = resolveStatic(p);
  if (!file) { res.writeHead(404).end('not found'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
});
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024,
  verifyClient: ({ origin, req }) => {
    if (!okHost(req.headers.host)) return false;
    if (!origin) return true;                                   // OBS / non-browser clients send no Origin
    try { return okHost(new URL(origin).host); } catch { return false; }
  } });
function broadcast(msg, only){ const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1 && (!only || c.role === only)) c.send(s); }
// Overlay windows (not the silent previews) report whether they have sound, so the panel can warn when they don't,
// plus the sound devices they can play to and the one in use (for the "Phát âm thanh ra" picker).
function overlayStatus(){
  const list = [...wss.clients].filter(c => c.readyState === 1 && c.role === 'overlay');
  const dev = list.find(c => c.outs?.length) || list[0];
  return { t:'overlays', open: list.length, sound: list.filter(c => c.audio).length, outs: dev?.outs || [], sink: dev?.sink || '' };
}
wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'http://x').searchParams.get('role');
  ws.role = ['control', 'preview'].includes(role) ? role : 'overlay';
  ws.send(JSON.stringify(snapshot()));
  if (ws.role === 'overlay'){ broadcast(overlayStatus(), 'control'); ws.on('close', () => broadcast(overlayStatus(), 'control')); }
  if (ws.role === 'control'){ ws.send(JSON.stringify({ t:'logs', lines: log })); ws.send(JSON.stringify({ t:'blocked', list: blockedList() })); ws.send(JSON.stringify({ t:'filteredAll', list: recentFiltered })); ws.send(JSON.stringify({ t:'viewers', n: viewerCount })); ws.send(JSON.stringify(overlayStatus())); updateState(); }
  ws.on('message', buf => {
    if (ws.role === 'overlay'){                                 // overlays may only report their sound state
      try { const m = JSON.parse(buf); if (m?.t === 'audio'){
        ws.audio = !!m.on; ws.sink = String(m.sink || '').slice(0, 120);
        ws.outs = Array.isArray(m.outs) ? m.outs.slice(0, 40).map(s => String(s).slice(0, 120)) : [];
        broadcast(overlayStatus(), 'control'); }
        if (m?.t === 'ended' && m.seq === musicSeq && settings.musicAuto) nextTrack(); } catch {}
      return;
    }
    if (ws.role !== 'control') return;
    try { const m = JSON.parse(buf); if (m && m.t === 'ctl') onControl(m); } catch (e) { addLog('Lệnh lỗi: ' + e.message); }
  });
});
wss.on('error', () => {});                                    // ws re-emits the server's listen error; handled below
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`Cổng ${PORT} đang được dùng: có thể Chánh Điện đã mở ở một cửa sổ khác. Đóng cửa sổ đó hoặc đặt biến PORT khác.`);
  else console.error('Không mở được server: ' + e.message);
  process.exit(1);
});
/* ------------------------------------------------------ Windows launcher */
// With OPEN_UI=1 (set by Mo-Chanh-Dien.bat) the server opens the control panel in the default browser and the overlay
// in an Edge app window: no address bar, 9:16 at full screen height, and autoplay allowed so sound starts by itself
// (no "bật âm thanh" button showing on stream). Its own Edge profile makes the autoplay flag apply even if Edge is open.
const URL_CONTROL = `http://localhost:${PORT}/live/control.html`, URL_OVERLAY = `http://localhost:${PORT}/live/overlay.html`;
// `start` resolves "msedge" through App Paths like the Run box does. The command line is built by hand (verbatim, every
// argument quoted) because Node's own quoting mangles the empty "" window title that `start` needs.
const winStart = (...args) => spawn('cmd.exe', ['/d', '/s', '/c', `"start "" ${args.map(a => `"${a}"`).join(' ')}"`],
  { windowsVerbatimArguments: true, windowsHide: true, detached: true, stdio: 'ignore' }).unref();
function openOverlayWindow(){
  if (process.platform !== 'win32') return false;
  const ps = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Height';
  execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 8000 }, (err, out) => {
    const h = Math.max(480, Math.min(4000, parseInt(out, 10) || 960)), w = Math.round(h * 9 / 16);
    const profile = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ChanhDienLive', 'edge-overlay');
    winStart('msedge', `--app=${URL_OVERLAY}`, `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required',
      // grants the device-name permission without a prompt on stream (overlay.html reads output names, never records)
      '--use-fake-ui-for-media-stream',
      '--no-first-run', '--disable-features=Translate', `--window-size=${w},${h}`, '--window-position=0,0');
  });
  addLog('Đã mở cửa sổ overlay (Edge). Nếu không thấy, bấm "Mở cửa sổ overlay" trong bảng điều khiển.');
  return true;
}
server.listen(PORT, HOST, () => {
  addLog(`Server chạy tại http://localhost:${PORT}  ·  Bảng điều khiển: ${URL_CONTROL}  ·  Overlay: ${URL_OVERLAY}`);
  restoreSession();
  if (process.env.OPEN_UI === '1' && process.platform === 'win32' && !process.env.CD_RESTARTED){ winStart(URL_CONTROL); setTimeout(openOverlayWindow, 1500); }
  if (VERSION !== 'dev') setTimeout(checkUpdate, 5000);
});
