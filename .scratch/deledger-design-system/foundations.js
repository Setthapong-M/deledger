// Executed by Figma MCP in the authenticated Poly file.
const createdNodeIds=[];
const page=figma.root.children[0]; page.name='01 Foundations';
await figma.setCurrentPageAsync(page);
const colors={
 canvas:['#F5F5F4','#1c1c1d'],surface:['#FFFFFF','#272729'],input:['#FFFFFF','#222224'],
 'surface-muted':['#E7E7E5','#343437'],ink:['#171717','#ededee'],'muted-ink':['#626262','#bcbcc2'],
 border:['#B8B8B3','#68686e'],primary:['#B5C69C','#bbcca6'],'primary-ink':['#262626','#24291f'],
 'state-strong':['#262626','#ededee'],'state-muted':['#6B6B6B','#aaaab2'],focus:['#171717','#c8d9b4']
};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
async function createVariableCollection(name,modeNames){
 const collection=figma.variables.createVariableCollection(name);const modeIds={};
 collection.renameMode(collection.modes[0].modeId,modeNames[0]);modeIds[modeNames[0]]=collection.modes[0].modeId;
 for(const n of modeNames.slice(1))modeIds[n]=collection.addMode(n);
 return {collection,modeIds};
}
const existing=await figma.variables.getLocalVariableCollectionsAsync();
if(existing.some(c=>c.name==='Deledger / Primitives'))throw Error('Foundations already exist; inspect before retry');
const prim=await createVariableCollection('Deledger / Primitives',['Value']);
const themeCollections={};for(const theme of ['Light','Dark'])themeCollections[theme]=await createVariableCollection('Deledger / Color / '+theme,[theme]);
const geometry=await createVariableCollection('Deledger / Geometry',['Value']);
const primitives={},variables={};
for(const h of [...new Set(Object.values(colors).flat())]){
 const v=figma.variables.createVariable('hex/'+h.slice(1).toUpperCase(),prim.collection,'COLOR');
 v.scopes=[];v.setValueForMode(prim.modeIds.Value,{...rgb(h),a:1});v.description='Raw value from web/src/app/globals.css';
 primitives[h]=v;
}
for(const theme of ['Light','Dark'])for(const [name,values] of Object.entries(colors)){
 const color=themeCollections[theme];const i=theme==='Light'?0:1;
 const v=figma.variables.createVariable('color/'+name,color.collection,'COLOR');
 v.scopes=name==='border'?['STROKE_COLOR']:name.includes('ink')||name.includes('state')?['TEXT_FILL','STROKE_COLOR']:['FRAME_FILL','SHAPE_FILL','STROKE_COLOR'];
 v.setVariableCodeSyntax('WEB','var(--deledger-'+name+')');
 v.description='web/src/app/globals.css — --deledger-'+name+' ('+theme+')';
 v.setValueForMode(color.modeIds[theme],{type:'VARIABLE_ALIAS',id:primitives[values[i]].id});
 variables[theme+'/'+name]=v;
}
for(const [prefix,values,scopes] of [
 ['spacing',[0,2,4,5,6,7,8,9,10,12,13,14,15,16,18,20,22,24,26,28,30,32],['GAP']],
 ['radius',[8,10,12,14,16,18,20,24,999],['CORNER_RADIUS']],
 ['size',[30,36,44,48,540,620,680,1180,1240],['WIDTH_HEIGHT']]
])for(const value of values){const v=figma.variables.createVariable(prefix+'/'+value,geometry.collection,'FLOAT');v.scopes=scopes;v.setValueForMode(geometry.modeIds.Value,value);v.description='Extracted Tailwind geometry from ui-styles.ts and component source; no extra CSS custom property invented.';v.setVariableCodeSyntax('WEB',value+'px');}
await Promise.all(['Regular','Medium','Semibold','Bold','Heavy'].map(style=>figma.loadFontAsync({family:'SF Pro',style})));
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Noto Sans Thai UI',style})));
const specs=[['Body',16,25.6,'Regular',0],['Helper',14.4,22.32,'Regular',0],['Label',16,25.6,'Semibold',0],['Compact',14.08,22.528,'Semibold',0],['Eyebrow',11.52,18.432,'Heavy',1.4976],['H1 Desktop',44,70.4,'Bold',-1.76],['H1 Mobile',32,51.2,'Bold',-1.28],['H2',23.2,37.12,'Bold',-.928],['Amount Desktop',56,67.2,'Bold',-2.52],['Amount Mobile',35.1,42.12,'Bold',-1.5795],['Metric',21.6,34.56,'Bold',0],['Badge',13.12,20.992,'Bold',0]];
const styles={};
for(const [name,size,lineHeight,weight,tracking] of specs){
 for(const [locale,family,style] of [['Latin','SF Pro',weight],['Thai','Noto Sans Thai UI',({Semibold:'SemiBold',Heavy:'ExtraBold'})[weight]??weight]]){
 const s=figma.createTextStyle();s.name='Deledger/'+locale+'/'+name;s.fontName={family,style};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:lineHeight};s.letterSpacing={unit:'PIXELS',value:tracking};styles[locale+'/'+name]=s.id;
 }}
const effects={};
for(const [name,y,blur,opacity] of [['Light',4,24,.035],['Dark',12,32,.18]]){const s=figma.createEffectStyle();s.name='Deledger/Card/'+name;s.effects=[{type:'DROP_SHADOW',color:{r:name==='Light'?23/255:0,g:name==='Light'?23/255:0,b:name==='Light'?23/255:0,a:opacity},offset:{x:0,y},radius:blur,spread:0,visible:true,blendMode:'NORMAL'}];effects[name]=s.id;}
function text(parent,value,size=16,bold=false){const t=figma.createText();t.fontName={family:'SF Pro',style:bold?'Bold':'Regular'};t.fontSize=size;t.lineHeight={unit:'PERCENT',value:160};t.characters=value;t.fills=[{type:'SOLID',color:rgb('#171717')}];parent.appendChild(t);createdNodeIds.push(t.id);return t;}
function frame(name,w){const n=figma.createAutoLayout('VERTICAL');n.name=name;n.resize(w,100);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.paddingTop=n.paddingBottom=n.paddingLeft=n.paddingRight=40;n.itemSpacing=24;n.fills=[{type:'SOLID',color:rgb('#FFFFFF')}];page.appendChild(n);createdNodeIds.push(n.id);return n;}
const cover=frame('Deledger / Source & Usage',1120);cover.x=120;cover.y=80;
text(cover,'Deledger',48,true);text(cover,'Design system + hi-fi prototype',28,true);
for(const line of ['Extracted from the current working tree · 13 October 2026 · Asia/Bangkok','Source: globals.css, ui-styles.ts and the application components','Open 03 Screens & Prototype → Present → choose Desktop or Mobile','Editable native components, Auto Layout, shared styles and bound variables','Synthetic demo data; prototype actions navigate prepared states.','Typography: system-ui in code. SF Pro for Latin; Noto Sans Thai UI in Figma.','Thai platform fallback is not bundled by the app; exact glyph matching is limited.','Manual Close: only on the last calendar day with complete, coherent inputs.'])text(cover,line,16);
const palette=frame('Color / Light and Dark',1120);palette.x=120;palette.y=cover.y+cover.height+80;
text(palette,'Color foundations',32,true);
for(const [name,values]of Object.entries(colors)){
 const row=figma.createAutoLayout('HORIZONTAL');row.name=name;row.itemSpacing=24;row.fills=[];palette.appendChild(row);createdNodeIds.push(row.id);
 text(row,'--deledger-'+name,16,true).resize(280,26);
 for(let i=0;i<2;i++){const swatch=figma.createAutoLayout('HORIZONTAL');swatch.name=i?'Dark':'Light';swatch.resize(120,42);swatch.primaryAxisSizingMode='FIXED';swatch.counterAxisSizingMode='FIXED';swatch.cornerRadius=10;swatch.fills=[{type:'SOLID',color:rgb(values[i])}];row.appendChild(swatch);createdNodeIds.push(swatch.id);text(row,values[i].toUpperCase(),14);}
}
const typography=frame('Typography & Geometry',1120);typography.x=1320;typography.y=80;
text(typography,'Typography',32,true);
for(const [name,size,lineHeight,weight,tracking]of specs){const t=text(typography,name+' · '+size+'px / '+lineHeight.toFixed(2)+'px',Math.min(size,44),weight!=='Regular');t.letterSpacing={unit:'PIXELS',value:Math.max(-1,tracking)};}
text(typography,'Spacing: '+[4,8,12,16,18,20,24,28,30,32].join(' · '),16);
text(typography,'Radius: 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · pill',16);
text(typography,'Controls: 44px target; inputs and chips: 48px minimum',16);
text(typography,'Mobile ≤760px · Tablet ≤900px · Main max 1180px',16);
const components=figma.createPage();components.name='02 Components';createdNodeIds.push(components.id);
const screens=figma.createPage();screens.name='03 Screens & Prototype';createdNodeIds.push(screens.id);
return {createdNodeIds,mutatedNodeIds:[page.id],pages:{foundations:page.id,components:components.id,screens:screens.id},collections:{primitives:prim.collection.id,light:themeCollections.Light.collection.id,dark:themeCollections.Dark.collection.id,geometry:geometry.collection.id},modes:{Light:themeCollections.Light.modeIds.Light,Dark:themeCollections.Dark.modeIds.Dark},variables:Object.fromEntries(Object.entries(variables).map(([k,v])=>[k,v.id])),styles,effects,frames:[cover.id,palette.id,typography.id],counts:{colors:Object.keys(colors).length,primitives:Object.keys(primitives).length,textStyles:Object.keys(styles).length}};
