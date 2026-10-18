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
function refreshHotspots(root){for(const h of root.children.filter(n=>n.name.startsWith('Hotspot / '))){const [name,id]=h.name.slice(10).split(' :: ');let source;try{source=figma.getNodeById(id);if(source?.removed)source=null}catch{};if(source&&top(source)!==root){const path=[];for(let n=source;n.parent&&n.parent.type!=='PAGE';n=n.parent)path.unshift(n.name);let n=root;for(const part of path)n=n?.children?.find(c=>c.name===part);source=n}if(!source)source=root.findOne(n=>n.name===name&&!n.name.startsWith('Hotspot / '));if(source){const b=source.absoluteBoundingBox,o=root.absoluteBoundingBox;h.resize(Math.max(1,b.width),Math.max(1,b.height));h.x=b.x-o.x;h.y=b.y-o.y;touch(h)}}}

// Fix the mobile navigation width at its reusable source and every screen instance.
for(const c of sets.Navigation.children.filter(n=>n.variantProperties.Viewport==='Mobile')){c.resize(390,72);c.primaryAxisSizingMode='FIXED';c.counterAxisSizingMode='AUTO';for(const child of c.children)child.layoutSizingHorizontal='FILL';touch(c)}
for(const root of p.children.filter(n=>n.type==='FRAME'&&n.visible&&n.name.startsWith('Mobile'))){const nav=root.children.find(n=>n.name==='Fixed bottom navigation');if(nav){nav.resize(390,72);nav.primaryAxisSizingMode='FIXED';nav.counterAxisSizingMode='AUTO';nav.x=0;nav.y=844-nav.height;touch(nav)}}
for(const v of ['Desktop','Mobile']){
 const variableEdited=clone(screen(v,'Month'),v+' / MonthVariableEdited / Light');for(const row of instances(variableEdited,'ExpenseSetupRow'))if(row.variantProperties.Kind==='Variable')props(row,{Name:'ค่าไฟฟ้า'});for(const chip of instances(variableEdited,'ExpenseChip'))if(chip.variantProperties.Kind==='Variable')props(chip,{Name:'ค่าไฟฟ้า'});
 for(const base of p.children.filter(n=>n.type==='FRAME'&&n.visible&&n.name.startsWith(v+' / ')&&!n.name.includes(' / Modal ')&&!n.name.includes(' / Calculation '))){const [,key,t]=base.name.split(' / ');const old=modal(v,key,'Edit',t);if(old){const vm=clone(old,v+' / Modal EditVariable from '+key+' / '+t);const panel=named(vm,'Modal panel'),ins=instances(panel,'ExpenseSetupDialog')[0];props(ins,{Kind:'Variable'});for(const field of instances(panel,'MoneyField'))if(text(field,'รายละเอียดรายจ่าย'))props(field,{Value:'ค่าไฟฟ้า'});routeSave(vm,variableEdited);for(const row of instances(base,'ExpenseSetupRow'))if(row.variantProperties.Kind==='Variable')link(instances(row,'IconButton').find(i=>i.variantProperties.Type==='Edit'),vm);refreshHotspots(vm)}
 // The dismissible saved banner returns to the editable form.
 if(key==='ProfileSaved')link(button(base,'ปิด'),screen(v,'Profile',t)||screen(v,'Profile'));
 for(const row of instances(base,'ExpenseSetupRow'))if(row.variantProperties.Paused==='Yes'){const icon=instances(row,'IconButton').find(i=>i.variantProperties.Type==='Pause');const glyph=texts(icon)[0];glyph.characters='▶';touch(glyph)}
 }
}
// Correct theme menus for each dark counterpart and keep active page navigation.
for(const base of p.children.filter(n=>n.type==='FRAME'&&n.visible&&!n.name.includes(' / Modal ')&&!n.name.includes(' / Calculation '))){const [v,key,t]=base.name.split(' / ');if(!['Desktop','Mobile'].includes(v))continue;
for(const nav of base.findAll(n=>n.name.startsWith('Navigate / '))){const destKey=nav.name.split(' / ')[1];link(nav,screen(v,destKey,t)||screen(v,destKey))}
const original=modal(v,key,'Theme','Light');if(original&&t==='Dark'){const m=clone(original,v+' / Modal Theme from '+key+' / Dark');color(m,'Dark');const panel=named(m,'Modal panel');for(const control of instances(panel,'ThemeControl'))props(control,{Theme:'Dark',Preference:'Dark'});link(named(m,'Dismiss backdrop'),base);link(m,base,{type:'ON_KEY_DOWN',device:'KEYBOARD',keyCodes:[27]});for(const pref of ['System','Light','Dark'])link(named(panel,'Choose theme / '+pref),screen(v,key,pref==='Dark'?'Dark':'Light'));const theme=instances(base,'IconButton').find(i=>i.variantProperties.Type==='Theme');link(theme,m);refreshHotspots(m)}
// Horizontal history targets move with their scroll container.
if(key.startsWith('History')){const tabs=named(base,'Reporting Months');if(tabs){for(const h of tabs.children.filter(n=>n.name.startsWith('Scrollable history target / '))){removedNodeIds.push(h.id);h.remove()}for(const h of base.children.filter(n=>n.name.startsWith('Hotspot / HistoryTab'))){removedNodeIds.push(h.id);h.remove()}for(const tab of instances(tabs,'HistoryTab')){const label=texts(tab).find(n=>['ตุลาคม 2569','กันยายน 2569','ช่วงข้อมูลขาด'].includes(n.characters))?.characters;const dest=screen(v,label==='กันยายน 2569'?'HistoryPrevious':label==='ช่วงข้อมูลขาด'?'HistoryGap':'History',t)||screen(v,label==='กันยายน 2569'?'HistoryPrevious':label==='ช่วงข้อมูลขาด'?'HistoryGap':'History');const hit=keep(figma.createRectangle());tabs.appendChild(hit);hit.layoutPositioning='ABSOLUTE';hit.name='Scrollable history target / '+label;hit.resize(tab.width,tab.height);hit.x=tab.x;hit.y=tab.y;hit.fills=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:.001}];if(dest?.id!==base.id)hit.reactions=[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:dest.id,navigation:'NAVIGATE',transition:null}]}];touch(hit)}}}
}
for(const root of p.children.filter(n=>n.type==='FRAME'&&n.visible)){refreshHotspots(root);if(root.name.startsWith('Mobile')&&!root.name.includes(' / Modal ')){const nav=root.children.find(n=>n.name==='Fixed bottom navigation');if(nav){const hits=root.children.filter(n=>n.name.startsWith('Hotspot / Navigate /'));root.appendChild(nav);for(const h of hits)root.appendChild(h);root.numberOfFixedChildren=1+hits.length;touch(root)}}}
// Set explicit starting points to discard the ones automatically copied by Figma cloning.
p.flowStartingPoints=[
 {nodeId:screen('Desktop','Login').id,name:'Desktop · Login → first month'},
 {nodeId:screen('Desktop','Month').id,name:'Desktop · Monthly tracking'},
 {nodeId:screen('Mobile','Login').id,name:'Mobile · Login → first month'},
 {nodeId:screen('Mobile','Month').id,name:'Mobile · Monthly tracking'},
 {nodeId:screen('Desktop','CloseReady').id,name:'Manual Close · 31 October scenario'},
 {nodeId:screen('Desktop','MonthEmpty').id,name:'Empty · First month required'},
 {nodeId:screen('Desktop','MonthError').id,name:'Error · Retry'},
 {nodeId:screen('Desktop','Resume').id,name:'Resume after Tracking Gap'},
 {nodeId:screen('Desktop','MonthLoading').id,name:'Loading → Monthly tracking'},
 {nodeId:screen('Desktop','MonthVariablePaid').id,name:'Variable · Amend or cancel confirmation'},
 {nodeId:modal('Desktop','Month','VariableError').id,name:'Desktop · Required amount validation'},
 {nodeId:modal('Mobile','Month','VariableError').id,name:'Mobile · Required amount validation'}];touch(p);
let index=0;for(const n of p.children.filter(n=>n.type==='FRAME'&&n.visible)){if(n.name.includes(' / Modal ')||n.name.includes(' / Calculation ')){n.x=120+(index%6)*1420;n.y=18000+Math.floor(index/6)*1050;index++;touch(n)}}
print(JSON.stringify({status:'FINAL_LAYOUT_AND_ROUTES_FIXED',writtenLinks,createdNodeIds,mutatedNodeIds,removedNodeIds}));
