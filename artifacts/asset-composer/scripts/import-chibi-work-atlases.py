"""Register original generated RGBA sprites, measuring alpha only; never repaint pixels."""
from pathlib import Path
import json, shutil
from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects

root = Path(__file__).resolve().parents[1]
source = Path('C:/Users/Ham_h/.codex/generated_images/01a11f2a-c830-7052-b1d4-f53db301cc99')
target = root / 'public/asset-packs/chibi-tokens-v1'
atlases = json.loads((target / 'atlases.json').read_text('utf-8'))
files = {
    'work_tools': ('exec-3d7b13af-f3b7-4481-8865-86ad7cbe5734.png', 6, 4),
    'work_stations': ('exec-2bc43ad7-c097-423c-8115-31bd2f639fa5.png', 6, 4),
    'work_clothes': ('exec-b793527f-fe9a-4538-998a-e2f3790250b8.png', 4, 4),
    'work_extra': ('exec-a41246b1-28c0-41a8-aee6-d67bf9c53363.png', 4, 2),
}
for name, (file, cols, rows) in files.items():
    image = Image.open(source / file)
    alpha = image.getchannel('A')
    # Generated objects can extend past an ideal grid line. Assign complete
    # connected silhouettes to cells, rather than cropping at the grid line.
    labels, _ = label(np.array(alpha) > 24)
    sizes = np.bincount(labels.ravel())
    objects = [(s[1].start, s[0].start, s[1].stop, s[0].stop)
               for i, s in enumerate(find_objects(labels), 1) if sizes[i] > 1000]
    rects = []
    for row in range(rows):
        for col in range(cols):
            box = (round(col * image.width / cols), round(row * image.height / rows), round((col + 1) * image.width / cols), round((row + 1) * image.height / rows))
            candidates = [b for b in objects
                          if int((b[0]+b[2])/2 * cols/image.width) == col
                          and int((b[1]+b[3])/2 * rows/image.height) == row]
            assert candidates, (name, row, col)
            bounds = (min(b[0] for b in candidates), min(b[1] for b in candidates),
                      max(b[2] for b in candidates), max(b[3] for b in candidates))
            assert bounds, (name, row, col)
            x0, y0, x1, y1 = bounds
            if name == 'work_stations':
                rects.append([x0, y0, x1 - x0, y1 - y0])
            else:
                x0, y0, x1, y1 = alpha.crop(box).point(lambda a: 255 if a > 24 else 0).getbbox()
                rects.append([box[0]+x0, box[1]+y0, x1-x0, y1-y0])
    assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] >= 250
    shutil.copyfile(source / file, target / f'{name}.png')
    atlases[name] = dict(file=f'{name}.png', width=image.width, height=image.height, rects=rects)
(target / 'atlases.json').write_text(json.dumps(atlases, ensure_ascii=False, indent=2) + '\n', 'utf-8')
