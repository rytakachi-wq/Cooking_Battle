# シート(1枚に いくつもの 絵)を、つながった かたまりごとに 切り出す。
# 使い方:python tools/segment_sheet.py <シート> <出力フォルダ> [dilate=21] [min_area=2500]
import json
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def segment(path, dilate=21, min_area=2500, scale=4):
    im = Image.open(path).convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    small = a.resize((im.width // scale, im.height // scale), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0)
    small = small.filter(ImageFilter.MaxFilter(max(3, dilate // scale * 2 + 1)))
    m = np.array(small) > 0
    h, w = m.shape
    lab = np.zeros((h, w), dtype=np.int32)
    n = 0
    boxes = []
    for y in range(h):
        for x in range(w):
            if m[y, x] and lab[y, x] == 0:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                xs, ys = [x], [y]
                while q:
                    cy, cx = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n
                            q.append((ny, nx))
                            xs.append(nx)
                            ys.append(ny)
                boxes.append((n, min(xs), min(ys), max(xs), max(ys), len(xs)))
    out = []
    A = np.array(im.getchannel("A")) > 24
    for n, x0, y0, x1, y1, area in boxes:
        if area * scale * scale < min_area:
            continue
        # かたまりの 画素だけ(となりの 絵を 巻きこまない)
        full = np.kron(lab[y0:y1 + 1, x0:x1 + 1] == n, np.ones((scale, scale), dtype=bool))
        fx0, fy0 = x0 * scale, y0 * scale
        sub = im.crop((fx0, fy0, fx0 + full.shape[1], fy0 + full.shape[0]))
        arr = np.array(sub)
        arr[..., 3] = np.where(full[: arr.shape[0], : arr.shape[1]], arr[..., 3], 0)
        sub = Image.fromarray(arr, "RGBA")
        bb = sub.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        if not bb:
            continue
        sub = sub.crop(bb)
        out.append({"box": (fx0 + bb[0], fy0 + bb[1], fx0 + bb[2], fy0 + bb[3]), "img": sub})
    out.sort(key=lambda o: (round(o["box"][1] / 150), o["box"][0]))
    return im, out


if __name__ == "__main__":
    path, outdir = sys.argv[1], sys.argv[2]
    dil = int(sys.argv[3]) if len(sys.argv) > 3 else 21
    mn = int(sys.argv[4]) if len(sys.argv) > 4 else 2500
    import os
    os.makedirs(outdir, exist_ok=True)
    im, cells = segment(path, dil, mn)
    prev = Image.new("RGBA", im.size, (255, 244, 220, 255))
    prev.paste(im, (0, 0), im)
    d = ImageDraw.Draw(prev)
    info = []
    for i, c in enumerate(cells):
        c["img"].save(os.path.join(outdir, f"cell_{i:02d}.png"))
        x0, y0, x1, y1 = c["box"]
        d.rectangle(c["box"], outline=(255, 0, 0, 255), width=3)
        d.rectangle((x0, y0, x0 + 70, y0 + 40), fill=(255, 0, 0, 255))
        d.text((x0 + 6, y0 + 4), str(i), fill=(255, 255, 255, 255), font_size=30)
        info.append({"i": i, "box": c["box"], "size": c["img"].size})
    prev.convert("RGB").save(os.path.join(outdir, "overview.jpg"), quality=85)
    json.dump(info, open(os.path.join(outdir, "cells.json"), "w"))
    print(len(cells), "cells")
