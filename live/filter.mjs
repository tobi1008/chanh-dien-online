// Vietnamese + English profanity filter for viewer names and comments.
//
// Two word lists, because stripping Vietnamese tone marks creates collisions ("lồn" → "lon" = "lớn"):
//   STRICT  matched against the accented text, so clean words that only differ by tone are left alone
//   LOOSE   matched against the tone-less text; only teen-code that has no common clean meaning without accents
// Words that are fine in a temple ("tổ sư", "bà vãi", "con chó") are deliberately left out.
// Matching is on whole tokens (or token sequences for phrases), after:
//   • lower-case + NFC, leetspeak (0→o, 1→i, 3→e, 4→a, @→a, $→s)
//   • stretched letters: "lồnnnn" → "lồn", "dmmm" → "dmm" / "dm"
//   • runs of single letters joined: "đ.m", "l ồ n", "v-c-l" → "đm", "lồn", "vcl"

const STRICT = [
  'lồn','loz','lìn','buồi','cặc','cặk','kặc','địt','đụ','đéo','đếch','đĩ','dái','cứt','đù','đù má','đụ má','đụ mẹ','đéo mẹ',
  'mẹ mày','má mày','con mẹ mày','bố mày','tổ cha','chó đẻ','đồ chó','thằng chó','óc chó','đồ ngu','ngu như chó',
  'súc vật','khốn nạn','mất dạy','vô học','con đĩ','đĩ điếm','điếm','cave','vãi lồn','vãi đái','vãi cứt','nứng','chịch','xoạc',
  'thủ dâm','bú cu','bú lồn','liếm lồn','dương vật','âm đạo',
];
const LOOSE = [
  'dm','dmm','dcm','dkm','dcmm','dmcs','dmvl','dume','duma','du ma','du me','dit','djt','dit me','dit con me','deo me',
  'vl','vcl','vkl','vcc','vleu','vloz','clm','cmm','cmn','cl','cc','ccc','loz','lozz','buoi to','cak','kak','kac','cax','cu to',
  'dis me','djt me','sml','oc cho','do cho','thang cho','me may','xoac',
  'fuck','fck','fuk','fucking','motherfucker','shit','bitch','dick','pussy','cunt','asshole','bastard','porn','sex',
];

const LEET = { '0':'o', '1':'i', '3':'e', '4':'a', '@':'a', '$':'s', '!':'i' };
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').normalize('NFC');
const squeeze = s => s.replace(/(.)\1{2,}/gu, '$1$1');      // 3+ repeats → 2 ("dmmmm" → "dmm")
const collapse = s => s.replace(/(.)\1+/gu, '$1');          // any repeats → 1 ("lồnn" → "lồn")
const len = s => [...s].length;

// Tokenise keeping each token's span in the original string, so matches can be masked in place.
function tokens(text){
  const raw = [];
  for (const m of String(text).normalize('NFC').matchAll(/[\p{L}\p{N}@$!]+/gu)){
    const w = m[0].toLowerCase().replace(/[0134@$!]/g, c => LEET[c]);
    if (/\p{L}/u.test(w)) raw.push({ a: m.index, b: m.index + m[0].length, w });
  }
  const out = [];
  for (let i = 0; i < raw.length; i++){                     // join runs of single letters: "đ . m" → "đm"
    let j = i, w = raw[i].w;
    if (len(w) === 1) while (raw[j + 1] && len(raw[j + 1].w) === 1) w += raw[++j].w;
    out.push({ a: raw[i].a, b: raw[j].b, w });
    i = j;
  }
  return out.map(t => {
    const acc = squeeze(t.w), bare = squeeze(strip(t.w));
    // the fully collapsed form only counts when the viewer actually stretched a letter ("lồnn"), so "vc" ≠ "vcc"
    return { a: t.a, b: t.b, acc: [acc, collapse(acc)], bare: [bare, collapse(bare)] };
  });
}

const prep = (list, key) => list.map(p => p.trim()).filter(Boolean).map(p => tokens(p).map(t => t[key][0])).filter(p => p.length);
const strictP = prep(STRICT, 'acc'), looseP = prep(LOOSE, 'bare');
let extraP = [];

/** Extra words typed by the streamer (comma or newline separated); matched both with and without accents. */
export function setExtraWords(str){
  const words = String(str || '').split(/[,\n;]+/).map(s => s.trim()).filter(Boolean).slice(0, 300);
  extraP = [...prep(words, 'acc').map(p => ['acc', p]), ...prep(words, 'bare').map(p => ['bare', p])];
}

function findSpans(text){
  const tk = tokens(text), spans = [];
  const scan = (p, key) => {
    for (let i = 0; i + p.length <= tk.length; i++)
      if (p.every((w, k) => tk[i + k][key].includes(w))) spans.push([tk[i].a, tk[i + p.length - 1].b]);
  };
  for (const p of strictP) scan(p, 'acc');
  for (const p of looseP) scan(p, 'bare');
  for (const [key, p] of extraP) scan(p, key);
  return spans;
}

/** → { bad, clean } where clean has every bad word replaced by ***. */
export function check(text){
  text = String(text || '');
  const spans = findSpans(text).sort((x, y) => y[0] - x[0] || y[1] - x[1]);
  if (!spans.length) return { bad: false, clean: text };
  let clean = text, floor = Infinity;
  for (const [a, b] of spans){ if (b > floor) continue; clean = clean.slice(0, a) + '***' + clean.slice(b); floor = a; }
  return { bad: true, clean };
}
