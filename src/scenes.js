// 「手順ならべ」のときに出す、場面の絵。問題の内容に合わせた、道具や材料を、調理台のまわりに おく。
//   準備:洗面台・せっけん・タオル　卵:卵のパック・ボウル　牛乳:牛乳パック・計量カップ
//   ミックス:ミックスの袋・ボウル・泡立て器　バター:コンロ・フライパン・バター　仕上げ:コンロ・お皿・シロップ
// 絵は、コードで描く。主人公は、いつもどおり、左に出る(main.js)。

import { drawStation } from "./station.js";

const INK = "#4a2c17";

function box(g, x, y, w, h, r, fill, stroke = INK, width = 3) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.lineWidth = width;
    g.strokeStyle = stroke;
    g.stroke();
  }
}

function oval(g, x, y, rx, ry, fill, stroke = INK, width = 3) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.lineWidth = width;
    g.strokeStyle = stroke;
    g.stroke();
  }
}

function label(g, text, x, y) {
  g.save();
  g.font = "bold 16px sans-serif";
  g.textAlign = "center";
  g.lineWidth = 5;
  g.strokeStyle = "#fff";
  g.strokeText(text, x, y);
  g.fillStyle = INK;
  g.fillText(text, x, y);
  g.restore();
}

// 卵(たて)
function egg(g, x, y, s = 1) {
  g.beginPath();
  g.ellipse(x, y, 17 * s, 22 * s, 0, 0, Math.PI * 2);
  g.fillStyle = "#fdf5e6";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
}

// 洗面台:じゃ口、水、せっけん、タオル
function sink(g, t) {
  // かべの タオルかけ
  box(g, 640, 150, 8, 70, 4, "#c9a26b");
  box(g, 600, 160, 90, 100, 8, "#eaf4ff");
  for (let i = 0; i < 4; i += 1) box(g, 604 + i * 22, 160, 11, 100, 0, "#9cc8f2", null);
  box(g, 600, 160, 90, 100, 8, null);
  label(g, "タオル", 645, 285);
  // 洗面台
  box(g, 300, 300, 260, 92, 18, "#f4f6f8");
  oval(g, 430, 312, 100, 22, "#cfd8e0");
  oval(g, 430, 314, 88, 16, "#aebdca", null);
  // じゃ口
  g.lineWidth = 12;
  g.strokeStyle = "#8d98a3";
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(430, 300);
  g.lineTo(430, 250);
  g.quadraticCurveTo(430, 230, 455, 230);
  g.lineTo(470, 230);
  g.stroke();
  g.lineWidth = 6;
  g.strokeStyle = "#cfd8e0";
  g.beginPath();
  g.moveTo(430, 300);
  g.lineTo(430, 250);
  g.quadraticCurveTo(430, 230, 455, 230);
  g.lineTo(470, 230);
  g.stroke();
  // 水
  g.fillStyle = "rgba(120,180,240,0.75)";
  for (let i = 0; i < 4; i += 1) {
    const ph = (t * 1.6 + i * 0.25) % 1;
    g.beginPath();
    g.ellipse(470, 238 + ph * 60, 4, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  label(g, "洗面台", 430, 420);
  // せっけん(ポンプ)
  box(g, 560, 262, 40, 52, 8, "#ffb3c7");
  box(g, 572, 248, 16, 16, 3, "#e4809f");
  box(g, 572, 244, 34, 8, 3, "#e4809f");
  label(g, "せっけん", 580, 340);
  // あわ
  for (let i = 0; i < 5; i += 1) {
    const ph = (t * 0.4 + i * 0.2) % 1;
    g.fillStyle = `rgba(255,255,255,${0.9 * (1 - ph)})`;
    g.strokeStyle = `rgba(150,190,230,${1 - ph})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(580 + Math.sin(ph * 6 + i) * 14, 238 - ph * 50, 6 + (i % 3) * 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

// 牛乳パック
function carton(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  box(g, -30, -80, 60, 80, 6, "#f4f8ff");
  g.beginPath();
  g.moveTo(-30, -80);
  g.lineTo(-18, -104);
  g.lineTo(18, -104);
  g.lineTo(30, -80);
  g.closePath();
  g.fillStyle = "#cfe3f7";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = "#4da3ff";
  [[-12, -58, 9], [10, -40, 8], [-8, -22, 7]].forEach(([dx, dy, r]) => {
    g.beginPath();
    g.arc(dx, dy, r, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();
}

// 計量カップ
function cup(g, x, y) {
  g.beginPath();
  g.moveTo(x - 32, y - 70);
  g.lineTo(x + 32, y - 70);
  g.lineTo(x + 26, y);
  g.lineTo(x - 26, y);
  g.closePath();
  g.fillStyle = "rgba(220,238,255,0.85)";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = 2;
  for (let i = 1; i <= 4; i += 1) {
    g.beginPath();
    g.moveTo(x - 30 + i * 1.2, y - i * 14);
    g.lineTo(x - 12 + i * 1.2, y - i * 14);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(x + 32, y - 60);
  g.quadraticCurveTo(x + 56, y - 56, x + 50, y - 28);
  g.stroke();
}

// ミックスの袋
function mixBag(g, x, y) {
  box(g, x - 38, y - 100, 76, 100, 6, "#fff4d8");
  g.beginPath();
  g.moveTo(x - 38, y - 100);
  g.lineTo(x + 38, y - 100);
  g.lineTo(x + 38, y - 76);
  g.lineTo(x - 38, y - 76);
  g.closePath();
  g.fillStyle = "#e8472f";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  oval(g, x, y - 38, 20, 8, "#e0a24c");
  oval(g, x, y - 48, 20, 8, "#f0b95e");
}

// 泡立て器
function whisk(g, x, y) {
  g.lineWidth = 4;
  g.strokeStyle = INK;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - 40);
  g.stroke();
  g.strokeStyle = "#aab2bb";
  for (let i = -2; i <= 2; i += 1) {
    g.beginPath();
    g.moveTo(x, y - 40);
    g.quadraticCurveTo(x + i * 14, y - 70, x, y - 96);
    g.stroke();
  }
}

// コンロ
function stove(g, x, y, w) {
  box(g, x - w / 2, y - 26, w, 26, 6, "#3a3a40");
  oval(g, x, y - 26, w * 0.34, 9, "#52525a", "#1d1d21", 2);
  oval(g, x, y - 26, w * 0.2, 5, "#2b2b30", null);
  [-1, 0, 1].forEach((i) => oval(g, x + i * (w * 0.28), y - 10, 6, 6, "#c8ccd2", "#1d1d21", 2));
}

// バター(かたまり)
function butter(g, x, y) {
  box(g, x - 28, y - 30, 56, 30, 4, "#ffe27a", "#b8921a");
  box(g, x - 28, y - 30, 56, 9, 4, "#fff0a8", "#b8921a");
}

// シロップのびん
function syrupBottle(g, x, y) {
  box(g, x - 22, y - 96, 44, 96, 10, "#8a4b12");
  box(g, x - 12, y - 118, 24, 24, 4, "#6b3f1e");
  box(g, x - 16, y - 126, 32, 12, 4, "#f2b630", INK, 2);
  g.fillStyle = "#e8472f";
  g.beginPath();
  g.moveTo(x, y - 74);
  g.lineTo(x + 12, y - 52);
  g.lineTo(x, y - 58);
  g.lineTo(x - 12, y - 52);
  g.closePath();
  g.fill();
}

function spatula(g, x, y) {
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 40, y - 70);
  g.stroke();
  box(g, x + 28, y - 112, 36, 44, 6, "#2f2f33");
}

// key:準備(prep)、または 敵のid。t:経過秒(あわや水の動き)
export function drawQuizScene(g, key, t) {
  g.save();
  g.lineJoin = "round";
  if (key === "prep") {
    sink(g, t);
  } else if (key === "egg") {
    drawStation(g, 0, 0, t, {});
    // 卵のパック
    box(g, 610, 330, 130, 50, 10, "#d9c9a6");
    [0, 1, 2].forEach((i) => egg(g, 635 + i * 40, 328));
    label(g, "卵", 675, 410);
    label(g, "ボウル", 480, 420);
  } else if (key === "milk") {
    drawStation(g, 1, 0, t, {});
    carton(g, 650, 392, 1.1);
    cup(g, 330, 392);
    label(g, "牛乳", 650, 420);
    label(g, "計量カップ", 335, 420);
  } else if (key === "mix") {
    drawStation(g, 2, 0, t, {});
    mixBag(g, 655, 392);
    whisk(g, 355, 392);
    label(g, "ホットケーキミックス", 655, 420);
    label(g, "泡立て器", 355, 420);
  } else if (key === "butter") {
    stove(g, 480, 392, 260);
    drawStation(g, 3, 0, t, {});
    butter(g, 690, 392);
    spatula(g, 330, 392);
    label(g, "バター", 690, 420);
    label(g, "フライパン", 480, 420);
  } else if (key === "syrup") {
    stove(g, 700, 392, 170);
    oval(g, 700, 352, 66, 17, "#2b2b30");
    box(g, 752, 343, 58, 12, 6, INK, null);
    drawStation(g, 4, 0, t, {});
    syrupBottle(g, 340, 392);
    label(g, "シロップ", 340, 420);
    label(g, "お皿", 480, 420);
    label(g, "コンロ", 700, 420);
  }
  g.restore();
}

// ---- 手順の動き(カードを おいたとき、実際に やってみせる) ----
// key:場面(prep・egg・milk・mix・butter・syrup)、rank:その手順の正しい順(0から)、p:進み(0〜1)、t:時刻(秒)
const ease = (p) => p * p * (3 - 2 * p);
const lerp = (a, b, p) => a + (b - a) * p;

function star(g, x, y, r, rot = 0) {
  g.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = rot + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.4;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  g.fillStyle = "#ffd23f";
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.stroke();
}

function miniFlame(g, x, y, size, t, seed) {
  const sway = Math.sin(t * 9 + seed) * size * 0.12;
  g.beginPath();
  g.moveTo(x - size * 0.45, y);
  g.quadraticCurveTo(x - size * 0.55, y - size * 0.7, x + sway, y - size * 1.2);
  g.quadraticCurveTo(x + size * 0.55, y - size * 0.6, x + size * 0.45, y);
  g.closePath();
  g.fillStyle = "#ff7a1a";
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = INK;
  g.stroke();
  g.beginPath();
  g.moveTo(x - size * 0.22, y);
  g.quadraticCurveTo(x - size * 0.25, y - size * 0.4, x + sway * 0.5, y - size * 0.7);
  g.quadraticCurveTo(x + size * 0.25, y - size * 0.35, x + size * 0.22, y);
  g.closePath();
  g.fillStyle = "#ffd23f";
  g.fill();
}

function stream(g, x1, y1, x2, y2, width, color = "rgba(245,250,255,0.95)") {
  g.save();
  g.lineCap = "round";
  g.strokeStyle = INK;
  g.lineWidth = width + 4;
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo((x1 + x2) / 2 + 6, Math.min(y1, y2) + 10, x2, y2);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
  g.restore();
}

function disc(g, x, y, rx, ry, fill) {
  oval(g, x, y, rx, ry, fill, "#8a5a1c", 3);
}

export function drawActionFx(g, key, rank, p, t) {
  const e = Math.min(1, p * 6, (1 - p) * 6 + 0.001);
  g.save();
  g.lineJoin = "round";
  g.globalAlpha = Math.max(0, Math.min(1, e));
  if (key === "prep") {
    if (rank === 0) {
      // 身じたく:きらきら(かみを むすび、エプロンを つける)
      for (let i = 0; i < 6; i += 1) {
        const a = t * 3 + (i * Math.PI) / 3;
        star(g, 150 + Math.cos(a) * 78, 215 + Math.sin(a) * 52, 9 + 3 * Math.sin(t * 8 + i), a);
      }
    } else if (rank === 1) {
      // 手をあらう:水と あわ
      stream(g, 470, 236, 440, 300, 8, "rgba(130,190,245,0.9)");
      for (let i = 0; i < 9; i += 1) {
        const ph = (p * 1.2 + i * 0.11) % 1;
        const bx = 380 + (i % 5) * 22 + Math.sin(t * 6 + i) * 4;
        const by = 300 - ph * 70 - (i % 3) * 8;
        const br = 8 + (i % 3) * 3 + p * 5;
        oval(g, bx, by, br, br, "rgba(255,255,255,0.92)", "rgba(120,170,230,0.9)", 2);
      }
    } else {
      // 手をふく:タオルが とんできて ふく
      const k = ease(Math.min(1, p * 1.6));
      const x = lerp(645, 275, k) + Math.sin(t * 16) * (k > 0.95 ? 6 : 0);
      const y = lerp(205, 330, k);
      box(g, x - 30, y - 22, 60, 44, 6, "#eaf4ff");
      for (let i = 0; i < 4; i += 1) box(g, x - 28 + i * 15, y - 22, 7, 44, 0, "#9cc8f2", null);
      box(g, x - 30, y - 22, 60, 44, 6, null);
    }
  } else if (key === "egg") {
    if (rank === 0) {
      // コンコン:卵を 台に 当てる
      const bounce = Math.abs(Math.sin(p * Math.PI * 3));
      const y = 284 - bounce * 46;
      egg(g, 520, y, 1.5);
      if (p > 0.35) {
        g.strokeStyle = INK;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(506, y - 8);
        g.lineTo(516, y);
        g.lineTo(510, y + 6);
        g.lineTo(524, y + 12);
        g.stroke();
      }
    } else if (rank === 1) {
      // パカッ:ひらく
      const k = ease(p);
      for (const side of [-1, 1]) {
        g.save();
        g.translate(480 + side * (6 + 34 * k), 258 - 10 * k);
        g.rotate(side * 0.8 * k);
        g.beginPath();
        g.ellipse(0, 0, 20, 17, 0, side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, side < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
        g.closePath();
        g.fillStyle = "#fdf5e6";
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = INK;
        g.stroke();
        g.restore();
      }
      oval(g, 480, 262 + 6 * k, 16 * k, 16 * k, "#ffc21a", INK, 3);
    } else {
      // ポトン:ボウルに おちる
      const fall = Math.min(1, p / 0.6);
      oval(g, 480, lerp(220, 292, fall * fall), 16, 16, "#ffc21a", INK, 3);
      if (p > 0.6) {
        const r = (p - 0.6) / 0.4;
        g.strokeStyle = "rgba(255,255,255,0.9)";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(480, 300, 20 + 40 * r, 6 + 10 * r, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (key === "milk") {
    if (rank === 0) {
      // はかる:計量カップに 牛乳が たまる
      carton(g, 330, 270, 0.9);
      stream(g, 340, 286, 336, 392 - 60 * p, 7);
      g.fillStyle = "#f4f8ff";
      g.fillRect(307, 392 - 62 * p, 50, 62 * p);
    } else if (rank === 1) {
      // そそぐ:カップを かたむけて ボウルへ
      const k = ease(Math.min(1, p * 1.5));
      g.save();
      g.translate(lerp(330, 420, k), lerp(392, 296, k));
      g.rotate(-1.0 * k);
      g.beginPath();
      g.moveTo(-32, -70);
      g.lineTo(32, -70);
      g.lineTo(26, 0);
      g.lineTo(-26, 0);
      g.closePath();
      g.fillStyle = "rgba(220,238,255,0.9)";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = INK;
      g.stroke();
      g.restore();
      if (p > 0.4) stream(g, 455, 270, 482, 302, 7);
    } else {
      // しまう:パックが 冷蔵庫へ
      const k = ease(p);
      box(g, 820, 240, 110, 160, 10, "#e7edf3");
      box(g, 828, 250, 94, 70, 6, "#f7fafc", INK, 2);
      box(g, 828, 330, 94, 60, 6, "#f7fafc", INK, 2);
      carton(g, lerp(650, 800, k), 392 - 10 * k, 1.1 - 0.4 * k);
    }
  } else if (key === "mix") {
    if (rank === 0) {
      // まぜる:泡立て器で ぐるぐる
      const a = t * 9;
      whisk(g, 480 + Math.cos(a) * 26, 330 + Math.sin(a) * 6);
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 3;
      for (let i = 0; i < 2; i += 1) {
        g.beginPath();
        g.ellipse(480, 306, 44 - i * 14, 9 - i * 3, 0, a + i, a + i + 3.3);
        g.stroke();
      }
    } else if (rank === 1) {
      // 粉を入れる:袋から 粉が ふる
      g.save();
      g.translate(570, 215);
      g.rotate(0.9);
      mixBag(g, 0, 0);
      g.restore();
      g.fillStyle = "rgba(255,248,230,0.95)";
      for (let i = 0; i < 14; i += 1) {
        const ph = (p * 2 + i * 0.07) % 1;
        g.beginPath();
        g.arc(528 - ph * 40 + (i % 4) * 4, 250 + ph * 55, 4, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // さっくり:ヘラで 切るように
      const a = Math.sin(p * Math.PI * 4) * 0.6;
      g.save();
      g.translate(480, 262);
      g.rotate(a);
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, -50);
      g.lineTo(0, 24);
      g.stroke();
      box(g, -14, 18, 28, 36, 6, "#e2574c");
      g.restore();
    }
  } else if (key === "butter") {
    if (rank === 0) {
      // あたためる:火と ゆげ
      [-60, -20, 22, 62].forEach((dx, i) => miniFlame(g, 480 + dx, 388, 30 + 6 * Math.sin(t * 7 + i), t, i));
      g.strokeStyle = "rgba(255,150,80,0.7)";
      g.lineWidth = 4;
      for (let i = 0; i < 4; i += 1) {
        const ph = (t * 0.8 + i * 0.25) % 1;
        g.beginPath();
        g.moveTo(430 + i * 30, 330 - ph * 40);
        g.quadraticCurveTo(436 + i * 30, 320 - ph * 40, 430 + i * 30, 310 - ph * 40);
        g.stroke();
      }
    } else if (rank === 1) {
      // 生地を流す:バターが とけて、生地が ひろがる
      oval(g, 462, 350, lerp(24, 36, p), lerp(8, 12, p), "#ffe27a", "#b8921a", 3);
      stream(g, 480, 250, 490, 344, lerp(8, 12, p), "rgba(250,236,190,0.97)");
      oval(g, 490, 350, 70 * p, 20 * p, "rgba(250,236,190,0.95)", "#8a5a1c", 3);
    } else {
      // 裏返す:ホットケーキが くるっと
      const up = Math.sin(p * Math.PI);
      const y = 350 - up * 100;
      const sy = Math.cos(p * Math.PI * 2);
      disc(g, 480, y, 68, Math.max(3, Math.abs(sy) * 20), sy >= 0 ? "#e0a24c" : "#f0c36e");
    }
  } else if (key === "syrup") {
    if (rank === 0) {
      // 火を止める:火が 小さくなって 消える
      miniFlame(g, 700, 372, Math.max(2, 34 * (1 - ease(p))), t, 1);
      for (let i = 0; i < 4; i += 1) {
        const ph = (p * 1.3 + i * 0.2) % 1;
        g.fillStyle = `rgba(200,200,205,${0.7 * (1 - ph)})`;
        g.beginPath();
        g.arc(690 + i * 10, 330 - ph * 80, 10 + ph * 12, 0, Math.PI * 2);
        g.fill();
      }
    } else if (rank === 1) {
      // お皿へ:ホットケーキを うつす
      const k = ease(p);
      disc(g, lerp(700, 480, k), lerp(340, 330, k) - Math.sin(k * Math.PI) * 70, 66, 18, "#e0a24c");
    } else if (rank === 2) {
      // バター:ぽとん
      const k = Math.min(1, p / 0.7);
      butter(g, 480, lerp(190, 302, k * k) + (p > 0.7 ? -Math.sin((p - 0.7) * 10) * 6 : 0));
    } else {
      // シロップ:とろーり
      g.save();
      g.translate(430, 230);
      g.rotate(-0.9 * ease(Math.min(1, p * 2)));
      syrupBottle(g, 0, 40);
      g.restore();
      if (p > 0.3) stream(g, 456, 252, 482, 298, 9, "#9a5314");
      oval(g, 482, 300, 16 + 52 * p, 5 + 12 * p, "#8a4b12", INK, 3);
    }
  }
  g.restore();
}
