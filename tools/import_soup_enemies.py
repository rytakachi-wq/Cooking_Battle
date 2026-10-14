# コンソメスープの 敵の 絵を、受け取った 画像から 切り出して assets/chars/ に 書く(2ばい解像度。ゲームでは 0.5ばい)。
# 実行:python tools/import_soup_enemies.py
# ※ 玉ねぎは まだ 絵が ないので、名前だけの 仮の 絵を 作る(絵が 届いたら onion_normal.png などを おきかえる)。
#   人参の 通常も まだ ないので、強化形態の 絵を 小さくして 仮に つかう。
import glob
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "assets", "_source", "received")
OUT = os.path.join(ROOT, "assets", "chars")


def src(n):
    return glob.glob(os.path.join(R, f"{n:02d}_*"))[0]


def load(n):
    im = Image.open(src(n)).convert("RGBA")
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())


def save(im, name, height):
    k = height / im.height
    im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).save(os.path.join(OUT, name))


# 通常:高さ(キャンバスの 2ばい) / 強化:基準の 高さ。強化の こうげき は 通常の 強化と おなじ 倍率
N = {"cabbage": 240, "carrot": 250, "consomme": 260, "saltpepper": 270, "onion": 240}
S = 330  # 強化形態の 通常ポーズの 高さ(×2)

# キャベツ
save(load(25), "cabbage_normal.png", N["cabbage"] * 2)
sn = load(24)
k = S * 2 / sn.height
save(sn, "cabbage_strong_normal.png", S * 2)
a = load(23)
a.resize((round(a.width * k), round(a.height * k)), Image.LANCZOS).save(os.path.join(OUT, "cabbage_strong_attack.png"))

# 人参(通常は まだ ない:強化形態を 小さくして 仮に)
sn = load(27)
k = S * 2 / sn.height
save(sn, "carrot_strong_normal.png", S * 2)
a = load(26)
a.resize((round(a.width * k), round(a.height * k)), Image.LANCZOS).save(os.path.join(OUT, "carrot_strong_attack.png"))
save(sn, "carrot_normal.png", N["carrot"] * 2)  # 仮

# コンソメ
save(load(22), "consomme_normal.png", N["consomme"] * 2)
sn = load(21)
k = S * 2 / sn.height
save(sn, "consomme_strong_normal.png", S * 2)
a = load(20)
a.resize((round(a.width * k), round(a.height * k)), Image.LANCZOS).save(os.path.join(OUT, "consomme_strong_attack.png"))

# 塩・こしょう(ふたり組)
save(load(18), "saltpepper_normal.png", N["saltpepper"] * 2)
sn = load(17)
k = S * 2 / sn.height
save(sn, "saltpepper_strong_normal.png", S * 2)
save(load(19), "saltpepper_attack.png", N["saltpepper"] * 2 * 0.95)


# 玉ねぎ(仮の 絵:名前だけ)
def placeholder(name, label, h, fill, outline):
    w = int(h * 0.9)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((6, h * 0.12, w - 6, h - 6), fill=fill, outline=outline, width=10)
    d.polygon([(w * 0.5 - 14, h * 0.16), (w * 0.5, 4), (w * 0.5 + 14, h * 0.16)], fill=outline)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", int(h * 0.16))
    except OSError:
        font = ImageFont.load_default()
    d.text((w / 2, h * 0.55), label, fill=(60, 36, 16, 255), font=font, anchor="mm")
    im.save(os.path.join(OUT, name))


placeholder("onion_normal.png", "玉ねぎ", N["onion"] * 2, (232, 190, 110, 255), (120, 70, 30, 255))
placeholder("onion_strong_normal.png", "玉ねぎ", S * 2, (214, 120, 70, 255), (90, 30, 20, 255))

# 絵の 一覧(ゲームが 読みこむ 前に 見る)
names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(OUT, "*.png")))
import json

json.dump(names, open(os.path.join(OUT, "manifest.json"), "w"), ensure_ascii=False)
print(len(names), "files")
