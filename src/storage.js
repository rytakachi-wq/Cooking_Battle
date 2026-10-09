// 端末内に保存する成績。名前や個人情報は入れない。
// 保存できない環境でも遊べるように、失敗しても、そのページを開いている間は覚えておく。

const KEY = "cookingBattle.stats";

let cache = null;

function number(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function loadStats() {
  if (!cache) {
    cache = { bestScore: 0, wins: 0, plays: 0, bestRank: "" };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      cache.bestScore = number(saved.bestScore);
      cache.wins = number(saved.wins);
      cache.plays = number(saved.plays);
      cache.bestRank = ["S", "A", "B", "C"].includes(saved.bestRank) ? saved.bestRank : "";
    } catch {
      // 読めなければ、はじめからにする。
    }
  }
  return { ...cache };
}

// 1回の結果を記録する。最高得点を超えたら isRecord が true。
export function recordPlay({ score, won, rank }) {
  const stats = loadStats();
  const isRecord = score > stats.bestScore;
  stats.plays += 1;
  if (won) {
    stats.wins += 1;
    const order = ["S", "A", "B", "C"];
    if (!stats.bestRank || order.indexOf(rank) < order.indexOf(stats.bestRank)) stats.bestRank = rank;
  }
  stats.bestScore = Math.max(stats.bestScore, score);
  cache = stats;
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // 保存できなくても遊びは続けられる。
  }
  return { isRecord };
}
