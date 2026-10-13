// 自分で作った曲(音声ファイル)を つかうための 一覧。
// 曲の ファイルを assets/bgm/ に 入れて、下の file に ファイル名を 書くと、その曲が 鳴る(空のあいだは、コードで作った 曲が 鳴る)。
//   file … ファイル名(mp3 / ogg / wav)。assets/bgm/ の中。
//   bpm  … その曲の テンポ。戦いの曲は、この テンポに 矢印の拍が そろう(書かなければ、下の 数)。
//   lead … 1拍めが 始まるまでの 無音の 秒数(ふつうは 0。曲の 頭に 無音が あるときだけ)。
// くわしくは bgm_guide.html(曲づくりの 手引き)を 見る。
export const BGM_FILES = {
  cover: { file: "", bpm: 108, lead: 0 }, // 表紙・あそびかた
  quiz: { file: "", bpm: 100, lead: 0 }, // 手順ならべ
  fight_egg: { file: "", bpm: 110, lead: 0 }, // 戦い:卵
  fight_milk: { file: "", bpm: 113, lead: 0 }, // 戦い:牛乳
  fight_mix: { file: "", bpm: 116, lead: 0 }, // 戦い:ホットケーキミックス
  fight_butter: { file: "", bpm: 119, lead: 0 }, // 戦い:バター
  boss_syrup: { file: "", bpm: 122, lead: 0 }, // 戦い:メープルシロップ(ボス)
  result_win: { file: "", bpm: 120, lead: 0 }, // 結果:かち
  result_lose: { file: "", bpm: 90, lead: 0 }, // 結果:まけ
};
