// 仮のBGMと効果音を、コードで作って鳴らす(音のファイルはいらない)。
// ブラウザの決まりで、画面を1回さわるまでは音を出せない。unlock() をクリックやキーで呼ぶ。
// 判定は、この AudioContext の時計(songTime)を基準にする。

import { TRACKS } from "./bgm.js";

const SETTINGS_KEY = "cookingBattle.settings";

let ctx = null;
let master = null;
let noise = null;
let muted = false;
let zero = 0; // 曲の時計の 0秒(audio時計の 秒)。あたらしい ゲームの はじめに 決める
let clockOn = false;
let seg = null; // いま ながれている 曲 {name, bpm, beat, bar, t0(曲の時計で、はじまる 秒), flavor, scheduled}
let timer = null;
let playing = false;
let watching = true;
let songBus = null; // BGMだけをまとめる音量つまみ。曲をとめるときに、まるごと切りはなす
let sources = []; // 予約したBGMの音。曲をとめるときに、ぜんぶ止める

let offsetMs = 0;

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  muted = saved.muted === true;
  if (Number.isFinite(saved.offsetMs)) offsetMs = Math.max(-200, Math.min(200, saved.offsetMs));
} catch {
  // 読めなければ、音あり・ずれ0にする。
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted, offsetMs }));
  } catch {
    // 保存できなくても、そのページを開いている間は、かわったまま。
  }
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    // 音を 大きくしても われないよう、コンプレッサーを とおす
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master.connect(comp);
    comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  if (master) {
    // すぐに、きっぱり0(または元の大きさ)にする
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
  }
  saveSettings();
}

function tone(freq, when, length, { type = "square", volume = 0.15, to = null, bus = null } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, when + length);
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(gain).connect(bus ?? master);
  if (bus) sources.push(osc);
  osc.start(when);
  osc.stop(when + length + 0.02);
}

function hiss(when, length, { volume = 0.1, freq = 7000, bus = null } = {}) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noise;
  filter.type = "highpass";
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(volume, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  src.connect(filter).connect(gain).connect(bus ?? master);
  if (bus) sources.push(src);
  src.start(when);
  src.stop(when + length + 0.02);
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// 曲(bgm.js)に わたす 楽器。いまの曲の つなぎ(songBus)に つながる
const inst = {
  midi,
  tone: (f, when, len, opts = {}) => tone(f, when, len, { ...opts, bus: songBus }),
  hiss: (when, len, opts = {}) => hiss(when, len, { ...opts, bus: songBus }),
};

// ゲームの画面が動いているあいだ、毎フレーム呼ぶ。3秒よばれなかったら、BGMだけが鳴りつづけないよう、自分で止める。
// (表紙・結果は 画面が うごかないので、watch(false) にして、止めない)
let lastAlive = 0;
export function alive() {
  lastAlive = performance.now();
}

export function watch(on) {
  watching = on;
  alive();
}

function pump() {
  if (!playing || !seg || !songBus) return;
  if (watching && performance.now() - lastAlive > 3000) {
    stopSong();
    return;
  }
  const horizon = ctx.currentTime + 1.5;
  while (zero + seg.t0 + seg.scheduled * seg.bar < horizon) {
    TRACKS[seg.name](zero + seg.t0 + seg.scheduled * seg.bar, seg, seg.scheduled, inst);
    seg.scheduled += 1;
  }
}

// 曲の時計を、まだ 動かして いなければ、動かす(表紙の 曲)
function ensureClock() {
  if (clockOn) return;
  zero = ctx.currentTime + 0.15;
  haveDrift = false;
  clockOn = true;
}

// あたらしい ゲームの はじまり:曲の時計を 0に もどす(曲は、playTrack で はじめる)
export function startSong() {
  if (!ctx) return;
  stopSong();
  zero = ctx.currentTime + 0.15;
  haveDrift = false;
  clockOn = true;
  watching = true;
  alive();
}

// 曲を かえる。at は、曲の時計での はじまりの 秒(なければ、すぐ あと)。まえの曲は、すぐ 小さくして きえる。
// かえす 値:いまの曲の {beat, bar, t0, ...}(矢印の 拍を これに そろえる)
export function playTrack(name, bpm, at, flavor = "") {
  if (!ctx || !master || !TRACKS[name]) return null;
  ensureClock();
  fadeOut();
  songBus = ctx.createGain();
  songBus.connect(master);
  seg = { name, bpm, beat: 60 / bpm, bar: 240 / bpm, t0: at ?? songTime() + 0.25, flavor, scheduled: 0 };
  playing = true;
  if (!timer) timer = setInterval(pump, 250);
  pump();
  return seg;
}

export function trackName() {
  return seg?.name ?? "";
}

export function currentTrack() {
  return seg;
}

// まえの曲を、すぐ 小さくして 止める(あたらしい曲と かさならない)
function fadeOut() {
  if (!songBus) return;
  const bus = songBus;
  const olds = sources;
  sources = [];
  const now = ctx.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setTargetAtTime(0, now, 0.03);
  for (const source of olds) {
    try {
      source.stop(now + 0.15);
    } catch {
      // もう止まっているものは、そのまま。
    }
  }
  setTimeout(() => {
    try {
      bus.disconnect();
    } catch {
      // すでに はずれている
    }
  }, 400);
  songBus = null;
}

export function stopSong() {
  playing = false;
  seg = null;
  clearInterval(timer);
  timer = null;
  // 予約ずみの音を、ぜんぶ止めて、BGMのつなぎも切る(これで、ゲームが終わったあとに鳴り続けることはない)
  for (const source of sources) {
    try {
      source.stop();
    } catch {
      // もう止まっているものは、そのまま。
    }
  }
  sources = [];
  if (songBus) {
    songBus.disconnect();
    songBus = null;
  }
}

// いま鳴る予定の音の数(動作確認用)
export function activeSources() {
  return sources.length;
}

// 曲の頭からの秒数。耳に聞こえる音に合わせる。
// audioの時計(currentTime)は、細かくカクカク進むので、そのまま使うと矢印の流れがぶれる(目が疲れる原因)。
// そこで、なめらかな performance.now() を土台にして、audioの時計とのずれだけを、ゆっくり合わせる。
// perfMs に、キーを押した時刻(event.timeStamp)を渡すと、その瞬間の曲の時刻が返る。
let drift = 0;
let haveDrift = false;

function measureDrift() {
  let measured;
  const stamp = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
  if (stamp && stamp.performanceTime > 0 && stamp.contextTime > 0) {
    measured = stamp.contextTime - stamp.performanceTime / 1000; // いまスピーカーから出ている音の時刻
  } else {
    measured = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - performance.now() / 1000;
  }
  drift = haveDrift ? drift + (measured - drift) * 0.05 : measured;
  haveDrift = true;
}

export function songTime(perfMs) {
  if (!ctx) return 0;
  if (perfMs === undefined) {
    measureDrift();
    perfMs = performance.now();
  }
  return perfMs / 1000 + drift - zero + offsetMs / 1000;
}

// 聞こえる音と矢印のずれを、利用者が直せる(ミリ秒)。プラスにすると、矢印が はやく 枠に着く。
export function getOffset() {
  return offsetMs;
}

export function setOffset(ms) {
  offsetMs = Math.max(-200, Math.min(200, Math.round(ms)));
  saveSettings();
}

// 効果音
export function playSe(name) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  if (name === "perfect") {
    tone(1320, t, 0.12, { type: "triangle", volume: 0.3 });
    tone(1980, t + 0.04, 0.12, { type: "triangle", volume: 0.2 });
  } else if (name === "good") {
    tone(880, t, 0.1, { type: "triangle", volume: 0.3 });
  } else if (name === "miss") {
    tone(160, t, 0.2, { type: "sawtooth", volume: 0.25, to: 80 });
  } else if (name === "down") {
    tone(600, t, 0.35, { type: "square", volume: 0.2, to: 120 });
    hiss(t, 0.25, { volume: 0.2, freq: 1200 });
  } else if (name === "win") {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.13, 0.3, { type: "square", volume: 0.2 }));
  } else if (name === "lose") {
    [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.2, 0.35, { type: "triangle", volume: 0.3 }));
  } else if (name === "combo") {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.18, { type: "triangle", volume: 0.4 }));
  } else if (name === "button") {
    tone(660, t, 0.08, { type: "square", volume: 0.15 });
  }
}

// 敵が「やって見せる」ときの音。矢印の向きで、音の高さがちがう。
// t は、曲の頭からの秒数(画面の時計と おなじ)。
const CUE_PITCH = { L: 392, U: 523, R: 659, D: 330 };
export function cueAtSongTime(t, key, offbeat = false) {
  if (!ctx || !master) return;
  const when = ctx.currentTime + Math.max(0, t - songTime());
  // 表拍は 高く、裏拍(半拍)は 1オクターブ 低く
  const f = (CUE_PITCH[key] ?? 440) * (offbeat ? 0.5 : 2);
  // 裏拍(半拍)の音は、低くても きこえるように、大きく・音色を はっきり
  tone(f, when, offbeat ? 0.24 : 0.2, { type: offbeat ? "square" : "triangle", volume: offbeat ? 0.55 : 0.75 });
  tone(f * 2, when, 0.08, { type: "sine", volume: offbeat ? 0.55 : 0.3 });
  if (offbeat) tone(f * 4, when, 0.04, { type: "triangle", volume: 0.4 }); // 頭の クリック
}

// 矢印の ない拍(休み)の、専用の音。矢印の音(音程のある ピッ)とは ちがう、「コツ」「シャ」「ドン」の ような 音。
//   beat=表拍の休み(木の ブロックの コツ)  half=裏拍の休み(シャカの シャ)  end=4拍めの休み(やわらかい ドン)
export function restCueAtSongTime(t, kind) {
  if (!ctx || !master) return;
  const when = ctx.currentTime + Math.max(0, t - songTime());
  if (kind === "beat") {
    tone(1046, when, 0.05, { type: "sine", volume: 0.6, to: 700 });
    hiss(when, 0.03, { volume: 0.25, freq: 5000 });
  } else if (kind === "half") {
    hiss(when, 0.06, { volume: 0.34, freq: 3500 });
    tone(520, when, 0.03, { type: "sine", volume: 0.2 });
  } else {
    tone(180, when, 0.18, { type: "sine", volume: 0.8, to: 90 });
  }
}
