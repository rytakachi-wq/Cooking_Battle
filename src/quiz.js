// 手順ならべ:カードを、ドラッグして、上の「じゅんばん」の わくに ならべる(トランプの ジジぬき のように)。
// カードは、イラストの上に出る。てもとに のこったカードは、下に ならぶ。
// 画面(canvas)の中だけで うごく。うごき・見た目は ここ、答えあわせや 場面は main.js。

const INK = "#4a2c17";
const W = 960;

// ---- 場所 ----
export function geometry(n) {
  const w = n >= 4 ? 150 : 196;
  const gap = n >= 4 ? 14 : 18;
  const h = 92;
  const slotX0 = 290; // 主人公(左)に かぶらないように、右へ よせる
  const handX0 = 140;
  return {
    w,
    h,
    slots: Array.from({ length: n }, (_, s) => ({ x: slotX0 + s * (w + gap), y: 84, w, h })),
    hand: Array.from({ length: n }, (_, i) => ({ x: handX0 + i * (w + gap), y: 418, w, h })),
    ok: { x: 806, y: 428, w: 134, h: 72 }, // 「けってい」ボタン
  };
}

// ---- 状態 ----
export function createQuiz(def, failKey, items) {
  const n = items.length;
  const geo = geometry(n);
  return {
    def,
    failKey,
    items,
    n,
    geo,
    slots: Array(n).fill(-1), // slots[s] = そこに おいた カードの番号(items の番号)
    cards: items.map((_, i) => ({ i, x: geo.hand[i].x, y: geo.hand[i].y + 40, rot: 0, drag: false })),
    drag: null,
    hover: -1,
    stage: "arrange", // arrange(ならべる) → demo(その じゅんで やってみる) → verdict(答えあわせ)
    answered: false,
    reveal: false, // 正しい じゅんばんに ならびかわった
    lastNow: 0,
  };
}

export function filled(q) {
  return q.slots.filter((s) => s >= 0).length;
}

function slotOf(q, i) {
  return q.slots.indexOf(i);
}

// カードを わくに おく。ふさがっていたら、いれかえる。{type, slot, item} を かえす
export function place(q, i, s) {
  const from = slotOf(q, i);
  const other = q.slots[s];
  if (other === i) return null;
  if (from >= 0) q.slots[from] = other; // いれかえ(わくどうし)。other が -1 なら、からになる
  q.slots[s] = i;
  return { type: "placed", slot: s, item: i };
}

export function placeFirstFree(q, i) {
  if (slotOf(q, i) >= 0) return null;
  const s = q.slots.indexOf(-1);
  return s >= 0 ? place(q, i, s) : null;
}

export function unplace(q, i) {
  const s = slotOf(q, i);
  if (s >= 0) q.slots[s] = -1;
}

// いちばん あとに おいたカードを、てもとに もどす
export function removeLast(q) {
  for (let s = q.n - 1; s >= 0; s -= 1) {
    if (q.slots[s] >= 0) {
      q.slots[s] = -1;
      return true;
    }
  }
  return false;
}

// のこり1まいは、じどうで おく
export function fillLast(q) {
  if (filled(q) !== q.n - 1) return;
  const rest = q.items.findIndex((_, i) => slotOf(q, i) < 0);
  placeFirstFree(q, rest);
}

export function order(q) {
  return [...q.slots];
}

function inside(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function homeOf(q, card) {
  const s = slotOf(q, card.i);
  if (q.reveal) return q.geo.slots[q.items[card.i].rank];
  return s >= 0 ? q.geo.slots[s] : q.geo.hand[card.i];
}

// ---- ポインタ(マウス・タッチ) ----
export function pointerDown(q, x, y) {
  if (q.stage !== "arrange") return null;
  if (filled(q) >= q.n - 1 && inside(q.geo.ok, x, y)) {
    fillLast(q);
    return { type: "confirm" };
  }
  for (let k = q.cards.length - 1; k >= 0; k -= 1) {
    const c = q.cards[k];
    if (x >= c.x && x <= c.x + q.geo.w && y >= c.y && y <= c.y + q.geo.h) {
      q.cards.splice(k, 1);
      q.cards.push(c); // 手前に
      c.drag = true;
      c.dx = x - c.x;
      c.dy = y - c.y;
      c.sx = x;
      c.sy = y;
      c.moved = false;
      q.drag = c;
      return { type: "pick" };
    }
  }
  return null;
}

export function pointerMove(q, x, y) {
  const c = q.drag;
  q.hover = -1;
  if (!c) return;
  c.x = x - c.dx;
  c.y = y - c.dy;
  if (Math.abs(x - c.sx) + Math.abs(y - c.sy) > 8) c.moved = true;
  // 手のさき(カードの まんなか)が とどく わくを あかるくする
  const cx = c.x + q.geo.w / 2;
  const cy = c.y + q.geo.h / 2;
  q.geo.slots.forEach((r, s) => {
    if (inside(r, cx, cy)) q.hover = s;
  });
}

export function pointerUp(q, x, y) {
  const c = q.drag;
  if (!c) return null;
  q.drag = null;
  c.drag = false;
  const cx = c.x + q.geo.w / 2;
  const cy = c.y + q.geo.h / 2;
  let target = -1;
  q.geo.slots.forEach((r, s) => {
    if (inside(r, cx, cy)) target = s;
  });
  q.hover = -1;
  if (!c.moved) {
    // クリックだけ:おいてあれば もどす、なければ あいている わくへ
    if (slotOf(q, c.i) >= 0) {
      unplace(q, c.i);
      return { type: "removed", item: c.i };
    }
    return placeFirstFree(q, c.i);
  }
  if (target >= 0) return place(q, c.i, target);
  unplace(q, c.i); // わくの そとで はなしたら、てもとに もどる
  return { type: "removed", item: c.i };
}

// ---- うごき(毎フレーム) ----
export function update(q, now) {
  const dt = q.lastNow ? Math.min(0.1, Math.max(0, now - q.lastNow)) : 0.016;
  q.lastNow = now;
  const k = 1 - Math.exp(-dt * 14);
  for (const c of q.cards) {
    const home = homeOf(q, c);
    if (!c.drag) {
      c.x += (home.x - c.x) * k;
      c.y += (home.y - c.y) * k;
    }
    c.rot += ((c.drag ? 0.05 : 0) - c.rot) * k;
  }
}

// ---- 絵 ----
function wrap(g, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch === " " ? "" : ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function card(g, q, c, now) {
  const { w, h } = q.geo;
  const item = q.items[c.i];
  const s = slotOf(q, c.i);
  const placed = s >= 0 && !c.drag;
  g.save();
  g.translate(c.x + w / 2, c.y + h / 2);
  g.rotate(c.rot);
  if (c.drag) g.scale(1.06, 1.06);
  // かげ
  g.fillStyle = c.drag ? "rgba(0,0,0,0.28)" : "rgba(74,44,23,0.2)";
  rr(g, -w / 2 + 3, -h / 2 + (c.drag ? 10 : 5), w, h, 14);
  g.fill();
  // 本体
  g.fillStyle = "#fff4d8";
  g.strokeStyle = INK;
  g.lineWidth = 3;
  if (q.stage === "verdict" && q.reveal) {
    g.strokeStyle = "#2f9e44";
    g.lineWidth = 4;
  }
  rr(g, -w / 2, -h / 2, w, h, 14);
  g.fill();
  g.stroke();
  // 文
  g.fillStyle = INK;
  g.font = `bold ${w < 170 ? 13 : 15}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const lines = wrap(g, item.text, w - 22);
  const lh = w < 170 ? 17 : 19;
  lines.slice(0, 4).forEach((line, li) => g.fillText(line, 0, (li - (Math.min(lines.length, 4) - 1) / 2) * lh));
  // 手もとの番号(キーボードで えらぶとき)
  if (!placed && !c.drag) {
    g.fillStyle = INK;
    g.beginPath();
    g.arc(-w / 2 + 14, -h / 2 + 14, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 13px sans-serif";
    g.fillText(String(c.i + 1), -w / 2 + 14, -h / 2 + 15);
  }
  g.restore();
  g.textBaseline = "alphabetic";
}

export function draw(g, q, now) {
  const { geo, n } = q;
  // わく
  geo.slots.forEach((r, s) => {
    const hot = q.hover === s;
    g.save();
    g.fillStyle = hot ? "rgba(255,210,63,0.55)" : "rgba(255,255,255,0.45)";
    g.strokeStyle = hot ? "#e8a900" : "rgba(74,44,23,0.55)";
    g.lineWidth = hot ? 4 : 3;
    g.setLineDash(hot ? [] : [9, 7]);
    rr(g, r.x, r.y, r.w, r.h, 14);
    g.fill();
    g.stroke();
    g.setLineDash([]);
    if (q.slots[s] < 0) {
      g.fillStyle = "rgba(74,44,23,0.38)";
      g.font = "bold 40px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(String(s + 1), r.x + r.w / 2, r.y + r.h / 2);
    }
    g.restore();
    if (s < n - 1) {
      // すすむ むきの しるし
      g.fillStyle = "rgba(74,44,23,0.6)";
      g.beginPath();
      const ax = r.x + r.w + (geo.slots[s + 1].x - r.x - r.w) / 2;
      g.moveTo(ax - 5, r.y + r.h / 2 - 8);
      g.lineTo(ax + 6, r.y + r.h / 2);
      g.lineTo(ax - 5, r.y + r.h / 2 + 8);
      g.closePath();
      g.fill();
    }
  });
  // てもとの ならび(カードを おいたあとの あき)
  if (q.stage === "arrange") {
    geo.hand.forEach((r) => {
      g.save();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 3;
      g.setLineDash([6, 8]);
      rr(g, r.x, r.y, r.w, r.h, 14);
      g.stroke();
      g.restore();
    });
  }
  // カード(つかんでいる カードが いちばん 手前)
  for (const c of q.cards) card(g, q, c, now);

  // 答えあわせの しるし(○ ×)
  if (q.stage === "verdict") {
    const t = Math.min(1, (now - (q.verdictAt ?? now)) / 0.35);
    geo.slots.forEach((r, s) => {
      const ok = q.reveal || q.items[q.slots[s]]?.rank === s; // ならびかわったあとは、ぜんぶ ○
      const cx = r.x + r.w - 6;
      const cy = r.y + 6;
      g.save();
      g.translate(cx, cy);
      g.scale(0.4 + 0.6 * t, 0.4 + 0.6 * t);
      g.beginPath();
      g.arc(0, 0, 17, 0, Math.PI * 2);
      g.fillStyle = ok ? "#2f9e44" : "#e8472f";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = "#fff";
      g.stroke();
      g.lineCap = "round";
      g.lineWidth = 5;
      g.beginPath();
      if (ok) {
        g.moveTo(-7, 1);
        g.lineTo(-2, 7);
        g.lineTo(8, -6);
      } else {
        g.moveTo(-6, -6);
        g.lineTo(6, 6);
        g.moveTo(6, -6);
        g.lineTo(-6, 6);
      }
      g.stroke();
      g.restore();
    });
  }

  // 「けってい」ボタン:のこり1まい以下になったら
  if (q.stage === "arrange" && filled(q) >= n - 1) {
    const b = geo.ok;
    const pulse = 1 + Math.sin(now * 5) * 0.02;
    g.save();
    g.translate(b.x + b.w / 2, b.y + b.h / 2);
    g.scale(pulse, pulse);
    g.fillStyle = "#ff8a3d";
    g.strokeStyle = INK;
    g.lineWidth = 4;
    rr(g, -b.w / 2, -b.h / 2, b.w, b.h, 36);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.font = "bold 24px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("けってい！", 0, 1);
    g.restore();
    g.textBaseline = "alphabetic";
  }
}
