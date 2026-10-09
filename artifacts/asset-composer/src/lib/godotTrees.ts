import atlas from '../../public/asset-packs/composer-trees-v1/manifest.json';

export async function buildGodotTreePack() {
  const files:Record<string,Uint8Array>={};
  await Promise.all(Object.values(atlas).map(async a=>{
    const response=await fetch(`${import.meta.env.BASE_URL}asset-packs/composer-trees-v1/${a.file}`);
    if(!response.ok) throw new Error(`Не удалось загрузить ${a.file}`);
    files[a.file]=new Uint8Array(await response.arrayBuffer());
  }));
  files['manifest.json']=new TextEncoder().encode(JSON.stringify(atlas));
  files['README.ru.md']=new TextEncoder().encode('Распакуйте в Planetki/Assets/composer/trees. Дуб, сосна и берёза: standing, cut, stump, logs и отдельные chip0…chip3. Godot runtime src/core/composer_trees.gd показывает ветер, щепки и падение. MapResourceManager хранит стадии standing → falling → logs → stump. WoodcutterProfession подбирает древесину после падения и физически несёт в лагерь. Замена текстур не меняет запас древесины.');
  return files;
}
