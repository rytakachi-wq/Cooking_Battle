// BGM(コードで 作る 曲)。場面ごと:表紙・問題・戦い・ボス・結果(かち・まけ)。
// 明るく にぎやかな ポップ。楽器は、ぜんぶ Web Audio の 合成音(音の ファイルは いらない)。
// audio.js が、1小節ずつ「時刻を 決めて」予約する。builder(t0, seg, i, I):
//   t0=この小節の はじまり(audio時計の 秒)  seg=いまの曲(beat=1拍の秒数, bar=1小節の秒数, flavor=敵の id)
//   i=曲の はじめから 数えた 小節の番号  I=楽器(tone, hiss, midi)
// 戦い・ボスの 曲は、矢印の 拍と そろえる(表拍=高い クリック、裏拍=低い クリック)。テンポは、敵ごとに かわる。

// ---- 楽器 ----
const kick = (I, t, v = 0.85) => I.tone(120, t, 0.2, { type: "sine", volume: v, to: 42 });
const snare = (I, t, v = 0.3) => {
  I.hiss(t, 0.14, { volume: v, freq: 2000 });
  I.tone(190, t, 0.08, { type: "triangle", volume: v * 0.8, to: 120 });
};
const hat = (I, t, v = 0.1) => I.hiss(t, 0.04, { volume: v });
const clap = (I, t, v = 0.25) => {
  I.hiss(t, 0.05, { volume: v, freq: 1500 });
  I.hiss(t + 0.012, 0.08, { volume: v * 0.8, freq: 1500 });
};
const pluck = (I, n, t, len, v = 0.11) => {
  const f = I.midi(n);
  I.tone(f, t, len, { type: "triangle", volume: v });
  I.tone(f * 2, t, len * 0.5, { type: "sine", volume: v * 0.4 });
};
const crash = (I, t, v = 0.14) => I.hiss(t, 0.6, { volume: v, freq: 6500 });
const bass = (I, n, t, len, v = 0.34) => I.tone(I.midi(n), t, len, { type: "triangle", volume: v });
const stab = (I, notes, t, len, v = 0.07) => notes.forEach((n) => I.tone(I.midi(n), t, len, { type: "triangle", volume: v }));
const bell = (I, n, t, len, v = 0.1) => {
  const f = I.midi(n);
  I.tone(f, t, len, { type: "sine", volume: v });
  I.tone(f * 3, t, len * 0.4, { type: "sine", volume: v * 0.3 });
};

// 拍の クリック:表拍=高い、裏拍(半拍)=低い。矢印の「拍のものさし」と、おなじ。
function ticks(I, t, beat) {
  // 表拍だけ。裏拍の「コッ」は、半拍の矢印・休みの合図(audio.js)が鳴らすので、BGMでは鳴らさない
  I.rtone(1568, t, 0.09, { type: "triangle", volume: 0.55 });
  I.rtone(1568, t, 0.04, { type: "square", volume: 0.16 });
}

// ---- 曲の 材料 ----
// 戦い:C → G → Am → F。メロディは 1小節 8こ(8分音符)。0 は おやすみ。
const FIGHT_ROOTS = [48, 43, 45, 41];
const FIGHT_STABS = [
  [60, 64, 67],
  [59, 62, 67],
  [57, 60, 64],
  [57, 60, 65],
];
const FIGHT_SETS = [
  {
    A: [
      [76, 0, 72, 76, 79, 0, 76, 0],
      [74, 0, 71, 74, 79, 0, 74, 0],
      [72, 0, 69, 72, 76, 0, 72, 0],
      [72, 0, 69, 72, 77, 76, 74, 0],
    ],
    B: [
      [79, 0, 76, 79, 84, 0, 79, 0],
      [79, 0, 74, 79, 83, 0, 79, 0],
      [76, 0, 72, 76, 81, 0, 76, 0],
      [77, 0, 72, 77, 81, 79, 77, 76],
    ],
  },
  {
    A: [
      [72, 74, 76, 0, 79, 0, 76, 74],
      [74, 71, 74, 79, 0, 74, 71, 0],
      [72, 69, 72, 76, 0, 72, 69, 0],
      [72, 77, 0, 76, 74, 72, 0, 0],
    ],
    B: [
      [79, 76, 72, 76, 79, 0, 84, 0],
      [83, 79, 74, 79, 83, 0, 79, 0],
      [81, 76, 72, 76, 81, 0, 76, 0],
      [77, 81, 84, 0, 81, 77, 0, 0],
    ],
  },
];
// 敵ごとの 調(半音の うえさげ)・メロディの タイプ・にぎやかさ(level 0〜3。ボスは 別の曲)
// 敵が すすむほど、音が ふえて 元気に なる:
//   level0 ドラムと ベースと メロディだけ(すっきり)
//   level1 + うらの コード・おわりの フィル・クラッシュ
//   level2 + 細かい ハット・はねる ベース・きらきらの アルペジオ
//   level3 + クラップ・うらの キック・オクターブの 重ね
const FLAVOR = {
  egg: { shift: 0, set: 0, level: 0 },
  milk: { shift: 2, set: 1, level: 1 },
  mix: { shift: 4, set: 0, level: 2 },
  butter: { shift: 5, set: 1, level: 3 },
  onion: { shift: 0, set: 0, level: 0 },
  carrot: { shift: 2, set: 1, level: 1 },
  cabbage: { shift: 4, set: 0, level: 2 },
  consomme: { shift: 5, set: 1, level: 3 },
};

function fight(t0, seg, i, I) {
  const beat = seg.beat;
  const fl = FLAVOR[seg.flavor] ?? FLAVOR.egg;
  const lv = fl.level;
  const ci = i % 4;
  const phrase = FIGHT_SETS[fl.set][i % 8 < 4 ? "A" : "B"][ci];
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * beat;
    ticks(I, t, beat);
    hat(I, t, 0.1);
    hat(I, t + beat / 2, lv >= 1 ? 0.08 : 0.05);
    if (lv >= 2) {
      hat(I, t + beat / 4, 0.03);
      hat(I, t + (beat * 3) / 4, 0.03);
    }
    if (b % 2 === 0) kick(I, t, 0.8);
    else {
      snare(I, t, 0.3);
      if (lv >= 3) clap(I, t, 0.16);
    }
    if (lv >= 3 && b === 1) kick(I, t + beat / 2, 0.5);
    // ベース:すすむほど はねる(8分)
    const root = FIGHT_ROOTS[ci] + fl.shift + (b === 2 ? -5 : 0);
    if (lv >= 2) {
      bass(I, root, t, beat * 0.45);
      bass(I, root + 12, t + beat / 2, beat * 0.4, 0.26);
    } else {
      bass(I, root, t, beat - 0.05);
    }
  }
  if (i === 0) return; // はじめの 1小節は、じゅんびの 小節(メロディなし)
  // 8小節ごとの はじめに クラッシュ
  if (lv >= 1 && i % 8 === 0) crash(I, t0);
  // コードの スタブ:うら拍で
  if (lv >= 1) [0.5, 2.5].forEach((h) => stab(I, FIGHT_STABS[ci].map((n) => n + fl.shift), t0 + h * beat, beat * 0.4, 0.07));
  // 4小節めの おわりは フィル
  if (lv >= 1 && ci === 3) {
    snare(I, t0 + beat * 3.5, 0.2);
    snare(I, t0 + beat * 3.75, 0.24);
  }
  // きらきらの アルペジオ(コードを 高い 音で)
  if (lv >= 2) {
    FIGHT_STABS[ci].forEach((n, k) => bell(I, n + 24 + fl.shift, t0 + beat * 3 + (k * beat) / 3, beat * 0.5, 0.045));
  }
  // メロディ
  phrase.forEach((n, s) => {
    if (!n) return;
    pluck(I, n + fl.shift, t0 + (s * beat) / 2, beat * 0.45, 0.1);
    if (lv >= 3) pluck(I, n + fl.shift + 12, t0 + (s * beat) / 2, beat * 0.4, 0.035); // オクターブの 重ね
  });
}

// ボス:Am → F → C → G。はやく、ちから強く。ベースは 8分、高い アルペジオ
const BOSS_ROOTS = [45, 41, 48, 43];
const BOSS_ARP = [
  [69, 72, 76],
  [65, 69, 72],
  [72, 76, 79],
  [67, 71, 74],
];
const BOSS_MELODY = {
  A: [
    [81, 0, 81, 76, 0, 79, 0, 76],
    [77, 0, 77, 72, 0, 76, 0, 72],
    [79, 0, 79, 76, 0, 84, 0, 79],
    [79, 0, 83, 79, 0, 74, 0, 79],
  ],
  B: [
    [84, 0, 84, 81, 0, 84, 0, 81],
    [81, 0, 81, 77, 0, 81, 0, 77],
    [84, 0, 79, 84, 0, 86, 0, 84],
    [83, 0, 86, 83, 0, 79, 0, 83],
  ],
};

function boss(t0, seg, i, I) {
  const beat = seg.beat;
  const ci = i % 4;
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * beat;
    ticks(I, t, beat, seg.half !== false);
    kick(I, t, b % 2 === 0 ? 0.95 : 0.6);
    if (b % 2 === 1) {
      snare(I, t, 0.34);
      clap(I, t, 0.18);
    }
    hat(I, t, 0.12);
    hat(I, t + beat / 2, 0.08);
    // 8分の ベース(はげしく)
    bass(I, BOSS_ROOTS[ci], t, beat * 0.45, 0.36);
    bass(I, BOSS_ROOTS[ci] + (b === 3 ? 7 : 12), t + beat / 2, beat * 0.4, 0.3);
  }
  if (i === 0) return;
  if (i % 4 === 0) crash(I, t0, 0.18);
  // 16分の アルペジオ
  for (let s = 0; s < 16; s += 1) {
    const n = BOSS_ARP[ci][s % 3] + (s % 6 >= 3 ? 12 : 0);
    pluck(I, n, t0 + (s * beat) / 4, beat * 0.2, 0.05);
  }
  // メロディ
  BOSS_MELODY[i % 8 < 4 ? "A" : "B"][ci].forEach((n, s) => {
    if (!n) return;
    pluck(I, n, t0 + (s * beat) / 2, beat * 0.45, 0.11);
    pluck(I, n + 12, t0 + (s * beat) / 2, beat * 0.4, 0.04); // オクターブの 重ね(ボスは にぎやか)
  });
}

// 問題:おちついた、ちょっと かんがえる 感じ(でも 明るい)。拍の クリックは なし。
const QUIZ_ROOTS = [48, 45, 41, 43];
const QUIZ_CHORDS = [
  [60, 64, 67, 72],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 59, 62, 67],
];
const QUIZ_BELLS = [
  [84, 0, 0, 79, 0, 0, 76, 0],
  [81, 0, 0, 76, 0, 0, 72, 0],
  [77, 0, 0, 81, 0, 0, 84, 0],
  [79, 0, 0, 83, 0, 79, 0, 0],
];

function quiz(t0, seg, i, I) {
  const beat = seg.beat;
  const ci = i % 4;
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * beat;
    if (b % 2 === 0) bass(I, QUIZ_ROOTS[ci], t, beat * 1.8, 0.2);
    hat(I, t + beat / 2, 0.04);
  }
  QUIZ_CHORDS[ci].forEach((n, k) => {
    pluck(I, n, t0 + (k * beat) / 2, beat * 1.2, 0.05);
    pluck(I, n, t0 + beat * 2 + (k * beat) / 2, beat * 1.2, 0.045);
  });
  // はずむ 小さな 音(明るく、考えるじゃまは しない)
  QUIZ_CHORDS[ci].forEach((n, k) => pluck(I, n + 12, t0 + beat * (k + 0.5), beat * 0.3, 0.03));
  QUIZ_BELLS[ci].forEach((n, s) => {
    if (n) bell(I, n, t0 + (s * beat) / 2, beat * 1.6, 0.06);
  });
}

// 表紙:にぎやかな ごあいさつ(8小節)
const COVER_ROOTS = [48, 43, 45, 41, 48, 43, 41, 43];
const COVER_STABS = [
  [60, 64, 67],
  [59, 62, 67],
  [57, 60, 64],
  [57, 60, 65],
  [60, 64, 67],
  [59, 62, 67],
  [57, 60, 65],
  [59, 62, 67],
];
const COVER_MELODY = [
  [79, 0, 76, 79, 84, 0, 83, 79],
  [79, 0, 74, 79, 83, 0, 79, 74],
  [81, 0, 76, 81, 84, 0, 81, 76],
  [77, 0, 72, 77, 81, 79, 77, 72],
  [79, 76, 79, 84, 86, 0, 84, 79],
  [83, 79, 83, 86, 91, 0, 86, 83],
  [84, 81, 77, 81, 84, 0, 81, 77],
  [83, 0, 79, 83, 86, 0, 0, 0],
];

function cover(t0, seg, i, I) {
  const beat = seg.beat;
  const ci = i % 8;
  for (let b = 0; b < 4; b += 1) {
    const t = t0 + b * beat;
    if (b % 2 === 0) kick(I, t, 0.7);
    else {
      snare(I, t, 0.22);
      clap(I, t, 0.12);
    }
    hat(I, t, 0.08);
    hat(I, t + beat / 2, 0.05);
    bass(I, COVER_ROOTS[ci], t, beat - 0.05, 0.28);
  }
  [0.5, 1.5, 2.5, 3.5].forEach((h) => stab(I, COVER_STABS[ci], t0 + h * beat, beat * 0.3, 0.06));
  if (ci % 4 === 0) crash(I, t0, 0.1);
  COVER_MELODY[ci].forEach((n, s) => {
    if (n) pluck(I, n, t0 + (s * beat) / 2, beat * 0.45, 0.1);
  });
}

// 結果(かち):ファンファーレ → うきうきの ループ
function resultWin(t0, seg, i, I) {
  const beat = seg.beat;
  if (i === 0) {
    [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, s) => pluck(I, n, t0 + (s * beat) / 2, beat * 0.6, 0.14));
    [48, 52, 55].forEach((n) => I.tone(I.midi(n), t0, beat * 3, { type: "triangle", volume: 0.15 }));
    kick(I, t0, 0.9);
    kick(I, t0 + beat * 2, 0.9);
    snare(I, t0 + beat * 3, 0.4);
    return;
  }
  if (i === 1) {
    bell(I, 96, t0, beat * 3, 0.12);
    [60, 64, 67, 72].forEach((n) => I.tone(I.midi(n), t0, beat * 4, { type: "triangle", volume: 0.12 }));
    return;
  }
  cover(t0, seg, i - 2, I); // そのあとは、表紙の 明るい 曲
}

// 結果(まけ):やさしい、はげます ような 曲(ドラムなし)
const LOSE_CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];
const LOSE_MELODY = [
  [76, 0, 0, 72, 0, 0, 69, 0],
  [72, 0, 0, 69, 0, 0, 65, 0],
  [74, 0, 0, 77, 0, 0, 74, 0],
  [76, 0, 0, 80, 0, 0, 83, 0],
];
function resultLose(t0, seg, i, I) {
  const beat = seg.beat;
  const ci = i % 4;
  LOSE_CHORDS[ci].forEach((n, k) => pluck(I, n, t0 + (k * beat) / 2, beat * 2.2, 0.06));
  bass(I, LOSE_CHORDS[ci][0] - 12, t0, beat * 3.5, 0.2);
  LOSE_MELODY[ci].forEach((n, s) => {
    if (n) bell(I, n, t0 + (s * beat) / 2, beat * 1.6, 0.08);
  });
}

// 自分で作った曲を つかうとき:曲は ファイルが 鳴らすので、拍の クリック(リズムの つまみ)だけ ここで 鳴らす
function ticksOnly(t0, seg, i, I) {
  for (let b = 0; b < 4; b += 1) ticks(I, t0 + b * seg.beat, seg.beat);
}

export const TICKS_ONLY = ticksOnly;
export const TRACKS = { cover, quiz, fight, boss, result_win: resultWin, result_lose: resultLose };
