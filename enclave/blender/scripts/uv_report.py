"""Draw the BUST_low UV layout and measure real overlap by rasterising UV triangles."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402

RES = 1024      # coverage grid
SIZE = 2048     # drawing

ob = bpy.data.objects[(C.script_args() or ["BUST_low"])[0]]
me = ob.data
me.calc_loop_triangles()
tris = np.zeros(len(me.loop_triangles) * 3, dtype=np.int32)
me.loop_triangles.foreach_get("loops", tris)
tris = tris.reshape(-1, 3)
uvs = np.zeros(len(me.loops) * 2, dtype=np.float32)
me.uv_layers.active.data.foreach_get("uv", uvs)
uvs = uvs.reshape(-1, 2)

cov = np.zeros((RES, RES), dtype=np.uint8)
flipped = 0
for a, b, c in uvs[tris] * RES:
    area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if area == 0:
        continue
    if area < 0:
        flipped += 1
        b, c = c, b
    x0, x1 = int(max(min(a[0], b[0], c[0]), 0)), int(min(max(a[0], b[0], c[0]) + 1, RES))
    y0, y1 = int(max(min(a[1], b[1], c[1]), 0)), int(min(max(a[1], b[1], c[1]) + 1, RES))
    if x1 <= x0 or y1 <= y0:
        continue
    xs, ys = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)

    def edge(p, q):
        return (q[0] - p[0]) * (ys - p[1]) - (q[1] - p[1]) * (xs - p[0])

    inside = (edge(a, b) > 0) & (edge(b, c) > 0) & (edge(c, a) > 0)
    cov[y0:y1, x0:x1] += inside.astype(np.uint8)

used = float((cov > 0).mean())
overlap_px = int((cov > 1).sum())

img = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
up = np.kron(cov, np.ones((SIZE // RES, SIZE // RES), dtype=np.uint8))[::-1]
img[up == 1] = (0.16, 0.16, 0.18)
img[up > 1] = (1.0, 0.1, 0.05)
for i, j in ((0, 1), (1, 2), (2, 0)):
    p, q = uvs[tris[:, i]], uvs[tris[:, j]]
    for t in np.linspace(0, 1, 6, dtype=np.float32):
        pts = p * (1 - t) + q * t
        x = np.clip((pts[:, 0] * (SIZE - 1)).astype(int), 0, SIZE - 1)
        y = np.clip(((1 - pts[:, 1]) * (SIZE - 1)).astype(int), 0, SIZE - 1)
        img[y, x] = np.maximum(img[y, x], 0.62)
C.write_png(os.path.join(C.PREVIEWS, f"uv_layout_{ob.name}.png"), img, bits=8)
C.report(object=ob.name, triangles=len(tris), coverage=round(used, 3), overlap_texels=overlap_px,
         flipped_triangles=flipped)
