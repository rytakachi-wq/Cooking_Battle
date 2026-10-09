// ゲームのルール(画面や音には触らない)。得点・体力・敵ごとの矢印の並びを決める。

export const BPM = 120;
export const BEAT = 60 / BPM; // 1拍の秒数
export const BAR_BEATS = 4; // 1小節の拍数
export const BAR = BEAT * BAR_BEATS;

export const WINDOW = { perfect: 0.07, good: 0.14 }; // 押すタイミングの許す差(秒)
export const PLAYER_HP = 100;
export const MISS_DAMAGE = 8; // ミスしたときに受けるダメージ
export const HIT_DAMAGE = { perfect: 12, good: 8 }; // 敵に与えるダメージ
export const HIT_SCORE = { perfect: 100, good: 60 };

// 矢印キーの対応。L=←, U=↑, R=→, D=↓
export const ARROW_KEYS = { ArrowLeft: "L", ArrowUp: "U", ArrowRight: "R", ArrowDown: "D" };
export const ARROW_GLYPH = { L: "←", U: "↑", R: "→", D: "↓" };

// あとから足す操作。いまは押されても何も起きない(scheme.md の「キー（追加）」を参照)。
export const EXTRA_KEYS = { Numpad0: "attack", NumpadEnter: "jump" };

// 敵(料理の手順の順)。patterns は、1小節(4拍)の中で押す矢印の並び。[拍の位置, 矢印]。
// 敵ごとに2〜4個。どの並びも拍の頭か半拍で、1小節に収まる。同じ敵の中ではおなじ「ぶんいき」にする。
export const ENEMIES = [
  {
    id: "egg",
    name: "卵",
    step: "① 卵を割れ！",
    hp: 90,
    patterns: [
      [[0, "L"], [2, "R"]],
      [[0, "L"], [1.5, "R"]],
      [[1, "L"], [3, "R"]],
    ],
  },
  {
    id: "milk",
    name: "牛乳",
    step: "② 牛乳を注げ！",
    hp: 120,
    patterns: [
      [[0, "D"], [1, "D"], [3, "U"]],
      [[0, "D"], [2, "D"], [3, "U"]],
      [[0, "D"], [1.5, "D"], [3, "U"]],
    ],
  },
  {
    id: "mix",
    name: "ホットケーキミックス",
    step: "③ ミックスを混ぜろ！",
    hp: 120,
    // ちょっとだけ簡単に:4個の並びは1つにして、あとは3個(まわす向きは そのまま)
    patterns: [
      [[0, "L"], [1, "U"], [2, "R"], [3, "D"]],
      [[0, "L"], [1, "U"], [2, "R"]],
      [[0, "R"], [1, "U"], [2, "L"]],
      [[0, "U"], [2, "R"], [3, "D"]],
    ],
  },
  {
    id: "butter",
    name: "バター",
    step: "④ バターで焼け！",
    hp: 140,
    patterns: [
      [[0, "U"], [1, "R"], [2.5, "D"]],
      [[0, "U"], [2, "R"], [3, "D"]],
      [[0, "U"], [1.5, "R"], [3, "D"]],
    ],
  },
  {
    id: "syrup",
    name: "メープルシロップ",
    step: "⑤ ラスボス！ シロップをかけろ！",
    hp: 240,
    boss: true,
    patterns: [
      [[0, "L"], [1, "D"], [2, "U"], [3, "R"]],
      [[0, "L"], [0.5, "L"], [2, "D"], [3, "U"]],
      [[0, "D"], [1, "R"], [2, "U"], [2.5, "L"]],
      [[0, "R"], [1.5, "D"], [2, "L"], [3, "U"]],
    ],
  },
];

export function createState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    playerHp: PLAYER_HP,
    enemyIndex: 0,
    enemyHp: ENEMIES[0].hp,
  };
}

// 押した時刻と音符の時刻の差(秒)から判定する。はずれすぎなら null。
export function judge(diff) {
  const d = Math.abs(diff);
  if (d <= WINDOW.perfect) return "perfect";
  if (d <= WINDOW.good) return "good";
  return null;
}

// 1小節ぶんの音符を作る。前回と同じ並びは続けて出さない。
export function makeBar(enemy, barStart, lastPattern = -1, random = Math.random) {
  const choices = enemy.patterns.map((_, i) => i).filter((i) => i !== lastPattern);
  const index = choices[Math.floor(random() * choices.length)];
  const notes = enemy.patterns[index].map(([beat, key]) => ({
    time: barStart + beat * BEAT,
    key,
    status: "pending", // pending → hit / miss
  }));
  return { index, notes };
}

// 当たり。敵を倒したら true を返す。
export function registerHit(state, grade) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state[grade] += 1;
  state.score += HIT_SCORE[grade] + Math.min(state.combo, 50) * 2;
  state.enemyHp = Math.max(0, state.enemyHp - HIT_DAMAGE[grade]);
  return state.enemyHp === 0;
}

// ミス。主人公がやられたら true を返す。
export function registerMiss(state) {
  state.combo = 0;
  state.miss += 1;
  state.playerHp = Math.max(0, state.playerHp - MISS_DAMAGE);
  return state.playerHp === 0;
}

// つぎの敵へ。もう敵がいなければ false。
export function nextEnemy(state) {
  if (state.enemyIndex >= ENEMIES.length - 1) return false;
  state.enemyIndex += 1;
  state.enemyHp = ENEMIES[state.enemyIndex].hp;
  return true;
}

export function accuracy(state) {
  const total = state.perfect + state.good + state.miss;
  return total === 0 ? 0 : (state.perfect + state.good * 0.6) / total;
}

export function rank(state) {
  const a = accuracy(state);
  if (a >= 0.95) return "S";
  if (a >= 0.85) return "A";
  if (a >= 0.7) return "B";
  return "C";
}
