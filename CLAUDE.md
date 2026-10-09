# Cooking_Battle 作業ルール

開発前に必ず [scheme.md](scheme.md) を読むこと。

- 「決まったこと」だけを実装する。「未定」は勝手に決めず、利用者に確認し、決まったら scheme.md に書き足す。
- 追加キー(テンキー0＝攻撃、Enter＝ジャンプ)は、あとから足す。`src/game.js` の `EXTRA_KEYS` と `src/main.js` の入力処理に入口がある。
- キャラ画像は `assets/chars/` に置く(他のAIが作った絵を切り出したもの)。AIは描き直さない・別キャラを作らない。
- 曲は仮のBGMをコードで作る(`src/audio.js`)。個人情報は集めない。保存は成績のみ、端末内。
- 判定は AudioContext の時計(`songTime`)が基準。
- 動作確認: リポジトリ直下で `python -m http.server 8123` → http://localhost:8123/src/index.html 。`?debug` をつけると `window.__game` から中をのぞける。
