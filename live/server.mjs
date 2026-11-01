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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // repo root: serves /assets, /live
const PORT = +process.env.PORT || 3000;
// live/version.txt is written by pack/build-windows.sh; a plain checkout has none and never updates itself.
const VERSION = (() => { try { return fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim(); } catch { return 'dev'; } })();
const UPDATE_REPO = process.env.UPDATE_REPO || 'tobi1008/chanh-dien-online';    // GitHub Releases published by pack/release.sh

/* ------------------------------------------------------------------ state */
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
  audioOut: '',                      // overlay sound device name, e.g. "CABLE Input" (empty = Windows default speakers)
};
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

// "thắp nhang" / "dâng hương" (with or without accents) in a comment: that viewer walks up and offers incense.
// One offering per person every 45 s, so spamming the words does not flood the altar.
const INCENSE_RE = /(th[aắ]p|d[aâ]ng)\s*(nhang|h[uư][oơ]ng)/;
const lastIncense = new Map();
function wantsIncense(id, text){
  if (!INCENSE_RE.test(String(text).toLowerCase().normalize('NFC'))) return false;
  const now = Date.now(); if (now - (lastIncense.get(id) || 0) < 45_000) return false;
  lastIncense.set(id, now); if (lastIncense.size > 5000) lastIncense.clear();
  return true;
}

function pub(v){ return { id:v.id, name:v.name, skin:v.skin, avatar:v.avatar||'', coins:v.coins }; }
function snapshot(){ return { t:'state', settings, viewers:[...viewers.values()].map(pub), cap: capacity(), startedAt, tiktok: tiktokState, merit: topMerit(), version: VERSION }; }

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
  if (!dirty && text.trim()){ v.lastText = text; v.lastTextAt = Date.now(); }    // a masked comment is never read aloud as a prayer
  broadcast({ t:'chat', id, name: v.name, text, emotes: dirty ? [] : emotes });
  if (!dirty && wantsIncense(id, text)){ broadcast({ t:'incense', id, name: v.name }); addLog(`🙏 ${v.name} lên thắp nhang`); }
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
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify({ savedAt: Date.now(), tiktok: wantTikTok, viewers: [...viewers.values()] })); }
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
    case 'settings':
      applySettings(m.settings || {}); saveSettings();
      scheduleChant(); broadcast({ t:'settings', settings, cap: capacity() }); break;
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
  prayerFromChat: Boolean, filterOn: Boolean,
  filterMode: v => v === 'mask' ? 'mask' : 'hide', filterStrikes: v => clamp(v, 0, 20), filterExtra: v => String(v).slice(0, 3000),
  audioOut: v => String(v).slice(0, 120),
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
function applySettings(o){ for (const [k, fn] of Object.entries(SETTING_RULES)) if (k in o) settings[k] = fn(o[k]); wordFilter.setExtraWords(settings.filterExtra); }
function saveSettings(){ try { fs.writeFileSync(CONFIG, JSON.stringify(settings, null, 2)); } catch (e) { addLog('Không lưu được cài đặt: ' + e.message); } }
try { applySettings(JSON.parse(fs.readFileSync(CONFIG, 'utf8'))); } catch {}
scheduleChant();

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
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp3':'audio/mpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
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
const server = http.createServer((req, res) => {
  if (!okHost(req.headers.host)) { res.writeHead(421).end('wrong host'); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
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
        broadcast(overlayStatus(), 'control'); } } catch {}
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
