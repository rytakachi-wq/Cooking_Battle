import os

import numpy as np
from PIL import Image

P = r"C:\Users\rytak\AppData\Local\Temp\claude\C--Users-rytak-Documents-Cooking-Battle\56abb5f2-350b-4899-afd6-4e939129480c\images\2.webp"
ROOT = r"C:\Users\rytak\Documents\Cooking_Battle\assets"
SCRATCH = os.path.dirname(os.path.abspath(__file__))

src = Image.open(P).convert("RGB")

# (保存先フォルダ, ファイル名, x0, x1, y0, y1)
BOXES = []


def row(folder, y0, y1, items):
    for name, x0, x1 in items:
        BOXES.append((folder, name, x0, x1, y0, y1))


row("chars", 528, 676, [
    ("egg_strong_normal", 8, 200), ("egg_strong_attack", 200, 395), ("egg_strong_damage", 395, 558), ("egg_strong_down", 558, 726),
    ("milk_strong_normal", 764, 926), ("milk_strong_attack", 926, 1106), ("milk_strong_damage", 1106, 1320), ("milk_strong_down", 1320, 1512),
])
row("chars", 700, 822, [
    ("mix_strong_normal", 15, 132), ("mix_strong_attack", 132, 262), ("mix_strong_damage", 262, 408), ("mix_strong_down", 408, 556),
    ("butter_strong_normal", 575, 684), ("butter_strong_attack", 684, 792), ("butter_strong_damage", 792, 915),
    ("syrup_strong_normal", 996, 1140), ("syrup_strong_attack", 1140, 1265), ("syrup_strong_damage", 1265, 1392), ("syrup_strong_down", 1392, 1520),
])
row("dish", 888, 980, [
    ("dish_bowl_empty", 16, 97), ("dish_bowl_egg", 102, 180), ("dish_bowl_milk", 183, 263), ("dish_bowl_batter", 265, 346),
    ("dish_pan_raw", 348, 427), ("dish_pan_golden", 429, 512), ("dish_plate_pancake", 513, 588), ("dish_plate_syrup", 590, 661),
])
row("fail", 882, 980, [
    ("fail_shells", 671, 757), ("fail_milk", 762, 850), ("fail_lumps", 854, 934), ("fail_burnt", 938, 1022), ("fail_syrup", 1024, 1118),
])
row("ui", 882, 980, [
    ("ui_hand", 1126, 1202), ("ui_lid", 1204, 1284), ("title_logo", 1286, 1432), ("ui_stamp_fail", 1438, 1522),
])


def is_bg(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    return (mn >= 222) & (mx - mn <= 16)


def flood(mask):
    reach = np.zeros_like(mask)
    reach[0, :] = mask[0, :]
    reach[-1, :] = mask[-1, :]
    reach[:, 0] = mask[:, 0]
    reach[:, -1] = mask[:, -1]
    while True:
        n = reach.copy()
        n[1:, :] |= reach[:-1, :]
        n[:-1, :] |= reach[1:, :]
        n[:, 1:] |= reach[:, :-1]
        n[:, :-1] |= reach[:, 1:]
        n &= mask
        if (n == reach).all():
            return reach
        reach = n


def keep_big(fg):
    h, w = fg.shape
    seen = np.zeros_like(fg, dtype=bool)
    comps = []
    for y in range(h):
        for x in range(w):
            if fg[y, x] and not seen[y, x]:
                stack = [(y, x)]
                seen[y, x] = True
                pts = []
                while stack:
                    cy, cx = stack.pop()
                    pts.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True
                                stack.append((ny, nx))
                comps.append(pts)
    if not comps:
        return fg
    biggest = max(len(c) for c in comps)
    out = np.zeros_like(fg)
    for c in comps:
        if len(c) >= max(30, biggest * 0.04):
            for y, x in c:
                out[y, x] = True
    return out


for folder, name, x0, x1, y0, y1 in BOXES:
    crop = np.array(src.crop((x0, y0, x1, y1)))
    bg = flood(is_bg(crop))
    fg = keep_big(~bg)
    ys, xs = np.where(fg)
    if len(ys) == 0:
        print("empty", name)
        continue
    # きれいな ふち:すこし ぼかして、半透明のふちにする
    alpha = Image.fromarray((fg * 255).astype(np.uint8), "L")
    from PIL import ImageFilter

    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    rgba = Image.fromarray(crop, "RGB").convert("RGBA")
    rgba.putalpha(alpha)
    rgba = rgba.crop((max(0, xs.min() - 1), max(0, ys.min() - 1), xs.max() + 2, ys.max() + 2))
    os.makedirs(os.path.join(ROOT, folder), exist_ok=True)
    rgba.save(os.path.join(ROOT, folder, name + ".png"))
    print(folder, name, rgba.size)

# バターの「倒れた」は、絵が とどいていないので、「ダメージ」の絵を たおして、仮に つくる
d = Image.open(os.path.join(ROOT, "chars", "butter_strong_damage.png"))
down = d.rotate(-82, expand=True, resample=Image.BICUBIC)
bbox = down.getbbox()
down = down.crop(bbox)
down.save(os.path.join(ROOT, "chars", "butter_strong_down.png"))
print("butter_strong_down (仮)", down.size)

# 確認用の一覧(中に 入れる絵だけを ならべる)
names = [(f, n) for f, n, *_ in BOXES] + [("chars", "butter_strong_down")]
sheet = Image.new("RGB", (1500, 900), (70, 100, 130))
x = y = rowh = 0
for f, n in names:
    pth = os.path.join(ROOT, f, n + ".png")
    s = Image.open(pth)
    if x + s.width > 1500:
        x, y, rowh = 0, y + rowh + 6, 0
    sheet.paste(s, (x, y), s)
    x += s.width + 6
    rowh = max(rowh, s.height)
sheet.save(os.path.join(SCRATCH, "check2.png"))
