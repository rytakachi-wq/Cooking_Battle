// 画面の切りかえ・入力・描画。ルールは game.js、音は audio.js、記録は storage.js。

import {
  ARROW_KEYS,
  answerQuiz,
  BAR,
  BEAT,
  EXTRA_KEYS,
  PLAYER_HP,
  WINDOW,
  accuracy,
  createState,
  enemyOf,
  judge,
  makeBar,
  nextEnemy,
  rank,
  registerHit,
  registerMiss,
} from "./game.js";
import { activeSources, getOffset, isMuted, playSe, setMuted, setOffset, songTime, startSong, stopSong, unlock } from "./audio.js";
import { DEFAULT_RECIPE, RECIPES } from "./recipes.js";
import { ENEMY_FX, STATION, drawStation } from "./station.js";
import { loadStats, recordPlay } from "./storage.js";

const W = 960;
const H = 540;
const LUNGE = 60; // 主人公が、こうげきで前に出る大きさ(大きく動くと目が疲れるので、小さめ)
const BOARD = { cx: 470, cy: 193, gap: 76, r: 30 }; // 注文カードの場所(主人公と敵のあいだ)
const APPROACH = 0.8; // 輪がちぢみはじめてから、おすまでの秒数
const RING = 30; // 輪のいちばん大きいときの、お皿からの広がり
const TIP_TIME = 3.2; // 豆知識を出している秒数(1行を、ゆっくり読める長さ)
const LOOKAHEAD = 2.6; // 何秒さきまで、矢印を作っておくか

const $ = (id) => document.getElementById(id);
const screens = { cover: $("screen-cover"), play: $("screen-play"), result: $("screen-result") };
const canvas = $("stage");
const g = canvas.getContext("2d");

// --- 画像 ---
const POSES = {
  hero: ["normal", "attack", "damage", "win", "lose"],
  enemy: ["normal", "attack", "damage", "down"],
};
const SCALE = { hero: 0.82, egg: 1.6, milk: 1.4, mix: 1.5, butter: 1.9, syrup: 1.75 };
const images = {};
function loadImages() {
  const jobs = [];
  const add = (who, poses) =>
    poses.forEach((pose) => {
      const img = new Image();
      img.src = `../assets/chars/${who}_${pose}.png`;
      images[`${who}_${pose}`] = img;
      jobs.push(img.decode().catch(() => {}));
    });
  add("hero", POSES.hero);
  Object.values(RECIPES).forEach((recipe) => recipe.enemies.forEach((enemy) => add(enemy.id, POSES.enemy)));
  return Promise.all(jobs);
}

// --- 画面の切りかえ ---
function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
}

function showMute() {
  $("btn-mute").textContent = isMuted() ? "おと：なし" : "おと：あり";
  $("btn-mute-play").textContent = `${isMuted() ? "おと：なし" : "おと：あり"} (M)`;
}

function toggleMute() {
  unlock();
  setMuted(!isMuted());
  showMute();
}

function showCover() {
  const stats = loadStats();
  $("best").textContent = stats.plays
    ? `さいこうとくてん ${stats.bestScore}　クリア ${stats.wins}回${stats.bestRank ? `　さいこうランク ${stats.bestRank}` : ""}`
    : "";
  showMute();
  show("cover");
}

// --- 遊びの状態 ---
let run = null;
let frame = 0;

function begin() {
  unlock();
  startSong();
  run = {
    state: createState(),
    notes: [],
    nextBar: 0,
    lastPattern: -1,
    phase: "quiz", // quiz(えらぶ) / fight(リズム) / down(倒したあと) / end
    phaseUntil: 0,
    result: null, // "win" か "lose"
    heroPose: "normal",
    heroUntil: 0,
    enemyPose: "normal",
    enemyUntil: 0,
    popups: [],
    pressed: {},
    attackAt: -9, // 主人公が、こうげきした時刻
    pendingHit: 0, // 敵に当たる時刻(こうげきが とどいたとき)
    hitAt: -9, // 敵が、ひるんだ時刻
    shots: [], // 飛んでいく三日月
    chunks: [], // 調理台へ飛んでいく食材のかけら
    bursts: [], // 当たったときの火花
    shown: 0, // 調理台に見せている、料理の進みぐあい(0〜1。なめらかに動かす)
    lastFrame: 0,
    banner: { text: "", from: 0, until: 0 },
    quiz: null,
  };
  show("play");
  openQuiz({ step: DEFAULT_RECIPE.prep.step, quiz: DEFAULT_RECIPE.prep.quiz }, "prep");
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
}

function quitToCover() {
  $("quiz").hidden = true;
  cancelAnimationFrame(frame);
  run = null;
  stopSong();
  showCover();
}

function popup(text, color, now, x = BOARD.cx, y = BOARD.cy + 68) {
  run.popups.push({ text, color, x, y, from: now });
}

function setHero(pose, now, length) {
  run.heroPose = pose;
  run.heroUntil = now + length;
}

function setEnemy(pose, now, length) {
  run.enemyPose = pose;
  run.enemyUntil = now + length;
}

function clearPending() {
  for (const note of run.notes) if (note.status === "pending") note.status = "cancel";
}

// --- 手順えらび(どうやって調理する？) ---
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// えらぶ画面を出す。矢印のリズムは、この画面を終えてから、はじまる。
function openQuiz(def, failKey, now = songTime()) {
  clearPending();
  run.notes = [];
  run.phase = "quiz";
  const choices = shuffle(def.quiz.choices);
  run.quiz = { def, choices, failKey, answered: false };
  run.banner = { text: def.step, from: now, until: now + 9999 };
  $("quiz-step").textContent = def.step;
  $("quiz-q").textContent = def.quiz.question;
  const list = $("quiz-choices");
  list.replaceChildren();
  choices.forEach((choice, i) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(i + 1);
    button.append(num, choice.text);
    button.addEventListener("click", () => choose(i));
    li.append(button);
    list.append(li);
  });
  $("quiz-choices").hidden = false;
  $("quiz-feedback").hidden = true;
  $("quiz").hidden = false;
}

function choose(i) {
  const q = run?.quiz;
  if (!q || q.answered || !q.choices[i]) return;
  q.answered = true;
  const result = answerQuiz(run.state, q.def, q.choices, i, q.failKey);
  [...$("quiz-choices").querySelectorAll("button")].forEach((button, index) => {
    button.disabled = true;
    if (q.choices[index].correct) button.classList.add("ok");
    else if (index === i) button.classList.add("ng");
  });
  $("quiz-verdict").textContent = result.correct ? "◎ せいかい！" : "× しっぱい…";
  $("quiz-verdict").className = result.correct ? "verdict ok" : "verdict ng";
  $("quiz-fail").textContent = result.correct ? "" : `${result.fail}　つぎの敵が、少し強くなったよ。`;
  $("quiz-reason").textContent = result.reason;
  $("quiz-feedback").hidden = false;
  playSe(result.correct ? "perfect" : "miss");
}

// 答えを見たあと、リズムの戦いへ。
function endQuiz(now = songTime()) {
  const q = run?.quiz;
  if (!q || !q.answered) return;
  run.quiz = null;
  $("quiz").hidden = true;
  if (q.failKey === "prep") {
    // 準備のあとは、はじめの敵(卵)の「えらぶ」へ
    const first = enemyOf(run.state);
    openQuiz({ step: first.step, quiz: first.quiz }, first.id, now);
    return;
  }
  run.phase = "fight";
  run.lastPattern = -1;
  run.nextBar = Math.ceil((now + 2) / BAR);
  run.banner = { text: enemyOf(run.state).step, from: now, until: now + 2.5 };
}

// 結果画面の「ふりかえり」
function showReview(s) {
  const list = $("r-review");
  list.replaceChildren();
  for (const item of s.review) {
    const li = document.createElement("li");
    li.className = item.correct ? "ok" : "ng";
    const head = document.createElement("strong");
    head.textContent = `${item.correct ? "◎" : "×"} ${item.step}`;
    const body = document.createElement("span");
    body.textContent = item.correct ? item.reason : `${item.picked} → ${item.fail} ${item.reason}`;
    li.append(head, body);
    list.append(li);
  }
  const tips = $("r-tips");
  tips.replaceChildren();
  for (const tip of s.tips) {
    const li = document.createElement("li");
    li.textContent = `${tip.name}：${tip.text}`;
    tips.append(li);
  }
}

// 倒した敵の豆知識を出す。矢印をおしている最中には出さない(敵がたおれてから、つぎの敵まで)。
function showTip(now) {
  const enemy = enemyOf(run.state);
  if (!enemy.tip) return;
  run.tip = { text: enemy.tip, name: enemy.name, from: now + 0.5, until: now + 0.5 + TIP_TIME };
  run.state.tips.push({ id: enemy.id, name: enemy.name, text: enemy.tip });
}

function finish(result, now) {
  run.result = result;
  run.phase = "end";
  run.phaseUntil = now + (result === "win" ? TIP_TIME + 0.4 : 2.4);
  clearPending();
  if (result === "win") {
    setHero("win", now, 99);
    playSe("win");
  } else {
    setHero("lose", now, 99);
    playSe("lose");
  }
}

function onMiss(note, now) {
  note.status = "miss";
  const dead = registerMiss(run.state);
  popup("MISS", "#7a7a7a", now);
  setHero("damage", now, 0.45);
  setEnemy("attack", now, 0.45);
  playSe("miss");
  if (dead) finish("lose", now);
}

// 主人公のこうげき:前に出て、三日月をとばす。三日月が敵にとどいたとき(0.2秒後)に、敵がひるむ。
function attack(now, grade) {
  run.attackAt = now;
  setHero("attack", now, 0.32);
  run.shots.push({ from: now, big: grade === "perfect" });
  run.pendingHit = now + 0.2;
  run.pendingGrade = grade;
}

function press(key, now) {
  if (!run || run.phase !== "fight") return;
  run.pressed[key] = now;
  let target = null;
  for (const note of run.notes) {
    if (note.status !== "pending") continue;
    const d = Math.abs(note.time - now);
    if (d <= WINDOW.good && (!target || d < Math.abs(target.time - now))) target = note;
  }
  if (!target) return;
  if (target.key !== key) {
    onMiss(target, now);
    return;
  }
  const grade = judge(target.time - now);
  target.status = "hit";
  target.hitAt = now;
  const killed = registerHit(run.state, grade);
  popup(grade === "perfect" ? "PERFECT!" : "GOOD", grade === "perfect" ? "#ff8a00" : "#2f9e44", now);
  attack(now, grade);
  playSe(grade);
  if (killed) {
    clearPending();
    showTip(now); // 倒した敵の豆知識を、1行だけ出す
    run.downAt = now + 0.2; // 三日月がとどいてから、たおれる
    if (run.state.enemyIndex === run.state.recipe.enemies.length - 1) {
      finish("win", now);
    } else {
      run.phase = "down";
      run.phaseUntil = now + TIP_TIME + 0.4; // 豆知識を読む時間を、とる
    }
  }
}

function update(now) {
  const r = run;
  if (r.phase === "fight") {
    while (r.nextBar * BAR - now < LOOKAHEAD) {
      const bar = makeBar(enemyOf(r.state), r.nextBar * BAR, r.lastPattern);
      r.lastPattern = bar.index;
      r.notes.push(...bar.notes);
      r.nextBar += 1;
    }
    for (const note of r.notes) {
      if (r.phase !== "fight") break;
      if (note.status === "pending" && note.time < now - WINDOW.good) onMiss(note, now);
    }
  } else if (r.phase === "down" && now >= r.phaseUntil) {
    nextEnemy(r.state);
    r.enemyPose = "normal";
    r.enemyUntil = 0;
    r.tip = null;
    const enemy = enemyOf(r.state);
    openQuiz({ step: enemy.step, quiz: enemy.quiz }, enemy.id, now);
  } else if (r.phase === "end" && now >= r.phaseUntil) {
    showResult();
    return false;
  }
  if (r.downAt && now >= r.downAt) {
    r.downAt = 0;
    setEnemy("down", now, 99);
    playSe("down");
  }
  if (r.pendingHit && now >= r.pendingHit) {
    const fx = ENEMY_FX[enemyOf(r.state).id];
    const big = r.pendingGrade === "perfect";
    r.pendingHit = 0;
    r.hitAt = now;
    if (r.enemyPose !== "down") setEnemy("damage", now, 0.22);
    r.bursts.push({ from: now, x: 745, y: 290, big });
    r.chunks.push({ from: now, color: fx.chunk, x0: 745, y0: 300 });
    r.popups.push({ text: fx.shout, color: fx.color, x: 745, y: 210, from: now, big });
  }
  if (r.heroUntil && now >= r.heroUntil && r.result === null) {
    r.heroPose = "normal";
    r.heroUntil = 0;
  }
  if (r.enemyUntil && now >= r.enemyUntil && r.phase === "fight") {
    r.enemyPose = "normal";
    r.enemyUntil = 0;
  }
  r.notes = r.notes.filter((note) => note.time > now - 2.4 && !(note.status === "cancel"));
  r.popups = r.popups.filter((p) => now - p.from < 0.8);
  r.shots = r.shots.filter((p) => now - p.from < 0.25);
  r.bursts = r.bursts.filter((p) => now - p.from < 0.4);
  r.chunks = r.chunks.filter((p) => now - p.from < 0.5);
  return true;
}

function showResult() {
  $("quiz").hidden = true;
  const r = run;
  const won = r.result === "win";
  const s = r.state;
  const grade = rank(s);
  const { isRecord } = recordPlay({ score: s.score, won, rank: grade });
  stopSong();
  cancelAnimationFrame(frame);
  run = null;
  $("r-title").textContent = won ? "ホットケーキ かんせい！" : "ざんねん… もういちど！";
  $("r-hero").src = `../assets/chars/hero_${won ? "win" : "lose"}.png`;
  $("r-rank").textContent = won ? `ランク ${grade}` : "";
  $("r-score").textContent = s.score;
  $("r-perfect").textContent = s.perfect;
  $("r-good").textContent = s.good;
  $("r-miss").textContent = s.miss;
  $("r-combo").textContent = s.maxCombo;
  $("r-quiz").textContent = `${s.review.filter((item) => item.correct).length} / ${s.review.length}`;
  $("r-best").textContent = loadStats().bestScore;
  $("r-record").hidden = !isRecord;
  showReview(s);
  show("result");
}

// --- 描画 ---

function drawSprite(name, cx, bottom, scale, { flip = false, dy = 0, alpha = 1 } = {}) {
  const img = images[name];
  if (!img || !img.complete || !img.naturalWidth) return;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  g.save();
  g.globalAlpha = alpha;
  g.translate(cx, bottom + dy);
  if (flip) g.scale(-1, 1);
  g.drawImage(img, -w / 2, -h, w, h);
  g.restore();
}

function bar(x, y, w, h, ratio, color, label) {
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, w * Math.max(0, ratio), h);
  g.strokeStyle = "#4a2c17";
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
  g.fillStyle = "#4a2c17";
  g.font = "bold 16px sans-serif";
  g.textAlign = "left";
  g.fillText(label, x, y - 6);
}

function outlined(text, x, y, size, fill, align = "center") {
  g.font = `bold ${size}px sans-serif`;
  g.textAlign = align;
  g.lineWidth = Math.max(4, size / 6);
  g.strokeStyle = "#fff";
  g.lineJoin = "round";
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

function roundRect(x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const INK = "#4a2c17";
const DIR_COLOR = { L: "#ff8a65", U: "#7bc47f", R: "#5aa9f0", D: "#ffcb3d" };

// 矢印のかたち。右むきをもとに、回して使う。s は大きさ(半分)。
function arrowShape(key, x, y, s) {
  const turn = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }[key];
  const c = Math.cos(turn);
  const d = Math.sin(turn);
  const points = [
    [-0.8, -0.28],
    [0.1, -0.28],
    [0.1, -0.72],
    [0.88, 0],
    [0.1, 0.72],
    [0.1, 0.28],
    [-0.8, 0.28],
  ];
  g.beginPath();
  points.forEach(([px, py], i) => {
    const sx = x + (px * c - py * d) * s;
    const sy = y + (px * d + py * c) * s;
    if (i === 0) g.moveTo(sx, sy);
    else g.lineTo(sx, sy);
  });
  g.closePath();
}

// 注文のお皿。丸いお皿の上に、矢印がのっている。
function drawPlate(key, x, y, r, state = "pending", alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.lineJoin = "round";
  g.fillStyle = state === "hit" ? "#fff0a8" : "#fffaf0";
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = state === "hit" ? "#f2c94c" : "#eadfc8";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, r * 0.78, 0, Math.PI * 2);
  g.stroke();
  arrowShape(key, x, y, r * 0.66);
  g.fillStyle = state === "miss" ? "#bdb5a8" : DIR_COLOR[key];
  g.fill();
  g.strokeStyle = state === "miss" ? "#9a9286" : INK;
  g.lineWidth = 2.5;
  g.stroke();
  g.restore();
}

// 画面のまんなか(主人公と敵のあいだ)の「注文カード」。矢印は動かず、輪がちぢんで、おす合図になる。
// 動くものが少ないので、目で追いつづけなくてよい。キャラクターには、かぶらない。
function drawBoard(r, now) {
  const { cx, cy, gap, r: pr } = BOARD;
  // カード
  g.save();
  g.fillStyle = "rgba(74,44,23,0.18)";
  roundRect(cx - 168, cy - 36, 336, 80, 26);
  g.fill();
  g.fillStyle = "#fff4d8";
  g.strokeStyle = INK;
  g.lineWidth = 3;
  roundRect(cx - 168, cy - 42, 336, 80, 26);
  g.fill();
  g.stroke();
  g.fillStyle = "rgba(74,44,23,0.55)";
  g.font = "bold 12px sans-serif";
  g.textAlign = "left";
  g.fillText("ちゅうもん", cx - 150, cy - 24);
  g.restore();

  // いま見せる並び = いちばん近い音符がある小節
  const live = r.notes.filter((n) => n.status !== "cancel" && n.time >= now - 0.35);
  if (!live.length) return;
  const bar = Math.min(...live.map((n) => n.bar));
  const group = r.notes.filter((n) => n.bar === bar && n.status !== "cancel").sort((a, b) => a.slot - b.slot);
  group.forEach((note, i) => {
    const x = cx + (i - (group.length - 1) / 2) * gap;
    const y = cy - 2;
    const dt = note.time - now;
    if (note.status === "hit") {
      const t = Math.max(0, now - note.hitAt);
      drawPlate(note.key, x, y, pr, "hit");
      if (t < 0.25) {
        g.save();
        g.globalAlpha = 0.7 * (1 - t / 0.25);
        g.strokeStyle = "#ffcf33";
        g.lineWidth = 5;
        g.beginPath();
        g.arc(x, y, pr + t * 90, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      return;
    }
    if (note.status === "miss") {
      drawPlate(note.key, x, y, pr, "miss", 0.7);
      return;
    }
    drawPlate(note.key, x, y, pr);
    // ちぢむ輪:輪が お皿に重なったときが、おすタイミング
    if (dt <= APPROACH && dt > -0.16) {
      const p = Math.max(0, Math.min(1, dt / APPROACH));
      g.save();
      g.globalAlpha = 0.3 + 0.6 * (1 - p);
      g.strokeStyle = DIR_COLOR[note.key];
      g.lineWidth = dt <= 0.07 ? 7 : 5;
      g.beginPath();
      g.arc(x, y, pr + 5 + RING * p, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = INK;
      g.globalAlpha = 0.5 * (1 - p);
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
  });
}

const tmp = document.createElement("canvas");

// 白くひからせて描く(ダメージをうけた瞬間)
function drawFlash(name, cx, bottom, scale, flash, dx) {
  const img = images[name];
  if (!img || !img.complete || !img.naturalWidth) return;
  tmp.width = img.naturalWidth;
  tmp.height = img.naturalHeight;
  const t = tmp.getContext("2d");
  t.clearRect(0, 0, tmp.width, tmp.height);
  t.drawImage(img, 0, 0);
  t.globalCompositeOperation = "source-atop";
  t.fillStyle = `rgba(255,255,255,${flash})`;
  t.fillRect(0, 0, tmp.width, tmp.height);
  const w = tmp.width * scale;
  const h = tmp.height * scale;
  g.drawImage(tmp, cx + dx - w / 2, bottom - h, w, h);
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);

// 主人公が前に出る量(0〜1)。さっと出て、ゆっくりもどる。
function lungeAmount(now, r) {
  const t = now - r.attackAt;
  if (t < 0 || t > 0.32) return 0;
  return t < 0.08 ? easeOut(t / 0.08) : 1 - easeOut((t - 0.08) / 0.24);
}

function drawShot(shot, now, heroX) {
  const t = (now - shot.from) / 0.2;
  if (t < 0 || t > 1.2) return;
  const x0 = heroX + 110;
  const x1 = 720;
  const x = x0 + (x1 - x0) * Math.min(t, 1);
  const y = 300;
  const size = shot.big ? 1.35 : 1;
  g.save();
  g.globalAlpha = Math.max(0, 1.2 - t) / 1.2 + 0.2;
  for (let i = 3; i >= 0; i -= 1) {
    // 残像
    const gx = x - i * 26;
    g.strokeStyle = i === 0 ? "#fff6c4" : `rgba(255,210,70,${0.5 - i * 0.1})`;
    g.lineWidth = (i === 0 ? 12 : 9) * size;
    g.lineCap = "round";
    g.beginPath();
    g.arc(gx - 40 * size, y, 62 * size, -0.9, 0.9);
    g.stroke();
  }
  g.restore();
}

function drawBurst(b, now) {
  const t = (now - b.from) / 0.4;
  if (t < 0 || t > 1) return;
  const n = b.big ? 10 : 7;
  const reach = (b.big ? 90 : 62) * easeOut(t);
  g.save();
  g.globalAlpha = 1 - t;
  g.strokeStyle = "#ff9d00";
  g.fillStyle = "#fff6a8";
  g.lineWidth = 6;
  g.lineCap = "round";
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    g.beginPath();
    g.moveTo(b.x + Math.cos(a) * reach * 0.45, b.y + Math.sin(a) * reach * 0.45);
    g.lineTo(b.x + Math.cos(a) * reach, b.y + Math.sin(a) * reach);
    g.stroke();
  }
  g.beginPath();
  g.arc(b.x, b.y, (b.big ? 38 : 26) * (1 - t * 0.5), 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// 食材のかけらが、調理台へ飛んでいく
function drawChunk(c, now) {
  const t = (now - c.from) / 0.5;
  if (t < 0 || t > 1) return;
  const x = c.x0 + (STATION.x - c.x0) * easeOut(t);
  const y = c.y0 + (STATION.y - 120 - c.y0) * t - Math.sin(t * Math.PI) * 90;
  g.fillStyle = c.color;
  g.strokeStyle = "#4a2c17";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, 11 * (1 - t * 0.4), 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

// 画面の大きさに合わせて、絵のこまかさを決める(ぼやけた文字や矢印は、目が疲れる)
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * dpr);
  if (width > 0 && canvas.width !== width) {
    canvas.width = width;
    canvas.height = Math.round((width * H) / W);
  }
  g.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  g.imageSmoothingQuality = "high";
}

function draw(now) {
  fitCanvas();
  const r = run;
  const s = r.state;
  const enemy = enemyOf(s);
  const dt = r.lastFrame ? Math.min(0.1, now - r.lastFrame) : 0;
  r.lastFrame = now;
  const bounce = Math.sin(now * 2.1) * 1.5; // ゆっくりした呼吸だけ。拍ごとのゆれは、ちらつくのでやめた

  // 背景:壁とカウンター(落ち着いた色で、動きはなし)
  const wall = g.createLinearGradient(0, 0, 0, 380);
  wall.addColorStop(0, "#fff0cc");
  wall.addColorStop(1, "#ffdfa0");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#b9764a";
  g.fillRect(0, 380, W, H - 380);
  g.fillStyle = "#d39466";
  g.fillRect(0, 380, W, 12);

  // 調理台:敵をどこまで倒したかで、料理が進む
  if (s.enemyIndex !== r.stageDrawn) {
    r.stageDrawn = s.enemyIndex;
    r.shown = 0;
  }
  const target = r.phase === "down" || r.enemyPose === "down" || r.downAt ? 1 : 1 - s.enemyHp / s.enemyMax;
  r.shown += (target - r.shown) * Math.min(1, dt * 7);
  drawStation(g, s.enemyIndex, r.shown, now, s.fails);

  // 主人公:こうげきで前に出る
  const lunge = lungeAmount(now, r);
  const heroX = 150 + lunge * LUNGE;
  g.save();
  g.translate(heroX, 395);
  g.rotate(-0.1 * lunge);
  g.translate(-heroX, -395);
  drawSprite(`hero_${r.heroPose}`, heroX, 395 + (r.heroPose === "lose" ? 10 : 0), SCALE.hero, {
    dy: r.heroPose === "normal" ? bounce : 0,
  });
  g.restore();

  // 敵:ひるむと白くひかり、うしろへ下がる
  const since = now - r.hitAt;
  const flinch = since >= 0 && since < 0.18 ? 1 - since / 0.18 : 0;
  const weak = r.enemyPose === "normal" && s.enemyHp / s.enemyMax < 0.5 ? "damage" : r.enemyPose;
  const ename = `${enemy.id}_${weak}`;
  const edy = r.enemyPose === "normal" ? bounce : 0;
  if (flinch > 0) drawFlash(ename, 770, 398 + edy, SCALE[enemy.id], flinch * 0.5, flinch * 8);
  else drawSprite(ename, 770, 398, SCALE[enemy.id], { dy: edy });

  for (const shot of r.shots) drawShot(shot, now, heroX);
  for (const b of r.bursts) drawBurst(b, now);
  for (const c of r.chunks) drawChunk(c, now);

  // 体力など
  bar(24, 36, 300, 20, s.playerHp / PLAYER_HP, "#4ecb71", "みならい りょうりにん");
  bar(W - 324, 36, 300, 20, s.enemyHp / s.enemyMax, "#ff6b6b", enemy.name);
  outlined(`${s.score}`, W / 2, 44, 34, "#4a2c17");
  if (s.combo >= 2) outlined(`${s.combo} COMBO`, W / 2, 80, 22, "#e8472f");
  g.font = "bold 16px sans-serif";
  g.textAlign = "right";
  g.fillStyle = "#4a2c17";
  g.fillText(`${s.enemyIndex + 1} / ${s.recipe.enemies.length}`, W - 24, 82);

  drawBoard(r, now);

  // 豆知識(カウンターの上の、あいている場所に、1行だけ)
  if (r.tip && now >= r.tip.from && now < r.tip.until) {
    const t = now - r.tip.from;
    g.save();
    g.globalAlpha = Math.min(1, t * 4, (r.tip.until - now) * 3);
    g.fillStyle = "#fff4d8";
    g.strokeStyle = INK;
    g.lineWidth = 3;
    roundRect(60, 438, W - 120, 72, 22);
    g.fill();
    g.stroke();
    g.fillStyle = "#e8472f";
    g.font = "bold 15px sans-serif";
    g.textAlign = "left";
    g.fillText(`ワンポイント　${r.tip.name}`, 86, 464);
    g.fillStyle = INK;
    g.font = "bold 24px sans-serif";
    g.fillText(r.tip.text, 86, 497);
    g.restore();
  }

  // 判定の文字
  for (const p of r.popups) {
    const t = (now - p.from) / 0.8;
    g.globalAlpha = 1 - t * t;
    outlined(p.text, p.x, p.y - t * 30, p.big ? 34 : 28, p.color);
    g.globalAlpha = 1;
  }

  // 手順の見出し
  if (now >= r.banner.from && now < r.banner.until) {
    const t = now - r.banner.from;
    g.globalAlpha = Math.min(1, (r.banner.until - now) * 2, t * 4);
    outlined(r.banner.text, W / 2, 128, 40, enemy.boss ? "#8a2be2" : "#e8472f");
    g.globalAlpha = 1;
  }
  if (r.phase === "end") {
    outlined(r.result === "win" ? "かんせい！" : "やられた…", W / 2, 230, 90, r.result === "win" ? "#e8472f" : "#555");
  }
}

function tick() {
  if (!run) return;
  const now = songTime();
  if (update(now)) {
    draw(now);
    frame = requestAnimationFrame(tick);
  }
}

// --- 入力 ---
window.addEventListener("keydown", (event) => {
  unlock();
  if (event.code === "Escape" && run) {
    quitToCover();
    return;
  }
  if (event.code === "KeyM" && !event.repeat) {
    toggleMute();
    return;
  }
  if (!run) return;
  if (run.phase === "quiz" && run.quiz) {
    const pick = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[event.code];
    if (pick !== undefined) {
      event.preventDefault();
      if (!event.repeat) choose(pick);
    } else if ((event.code === "Enter" || event.code === "Space" || event.code === "NumpadEnter") && run.quiz.answered) {
      event.preventDefault();
      if (!event.repeat) endQuiz();
    }
    return;
  }
  const key = ARROW_KEYS[event.code];
  if (key) {
    event.preventDefault();
    if (!event.repeat) press(key, songTime(event.timeStamp > 0 ? event.timeStamp : undefined));
    return;
  }
  // 攻撃(テンキーの0)とジャンプ(テンキーのEnter)は、あとから追加する。いまは何もしない。
  if (EXTRA_KEYS[event.code]) event.preventDefault();
});

window.addEventListener("pointerdown", unlock);

$("btn-start").addEventListener("click", () => {
  unlock();
  playSe("button");
  begin();
});
$("btn-again").addEventListener("click", () => {
  playSe("button");
  begin();
});
$("btn-cover").addEventListener("click", () => {
  playSe("button");
  showCover();
});
function showOffset() {
  const ms = getOffset();
  $("offset-value").textContent = `${ms > 0 ? "+" : ""}${ms}ms`;
}
$("btn-offset-up").addEventListener("click", () => {
  setOffset(getOffset() + 10);
  showOffset();
});
$("btn-offset-down").addEventListener("click", () => {
  setOffset(getOffset() - 10);
  showOffset();
});
showOffset();

$("btn-mute").addEventListener("click", toggleMute);
$("btn-mute-play").addEventListener("click", (event) => {
  toggleMute();
  event.currentTarget.blur(); // フォーカスが残ると、Enterなどで また押されてしまう
});
$("btn-quit").addEventListener("click", quitToCover);
$("btn-quiz-next").addEventListener("click", () => endQuiz());

// 画面がかくれたら、ゲームをやめて、BGMも止める(のこらないように)
document.addEventListener("visibilitychange", () => {
  if (document.hidden && run) quitToCover();
});
window.addEventListener("pagehide", stopSong);

// 動作確認用。アドレスの最後に ?debug をつけたときだけ、外から中をのぞける。
if (location.search.includes("debug")) {
  window.__game = { getRun: () => run, songTime, update, press, draw, begin, activeSources, choose, endQuiz };
}

loadImages().then(() => {
  if (!run) showCover();
});
