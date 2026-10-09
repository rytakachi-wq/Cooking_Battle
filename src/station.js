// 画面まんなかの「調理台」。GOOD以上で当たるたびに、料理が進んでいく。
//   ① 卵：ボウルに卵が割り入れられる　② 牛乳：牛乳が注がれる　③ ミックス：まぜられる
//   ④ バター：フライパンで焼かれる　⑤ シロップ：ホットケーキにシロップがかかる
// 絵は、コードで描く(画像ファイルはいらない)。

export const ENEMY_FX = {
  egg: { shout: "パカッ！", color: "#ffb000", chunk: "#ffc21a" },
  milk: { shout: "トクトク！", color: "#2f7bff", chunk: "#ffffff" },
  mix: { shout: "ぐるぐる！", color: "#d9822b", chunk: "#f6e3b8" },
  butter: { shout: "ジュワッ！", color: "#e8a900", chunk: "#ffe066" },
  syrup: { shout: "とろ〜り！", color: "#9a5314", chunk: "#a85a14" },
};

export const STATION = { x: 480, y: 392 }; // 調理台の中心(下のはし)

const INK = "#4a2c17";

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function ellipse(g, x, y, rx, ry, fill, stroke = INK, width = 3) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
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

// ボウル(① ② ③)。p は、いまの敵をどこまで倒したか(0〜1)。
function bowl(g, stage, p, t, fails) {
  const cx = STATION.x;
  const top = STATION.y - 92;
  // 本体
  g.beginPath();
  g.moveTo(cx - 92, top);
  g.bezierCurveTo(cx - 92, top + 120, cx + 92, top + 120, cx + 92, top);
  g.closePath();
  g.fillStyle = "#eaf4ff";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = "#9cc8f2"; // 青い帯
  g.beginPath();
  g.moveTo(cx - 84, top + 30);
  g.quadraticCurveTo(cx, top + 62, cx + 84, top + 30);
  g.lineTo(cx + 78, top + 46);
  g.quadraticCurveTo(cx, top + 80, cx - 78, top + 46);
  g.closePath();
  g.fill();
  // ふちと、なか
  ellipse(g, cx, top, 92, 24, "#cfe3f7");
  ellipse(g, cx, top + 2, 80, 19, "#a9c7e3", null);

  g.save();
  g.beginPath();
  g.ellipse(cx, top + 2, 80, 19, 0, 0, Math.PI * 2);
  g.clip();
  const eggP = stage === 0 ? p : 1;
  const milkP = stage === 1 ? p : stage > 1 ? 1 : 0;
  const mixP = stage === 2 ? p : stage > 2 ? 1 : 0;
  if (milkP > 0) {
    // 牛乳が、ひろがる
    ellipse(g, cx, top + 2, 80 * (0.35 + 0.65 * milkP), 19 * (0.35 + 0.65 * milkP), "#f4f8ff", null);
    for (let i = 0; i < 2; i += 1) {
      const r = ((t * 0.8 + i * 0.5) % 1) * 60 * milkP;
      g.strokeStyle = "rgba(120,170,230,0.5)";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(cx, top + 2, r, r * 0.24, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (eggP > 0) {
    // 卵白と黄身
    const s = 0.3 + 0.7 * eggP;
    ellipse(g, cx - 4, top + 2, 46 * s, 12 * s, mixP > 0 ? "rgba(255,253,244,0.0)" : "#fffdf4", null);
    ellipse(g, cx - 4, top, 18 * s, 8 * s, mixP > 0.4 ? "rgba(255,194,26,0)" : "#ffc21a", null);
  }
  if (mixP > 0) {
    // まざって、生地になる
    ellipse(g, cx, top + 2, 80, 19, mix("#f4f8ff", fails.mix ? "#c99a4a" : "#f6dca0", Math.min(1, mixP * 1.4)), null);
    g.strokeStyle = "rgba(190,140,60,0.6)";
    g.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      const a = t * 4 * (0.4 + mixP) + i * 2.1;
      g.beginPath();
      g.ellipse(cx, top + 2, 56 - i * 14, (56 - i * 14) * 0.24, 0, a, a + 2.4);
      g.stroke();
    }
  }
  if (fails.egg && eggP > 0.2) {
    // からが入っちゃった
    g.fillStyle = "#f3e6cf";
    g.strokeStyle = "#8a6a43";
    g.lineWidth = 2;
    [[-34, -4, 1], [12, 6, -1], [30, -6, 1]].forEach(([dx, dy, d]) => {
      g.beginPath();
      g.moveTo(cx + dx, top + dy);
      g.lineTo(cx + dx + 14 * d, top + dy + 3);
      g.lineTo(cx + dx + 5 * d, top + dy - 7);
      g.closePath();
      g.fill();
      g.stroke();
    });
  }
  if (fails.mix && mixP > 0.3) {
    // ダマ
    g.fillStyle = "rgba(255,240,200,0.9)";
    [[-40, 2], [-8, 8], [28, -2], [46, 6], [10, -6]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(cx + dx, top + 2 + dy, 6, 0, Math.PI * 2);
      g.fill();
    });
  }
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.beginPath();
  g.ellipse(cx, top, 92, 24, 0, 0, Math.PI * 2);
  g.stroke();
  if (fails.milk && milkP > 0.3) {
    // こぼれた牛乳
    ellipse(g, cx + 20, STATION.y + 2, 120, 9, "rgba(244,248,255,0.9)", "rgba(120,170,230,0.6)", 2);
  }

  // 泡立て器(③のとき、ぐるぐる)
  if (stage === 2) {
    const a = t * 7;
    const hx = cx + Math.cos(a) * 24;
    const hy = top + 2 + Math.sin(a) * 6;
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx + 70, top - 70);
    g.lineTo(hx, hy);
    g.stroke();
    g.strokeStyle = "#c9ccd1";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx + 70, top - 70);
    g.lineTo(hx, hy);
    g.stroke();
    ellipse(g, hx, hy, 11, 7, "rgba(220,225,232,0.8)", INK, 2);
  }
}

// フライパン(④)
function pan(g, p, t, fails) {
  const cx = STATION.x;
  const cy = STATION.y - 42;
  g.fillStyle = INK; // 取っ手
  g.beginPath();
  g.roundRect(cx + 86, cy - 8, 96, 16, 8);
  g.fill();
  ellipse(g, cx, cy + 8, 112, 32, "#2b2b30");
  ellipse(g, cx, cy, 108, 30, "#4a4a52");
  // 生地:しろっぽい → きつね色
  ellipse(g, cx, cy, 82, 22, mix("#f7e7b6", fails.butter ? "#3a2010" : "#d8933a", p), "#8a5a1c", 2);
  // バター:だんだんとける
  const bs = 1 - p;
  if (bs > 0.05) {
    g.save();
    g.translate(cx - 6, cy - 4);
    g.fillStyle = "#ffe27a";
    g.strokeStyle = "#b8921a";
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(-18 * bs - 4, -10 * bs - 2, 36 * bs + 8, 20 * bs + 4, 4);
    g.fill();
    g.stroke();
    g.restore();
  }
  // あわと湯気
  for (let i = 0; i < 5; i += 1) {
    const ph = (t * 0.6 + i * 0.2) % 1;
    g.fillStyle = fails.butter ? `rgba(70,70,70,${0.6 * (1 - ph) * Math.min(1, p * 3)})` : `rgba(255,255,255,${0.7 * (1 - ph) * Math.min(1, p * 3)})`;
    g.beginPath();
    g.arc(cx - 50 + i * 25, cy - 20 - ph * 60, 6 + ph * 6, 0, Math.PI * 2);
    g.fill();
  }
}

// お皿とホットケーキ(⑤)。p が進むほど、シロップがかかる。
function plate(g, p, t) {
  const cx = STATION.x;
  const cy = STATION.y - 22;
  ellipse(g, cx, cy + 6, 128, 30, "#ffffff");
  ellipse(g, cx, cy + 4, 92, 20, "#eef1f6", "#c8cfda", 2);
  for (let i = 0; i < 3; i += 1) {
    const y = cy - 6 - i * 20;
    g.fillStyle = "#e0a24c";
    g.fillRect(cx - 80, y - 14, 160, 28);
    ellipse(g, cx, y + 14, 80, 16, "#e0a24c", null);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 80, y - 14);
    g.lineTo(cx - 80, y + 14);
    g.moveTo(cx + 80, y - 14);
    g.lineTo(cx + 80, y + 14);
    g.stroke();
    ellipse(g, cx, y - 14, 80, 16, i === 2 ? "#f0b95e" : "#e0a24c");
  }
  const topY = cy - 6 - 2 * 20 - 14;
  // バター
  g.fillStyle = "#ffe27a";
  g.strokeStyle = "#b8921a";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(cx - 16, topY - 14, 32, 16, 3);
  g.fill();
  g.stroke();
  // シロップ
  if (p > 0.02) {
    const r = 18 + 56 * p;
    g.fillStyle = "#9a5314";
    g.beginPath();
    g.ellipse(cx, topY, r, r * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    const drips = [-0.7, -0.35, 0.1, 0.5, 0.8];
    drips.forEach((d, i) => {
      const len = Math.max(0, p * 78 - i * 6) + Math.sin(t * 3 + i) * 2;
      const x = cx + d * Math.min(r, 70);
      g.fillStyle = "#9a5314";
      g.beginPath();
      g.roundRect(x - 6, topY, 12, Math.min(len, 52), 6);
      g.fill();
    });
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(cx - r * 0.3, topY - 2, r * 0.25, r * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// 調理台をえがく。stage は敵の番号(0〜4)、p は、いまの敵をどこまで倒したか(0〜1)。
export function drawStation(g, stage, p, t, fails = {}) {
  g.save();
  g.lineJoin = "round";
  if (stage <= 2) bowl(g, stage, p, t, fails);
  else if (stage === 3) pan(g, p, t, fails);
  else plate(g, p, t);
  g.restore();
}
