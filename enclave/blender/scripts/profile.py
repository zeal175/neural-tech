"""Mid-sagittal profile of BUST_low (front and back silhouettes per height) for placing the jaw plane."""
import os
import sys

sys.path.append(os.path.dirname(__file__))
import bpy  # noqa: E402

import common as C  # noqa: E402

me = bpy.data.objects["BUST_low"].data
rows = []
for i in range(0, 30):
    z = 1.36 + i * 0.005
    pts = [v.co for v in me.vertices if abs(v.co.x) < 0.004 and abs(v.co.z - z) < 0.0025]
    if not pts:
        continue
    front = min(p.y for p in pts)
    back = max(p.y for p in pts)
    rows.append([round(z, 3), round(front, 4), round(back, 4)])
# width of the neck at a few heights (x extent)
widths = []
for z in (1.40, 1.42, 1.44, 1.46, 1.48):
    pts = [v.co for v in me.vertices if abs(v.co.z - z) < 0.002 and v.co.y > -0.06]
    widths.append([z, round(max(p.x for p in pts), 4)])
C.report(profile=rows, widths=widths)
