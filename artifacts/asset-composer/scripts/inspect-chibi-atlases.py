"""Read alpha bounds into atlas metadata; source PNG pixels are never changed."""
from pathlib import Path
import json
import shutil
from PIL import Image
import numpy as np
from scipy import ndimage

source = Path('C:/Users/Ham_h/.codex/generated_images/01a11f2a-c830-7052-b1d4-f53db301cc99')
target = Path(__file__).resolve().parents[1] / 'public/asset-packs/chibi-tokens-v1'
target.mkdir(parents=True, exist_ok=True)
files = {
    'base': '2ec6f9f0-ddce-4a41-8ad4-c2850684808e',
    'anatomy': 'ce81f1cf-4b2f-4cbc-b203-9205d24cea08',
    'face': '9bea25f2-8ad4-4f38-a35d-b9fbb4b064ea',
    'hair': 'abdd34fe-30f6-4a7e-8fcc-e12bc7b3930e',
    'clothes': '37f3beab-6d6e-403c-92f4-a31eb1cbc87a',
    'helmets': '2f7d41a4-8b49-4624-9d36-1f9ad0224422',
    'weapons': '3cb0637f-b5f4-45e1-8c8a-c629cbb84eb1',
    'props': '126829a3-3e25-4d3b-af13-b857d414c213',
    'extras': 'c4ab94da-c1ab-462f-a9b7-9e72f8adb1be',
    'face_plus': 'dd905bf4-b915-4e07-8925-edc7fbee7897',
    'hair_plus': '41ac6ea4-af9a-4746-aaa6-4437257916c3',
    'heads': '6d3e058c-434a-4425-89c2-117941b0b997',
    'face_extra': 'ae333299-bc49-4736-ac06-27c1ce24982c',
    'brows_extra': '17b6bea6-ce27-472d-929f-f3ed90c93e60',
    'hair_extra': '57807cad-aae7-49de-803f-8dde7ef8ef89',
    'beards_extra': '8f517ee6-412a-460b-bb12-e4cd7a22b737',
    'noses_extra': 'd791d59b-3ffe-4a90-a87d-cc6763782c08',
}
atlases = {}
for name, suffix in files.items():
    path = source / f'exec-{suffix}.png'
    shutil.copyfile(path, target / f'{name}.png')
    image = Image.open(path)
    w, h = image.size
    alpha = image.getchannel('A')
    rows = 8 if name == 'face_extra' else 6 if name == 'face_plus' else 4 if name in {'face', 'heads'} else 1 if name == 'base' else 2
    cols = 1 if name == 'base' else 4
    rects = []
    for row in range(rows):
        for col in range(cols):
            x0, y0, x1, y1 = round(col*w/cols), round(row*h/rows), round((col+1)*w/cols), round((row+1)*h/rows)
            # Generated props use unequal row heights; keep the full hoe and bush.
            if name == 'props':
                y0, y1 = (0, 478) if row == 0 else (478, h)
                if row == 1 and col == 2: x0 = 840
            if name == 'extras':
                y0, y1 = (0, 600) if row == 0 else (600, h)
            # Face rows are spaced by artwork, rather than equal-height cells.
            # Keep both eyes/brows together and exclude neighboring rows.
            if name == 'face_plus':
                boundaries = [0, 310, 510, 680, 870, 1040, h]
                y0, y1 = boundaries[row], boundaries[row + 1]
            # Threshold only the measurement, never the original artwork.
            if name in {'hair', 'hair_plus', 'hair_extra', 'heads', 'clothes', 'helmets', 'weapons', 'anatomy', 'props'}:
                x0, y0, x1, y1 = max(0,x0-12), max(0,y0-12), min(w,x1+12), min(h,y1+12)
                labels, count = ndimage.label(np.array(alpha.crop((x0,y0,x1,y1))) > 24)
                sizes = np.bincount(labels.ravel()); sizes[0] = 0
                component = sizes.argmax()
                ys, xs = np.where(labels == component)
                box = (int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1))
            else:
                box = alpha.crop((x0,y0,x1,y1)).point(lambda v: 255 if v > 24 else 0).getbbox()
            if not box: raise ValueError(f'Empty module {name}:{row}:{col}')
            l,t,r,b = box
            rects.append([max(x0, x0+l-2), max(y0,y0+t-2), min(x1,x0+r+2)-max(x0,x0+l-2), min(y1,y0+b+2)-max(y0,y0+t-2)])
    atlases[name] = {'file': f'{name}.png', 'width': w, 'height': h, 'rects': rects}
(target / 'atlases.json').write_text(json.dumps(atlases, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: {'size':[v['width'],v['height']], 'modules':len(v['rects'])} for k,v in atlases.items()}))
