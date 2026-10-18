// Native Figma Plugin API. Run in Scripter; no MCP calls, network or app database writes.
const createdNodeIds=[],mutatedNodeIds=[],removedNodeIds=[];
const keep=n=>{createdNodeIds.push(n.id);return n};
const touch=n=>{mutatedNodeIds.push(n.id);return n};
const goPage=async p=>{if(figma.setCurrentPageAsync)await figma.setCurrentPageAsync(p);else figma.currentPage=p};
const styles=await figma.getLocalTextStylesAsync();
await Promise.all(styles.map(s=>figma.loadFontAsync(s.fontName)));
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].flatMap(style=>['Noto Sans','Noto Sans Thai UI'].map(family=>figma.loadFontAsync({family,style}))));
const TS=Object.fromEntries(styles.map(s=>[s.name,s]));
const vars=await figma.variables.getLocalVariablesAsync(),cols=await figma.variables.getLocalVariableCollectionsAsync();
const C={};for(const theme of ['Light','Dark']){const c=cols.find(c=>c.name==='Deledger / Color / '+theme);C[theme]=Object.fromEntries(vars.filter(v=>v.variableCollectionId===c.id).map(v=>[v.name.replace('color/',''),v]));}
const paint=(theme,key,opacity=1)=>figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0},opacity},'color',C[theme][key]);
function layout(name,direction='VERTICAL',width){const n=keep(figma.createFrame());n.name=name;n.layoutMode=direction;n.fills=[];n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode=width?'FIXED':'AUTO';if(width){n.resize(width,100);n.primaryAxisSizingMode='AUTO'}return n;}
function txt(parent,value,role='Body',theme='Light',key='ink',width){const n=keep(figma.createText()),locale=/[\u0e00-\u0e7f]/.test(value)?'Thai':'Latin',s=TS['Deledger/'+locale+'/'+role];n.fontName={family:s.fontName.family,style:s.fontName.style};n.textStyleId=s.id;n.characters=value;n.fills=[paint(theme,key)];if(width){n.textAutoResize='HEIGHT';n.resize(width,n.height)}parent.appendChild(n);return n;}
function trackedClone(n){const c=keep(n.clone());for(const child of c.findAll(()=>true))createdNodeIds.push(child.id);return c;}
function props(i,values){const main=i.mainComponent,owner=main.parent.type==='COMPONENT_SET'?main.parent:main;const defs=owner.componentPropertyDefinitions,result={};for(const [k,v]of Object.entries(values)){const real=Object.keys(defs).find(key=>key.split('#')[0]===k);if(real)result[real]=v}if(Object.keys(result).length){i.setProperties(result);touch(i)}return i;}
const fp=figma.root.children.find(p=>p.name==='01 Foundations');await goPage(fp);
for(const t of fp.findAllWithCriteria({types:['TEXT']})){
 if(t.fontName.family==='SF Pro'){t.fontName={family:'Noto Sans',style:({Semibold:'SemiBold',Heavy:'ExtraBold'})[t.fontName.style]||t.fontName.style};touch(t)}
 if(t.characters.includes('SF Pro for Latin')){t.characters='Typography: system-ui in code. Noto Sans for Latin; Noto Sans Thai UI in Figma.';touch(t)}
}
const capture=await figma.getNodeByIdAsync('4:2');if(capture&&!capture.removed){removedNodeIds.push(capture.id);capture.remove()}
const cp=figma.root.children.find(p=>p.name==='02 Components');await goPage(cp);
const sets=Object.fromEntries(cp.children.map(n=>[n.name,n]));
for(const comp of sets.MonthTimeline.children.filter(c=>c.variantProperties.Lifecycle==='Closed')){const button=comp.findOne(n=>n.name==='Action / Snapshot');if(button){button.visible=false;touch(button)}}
for(const comp of sets.MoneyField.children){const box=comp.children.find(n=>n.name==='Input');box.layoutSizingHorizontal='FILL';touch(box);const t=box.children.find(n=>n.type==='TEXT');t.textAutoResize='HEIGHT';t.resize(394,26);t.layoutSizingHorizontal='FILL';touch(t)}
for(const comp of sets.IconButton.children.filter(c=>c.variantProperties.Type==='Theme'&&c.variantProperties.Theme==='Light')){const t=comp.findOne(n=>n.type==='TEXT');t.characters='☀︎';touch(t)}
for(const name of ['Button/Primary','Button/Secondary'])for(const comp of sets[name].children){const v=comp.variantProperties;if(v.State==='Hover'||v.State==='Focus'){const color=C[v.Theme]['surface-muted'].resolveForConsumer(comp).value;comp.effects=[{type:'DROP_SHADOW',color,offset:{x:0,y:0},radius:0,spread:3,visible:true,blendMode:'NORMAL'}];touch(comp)}}
for(const comp of sets.StatusBadge.children.filter(c=>c.variantProperties.State==='inconsistent')){
 comp.strokeWeight=1;touch(comp);if(!comp.children.some(n=>n.name==='Double border')){const inside=layout('Double border','HORIZONTAL');inside.resize(comp.width-4,comp.height-4);inside.primaryAxisSizingMode=inside.counterAxisSizingMode='FIXED';inside.cornerRadius=999;inside.strokes=[paint(comp.variantProperties.Theme,'state-strong')];inside.strokeWeight=1;comp.insertChild(0,inside);inside.layoutPositioning='ABSOLUTE';inside.x=inside.y=2;inside.constraints={horizontal:'STRETCH',vertical:'STRETCH'}}
}
for(const n of cp.findAll(c=>(c.type==='FRAME'||c.type==='COMPONENT')&&c.layoutMode==='HORIZONTAL'&&c.counterAxisSizingMode==='FIXED'&&Math.abs(c.height-100)<.01&&c.width>100)){if(n.findOne&&n.parent.type==='INSTANCE')continue;n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='AUTO';touch(n)}
const page=figma.root.children.find(p=>p.name==='03 Screens & Prototype');await goPage(page);
for(const n of page.findAll(c=>c.type==='FRAME'&&c.layoutMode==='HORIZONTAL'&&c.counterAxisSizingMode==='FIXED'&&Math.abs(c.height-100)<.01&&c.width>100)){n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='AUTO';touch(n)}
for(const id of ['3:3182','3:3228','3:3296','3:3342','3:3410','3:3456']){const node=await figma.getNodeByIdAsync(id);if(node&&!node.removed){removedNodeIds.push(id);node.remove()}}
const baseRoots=Object.fromEntries(page.children.filter(n=>n.name.includes(' / ')&&!n.name.includes(' / Dialog / ')&&!n.name.includes(' / Modal ')&&!n.name.includes(' / Calculation ')).map(n=>[n.name,n]));
const panels=Object.fromEntries(page.children.filter(n=>n.name.includes(' / Dialog / ')).map(n=>[n.name,n]));
const screen=(v,k,t='Light')=>baseRoots[v+' / '+k+' / '+t];
function setNameOfRoot(n,viewport,key,theme='Light'){n.name=viewport+' / '+key+' / '+theme;page.appendChild(n);baseRoots[n.name]=n;return n;}
function findText(n,text){return n.findOne(c=>c.type==='TEXT'&&c.characters===text)}
function ancestorInstance(n){for(let p=n.parent;p;p=p.parent)if(p.type==='INSTANCE')return p;return null;}
function named(n,name){return n.findOne(c=>c.name===name)}
function instanceOf(n,name){return n.findAllWithCriteria({types:['INSTANCE']}).filter(i=>i.mainComponent&&i.mainComponent.parent&&i.mainComponent.parent.name===name)}
function instantiate(parent,name,variants,values={}){const set=sets[name],main=set.children.find(c=>c.type==='COMPONENT'&&Object.entries(variants).every(([k,v])=>c.variantProperties[k]===v)),i=keep(main.createInstance());parent.appendChild(i);props(i,values);return i;}
for(const n of Object.values(baseRoots)){
 const viewport=n.name.split(' / ')[0],main=named(n,'Main content');
 if(viewport==='Mobile'){const nav=n.children.find(c=>c.name==='Fixed bottom navigation');if(nav){n.numberOfFixedChildren=1;touch(n)}}
 if(/ \/ (Login|Start|Resume) \/ /.test(n.name)){for(const t of n.findAllWithCriteria({types:['TEXT']})){if(['เข้าสู่ระบบ','เริ่มบัญชีรายรับรายจ่าย','เริ่มติดตามจากเดือนนี้'].includes(t.characters)){t.textStyleId=TS['Deledger/Thai/H1 Mobile'].id;touch(t)}}}
 if(/ \/ (MonthEmpty|MonthError|MonthLoading) \/ /.test(n.name)){const h=named(n,'Page heading');if(h){removedNodeIds.push(h.id);h.remove()}main.paddingTop=n.name.includes('MonthLoading')?20:44;touch(main)}
 if(n.name.includes('HistoryGap')){const cover=named(n,'History cover');const draft=instanceOf(cover,'StatusBadge')[0];if(draft){removedNodeIds.push(draft.id);draft.remove()}const t=findText(cover,'ช่วงหยุดติดตาม');if(t&&t.parent===cover){const index=cover.children.indexOf(t);const b=layout('Tracking Gap badge','HORIZONTAL');b.paddingLeft=b.paddingRight=10;b.paddingTop=b.paddingBottom=5;b.cornerRadius=999;b.strokes=[paint('Light','state-muted')];b.strokeWeight=1;cover.insertChild(index,b);txt(b,'ช่วงหยุดติดตาม','Badge');removedNodeIds.push(t.id);t.remove()}}
}
for(const [name,panel]of Object.entries(panels))if(/ \/ (Add|AddFixed|Edit) \/ /.test(name)){
 panel.paddingTop=panel.paddingRight=panel.paddingBottom=panel.paddingLeft=0;panel.fills=[];panel.strokes=[];panel.effects=[];touch(panel);
 const ins=panel.children.find(n=>n.type==='INSTANCE');const mobile=name.startsWith('Mobile');if(mobile){ins.paddingTop=ins.paddingBottom=ins.paddingLeft=ins.paddingRight=22;ins.resize(366,ins.height);touch(ins)}
 if(name.includes(' / Add')){for(const i of instanceOf(panel,'MoneyField')){const label=findText(i,'รายละเอียดรายจ่าย');if(label)props(i,{Value:'อินเทอร์เน็ต'});const amount=findText(i,'ยอดประจำ');if(amount)props(i,{Value:'490'})}}
}
// Expense confirmation outcomes preserve previously confirmed facts.
for(const viewport of ['Desktop','Mobile'])for(const [key,fixed,variable,total]of [['MonthVariablePaid',false,true,'1,200.00'],['MonthAllPaid',true,true,'7,200.00']]){
 const name=viewport+' / '+key+' / Light';if(baseRoots[name])continue;
 const n=setNameOfRoot(trackedClone(screen(viewport,'Month')),viewport,key);
 for(const i of instanceOf(n,'ExpenseChip'))props(i,{State:(i.variantProperties.Kind==='Fixed'?fixed:variable)?'Confirmed':'Unconfirmed',Amount:i.variantProperties.Kind==='Fixed'?'6000.00':'1200.00'});
 for(const i of instanceOf(n,'MonthTimeline'))props(i,{Details:total});
}
for(const viewport of ['Desktop','Mobile']){
 const name=viewport+' / MonthAdded / Light';if(baseRoots[name])continue;const n=setNameOfRoot(trackedClone(screen(viewport,'Month')),viewport,'MonthAdded');
 const list=named(n,'Expense list');instantiate(list,'ExpenseChip',{Theme:'Light',Kind:'Variable',State:'Unconfirmed'},{Name:'อินเทอร์เน็ต',Amount:'กรอกยอด'});
 const manager=named(n,'ExpenseSetupManager');const row=instantiate(manager,'ExpenseSetupRow',{Theme:'Light',Kind:'Variable',Paused:'No'},{Name:'อินเทอร์เน็ต'});row.resize(viewport==='Mobile'?308:1054,row.height);const g=named(row,'Expense definition');g.resize(viewport==='Mobile'?148:894,g.height);touch(g);
}
for(const root of Object.values(baseRoots)){root.reactions=[];touch(root)}
const links=[],modalRoots={};
async function link(node,destination,trigger={type:'ON_CLICK'},resetScroll=false){
 if(!node||!destination||node.visible===false)return;
 let inInstance=node.type==='INSTANCE';for(let p=node.parent;p&&p.type!=='PAGE';p=p.parent)if(p.type==='INSTANCE')inInstance=true;
 if(inInstance){let root=node;while(root.parent&&root.parent.type!=='PAGE')root=root.parent;const box=node.absoluteBoundingBox,origin=root.absoluteTransform;const name='Hotspot / '+node.name+' :: '+node.id;let hit=root.children.find(n=>n.name===name);if(!hit){hit=keep(figma.createRectangle());hit.name=name;root.appendChild(hit);hit.layoutPositioning='ABSOLUTE';hit.fills=[{type:'SOLID',color:{r:0,g:0,b:0},opacity:.001}]}hit.resize(Math.max(1,box.width),Math.max(1,box.height));hit.x=box.x-origin[0][2];hit.y=box.y-origin[1][2];node=hit;}
 const action={type:'NODE',destinationId:destination.id,navigation:'NAVIGATE',transition:null,resetScrollPosition:resetScroll};node.reactions=[{trigger,actions:[action]}];touch(node);links.push({from:node.id,to:destination.id,trigger:trigger.type});
}
function recolor(root,theme){if(theme==='Light')return;for(const i of root.findAllWithCriteria({types:['INSTANCE']})){if(i.removed)continue;if(i.variantProperties&&i.variantProperties.Theme)props(i,{Theme:theme})}for(const n of [root,...root.findAll(()=>true)])for(const prop of ['fills','strokes'])if(prop in n&&Array.isArray(n[prop])){const updated=n[prop].map(p=>{const id=p.boundVariables&&p.boundVariables.color&&p.boundVariables.color.id;const v=vars.find(v=>v.id===id);return v&&v.variableCollectionId===cols.find(c=>c.name==='Deledger / Color / Light').id?figma.variables.setBoundVariableForPaint(p,'color',C.Dark[v.name.replace('color/','')]):p});n[prop]=updated;touch(n)}}
async function modal(base,kind,saveTarget){
 const [viewport,key,theme]=base.name.split(' / '),name=viewport+' / Modal '+kind+' from '+key+' / '+theme;
 if(modalRoots[name])return modalRoots[name];const n=trackedClone(base);n.name=name;page.appendChild(n);n.numberOfFixedChildren=0;n.overflowDirection='NONE';modalRoots[name]=n;
 const mask=keep(figma.createRectangle());mask.name='Dismiss backdrop';mask.resize(n.width,n.height);mask.fills=[{type:'SOLID',color:{r:23/255,g:23/255,b:23/255},opacity:.65}];n.appendChild(mask);mask.layoutPositioning='ABSOLUTE';mask.x=mask.y=0;
 const panel=trackedClone(panels[viewport+' / Dialog / '+kind+' / Light']);n.appendChild(panel);panel.layoutPositioning='ABSOLUTE';panel.visible=true;panel.name='Modal panel';panel.x=(n.width-panel.width)/2;panel.y=Math.max(12,(n.height-panel.height)/2);if(panel.height>n.height-24){panel.resize(panel.width,n.height-24);panel.primaryAxisSizingMode='FIXED';panel.overflowDirection='VERTICAL';panel.clipsContent=true}recolor(panel,theme);
 await link(mask,base);await link(n,base,{type:'ON_KEY_DOWN',device:'KEYBOARD',keyCodes:[27]});
 for(const b of panel.findAll(c=>c.name==='Action / Dismiss'))await link(b,base);
 for(const b of panel.findAll(c=>c.name==='Action / Save'))await link(b,saveTarget||base);
 if(kind==='Add'||kind==='AddFixed'){const variable=named(panel,'Choose / Variable'),fixed=named(panel,'Choose / Fixed');const alt=kind==='Add'?'AddFixed':'Add';if(kind==='Add')await link(fixed,await modal(base,alt,saveTarget));else await link(variable,modalRoots[viewport+' / Modal Add from '+key+' / '+theme]);}
 if(kind==='VariableError'){const field=instanceOf(panel,'MoneyField')[0];await link(field,await modal(base,'Variable',saveTarget));}
 if(kind==='Theme'){
  for(const choice of ['System','Light','Dark'])await link(named(panel,'Choose theme / '+choice),screen(viewport,'Month',choice==='Dark'?'Dark':'Light'));
  panel.x=n.width-panel.width-(viewport==='Mobile'?20:52);panel.y=viewport==='Mobile'?70:82;
 }
 return n;
}
for(const base of Object.values(baseRoots)){
 const [viewport,key,theme]=base.name.split(' / '),month=screen(viewport,'Month',theme),main=named(base,'Main content');
 for(const nav of base.findAll(c=>c.name.startsWith('Navigate / '))){const dest=nav.name.split(' / ')[1];await link(nav,screen(viewport,dest==='Month'?'Month':dest, dest==='Month'?theme:'Light'),undefined,true)}
 await link(named(base,'Brand'),month,undefined,true);
 const logout=findText(base,'ออกจากระบบ');if(logout)await link(ancestorInstance(logout),screen(viewport,'Login'),undefined,true);
 const icon=instanceOf(base,'IconButton').find(i=>i.variantProperties.Type==='Theme');if(icon)await link(icon,await modal(base,'Theme'));
 if(key==='Login'||key==='Start'||key==='Resume'){const text=findText(base,key==='Login'?'ดำเนินการต่อ':key==='Resume'?'เริ่มติดตามต่อ':'เริ่มเดือนแรก');await link(ancestorInstance(text),screen(viewport,key==='Login'?'Start':'Month'),undefined,true)}
 if(key.startsWith('Profile')){const text=findText(base,'บันทึกข้อมูล');await link(ancestorInstance(text),screen(viewport,'ProfileSaved'))}
 if(key.startsWith('History')){await link(named(base,'Previous cover'),screen(viewport,'History'));await link(named(base,'Gap cover'),screen(viewport,'HistoryGap'));for(const tab of instanceOf(base,'HistoryTab')){const gap=tab.variantProperties.Gap==='Yes';await link(tab,screen(viewport,gap?'HistoryGap':'History'))}const refresh=findText(base,'โหลดล่าสุด');if(refresh)await link(ancestorInstance(refresh),base)}
 const history=findText(base,'ดูประวัติ');if(history)await link(ancestorInstance(history),screen(viewport,'History'),undefined,true);
 if(key==='MonthEmpty'){await link(ancestorInstance(findText(base,'เริ่มเดือนแรก')),screen(viewport,'Start'));continue}
 if(key==='MonthError'){await link(ancestorInstance(findText(base,'ลองใหม่')),screen(viewport,'Month'));continue}
 if(key==='MonthLoading'){await link(base,screen(viewport,'Month'),{type:'AFTER_TIMEOUT',timeout:1.2});continue}
 const isMonth=key.startsWith('Month')||key==='CloseReady';if(!isMonth)continue;
 for(const kind of ['Income','Snapshot','Ending']){const button=named(base,'Action / '+kind);const dest=kind==='Ending'?screen(viewport,'MonthEnding'):base;await link(button,await modal(base,kind,dest))}
 const fixedPaid=['MonthPaid','MonthAllPaid','MonthEnding','MonthClosed','CloseReady'].includes(key),variablePaid=['MonthVariablePaid','MonthAllPaid'].includes(key);
 for(const chip of instanceOf(base,'ExpenseChip')){const kind=chip.variantProperties.Kind;if(kind==='Fixed'){await link(chip,await modal(base,fixedPaid?'Confirmed':'Fixed',screen(viewport,fixedPaid?(variablePaid?'MonthVariablePaid':'Month'):(variablePaid?'MonthAllPaid':'MonthPaid'))))}else await link(chip,await modal(base,'Variable',screen(viewport,fixedPaid?'MonthAllPaid':'MonthVariablePaid')))}
 const add=findText(base,'เพิ่มรายการ');if(add)await link(ancestorInstance(add),await modal(base,'Add',screen(viewport,'MonthAdded')));
 for(const row of instanceOf(base,'ExpenseSetupRow')){const edit=instanceOf(row,'IconButton').find(i=>i.variantProperties.Type==='Edit'),pause=instanceOf(row,'IconButton').find(i=>i.variantProperties.Type==='Pause');await link(edit,await modal(base,'Edit',base));await link(pause,screen(viewport,'MonthPaused')||base)}
 const close=named(base,'Action / Close');if(close)await link(close,await modal(base,'Close',screen(viewport,'MonthClosed')));
 const calc=named(base,'Calculation toggle');if(calc){const name=viewport+' / Calculation from '+key+' / '+theme;let expanded=page.children.find(n=>n.name===name);if(!expanded){expanded=trackedClone(base);expanded.name=name;page.appendChild(expanded);const summary=instanceOf(expanded,'MonthSummary')[0];const note=layout('Monthly Spending formula','VERTICAL',viewport==='Mobile'?308:529);note.itemSpacing=8;main;const expMain=named(expanded,'Main content');expMain.appendChild(note);txt(note,'ยอดตั้งต้น + รายรับ − '+(key==='MonthEnding'?'ยอดปลาย':'Snapshot ล่าสุด')+' = '+(key==='MonthEnding'?'รายจ่ายทั้งเดือน':'รายจ่ายโดยประมาณ'),'Body',theme,'ink',note.width);txt(note,'รายละเอียดรายจ่ายอธิบายยอดรวมนี้ ไม่ได้นำมาบวกเพิ่ม','Helper',theme,'muted-ink',note.width);await link(named(expanded,'Calculation toggle'),base)}await link(calc,expanded)}
}
for(const root of Object.values(baseRoots).filter(n=>n.name.startsWith('Mobile'))){const nav=root.children.find(n=>n.name==='Fixed bottom navigation');if(nav){const hits=root.children.filter(n=>n.name.startsWith('Hotspot / Navigate /'));root.appendChild(nav);for(const hit of hits)root.appendChild(hit);root.numberOfFixedChildren=1+hits.length;touch(root)}}
// Retain panels as source specimens within the component library, outside prototype roots.
for(const panel of Object.values(panels)){panel.visible=false;touch(panel)}
let desktopIndex=0,mobileIndex=0,modalIndex=0;
for(const n of page.children.filter(n=>n.type==='FRAME'&&n.visible)){
 if(n.name.startsWith('Mobile')){n.x=6500+(mobileIndex%5)*510;n.y=160+Math.floor(mobileIndex/5)*1000;mobileIndex++}
 else if(n.name.includes(' / Modal ')||n.name.includes(' / Calculation ')){n.x=120+(modalIndex%4)*1420;n.y=7600+Math.floor(modalIndex/4)*1040;modalIndex++}
 else{n.x=120+(desktopIndex%4)*1420;n.y=160+Math.floor(desktopIndex/4)*1040;desktopIndex++}touch(n)
}
page.flowStartingPoints=[
 {nodeId:screen('Desktop','Login').id,name:'Desktop · Login → first month'},
 {nodeId:screen('Desktop','Month').id,name:'Desktop · Monthly tracking'},
 {nodeId:screen('Mobile','Login').id,name:'Mobile · Login → first month'},
 {nodeId:screen('Mobile','Month').id,name:'Mobile · Monthly tracking'},
 {nodeId:screen('Desktop','CloseReady').id,name:'Manual Close · 31 October scenario'},
 {nodeId:screen('Desktop','MonthEmpty').id,name:'Empty · First month required'},
 {nodeId:screen('Desktop','MonthError').id,name:'Error · Retry'},
 {nodeId:screen('Desktop','Resume').id,name:'Resume after Tracking Gap'}
];touch(page);
const missingFonts=page.findAllWithCriteria({types:['TEXT']}).filter(n=>n.hasMissingFont).map(n=>({id:n.id,text:n.characters}));
const roots=page.children.filter(n=>n.type==='FRAME'&&n.visible),counts={};for(const n of page.findAll(()=>true))counts[n.type]=(counts[n.type]||0)+1;
const brokenLinks=links.filter(l=>!figma.getNodeById(l.to));
const images=page.findAll(n=>'fills'in n&&Array.isArray(n.fills)&&n.fills.some(p=>p.type==='IMAGE')).map(n=>n.id);
figma.currentPage.selection=[screen('Desktop','Month')];figma.viewport.scrollAndZoomIntoView([screen('Desktop','Month')]);
print(JSON.stringify({status:'DELEDGER_PROTOTYPE_READY',roots:roots.length,links:links.length,missingFonts,brokenLinks,images,counts,flows:page.flowStartingPoints,createdCount:createdNodeIds.length,mutatedCount:mutatedNodeIds.length,removedNodeIds}));
