"""Register original generated atlases; isolate disconnected artwork without repainting."""
from pathlib import Path
import json, shutil
import numpy as np
from PIL import Image
from scipy.ndimage import label, find_objects

source = Path('C:/Users/Ham_h/.codex/generated_images/01a11f2a-c830-7052-b1d4-f53db301cc99')
target = Path(__file__).resolve().parents[1] / 'public/asset-packs/composer-trees-v1'
game = Path('E:/Planetki/Assets/composer/trees')
target.mkdir(parents=True, exist_ok=True)
game.mkdir(parents=True, exist_ok=True)
files = {'oak':'exec-e4bb121c-1bf6-4215-b344-dceec56eca01.png','pine':'exec-fcb8e9d0-9b82-4f95-9fe0-c8b965276ef1.png','birch':'exec-4aa8f426-59c3-447d-b0f2-546b87eda797.png'}
manifest = {}
for species, filename in files.items():
    image = Image.open(source/filename).convert('RGBA')
    alpha = np.asarray(image)[:,:,3] > 12
    # Atlas columns touch at a few leaf tips. Separate the authored cells first.
    alpha[:,image.width//2] = False
    labels, _ = label(alpha)
    objects = []
    for index, bounds in enumerate(find_objects(labels),1):
        if bounds is None: continue
        count = np.count_nonzero(labels[bounds] == index)
        if count < 180: continue
        y,x = bounds
        objects.append({'rect':[x.start,y.start,x.stop-x.start,y.stop-y.start], 'area':count})
    trees = sorted([o for o in objects if o['rect'][1] < image.height*.3],key=lambda o:o['area'],reverse=True)[:2]
    trees.sort(key=lambda o:o['rect'][0])
    bottom = [o for o in objects if o not in trees]
    stump = max([o for o in bottom if o['rect'][0] < image.width*.5],key=lambda o:o['area'])
    logs = max([o for o in bottom if o['rect'][0] >= image.width*.5],key=lambda o:o['area'])
    chips = sorted([o for o in bottom if o not in [stump,logs]],key=lambda o:o['area'],reverse=True)[:4]
    frames = {'standing':trees[0]['rect'],'cut':trees[1]['rect'],'stump':stump['rect'],'logs':logs['rect'], **{f'chip{i}':o['rect'] for i,o in enumerate(chips)}}
    shutil.copy2(source/filename,target/f'{species}.png')
    shutil.copy2(source/filename,game/f'{species}.png')
    manifest[species] = {'file':f'{species}.png','width':image.width,'height':image.height,'frames':frames}
    print(species,frames)
(target/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
shutil.copy2(target/'manifest.json',game/'manifest.json')
