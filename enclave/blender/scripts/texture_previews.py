"""8-bit previews of the baked masters: full map downsampled + a full-resolution crop."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402

args = C.script_args()
crop = [float(a) for a in args[:2]] if len(args) >= 2 else [0.40, 0.52]   # crop centre (u, v)
names = ["normal_4k", "orm_4k", "data_4k"]
out = {}
for name in names:
    path = os.path.join(C.BAKES, name + ".png")
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = "Non-Color"
    a = C.image_to_array(img)[..., :3]
    h, w, _ = a.shape
    small = a.reshape(1024, h // 1024, 1024, w // 1024, 3).mean(axis=(1, 3))
    C.write_png(os.path.join(C.PREVIEWS, f"tex_{name}.png"), small, bits=8)
    cx, cy = int(crop[0] * w), int((1 - crop[1]) * h)
    sub = a[max(cy - 512, 0):cy + 512, max(cx - 512, 0):cx + 512]
    C.write_png(os.path.join(C.PREVIEWS, f"tex_{name}_crop.png"), sub, bits=8)
    out[name] = list(a.shape)
    bpy.data.images.remove(img)
C.report(maps=out)
