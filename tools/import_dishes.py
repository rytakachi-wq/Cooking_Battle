# 受け取った 料理・しっぱいの 絵を、ゲーム用の 大きさ(2ばい解像度)で assets/dish, assets/fail に 書く。
# 実行:python tools/import_dishes.py   (元の 絵は assets/_source/received)
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "assets", "_source", "received")
A = os.path.join(ROOT, "assets")


def src(n):
    return glob.glob(os.path.join(R, f"{n:02d}_*"))[0]


def trim(im, pad=2):
    bb = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def fit(im, bw, bh):
    k = min(bw / im.width, bh / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


# (出力, 元の番号, はこの はば, はこの 高さ) …ゲームでは 0.875ばいで 描く(=はこの 約 半分)
JOBS = [
    ("dish/dish_bowl_egg.png", 38, 360, 270), ("dish/dish_bowl_milk.png", 39, 320, 290),
    ("dish/dish_bowl_batter.png", 40, 320, 290), ("dish/dish_pan_raw.png", 41, 380, 280),
    ("dish/dish_pan_golden.png", 37, 380, 280), ("dish/dish_plate_syrup.png", 36, 330, 270),
    ("fail/fail_lumps.png", 29, 320, 300), ("fail/fail_burnt.png", 32, 300, 300),
    ("fail/fail_syrup.png", 33, 300, 300), ("fail/fail_shells.png", 35, 320, 300),
]
for rel, n, bw, bh in JOBS:
    im = trim(Image.open(src(n)).convert("RGBA"))
    fit(im, bw, bh).save(os.path.join(A, rel.replace("/", os.sep)))
print("ok")
