const createdNodeIds=[];
const allVars=await figma.variables.getLocalVariablesAsync();
const collections=await figma.variables.getLocalVariableCollectionsAsync();
const geo=collections.find(c=>c.name==='Deledger / Geometry');
const C={};for(const theme of ['Light','Dark']){const c=collections.find(c=>c.name==='Deledger / Color / '+theme);C[theme]=Object.fromEntries(allVars.filter(v=>v.variableCollectionId===c?.id).map(v=>[v.name.replace('color/',''),v]));}
const G=Object.fromEntries(allVars.filter(v=>v.variableCollectionId===geo?.id).map(v=>[v.name,v]));
const TS=Object.fromEntries((await figma.getLocalTextStylesAsync()).map(s=>[s.name,s]));
const ES=Object.fromEntries((await figma.getLocalEffectStylesAsync()).map(s=>[s.name,s]));
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Noto Sans',style})));
await Promise.all(['Regular','Medium','SemiBold','Bold','ExtraBold'].map(style=>figma.loadFontAsync({family:'Noto Sans Thai UI',style})));
await Promise.all(Object.values(TS).map(s=>figma.loadFontAsync(s.fontName)));
const keep=n=>{createdNodeIds.push(n.id);return n;};
function paint(theme,key,opacity=1){return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0},opacity},'color',C[theme][key]);}
function bind(n,prop,kind,value){const v=G[kind+'/'+value];if(v)n.setBoundVariable(prop,v);else n[prop]=value;}
function padding(n,value){for(const p of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])bind(n,p,'spacing',value);}
function layout(name,direction='VERTICAL',width){const n=keep(figma.createAutoLayout(direction));n.name=name;n.fills=[];n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='AUTO';if(width){n.resize(width,100);n.counterAxisSizingMode='FIXED';}return n;}
function txt(parent,value,role='Body',theme='Light',key='ink',width){const n=keep(figma.createText());n.name=role+' / '+value.slice(0,32);const locale=/[\u0e00-\u0e7f]/.test(value)?'Thai':'Latin';const s=TS['Deledger/'+locale+'/'+role]??TS['Deledger/'+locale+'/Body'];n.fontName={family:s.fontName.family,style:s.fontName.style};n.textStyleId=s.id;n.characters=value;n.fills=[paint(theme,key)];if(width){n.textAutoResize='HEIGHT';n.resize(width,Math.max(1,n.height));}else n.textAutoResize='WIDTH_AND_HEIGHT';parent.appendChild(n);return n;}
function fillWidth(n){n.layoutSizingHorizontal='FILL';return n;}
function component(name,direction='VERTICAL',width){const n=keep(figma.createComponent());n.name=name;n.layoutMode=direction;n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode=width?'FIXED':'AUTO';n.fills=[];if(width){n.resize(width,100);n.primaryAxisSizingMode='AUTO';}return n;}
function card(n,theme,width,pad=30,radius=24){n.fills=[paint(theme,'surface')];n.strokes=[paint(theme,'border',.55)];n.strokeWeight=1;bind(n,'cornerRadius','radius',radius);padding(n,pad);n.effectStyleId=ES['Deledger/Card/'+theme].id;if(width){n.resize(width,n.height);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';}return n;}
function divider(parent,theme,width){const n=keep(figma.createRectangle());n.name='Divider';n.resize(width,1);n.fills=[paint(theme,'border')];parent.appendChild(n);return n;}
function textProperty(owner,node,name,value){const key=owner.addComponentProperty(name,'TEXT',value);node.componentPropertyReferences={characters:key};return key;}
function selectVariant(set,props){return set.children.find(n=>n.type==='COMPONENT'&&Object.entries(props).every(([k,v])=>n.variantProperties?.[k]===v))??set.defaultVariant;}
function instance(parent,set,props={},overrides={}){const n=keep(selectVariant(set,props).createInstance());parent.appendChild(n);const defs=set.componentPropertyDefinitions;const values={};for(const [key,value]of Object.entries(overrides)){const real=Object.keys(defs).find(k=>k.split('#')[0]===key);if(real)values[real]=value;}if(Object.keys(values).length)n.setProperties(values);return n;}
const sets=Object.fromEntries(figma.root.children.flatMap(p=>p.children.filter(n=>n.type==='COMPONENT_SET'||n.type==='COMPONENT').map(n=>[n.name,n])));
function btn(parent,label,theme='Light',style='Secondary',size='Regular',state='Default'){return instance(parent,sets['Button/'+style],{Theme:theme,Size:size,State:state},{Label:label});}
function input(parent,label,value,theme='Light',state='Filled',width=420){const n=instance(parent,sets.MoneyField,{Theme:theme,State:state},{Label:label,Value:value});n.resize(width,n.height);return n;}
function badge(parent,theme='Light',state='draft',partial='No'){return instance(parent,sets.StatusBadge,{Theme:theme,State:state,Partial:partial});}
function titleGroup(parent,eyebrow,title,theme='Light',width){const g=layout('Section heading','VERTICAL',width);bind(g,'itemSpacing','spacing',8);parent.appendChild(g);txt(g,eyebrow,'Eyebrow',theme,'muted-ink',width);txt(g,title,'H2',theme,'ink',width);return g;}
