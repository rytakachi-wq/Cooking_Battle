# 受け取った 敵の 絵(assets/_source/received)を、ゲーム用に 切り出して assets/chars/ に 書く。
# 実行:python tools/import_enemies.py
# ポーズごとに 手で えらんだ 範囲(シートの 座標)から 切り出す。大きさは、キャラの 大きさが そろうように 敵ごとに そろえる。
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "assets", "_source", "received")
OUT = os.path.join(ROOT, "assets", "chars")


def load(name):
    return Image.open(os.path.join(R, name)).convert("RGBA")


def alpha_bbox(im, th=24):
    return im.getchannel("A").point(lambda v: 255 if v > th else 0).getbbox()


def crop_box(im, box):
    """範囲の 中で、いちばん 大きな つながり(ふちの 切れはしは すてる)だけ のこす。"""
    sub = im.crop(box)
    a = np.array(sub.getchannel("A")) > 24
    h, w = a.shape
    s = 4
    ms = a[: h // s * s, : w // s * s].reshape(h // s, s, w // s, s).any(axis=(1, 3))
    # ふくらませて つなぐ
    from collections import deque
    hh, ww = ms.shape
    grown = np.zeros_like(ms)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(ms, dy, 0), dx, 1)
    lab = np.zeros((hh, ww), dtype=np.int32)
    best, best_n, n = 0, 0, 0
    for y in range(hh):
        for x in range(ww):
            if grown[y, x] and lab[y, x] == 0:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                cnt = 0
                while q:
                    cy, cx = q.popleft()
                    cnt += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < hh and 0 <= nx < ww and grown[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                if cnt > best:
                    best, best_n = cnt, n
    keep = np.kron(lab == best_n, np.ones((s, s), dtype=bool))
    full = np.zeros((h, w), dtype=bool)
    full[: keep.shape[0], : keep.shape[1]] = keep
    arr = np.array(sub)
    arr[..., 3] = np.where(full, arr[..., 3], 0)
    out = Image.fromarray(arr, "RGBA")
    bb = alpha_bbox(out)
    return out.crop(bb)


# --- どのシートの どの 範囲を つかうか(シートは 768×1280) ---
# (ファイル, 敵, ポーズ(ファイル名の 一部), 範囲)
SHEET = {
    # シロップ(通常):1枚めの 大きな 絵を 通常に
    ("09_syrup_normal_sheet.webp", "syrup", "normal"): (14, 458, 242, 682),  # ほかの ポーズと おなじ 大きさの 小さい 絵を つかう
    ("09_syrup_normal_sheet.webp", "syrup", "attack"): (242, 468, 506, 682),
    ("09_syrup_normal_sheet.webp", "syrup", "damage"): (522, 454, 756, 688),
    ("09_syrup_normal_sheet.webp", "syrup", "down"): (522, 760, 758, 938),
    # シロップ(強化)
    ("08_syrup_strong_sheet.webp", "syrup_strong", "normal"): (12, 10, 402, 430),
    ("08_syrup_strong_sheet.webp", "syrup_strong", "attack"): (396, 50, 762, 430),
    ("08_syrup_strong_sheet.webp", "syrup_strong", "normal_s"): (14, 456, 188, 630),  # 大きさの 基準(小さい 絵)
    ("08_syrup_strong_sheet.webp", "syrup_strong", "damage"): (10, 878, 218, 1082),
    ("08_syrup_strong_sheet.webp", "syrup_strong", "down"): (218, 920, 432, 1080),
    # バター(通常)
    ("11_butter_normal_sheet.webp", "butter", "normal"): (12, 20, 158, 166),
    ("11_butter_normal_sheet.webp", "butter", "attack"): (222, 870, 398, 1036),
    ("11_butter_normal_sheet.webp", "butter", "damage"): (394, 712, 588, 832),
    ("11_butter_normal_sheet.webp", "butter", "down"): (176, 738, 378, 832),
    # ミックス(通常)
    ("13_mix_normal_sheet.webp", "mix", "normal"): (10, 28, 168, 198),
    ("13_mix_normal_sheet.webp", "mix", "attack"): (4, 620, 166, 770),
    ("13_mix_normal_sheet.webp", "mix", "down"): (6, 1010, 160, 1190),
    # 牛乳(通常)
    ("15_milk_normal_sheet.webp", "milk", "normal"): (10, 18, 166, 192),
    ("15_milk_normal_sheet.webp", "milk", "attack"): (190, 542, 392, 706),
    ("15_milk_normal_sheet.webp", "milk", "damage"): (10, 938, 146, 1082),
    ("15_milk_normal_sheet.webp", "milk", "down"): (332, 988, 574, 1086),
}
# 1枚の 単体(強化形態など)
SINGLE = {
    ("10_butter_strong.webp", "butter_strong", "normal"): None,
    ("12_mix_strong.webp", "mix_strong", "normal"): None,
    ("14_milk_strong.webp", "milk_strong", "normal"): None,
    ("16_egg_strong.webp", "egg_strong", "normal"): None,
    ("43_egg_strong_damage.webp", "egg_strong", "damage"): None,
    ("47_egg_strong_down.webp", "egg_strong", "down"): None,
    ("42_mix_damage.webp", "mix", "damage"): None,
}

# 見た目の 大きさ(キャンバスで 何px ぐらいに するか)=通常ポーズの 高さ。ほかの ポーズは おなじ 倍率。
# 2ばいの 解像度で 書き出し、ゲームでは 0.5ばいで 描く。
TARGET_H = {"egg": 240, "milk": 249, "mix": 222, "butter": 260, "syrup": 299,
            "egg_strong": 330, "milk_strong": 330, "mix_strong": 300, "butter_strong": 300, "syrup_strong": 330}
DOWN_MIN = 0.0


def main():
    cells = {}
    for (f, who, pose), box in SHEET.items():
        cells[(who, pose)] = crop_box(load(f), box)
    for (f, who, pose), _ in SINGLE.items():
        im = load(f)
        cells[(who, pose)] = im.crop(alpha_bbox(im))
    # 敵ごとに 倍率を きめる(通常 ポーズの 高さ → 目標)
    done = {}
    for (who, pose), im in cells.items():
        if pose == "normal_s":
            continue
        base = cells.get((who, "normal"))
        if who == "syrup_strong" and pose in ("damage", "down"):
            # 小さい 絵(ダメージ・倒れた)は、小さい「通常」の 高さを 大きい「通常」の 高さに そろえる
            base = cells[(who, "normal_s")]
        if base is None:
            continue
        if (who, pose) == ("mix", "damage"):
            k = TARGET_H["mix"] * 2 * 1.2 / im.height  # 単体の 絵は 解像度が ちがうので、高さで そろえる
        else:
            k = TARGET_H[who] * 2 / base.height
        sc = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        name = f"{who.replace('_strong', '')}_{'strong_' if who.endswith('_strong') else ''}{pose}.png"
        sc.save(os.path.join(OUT, name))
        done[name] = sc.size
    for n, s in sorted(done.items()):
        print(n, s)


if __name__ == "__main__":
    main()
