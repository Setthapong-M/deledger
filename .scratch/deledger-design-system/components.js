const page=figma.root.children.find(p=>p.name==='02 Components');
await figma.setCurrentPageAsync(page);
if(page.children.length)throw Error('Components already exist; inspect before retry');
let canvasY=100;
function finish(name,variants,description,cols=4){const set=keep(figma.combineAsVariants(variants,page));set.name=name;set.description=description;let maxW=Math.max(...variants.map(v=>v.width)),maxH=Math.max(...variants.map(v=>v.height));variants.forEach((v,i)=>{v.x=32+(i%cols)*(maxW+24);v.y=64+Math.floor(i/cols)*(maxH+24);});set.resize(cols*(maxW+24)+40,Math.ceil(variants.length/cols)*(maxH+24)+80);set.x=120;set.y=canvasY;canvasY+=set.height+120;sets[name]=set;return set;}
function variant(props,direction='HORIZONTAL',width){return component(Object.entries(props).map(([k,v])=>k+'='+v).join(', '),direction,width);}
for(const style of ['Primary','Secondary','Text']){
 const variants=[];
 for(const theme of ['Light','Dark'])for(const size of ['Regular','Compact'])for(const state of ['Default','Hover','Focus','Disabled']){
  const n=variant({Theme:theme,Size:size,State:state});padding(n,size==='Compact'?12:style==='Primary'?18:15);n.paddingTop=n.paddingBottom=size==='Compact'?7:10;n.primaryAxisAlignItems='CENTER';n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',12);n.minHeight=44;n.itemSpacing=8;
  n.fills=style==='Text'?[]:[paint(theme,state==='Disabled'?'surface-muted':style==='Primary'?'primary':'surface')];
  n.strokes=style==='Text'?[]:[paint(theme,state==='Disabled'?'border':state==='Default'?(style==='Primary'?'primary':'border'):'ink')];n.strokeWeight=style==='Primary'?2:1;
  if(state==='Focus'||state==='Hover')n.effects=[{type:'DROP_SHADOW',color:{r:.5,g:.5,b:.5,a:.15},offset:{x:0,y:0},radius:0,spread:3,visible:true,blendMode:'NORMAL'}];
  const t=txt(n,'บันทึก',size==='Compact'?'Compact':'Label',theme,state==='Disabled'?'muted-ink':style==='Primary'?'primary-ink':'ink');if(style==='Text')t.textDecoration='UNDERLINE';textProperty(n,t,'Label','บันทึก');variants.push(n);
 }
 finish('Button/'+style,variants,'web/src/components/ui-styles.ts — '+style.toLowerCase()+'Button. 44px minimum target; compact changes padding and typography. Hover/focus matches border/ring behavior.');
}
{
 const variants=[];
 for(const theme of ['Light','Dark'])for(const state of ['Default','Filled','Invalid','Disabled','Readonly']){
 const n=variant({Theme:theme,State:state},'VERTICAL',420);bind(n,'itemSpacing','spacing',8);
 textProperty(n,txt(n,'ยอดเงิน','Label',theme),'Label','ยอดเงิน');
 const box=layout('Input','HORIZONTAL',420);n.appendChild(box);box.resize(420,48);box.primaryAxisSizingMode='FIXED';box.counterAxisSizingMode='FIXED';box.counterAxisAlignItems='CENTER';box.paddingLeft=box.paddingRight=13;box.paddingTop=box.paddingBottom=10;bind(box,'cornerRadius','radius',10);box.fills=[paint(theme,state==='Readonly'?'surface-muted':'input')];box.strokes=[paint(theme,state==='Invalid'?'state-strong':'border')];box.strokeWeight=state==='Invalid'?2:1;
 const t=txt(box,state==='Default'?'':state==='Invalid'?'':'30,000.00','Label',theme,state==='Readonly'?'muted-ink':'ink');textProperty(n,t,'Value',t.characters);
 if(state==='Invalid')textProperty(n,txt(n,'กรุณากรอกยอดเงิน','Helper',theme,'state-strong'),'Error','กรุณากรอกยอดเงิน');
 variants.push(n);
 }finish('MoneyField',variants,'web/src/components/money-field.tsx + ui.field. Label, Value and Error are editable TEXT properties. Readonly styling comes from ProfileForm.',2);
}
{
 const variants=[];const names={draft:'○  กำลังกรอก',needs_information:'!  ข้อมูลไม่ครบ',inconsistent:'⚠  ยอดไม่สอดคล้อง',reconciled:'✓  ตรวจสอบแล้ว'};
 for(const theme of ['Light','Dark'])for(const state of Object.keys(names))for(const partial of ['No','Yes']){
 const n=variant({Theme:theme,State:state,Partial:partial});n.paddingLeft=n.paddingRight=10;n.paddingTop=n.paddingBottom=5;n.minHeight=30;n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',999);n.fills=state==='reconciled'?[paint(theme,'primary')]:[];n.strokes=[paint(theme,state==='reconciled'?'primary-ink':state==='inconsistent'?'state-strong':'state-muted')];n.strokeWeight=state==='needs_information'?2:state==='inconsistent'?3:1;if(state==='draft'||state==='needs_information')n.dashPattern=[3,3];
 txt(n,names[state]+(partial==='Yes'?' · เริ่มกลางเดือน':''),'Badge',theme,state==='reconciled'?'primary-ink':'state-strong');variants.push(n);
 }finish('StatusBadge',variants,'web/src/components/status-badge.tsx. Four domain states and Partial Month. Inconsistent uses a 3px outline; CSS double-border rendering is documented as a Figma approximation.',4);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const tone of ['Neutral','Warning']){
 const n=variant({Theme:theme,Tone:tone},'HORIZONTAL',500);n.paddingLeft=n.paddingRight=14;n.paddingTop=n.paddingBottom=12;n.itemSpacing=12;n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',10);n.fills=[paint(theme,'surface-muted')];n.strokes=[paint(theme,tone==='Warning'?'state-strong':'border')];n.strokeWeight=tone==='Warning'?2:1;
 textProperty(n,txt(n,tone==='Neutral'?'บันทึกข้อมูลแล้ว':'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง','Body',theme,'ink',380),'Message',tone==='Neutral'?'บันทึกข้อมูลแล้ว':'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');btn(n,'ปิด',theme,'Text');variants.push(n);
 }finish('FeedbackBanner',variants,'web/src/components/feedback-banner.tsx. Neutral success/status and warning, dismiss action. CSS double border on Warning is approximated by a heavier outline.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const type of ['Theme','Close','Edit','Pause','Drag']){
 const n=variant({Theme:theme,Type:type});n.resize(44,44);n.primaryAxisSizingMode=n.counterAxisSizingMode='FIXED';n.primaryAxisAlignItems=n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',12);txt(n,({Theme:theme==='Light'?'☀':'☾',Close:'×',Edit:'✎',Pause:'Ⅱ',Drag:'⠿'})[type],'Body',theme);variants.push(n);
 }finish('IconButton',variants,'ui.iconButton and literal glyphs from ThemeControl, Dialog and ExpenseSetupManager. 44 × 44 target.',5);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const kind of ['Fixed','Variable'])for(const state of ['Unconfirmed','Confirmed','Paused']){
 const n=variant({Theme:theme,Kind:kind,State:state});n.paddingLeft=n.paddingRight=13;n.paddingTop=n.paddingBottom=8;n.minHeight=48;n.itemSpacing=9;n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',999);n.fills=[paint(theme,state==='Confirmed'?'primary':'surface')];n.strokes=[paint(theme,state==='Confirmed'?'primary-ink':'state-muted')];n.strokeWeight=1;if(state!=='Confirmed')n.dashPattern=state==='Paused'?[1,3]:[3,3];txt(n,state==='Confirmed'?'✓':'○','Body',theme,state==='Confirmed'?'primary-ink':'ink');textProperty(n,txt(n,kind==='Fixed'?'ค่าเช่า':'ค่าไฟ','Body',theme,state==='Confirmed'?'primary-ink':'ink'),'Name',kind==='Fixed'?'ค่าเช่า':'ค่าไฟ');textProperty(n,txt(n,kind==='Fixed'?'6000.00':state==='Confirmed'?'1200.00':'กรอกยอด','Helper',theme,state==='Confirmed'?'primary-ink':'muted-ink'),'Amount',kind==='Fixed'?'6000.00':state==='Confirmed'?'1200.00':'กรอกยอด');variants.push(n);
 }finish('ExpenseChip',variants,'web/src/components/expense-chips.tsx. Fixed or Variable; confirmed, unconfirmed and paused. Details explain Monthly Spending and never increase it.',3);
}
{
 const icons={Month:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 5h2"/>',History:'<path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2"/>',Profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'};
 for(const [name,paths]of Object.entries(icons)){const n=component('Icon/'+name,'HORIZONTAL');n.resize(20,20);n.primaryAxisSizingMode=n.counterAxisSizingMode='FIXED';const svg=keep(figma.createNodeFromSvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171717" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>'));n.appendChild(svg);svg.findAll(()=>true).forEach(x=>createdNodeIds.push(x.id));page.appendChild(n);n.x=1400;n.y=100+Object.keys(icons).indexOf(name)*64;sets[n.name]=n;}
 const variants=[];for(const theme of ['Light','Dark'])for(const viewport of ['Desktop','Mobile'])for(const active of ['Month','History','Profile']){
 const n=variant({Theme:theme,Viewport:viewport,Active:active},'HORIZONTAL',viewport==='Mobile'?390:372);n.paddingLeft=n.paddingRight=viewport==='Mobile'?12:5;n.paddingTop=n.paddingBottom=viewport==='Mobile'?8:5;n.itemSpacing=4;n.fills=[paint(theme,'surface')];n.strokes=[paint(theme,'border',.6)];n.strokeWeight=1;bind(n,'cornerRadius','radius',viewport==='Mobile'?0:999);n.effectStyleId=ES['Deledger/Card/'+theme].id;
 for(const [key,label]of [['Month','เดือนนี้'],['History','ประวัติ'],['Profile','ข้อมูลส่วนตัว']]){const item=layout('Navigate / '+key,viewport==='Mobile'?'VERTICAL':'HORIZONTAL');item.paddingLeft=item.paddingRight=viewport==='Mobile'?4:18;item.paddingTop=item.paddingBottom=viewport==='Mobile'?6:0;item.minHeight=viewport==='Mobile'?56:44;item.counterAxisAlignItems='CENTER';item.primaryAxisAlignItems='CENTER';item.itemSpacing=viewport==='Mobile'?2:8;bind(item,'cornerRadius','radius',viewport==='Mobile'?14:999);item.fills=active===key?[paint(theme,'primary')]:[];n.appendChild(item);const icon=keep(sets['Icon/'+key].createInstance());item.appendChild(icon);for(const v of icon.findAll(()=>true))if('strokes'in v&&Array.isArray(v.strokes)&&v.strokes.length)v.strokes=[paint(theme,active===key?'primary-ink':'muted-ink')];txt(item,label,viewport==='Mobile'?'Badge':'Compact',theme,active===key?'primary-ink':'muted-ink');if(viewport==='Mobile')fillWidth(item);}
 variants.push(n);
 }finish('Navigation',variants,'web/src/components/navigation.tsx. Desktop pill and fixed mobile bottom navigation at ≤760px. Source SVG paths imported as editable vectors.',3);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const active of ['System','Light','Dark']){
 const n=variant({Theme:theme,Preference:active},'VERTICAL',150);padding(n,6);bind(n,'cornerRadius','radius',12);n.fills=[paint(theme,'surface')];n.strokes=[paint(theme,'border')];n.strokeWeight=1;n.effectStyleId=ES['Deledger/Card/'+theme].id;
 for(const [key,label]of [['System','ตามระบบ'],['Light','สว่าง'],['Dark','มืด']]){const row=layout('Choose theme / '+key,'HORIZONTAL',138);row.paddingLeft=row.paddingRight=8;row.paddingTop=row.paddingBottom=6;row.minHeight=42;row.itemSpacing=8;bind(row,'cornerRadius','radius',8);row.fills=key===active?[paint(theme,'surface-muted')]:[];n.appendChild(row);txt(row,key===active?'✓':' ','Body',theme);txt(row,label,'Body',theme);}
 variants.push(n);
 }finish('ThemeControl',variants,'web/src/components/theme-control.tsx. System, Light and Dark choices. Prototype System uses prepared Light scenario; actual app resolves OS preference.',3);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const kind of ['Fixed','Variable'])for(const paused of ['No','Yes']){
 const n=variant({Theme:theme,Kind:kind,Paused:paused},'HORIZONTAL',1054);n.paddingLeft=n.paddingRight=8;n.paddingTop=n.paddingBottom=13;n.itemSpacing=14;n.counterAxisAlignItems='CENTER';bind(n,'cornerRadius','radius',12);n.strokes=[paint(theme,'border')];n.strokeWeight=1;
 instance(n,sets.IconButton,{Theme:theme,Type:'Drag'});const g=layout('Expense definition','VERTICAL',820);g.itemSpacing=5;n.appendChild(g);textProperty(n,txt(g,kind==='Fixed'?'ค่าเช่า':'ค่าไฟ','Label',theme),'Name',kind==='Fixed'?'ค่าเช่า':'ค่าไฟ');txt(g,(kind==='Fixed'?'Fixed · 6000.00':'Variable · กรอกตอนจ่าย')+(paused==='Yes'?' · พักไว้':''),'Helper',theme,'muted-ink');instance(n,sets.IconButton,{Theme:theme,Type:'Edit'});instance(n,sets.IconButton,{Theme:theme,Type:'Pause'});variants.push(n);
 }finish('ExpenseSetupRow',variants,'web/src/components/expense-setup-manager.tsx. Month-owned definitions, editable names, fixed/variable, paused. Width adapts in screens; drag reorder is documented.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const selected of ['Yes','No'])for(const gap of ['Yes','No']){
 const n=variant({Theme:theme,Selected:selected,Gap:gap},'VERTICAL',152);padding(n,16);n.itemSpacing=6;n.minHeight=96;bind(n,'cornerRadius','radius',18);n.fills=[paint(theme,selected==='Yes'?'primary':'surface')];n.strokes=[paint(theme,selected==='Yes'?'primary-ink':'border')];n.strokeWeight=selected==='Yes'?2:1;if(gap==='Yes')n.dashPattern=[1,3];textProperty(n,txt(n,gap==='Yes'?'ช่วงข้อมูลขาด':'ตุลาคม 2569','Body',theme,selected==='Yes'?'primary-ink':'ink',120),'Month',gap==='Yes'?'ช่วงข้อมูลขาด':'ตุลาคม 2569');textProperty(n,txt(n,gap==='Yes'?'หยุดติดตาม':'กำลังกรอก','Helper',theme,selected==='Yes'?'primary-ink':'muted-ink',120),'Status',gap==='Yes'?'หยุดติดตาม':'กำลังกรอก');variants.push(n);
 }finish('HistoryTab',variants,'web/src/components/history-explorer.tsx. Reporting Month or Tracking Gap; selection preserved by fill and border.',4);
}
return {createdNodeIds,sets:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.id])),componentSets:page.children.filter(n=>n.type==='COMPONENT_SET').map(n=>({id:n.id,name:n.name,variants:n.children.length})),bounds:{width:Math.max(...page.children.map(n=>n.x+n.width)),height:canvasY}};
