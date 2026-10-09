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
