"""Export standalone original atlas crops and assemble the distributable pack."""
from pathlib import Path
import json, zipfile
from PIL import Image

pack = Path(__file__).resolve().parents[1] / 'public/asset-packs/chibi-tokens-v1'
zip_path = pack / 'chibi-tokens-v1.zip'
with zipfile.ZipFile(zip_path) as previous:
    modules = json.loads(previous.read('modules.json'))
    for name in ['modules.json', 'rigs.json', 'animations.json']:
        (pack / name).write_bytes(previous.read(name))
atlases = json.loads((pack / 'atlases.json').read_text('utf-8'))
module_dir = pack / 'modules'
module_dir.mkdir(exist_ok=True)
images = {name: Image.open(pack / data['file']) for name, data in atlases.items()}
for m in modules:
    a = atlases[m['atlas']]
    x,y,w,h = a['rects'][m['index']]
    image = images[m['atlas']].crop((x,y,x+w,y+h))
    if m.get('mirror'): image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    image.save(module_dir / f"{m['id']}.png")
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{m["width"]}" height="{m["height"]}" viewBox="{x} {y} {w} {h}"><g'
    if m.get('mirror'): svg += f' transform="translate({2*x+w} 0) scale(-1 1)"'
    svg += f'><image href="../{a["file"]}" width="{a["width"]}" height="{a["height"]}"/></g></svg>'
    (module_dir / f"{m['id']}.svg").write_text(svg, 'utf-8')
temporary = pack / 'chibi-tokens-v1.next.zip'
with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(pack.rglob('*')):
        if file.is_file() and file.suffix.lower() in {'.png','.json','.svg','.md','.txt'}:
            archive.write(file, file.relative_to(pack).as_posix())
temporary.replace(zip_path)
print(f'{len(modules)} modules; {len(list((pack / "sprites").glob("*.png")))} sprite sheets; ZIP {zip_path.stat().st_size / 1048576:.1f} MiB')
