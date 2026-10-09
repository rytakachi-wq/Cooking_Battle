// 仮のBGMと効果音を、コードで作って鳴らす(音のファイルはいらない)。
// ブラウザの決まりで、画面を1回さわるまでは音を出せない。unlock() をクリックやキーで呼ぶ。
// 判定は、この AudioContext の時計(songTime)を基準にする。

import { BPM, BEAT, BAR } from "./game.js";

const SETTINGS_KEY = "cookingBattle.settings";

let ctx = null;
let master = null;
let noise = null;
let muted = false;
let startAt = 0;
let nextBarToSchedule = 0;
let timer = null;
let playing = false;
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
    master.connect(ctx.destination);
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

// コード進行(C → Am → F → G)。1小節ずつ。
const ROOTS = [48, 45, 41, 43];
const MELODY = [
  [0, 4, 7, 4, 9, 7, 4, 2],
  [0, 3, 7, 3, 7, 10, 7, 3],
  [0, 4, 9, 4, 7, 4, 0, 4],
  [2, 7, 11, 7, 14, 11, 7, 2],
];

// 1小節ぶんの音を、時刻を決めて予約する。
function scheduleBar(bar) {
  const t0 = startAt + bar * BAR;
  const root = ROOTS[bar % 4];
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * BEAT;
    tone(120, t, 0.2, { type: "sine", volume: 0.9, to: 42, bus: songBus }); // キック(拍の頭がはっきりわかるように、大きめ)
    if (b % 2 === 1) hiss(t, 0.14, { volume: 0.3, freq: 2000, bus: songBus }); // スネア
  }
  // ベースは、4分音符(拍の頭)。ハイハットは、拍の頭を はっきり、あいだは ごく小さく
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * BEAT;
    const note = b === 2 ? root - 5 : root; // 3拍めだけ、すこし ひくい音
    tone(midi(note - 12), t, BEAT - 0.05, { type: "triangle", volume: 0.34, bus: songBus });
    hiss(t, 0.05, { volume: 0.12, bus: songBus });
    hiss(t + BEAT / 2, 0.03, { volume: 0.035, bus: songBus });
    // 表拍(拍の頭)は 高い音、裏拍(半拍)は 低い音。矢印の「半拍」の ものさしと そろえる
    tone(1568, t, 0.07, { type: "triangle", volume: 0.2, bus: songBus });
    tone(587, t + BEAT / 2, 0.09, { type: "square", volume: 0.1, bus: songBus });
    tone(294, t + BEAT / 2, 0.1, { type: "triangle", volume: 0.3, bus: songBus });
  }
  // メロディは、1拍ごと(ゆっくり)。拍をじゃましない
  for (let h = 0; h < 4; h += 1) {
    tone(midi(root + 12 + MELODY[bar % 4][h * 2]), t0 + h * BEAT, BEAT * 0.9, { type: "square", volume: 0.028, bus: songBus });
  }
}

// ゲームの画面が動いているあいだ、毎フレーム呼ぶ。3秒よばれなかったら、BGMだけが鳴りつづけないよう、自分で止める。
let lastAlive = 0;
export function alive() {
  lastAlive = performance.now();
}

function pump() {
  if (!playing) return;
  if (performance.now() - lastAlive > 3000) {
    stopSong();
    return;
  }
  while (startAt + nextBarToSchedule * BAR < ctx.currentTime + 1.5) {
    scheduleBar(nextBarToSchedule);
    nextBarToSchedule += 1;
  }
}

// 曲の頭(0秒)を、すぐあとにして流しはじめる。
export function startSong() {
  if (!ctx) return;
  stopSong();
  songBus = ctx.createGain();
  songBus.connect(master);
  alive();
  startAt = ctx.currentTime + 0.15;
  haveDrift = false;
  nextBarToSchedule = 0;
  playing = true;
  pump();
  timer = setInterval(pump, 250);
}

export function stopSong() {
  playing = false;
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
  return perfMs / 1000 + drift - startAt + offsetMs / 1000;
}

// 聞こえる音と矢印のずれを、利用者が直せる(ミリ秒)。プラスにすると、矢印が はやく 枠に着く。
export function getOffset() {
  return offsetMs;
}

export function setOffset(ms) {
  offsetMs = Math.max(-200, Math.min(200, Math.round(ms)));
  saveSettings();
}

export function bpm() {
  return BPM;
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
  tone(f, when, offbeat ? 0.24 : 0.2, { type: offbeat ? "square" : "triangle", volume: offbeat ? 0.26 : 0.38 });
  tone(f * 2, when, 0.08, { type: "sine", volume: offbeat ? 0.3 : 0.14 });
  if (offbeat) tone(f * 4, when, 0.04, { type: "triangle", volume: 0.2 }); // 頭の クリック
}
