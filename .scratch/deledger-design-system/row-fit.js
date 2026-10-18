// Continue the existing editable file, keeping base frame IDs intact.
const createdNodeIds=[],mutatedNodeIds=[],removedNodeIds=[];
const keep=n=>{createdNodeIds.push(n.id);return n}, touch=n=>{mutatedNodeIds.push(n.id);return n};
const p=figma.root.children.find(n=>n.name==='03 Screens & Prototype');await figma.setCurrentPageAsync(p);
const styles=await figma.getLocalTextStylesAsync();await Promise.all(styles.map(s=>figma.loadFontAsync(s.fontName)));
const TS=Object.fromEntries(styles.map(s=>[s.name,s]));
const cp=figma.root.children.find(n=>n.name==='02 Components');const sets=Object.fromEntries(cp.children.filter(n=>n.type==='COMPONENT_SET').map(n=>[n.name,n]));
const vars=await figma.variables.getLocalVariablesAsync(),cols=await figma.variables.getLocalVariableCollectionsAsync();
const C={};for(const theme of ['Light','Dark'])C[theme]=Object.fromEntries(vars.filter(v=>v.variableCollectionId===cols.find(c=>c.name==='Deledger / Color / '+theme).id).map(v=>[v.name.replace('color/',''),v]));
const paint=(theme,key)=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',C[theme][key]);
const named=(root,name)=>root.findOne(n=>n.name===name), texts=root=>root.findAllWithCriteria({types:['TEXT']});
const text=(root,value)=>texts(root).find(n=>n.characters===value);
const instances=(root,set)=>root.findAllWithCriteria({types:['INSTANCE']}).filter(i=>i.mainComponent?.parent?.name===set);
function props(i,values){if(!i||i.removed)return;const main=i.mainComponent,owner=main.parent.type==='COMPONENT_SET'?main.parent:main;const result={};for(const [key,value]of Object.entries(values)){const real=Object.keys(owner.componentPropertyDefinitions).find(k=>k.split('#')[0]===key);if(real)result[real]=value}i.setProperties(result);touch(i)}
function clone(root,name){let n=p.children.find(n=>n.name===name);if(n)return n;n=keep(root.clone());for(const c of n.findAll(()=>true))createdNodeIds.push(c.id);n.name=name;p.appendChild(n);return n}
function screen(v,key,t='Light'){return p.children.find(n=>n.name===v+' / '+key+' / '+t)}
function top(n){while(n.parent&&n.parent.type!=='PAGE')n=n.parent;return n}
function button(root,label){const t=text(root,label);if(!t)return null;for(let n=t.parent;n&&n.type!=='PAGE';n=n.parent)if(n.type==='INSTANCE')return n;return t}
function layout(parent,name,width){const n=keep(figma.createFrame());n.name=name;n.layoutMode='VERTICAL';n.fills=[];n.resize(width,100);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.itemSpacing=8;parent.appendChild(n);return n}
function txt(parent,value,role='Body',theme='Light'){const n=keep(figma.createText()),s=TS['Deledger/'+(/[\u0e00-\u0e7f]/.test(value)?'Thai':'Latin')+'/'+role];n.fontName=s.fontName;n.textStyleId=s.id;n.characters=value;n.textAutoResize='HEIGHT';n.resize(parent.width,26);n.fills=[paint(theme,'ink')];parent.appendChild(n);return n}
let writtenLinks=0;
function link(node,dest,trigger={type:'ON_CLICK'}){if(!node||!dest||node.visible===false)return;const root=top(node);if(root.id===dest.id)return;let hit=node;
if(node!==root){const name='Hotspot / '+node.name+' :: '+node.id;hit=root.children.find(n=>n.name===name);if(!hit){hit=keep(figma.createRectangle());hit.name=name;root.appendChild(hit);hit.layoutPositioning='ABSOLUTE';hit.fills=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:.001}]}
const b=node.absoluteBoundingBox,o=root.absoluteBoundingBox;hit.resize(Math.max(1,b.width),Math.max(1,b.height));hit.x=b.x-o.x;hit.y=b.y-o.y;}
hit.reactions=[...hit.reactions.filter(r=>r.trigger.type!==trigger.type||(trigger.type==='ON_KEY_DOWN'&&JSON.stringify(r.trigger.keyCodes)!==JSON.stringify(trigger.keyCodes))),{trigger,actions:[{type:'NODE',destinationId:dest.id,navigation:'NAVIGATE',transition:null,resetScrollPosition:true}]}];touch(hit);writtenLinks++}
function modal(v,key,kind,t='Light'){return p.children.find(n=>n.name===v+' / Modal '+kind+' from '+key+' / '+t)}
function routeSave(m,dest){const panel=named(m,'Modal panel');for(const n of panel.findAll(n=>n.name==='Action / Save'))link(n,dest)}
function color(root,theme){for(const i of root.findAllWithCriteria({types:['INSTANCE']}))if(!i.removed&&i.variantProperties?.Theme)props(i,{Theme:theme});for(const n of [root,...root.findAll(()=>true)])for(const property of ['fills','strokes'])if(property in n&&Array.isArray(n[property])){n[property]=n[property].map(f=>{const v=vars.find(v=>v.id===f.boundVariables?.color?.id);if(!v||!v.name.startsWith('color/'))return f;const dest=C[theme][v.name.replace('color/','')];return dest?figma.variables.setBoundVariableForPaint(f,'color',dest):f});touch(n)}}

function refreshHotspots(root){for(const h of root.children.filter(n=>n.name.startsWith('Hotspot / '))){const [name,id]=h.name.slice(10).split(' :: ');let source;try{source=figma.getNodeById(id);if(source?.removed)source=null}catch{}if(source&&top(source).id!==root.id){const path=[];for(let n=source;n.parent&&n.parent.type!=='PAGE';n=n.parent){const variants=n.type==='INSTANCE'?n.variantProperties:null;path.unshift({name:n.name,type:n.type,kind:variants?.Kind,icon:variants?.Type})}let current=root;for(const step of path){const candidates=current?.children?.filter(c=>c.name===step.name&&c.type===step.type)||[];current=candidates.find(c=>(!step.kind||c.variantProperties?.Kind===step.kind)&&(!step.icon||c.variantProperties?.Type===step.icon))||candidates[0]}source=current}if(!source)source=root.findOne(n=>n.name===name&&!n.name.startsWith('Hotspot / '));if(source){const b=source.absoluteBoundingBox,o=root.absoluteBoundingBox;h.resize(Math.max(1,b.width),Math.max(1,b.height));h.x=b.x-o.x;h.y=b.y-o.y;touch(h)}}}
for(const root of p.children.filter(n=>n.type==='FRAME'&&n.visible)){
for(const row of instances(root,'ExpenseSetupRow')){const mobile=root.name.startsWith('Mobile'),g=named(row,'Expense definition');row.itemSpacing=mobile?6:14;row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';const icons=instances(row,'IconButton');const width=Math.max(60,row.width-row.paddingLeft-row.paddingRight-icons.reduce((sum,i)=>sum+i.width,0)-row.itemSpacing*(row.children.length-1));g.resize(width,g.height);g.primaryAxisSizingMode='AUTO';g.counterAxisSizingMode='FIXED';for(const t of texts(g)){t.textAutoResize='HEIGHT';t.resize(width,t.height);touch(t)}touch(g);touch(row)}
refreshHotspots(root);
if(root.name.startsWith('Mobile')&&!root.name.includes(' / Modal ')){const nav=root.children.find(n=>n.name==='Fixed bottom navigation');if(nav){const hits=root.children.filter(n=>n.name.startsWith('Hotspot / Navigate /'));root.appendChild(nav);for(const h of hits)root.appendChild(h);root.numberOfFixedChildren=1+hits.length;touch(root)}}
}
const orphan=await figma.getNodeByIdAsync('15:21985');if(orphan){removedNodeIds.push(orphan.id);orphan.remove()}
print(JSON.stringify({status:'ROW_ACTIONS_FIT',mutatedNodeIds,removedNodeIds}));
