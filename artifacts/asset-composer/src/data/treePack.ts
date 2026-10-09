import type { AnimationClip, Bone, Project, Template } from '@/domain/types';
import { tokenEntity, tokenTemplate } from './chibiTokenPack';
import atlas from '../../public/asset-packs/composer-trees-v1/manifest.json';

const identity = {tx:0,ty:0,rotation:0,scaleX:1,scaleY:1};
const empty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -220 200 220"/>';
const names = {oak:'Дуб',pine:'Сосна',birch:'Берёза'};
export async function addTreePack() {
  const images = await Promise.all(Object.entries(atlas).map(async ([key,a]) => {
    const response = await fetch(`${import.meta.env.BASE_URL}asset-packs/composer-trees-v1/${a.file}`);
    if (!response.ok) throw new Error(`Не удалось загрузить дерево: ${names[key as keyof typeof names]}`);
    const dataUri = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;void response.blob().then(blob=>reader.readAsDataURL(blob),reject);});
    return [key,dataUri] as const;
  }));
  return (p: Project) => {
    for (const [key,dataUri] of images) {
      const id=`composer_tree_${key}`, a=atlas[key as keyof typeof atlas];
      if(p.entities.some(e=>e.id===id)) continue;
      const svg=(frame:string,height:number) => {
        const [x,y,w,h]=(a.frames as Record<string,number[]>)[frame], width=height*w/h;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-width/2} ${-height} ${width} ${height}"><svg x="${-width/2}" y="${-height}" width="${width}" height="${height}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image href="${dataUri}" width="${a.width}" height="${a.height}"/></svg></svg>`;
      };
      const bone=(id:string,parentId:string|null):Bone=>({id,name:id==='root'?'Основание':id==='trunk'?'Ствол':id==='chips'?'Щепки':'Пень и брёвна',parentId,restPose:{...identity},length:0});
      const t:Template={...tokenTemplate(),id,name:names[key as keyof typeof names],description:'Рубка: щепки → зарубка → падение → брёвна. В игре запас дерева расходуется ударами; брёвна подбирают и несут в лагерь.',skeletonFamily:'custom_2d_v1',rigFamilyId:undefined,entityTypes:['static_object'],bones:[bone('root',null),bone('trunk','root'),bone('chips','root'),bone('ground','root')],slots:[],boneParts:[
        {id:'tree',boneId:'trunk',svgData:svg('standing',210),naturalWidth:200,naturalHeight:220,localX:0,localY:-110,zOffset:-900,attachments:{cut:svg('cut',210),hidden:empty}},
        {id:'chips',boneId:'chips',svgData:empty,naturalWidth:200,naturalHeight:220,localX:0,localY:-110,zOffset:-700,attachments:{hit:svg('chip0',12)}},
        {id:'ground',boneId:'ground',svgData:empty,naturalWidth:200,naturalHeight:220,localX:0,localY:-110,zOffset:-800,attachments:{stump:svg('stump',35),pile:svg('logs',45)}}],previewWidth:320,previewHeight:320};
      // Setup parts use their authored SVG viewBox just like swapped attachments.
      const bounds=(part:NonNullable<Template['boneParts']>[number])=>{const m=part.svgData!.match(/viewBox="([^"]+)"/)!;const [x,y,w,h]=m[1].split(' ').map(Number);Object.assign(part,{naturalWidth:w,naturalHeight:h,localX:x+w/2,localY:y+h/2});};
      t.boneParts!.forEach(bounds);
      const clip=(name:string,label:string,durationMs:number,loops:boolean,poses:Record<string,Array<[number,number,number,number]>>={},attachments:Record<string,Array<[number,string]>>={}):AnimationClip=>({id:`${id}__${name}`,templateId:id,name,label,skeletonFamily:t.skeletonFamily,durationMs,fps:24,loops,layers:[{mask:'full_body',tracks:Object.entries(poses).map(([boneId,keys])=>({boneId,rotationMode:'unwrapped',keyframes:keys.map(([timeMs,tx,ty,rotation])=>({timeMs,transform:{...identity,tx,ty,rotation},easing:'ease_in_out'}))}))}],attachments:Object.entries(attachments).map(([boneId,keys])=>({boneId,keyframes:keys.map(([timeMs,name])=>({timeMs,name}))}))});
      const clips=[clip('idle','Покой · ветер',2400,true,{trunk:[[0,0,0,-1],[1200,0,0,1],[2400,0,0,-1]]}),clip('chop','Рубка · щепки и зарубка',1000,true,{trunk:[[0,0,0,0],[280,0,0,-2],[400,0,0,2],[600,0,0,0]],chips:[[0,0,-38,0],[280,0,-38,0],[700,55,-60,130]]},{trunk:[[0,'cut']],chips:[[0,'hidden'],[280,'hit'],[700,'hidden']]}),clip('fall','Падение → брёвна',1600,false,{trunk:[[0,0,0,0],[1100,0,0,88],[1200,0,0,90]]},{trunk:[[0,'cut'],[1250,'hidden']],ground:[[0,'stump'],[1250,'pile']]}),clip('logs','Брёвна · готово к переноске',1200,true,{}, {trunk:[[0,'hidden']],ground:[[0,'pile']]})];
      const e={...tokenEntity(t.name,0,{}),id,templateId:id,entityType:'static_object' as const,appearance:undefined,slots:[],activeAnimationClipId:clips[0].id,species:key};
      p.templates.push(t);p.entities.push(e);p.animationClips.push(...clips);
    }
  };
}
