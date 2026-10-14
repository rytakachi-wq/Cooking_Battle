# 画像の依頼書(2つの料理ぶん・一から)の ページを つくる。出力:image_brief.html
# 実行:python tools/make_brief_page.py

import html
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "image_brief.html")

# ---------- データ ----------
HERO_BASE = [
    ("hero_normal", "ふつうに立つ(いきいき)", "いつもの姿。前をむいて、やる気"),
    ("hero_attack", "こうげき(前に踏み出す)", "リズムが 当たったとき"),
    ("hero_damage", "ダメージ(のけぞる)", "ミス・手順を まちがえたとき"),
    ("hero_win", "勝ちポーズ", "敵を倒す・クリア"),
    ("hero_lose", "負け(へたりこむ)", "体力が 0 になったとき"),
]

HERO_PANCAKE = [
    ("hero_hair", "長めのかみを ひとつに むすぶ(両手を頭の後ろに)", "準備：身じたく"),
    ("hero_apron", "エプロンの ひもを むすぶ", "準備：身じたく"),
    ("hero_wash", "せっけんで 手を こすって あらう(あわあわ)", "準備：手を洗う"),
    ("hero_towel", "タオルで 手を ふく", "準備：手を ふく"),
    ("hero_crack_tap", "卵を 平らな台に コンコンと 当てる", "卵①"),
    ("hero_crack_open", "両手の親指で 卵を そっと 開く", "卵②"),
    ("hero_crack_drop", "卵を ボウルの上で 落とす", "卵③"),
    ("hero_measure", "計量カップに 牛乳を はかる(目の高さで 目もりを見る)", "牛乳①"),
    ("hero_pour", "ボウルに 牛乳を 注ぐ", "牛乳②"),
    ("hero_fridge", "牛乳を 冷蔵庫に しまう(ふたをして もどす)", "牛乳③"),
    ("hero_mix_egg", "ボウルで 卵と牛乳を 泡立て器で 混ぜる", "ミックス①"),
    ("hero_mix_powder", "ホットケーキミックスを ボウルに ふり入れる", "ミックス②"),
    ("hero_mix_fold", "さっくり 切るように 混ぜる(ゴムベラ)", "ミックス③"),
    ("hero_pan_heat", "フライパンを コンロにのせて あたためる", "バター①"),
    ("hero_pan_pour", "バターを とかして 生地を 流す", "バター②"),
    ("hero_flip", "フライ返しで ホットケーキを 裏返す", "バター③"),
    ("hero_fire_off", "コンロの つまみを まわして 火を止める", "仕上げ①"),
    ("hero_plate", "ホットケーキを お皿に のせる", "仕上げ②"),
    ("hero_butter", "バターを ホットケーキの上に のせる", "仕上げ③"),
    ("hero_syrup", "シロップを たっぷり かける", "仕上げ④"),
    ("hero_think", "うでを くんで 考える", "手順ならべ(どちらの料理でも)"),
    ("hero_listen", "手を 耳に あてて 聞く", "リズム：ききましょう(どちらでも)"),
    ("hero_cheer", "ガッツポーズ(小さめ)", "手順が 正解のとき(どちらでも)"),
    ("hero_oops", "しまった！ と 頭をかかえる", "手順が まちがいのとき(どちらでも)"),
]

HERO_SOUP = [
    ("hero_peel", "玉ねぎの 皮を むく", "玉ねぎ①"),
    ("hero_cut_onion", "ねこの手で 玉ねぎを 切る", "玉ねぎ①"),
    ("hero_knife_put", "包丁を 刃を むこうに むけて 置く", "玉ねぎ②(包丁の あつかい)"),
    ("hero_cut_cabbage", "ねこの手で キャベツを 切る", "キャベツ①"),
    ("hero_leaf", "キャベツの 葉を はがす", "キャベツ②"),
    ("hero_core", "キャベツの 芯を 切り取る", "キャベツ②"),
    ("hero_scrub", "野菜を 流水で ごしごし 洗う", "人参①・キャベツ②"),
    ("hero_peeler", "ピーラーで 人参の 皮を むく", "人参①"),
    ("hero_cut_carrot", "ねこの手で 人参を 切る", "人参①"),
    ("hero_pot", "鍋に 水と 野菜を 入れる", "コンソメ①"),
    ("hero_boil", "おたまで あくを とる", "コンソメ①"),
    ("hero_consomme", "火を止めて コンソメを 入れて とかす", "コンソメ②"),
    ("hero_mitt", "鍋つかみで 鍋の ふたを むこうへ 開ける", "コンソメ③(火と やけど)"),
    ("hero_salt", "塩を ひとつまみ 入れる", "塩・こしょう"),
    ("hero_pepper", "こしょうを ふる", "塩・こしょう"),
    ("hero_taste", "小皿で 味見", "塩・こしょう"),
]

# (id, 名前, 料理, 通常の見た目, 強化形態, 武器・かざり)
ENEMIES = [
    ("egg", "卵", "パンケーキ", "からだが 卵の かたち。ぷっくり かわいい顔", "からに ヒビと 金属のかざり。両腕が ムキムキ", "大きな泡立て器(ほこ)"),
    ("milk", "牛乳", "パンケーキ", "青い 牛もようの パック", "パックが はがね色の補強で 鎧のように。角ばった体", "巨大な ストロー槍"),
    ("mix", "ホットケーキミックス", "パンケーキ", "赤い ふたの 粉の袋", "袋が ふくれて 筋肉質。粉の けむりを まとう", "巨大な 計量スプーンの ハンマー"),
    ("butter", "バター", "パンケーキ", "黄色い 四角い かたまり", "四角い体が 大きくなり、炎の オーラ", "熱い フライパンの盾と ヘラの剣"),
    ("syrup", "メープルシロップ(ボス)", "パンケーキ", "王様の マントと 王冠をつけた びん", "さらに 豪華な 金のよろい・大きな マント", "大きな 木のスプーンの杖か シロップの剣"),
    ("onion", "玉ねぎ", "コンソメスープ", "茶色い 皮の 玉ねぎ。涙が にじむ ひとみ。頭の先に 細い芽", "皮が よろいのように 重なり、涙は 雨のオーラ。両腕 ムキムキ", "大きな 包丁形の 剣(こわすぎない、刃は 丸み)"),
    ("carrot", "人参", "コンソメスープ", "オレンジ色の 人参。頭に 緑の葉っぱ。太いまゆで にっこり", "体が 太く 長く、葉が 逆立つ たてがみに。筋肉質", "大きな ピーラーの 槍"),
    ("cabbage", "キャベツ", "コンソメスープ", "緑の 丸い キャベツ。葉が マントのように かさなる", "葉が 何層にも かさなる 盾と よろいに。丸い体が ひとまわり大きく", "葉の 盾と 大きな 木べら"),
    ("consomme", "コンソメ", "コンソメスープ", "金色の 四角い 固形コンソメ。ほこらしげな顔。頭に 小さな 湯気", "金のよろい。湯気が 大きな オーラに。体が 大きく", "巨大な おたまの ハンマー"),
    ("saltpepper", "塩・こしょう(ボス)", "コンソメスープ", "塩びん(白)と こしょうびん(黒)の ふたり組。なかよし コンビ。1枚の 絵に ふたりとも 入れる", "ふたりとも 大きく。きらきらの 粒の オーラ。王冠・マントは シロップと 似すぎない ように", "ふたり並んで 構える(塩びんは 盾、こしょうびんは ふりかけ攻撃)"),
]

POSES = [("normal", "通常", "立ち姿。敵らしく、体を ゆらす 前の かまえ"), ("attack", "こうげき", "前へ 乗りだして 矢印を 見せる(音が 鳴る瞬間)"), ("damage", "ダメージ", "おどろいて のけぞる・白目ぎみ"), ("down", "倒れた", "目を ぐるぐる・ひっくり返る。ゆかに 倒れた 姿")]

DISH_PANCAKE = [
    ("dish_bowl_empty", "空のボウル"),
    ("dish_bowl_egg", "卵が 割り入れられた ボウル"),
    ("dish_bowl_milk", "卵と 牛乳が 入った ボウル"),
    ("dish_bowl_batter", "混ぜた生地(ホットケーキミックス入り)の ボウル"),
    ("dish_pan_raw", "フライパンに 生地を 流したところ(まだ 白っぽい)"),
    ("dish_pan_golden", "こんがり きつね色に 焼けた"),
    ("dish_plate_pancake", "お皿に のった ホットケーキ(3まい重ね、バターのせ)"),
    ("dish_plate_syrup", "シロップが とろ〜り かかった 完成形"),
]
DISH_SOUP = [
    ("soup_board_empty", "まな板だけ(皮つきの 玉ねぎ・人参・キャベツ が 横に ならぶ)"),
    ("soup_board_onion", "まな板の上に 切った 玉ねぎ"),
    ("soup_board_carrot", "まな板の上に 切った 玉ねぎ ＋ 人参"),
    ("soup_board_cabbage", "まな板の上に 玉ねぎ・人参 ＋ ざく切りの キャベツ"),
    ("soup_pot_water", "水と 野菜の 入った 鍋(コンロの上)"),
    ("soup_pot_consomme", "コンソメを とかした 湯気の 立つ 鍋"),
    ("soup_bowl_soup", "完成した コンソメスープ(器・塩こしょう あり・湯気)"),
]

FAIL = [
    ("fail_shells", "パンケーキ", "卵の からの かけらが ちらばる(ボウルの中と 台の上)"),
    ("fail_milk", "パンケーキ", "牛乳が こぼれて 台に ひろがる"),
    ("fail_lumps", "パンケーキ", "ダマだらけの 生地と、粉が ふわっと 舞う"),
    ("fail_burnt", "パンケーキ", "まっ黒に こげた ホットケーキと、フライパンの 炎・黒いけむり"),
    ("fail_syrup", "パンケーキ", "シロップが とびちって ベタベタ"),
    ("fail_onion", "スープ", "玉ねぎが ぐちゃぐちゃに 切れて 涙が とびちる"),
    ("fail_carrot", "スープ", "皮が のこって 土つきの 人参"),
    ("fail_cabbage", "スープ", "ころがった キャベツと、葉に 虫食いの あと(こわくない 表現)"),
    ("fail_consomme", "スープ", "味が こすぎて まっ黒に なった スープ"),
    ("fail_saltpepper", "スープ", "塩が 山もりで しょっぱすぎる スープ(塩の 山)"),
]

BG = [
    ("bg_kitchen", "パンケーキ", "戦い・ふだんの台所", "明るい台所。かべ、カウンター、すこしの かざり。ほかの背景の「ベース」"),
    ("bg_prep", "パンケーキ", "準備", "洗面台(じゃ口・水)、せっけん(ポンプ)、タオル、エプロン、ヘアゴム"),
    ("bg_egg", "パンケーキ", "卵", "卵のパック(卵が3つ)、ボウル、平らな台"),
    ("bg_milk", "パンケーキ", "牛乳", "牛乳パック、計量カップ、冷蔵庫の一部"),
    ("bg_mix", "パンケーキ", "ミックス", "ホットケーキミックスの袋(顔や手の ない ふつうの 袋)、ボウル、泡立て器、ゴムベラ"),
    ("bg_butter", "パンケーキ", "バター", "コンロ、フライパン、バター、フライ返し、ミトン"),
    ("bg_syrup", "パンケーキ", "仕上げ", "コンロ(火は消えている)、お皿、ホットケーキ、メープルシロップのびん、バター"),
    ("bg_soup_onion", "スープ", "玉ねぎ", "まな板、玉ねぎ(皮つき)、包丁(むこうむき)、小さな ざる"),
    ("bg_soup_carrot", "スープ", "人参", "まな板、人参、ピーラー、流しの 一部"),
    ("bg_soup_cabbage", "スープ", "キャベツ", "まな板、丸ごとの キャベツ、ざる、ボウル"),
    ("bg_soup_pot", "スープ", "コンソメ", "コンロ、鍋(ふた つき)、おたま、鍋つかみ、コンソメの 箱"),
    ("bg_soup_season", "スープ", "塩・こしょう", "コンロの 鍋、小皿、塩と こしょうの 置き場(びんは 描かない=敵が 重なる)"),
]

OTHERS = [
    ("title_logo", "タイトルの ロゴ", "「チョ～集中！チョット調理ジャン！」。文字を 入れてよい(この1枚だけ)。サブタイトル「～チャッ！🔥カリッ！🍳パリッ！～」。横長・透明"),
    ("ui_hand_open", "手(ふつう)", "チュートリアルで 使う「てのひら」のカーソル"),
    ("ui_hand_pinch", "手(つまむ)", "カードを つまむ形"),
    ("ui_lid", "鍋のふた", "「ききましょう」のとき、カードの上に かぶせる 鍋のふた"),
    ("ui_stamp_fail", "しっぱいの スタンプ", "「しっぱい！」。文字を 入れてよい(この1枚だけ)"),
    ("menu_pancake", "料理えらびの カード(パンケーキ)", "完成した ホットケーキの 小さな カード用イラスト。正方形 512px"),
    ("menu_soup", "料理えらびの カード(コンソメスープ)", "完成した コンソメスープの 小さな カード用イラスト。正方形 512px"),
    ("badge_handwash", "称号「手洗い名人」(任意)", "パンケーキを クリアすると もらえる 予定の バッジ。文字を 入れてよい。内容は あとで 確認"),
]

SAMPLE = [
    ("hero_normal", "主人公(絵柄の 基準)"),
    ("egg_normal / egg_strong_normal", "卵の 通常と 強化形態"),
    ("onion_normal / onion_strong_normal", "スープの 敵の 絵柄"),
    ("saltpepper_normal", "ふたり組の 描きわけ"),
    ("bg_soup_onion", "背景の 構図(16:9・キャラなし)"),
    ("dish_bowl_egg / soup_board_onion", "料理の 絵"),
]

# 受け取りずみの 敵の 絵(2026-10-14:20枚の シート/単体から 数えた。ポーズは 見た目で 判断)
HAVE = set()
for _p in ("normal", "attack", "damage", "down"):
    HAVE.add(f"syrup_{_p}"); HAVE.add(f"syrup_strong_{_p}")
    for _e in ("butter", "milk", "mix"):
        HAVE.add(f"{_e}_{_p}")
for _n in ("egg_strong_normal", "butter_strong_normal", "milk_strong_normal", "mix_strong_normal",
           "cabbage_normal", "cabbage_strong_normal", "cabbage_strong_attack",
           "carrot_strong_normal", "carrot_strong_attack",
           "consomme_normal", "consomme_strong_normal", "consomme_strong_attack",
           "saltpepper_normal", "saltpepper_strong_normal", "saltpepper_attack"):
    HAVE.add(_n)

e = html.escape


def code(name, ext=".png"):
    return f"<code>{e(name)}{ext}</code>"


def rows(items, cols):
    return "".join("<tr>" + "".join(f"<td>{c}</td>" for c in cols(i)) + "</tr>" for i in items)


def table(head, body, cls=""):
    return f'<div class="tw"><table class="{cls}"><thead><tr>' + "".join(f"<th>{e(h)}</th>" for h in head) + f"</tr></thead><tbody>{body}</tbody></table></div>"


# ---------- 数 ----------
n_hero_base = len(HERO_BASE)
n_hero_act = len(HERO_PANCAKE) + len(HERO_SOUP)
n_enemy = len(ENEMIES) * len(POSES) * 2
n_have = len(HAVE)
n_dish = len(DISH_PANCAKE) + len(DISH_SOUP)
n_fail = len(FAIL)
n_bg = len(BG)
n_oth = len(OTHERS) - 1  # 任意の バッジは のぞく
total = n_hero_base + n_hero_act + n_enemy + n_dish + n_fail + n_bg + n_oth
left = total - n_have

sections = [
    ("a", "A", "主人公の 基本ポーズ", n_hero_base, "最優先"),
    ("b", "B", "主人公の 調理の動き", n_hero_act, "高"),
    ("c", "C", "食材モンスター(通常・強化形態)", f"{n_enemy - n_have}(残り)", "最優先"),
    ("d", "D", "料理の 進み(調理台の 上)", n_dish, "中"),
    ("e", "E", "料理の しっぱい", n_fail, "中"),
    ("f", "F", "場面の 背景", n_bg, "高"),
    ("g", "G", "その他(ロゴ・手・ふた・カード)", n_oth, "低"),
]

nav = "".join(f'<a href="#{s[0]}"><b>{s[1]}</b><span>{e(s[2])}</span><i>{s[3]}枚</i></a>' for s in sections)

# C セクション
enemy_rows = rows(
    ENEMIES,
    lambda x: [f"<b>{e(x[1])}</b><small>{e(x[2])}</small>", code(x[0], "_*"), e(x[3]), e(x[4]), e(x[5])],
)
pose_rows = rows(POSES, lambda p: [code(p[0], ""), e(p[1]), e(p[2])])
def _f(name):
    return f'<s class="have">✓ {code(name)}</s>' if name in HAVE else code(name)

files_c = "".join(
    f"<li>{_f(en[0] + '_' + p[0])} <span>{_f(en[0] + '_strong_' + p[0])}</span></li>" for en in ENEMIES for p in POSES
)

page = f"""<title>画像の依頼書 2つの料理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700;900&family=BIZ+UDPGothic:wght@400;700&display=swap">
<style>
/* 配置:左に 目次(固定)、右に 本文。幅がせまいときは 目次が 上に 横ならび。表は 区分ごと、品名の 列を 先頭に */
:root {{
  --bg: #fdfaf4;
  --panel: #ffffff;
  --ink: #3b2a1e;
  --ink-soft: #7a6755;
  --line: #e6dccb;
  --accent: #e0561f;
  --accent-ink: #ffffff;
  --mark: #fff0c9;
  --ok: #2f7d4a;
  --font-display: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic UI", sans-serif;
  --font-body: "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif;
  --font-code: ui-monospace, "SF Mono", Consolas, "Courier New", monospace;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --bg: #1f1812; --panel: #2a2118; --ink: #f3e8d8; --ink-soft: #b9a68f; --line: #44372a;
    --accent: #ff8a52; --accent-ink: #2a1408; --mark: #4a3a1c; --ok: #6fcf8c; color-scheme: dark;
  }}
}}
:root[data-theme="dark"] {{
  --bg: #1f1812; --panel: #2a2118; --ink: #f3e8d8; --ink-soft: #b9a68f; --line: #44372a;
  --accent: #ff8a52; --accent-ink: #2a1408; --mark: #4a3a1c; --ok: #6fcf8c; color-scheme: dark;
}}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.8 var(--font-body); padding-inline: 16px; padding-block: 24px 64px; }}
.wrap {{ max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 40px; align-items: start; }}
@media (max-width: 860px) {{ .wrap {{ grid-template-columns: minmax(0, 1fr); gap: 20px; }} }}
h1, h2, h3 {{ font-family: var(--font-display); text-wrap: balance; line-height: 1.35; margin: 0; }}
h1 {{ font-size: clamp(26px, 5vw, 38px); font-weight: 900; }}
h2 {{ font-size: 22px; font-weight: 900; padding-top: 8px; display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }}
h2 .tag {{ font: 700 14px var(--font-display); background: var(--accent); color: var(--accent-ink); border-radius: 6px; padding: 1px 10px; }}
h2 .n {{ margin-left: auto; font: 500 14px var(--font-display); color: var(--ink-soft); }}
h3 {{ font-size: 16px; font-weight: 700; margin-top: 22px; }}
p {{ margin: 8px 0; max-width: 62em; }}
code {{ font: 13px var(--font-code); background: var(--mark); padding: 1px 6px; border-radius: 4px; white-space: nowrap; }}
.side {{ position: sticky; top: env(safe-area-inset-top, 0px); display: grid; gap: 10px; align-self: start; padding-block: 4px; }}
@media (max-width: 860px) {{ .side {{ position: static; }} }}
.side nav {{ display: grid; gap: 4px; }}
.side nav a {{ display: grid; grid-template-columns: 1.6em 1fr auto; gap: 8px; align-items: baseline; padding: 6px 10px; border-radius: 8px; color: var(--ink); text-decoration: none; border: 1px solid transparent; }}
.side nav a:hover, .side nav a:focus-visible {{ border-color: var(--accent); outline: none; }}
.side nav b {{ font: 900 14px var(--font-display); color: var(--accent); }}
.side nav span {{ font-size: 13px; line-height: 1.4; }}
.side nav i {{ font-style: normal; font: 500 12px var(--font-code); color: var(--ink-soft); }}
.total {{ font: 700 13px var(--font-display); color: var(--ink-soft); padding: 4px 10px; }}
.total b {{ font-size: 26px; color: var(--ink); }}
main {{ min-width: 0; display: grid; gap: 34px; }}
.lead {{ font-size: 16px; }}
.sec {{ display: grid; gap: 10px; scroll-margin-top: 16px; }}
.box {{ background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; }}
.box ul {{ margin: 6px 0; padding-left: 1.3em; }}
.box li {{ margin: 3px 0; }}
.warn {{ border-color: var(--accent); }}
.tw {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
th, td {{ text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid var(--line); }}
th {{ font: 700 12px var(--font-display); letter-spacing: 0.04em; color: var(--ink-soft); background: var(--mark); white-space: nowrap; }}
tr:last-child td {{ border-bottom: 0; }}
td small {{ display: block; color: var(--ink-soft); font-size: 12px; }}
.cols {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }}
.files {{ list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 4px 14px; font-size: 13px; }}
.files li span {{ margin-left: 4px; }}
.spec {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }}
.spec div {{ background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }}
.spec b {{ display: block; font: 900 20px var(--font-display); color: var(--accent); }}
.spec span {{ font-size: 12px; color: var(--ink-soft); }}
.copy {{ font: 700 13px var(--font-display); padding: 6px 14px; border-radius: 999px; border: 2px solid var(--ink); background: var(--panel); color: var(--ink); cursor: pointer; justify-self: start; }}
.copy:hover, .copy:focus-visible {{ background: var(--accent); color: var(--accent-ink); border-color: var(--accent); outline: none; }}
s.have {{ color: var(--ink-soft); text-decoration: none; opacity: 0.7; }}
.pri {{ font: 700 12px var(--font-display); color: var(--ink-soft); }}
ol.first {{ margin: 6px 0; padding-left: 1.4em; }}
@media (prefers-reduced-motion: no-preference) {{ .side nav a {{ transition: border-color .15s; }} }}
</style>

<div class="wrap">
  <aside class="side" aria-label="目次">
    <h1>画像の依頼書</h1>
    <p class="pri">パンケーキ ＋ コンソメスープ(全部 一から)</p>
    <nav>
      <a href="#rules"><b>0</b><span>ぜんぶに 共通の 条件</span><i></i></a>
      <a href="#first"><b>1</b><span>最初に 見せてほしい 6組</span><i></i></a>
      {nav}
    </nav>
    <p class="total">残り <b>{left}</b> 枚<br>(全 {total} 枚のうち {n_have} 枚は 受け取りずみ)<br>＋ 任意 1枚</p>
  </aside>

  <main>
    <section class="sec" id="rules">
      <h2><span class="tag">0</span>ぜんぶに 共通の 条件</h2>
      <p class="lead">ブラウザで あそぶ 料理のリズムゲーム「チョ～集中！チョット調理ジャン！～チャッ！🔥カリッ！🍳パリッ！～」の 画像を、<b>2つの料理(ホットケーキ・コンソメスープ)ぶん、すべて 新しく</b> お願いします。以前の シートは 解像度が たりず、使えない 部分が あったため、<b>1枚ずつ 別ファイル・高解像度</b> で 作りなおしてください。</p>
      <div class="spec">
        <div><b>PNG</b><span>形式。1ファイル＝1枚</span></div>
        <div><b>透明</b><span>キャラ・小物は 本当の 透明背景(市松もようを 絵に しない)</span></div>
        <div><b>768px〜</b><span>キャラ・小物は 縦 768px 以上</span></div>
        <div><b>512px〜</b><span>料理・しっぱいの 絵は 512px 以上</span></div>
        <div><b>1920×1080</b><span>背景は 16:9。キャラなし</span></div>
      </div>
      <div class="box">
        <h3 style="margin-top:0">絵柄</h3>
        <ul>
          <li>添付の 既存の 絵(主人公・卵・牛乳・ミックス・バター・シロップ)と <b>同じ絵柄・同じ顔・同じ配色</b>。太めの やわらかい輪郭線、かわいい デフォルメ、明るく にぎやか。</li>
          <li><b>こわい 表現・血は 使わない</b>(子どもも 遊びます)。包丁や 武器は 丸みを つけ、こわすぎないように。</li>
          <li>絵の中に <b>文字(セリフ・説明)を 入れない</b>(ロゴ・スタンプ・称号の バッジだけ 例外)。既存の ゲーム・キャラに 似せない。</li>
        </ul>
        <h3>主人公の 特徴(かならず 守る)</h3>
        <p>茶色の くせ毛(前髪に 金の メッシュ)、緑がかった 丸い目、白い コック帽(金の模様つき)、白い コックコート、オレンジの スカーフ、白い エプロン、黒い ズボン、スニーカー。</p>
      </div>
      <div class="box warn">
        <h3 style="margin-top:0">前回の シートで 困った 点(ここを 直してください)</h3>
        <ul>
          <li><b>解像度が 低い</b>:主人公が 約60〜99px、背景が 約270×100px。ゲームでは 主人公が 約250px、背景が 960×540(2倍の 1920×1080 が 理想)。</li>
          <li><b>背景が 横長すぎ</b>(約3:1)。必ず <b>16:9</b> で。</li>
          <li><b>背景に キャラを 描かない</b>(ミックスの 袋に 顔が あり、敵の 絵と 重なった)。袋・びんなどの 小物は <b>顔や手の ない ふつうの 物</b> に。</li>
          <li><b>1枚の シートに まとめず</b>、1枚ずつ 別ファイル、下の ファイル名で。</li>
        </ul>
      </div>
      <div class="box">
        <h3 style="margin-top:0">背景の 構図(1920×1080)</h3>
        <ul>
          <li>画面の <b>左 約30%</b> は 主人公が 立つので、大きな 物を 置かない(床と かべだけ)。</li>
          <li><b>上 約15%</b> は 体力ゲージが 重なるので ごちゃごちゃさせない。</li>
          <li><b>中央の 上のほう</b> に、カードを 置く あいた場所(横 約50%・縦 約25%)を 残す。</li>
          <li>調理台(カウンターの 天板)の 線は <b>上から 約70% の 高さ</b> に そろえる。道具や 材料は その上に。</li>
        </ul>
      </div>
      <div class="box">
        <h3 style="margin-top:0">受け渡し</h3>
        <ul>
          <li>できた 画像は 制作担当(私)に 渡してください。大きさを そろえて ゲームに 組みこみます。</li>
          <li>BGM・効果音は この依頼書に 入っていません。</li>
        </ul>
      </div>
    </section>

    <section class="sec" id="first">
      <h2><span class="tag">1</span>最初に 見せてほしい 6組</h2>
      <p>ぜんぶ 作る前に、まず この 6組だけ 作って 絵柄を 見せてください。確認してから、のこりを お願いします。</p>
      {table(["ファイル名", "ねらい"], rows(SAMPLE, lambda s: [code(s[0], ""), e(s[1])]))}
    </section>

    <section class="sec" id="a">
      <h2><span class="tag">A</span>主人公の 基本ポーズ<span class="n">{n_hero_base}枚 ・ 縦 768px 以上 ・ 透明</span></h2>
      <p>画面の 左に 立つので、<b>全身</b>が 入る 形で。主人公は 画面の 左を 向く ことは ありません(右の 敵に 向かって 立つ)。</p>
      {table(["ファイル名", "ポーズ", "使う 場面"], rows(HERO_BASE, lambda h: [code(h[0]), e(h[1]), e(h[2])]))}
    </section>

    <section class="sec" id="b">
      <h2><span class="tag">B</span>主人公の 調理の動き<span class="n">{n_hero_act}枚 ・ 縦 768px 以上 ・ 透明</span></h2>
      <p>手順カードを おいたとき、主人公が その動きを 実際に やって見せます。<b>1ポーズ＝1枚</b>、全身で。道具は 手に 持たせて 構いません。</p>
      <h3>パンケーキ({len(HERO_PANCAKE)}枚)</h3>
      {table(["ファイル名", "動き", "使う 場面"], rows(HERO_PANCAKE, lambda h: [code(h[0]), e(h[1]), e(h[2])]))}
      <h3>コンソメスープ({len(HERO_SOUP)}枚)</h3>
      {table(["ファイル名", "動き", "使う 場面"], rows(HERO_SOUP, lambda h: [code(h[0]), e(h[1]), e(h[2])]))}
    </section>

    <section class="sec" id="c">
      <h2><span class="tag">C</span>食材モンスター(通常・強化形態)<span class="n">全{n_enemy}枚 ・ 受け取り {n_have} ・ 残り {n_enemy - n_have}</span></h2>
      <div class="box warn"><b>2026-10-14 に 受け取った 20枚</b>で、✓ の ついた 絵は 作らなくて 大丈夫です。<b>✓ の 絵柄・顔・配色に そろえて</b>、のこりの ポーズを お願いします(卵・玉ねぎ・人参・キャベツ・コンソメ・塩こしょうは 特に 足りません)。シートから 切り出した 絵は 約150〜200px と 小さいので、<b>単体の 高解像度(縦 768px 以上)</b>が あると 助かります。</div>
      <p>10体 × 4ポーズ × (通常・強化形態)。通常は「食材と すぐ わかる かわいい 姿」、強化形態は 手順を まちがえたとき 出る「<b>同じ食材と すぐ わかる うえで パワーアップした 姿</b>」です。</p>
      <div class="box">
        <h3 style="margin-top:0">強化形態の 共通条件</h3>
        <ul>
          <li>ひとまわり <b>大きく</b> 見える。<b>筋肉</b>(太い腕・力こぶ)。料理道具を モチーフに した <b>武器</b> を 持つ。</li>
          <li><b>かざり</b>(肩の トゲつき プロテクター、ツノ、金属の ベルト・マント、傷あと)。</li>
          <li>表情は 通常より <b>怒って 強そう</b>。ただし こわすぎない。</li>
        </ul>
      </div>
      {table(["敵", "ファイル名", "通常の 見た目", "強化形態", "武器・かざり"], enemy_rows)}
      <h3>4つの ポーズ(どの敵も 通常・強化形態の 両方)</h3>
      {table(["ポーズ名", "名前", "内容"], pose_rows)}
      <h3>ファイル名(ぜんぶ)</h3>
      <p>左が 通常、右が 強化形態。</p>
      <ul class="files box">{files_c}</ul>
      <p>※ 塩・こしょうは <b>ふたり組で 1枚の 絵</b>(ファイル名は <code>saltpepper_*</code> のみ)。ポーズごとに ふたりが 同じ 動きを する。</p>
    </section>

    <section class="sec" id="d">
      <h2><span class="tag">D</span>料理の 進み(調理台の 上)<span class="n">{n_dish}枚 ・ 横 768px くらい ・ 透明</span></h2>
      <p>画面の 中央(主人公と 敵の あいだ)に 出る「いまの 料理」。敵を 倒すほど 次の 絵へ すすみます。ゲームでは 縮小して 使います。</p>
      <h3>パンケーキ({len(DISH_PANCAKE)}枚)</h3>
      {table(["ファイル名", "内容"], rows(DISH_PANCAKE, lambda d: [code(d[0]), e(d[1])]))}
      <h3>コンソメスープ({len(DISH_SOUP)}枚)</h3>
      {table(["ファイル名", "内容"], rows(DISH_SOUP, lambda d: [code(d[0]), e(d[1])]))}
    </section>

    <section class="sec" id="e">
      <h2><span class="tag">E</span>料理の しっぱい<span class="n">{n_fail}枚 ・ 512px 以上 ・ 透明</span></h2>
      <p>手順を まちがえたり、リズムの ミスが 多いときに 出る「しっぱいした 料理」。D の絵に 重ねて 使うので <b>大きく・目立つ</b> ように。</p>
      {table(["ファイル名", "料理", "内容"], rows(FAIL, lambda f: [code(f[0]), e(f[1]), e(f[2])]))}
    </section>

    <section class="sec" id="f">
      <h2><span class="tag">F</span>場面の 背景<span class="n">{n_bg}枚 ・ 1920×1080(16:9) ・ キャラなし</span></h2>
      <p>手順ならべの とき、上半分に 出す「いまの手順の 場面」。<b>主人公・敵は 描かない</b>(ゲームの中で 重ねます)。構図の きまりは「0 共通の条件」を 見てください。</p>
      {table(["ファイル名", "料理", "場面", "描くもの"], rows(BG, lambda b: [code(b[0]), e(b[1]), e(b[2]), e(b[3])]))}
    </section>

    <section class="sec" id="g">
      <h2><span class="tag">G</span>その他<span class="n">{n_oth}枚(＋任意1枚)</span></h2>
      {table(["ファイル名", "名前", "内容"], rows(OTHERS, lambda o: [code(o[0]), e(o[1]), e(o[2])]))}
    </section>

    <section class="sec" id="sum">
      <h2>まとめ<span class="n">残り {left} 枚(全 {total} 枚)</span></h2>
      {table(["区分", "内容", "枚数", "優先"], "".join(f"<tr><td><b>{s[1]}</b></td><td>{e(s[2])}</td><td>{s[3]}</td><td>{s[4]}</td></tr>" for s in sections) + f"<tr><td></td><td><b>残り(受け取りずみ {n_have} を のぞく)</b></td><td><b>{left}</b></td><td></td></tr>")}
      <button class="copy" id="copy-names" type="button">ファイル名を ぜんぶ コピー</button>
      <p id="copy-note" class="pri" aria-live="polite"></p>
    </section>
  </main>
</div>

<script>
(function () {{
  var names = {{}};
  document.querySelectorAll('main code').forEach(function (c) {{
    var t = c.textContent.trim();
    if (t.indexOf('*') === -1 && t.indexOf('/') === -1 && /\\.png$/.test(t)) names[t] = 1;
  }});
  var btn = document.getElementById('copy-names');
  var note = document.getElementById('copy-note');
  btn.addEventListener('click', function () {{
    var text = Object.keys(names).join('\\n');
    var done = function () {{ note.textContent = Object.keys(names).length + ' 個の ファイル名を コピーしました'; }};
    var fallback = function () {{
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try {{ document.execCommand('copy'); done(); }} catch (e) {{ note.textContent = 'コピーできませんでした。表から 選んで ください'; }}
      document.body.removeChild(ta);
    }};
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }});
}})();
</script>
"""

with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)
print("ok", total, OUT)
