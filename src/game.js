// ゲームのルール(画面や音には触らない)。得点・体力・敵ごとの矢印の並びを決める。

import { DEFAULT_RECIPE } from "./recipes.js";

export const BPM = 120;
export const BEAT = 60 / BPM; // 1拍の秒数
export const BAR_BEATS = 4; // 1小節の拍数
export const BAR = BEAT * BAR_BEATS;

export const WINDOW = { perfect: 0.07, good: 0.14 }; // 押すタイミングの許す差(秒)
export const PLAYER_HP = 100;
export const MISS_DAMAGE = 8; // ミスしたときに受けるダメージ
export const HIT_DAMAGE = { perfect: 18, good: 12 }; // 敵に与えるダメージ
// リズムでのミスが、この数に なると、「料理が しっぱい」の見た目になる(手順ならべの まちがいとは、べつ)
export const COOK_FAIL_MISSES = 3;
export const QUIZ_MISS_DAMAGE = 8; // 手順ならべを まちがえたとき、主人公が うける ダメージ
export const PENALTY = 1.15; // 手順えらびを まちがえたとき、次の敵の体力が ふえる倍率
export const HIT_SCORE = { perfect: 100, good: 60 };

// 矢印キーの対応。L=←, U=↑, R=→, D=↓
export const ARROW_KEYS = { ArrowLeft: "L", ArrowUp: "U", ArrowRight: "R", ArrowDown: "D" };
export const ARROW_GLYPH = { L: "←", U: "↑", R: "→", D: "↓" };

// あとから足す操作。いまは押されても何も起きない(scheme.md の「キー（追加）」を参照)。
export const EXTRA_KEYS = { Numpad0: "attack", NumpadEnter: "jump" };

export function createState(recipe = DEFAULT_RECIPE) {
  return {
    recipe,
    tips: [], // 出てきた豆知識(結果画面で見返す)
    review: [], // 手順えらびの記録(結果画面で見返す)
    fails: {}, // 手順ならべを まちがえた敵(敵のid → true)。敵が強くなる(体力+15%・強い姿)
    cookFails: {}, // リズムで ミスが多くて、料理が しっぱいした手順(敵のid → true)。調理台の絵に出る
    enemyMisses: 0, // いまの敵との リズムでの ミスの数
    steps: {}, // えらんだやりかたの動き(敵のid → 文字の並び)。矢印のお皿の下に出る
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0,
    playerHp: PLAYER_HP,
    enemyIndex: 0,
    enemyHp: recipe.enemies[0].hp,
    enemyMax: recipe.enemies[0].hp,
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
// beatLen・barLen:その敵の 曲の 1拍・1小節の 秒数(テンポは 敵ごとに ちがう)。round:なん組めか(注文カードで まとめる 目じるし)
export function makeBar(enemy, barStart, lastPattern = -1, random = Math.random, beatLen = BEAT, barLen = BAR, round = Math.round(barStart / BAR)) {
  const choices = enemy.patterns.map((_, i) => i).filter((i) => i !== lastPattern);
  const index = choices[Math.floor(random() * choices.length)];
  const bar = round;
  const notes = enemy.patterns[index].map(([beat, key], slot) => ({
    time: barStart + beat * beatLen,
    respStart: barStart, // まねして おす 小節の はじまり
    callStart: barStart - barLen, // 敵が やって見せる 小節の はじまり
    beat, // 小節の中の拍の位置(0〜2.5)。注文カードの ものさしの上に ならべる
    callAt: barStart + beat * beatLen - barLen, // 敵が、おなじ矢印を やって見せる時刻(1小節まえ)
    key,
    bar, // 何小節めか(注文カードで、同じ小節の矢印をまとめて見せる)
    slot, // 小節の中で何番めか
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
  state.enemyMisses += 1;
  if (state.enemyMisses >= COOK_FAIL_MISSES) state.cookFails[enemyOf(state).id] = true;
  state.playerHp = Math.max(0, state.playerHp - MISS_DAMAGE);
  return state.playerHp === 0;
}

// つぎの敵へ。もう敵がいなければ false。
export function nextEnemy(state) {
  if (state.enemyIndex >= state.recipe.enemies.length - 1) return false;
  state.enemyIndex += 1;
  state.enemyHp = state.recipe.enemies[state.enemyIndex].hp;
  state.enemyMax = state.enemyHp;
  state.enemyMisses = 0;
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

export function enemyOf(state) {
  return state.recipe.enemies[state.enemyIndex];
}

// 手順ならべに答える。items は、画面に出した並び({text, label, rank})。rank は、正しい順での位置(0から)。
// order は、えらんだ順に、items の番号を ならべたもの。
// リズムのときは、まちがえても、正しい順の名前(label)が出る。まちがえたら、いまの敵が、少し強くなる。
export function answerQuiz(state, def, items, order, failKey) {
  const { step, quiz } = def;
  const correct = order.length === items.length && order.every((index, pos) => items[index].rank === pos);
  if (def.main) state.steps[failKey] = quiz.rhythmLabels ?? quiz.steps.map((item) => item.label); // リズムの名前は、1つめの問題(ほんとうの やりかた)から
  if (!correct) {
    state.fails[failKey] = true;
    state.enemyMax = Math.round(state.enemyMax * PENALTY);
    state.enemyHp = state.enemyMax;
    state.playerHp = Math.max(0, state.playerHp - QUIZ_MISS_DAMAGE); // 主人公も しっぱい(体力が へる)
  }
  const answer = quiz.steps.map((item) => item.text);
  state.review.push({
    step,
    question: quiz.question,
    correct,
    answer,
    fail: correct ? "" : quiz.fail,
    reason: quiz.reason,
  });
  return { correct, fail: correct ? "" : quiz.fail, reason: quiz.reason, answer, dead: state.playerHp === 0 };
}
