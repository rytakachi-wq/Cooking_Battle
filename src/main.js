// 画面の切りかえ・入力・描画。ルールは game.js、音は audio.js、記録は storage.js。

import {
  ARROW_KEYS,
  answerQuiz,
  BAR,
  HIT_DAMAGE,
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
import { activeSources, alive, cueAtSongTime, getOffset, isMuted, playSe, setMuted, setOffset, songTime, startSong, stopSong, unlock } from "./audio.js";
import { DEFAULT_RECIPE, RECIPES } from "./recipes.js";
import * as Q from "./quiz.js";
import { drawActionFx, drawQuizScene } from "./scenes.js";
import { ENEMY_FX, STATION, drawFailStamp, drawStation, useArt } from "./station.js";
import { loadStats, recordPlay } from "./storage.js";

const W = 960;
const H = 540;
// 強化形態の専用の絵(assets/chars/<食材>_strong_<ポーズ>.png)が そろったら true にする。
// false のあいだは、通常の絵に、コードでかざりを重ねる。
const STRONG_ART = true;
const LUNGE = 60; // 主人公が、こうげきで前に出る大きさ(大きく動くと目が疲れるので、小さめ)
const BOARD = { cx: 470, cy: 176, gap: 80, r: 30 }; // 注文カードの場所(主人公と敵のあいだ)
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
  // 強化形態・料理の進み・しっぱい・かざりの絵(ファイル名=キー)
  const addFile = (key, path) => {
    const img = new Image();
    img.src = `../assets/${path}`;
    images[key] = img;
    jobs.push(img.decode().catch(() => {}));
  };
  for (const name of ["dish_bowl_empty", "dish_bowl_egg", "dish_bowl_milk", "dish_bowl_batter", "dish_pan_raw", "dish_pan_golden", "dish_plate_pancake", "dish_plate_syrup"]) addFile(name, `dish/${name}.png`);
  for (const name of ["fail_shells", "fail_milk", "fail_lumps", "fail_burnt", "fail_syrup"]) addFile(name, `fail/${name}.png`);
  for (const name of ["ui_hand", "ui_lid", "ui_stamp_fail"]) addFile(name, `ui/${name}.png`);
  add("hero", POSES.hero);
  Object.values(RECIPES).forEach((recipe) =>
    recipe.enemies.forEach((enemy) => {
      add(enemy.id, POSES.enemy);
      if (STRONG_ART) add(`${enemy.id}_strong`, POSES.enemy);
    }),
  );
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
  if (tut) {
    cancelAnimationFrame(tutFrame);
    tut = null;
    $("tut-bar").hidden = true;
  }
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
  const first = enemyOf(run.state);
  run.quizQueue = [
    ...quizzesFor(DEFAULT_RECIPE.prep.step, DEFAULT_RECIPE.prep.quizzes, "prep"),
    ...quizzesFor(first.step, first.quizzes, first.id),
  ];
  nextQuiz();
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

function popup(text, color, now, x = BOARD.cx, y = BOARD.cy - 58) {
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

// --- 手順ならべ(正しい じゅんばんに ならべる) ---
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ならべる画面を出す。リズムは、この画面を終えてから、はじまる。
// カードは、イラストの上に出る(quiz.js)。ドラッグして、上の「じゅんばん」の わくに ならべる。
const ACTION_TIME = 1.0; // 1つの手順を やって見せる 秒数

// 1つの手順の 問題を、じゅんに ならべる。1つめが「ほんとうの やりかた」(main)
function quizzesFor(step, candidates, failKey) {
  // 1つめは かならず。2つめ以降は、あそぶたびに ランダムで 0〜(のこり全部)問 出す → 1つの手順に、1〜3問
  const extras = shuffle(candidates.slice(1));
  const quizzes = [candidates[0], ...extras.slice(0, Math.floor(Math.random() * (extras.length + 1)))];
  // 出す じゅんばん:データの show(小さいほうが 先)。1つめ(ほんとうの やりかた)は、じゅんばんが うしろでも、動きと 名前の もとに なる
  quizzes.sort((a, b) => (a.show ?? candidates.indexOf(a) + 1) - (b.show ?? candidates.indexOf(b) + 1));
  return quizzes.map((quiz, index) => ({
    def: { step: quizzes.length > 1 ? `${step}  (${index + 1}/${quizzes.length})` : step, quiz, main: quiz === candidates[0], variant: quiz === candidates[0] ? 0 : candidates.indexOf(quiz) },
    failKey,
  }));
}

// つぎの問題を出す
function nextQuiz(now = songTime()) {
  const item = run.quizQueue.shift();
  openQuiz(item.def, item.failKey, now, run.quizQueue.length + 1);
}

function openQuiz(def, failKey, now = songTime(), left = 1) {
  clearPending();
  run.notes = [];
  run.phase = "quiz";
  run.action = null;
  // 正しい順での位置(rank)をつけて、まぜる。まぜたあとも、正しい順のままに ならないよう、くりかえす。
  const ranked = def.quiz.steps.map((item, rank) => ({ ...item, rank }));
  let items = shuffle(ranked);
  for (let tries = 0; tries < 8 && items.every((item, i) => item.rank === i); tries += 1) items = shuffle(ranked);
  run.quiz = Q.createQuiz(def, failKey, items);
  run.quiz.variant = def.variant ?? 0;
  run.banner = { text: "", from: 0, until: 0 };
  $("quiz-step").textContent = def.step;
  $("quiz-q").textContent = def.quiz.question;
  $("quiz-left").textContent = left === 1 ? "この問題が おわると 戦いだよ！" : `のこり ${left}問で 戦いだよ！`;
  $("quiz-feedback").hidden = true;
  $("quiz").hidden = false;
}

// その手順を、主人公が やって見せる(カードを おいた とき・答えあわせの とき)
function startAction(rank, now) {
  const q = run.quiz;
  run.action = { key: q.failKey, rank, from: now, variant: q.variant ?? 0 };
  run.attackAt = now; // 前に出て、手を うごかす
  setHero("attack", now, 0.7);
}

// カードを、あいている わくに おく(キーボード・クリックでも)
function choose(i) {
  const q = run?.quiz;
  if (!q || q.stage !== "arrange" || !q.items[i]) return;
  handleQuizEvent(Q.placeFirstFree(q, i));
}

function chooseAt(position) {
  choose(position);
}

// 1つ もどす
function undoChoice() {
  const q = run?.quiz;
  if (!q || q.stage !== "arrange") return;
  Q.removeLast(q);
}

function handleQuizEvent(ev, now = songTime()) {
  if (!ev) return;
  const q = run.quiz;
  if (ev.type === "placed") startAction(q.items[ev.item].rank, now); // おいた手順を、すぐ やって見せる
  else if (ev.type === "confirm") startDemo(now);
}

// 「けってい」:のこり1まいは じどうで おき、ならべた じゅんで ぜんぶ やって見せる
function confirmQuiz(now = songTime()) {
  const q = run?.quiz;
  if (!q || q.stage !== "arrange" || Q.filled(q) < q.n - 1) return;
  Q.fillLast(q);
  startDemo(now);
}

function startDemo(now) {
  const q = run.quiz;
  if (q.stage !== "arrange") return;
  Q.fillLast(q);
  q.stage = "demo";
  q.demoIdx = 0;
  q.demoAt = now + 0.35;
  q.hover = -1;
}

// 毎フレーム:カードの うごき、やって見せる じゅんばん、答えあわせ
function updateQuiz(now) {
  const q = run.quiz;
  Q.update(q, now);
  if (q.stage === "demo" && now >= q.demoAt) {
    if (q.demoIdx < q.n) {
      startAction(q.items[q.slots[q.demoIdx]].rank, now);
      q.demoIdx += 1;
      q.demoAt = now + ACTION_TIME + 0.12;
    } else {
      judgeQuiz(now);
    }
  }
  if (q.stage === "verdict" && q.wrong && !q.reveal && now >= q.revealAt) {
    q.reveal = true; // 正しい じゅんばんに、カードが ならびかわる
    playSe("good");
  }
}

function judgeQuiz(now) {
  const q = run.quiz;
  const result = answerQuiz(run.state, q.def, q.items, Q.order(q), q.failKey);
  q.result = result;
  q.answered = true;
  q.answeredAt = now;
  q.verdictAt = now;
  q.stage = "verdict";
  q.wrong = !result.correct;
  q.revealAt = now + 0.9;
  run.action = null;
  if (!result.correct) {
    setHero("damage", now, 1.6); // 主人公も しっぱい
    run.stamp = { from: now, until: now + 2.4 };
    run.popups.push({ text: "しっぱい…", color: "#e8472f", x: 150, y: 150, from: now, big: true });
    if (result.dead) q.dead = true;
  }
  $("quiz-verdict").textContent = result.correct ? "◎ せいかい！" : "× じゅんばんが ちがったよ";
  $("quiz-verdict").className = result.correct ? "verdict ok" : "verdict ng";
  $("quiz-fail").textContent = result.correct ? "" : `${result.fail}　体力が へって、つぎの敵が 強くなったよ。`;
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
  if (q.dead) {
    finish("lose", now); // 手順を まちがえすぎて、体力が なくなった
    return;
  }
  if (run.quizQueue.length) {
    nextQuiz(now);
    return;
  }
  run.phase = "fight";
  run.lastPattern = -1;
  run.nextBar = Math.ceil((now + 2) / BAR);
  run.banner = { text: enemyOf(run.state).step, from: now, until: now + 2.5 };
  if (run.state.fails[enemyOf(run.state).id]) {
    run.popups.push({ text: "パワーアップ！", color: "#e8472f", x: 770, y: 150, from: now, big: true });
  }
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
    const order = item.answer.map((text, n) => `${n + 1}. ${text}`).join(" → ");
    body.textContent = item.correct ? `${order}　${item.reason}` : `${item.fail} 正しくは： ${order}　${item.reason}`;
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
  const enemyId = enemyOf(run.state).id;
  const wasFailed = run.state.cookFails[enemyId] === true;
  const dead = registerMiss(run.state);
  popup("MISS", "#7a7a7a", now);
  setHero("damage", now, 0.45);
  setEnemy("attack", now, 0.45);
  playSe("miss");
  // ミスが たまると、料理が しっぱいした見た目になる(手順ならべの まちがいとは、べつ)
  if (!wasFailed && run.state.cookFails[enemyId]) run.stamp = { from: now, until: now + 2.4 };
  if (dead) finish("lose", now);
  else defeatIfDone(now, note.bar, false);
}

// 敵の体力が0でも、その小節の矢印を ぜんぶ おし終える(または 見のがす)まで、敵は たおれない。
// (さいごの矢印を おさなくても すすめてしまう、ということが ないように)
function defeatIfDone(now, bar, hit) {
  if (!run || run.phase !== "fight" || run.state.enemyHp > 0) return;
  if (run.notes.some((n) => n.bar === bar && n.status === "pending")) return;
  if (!hit) {
    // さいごの矢印を はずしたら、とどめを さしきれない。敵は、少しだけ 体力が のこる
    run.state.enemyHp = HIT_DAMAGE.good;
    popup("とどめを さそう！", "#e8472f", now, 770, 150);
    return;
  }
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
  if (!target) {
    // 敵が やって見せているあいだは、おせない
    const st = boardState(run, now);
    if (st?.calling) popup("まだ！ ききましょう", "#5b7aa3", now, BOARD.cx, BOARD.cy - 58);
    return;
  }
  if (target.key !== key) {
    onMiss(target, now);
    return;
  }
  const grade = judge(target.time - now);
  target.status = "hit";
  target.hitAt = now;
  registerHit(run.state, grade);
  popup(grade === "perfect" ? "PERFECT!" : "GOOD", grade === "perfect" ? "#ff8a00" : "#2f9e44", now);
  attack(now, grade);
  playSe(grade);
  defeatIfDone(now, target.bar, true);
}

function update(now) {
  const r = run;
  if (r.phase === "quiz" && r.quiz) updateQuiz(now);
  if (r.phase === "fight") {
    // 2小節で1組:はじめの小節で、敵が やって見せ、つぎの小節で、プレイヤーが まねして おす(おすのは、あとの小節)
    while (r.nextBar * BAR - now < LOOKAHEAD) {
      const bar = makeBar(enemyOf(r.state), (r.nextBar + 1) * BAR, r.lastPattern);
      r.lastPattern = bar.index;
      const steps = r.state.steps[enemyOf(r.state).id]; // いつも、正しい手順の名前
      for (const note of bar.notes) if (steps) note.label = steps[note.slot];
      r.notes.push(...bar.notes);
      r.nextBar += 2;
    }
    for (const note of r.notes) {
      // 敵が やって見せる時刻に、音を出して、敵が動く
      if (note.status === "pending" && !note.cued && note.callAt - now < 0.05) {
        note.cued = true;
        if (note.callAt - now > -0.3) {
          cueAtSongTime(note.callAt, note.key, note.beat % 1 !== 0);
          setEnemy("attack", now, 0.22);
        }
      }
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
    run.quizQueue = quizzesFor(enemy.step, enemy.quizzes, enemy.id);
    nextQuiz(now);
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
  $("r-cook").textContent = `${Object.keys(s.cookFails).length} / ${s.recipe.enemies.length}`;
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

// 画面のまんなか(主人公と敵のあいだ)の「注文カード」。
// 敵が1小節で やって見せ(音といっしょに お皿がひかる)、つぎの1小節で、プレイヤーが まねして おす。
// 矢印は動かない。おすタイミングは、曲のリズムと、したの拍のランプで、つかむ。
//   ききましょう(青いカード・かぎ・敵のふきだし ♪) …おせない
//   まねして！  (あたたかいカード・赤いランプ)       …おせる

// いま、どの小節を見せているか。{ group, calling, responding, callStart, respStart }
function boardState(r, now) {
  const live = r.notes.filter((n) => n.status !== "cancel" && n.time >= now - 0.35);
  if (!live.length) return null;
  const bar = Math.min(...live.map((n) => n.bar));
  const group = r.notes.filter((n) => n.bar === bar && n.status !== "cancel").sort((a, b) => a.slot - b.slot);
  const respStart = bar * BAR;
  const callStart = respStart - BAR;
  return {
    group,
    callStart,
    respStart,
    calling: now >= callStart && now < respStart,
    responding: now >= respStart && now < respStart + BAR,
  };
}

// 鍋のふた:「ふたをして ある」=いまは さわれない
function drawLid(x, y) {
  const lid = images.ui_lid;
  if (lid && lid.complete && lid.naturalWidth) {
    const h = 30;
    const w = (lid.naturalWidth * h) / lid.naturalHeight;
    g.drawImage(lid, x - w / 2, y - h / 2 + 2, w, h);
    return;
  }
  g.save();
  g.fillStyle = "#cfd5db";
  g.strokeStyle = "#5b7aa3";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y + 9, 13, Math.PI, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(x - 17, y + 9);
  g.lineTo(x + 17, y + 9);
  g.stroke();
  g.fillStyle = "#5b7aa3";
  g.beginPath();
  g.arc(x, y - 6, 3.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawBoard(r, now) {
  const { cx, cy } = BOARD;
  const st = boardState(r, now);
  const calling = st?.calling === true;
  // 拍の位置 → よこの位置。1拍=74ピクセル。0〜2.5拍が「うごく」3拍、3拍めの位置が「休み」
  const X = (p) => cx - 111 + p * 74;

  // カード(ききましょう=青、まねして=あたたかい色)
  g.save();
  g.fillStyle = "rgba(74,44,23,0.18)";
  roundRect(cx - 168, cy - 36, 336, 140, 26);
  g.fill();
  g.fillStyle = calling ? "#dfe9f6" : "#fff4d8";
  g.strokeStyle = calling ? "#5b7aa3" : INK;
  g.lineWidth = 3;
  roundRect(cx - 168, cy - 42, 336, 140, 26);
  g.fill();
  g.stroke();
  g.restore();

  if (!st) {
    g.fillStyle = "rgba(74,44,23,0.55)";
    g.font = "bold 13px sans-serif";
    g.textAlign = "left";
    g.fillText("ちゅうもん", cx - 150, cy - 22);
    return;
  }
  const { group, callStart, respStart, responding } = st;

  // ききましょう(おせない) / まねして！
  g.save();
  g.font = "bold 14px sans-serif";
  if (calling) {
    drawLid(cx - 146, cy - 28);
    g.textAlign = "left";
    g.fillStyle = "#3d5f8f";
    g.fillText("ききましょう ♪  (ふたを してあるよ)", cx - 116, cy - 22);
  } else {
    g.textAlign = "left";
    g.fillStyle = responding ? "#e8472f" : "rgba(74,44,23,0.55)";
    g.fillText(responding ? (r.state.enemyHp <= 0 ? "とどめ！ さいごまで おそう！" : "まねして おそう！") : "ちゅうもん", cx - 150, cy - 22);
  }
  g.restore();

  // 半拍(0.5拍)ずれた矢印が あるときは、お皿を ちいさくして、ならべる
  const tight = group.some((a, i) => group.some((b, j) => j > i && Math.abs(a.beat - b.beat) < 1));
  const pr = tight ? 17 : 24;
  const y = cy + 6;

  group.forEach((note, i) => {
    const x = X(note.beat);
    const since = now - note.callAt;
    const lit = calling && since >= 0 && since < 0.4; // 敵が、いま やって見せている
    if (lit) {
      g.save();
      g.globalAlpha = 0.6 * (1 - since / 0.4);
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.arc(x, y, pr + 12 - since * 10, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (note.label) {
      // ちかい矢印の名前は、たてに ずらして、かさならないように
      const near = group.some((o) => o !== note && o.slot < note.slot && Math.abs(o.beat - note.beat) < 1);
      g.save();
      g.fillStyle = calling ? "#3d5f8f" : INK;
      g.font = lit ? "bold 14px sans-serif" : "bold 12px sans-serif";
      g.textAlign = "center";
      g.globalAlpha = note.status === "miss" ? 0.45 : 1;
      g.fillText(note.label, x, y + pr + (near ? 31 : 17), 76);
      g.restore();
    }
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
    } else if (note.status === "miss") {
      drawPlate(note.key, x, y, pr, "miss", 0.7);
    } else {
      // ききましょうのあいだは、お皿を すこし うすくして、「いまは見るだけ」と わかるようにする
      drawPlate(note.key, x, y, lit ? pr * 1.12 : pr, "pending", calling && !lit ? 0.7 : 1);
    }
    // 順番の数字(1・2・3…)
    const bx = x - pr + 1;
    const by = y - pr + 1;
    g.beginPath();
    g.arc(bx, by, lit ? 10 : 8, 0, Math.PI * 2);
    g.fillStyle = lit ? "#e8472f" : "#fff";
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = lit ? "#fff" : INK;
    g.font = "bold 11px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(i + 1), bx, by + 1);
    g.textBaseline = "alphabetic";
  });

  // 拍の ものさし。大きい丸=拍(1・2・3・休)、小さい丸=その あいだの 半拍(0.5)。
  // 矢印のお皿は、この ものさしの 上に ならぶ。小さい丸の上にある矢印は、半拍の矢印。
  const ty = cy + 80;
  const phaseStart = calling ? callStart : respStart;
  const active = calling || responding ? Math.floor((now - phaseStart) / (BEAT / 2)) : -1;
  const noteAt = (p) => group.find((n) => Math.abs(n.beat - p) < 0.01);
  for (let k = 0; k <= 6; k += 1) {
    const p = k * 0.5;
    const x = X(p);
    const on = k === active;
    const note = noteAt(p);
    if (k % 2 === 0) {
      const b = k / 2; // 0,1,2,3 → 1・2・3・休
      g.beginPath();
      g.arc(x, ty, 9, 0, Math.PI * 2);
      g.fillStyle = on ? (b === 3 ? "#8a7f6f" : calling ? "#3d79d6" : "#e8472f") : "rgba(74,44,23,0.15)";
      g.fill();
      g.fillStyle = on ? "#fff" : "rgba(74,44,23,0.5)";
      g.font = "bold 11px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(b === 3 ? "休" : String(b + 1), x, ty + 1);
      g.textBaseline = "alphabetic";
    } else if (note) {
      // 半拍の矢印があるところだけ、小さい丸を出す(整数の拍だけのときは、出さない)
      g.beginPath();
      g.arc(x, ty, 6, 0, Math.PI * 2);
      g.fillStyle = on ? (calling ? "#3d79d6" : "#e8472f") : DIR_COLOR[note.key];
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.stroke();
    }
  }

  // 敵の ふきだし(♪):敵が やって見せているあいだだけ
  if (calling) {
    const bx = 700;
    const by = 112;
    g.save();
    g.fillStyle = "#fff";
    g.strokeStyle = "#5b7aa3";
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(bx - 46, by - 22, 92, 44, 20);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(bx + 18, by + 21);
    g.lineTo(bx + 40, by + 44);
    g.lineTo(bx + 34, by + 20);
    g.closePath();
    g.fillStyle = "#fff";
    g.fill();
    g.fillStyle = "#3d79d6";
    g.font = "bold 24px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("♪ ♫", bx, by + 1);
    g.restore();
  }
}

// --- 強化形態(手順えらびをまちがえた敵) ---
// 大きく、赤くひかり、ツノ・トゲのかた飾り・おおきな包丁をもつ。(あとから、専用の絵にさしかえられる)
const STRONG_MAX_HEIGHT = 330;

function strongScale(name, scale) {
  const img = images[name];
  if (!img || !img.naturalHeight) return scale;
  return scale * Math.min(1.28, STRONG_MAX_HEIGHT / (img.naturalHeight * scale));
}

function drawStrongBack(cx, bottom, w, h, now) {
  const pulse = 0.3 + Math.sin(now * 3) * 0.06;
  const aura = g.createRadialGradient(cx, bottom - h * 0.5, h * 0.1, cx, bottom - h * 0.5, h * 0.85);
  aura.addColorStop(0, `rgba(255,70,40,${pulse + 0.15})`);
  aura.addColorStop(1, "rgba(255,70,40,0)");
  g.fillStyle = aura;
  g.fillRect(cx - h, bottom - h * 1.5, h * 2, h * 1.7);
}

function drawStrongFront(cx, bottom, w, h) {
  const top = bottom - h;
  g.save();
  g.lineJoin = "round";
  g.strokeStyle = INK;
  g.lineWidth = 4;
  // ツノ
  g.fillStyle = "#ff5a2a";
  [-1, 1].forEach((side) => {
    g.beginPath();
    g.moveTo(cx + side * w * 0.12, top + h * 0.08);
    g.lineTo(cx + side * w * 0.3, top - h * 0.12);
    g.lineTo(cx + side * w * 0.3 + side * -2, top + h * 0.2);
    g.closePath();
    g.fill();
    g.stroke();
  });
  // かた飾り(金のトゲ)
  [-1, 1].forEach((side) => {
    const px = cx + side * w * 0.5;
    const py = bottom - h * 0.52;
    g.fillStyle = "#f2b630";
    for (let i = -1; i <= 1; i += 1) {
      g.beginPath();
      g.moveTo(px + i * 10 - 7, py - 6);
      g.lineTo(px + i * 14 + side * 4, py - 30);
      g.lineTo(px + i * 10 + 7, py - 6);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.arc(px, py, 15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
  // おおきな包丁(主人公のほうへ、つき出す)
  g.translate(cx - w * 0.62, bottom - h * 0.46);
  g.rotate(-0.5);
  g.fillStyle = "#e9edf2";
  g.beginPath();
  g.moveTo(0, -8);
  g.lineTo(-h * 0.36, -8);
  g.quadraticCurveTo(-h * 0.41, 8, -h * 0.36, 24);
  g.lineTo(0, 24);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = "#6b3f1e";
  g.beginPath();
  g.roundRect(0, -6, 38, 28, 8);
  g.fill();
  g.stroke();
  g.restore();
}

// 手順ならべの答えあわせのあと、「つぎの敵」がどうなるかを見せる。
// まちがえると、敵が大きく・つよい姿に変わり、体力がふえる(+15%)。ぜんぶ合っていれば、そのまま。
function drawNextEnemyPreview(r, now) {
  const q = r.quiz;
  if (!q || !q.answered || !q.result) return;
  const enemy = enemyOf(r.state);
  const wrong = !q.result.correct;
  const e = wrong ? Math.min(1, Math.max(0, now - (q.answeredAt ?? now)) / 0.7) : 0;
  const ease = 1 - (1 - e) * (1 - e);
  const x = 700;
  const y = 188;
  const w = 244;
  const h = 208;

  g.save();
  g.fillStyle = "#fff4d8";
  g.strokeStyle = wrong ? "#e8472f" : INK;
  g.lineWidth = 4;
  roundRect(x, y, w, h, 22);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.font = "bold 15px sans-serif";
  g.textAlign = "left";
  g.fillText(`つぎの敵：${enemy.name}`, x + 14, y + 26);

  // 敵(まちがえたときは、大きく・強い姿に かわる)
  const name = `${enemy.id}_normal`;
  const img = images[name];
  const strongImg = images[`${enemy.id}_strong_normal`];
  if (wrong && STRONG_ART && strongImg && strongImg.naturalHeight && img && img.naturalHeight) {
    const cx = x + w / 2;
    const bottom = y + 150;
    const fit = (im, maxH, maxW) => Math.min(maxH / im.naturalHeight, maxW / im.naturalWidth);
    const s1 = fit(img, 118, 150) * (1 - 0.0 * ease);
    const s2 = fit(strongImg, 136, 210) * (0.82 + 0.18 * ease);
    g.globalAlpha = 1 - ease;
    g.drawImage(img, cx - (img.naturalWidth * s1) / 2, bottom - img.naturalHeight * s1, img.naturalWidth * s1, img.naturalHeight * s1);
    g.globalAlpha = ease;
    g.drawImage(strongImg, cx - (strongImg.naturalWidth * s2) / 2, bottom - strongImg.naturalHeight * s2, strongImg.naturalWidth * s2, strongImg.naturalHeight * s2);
    g.globalAlpha = 1;
  } else if (img && img.naturalHeight) {
    const base = 118 / img.naturalHeight;
    const k = 1 + 0.22 * ease;
    const sc = base * k;
    const cx = x + w / 2;
    const bottom = y + 146;
    const iw = img.naturalWidth * sc;
    const ih = img.naturalHeight * sc;
    if (wrong) {
      g.globalAlpha = ease;
      drawStrongBack(cx, bottom, iw, ih, now);
      g.globalAlpha = 1;
    }
    g.drawImage(img, cx - iw / 2, bottom - ih, iw, ih);
    if (wrong) {
      g.globalAlpha = ease;
      drawStrongFront(cx, bottom, iw, ih);
      g.globalAlpha = 1;
    }
  }

  // 体力
  const from = enemy.hp;
  const to = r.state.enemyMax;
  const by = y + 160;
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(x + 14, by, w - 28, 14);
  const full = w - 28;
  g.fillStyle = "#ff6b6b";
  g.fillRect(x + 14, by, full * (from / to + (1 - from / to) * ease), 14);
  if (wrong) {
    g.fillStyle = "#e8472f";
    g.fillRect(x + 14 + full * (from / to), by, full * (1 - from / to) * ease, 14);
  }
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.strokeRect(x + 14, by, full, 14);
  g.font = "bold 15px sans-serif";
  g.textAlign = "center";
  g.fillStyle = wrong ? "#e8472f" : "#2f9e44";
  g.fillText(wrong ? `パワーアップ！ たいりょく ${from} → ${to}(+15%)` : `そのまま！ たいりょく ${from}`, x + w / 2, y + 196, w - 20);
  g.restore();
}

// 強化形態の絵の倍率。高さ(boss=大きめ)と、はば(画面の右はしに はみださない)の せまいほうに あわせる。
const STRONG_FIT = { egg: [320, 360], milk: [330, 360], mix: [300, 320], butter: [280, 320], syrup: [340, 350] };
function strongArtScale(id) {
  const img = images[`${id}_strong_normal`];
  if (!img || !img.naturalHeight) return SCALE[id];
  const [maxH, maxW] = STRONG_FIT[id] ?? [300, 320];
  return Math.min(maxH / img.naturalHeight, maxW / img.naturalWidth);
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
  const inQuiz = r.phase === "quiz" && r.quiz;
  if (inQuiz) {
    drawQuizScene(g, r.quiz.failKey, now);
  } else drawStation(g, s.enemyIndex, r.shown, now, s.cookFails);

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

  if (!inQuiz) {
    // 敵:ひるむと白くひかり、うしろへ下がる
    const since = now - r.hitAt;
    const flinch = since >= 0 && since < 0.18 ? 1 - since / 0.18 : 0;
    const weak = r.enemyPose === "normal" && s.enemyHp / s.enemyMax < 0.5 ? "damage" : r.enemyPose;
    const strong = s.fails[enemy.id] === true;
    const ename = strong && STRONG_ART ? `${enemy.id}_strong_${weak}` : `${enemy.id}_${weak}`;
    const edy = r.enemyPose === "normal" ? bounce : 0;
    const ex = strong && STRONG_ART ? 760 : 770;
    const overlay = strong && !STRONG_ART;
    const escale = strong && STRONG_ART ? strongArtScale(enemy.id) : overlay ? strongScale(ename, SCALE[enemy.id]) : SCALE[enemy.id];
    const eimg = images[ename];
    const ew = eimg?.naturalWidth ? eimg.naturalWidth * escale : 0;
    const eh = eimg?.naturalHeight ? eimg.naturalHeight * escale : 0;
    if (overlay && ew && r.enemyPose !== "down") drawStrongBack(770, 398 + edy, ew, eh, now);
    if (flinch > 0) drawFlash(ename, ex, 398 + edy, escale, flinch * 0.5, flinch * 8);
    else drawSprite(ename, ex, 398, escale, { dy: edy });
    if (overlay && ew && r.enemyPose !== "down") drawStrongFront(770, 398 + edy, ew, eh);
  }

  if (inQuiz) {
    // おいた手順を、実際に やって見せる(主人公と、道具・材料の動き)
    const act = r.action;
    if (act && now >= act.from && now - act.from <= ACTION_TIME) drawActionFx(g, act.key, act.rank, (now - act.from) / ACTION_TIME, now, act.variant);
    drawNextEnemyPreview(r, now);
    Q.draw(g, r.quiz, now);
  }

  for (const shot of r.shots) drawShot(shot, now, heroX);
  for (const b of r.bursts) drawBurst(b, now);
  for (const c of r.chunks) drawChunk(c, now);

  if (r.stamp && now >= r.stamp.from && now < r.stamp.until) {
    g.save();
    g.globalAlpha = Math.min(1, (now - r.stamp.from) * 6, (r.stamp.until - now) * 3);
    drawFailStamp(g, now);
    g.restore();
  }

  // 体力など
  bar(24, 36, 300, 20, s.playerHp / PLAYER_HP, "#4ecb71", "みならい りょうりにん");
  bar(W - 324, 36, 300, 20, s.enemyHp / s.enemyMax, "#ff6b6b", enemy.name);
  outlined(`${s.score}`, W / 2, 44, 34, "#4a2c17");
  const failCount = Object.keys(s.fails).length;
  if (failCount) outlined(`手順まちがい ×${failCount}`, 24 + 150, 82, 18, "#e8472f");
  if (s.combo >= 2) outlined(`${s.combo} COMBO`, W / 2, 80, 22, "#e8472f");
  g.font = "bold 16px sans-serif";
  g.textAlign = "right";
  g.fillStyle = "#4a2c17";
  g.fillText(`${s.enemyIndex + 1} / ${s.recipe.enemies.length}`, W - 24, 82);

  if (!inQuiz) drawBoard(r, now);

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
  alive();
  const now = songTime();
  if (update(now)) {
    draw(now);
    frame = requestAnimationFrame(tick);
  }
}

// --- チュートリアル(はじめて あそぶとき・「あそびかた」) ---
// ことばは さいしょうに して、動きで つたえる。3まい:①ならべる ②まねして おす ③まちがえると
const TUT_KEY = "cookingBattle.tutorialSeen";
const TUT_SLIDES = 3;
const ease = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
let tut = null;
let tutFrame = 0;

function tutorialSeen() {
  try {
    return localStorage.getItem(TUT_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(TUT_KEY, "1");
  } catch {
    // 保存できなくても、そのまま あそべる
  }
}

function syncTutBar() {
  $("tut-prev").disabled = tut.slide === 0;
  $("tut-next").textContent = tut.slide === TUT_SLIDES - 1 ? "あそぶ！" : "つぎへ ▶";
  $("tut-dots").textContent = Array.from({ length: TUT_SLIDES }, (_, i) => (i === tut.slide ? "●" : "○")).join(" ");
}

function startTutorial() {
  cancelAnimationFrame(tutFrame);
  tut = { slide: 0, from: performance.now() / 1000, q: null };
  $("quiz").hidden = true;
  $("tut-bar").hidden = false;
  show("play");
  syncTutBar();
  tutFrame = requestAnimationFrame(tutTick);
}

function tutGo(delta) {
  if (!tut) return;
  const next = tut.slide + delta;
  if (next < 0) return;
  if (next >= TUT_SLIDES) {
    endTutorial();
    return;
  }
  tut.slide = next;
  tut.from = performance.now() / 1000;
  tut.q = null;
  syncTutBar();
}

function endTutorial() {
  cancelAnimationFrame(tutFrame);
  tut = null;
  $("tut-bar").hidden = true;
  markTutorialSeen();
  showCover();
}

function tutTick() {
  if (!tut) return;
  fitCanvas();
  drawTutorial((performance.now() / 1000 - tut.from) % 1000);
  tutFrame = requestAnimationFrame(tutTick);
}

function drawStageBg() {
  const wall = g.createLinearGradient(0, 0, 0, 380);
  wall.addColorStop(0, "#fff0cc");
  wall.addColorStop(1, "#ffdfa0");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#b9764a";
  g.fillRect(0, 380, W, H - 380);
  g.fillStyle = "#d39466";
  g.fillRect(0, 380, W, 12);
}

// 手のカーソル(ui_hand.png の ひだりがわの 手)
function drawHand(x, y, pinch) {
  const img = images.ui_hand;
  if (!img || !img.naturalWidth) return;
  const sw = img.naturalWidth * 0.56;
  const h = pinch ? 58 : 66;
  const w = (sw * h) / img.naturalHeight;
  g.drawImage(img, 0, 0, sw, img.naturalHeight, x - w * 0.3, y - h * 0.08, w, h);
}

function drawKeyCap(x, y, key, down) {
  const glyph = { L: "←", U: "↑", D: "↓", R: "→" }[key];
  g.save();
  g.fillStyle = down ? "#ffd23f" : "#fff";
  g.strokeStyle = INK;
  g.lineWidth = 4;
  roundRect(x - 30, y - 26 + (down ? 5 : 0), 60, 52, 12);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.font = "bold 30px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(glyph, x, y + (down ? 6 : 1));
  g.restore();
  g.textBaseline = "alphabetic";
}

// チュートリアルの 大見出し(いま、あそびかたを 見ているところだと わかるように)
function tutHeading(n, caption, color = "#e8472f") {
  g.save();
  g.fillStyle = "#4a2c17";
  roundRect(0, 0, W, 54, 0);
  g.fill();
  g.fillStyle = "#ffd23f";
  roundRect(14, 9, 170, 36, 18);
  g.fill();
  g.fillStyle = "#4a2c17";
  g.font = "bold 22px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(`あそびかた ${n}/${TUT_SLIDES}`, 99, 28);
  g.fillStyle = "#fff4d8";
  g.textAlign = "left";
  g.font = "bold 26px sans-serif";
  g.fillText(caption, 204, 28);
  g.restore();
  g.textBaseline = "alphabetic";
}

function drawTutorial(t) {
  drawStageBg();
  if (tut.slide === 0) tutArrange(t % 10.5);
  else if (tut.slide === 1) tutCopy(t % 6);
  else tutMistake(t % 5);
}

// ① カードを ドラッグして ならべる(手が 見本を見せる)
function tutArrange(t) {
  const def = DEFAULT_RECIPE.enemies[0];
  if (!tut.q) {
    const ranked = def.quiz.steps.map((item, rank) => ({ ...item, rank }));
    tut.q = Q.createQuiz(def, "egg", [ranked[1], ranked[2], ranked[0]]); // わざと ばらばらの じゅん
    for (const c of tut.q.cards) {
      c.x = tut.q.geo.hand[c.i].x;
      c.y = tut.q.geo.hand[c.i].y;
    }
  }
  const q = tut.q;
  drawQuizScene(g, "egg", t);
  let heroPose = "normal";
  let lunge = 0;
  let cursor = { x: 640, y: 360, pinch: false };
  q.slots.fill(-1);
  q.hover = -1;
  q.stage = "arrange";
  q.verdictAt = 8.3;
  for (let r = 0; r < 3; r += 1) {
    const t0 = 0.8 + r * 2.4;
    const ci = q.items.findIndex((it) => it.rank === r);
    const card = q.cards.find((c) => c.i === ci);
    const home = q.geo.hand[ci];
    const slot = q.geo.slots[r];
    const grab = { x: home.x + q.geo.w / 2, y: home.y + q.geo.h / 2 };
    const drop = { x: slot.x + q.geo.w / 2, y: slot.y + q.geo.h / 2 };
    const prev = r === 0 ? { x: 640, y: 360 } : { x: q.geo.slots[r - 1].x + q.geo.w / 2, y: q.geo.slots[r - 1].y + q.geo.h / 2 };
    if (t < t0) {
      card.x = home.x;
      card.y = home.y;
      card.drag = false;
      card.rot = 0;
    } else if (t < t0 + 0.5) {
      const k = (t - t0) / 0.5;
      cursor = { x: lerp(prev.x, grab.x, ease(k)), y: lerp(prev.y, grab.y, ease(k)), pinch: false };
    } else if (t < t0 + 1.4) {
      const k = ease((t - t0 - 0.5) / 0.9);
      cursor = { x: lerp(grab.x, drop.x, k), y: lerp(grab.y, drop.y, k), pinch: true };
      card.x = lerp(home.x, slot.x, k);
      card.y = lerp(home.y, slot.y, k);
      card.drag = true;
      card.rot = 0.05;
      q.hover = r;
    } else {
      q.slots[r] = ci;
      card.x = slot.x;
      card.y = slot.y;
      card.drag = false;
      card.rot = 0;
      if (t < t0 + 1.9) cursor = { x: drop.x + 14, y: drop.y + 8, pinch: false };
      else if (t < t0 + 2.4) cursor = null;
      if (t - t0 - 1.4 < 1.0) {
        heroPose = "attack";
        lunge = Math.sin(Math.min(1, (t - t0 - 1.4) / 0.5) * Math.PI);
        drawActionFx(g, "egg", r, (t - t0 - 1.4) / 1.0, t);
      }
    }
  }
  const allPlaced = t > 8.0;
  q.stage = allPlaced ? "verdict" : "arrange";
  if (allPlaced) q.slots.forEach((_, i) => (q.slots[i] = q.items.findIndex((it) => it.rank === i)));
  drawSprite(`hero_${heroPose}`, 150 + lunge * LUNGE, 395, SCALE.hero);
  // 手が カードの上に くるよう、カード → 手の じゅんで 描く
  Q.draw(g, q, t);
  if (cursor && !allPlaced) drawHand(cursor.x, cursor.y, cursor.pinch);
  tutHeading(1, "ドラッグして ならべよう");
}

// ② 敵が やって見せる → まねして おす
function tutCopy(t) {
  const labels = ["コンコン", "パカッ", "ポトン"];
  const keys = ["L", "R", "L"];
  const beats = [0, 1, 2];
  const notes = beats.map((b, i) => ({
    bar: 1,
    slot: i,
    beat: b,
    key: keys[i],
    label: labels[i],
    time: BAR + b * BEAT,
    callAt: b * BEAT,
    status: t >= BAR + b * BEAT ? "hit" : "pending",
    hitAt: BAR + b * BEAT,
  }));
  const fake = { notes, state: { enemyHp: 50 }, pressed: {} };
  const calling = t < BAR;
  const heroHit = notes.some((n) => t >= n.time && t < n.time + 0.25);
  const enemyCue = notes.some((n) => t >= n.callAt && t < n.callAt + 0.25);
  drawSprite("hero_" + (heroHit ? "attack" : "normal"), 150, 395, SCALE.hero);
  drawSprite("egg_" + (enemyCue ? "attack" : "normal"), 770, 398, SCALE.egg);
  drawBoard(fake, t);
  // 矢印キー:おすところが ひかる
  ["L", "U", "D", "R"].forEach((key, i) => {
    const down = notes.some((n) => n.key === key && t >= n.time && t < n.time + 0.2);
    drawKeyCap(380 + i * 70, 470, key, down);
  });
  if (calling) tutHeading(2, "みて ♪", "#3d79d6");
  else tutHeading(2, "まねして おす！");
}

// ③ まちがえると
function tutMistake(t) {
  const k = ease(Math.min(1, Math.max(0, (t - 1.2) / 1.0)));
  const panel = (x, title) => {
    g.save();
    g.fillStyle = "#fff4d8";
    g.strokeStyle = INK;
    g.lineWidth = 4;
    roundRect(x, 90, 420, 330, 24);
    g.fill();
    g.stroke();
    g.restore();
    outlined(title, x + 210, 140, 26, INK);
  };
  const pic = (name, cx, bottom, maxH, maxW, alpha) => {
    const img = images[name];
    if (!img || !img.naturalWidth) return;
    const s = Math.min(maxH / img.naturalHeight, maxW / img.naturalWidth);
    g.save();
    g.globalAlpha = alpha;
    g.drawImage(img, cx - (img.naturalWidth * s) / 2, bottom - img.naturalHeight * s, img.naturalWidth * s, img.naturalHeight * s);
    g.restore();
  };
  // 左:手順の ならべまちがい → 敵が つよく
  panel(40, "ならべまちがい");
  pic("egg_normal", 250, 330, 140, 190, 1 - k);
  pic("egg_strong_normal", 250, 330, 160, 250, k);
  outlined("つよくなる！", 250, 380, 28, "#e8472f");
  g.fillStyle = "rgba(0,0,0,0.2)";
  g.fillRect(110, 398, 280, 12);
  g.fillStyle = "#ff6b6b";
  g.fillRect(110, 398, 280 * lerp(0.87, 1, k), 12);
  // 右:リズムの ミス → 料理が しっぱい
  panel(500, "ミスが ふえると");
  pic("dish_pan_golden", 710, 330, 130, 200, 1 - k);
  pic("fail_burnt", 710, 330, 150, 220, k);
  if (k > 0.6) {
    const stamp = images.ui_stamp_fail;
    if (stamp && stamp.naturalWidth) {
      g.save();
      g.globalAlpha = (k - 0.6) / 0.4;
      g.translate(780, 190);
      g.rotate(-0.12);
      g.drawImage(stamp, -55, -48, 110, 96);
      g.restore();
    }
  }
  outlined("しっぱい…", 710, 380, 28, "#555");
  tutHeading(3, "まちがえると…");
}

// --- 入力 ---
window.addEventListener("keydown", (event) => {
  unlock();
  if (event.code === "Escape" && tut) {
    endTutorial();
    return;
  }
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
    const pick = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[event.code];
    if (pick !== undefined) {
      event.preventDefault();
      if (!event.repeat) chooseAt(pick);
    } else if ((event.code === "Enter" || event.code === "Space" || event.code === "NumpadEnter") && !run.quiz.answered) {
      event.preventDefault();
      if (!event.repeat) confirmQuiz();
    } else if (event.code === "Backspace" && !run.quiz.answered) {
      event.preventDefault();
      if (!event.repeat) undoChoice();
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
$("btn-quit").addEventListener("click", () => (tut ? endTutorial() : quitToCover()));
$("btn-tutorial").addEventListener("click", startTutorial);
$("tut-next").addEventListener("click", () => tutGo(1));
$("tut-prev").addEventListener("click", () => tutGo(-1));
$("tut-skip").addEventListener("click", endTutorial);
$("btn-quiz-next").addEventListener("click", () => endQuiz());
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return [((event.clientX - rect.left) * W) / rect.width, ((event.clientY - rect.top) * H) / rect.height];
}
canvas.addEventListener("pointerdown", (event) => {
  if (!run || run.phase !== "quiz" || !run.quiz) return;
  unlock();
  const [x, y] = canvasPoint(event);
  const ev = Q.pointerDown(run.quiz, x, y);
  if (ev) {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // 取りつけられなくても、ドラッグは つづけられる
    }
    event.preventDefault();
    handleQuizEvent(ev);
  }
});
canvas.addEventListener("pointermove", (event) => {
  if (!run || !run.quiz) return;
  const [x, y] = canvasPoint(event);
  Q.pointerMove(run.quiz, x, y);
});
canvas.addEventListener("pointerup", (event) => {
  if (!run || !run.quiz) return;
  const [x, y] = canvasPoint(event);
  handleQuizEvent(Q.pointerUp(run.quiz, x, y));
});
canvas.addEventListener("pointercancel", () => {
  if (run?.quiz?.drag) {
    run.quiz.drag.drag = false;
    run.quiz.drag = null;
  }
});

// 画面がかくれたら、ゲームをやめて、BGMも止める(のこらないように)
document.addEventListener("visibilitychange", () => {
  if (document.hidden && run) quitToCover();
});
window.addEventListener("pagehide", stopSong);

// 動作確認用。アドレスの最後に ?debug をつけたときだけ、外から中をのぞける。
if (location.search.includes("debug")) {
  window.__game = { getRun: () => run, songTime, update, press, draw, begin, activeSources, choose, chooseAt, endQuiz, undoChoice, confirmQuiz, drawTutorial, getTut: () => tut, startTutorial, endTutorial, fitCanvas };
}

loadImages().then(() => {
  useArt(images);
  if (!run) {
    showCover();
    if (!tutorialSeen()) startTutorial(); // はじめて ひらいたときは、あそびかたを 見せる
  }
});
