const page=figma.root.children.find(p=>p.name==='02 Components');await figma.setCurrentPageAsync(page);
let canvasY=Math.max(...page.children.map(n=>n.y+n.height))+120;
function variant(props,direction='VERTICAL',width){return component(Object.entries(props).map(([k,v])=>k+'='+v).join(', '),direction,width);}
function finish(name,variants,description,cols=2){if(sets[name])throw Error(name+' already exists');const set=keep(figma.combineAsVariants(variants,page));set.name=name;set.description=description;const w=Math.max(...variants.map(n=>n.width)),h=Math.max(...variants.map(n=>n.height));variants.forEach((n,i)=>{n.x=32+(i%cols)*(w+24);n.y=64+Math.floor(i/cols)*(h+24);});set.resize(cols*(w+24)+40,Math.ceil(variants.length/cols)*(h+24)+80);set.x=120;set.y=canvasY;canvasY+=set.height+120;sets[name]=set;return set;}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const viewport of ['Desktop','Mobile'])for(const state of ['Draft','Reconciled']){
 const mobile=viewport==='Mobile',w=mobile?350:591,pad=mobile?20:30,inner=w-pad*2-2;
 const n=variant({Theme:theme,Viewport:viewport,State:state},'VERTICAL',w);card(n,theme,w,pad,mobile?20:24);n.itemSpacing=24;
 const heading=layout('Summary heading',mobile?'VERTICAL':'HORIZONTAL',inner);heading.itemSpacing=mobile?8:12;n.appendChild(heading);titleGroup(heading,'ภาพรวมของเดือน','ตุลาคม 2569',theme,mobile?inner:220);badge(heading,theme,state==='Draft'?'draft':'reconciled','Yes');
 const hero=layout('Spending','VERTICAL',inner);padding(hero,24);hero.itemSpacing=8;hero.fills=[paint(theme,'primary')];bind(hero,'cornerRadius','radius',18);n.appendChild(hero);
 const line=layout('Spending label','HORIZONTAL',inner-48);line.primaryAxisAlignItems='SPACE_BETWEEN';hero.appendChild(line);txt(line,state==='Draft'?'รายจ่ายโดยประมาณ':'รายจ่ายทั้งเดือน','Label',theme,'primary-ink');txt(line,'บาท','Helper',theme,'primary-ink');
 textProperty(n,txt(hero,'35,000.00',mobile?'Amount Mobile':'Amount Desktop',theme,'primary-ink',inner-48),'Spending','35,000.00');
 txt(hero,state==='Draft'?'อ้างอิง Snapshot ระหว่างเดือน ยังไม่ใช่ยอดสรุปจากยอดปลาย':'คำนวณจากยอดปลายที่ยืนยันแล้ว','Helper',theme,'primary-ink',inner-48);
 const metrics=layout('Summary inputs','HORIZONTAL',inner);metrics.itemSpacing=mobile?10:16;n.appendChild(metrics);
 for(const [label,value,key]of [['ยอดตั้งต้น','20,000.00','Opening'],['รายรับ','30,000.00','Income'],['ยอดปลาย',state==='Draft'?'—':'15,000.00','Ending']]){const g=layout(key,'VERTICAL',(inner-32)/3);g.itemSpacing=6;metrics.appendChild(g);txt(g,label,'Helper',theme,'muted-ink');textProperty(n,txt(g,value,mobile?'Label':'Metric',theme,'ink',(inner-32)/3),key,value);}
 divider(n,theme,inner);txt(n,'▸  ดูวิธีคำนวณ','Compact',theme,'ink',inner).name='Calculation toggle';
 txt(n,'เริ่มติดตามตั้งแต่ 13 ต.ค. 2569 เดือนก่อนหน้านี้จึงไม่รวมในช่วงนี้','Helper',theme,'muted-ink',inner);
 variants.push(n);
 }finish('MonthSummary',variants,'web/src/components/month-summary.tsx. Explicitly separates provisional Snapshot estimates and confirmed Ending Balance totals. Summary inputs and amount are TEXT properties.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const viewport of ['Desktop','Mobile'])for(const lifecycle of ['Open','CloseReady','Closed']){
 const mobile=viewport==='Mobile',w=mobile?350:501,pad=mobile?20:30,inner=w-pad*2-2;
 const n=variant({Theme:theme,Viewport:viewport,Lifecycle:lifecycle},'VERTICAL',w);card(n,theme,w,pad,mobile?20:24);n.itemSpacing=24;titleGroup(n,'อัปเดตทีละนิด','ข้อมูลของเดือนนี้',theme,inner);
 if(lifecycle==='Closed')txt(n,'ปิดเดือนแล้ว','Label',theme,'muted-ink');
 const rows=[['รายรับ','30,000.00','Income'],['Snapshot ระหว่างเดือน','15,000.00 · 13 ต.ค. 2569','Snapshot'],['รายละเอียดที่ยืนยันแล้ว','0.00','Details'],['ยอดปลาย',lifecycle==='Open'?'—':'15,000.00','Ending']];
 const list=layout('Monthly evidence','VERTICAL',inner);list.itemSpacing=0;n.appendChild(list);
 for(let i=0;i<rows.length;i++){divider(list,theme,inner);const row=layout('Timeline / '+rows[i][2],'HORIZONTAL',inner);row.minHeight=68;row.itemSpacing=12;row.counterAxisAlignItems='CENTER';list.appendChild(row);const num=layout('Step '+(i+1),'HORIZONTAL');num.resize(30,30);num.primaryAxisSizingMode=num.counterAxisSizingMode='FIXED';num.counterAxisAlignItems=num.primaryAxisAlignItems='CENTER';num.cornerRadius=999;num.strokes=[paint(theme,'border')];num.strokeWeight=1;row.appendChild(num);txt(num,''+(i+1),'Helper',theme,'muted-ink');const g=layout('Value','VERTICAL',inner-42-(i===2?0:70));g.itemSpacing=4;row.appendChild(g);txt(g,rows[i][0],'Label',theme,'ink',g.width);textProperty(n,txt(g,rows[i][1],'Helper',theme,'muted-ink',g.width),rows[i][2],rows[i][1]);if(i!==2){const b=btn(row,i===1?'บันทึก':'แก้ไข',theme,'Secondary','Compact');b.name='Action / '+rows[i][2];}}
 if(lifecycle==='CloseReady'){divider(n,theme,inner);txt(n,'ข้อมูลครบแล้ว ปิดเดือนในวันสุดท้ายได้','Helper',theme,'muted-ink',inner);btn(n,'ปิดเดือน',theme,'Primary').name='Action / Close';}
 else if(lifecycle==='Open')txt(n,'ระบบจะปิดเดือนให้อัตโนมัติเมื่อผ่านวันสุดท้าย หรือคุณปิดเองได้เมื่อข้อมูลครบ','Helper',theme,'muted-ink',inner);
 variants.push(n);
 }finish('MonthTimeline',variants,'web/src/components/month-timeline.tsx. Manual Close is exposed only in CloseReady, a last-calendar-day scenario. Closed Months remain correctable.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const viewport of ['Desktop','Mobile'])for(const kind of ['Income','Snapshot','Ending']){
 const mobile=viewport==='Mobile',w=mobile?366:540,pad=mobile?22:28,inner=w-2*pad-2;
 const n=variant({Theme:theme,Viewport:viewport,Kind:kind},'VERTICAL',w);card(n,theme,w,pad,24);n.itemSpacing=26;
 const h=layout('Dialog heading','HORIZONTAL',inner);h.primaryAxisAlignItems='SPACE_BETWEEN';h.counterAxisAlignItems='MIN';n.appendChild(h);txt(h,({Income:'แก้รายรับ',Snapshot:'บันทึก Snapshot',Ending:'บันทึกยอดปลาย'})[kind],'H2',theme,'ink',inner-60);instance(h,sets.IconButton,{Theme:theme,Type:'Close'}).name='Action / Dismiss';
 input(n,'ยอดเงิน',kind==='Income'?'30000':'15000',theme,'Filled',inner).name='Amount field';
 if(kind==='Snapshot')input(n,'วันที่เห็นยอด','13/10/2026',theme,'Filled',inner).name='Date field';
 const a=layout('Dialog actions','HORIZONTAL',inner);a.primaryAxisAlignItems='MAX';a.itemSpacing=10;n.appendChild(a);btn(a,'ยกเลิก',theme).name='Action / Dismiss';btn(a,'บันทึก',theme,'Primary').name='Action / Save';variants.push(n);
 }finish('BalanceDialog',variants,'web/src/components/balance-dialog.tsx + dialog.tsx. Native editable forms, 540px desktop max width, 22px mobile padding.',3);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const kind of ['Fixed','Variable']){
 const n=variant({Theme:theme,Kind:kind},'VERTICAL',484);n.itemSpacing=12;txt(n,'ประเภท','Label',theme);
 for(const [k,label]of [['Fixed','Fixed — มียอดประจำ'],['Variable','Variable — กรอกยอดเมื่อจ่าย']]){const row=layout('Choose / '+k,'HORIZONTAL',484);row.minHeight=44;row.paddingLeft=row.paddingRight=12;row.paddingTop=row.paddingBottom=9;row.itemSpacing=10;bind(row,'cornerRadius','radius',10);row.strokes=[paint(theme,'border')];row.strokeWeight=1;n.appendChild(row);txt(row,kind===k?'◉':'○','Body',theme,'primary-ink');txt(row,label,'Body',theme);}
 variants.push(n);
 }finish('ChoiceField',variants,'ui.choiceField + expense-setup-dialog.tsx. Native radio selection specimen, Fixed/Variable.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const kind of ['Fixed','Variable'])for(const editing of ['No','Yes']){
 const n=variant({Theme:theme,Kind:kind,Editing:editing},'VERTICAL',540);card(n,theme,540,28,24);n.itemSpacing=18;
 const head=layout('Setup dialog heading','HORIZONTAL',482);head.primaryAxisAlignItems='SPACE_BETWEEN';n.appendChild(head);const group=layout('Heading text','VERTICAL',422);head.appendChild(group);txt(group,editing==='Yes'?'แก้รายการรายจ่ายประจำ':'เพิ่มรายการรายจ่ายประจำ','H2',theme,'ink',422);txt(group,'รายการนี้เป็น snapshot ของเดือนปัจจุบัน','Body',theme,'muted-ink',422);instance(head,sets.IconButton,{Theme:theme,Type:'Close'}).name='Action / Dismiss';
 input(n,'รายละเอียดรายจ่าย',kind==='Fixed'?'ค่าเช่า':'ค่าไฟ',theme,'Filled',482);instance(n,sets.ChoiceField,{Theme:theme,Kind:kind});if(kind==='Fixed')input(n,'ยอดประจำ','6000',theme,'Filled',482);
 const a=layout('Dialog actions','HORIZONTAL',482);a.primaryAxisAlignItems='MAX';a.itemSpacing=10;n.appendChild(a);btn(a,'ยกเลิก',theme).name='Action / Dismiss';btn(a,'บันทึกรายการ',theme,'Primary').name='Action / Save';variants.push(n);
 }finish('ExpenseSetupDialog',variants,'web/src/components/expense-setup-dialog.tsx. Fixed amount shown conditionally; editable name and amount properties are inherited from MoneyField.',2);
}
{
 const variants=[];for(const theme of ['Light','Dark'])for(const viewport of ['Desktop','Mobile']){
 const n=variant({Theme:theme,Viewport:viewport},'VERTICAL',viewport==='Mobile'?350:591);card(n,theme,n.width,viewport==='Mobile'?20:30,viewport==='Mobile'?20:24);n.itemSpacing=24;txt(n,'Card content','Body',theme);variants.push(n);
 }finish('Card',variants,'ui.card: 24px desktop radius, 20px mobile; clamp(20px,3vw,30px) padding; source theme shadow.',2);
}
return {createdNodeIds,sets:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.id])),componentSets:page.children.filter(n=>n.type==='COMPONENT_SET').map(n=>({name:n.name,id:n.id,variants:n.children.length})),height:canvasY};
