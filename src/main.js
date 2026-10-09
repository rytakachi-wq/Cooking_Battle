// 画面の切りかえ・入力・描画。ルールは game.js、音は audio.js、記録は storage.js。

import {
  ARROW_GLYPH,
  ARROW_KEYS,
  BAR,
  BEAT,
  ENEMIES,
  EXTRA_KEYS,
  PLAYER_HP,
  WINDOW,
  accuracy,
  createState,
  judge,
  makeBar,
  nextEnemy,
  rank,
  registerHit,
  registerMiss,
} from "./game.js";
import { getOffset, isMuted, playSe, setMuted, setOffset, songTime, startSong, stopSong, unlock } from "./audio.js";
import { ENEMY_FX, STATION, drawStation } from "./station.js";
import { loadStats, recordPlay } from "./storage.js";

const W = 960;
const H = 540;
const HIT_X = 190; // 矢印をおす位置
const SPEED = 420; // 矢印が流れる速さ(ピクセル/秒)。ゆっくりめにして、目の動きを小さくする
const FADE_IN = 150; // 矢印が出てくるとき、右はしでふわっと現れるはば(ピクセル)
const LUNGE = 110; // 主人公が、こうげきで前に出る大きさ
const LANE_Y = 462;
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
  ENEMIES.forEach((enemy) => add(enemy.id, POSES.enemy));
  return Promise.all(jobs);
}

// --- 画面の切りかえ ---
function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
}

function showCover() {
  const stats = loadStats();
  $("best").textContent = stats.plays
    ? `さいこうとくてん ${stats.bestScore}　クリア ${stats.wins}回${stats.bestRank ? `　さいこうランク ${stats.bestRank}` : ""}`
    : "";
  $("btn-mute").textContent = isMuted() ? "おと：なし" : "おと：あり";
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
    nextBar: 1, // 最初の小節(2秒め)から音符を出す。その前はカウントダウン
    lastPattern: -1,
    phase: "fight", // fight / down / end
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
    banner: { text: ENEMIES[0].step, from: BAR, until: BAR + 3 },
  };
  show("play");
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
}

function quitToCover() {
  cancelAnimationFrame(frame);
  run = null;
  stopSong();
  showCover();
}

function popup(text, color, now, x = HIT_X + 20, y = LANE_Y - 70) {
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

function finish(result, now) {
  run.result = result;
  run.phase = "end";
  run.phaseUntil = now + 2.4;
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
    run.downAt = now + 0.2; // 三日月がとどいてから、たおれる
    if (run.state.enemyIndex === ENEMIES.length - 1) {
      finish("win", now);
    } else {
      run.phase = "down";
      run.phaseUntil = now + 1.5;
    }
  }
}

function update(now) {
  const r = run;
  if (r.phase === "fight") {
    while (r.nextBar * BAR - now < LOOKAHEAD) {
      const bar = makeBar(ENEMIES[r.state.enemyIndex], r.nextBar * BAR, r.lastPattern);
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
    r.phase = "fight";
    r.enemyPose = "normal";
    r.enemyUntil = 0;
    r.lastPattern = -1;
    r.nextBar = Math.ceil((now + 2) / BAR);
    r.banner = { text: ENEMIES[r.state.enemyIndex].step, from: now, until: now + 2.5 };
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
    const fx = ENEMY_FX[ENEMIES[r.state.enemyIndex].id];
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
  r.notes = r.notes.filter((note) => note.time > now - 1 && !(note.status === "cancel"));
  r.popups = r.popups.filter((p) => now - p.from < 0.8);
  r.shots = r.shots.filter((p) => now - p.from < 0.25);
  r.bursts = r.bursts.filter((p) => now - p.from < 0.4);
  r.chunks = r.chunks.filter((p) => now - p.from < 0.5);
  return true;
}

function showResult() {
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
  $("r-best").textContent = loadStats().bestScore;
  $("r-record").hidden = !isRecord;
  show("result");
}

// --- 描画 ---
const KEY_COLOR = { L: "#ff6b6b", U: "#4ecb71", R: "#4da3ff", D: "#ffc93c" };

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

function drawArrowBox(key, x, y, size, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = KEY_COLOR[key];
  g.strokeStyle = "#4a2c17";
  g.lineWidth = 4;
  roundRect(x - size / 2, y - size / 2, size, size, 14);
  g.fill();
  g.stroke();
  g.fillStyle = "#fff";
  g.font = `bold ${size * 0.75}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 5;
  g.strokeText(ARROW_GLYPH[key], x, y + 2);
  g.fillText(ARROW_GLYPH[key], x, y + 2);
  g.restore();
  g.textBaseline = "alphabetic";
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

function draw(now) {
  const r = run;
  const s = r.state;
  const enemy = ENEMIES[s.enemyIndex];
  const dt = r.lastFrame ? Math.min(0.1, now - r.lastFrame) : 0;
  r.lastFrame = now;
  const beatPhase = (((now % BEAT) + BEAT) % BEAT) / BEAT;
  const bounce = -Math.abs(Math.sin(beatPhase * Math.PI)) * 3; // 目が疲れないよう、ゆれは小さく

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
  const target = r.phase === "down" || r.enemyPose === "down" || r.downAt ? 1 : 1 - s.enemyHp / enemy.hp;
  r.shown += (target - r.shown) * Math.min(1, dt * 7);
  drawStation(g, s.enemyIndex, r.shown, now);

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
  const weak = r.enemyPose === "normal" && s.enemyHp / enemy.hp < 0.5 ? "damage" : r.enemyPose;
  const ename = `${enemy.id}_${weak}`;
  const edy = r.enemyPose === "normal" ? bounce : 0;
  if (flinch > 0) drawFlash(ename, 770, 398 + edy, SCALE[enemy.id], flinch * 0.9, flinch * 18);
  else drawSprite(ename, 770, 398, SCALE[enemy.id], { dy: edy });

  for (const shot of r.shots) drawShot(shot, now, heroX);
  for (const b of r.bursts) drawBurst(b, now);
  for (const c of r.chunks) drawChunk(c, now);

  // 体力など
  bar(24, 36, 300, 20, s.playerHp / PLAYER_HP, "#4ecb71", "みならい りょうりにん");
  bar(W - 324, 36, 300, 20, s.enemyHp / enemy.hp, "#ff6b6b", enemy.name);
  outlined(`${s.score}`, W / 2, 44, 34, "#4a2c17");
  if (s.combo >= 2) outlined(`${s.combo} COMBO`, W / 2, 80, 22, "#e8472f");
  g.font = "bold 16px sans-serif";
  g.textAlign = "right";
  g.fillStyle = "#4a2c17";
  g.fillText(`${s.enemyIndex + 1} / ${ENEMIES.length}`, W - 24, 82);

  // レーン:ひとつの落ち着いた色。矢印は、右はしでふわっと現れる
  g.fillStyle = "#4a2a14";
  g.fillRect(0, LANE_Y - 52, W, 104);
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(0, LANE_Y - 52, W, 2);
  g.fillRect(0, LANE_Y + 50, W, 2);
  g.save();
  g.strokeStyle = `rgba(255,255,255,${0.75 + (1 - beatPhase) * 0.25})`;
  g.lineWidth = 5;
  g.setLineDash([10, 8]);
  roundRect(HIT_X - 36, LANE_Y - 36, 72, 72, 16);
  g.stroke();
  g.restore();

  const lastX = HIT_X + 600; // これより右の矢印は、まだ見せない
  for (const note of r.notes) {
    const x = HIT_X + (note.time - now) * SPEED;
    if (note.status === "hit") {
      const t = Math.max(0, now - note.hitAt);
      if (t < 0.2) drawArrowBox(note.key, HIT_X, LANE_Y, 56 + t * 160, 1 - t / 0.2);
      continue;
    }
    if (x > lastX) continue;
    const fade = Math.min(1, (lastX - x) / FADE_IN);
    if (note.status === "miss") drawArrowBox(note.key, x, LANE_Y, 56, 0.3 * fade);
    else if (note.status === "pending") drawArrowBox(note.key, x, LANE_Y, 56, fade);
  }

  // おしたキーの表示(右下)
  ["L", "U", "D", "R"].forEach((key, i) => {
    const lit = r.pressed[key] !== undefined && now - r.pressed[key] < 0.12;
    drawArrowBox(key, W - 190 + i * 52, H - 24, lit ? 40 : 34, lit ? 1 : 0.45);
  });

  // 判定の文字
  for (const p of r.popups) {
    const t = (now - p.from) / 0.8;
    g.globalAlpha = 1 - t * t;
    outlined(p.text, p.x, p.y - t * 30, p.big ? 40 : 32, p.color);
    g.globalAlpha = 1;
  }

  // カウントダウンと手順の見出し
  if (now < BAR) {
    const n = 4 - Math.floor(now / BEAT);
    if (n >= 1 && n <= 3) outlined(String(n), W / 2, 250, 120, "#e8472f");
    else if (now >= 0) outlined("GO!", W / 2, 250, 100, "#e8472f");
    outlined("矢印キーを リズムに合わせて おそう！", W / 2, 330, 28, "#4a2c17");
  }
  if (now >= r.banner.from && now < r.banner.until) {
    const t = now - r.banner.from;
    g.globalAlpha = Math.min(1, (r.banner.until - now) * 2, t * 4);
    outlined(r.banner.text, W / 2, 150, 44, enemy.boss ? "#8a2be2" : "#e8472f");
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
  if (!run) return;
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

$("btn-mute").addEventListener("click", () => {
  unlock();
  setMuted(!isMuted());
  $("btn-mute").textContent = isMuted() ? "おと：なし" : "おと：あり";
});

// 動作確認用。アドレスの最後に ?debug をつけたときだけ、外から中をのぞける。
if (location.search.includes("debug")) {
  window.__game = { getRun: () => run, songTime, update, press, draw, begin };
}

loadImages().then(() => {
  if (!run) showCover();
});
