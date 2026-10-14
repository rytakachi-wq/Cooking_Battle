# 画像の依頼書(最小+敵の 4ポーズ+小道具)の ページを つくる。出力:image_brief_v3.html
import html
import os

e = html.escape
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "image_brief_v3.html")
POSES = ["normal", "attack", "damage", "down"]
PN = {"normal": "立ち姿", "attack": "こうげき(前へ 乗りだす)", "damage": "ダメージ(のけぞる)", "down": "倒れた(目を ぐるぐる)"}
ENEMIES = [
    ("egg", "卵", "パンケーキ"), ("milk", "牛乳", "パンケーキ"), ("mix", "ホットケーキミックス", "パンケーキ"),
    ("butter", "バター", "パンケーキ"), ("syrup", "メープルシロップ(ボス)", "パンケーキ"),
    ("onion", "玉ねぎ", "スープ"), ("carrot", "人参", "スープ"), ("cabbage", "キャベツ", "スープ"),
    ("consomme", "コンソメ", "スープ"), ("saltpepper", "塩・こしょう(ふたり組・ボス)", "スープ"),
]
DISH_P = [("dish_bowl_empty", "空のボウル"), ("dish_bowl_egg", "卵が 入った ボウル"), ("dish_bowl_milk", "卵と牛乳の ボウル"), ("dish_bowl_batter", "混ぜた 生地の ボウル"), ("dish_pan_raw", "生地を 流した フライパン(コンロつき)"), ("dish_pan_golden", "こんがり 焼けた フライパン"), ("dish_plate_pancake", "お皿の ホットケーキ(バターのせ)"), ("dish_plate_syrup", "シロップが かかった 完成形")]
DISH_S = [("soup_board_empty", "まな板だけ"), ("soup_board_onion", "切った 玉ねぎ"), ("soup_board_carrot", "＋ 切った 人参"), ("soup_board_cabbage", "＋ ざく切りの キャベツ"), ("soup_pot_water", "水と 野菜の 鍋(コンロつき)"), ("soup_pot_consomme", "コンソメを とかした 湯気の 鍋"), ("soup_bowl_soup", "完成した スープ(器・湯気)")]
FAIL = [("fail_shells", "卵:殻が ちらばる"), ("fail_milk", "牛乳:こぼれて ひろがる"), ("fail_lumps", "ミックス:ダマと 粉"), ("fail_burnt", "バター:まっ黒に こげる"), ("fail_syrup", "シロップ:とびちって ベタベタ"), ("fail_onion", "玉ねぎ:ぐちゃぐちゃ・涙"), ("fail_carrot", "人参:皮・土が のこる"), ("fail_cabbage", "キャベツ:ころがる・虫食い(こわくない)"), ("fail_consomme", "コンソメ:こすぎて まっ黒"), ("fail_saltpepper", "塩・こしょう:塩の 山")]
PROP_P = [("prop_egg_pack", "卵のパック(卵3つ)"), ("prop_carton", "牛乳パック"), ("prop_cup", "計量カップ"), ("prop_mixbag", "ホットケーキミックスの袋"), ("prop_whisk", "泡立て器"), ("prop_butter", "バターの かたまり"), ("prop_spatula", "フライ返し"), ("prop_stove_pan", "コンロの上の フライパン"), ("prop_syrup", "メープルシロップの びん"), ("prop_sink", "洗面台(じゃ口)"), ("prop_soap", "せっけんの ポンプ"), ("prop_towel", "タオル"), ("prop_fridge", "冷蔵庫(ドアが 少し 開いた)"), ("prop_plate", "お皿")]
PROP_S = [("sprop_onion", "玉ねぎ(皮つき)"), ("sprop_carrot", "人参(葉つき)"), ("sprop_cabbage", "キャベツ(丸ごと)"), ("sprop_board", "まな板"), ("sprop_knife", "包丁(刃は 丸み・横向き)"), ("sprop_peeler", "ピーラー"), ("sprop_colander", "ざる"), ("sprop_pot", "ふたつきの 鍋"), ("sprop_ladle", "おたま"), ("sprop_mitts", "鍋つかみ"), ("sprop_consomme_box", "コンソメの 箱"), ("sprop_dish", "小皿"), ("sprop_salt", "塩びん(顔なし)"), ("sprop_pepper", "こしょうびん(顔なし)")]
HERO = [("hero_normal", "通常"), ("hero_attack", "こうげき"), ("hero_damage", "ダメージ"), ("hero_win", "勝ち"), ("hero_lose", "負け")]
UI = [("title_logo", "タイトルロゴ(文字 あり・横長)"), ("ui_stamp_fail", "「しっぱい」スタンプ(文字 あり)"), ("ui_hand_open", "ひらいた手"), ("ui_hand_pinch", "つまむ手"), ("ui_lid", "鍋のふた")]


def tbl(rows, head=("ファイル名", "内容")):
    return (
        '<div class="tw"><table><thead><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr></thead><tbody>"
        + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table></div>"
    )


def c(n):
    return f"<code>{e(n)}.png</code>"


n_en = len(ENEMIES) * 8
tot = len(HERO) + n_en + len(DISH_P) + len(DISH_S) + len(FAIL) + 1 + len(UI) + len(PROP_P) + len(PROP_S)
sec = []
sec.append(("主人公", len(HERO), "縦 768px 以上・全身・右を むく", tbl([(c(a), b) for a, b in HERO])))
en_rows = []
for k, name, dish in ENEMIES:
    en_rows.append((f"<b>{e(name)}</b><small>{dish}</small>", " ".join(c(f"{k}_{p}") for p in POSES), " ".join(c(f"{k}_strong_{p}") for p in POSES)))
sec.append((
    "敵", n_en, "10体 × 4ポーズ × (通常・強化形態)。縦 768px 以上",
    "<p>4ポーズ:" + " ／ ".join(f"<code>{p}</code>＝{PN[p]}" for p in POSES)
    + "。強化形態は <b>同じ食材と わかる うえで 大きく・筋肉・武器・かざり・怒った 顔</b>(こわすぎない・血なし)。<b>同じ敵の 8枚は、立ち姿の 高さと 足もとを そろえる</b>(ポーズが かわっても 大きさが かわらないように)。</p>"
    + tbl(en_rows, ("敵", "通常 4枚", "強化形態 4枚")),
))
sec.append(("料理の進み", len(DISH_P) + len(DISH_S), "各 512px 以上・透明・おなじ 大きさの 枠に そろえる", "<h3>パンケーキ</h3>" + tbl([(c(a), b) for a, b in DISH_P]) + "<h3>コンソメスープ</h3>" + tbl([(c(a), b) for a, b in DISH_S])))
sec.append(("しっぱいの 絵", len(FAIL), "各 512px 以上・透明・大きく 目立つ", tbl([(c(a), b) for a, b in FAIL])))
sec.append(("小道具", len(PROP_P) + len(PROP_S), "各 450px 以上・透明・顔や 手の ない ふつうの 物", "<h3>パンケーキ</h3>" + tbl([(c(a), b) for a, b in PROP_P]) + "<h3>コンソメスープ</h3>" + tbl([(c(a), b) for a, b in PROP_S])))
sec.append(("背景", 1, "1920×1080(16:9)", "<p>全部の 場面で 使い回す、からっぽの 台所。<b>キャラ・道具・枠・ゲージは 描かない</b>。左 約30% は 空ける(主人公の 場所)。上 約15% は ごちゃごちゃさせない。調理台の 天板の 線は 上から 約70% の 高さ。</p>" + tbl([(c("bg_kitchen"), "明るい 台所(かべ・カウンター・ゆか だけ)")])))
sec.append(("UI", len(UI), "透明", tbl([(c(a), b) for a, b in UI])))
nav = "".join(f'<a href="#s{i}"><span>{e(t)}</span><i>{n}枚</i></a>' for i, (t, n, _, _) in enumerate(sec))
body = "".join(f'<section class="sec" id="s{i}"><h2>{e(t)}<span class="n">{n}枚 ・ {e(sub)}</span></h2>{h}</section>' for i, (t, n, sub, h) in enumerate(sec))

CSS = """
/* 配置:左に 目次(固定)、右に 本文。せまい 画面では 目次が 上に */
:root { --bg:#fdfaf4; --panel:#fff; --ink:#3b2a1e; --soft:#7a6755; --line:#e6dccb; --accent:#e0561f; --accent-ink:#fff; --mark:#fff0c9;
  --fd:"Zen Maru Gothic","Hiragino Maru Gothic ProN","Yu Gothic UI",sans-serif; --fb:"BIZ UDPGothic","Hiragino Kaku Gothic ProN","Yu Gothic UI",sans-serif; --fc:ui-monospace,Consolas,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#1f1812; --panel:#2a2118; --ink:#f3e8d8; --soft:#b9a68f; --line:#44372a; --accent:#ff8a52; --accent-ink:#2a1408; --mark:#4a3a1c; color-scheme:dark; } }
:root[data-theme="dark"] { --bg:#1f1812; --panel:#2a2118; --ink:#f3e8d8; --soft:#b9a68f; --line:#44372a; --accent:#ff8a52; --accent-ink:#2a1408; --mark:#4a3a1c; color-scheme:dark; }
* { box-sizing:border-box; }
body { background:var(--bg); color:var(--ink); font:15px/1.8 var(--fb); padding-inline:16px; padding-block:24px 64px; }
.wrap { max-width:1100px; margin:0 auto; display:grid; grid-template-columns:220px minmax(0,1fr); gap:36px; align-items:start; }
@media (max-width:820px) { .wrap { grid-template-columns:minmax(0,1fr); gap:18px; } }
h1,h2,h3 { font-family:var(--fd); text-wrap:balance; line-height:1.35; margin:0; }
h1 { font-size:clamp(24px,5vw,34px); font-weight:900; }
h2 { font-size:20px; font-weight:900; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
h2 .n { margin-left:auto; font:500 13px var(--fd); color:var(--soft); }
h3 { font-size:15px; margin:12px 0 4px; color:var(--accent); }
p { margin:6px 0; max-width:62em; }
code { font:12.5px var(--fc); background:var(--mark); padding:1px 5px; border-radius:4px; white-space:nowrap; display:inline-block; margin:1px 0; }
.side { position:sticky; top:env(safe-area-inset-top,0px); display:grid; gap:10px; }
@media (max-width:820px) { .side { position:static; } }
.side nav { display:grid; gap:2px; }
.side nav a { display:flex; justify-content:space-between; gap:8px; padding:5px 10px; border-radius:8px; color:var(--ink); text-decoration:none; border:1px solid transparent; font-size:14px; }
.side nav a:hover,.side nav a:focus-visible { border-color:var(--accent); outline:none; }
.side nav i { font:500 12px var(--fc); color:var(--soft); font-style:normal; }
.total b { font:900 30px var(--fd); }
main { min-width:0; display:grid; gap:28px; }
.sec { display:grid; gap:8px; scroll-margin-top:16px; }
.box { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 16px; }
.box ul { margin:4px 0; padding-left:1.3em; }
.tw { overflow-x:auto; border:1px solid var(--line); border-radius:10px; background:var(--panel); }
table { width:100%; border-collapse:collapse; font-size:14px; }
th,td { text-align:left; vertical-align:top; padding:7px 12px; border-bottom:1px solid var(--line); }
th { font:700 12px var(--fd); color:var(--soft); background:var(--mark); white-space:nowrap; }
tr:last-child td { border-bottom:0; }
td small { display:block; color:var(--soft); font-size:12px; }
"""

RULES = """<section class="box"><h2>ぜんぶに 共通の 条件</h2><ul>
<li>ホットケーキと コンソメスープの 料理ゲーム用。<b>1枚ずつ 別ファイル</b>(1枚の シートに まとめない)、<b>PNG・本当の 透明背景</b>(市松もようを 絵に しない。背景だけ 例外)。</li>
<li>絵柄は <b>全部 おなじ</b>:太めの やわらかい 輪郭線、かわいい デフォルメ、明るく にぎやか。<b>こわい 表現・血は なし</b>(子どもも 遊びます)。</li>
<li>絵の中に <b>文字を 入れない</b>(ロゴ・スタンプ だけ 例外)。既存の ゲーム・キャラに 似せない。</li>
<li><b>主人公</b>:茶色の くせ毛(前髪に 金の メッシュ)、緑がかった 丸い目、白い コック帽(金の 模様)、白い コックコート、オレンジの スカーフ、白い エプロン、黒い ズボン、スニーカー。</li>
<li>まず <b>主人公1枚・敵1体の 立ち姿(通常と 強化)・小道具 2〜3枚・背景</b> で 絵柄を 見せて もらい、確認してから のこりを お願いします。</li>
</ul></section>"""

page = (
    "<title>画像の依頼書 新規制作</title>\n"
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&family=BIZ+UDPGothic:wght@400;700&display=swap">\n'
    f"<style>{CSS}</style>\n"
    f'<div class="wrap"><aside class="side"><h1>画像の依頼書</h1><p class="total">合計 <b>{tot}</b> 枚</p><nav>{nav}</nav></aside>'
    f"<main>{RULES}{body}</main></div>"
)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)
print(tot, OUT)
