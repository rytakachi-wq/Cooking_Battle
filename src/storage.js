// 端末内に保存する成績と「つづきから」。名前や個人情報は入れない。料理ごとに わけて 保存する。
// 保存できない環境でも遊べるように、失敗しても、そのページを開いている間は覚えておく。
// ホットケーキ(pancake)は、むかしの 保存の 名前を そのまま つかう(これまでの 記録を のこす)。

const STATS_KEY = "cookingBattle.stats";
const CP_KEY = "cookingBattle.checkpoint";

const keyOf = (base, recipeId) => (recipeId === "pancake" || !recipeId ? base : `${base}.${recipeId}`);

const cache = {};

function number(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function loadStats(recipeId = "pancake") {
  if (!cache[recipeId]) {
    const c = { bestScore: 0, wins: 0, plays: 0, bestRank: "" };
    try {
      const saved = JSON.parse(localStorage.getItem(keyOf(STATS_KEY, recipeId)) ?? "{}");
      c.bestScore = number(saved.bestScore);
      c.wins = number(saved.wins);
      c.plays = number(saved.plays);
      c.bestRank = ["S", "A", "B", "C"].includes(saved.bestRank) ? saved.bestRank : "";
    } catch {
      // 読めなければ、はじめからにする。
    }
    cache[recipeId] = c;
  }
  return { ...cache[recipeId] };
}

// 1回の結果を記録する。最高得点を超えたら isRecord が true。
export function recordPlay({ recipeId = "pancake", score, won, rank }) {
  const stats = loadStats(recipeId);
  const isRecord = score > stats.bestScore;
  stats.plays += 1;
  if (won) {
    stats.wins += 1;
    const order = ["S", "A", "B", "C"];
    if (!stats.bestRank || order.indexOf(rank) < order.indexOf(stats.bestRank)) stats.bestRank = rank;
  }
  stats.bestScore = Math.max(stats.bestScore, score);
  cache[recipeId] = stats;
  try {
    localStorage.setItem(keyOf(STATS_KEY, recipeId), JSON.stringify(stats));
  } catch {
    // 保存できなくても遊びは続けられる。
  }
  return { isRecord };
}

// 「つづきから」:敵を たおして、つぎの敵の手順に すすむところで 保存する(端末内だけ)
export function saveCheckpoint(recipeId, data) {
  try {
    localStorage.setItem(keyOf(CP_KEY, recipeId), JSON.stringify(data));
  } catch {
    // 保存できなくても、遊びは つづけられる。
  }
}

export function loadCheckpoint(recipeId = "pancake") {
  try {
    const data = JSON.parse(localStorage.getItem(keyOf(CP_KEY, recipeId)) ?? "null");
    return data && Number.isInteger(data.enemyIndex) && data.enemyIndex > 0 && data.state ? data : null;
  } catch {
    return null;
  }
}

export function clearCheckpoint(recipeId = "pancake") {
  try {
    localStorage.removeItem(keyOf(CP_KEY, recipeId));
  } catch {
    // 消せなくても、遊びには かかわらない。
  }
}
