"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = { r:"fnp_r4", c:"fnp_c3", p:"fnp_p3", g:"fnp_g1", t:"fnp_theme" };
const load = k => { try { const v = JSON.parse(localStorage.getItem(k)||"null"); return v || []; } catch { return []; } };
const save = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ─── Unit conversion ──────────────────────────────────────────────────────────
const TO_G={g:1,kg:1000,oz:28.35,lb:453.59};
const TO_ML={ml:1,L:1000,tsp:4.93,tbsp:14.79,cup:236.59,"fl oz":29.57};
function pickBest(base,prefs,map){let b=prefs[0];for(const u of prefs){if(!map[u])continue;const v=base/map[u];if(v>=0.1&&v<1000){b=u;break;}}return{unit:b,amount:base/map[b]};}
function convertIng(ing,sys,scale){
  const sc=ing.amount*scale;
  if(!ing.unit||sc===0||sys==="original")return{...ing,amount:sc};
  if(TO_G[ing.unit]){const g=sc*TO_G[ing.unit];const{unit,amount}=pickBest(g,sys==="metric"?["g","kg"]:["oz","lb"],TO_G);return{...ing,amount,unit};}
  if(TO_ML[ing.unit]){const ml=sc*TO_ML[ing.unit];const{unit,amount}=pickBest(ml,sys==="metric"?["ml","L","tsp","tbsp"]:["fl oz","cup","tsp","tbsp"],TO_ML);return{...ing,amount,unit};}
  return{...ing,amount:sc};
}
function fmtN(n){
  if(!n||n===0)return"";
  const fr=[[1/8,"⅛"],[1/4,"¼"],[1/3,"⅓"],[1/2,"½"],[2/3,"⅔"],[3/4,"¾"]];
  for(const[v,s]of fr)if(Math.abs(n-v)<0.04)return s;
  const w=Math.floor(n),r=n-w;
  for(const[v,s]of fr)if(Math.abs(r-v)<0.04)return w>0?`${w} ${s}`:s;
  if(n>=10)return Math.round(n).toString();
  return parseFloat(n.toFixed(1)).toString();
}
function fmtIng(ing,sys,scale){const c=convertIng(ing,sys,scale);return`${fmtN(c.amount)}${c.unit?" "+c.unit:""} ${c.name}`.trim();}

// ─── Timer helpers ────────────────────────────────────────────────────────────
function parseTimeSecs(str){
  if(!str)return 0;
  const s=str.toLowerCase();let total=0;
  const h=s.match(/(\d+)\s*h/),m=s.match(/(\d+)\s*m/),sec=s.match(/(\d+)\s*s(?!e)/);
  if(h)total+=parseInt(h[1])*3600;if(m)total+=parseInt(m[1])*60;if(sec)total+=parseInt(sec[1]);
  if(!h&&!m&&!sec){const n=parseInt(s);if(n)total=n*60;}
  return total;
}
function fmtTime(secs){const m=Math.floor(secs/60),s=secs%60;return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}

// ─── Ingredient aggregation ───────────────────────────────────────────────────
function parseIngText(text){
  const ua={grams:"g",gram:"g",g:"g",kg:"kg",oz:"oz",ounce:"oz",ounces:"oz",lb:"lb",pound:"lb",pounds:"lb",lbs:"lb",ml:"ml",millilitre:"ml",millilitres:"ml",l:"L",litre:"L",litres:"L",liter:"L",liters:"L",tsp:"tsp",teaspoon:"tsp",teaspoons:"tsp",tbsp:"tbsp",tablespoon:"tbsp",tablespoons:"tbsp",cup:"cup",cups:"cup","fl oz":"fl oz"};
  const m=text.trim().match(/^([⅛¼⅓½⅔¾]|\d+(?:[./]\d+)?(?:\s*[⅛¼⅓½⅔¾])?)\s*([a-zA-Z]+(?:\s+oz)?)?\s+(.+)$/);
  if(!m)return{amount:0,unit:null,name:text.trim()};
  const rawAmt=m[1];let amount=0;
  const frMap={"⅛":1/8,"¼":1/4,"⅓":1/3,"½":1/2,"⅔":2/3,"¾":3/4};
  if(frMap[rawAmt])amount=frMap[rawAmt];
  else if(rawAmt.includes("/"))amount=parseFloat(rawAmt.split("/")[0])/parseFloat(rawAmt.split("/")[1]);
  else amount=parseFloat(rawAmt)||0;
  const rawUnit=(m[2]||"").toLowerCase().trim();const unit=ua[rawUnit]||null;
  const name=unit?m[3].trim():(m[2]?m[2]+" "+m[3]:m[3]).trim();
  return{amount,unit:unit||null,name};
}
function aggregateItems(items){
  const groups=new Map();
  for(const item of items){
    const{amount,unit,name}=parseIngText(item.text);
    const key=`${name.toLowerCase()}||${unit||"none"}`;
    if(groups.has(key)){const g=groups.get(key);g.amount+=amount;g.items.push(item);}
    else groups.set(key,{amount,unit,name,items:[item]});
  }
  const result=[];
  for(const[,g]of groups){
    const d=g.amount===0?g.name:g.unit?`${fmtN(g.amount)} ${g.unit} ${g.name}`:`${fmtN(g.amount)} ${g.name}`;
    const recipes=[...new Set(g.items.map(i=>i.recipe))].join(", ");
    result.push({id:g.items[0].id,text:d.trim(),recipe:recipes,checked:false});
  }
  return result;
}

// ─── Global modal back-button registry ───────────────────────────────────────
let _closeModal = null;

// ─── Tag colours ──────────────────────────────────────────────────────────────
const TPAL={breakfast:["#FEF9C3","#854D0E"],lunch:["#DCFCE7","#166534"],dinner:["#EDE9FE","#5B21B6"],dessert:["#FCE7F3","#9D174D"],snack:["#D1FAE5","#065F46"],vegetarian:["#DCFCE7","#14532D"],vegan:["#BBF7D0","#14532D"],chicken:["#FEF3C7","#92400E"],pasta:["#FEE2E2","#991B1B"],soup:["#D1FAE5","#065F46"],beef:["#FEE2E2","#991B1B"],fish:["#DBEAFE","#1E40AF"],salad:["#BBFBD0","#14532D"],quick:["#EDE9FE","#4C1D95"],seafood:["#DBEAFE","#1E40AF"]};
const tb=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][0]:"#EBF3EC";};
const tf=t=>{const k=Object.keys(TPAL).find(k=>(t||"").toLowerCase().includes(k));return k?TPAL[k][1]:"#1A2E1E";};
const CAT_COLORS=["#3A5E42","#8C5E2A","#2A5E8C","#5E2A2A","#2A5E5E","#5E2A5E","#4A6E1A","#8C6E1A"];
const MEALS=["Breakfast","Lunch","Dinner","Snack"];
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Chip({label,sm,onRemove}){
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,background:tb(label),color:tf(label),borderRadius:20,fontSize:sm?10:11,padding:sm?"1px 8px":"3px 10px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>
      {label}{onRemove&&<span onClick={e=>{e.stopPropagation();onRemove();}} style={{cursor:"pointer",opacity:.6,fontSize:12,lineHeight:1}}>×</span>}
    </span>
  );
}

function Logo({size=34}){
  return(
    <img src="/icons/icon-512.png" width={size} height={size} alt="Fork n Pantry" style={{borderRadius:"50%",display:"block",objectFit:"cover"}}/>
  );
}

// ─── Image proxy helper ───────────────────────────────────────────────────────
function pImg(url){
  if(!url||url.startsWith("data:")||url.startsWith("/"))return url;
  return`/api/img?url=${encodeURIComponent(url)}`;
}

// ─── Recipe image ─────────────────────────────────────────────────────────────
function RImg({recipe,style:st={},className=""}){
  const[err,setErr]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const src=recipe?.ogImage?pImg(recipe.ogImage):null;
  useEffect(()=>{setErr(false);setLoaded(false);},[recipe?.ogImage]);
  if(src&&!err) return(
    <div style={{position:"relative",overflow:"hidden",...st}} className={className}>
      {!loaded&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 30% 30%,${tb(recipe.tags?.[0])},var(--parchment))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"min(42px,38%)"}}>{recipe.emoji||"🍽️"}</div>}
      <img src={src} alt="" onError={()=>setErr(true)} onLoad={()=>setLoaded(true)}
        style={{width:"100%",height:"100%",objectFit:"cover",transition:"opacity .4s",opacity:loaded?1:0,display:"block"}}/>
    </div>
  );
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 30% 30%,${tb(recipe?.tags?.[0])},var(--parchment) 70%)`,fontSize:"min(42px,38%)",overflow:"hidden",...st}} className={className}>
      {recipe?.emoji||"🍽️"}
    </div>
  );
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function Sheet({children,onClose,tall}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.6)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:400,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:tall?"94vh":"88vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(15,24,17,.2)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0",flexShrink:0}}/>
        <div style={{overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Nutrition ring ───────────────────────────────────────────────────────────
function NutritionRing({nutrition,servings,base}){
  if(!nutrition?.calories)return null;
  const scale=servings/(base||4);
  const cal=Math.round((nutrition.calories||0)*scale);
  const pro=Math.round((nutrition.protein||0)*scale);
  const carb=Math.round((nutrition.carbs||0)*scale);
  const fat=Math.round((nutrition.fat||0)*scale);
  const total=(pro*4)+(carb*4)+(fat*9)||1;
  const proP=(pro*4/total)*100, carbP=(carb*4/total)*100, fatP=(fat*9/total)*100;

  // SVG donut
  const r=42, cx=50, cy=50, circ=2*Math.PI*r;
  const segments=[
    {pct:proP/100,color:"#A78BFA",label:"Protein",val:pro,unit:"g"},
    {pct:carbP/100,color:"#FCD34D",label:"Carbs",val:carb,unit:"g"},
    {pct:fatP/100,color:"#6EE7B7",label:"Fat",val:fat,unit:"g"},
  ];
  let offset=0;
  const arcs=segments.map(seg=>{
    const dash=seg.pct*circ, gap=circ-dash;
    const el=<circle key={seg.label} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} strokeLinecap="round" style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>;
    offset+=seg.pct; return el;
  });

  return(
    <div style={{background:"var(--cream)",borderRadius:"var(--r-lg)",padding:"16px",border:"1px solid var(--sage-lt)",boxShadow:"var(--sh-sm)",marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Nutrition · per serving</div>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
          <svg width="100" height="100" viewBox="0 0 100 100">{arcs}</svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"Lora,serif",fontSize:22,fontWeight:600,color:"var(--forest)",lineHeight:1}}>{cal}</span>
            <span style={{fontSize:10,color:"var(--mist)",fontWeight:600}}>cal</span>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
          {segments.map(seg=>(
            <div key={seg.label} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:seg.color,flexShrink:0}}/>
              <span style={{fontSize:13,color:"var(--ink)",flex:1}}>{seg.label}</span>
              <span style={{fontWeight:700,fontSize:13,color:"var(--forest)"}}>{seg.val}{seg.unit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recipe card — square grid style ─────────────────────────────────────────
function RecipeCard({recipe,onOpen,onDelete,onToggleFav}){
  const glassBtn={background:"rgba(10,18,14,.52)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.18)",color:"rgba(255,255,255,.9)",borderRadius:"50%",width:28,height:28,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,lineHeight:1};
  return(
    <div onClick={()=>onOpen(recipe)} style={{background:"#fff",borderRadius:16,border:"1px solid rgba(0,0,0,0.05)",boxShadow:"0 2px 12px rgba(0,0,0,0.07),0 1px 3px rgba(0,0,0,0.04)",overflow:"hidden",cursor:"pointer",transition:"transform .2s, box-shadow .2s",aspectRatio:"1/1",position:"relative"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 28px rgba(0,0,0,0.13)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.07),0 1px 3px rgba(0,0,0,0.04)";}}>
      <RImg recipe={recipe} style={{width:"100%",height:"100%",position:"absolute",inset:0}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 35%,rgba(10,18,14,.80))"}}/>
      <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${recipe.title}"?`))onDelete(recipe.id);}} style={{...glassBtn,position:"absolute",top:8,right:8}}>×</button>
      {onToggleFav&&<button onClick={e=>{e.stopPropagation();onToggleFav();}} style={{...glassBtn,position:"absolute",top:8,left:8,fontSize:recipe.fav?15:13}}>{recipe.fav?"❤️":"🤍"}</button>}
      {recipe.nutrition?.calories>0&&(
        <div style={{position:"absolute",top:8,left:onToggleFav?44:8,background:"rgba(10,18,14,.52)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.18)",borderRadius:20,padding:"3px 8px",fontSize:10,color:"rgba(255,255,255,.95)",fontWeight:700}}>🔥 {recipe.nutrition.calories}</div>
      )}
      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 10px 10px"}}>
        <div className="serif" style={{fontWeight:600,fontSize:14,color:"#fff",lineHeight:1.2,marginBottom:4,textShadow:"0 1px 4px rgba(0,0,0,.5)"}}>{recipe.title||"Untitled"}</div>
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}
        </div>
      </div>
    </div>
  );
}

// ─── Compact card (for planner/categories) ────────────────────────────────────
function MiniCard({recipe,onOpen,onRemove}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--sage-pale)",cursor:"pointer"}} onClick={()=>onOpen&&onOpen(recipe)}>
      <div style={{width:52,height:52,borderRadius:12,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}>
        <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
          {(recipe.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}
        </div>
      </div>
      {onRemove&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:20,cursor:"pointer",padding:"0 4px",flexShrink:0,lineHeight:1}}>×</button>}
    </div>
  );
}

// ─── Scaler bar ───────────────────────────────────────────────────────────────
function ScalerBar({servings,setServings,base,unit,setUnit}){
  const scale=servings/base;
  return(
    <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"12px 14px",marginBottom:16,border:"1px solid var(--sage-lt)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:13,fontWeight:600,color:"var(--forest)"}}>Servings</span>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setServings(s=>Math.max(1,s-1))} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--sage-lt),var(--sage))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>−</button>
          <span className="serif" style={{fontSize:20,fontWeight:600,color:"var(--forest)",minWidth:26,textAlign:"center"}}>{servings}</span>
          <button onClick={()=>setServings(s=>s+1)} style={{width:30,height:30,borderRadius:"50%",border:"none",background:"linear-gradient(145deg,var(--sage-lt),var(--sage))",color:"var(--forest)",fontSize:17,cursor:"pointer",fontWeight:700,boxShadow:"var(--sh-xs)"}}>+</button>
        </div>
      </div>
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.5)",borderRadius:10,padding:3}}>
        {["original","metric","imperial"].map(u=>(
          <button key={u} onClick={()=>setUnit(u)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"capitalize",background:u===unit?"var(--moss)":"transparent",color:u===unit?"#fff":"var(--mist)",boxShadow:u===unit?"var(--sh-xs)":"none",transition:"all .15s"}}>
            {u==="original"?"Original":u==="metric"?"Metric 🇦🇺":"Imperial 🇺🇸"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Cook Mode ────────────────────────────────────────────────────────────────
const COOK_EMOJIS=[
  {words:["blend","blender","blitz","puree","purée"],emoji:"🫙"},
  {words:["chop","dice","cut","slice","mince","julienne","halve"],emoji:"🔪"},
  {words:["whisk","beat","whip"],emoji:"🥄"},
  {words:["stir","mix","combine","fold","toss"],emoji:"🥣"},
  {words:["bake","oven","roast"],emoji:"🔥"},
  {words:["boil","simmer","poach","blanch"],emoji:"♨️"},
  {words:["fry","sauté","saute","sear","pan"],emoji:"🍳"},
  {words:["grill","barbecue","bbq","char"],emoji:"🔥"},
  {words:["pour","drizzle","add","sprinkle"],emoji:"🫗"},
  {words:["season","salt","pepper","spice"],emoji:"🧂"},
  {words:["wash","rinse","clean"],emoji:"💧"},
  {words:["cool","rest","chill","refrigerate","freeze"],emoji:"❄️"},
  {words:["serve","plate","garnish","dish"],emoji:"🍽️"},
  {words:["squeeze","zest","juice"],emoji:"🍋"},
  {words:["peel","trim","scrub"],emoji:"🥕"},
  {words:["knead","roll","flatten","press"],emoji:"🫓"},
  {words:["marinate","soak","steep"],emoji:"🫙"},
  {words:["grate","shred","crumble"],emoji:"🧀"},
  {words:["drain","strain","sieve","sift"],emoji:"🫙"},
  {words:["taste","check","adjust"],emoji:"🤌"},
];
const EMOJI_POSITIONS=[
  {top:"12%",left:"8%"},{top:"15%",right:"10%"},
  {top:"45%",left:"4%"},{top:"42%",right:"5%"},
  {bottom:"30%",left:"10%"},{bottom:"28%",right:"8%"},
];
function getStepEmojis(text){
  if(!text)return[];
  const lower=text.toLowerCase();
  const found=COOK_EMOJIS.filter(e=>e.words.some(w=>new RegExp(`\\b${w}`).test(lower))).map(e=>e.emoji);
  return[...new Set(found)].slice(0,3);
}

function CookMode({recipe,onClose}){
  const[step,setStep]=useState(0);
  const[ingsOpen,setIngsOpen]=useState(false);
  const steps=recipe.steps||[];
  const ings=recipe.ingredients||[];
  const total=steps.length;
  const wakeLockRef=useRef(null);
  useEffect(()=>{
    (async()=>{try{wakeLockRef.current=await navigator.wakeLock?.request("screen");}catch{}})();
    return()=>{try{wakeLockRef.current?.release();}catch{}};
  },[]);
  if(total===0)return null;
  const pct=Math.round((step/total)*100);
  const hasStr=ings.length>0&&typeof ings[0]==="object";
  const stepEmojis=getStepEmojis(steps[step]);

  return(
    <div style={{position:"fixed",inset:0,background:"#0A1A10",zIndex:700,display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top)",paddingBottom:"calc(24px + env(safe-area-inset-bottom)",overflow:"hidden"}}>

      {/* Background emojis */}
      {stepEmojis.map((em,i)=>(
        <div key={`${step}-${i}`} style={{position:"absolute",fontSize:120,opacity:0.07,userSelect:"none",pointerEvents:"none",lineHeight:1,transition:"opacity .6s",zIndex:0,...EMOJI_POSITIONS[i]}}>
          {em}
        </div>
      ))}

      <button onClick={onClose} style={{position:"absolute",top:"calc(env(safe-area-inset-top)+14px)",right:18,background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:"50%",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>

      {/* Title + progress */}
      <div style={{padding:"18px 60px 14px 20px",flexShrink:0,position:"relative",zIndex:1}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,.55)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{background:"rgba(255,255,255,.18)",borderRadius:4,height:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#7AB89A,#4ADE80)",borderRadius:4,transition:"width .4s"}}/>
        </div>
        <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.45)"}}>{pct}% · Step {step+1} of {total}</div>
      </div>

      {/* Step text */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",textAlign:"center",position:"relative",zIndex:1}}>
        <div className="serif" style={{fontSize:28,fontWeight:600,color:"#FFFFFF",lineHeight:1.6,maxWidth:480,textShadow:"0 2px 16px rgba(0,0,0,.6)"}}>{steps[step]}</div>
      </div>

      {/* Ingredients drawer */}
      {ings.length>0&&(
        <div style={{marginInline:16,marginBottom:12,borderRadius:"var(--r-lg)",overflow:"hidden",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.18)",flexShrink:0,position:"relative",zIndex:1}}>
          <button onClick={()=>setIngsOpen(o=>!o)}
            style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"none",border:"none",cursor:"pointer",color:"#fff"}}>
            <span style={{fontSize:16}}>🥗</span>
            <span style={{flex:1,fontSize:13,fontWeight:700,textAlign:"left"}}>Ingredients</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,.5)",marginRight:4}}>{ings.length} items</span>
            <span style={{fontSize:18,color:"rgba(255,255,255,.6)",transform:ingsOpen?"rotate(180deg)":"none",transition:"transform .2s",display:"inline-block"}}>⌄</span>
          </button>
          {ingsOpen&&(
            <div style={{maxHeight:220,overflowY:"auto",borderTop:"1px solid rgba(255,255,255,.12)",padding:"8px 14px 12px"}}>
              {ings.map((ing,i)=>(
                <div key={i} style={{fontSize:14,color:"rgba(255,255,255,.9)",padding:"6px 0",borderBottom:i<ings.length-1?"1px solid rgba(255,255,255,.08)":"none"}}>
                  · {hasStr?fmtIng(ing,"original",1):(typeof ing==="string"?ing:ing.name||"")}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav buttons */}
      <div style={{padding:"0 24px",display:"flex",gap:14,flexShrink:0,position:"relative",zIndex:1}}>
        <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} style={{flex:1,padding:"15px 0",borderRadius:"var(--r-md)",border:"1.5px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:15,fontWeight:600,cursor:step===0?"default":"pointer",opacity:step===0?0.3:1,transition:"opacity .15s",fontFamily:"var(--font-ui)"}}>← Back</button>
        {step<total-1
          ?<button onClick={()=>setStep(s=>s+1)} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,#3A6B50,#1E3828)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.4)",fontFamily:"var(--font-ui)"}}>Next Step →</button>
          :<button onClick={onClose} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,#7AB89A,#4A9A72)",color:"#0A1A10",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 20px rgba(74,222,128,.25)",fontFamily:"var(--font-ui)"}}>Done! 🎉</button>
        }
      </div>
    </div>
  );
}

// ─── Recipe detail modal ──────────────────────────────────────────────────────
// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({recipe,onSave,onClose}){
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"9px 12px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};
  // Convert ingredients to plain strings for editing
  const ingToStr=ing=>typeof ing==="string"?ing:fmtIng(ing,"original",1);
  const[form,setForm]=useState({
    title:recipe.title||"",
    description:recipe.description||"",
    source:recipe.source||"",
    url:recipe.url||"",
    servings:recipe.servings||4,
    prepTime:recipe.prepTime||"",
    cookTime:recipe.cookTime||"",
    tags:(recipe.tags||[]).join(", "),
    notes:recipe.notes||"",
    ingredientsText:(recipe.ingredients||[]).map(ingToStr).join("\n"),
    stepsText:(recipe.steps||[]).join("\n"),
    emoji:recipe.emoji||"🍽️",
    ogImage:recipe.ogImage||"",
  });

  function handleSave(){
    const updated={
      ...recipe,
      ...form,
      servings:parseInt(form.servings)||4,
      tags:form.tags.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),
      ingredients:form.ingredientsText.split("\n").filter(l=>l.trim()).map(line=>{
        // Try to parse back into structured format
        const m=line.match(/^([⅛¼⅓½⅔¾\d./\s]+)\s+(g|kg|ml|L|tsp|tbsp|cup|oz|lb|fl oz)\s+(.+)$/i);
        if(m) return{amount:parseFloat(m[1])||0,unit:m[2],name:m[3].trim()};
        return{amount:0,unit:null,name:line.trim()};
      }),
      steps:form.stepsText.split("\n").filter(l=>l.trim()),
    };
    onSave(updated);
    onClose();
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"95vh",overflowY:"auto",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,24,17,.25)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0"}}/>
        <div style={{padding:"14px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Edit Recipe</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>Cancel</button>
            <button onClick={handleSave} className="btn-primary" style={{padding:"7px 16px",fontSize:13,borderRadius:20}}>Save ✓</button>
          </div>
        </div>

        <div style={{padding:"0 18px 24px",display:"flex",flexDirection:"column",gap:12}}>
          {/* Title + emoji row */}
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:"0 0 52px"}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Icon</label>
              <input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} style={{...inp,textAlign:"center",fontSize:22,padding:"6px"}}/>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Title *</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp}/>
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Photo URL</label>
            <input value={form.ogImage} onChange={e=>setForm(f=>({...f,ogImage:e.target.value}))} placeholder="https://…" style={inp}/>
            {form.ogImage&&<img src={form.ogImage} onError={e=>e.target.style.display="none"} style={{marginTop:6,width:"100%",height:120,objectFit:"cover",borderRadius:10}}/>}
          </div>

          {/* Description */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Description</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,minHeight:60,resize:"none"}}/>
          </div>

          {/* Meta row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["Servings","servings","number"],["Prep time","prepTime","text"],["Cook time","cookTime","text"]].map(([l,k,t])=>(
              <div key={k}>
                <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
                <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
              </div>
            ))}
          </div>

          {/* Source + URL */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Source","source"],["URL","url"]].map(([l,k])=>(
              <div key={k}>
                <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
                <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Tags (comma separated)</label>
            <input value={form.tags} onChange={e=>setForm(f=>({...f,tags:e.target.value}))} placeholder="chicken, dinner, quick" style={inp}/>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
              {form.tags.split(",").map(t=>t.trim()).filter(Boolean).map(t=><Chip key={t} label={t} sm/>)}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Ingredients (one per line)</label>
            <textarea value={form.ingredientsText} onChange={e=>setForm(f=>({...f,ingredientsText:e.target.value}))}
              placeholder={"2 cup plain flour\n1 tsp salt\n3 large eggs"} style={{...inp,minHeight:140,resize:"vertical",fontFamily:"monospace",fontSize:13,lineHeight:1.7}}/>
          </div>

          {/* Steps */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Method (one step per line)</label>
            <textarea value={form.stepsText} onChange={e=>setForm(f=>({...f,stepsText:e.target.value}))}
              placeholder={"Mix dry ingredients together.\nAdd eggs and butter.\nBake at 180°C for 25 mins."} style={{...inp,minHeight:140,resize:"vertical",lineHeight:1.7}}/>
          </div>

          {/* Notes */}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...inp,minHeight:60,resize:"none"}}/>
          </div>

          <button onClick={handleSave} className="btn-primary" style={{width:"100%",padding:"14px 0",fontSize:15,borderRadius:"var(--r-md)"}}>Save Changes ✓</button>
        </div>
      </div>
    </div>
  );
}

function RecipeModal({recipe,onClose,onUpdate}){
  const[servings,setServings]=useState(null);
  const[unit,setUnit]=useState("original");
  const[editing,setEditing]=useState(false);
  const[cookMode,setCookMode]=useState(false);
  const[checkedIngs,setCheckedIngs]=useState(new Set());
  const[timer,setTimer]=useState(null);
  const timerRef=useRef(null);
  const imgInputRef=useRef(null);

  function handleImgReplace(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>onUpdate({...recipe,ogImage:ev.target.result});
    reader.readAsDataURL(file);
    e.target.value="";
  }

  useEffect(()=>{
    if(recipe){setServings(recipe.servings||4);setEditing(false);setCookMode(false);setCheckedIngs(new Set());setTimer(null);}
  },[recipe?.id]);

  useEffect(()=>{
    if(recipe){ _closeModal=onClose; } else { _closeModal=null; }
    return()=>{ _closeModal=null; };
  },[recipe,onClose]);

  useEffect(()=>{
    if(timer?.running){
      timerRef.current=setInterval(()=>setTimer(t=>{
        if(!t||t.secs<=0){clearInterval(timerRef.current);return t?{...t,secs:0,running:false}:null;}
        return{...t,secs:t.secs-1};
      }),1000);
    } else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[timer?.running]);

  if(!recipe||servings===null)return null;
  if(cookMode)return <CookMode recipe={recipe} onClose={()=>setCookMode(false)}/>;

  const base=recipe.servings||4, scale=servings/base;
  const hasStr=recipe.ingredients?.length>0&&typeof recipe.ingredients[0]==="object";

  function startTimer(label,str){const s=parseTimeSecs(str);if(s){clearInterval(timerRef.current);setTimer({label,total:s,secs:s,running:true});}}
  function toggleIng(i){setCheckedIngs(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}
  const btnGlass={background:"rgba(15,24,17,.5)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer"};
  async function shareRecipe(){
    const text=`${recipe.title}\n\nIngredients:\n${(recipe.ingredients||[]).map(i=>typeof i==="string"?i:fmtIng(i,"original",1)).join("\n")}\n\nMethod:\n${(recipe.steps||[]).map((s,i)=>`${i+1}. ${s}`).join("\n")}`;
    if(navigator.share){await navigator.share({title:recipe.title,text,url:recipe.url||""}).catch(()=>{});}
    else{await navigator.clipboard.writeText(text).catch(()=>{});alert("Copied to clipboard!");}
  }

  return(
    <>
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:500,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"95vh",overflowY:"auto",paddingBottom:"calc(24px + env(safe-area-inset-bottom))",boxShadow:"0 -8px 48px rgba(15,24,17,.25)"}}>
        {/* Hero */}
        <div style={{height:260,position:"relative",flexShrink:0,borderRadius:"24px 24px 0 0",overflow:"hidden"}}>
          <RImg recipe={recipe} style={{width:"100%",height:"100%"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 35%,rgba(15,24,17,.8))"}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 20px 18px"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{(recipe.tags||[]).map(t=><Chip key={t} label={t} sm/>)}</div>
            <h2 className="serif" style={{fontSize:26,fontWeight:600,color:"#fff",lineHeight:1.2,marginBottom:6,textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{recipe.title}</h2>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {recipe.source&&<span style={{fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:600}}>📍 {recipe.source}</span>}
              {recipe.prepTime&&<button onClick={()=>startTimer("Prep",recipe.prepTime)} style={{...btnGlass,borderRadius:20,padding:"3px 10px",fontSize:12,fontFamily:"var(--font-ui)",fontWeight:600}}>⏱ {recipe.prepTime}</button>}
              {recipe.cookTime&&<button onClick={()=>startTimer("Cook",recipe.cookTime)} style={{...btnGlass,borderRadius:20,padding:"3px 10px",fontSize:12,fontFamily:"var(--font-ui)",fontWeight:600}}>🔥 {recipe.cookTime}</button>}
            </div>
          </div>
          <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgReplace} style={{display:"none"}}/>
          <button onClick={onClose} style={{...btnGlass,position:"absolute",top:14,right:14,borderRadius:"50%",width:34,height:34,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          <button onClick={()=>setEditing(true)} style={{...btnGlass,position:"absolute",top:14,right:56,borderRadius:20,padding:"7px 13px",fontSize:12,fontWeight:700}}>✏️ Edit</button>
          <button onClick={shareRecipe} style={{...btnGlass,position:"absolute",top:14,right:118,borderRadius:20,padding:"7px 13px",fontSize:12,fontWeight:700}}>📤 Share</button>
          <button onClick={()=>onUpdate({...recipe,fav:!recipe.fav})} style={{...btnGlass,position:"absolute",top:14,left:14,borderRadius:"50%",width:34,height:34,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{recipe.fav?"❤️":"🤍"}</button>
          <button onClick={()=>imgInputRef.current?.click()} style={{...btnGlass,position:"absolute",bottom:14,right:14,borderRadius:20,padding:"5px 11px",fontSize:12,fontWeight:700}}>📷 Change photo</button>
        </div>

        {/* Timer banner */}
        {timer&&(
          <div style={{background:timer.secs===0?"#FEE2E2":timer.secs<30?"#FEF3C7":"var(--forest)",color:timer.secs===0?"#991B1B":timer.secs<30?"#92400E":"#fff",padding:"11px 18px",display:"flex",alignItems:"center",gap:10,transition:"background .5s"}}>
            <span style={{fontSize:13,fontWeight:600,flex:1}}>{timer.secs===0?"⏰ Time's up!":timer.label+" timer"}</span>
            <span style={{fontFamily:"monospace",fontSize:20,fontWeight:700,letterSpacing:"0.05em",minWidth:52,textAlign:"center"}}>{fmtTime(timer.secs)}</span>
            {timer.secs>0&&<button onClick={()=>setTimer(t=>({...t,running:!t.running}))} style={{background:"rgba(255,255,255,.2)",border:"none",color:"inherit",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{timer.running?"Pause":"Resume"}</button>}
            <button onClick={()=>{clearInterval(timerRef.current);setTimer(null);}} style={{background:"none",border:"none",color:"inherit",fontSize:20,cursor:"pointer",lineHeight:1,opacity:.7}}>×</button>
          </div>
        )}

        <div style={{padding:"18px 20px 0"}}>
          {recipe.url&&<a href={recipe.url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:13,color:"var(--moss)",background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 12px",fontWeight:600,textDecoration:"none",marginBottom:14}}>🔗 View original recipe</a>}
          {recipe.description&&<p style={{color:"var(--bark)",fontSize:14,lineHeight:1.75,marginBottom:16,fontStyle:"italic"}}>{recipe.description}</p>}

          <NutritionRing nutrition={recipe.nutrition} servings={servings} base={base}/>
          {hasStr&&<ScalerBar servings={servings} setServings={setServings} base={base} unit={unit} setUnit={setUnit}/>}

          {recipe.ingredients?.length>0&&<>
            <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:7,borderBottom:"1.5px solid var(--parchment)"}}>
              <h3 className="serif" style={{fontSize:19,fontWeight:600,color:"var(--forest)",flex:1}}>Ingredients</h3>
              <div style={{display:"flex",gap:6}}>
                {checkedIngs.size>0&&<button onClick={()=>setCheckedIngs(new Set())} style={{fontSize:12,color:"var(--mist)",background:"none",border:"none",cursor:"pointer"}}>Reset</button>}
                {checkedIngs.size>0&&<button onClick={()=>{
                  const lines=recipe.ingredients.filter((_,i)=>checkedIngs.has(i)).map(ing=>hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||""));
                  const newItems=lines.map(text=>({id:Date.now().toString()+Math.random(),text,recipe:recipe.title,checked:false}));
                  const existing=JSON.parse(localStorage.getItem(KEYS.g)||"[]");
                  localStorage.setItem(KEYS.g,JSON.stringify([...existing,...newItems]));
                  setCheckedIngs(new Set());
                  alert(`${newItems.length} ingredient${newItems.length!==1?"s":""} added to grocery list`);
                }} className="btn-primary" style={{fontSize:11,padding:"3px 10px",borderRadius:20}}>+ Grocery</button>}
                <button onClick={()=>{
                  const lines=recipe.ingredients.map(ing=>hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||""));
                  const newItems=lines.map(text=>({id:Date.now().toString()+Math.random(),text,recipe:recipe.title,checked:false}));
                  const existing=JSON.parse(localStorage.getItem(KEYS.g)||"[]");
                  localStorage.setItem(KEYS.g,JSON.stringify([...existing,...newItems]));
                  alert(`All ${newItems.length} ingredients added to grocery list`);
                }} className="btn-ghost" style={{fontSize:11,padding:"3px 10px",borderRadius:20}}>+ All</button>
              </div>
            </div>
            <ul style={{listStyle:"none",marginBottom:20}}>
              {recipe.ingredients.map((ing,i)=>{
                const line=hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||"");
                const done=checkedIngs.has(i);
                return(
                  <li key={i} onClick={()=>toggleIng(i)} style={{fontSize:14,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)",display:"flex",gap:12,alignItems:"center",cursor:"pointer",opacity:done?.45:1,transition:"opacity .2s"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${done?"var(--sage)":"var(--mist)"}`,background:done?"var(--sage)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                      {done&&<svg width="10" height="8" viewBox="0 0 12 9"><polyline points="1,5 4,8 11,1" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{textDecoration:done?"line-through":"none",color:done?"var(--mist)":"var(--ink)"}}>{line}</span>
                  </li>
                );
              })}
            </ul>
          </>}

          {recipe.steps?.length>0&&<>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,paddingBottom:7,borderBottom:"1.5px solid var(--parchment)"}}>
              <h3 className="serif" style={{fontSize:19,fontWeight:600,color:"var(--forest)"}}>Method</h3>
              <button onClick={()=>setCookMode(true)} style={{background:"var(--forest)",color:"#fff",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>👨‍🍳 Cook Mode</button>
            </div>
            <ol style={{listStyle:"none",paddingBottom:8}}>
              {recipe.steps.map((step,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:16,lineHeight:1.75,display:"flex",gap:13,alignItems:"flex-start"}}>
                  <span style={{background:"linear-gradient(145deg,var(--moss),var(--forest))",color:"#fff",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:1,boxShadow:"var(--sh-xs)"}}>{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>}
          {recipe.notes&&<p style={{fontSize:13,color:"var(--mist)",fontStyle:"italic",paddingBottom:10,lineHeight:1.65}}>{recipe.notes}</p>}
        </div>
      </div>
    </div>
    {editing&&<EditModal recipe={recipe} onSave={r=>{onUpdate(r);setEditing(false);}} onClose={()=>setEditing(false)}/>}
    </>
  );
}

// ─── Add sheet with photo import ──────────────────────────────────────────────
function AddSheet({onAdd,onClose,prefill="",recipes=[]}){
  const[tab,setTab]=useState(prefill?"paste":"paste");
  const[input,setInput]=useState(prefill);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[dupWarning,setDupWarning]=useState(null);
  const[listening,setListening]=useState(false);
  const[transcript,setTranscript]=useState("");
  const recRef=useRef(null);
  const[form,setForm]=useState({title:"",url:"",source:"",notes:""});
  const fileRef=useRef(null);
  const[imgPreview,setImgPreview]=useState(null);
  const[photoMode,setPhotoMode]=useState("recipe");
  const[nutritionResult,setNutritionResult]=useState(null);
  useEffect(()=>{ if(prefill)parseAndSave({text:prefill}); },[]);

  function checkDuplicate(text){
    if(!text.trim().startsWith("http"))return null;
    const norm=u=>u.replace(/\/$/,"").toLowerCase();
    return recipes.find(r=>r.url&&norm(r.url)===norm(text.trim()))||null;
  }

  async function parseAndSave({text="",imageBase64="",imageMediaType="image/jpeg",force=false}){
    if(!force&&text.trim().startsWith("http")){
      const dup=checkDuplicate(text);
      if(dup){setDupWarning(dup);return;}
    }
    setDupWarning(null);
    setLoading(true);setError("");
    try{
      const body={input:text,imageBase64,imageMediaType};
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const data=await res.json();
      if(!data.ok)throw new Error();
      // If image was uploaded, use it as the recipe image
      const ogImage = data.ogImage || (imageBase64 ? `data:${imageMediaType};base64,${imageBase64}` : "");
      onAdd({id:Date.now().toString(),...data.recipe,ogImage,url:text.startsWith("http")?text:"",savedAt:Date.now()});
      onClose();
    }catch{setError("Couldn't parse — try manual entry.");}
    finally{setLoading(false);}
  }

  async function scanIngredients(base64,mediaType){
    setLoading(true);setError("");setNutritionResult(null);
    try{
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64:base64,imageMediaType:mediaType,mode:"nutrition"})});
      const data=await res.json();
      if(!data.ok)throw new Error();
      setNutritionResult(data);
    }catch{setError("Couldn't scan — try again.");}
    finally{setLoading(false);}
  }

  function handleFile(e){
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const dataUrl=ev.target.result;
      const base64=dataUrl.split(",")[1];
      setImgPreview(dataUrl);
      if(photoMode==="nutrition"){scanIngredients(base64,file.type||"image/jpeg");}
      else{parseAndSave({imageBase64:base64,imageMediaType:file.type||"image/jpeg"});}
    };
    reader.readAsDataURL(file);
  }

  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setError("Voice not supported in this browser.");return;}
    const r=new SR();r.continuous=true;r.interimResults=true;r.lang="en-AU";
    r.onresult=e=>setTranscript(Array.from(e.results).map(r=>r[0].transcript).join(" "));
    r.onerror=()=>{setListening(false);setError("Mic error — check permissions.");};
    r.onend=()=>setListening(false);
    r.start();recRef.current=r;setListening(true);setTranscript("");setError("");
  }

  if(loading) return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"var(--cream)",borderRadius:"var(--r-xl)",padding:"36px 32px",textAlign:"center",boxShadow:"var(--sh-xl)",border:"1px solid rgba(255,255,255,.8)",minWidth:220}}>
        {imgPreview&&<img src={imgPreview} style={{width:80,height:80,objectFit:"cover",borderRadius:12,marginBottom:14}}/>}
        {!imgPreview&&<div style={{fontSize:44,marginBottom:14}}>{photoMode==="nutrition"?"🥦":"🌿"}</div>}
        <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:6}}>{photoMode==="nutrition"?"Scanning ingredients…":"Reading recipe…"}</div>
        <div style={{fontSize:13,color:"var(--mist)"}}>{photoMode==="nutrition"?"AI is analysing ingredients &amp; nutrition":"AI is extracting ingredients &amp; steps"}</div>
      </div>
    </div>
  );

  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"var(--inset)"};
  const tabs=[{id:"paste",icon:"📋",label:"Paste"},{id:"photo",icon:"📷",label:"Photo"},{id:"voice",icon:"🎙️",label:"Voice"},{id:"manual",icon:"✏️",label:"Manual"}];

  return(
    <Sheet onClose={onClose} tall>
      <div style={{padding:"14px 18px 24px"}}>
        <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>Add to Pantry</div>
        <div style={{display:"flex",gap:4,marginBottom:18,background:"rgba(255,255,255,.5)",borderRadius:14,padding:4,border:"1px solid var(--parchment)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===t.id?"var(--cream)":"transparent",color:tab===t.id?"var(--forest)":"var(--mist)",boxShadow:tab===t.id?"var(--sh-xs)":"none",transition:"all .15s"}}>
              {t.icon}<br/><span style={{fontSize:10}}>{t.label}</span>
            </button>
          ))}
        </div>

        {tab==="paste"&&<>
          <textarea value={input} onChange={e=>{setInput(e.target.value);setDupWarning(null);}} placeholder={"Paste a recipe URL or text…\n\nTip: copy a caption from Instagram or TikTok"} style={{...inp,minHeight:110,resize:"none"}}/>
          {dupWarning&&(
            <div style={{background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:12,padding:"10px 13px",fontSize:13,color:"#92400E",marginTop:8}}>
              ⚠️ <strong>"{dupWarning.title}"</strong> is already in your pantry.
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>parseAndSave({text:input,force:true})} style={{flex:1,padding:"7px 0",borderRadius:10,border:"none",background:"#92400E",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Save anyway</button>
                <button onClick={()=>setDupWarning(null)} style={{flex:1,padding:"7px 0",borderRadius:10,border:"1px solid #FCD34D",background:"transparent",color:"#92400E",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          )}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:6,marginBottom:2}}>{error}</div>}
          {!dupWarning&&<button onClick={()=>parseAndSave({text:input})} disabled={!input.trim()} className="btn-primary" style={{width:"100%",padding:"14px 0",marginTop:10,borderRadius:"var(--r-md)",opacity:input.trim()?1:.6}}>Save with AI ✦</button>}
          <div style={{marginTop:10,padding:"10px 13px",background:"var(--sage-pale)",borderRadius:12,fontSize:12,color:"var(--forest)",lineHeight:1.65,border:"1px solid var(--sage-lt)"}}>
            💡 <strong>Recipe sites:</strong> paste the URL directly.<br/><strong>Instagram / TikTok:</strong> copy the post caption and paste here.
          </div>
        </>}

        {tab==="photo"&&<>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
          {/* Mode toggle */}
          <div style={{display:"flex",gap:4,marginBottom:14,background:"rgba(255,255,255,.5)",borderRadius:12,padding:3,border:"1px solid var(--parchment)"}}>
            {[{id:"recipe",label:"📸 Recipe photo"},{id:"nutrition",label:"🥦 Scan ingredients"}].map(m=>(
              <button key={m.id} onClick={()=>{setPhotoMode(m.id);setNutritionResult(null);setError("");}} style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:photoMode===m.id?"var(--cream)":"transparent",color:photoMode===m.id?"var(--forest)":"var(--mist)",boxShadow:photoMode===m.id?"var(--sh-xs)":"none",transition:"all .15s"}}>{m.label}</button>
            ))}
          </div>
          {nutritionResult?(
            <div style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid var(--sage-lt)",padding:16,marginBottom:12}}>
              {imgPreview&&<img src={imgPreview} style={{width:"100%",height:140,objectFit:"cover",borderRadius:10,marginBottom:12}}/>}
              <div className="serif" style={{fontWeight:600,fontSize:17,color:"var(--forest)",marginBottom:6}}>{nutritionResult.summary||"Scan result"}</div>
              {nutritionResult.nutrition&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                  {[["🔥 Calories",nutritionResult.nutrition.calories,"kcal"],["💪 Protein",nutritionResult.nutrition.protein,"g"],["🌾 Carbs",nutritionResult.nutrition.carbs,"g"],["🫒 Fat",nutritionResult.nutrition.fat,"g"]].map(([l,v,u])=>(
                    <div key={l} style={{background:"var(--sage-pale)",borderRadius:10,padding:"8px 10px"}}>
                      <div style={{fontSize:11,color:"var(--mist)",fontWeight:600}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:700,color:"var(--forest)"}}>{v}<span style={{fontSize:11,fontWeight:500}}> {u}</span></div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{fontSize:12,color:"var(--bark)",fontWeight:600,marginBottom:4}}>Identified ingredients:</div>
              <ul style={{listStyle:"disc",paddingLeft:18,fontSize:13,color:"var(--ink)",lineHeight:1.8}}>
                {(nutritionResult.ingredients||[]).map((ing,i)=><li key={i}>{ing}</li>)}
              </ul>
              <button onClick={()=>{setNutritionResult(null);setImgPreview(null);}} style={{marginTop:12,width:"100%",padding:"10px 0",borderRadius:10,border:"1px solid var(--sage-lt)",background:"transparent",color:"var(--mist)",fontSize:13,fontWeight:600,cursor:"pointer"}}>Scan another</button>
            </div>
          ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <button onClick={()=>{ if(fileRef.current){fileRef.current.setAttribute("capture","environment");fileRef.current.click();} }}
              style={{...inp,border:"2px dashed var(--sage-lt)",borderRadius:"var(--r-lg)",padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"var(--sage-pale)",color:"var(--moss)"}}>
              <div style={{fontSize:36,marginBottom:8}}>📸</div>
              <div style={{fontWeight:700,fontSize:15}}>Take a photo</div>
              <div style={{fontSize:13,color:"var(--mist)",marginTop:4}}>{photoMode==="nutrition"?"Point camera at your ingredients or meal":"Point camera at a recipe or cookbook page"}</div>
            </button>
            <button onClick={()=>{ if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();} }}
              style={{...inp,border:"2px dashed var(--sage-lt)",borderRadius:"var(--r-lg)",padding:"22px 20px",textAlign:"center",cursor:"pointer",background:"var(--cream)",color:"var(--moss)"}}>
              <div style={{fontSize:32,marginBottom:6}}>🖼️</div>
              <div style={{fontWeight:700,fontSize:14}}>Choose from library</div>
              <div style={{fontSize:12,color:"var(--mist)",marginTop:3}}>{photoMode==="nutrition"?"Point camera at your food or ingredients":"Point camera at a recipe or cookbook page"}</div>
            </button>
          </div>
          )}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginTop:8}}>{error}</div>}
        </>}

        {tab==="voice"&&<>
          <div style={{textAlign:"center",padding:"20px 0 22px"}}>
            <button onClick={listening?()=>{recRef.current?.stop();setListening(false);}:startVoice}
              style={{width:88,height:88,borderRadius:"50%",border:"none",cursor:"pointer",fontSize:40,display:"inline-flex",alignItems:"center",justifyContent:"center",
                background:listening?"linear-gradient(145deg,#FEE2E2,#FECACA)":"linear-gradient(145deg,var(--sage-pale),var(--sage-lt))",
                boxShadow:listening?"0 0 0 12px rgba(254,202,202,.4),var(--sh-md)":"var(--sh-md)",transition:"all .3s"}}>
              {listening?"⏹":"🎙️"}
            </button>
            <div style={{marginTop:12,fontSize:14,color:listening?"var(--moss)":"var(--mist)",fontWeight:600}}>{listening?"Listening… tap to stop":"Tap to speak a recipe"}</div>
          </div>
          {transcript&&<div style={{...inp,minHeight:60,marginBottom:12,lineHeight:1.65}}>{transcript}</div>}
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          {transcript&&!listening&&<button onClick={()=>parseAndSave({text:transcript})} className="btn-primary" style={{width:"100%",padding:"14px 0",borderRadius:"var(--r-md)"}}>Parse & Save ✦</button>}
        </>}

        {tab==="manual"&&<>
          {[["Title *","title","text"],["URL","url","url"],["Source","source","text"]].map(([l,k,t])=>(
            <div key={k} style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>{l}</label>
              <input type={t} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}/>
            </div>
          ))}
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Notes…" style={{...inp,minHeight:70,resize:"none",marginBottom:12}}/>
          {error&&<div style={{color:"#B91C1C",fontSize:13,marginBottom:8}}>{error}</div>}
          <button onClick={()=>{
            if(!form.title.trim()){setError("Title required.");return;}
            onAdd({id:Date.now().toString(),...form,description:"",ingredients:[],steps:[],tags:[],ogImage:"",emoji:"🍽️",servings:4,savedAt:Date.now()});
            onClose();
          }} className="btn-primary" style={{width:"100%",padding:"14px 0",borderRadius:"var(--r-md)"}}>Save Recipe</button>
        </>}
      </div>
    </Sheet>
  );
}

// ─── RECIPES TAB ──────────────────────────────────────────────────────────────
function RecipesTab({recipes,onAdd,onDelete,onUpdate,sharedPrefill,clearShared}){
  const[search,setSearch]=useState("");
  const[tag,setTag]=useState("");
  const[showFavs,setShowFavs]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[selected,setSelected]=useState(null);
  const[sort,setSort]=useState("newest");
  const[showMake,setShowMake]=useState(false);
  const[makeInput,setMakeInput]=useState("");
  useEffect(()=>{ if(sharedPrefill)setShowAdd(true); },[sharedPrefill]);

  function exportRecipes(){
    const blob=new Blob([JSON.stringify(recipes,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="fork-n-pantry-recipes.json";a.click();URL.revokeObjectURL(a.href);
  }

  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  let filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    const matchQ=!q||r.title?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||r.source?.toLowerCase().includes(q);
    const matchTag=!tag||(r.tags||[]).includes(tag);
    const matchFav=!showFavs||r.fav;
    return matchQ&&matchTag&&matchFav;
  });
  if(sort==="az") filtered=[...filtered].sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  if(sort==="calories") filtered=[...filtered].sort((a,b)=>(a.nutrition?.calories||0)-(b.nutrition?.calories||0));

  // What can I make? — score recipes by ingredient overlap
  const makeResults=makeInput.trim()?recipes.map(r=>{
    const have=makeInput.toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
    const ings=(r.ingredients||[]).map(i=>(typeof i==="string"?i:i.name||"").toLowerCase());
    const hits=have.filter(h=>ings.some(i=>i.includes(h)));
    return{...r,_score:hits.length,_have:hits.length,_total:have.length};
  }).filter(r=>r._score>0).sort((a,b)=>b._score-a._score):[];

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {/* Search bar */}
      <div style={{padding:"14px 16px 0",display:"flex",gap:8}}>
        <div style={{flex:1,position:"relative"}}>
          <svg style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",opacity:.35,pointerEvents:"none"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
            style={{background:"#fff",border:"1.5px solid rgba(0,0,0,0.08)",borderRadius:16,padding:"11px 14px 11px 36px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",transition:"border-color .15s,box-shadow .15s"}}
            onFocus={e=>{e.target.style.borderColor="var(--sage)";e.target.style.boxShadow="0 0 0 3px rgba(74,122,94,.12)";}}
            onBlur={e=>{e.target.style.borderColor="rgba(0,0,0,0.08)";e.target.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}/>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"#fff",border:"1.5px solid rgba(0,0,0,0.08)",borderRadius:14,padding:"11px 10px",fontSize:13,outline:"none",color:"var(--ink)",cursor:"pointer",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <option value="newest">Newest</option>
          <option value="az">A–Z</option>
          <option value="calories">Calories</option>
        </select>
      </div>

      {/* Filter pills row */}
      <div style={{display:"flex",gap:6,padding:"10px 16px 0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {/* Favourites pill */}
        <button onClick={()=>{setShowFavs(f=>!f);setTag("");}} style={{flexShrink:0,background:showFavs?"#E11D48":"var(--cream)",color:showFavs?"#fff":"var(--ink)",border:`1px solid ${showFavs?"#E11D48":"var(--sage-lt)"}`,borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.04em",transition:"all .15s"}}>❤️ Favourites</button>
        {/* What can I make? */}
        <button onClick={()=>setShowMake(true)} style={{flexShrink:0,background:"var(--cream)",color:"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>🥗 What can I make?</button>
        {allTags.map(t=>(
          <button key={t} onClick={()=>{setTag(t===tag?"":t);setShowFavs(false);}} style={{flexShrink:0,background:t===tag?"var(--forest)":"var(--cream)",color:t===tag?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .15s",boxShadow:t===tag?"var(--sh-xs)":"none"}}>{t}</button>
        ))}
        {(tag||showFavs)&&<button onClick={()=>{setTag("");setShowFavs(false);}} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕ Clear</button>}
        {recipes.length>0&&<button onClick={exportRecipes} style={{flexShrink:0,background:"var(--cream)",color:"var(--dust)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>⬇ Export</button>}
      </div>

      {/* List */}
      <div style={{padding:"10px 12px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",paddingTop:70,paddingBottom:40,gridColumn:"1/-1"}}>
            <div style={{width:80,height:80,borderRadius:24,background:"linear-gradient(145deg,var(--sage-pale),var(--cream))",border:"1px solid var(--parchment)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:40,marginBottom:20,boxShadow:"var(--sh-sm)"}}>
              {recipes.length===0?"🫙":showFavs?"❤️":"🔍"}
            </div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>
              {recipes.length===0?"Your pantry is empty":showFavs?"No favourites yet":"Nothing matches"}
            </div>
            <div style={{fontSize:14,color:"var(--dust)",lineHeight:1.8,maxWidth:260,margin:"0 auto"}}>
              {recipes.length===0?"Tap + Add Recipe to save your first.":showFavs?"Tap the ❤️ on any recipe to favourite it.":"Try a different search or clear the filter."}
            </div>
          </div>
        ):filtered.map(r=><RecipeCard key={r.id} recipe={r} onOpen={setSelected} onDelete={onDelete} onToggleFav={()=>onUpdate({...r,fav:!r.fav})}/>)}
      </div>

      {/* FAB */}
      <button onClick={()=>setShowAdd(true)} className="btn-primary"
        style={{position:"fixed",bottom:84,right:16,height:52,paddingInline:20,borderRadius:26,fontSize:15,fontWeight:700,display:"flex",alignItems:"center",gap:8,zIndex:50,boxShadow:"0 4px 20px rgba(26,48,40,0.38),0 2px 6px rgba(26,48,40,0.18)",letterSpacing:"-0.01em"}}>
        <span style={{fontSize:22,lineHeight:1}}>+</span> Add Recipe
      </button>

      {/* What can I make? sheet */}
      {showMake&&(
        <Sheet onClose={()=>setShowMake(false)} tall>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:6}}>What can I make?</div>
            <div style={{fontSize:13,color:"var(--mist)",marginBottom:14}}>Enter ingredients you have — we'll match your recipes.</div>
            <input value={makeInput} onChange={e=>setMakeInput(e.target.value)} placeholder="chicken, garlic, lemon, pasta…"
              style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",marginBottom:14}}/>
            {makeResults.length===0&&makeInput.trim()&&<div style={{textAlign:"center",paddingTop:20,color:"var(--mist)",fontSize:14}}>No matches — try different ingredients.</div>}
            {makeResults.map(r=>(
              <div key={r.id} onClick={()=>{setSelected(r);setShowMake(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                <div style={{width:54,height:54,borderRadius:13,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</div>
                  <div style={{fontSize:12,color:"var(--mist)",marginTop:2}}>{r._have} of {r._total} ingredient{r._total!==1?"s":""} matched</div>
                  <div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap"}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                </div>
                <div style={{background:r._have===r._total?"var(--sage-pale)":"var(--cream)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:r._have===r._total?"var(--moss)":"var(--mist)",flexShrink:0}}>{r._have}/{r._total}</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {showAdd&&<AddSheet onAdd={r=>{onAdd(r);setShowAdd(false);clearShared();}} onClose={()=>{setShowAdd(false);clearShared();}} prefill={sharedPrefill} recipes={recipes}/>}
      <RecipeModal recipe={selected} onClose={()=>setSelected(null)} onUpdate={r=>{onUpdate(r);setSelected(r);}}/>
    </div>
  );
}

// ─── CATEGORIES TAB ───────────────────────────────────────────────────────────
function CategoriesTab({recipes,categories,setCategories,onUpdate}){
  const[showNew,setShowNew]=useState(false);
  const[newName,setNewName]=useState("");
  const[newColor,setNewColor]=useState(CAT_COLORS[0]);
  const[selected,setSelected]=useState(null);
  const[addingTo,setAddingTo]=useState(null);
  const[recipeModal,setRecipeModal]=useState(null);

  function createCat(){if(!newName.trim())return;const u=[...categories,{id:Date.now().toString(),name:newName.trim(),color:newColor,recipeIds:[]}];setCategories(u);save(KEYS.c,u);setNewName("");setShowNew(false);}
  function deleteCat(id){const u=categories.filter(c=>c.id!==id);setCategories(u);save(KEYS.c,u);if(selected===id)setSelected(null);}
  function addToCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),recipeId])]}:c);setCategories(u);save(KEYS.c,u);setAddingTo(null);}
  function removeFromCat(catId,recipeId){const u=categories.map(c=>c.id===catId?{...c,recipeIds:(c.recipeIds||[]).filter(id=>id!==recipeId)}:c);setCategories(u);save(KEYS.c,u);}

  const cat=categories.find(c=>c.id===selected);
  const catRecipes=cat?(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean):[];
  const notInCat=cat?recipes.filter(r=>!(cat.recipeIds||[]).includes(r.id)):[];
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};

  if(selected&&cat) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelected(null)} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>← Back</button>
        <div style={{width:14,height:14,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
        <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)"}}>{cat.name}</span>
        <span style={{fontSize:12,color:"var(--mist)",marginLeft:"auto"}}>{catRecipes.length} recipes</span>
      </div>
      <div style={{padding:"4px 16px"}}>
        {catRecipes.map(r=><MiniCard key={r.id} recipe={r} onOpen={setRecipeModal} onRemove={()=>removeFromCat(cat.id,r.id)}/>)}
        {catRecipes.length===0&&<div style={{textAlign:"center",paddingTop:50,color:"var(--mist)",fontSize:14}}>No recipes yet — add some below</div>}
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <button onClick={()=>setAddingTo(cat.id)} className="btn-ghost" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ Add recipes to {cat.name}</button>
      </div>
      {addingTo&&(
        <Sheet onClose={()=>setAddingTo(null)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:14}}>Add to {cat.name}</div>
            {notInCat.length===0?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",padding:"20px 0"}}>All recipes already in this category.</div>
            :notInCat.map(r=>(
              <div key={r.id} onClick={()=>addToCat(cat.id,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{r.title}</div>
                  <div style={{display:"flex",gap:3,marginTop:2}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                </div>
                <div style={{background:"var(--sage-pale)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--moss)",fontSize:18,fontWeight:700}}>+</div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)} onUpdate={r=>{if(onUpdate)onUpdate(r);setRecipeModal(r);}}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {/* Mosaic grid */}
      <div style={{padding:"12px 16px 0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {categories.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",paddingTop:70}}>
            <div style={{fontSize:52,marginBottom:14}}>📂</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>No categories yet</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.75}}>Create collections like<br/>"Weeknight Dinners" or "Batch Cook"</div>
          </div>
        )}
        {categories.map(cat=>{
          const catRecs=(cat.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean).slice(0,4);
          return(
            <div key={cat.id} onClick={()=>setSelected(cat.id)} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"var(--sh-sm)",overflow:"hidden",cursor:"pointer",transition:"transform .18s, box-shadow .18s",position:"relative"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--sh-sm)";}}>
              {/* 4-photo mosaic */}
              <div style={{height:100,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:1}}>
                {[0,1,2,3].map(i=>(
                  <div key={i} style={{overflow:"hidden",background:i===0?cat.color:"var(--parchment)"}}>
                    {catRecs[i]?<RImg recipe={catRecs[i]} style={{width:"100%",height:"100%"}}/>:<div style={{width:"100%",height:"100%",background:cat.color,opacity:0.15+i*0.05}}/>}
                  </div>
                ))}
              </div>
              <div style={{padding:"10px 12px 12px",position:"relative"}}>
                <div style={{fontWeight:700,fontSize:14,color:"var(--forest)"}}>{cat.name}</div>
                <div style={{fontSize:11,color:"var(--mist)",marginTop:2}}>{(cat.recipeIds||[]).length} recipe{(cat.recipeIds||[]).length!==1?"s":""}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}} style={{position:"absolute",top:8,right:8,background:"rgba(15,24,17,.45)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
          );
        })}
      </div>
      <div style={{padding:"14px 16px 0"}}>
        <button onClick={()=>setShowNew(true)} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ New Category</button>
      </div>
      {showNew&&(
        <Sheet onClose={()=>setShowNew(false)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>New Category</div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Weeknight Dinners" style={{...inp,marginBottom:14}} autoFocus/>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:8}}>Colour</label>
            <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>
              {CAT_COLORS.map(c=><button key={c} onClick={()=>setNewColor(c)} style={{width:36,height:36,borderRadius:"50%",background:c,border:newColor===c?"3px solid var(--forest)":"3px solid transparent",cursor:"pointer",boxShadow:newColor===c?"var(--sh-sm)":"none",transition:"all .15s"}}/>)}
            </div>
            <button onClick={createCat} disabled={!newName.trim()} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:15,borderRadius:"var(--r-md)",opacity:newName.trim()?1:.6}}>Create Category</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ─── PLANNER TAB ──────────────────────────────────────────────────────────────
function PlannerTab({recipes,planner,setPlanner,onUpdate}){
  const[picking,setPicking]=useState(null);
  const[search,setSearch]=useState("");
  const[recipeModal,setRecipeModal]=useState(null);
  const[showGrocery,setShowGrocery]=useState(false);
  const[weekOffset,setWeekOffset]=useState(0);

  const weekKey=weekOffset===0?"":`w${weekOffset}_`;
  function planKey(day,meal){return`${weekKey}${day}_${meal}`;}
  function assign(day,meal,id){const u={...planner,[planKey(day,meal)]:id};setPlanner(u);save(KEYS.p,u);setPicking(null);}
  function clear(day,meal){const u={...planner};delete u[planKey(day,meal)];setPlanner(u);save(KEYS.p,u);}
  function get(day,meal){const id=planner[planKey(day,meal)];return id?recipes.find(r=>r.id===id):null;}
  const weekLabel=weekOffset===0?"This Week":weekOffset===1?"Next Week":weekOffset===-1?"Last Week":`Week ${weekOffset>0?"+":""}${weekOffset}`;

  function buildGroceryList(){
    const planned=DAYS.flatMap(d=>MEALS.map(m=>get(d,m))).filter(Boolean);
    const unique=[...new Map(planned.map(r=>[r.id,r])).values()];
    const raw=[];
    for(const r of unique){
      if(r.ingredients?.length>0){
        for(const ing of r.ingredients){
          const line=typeof ing==="string"?ing:fmtIng(ing,"original",1);
          raw.push({id:`${r.id}_${line}`,text:line,recipe:r.title,checked:false});
        }
      }
    }
    return aggregateItems(raw);
  }

  const searched=search?recipes.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())):recipes;
  const plannedCount=DAYS.flatMap(d=>MEALS.map(m=>get(d,m))).filter(Boolean).length;

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"12px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--sage)",lineHeight:1,padding:"2px 4px"}}>‹</button>
          <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)",minWidth:90,textAlign:"center"}}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--sage)",lineHeight:1,padding:"2px 4px"}}>›</button>
        </div>
        <div style={{display:"flex",gap:8}}>
          {plannedCount>0&&<button onClick={()=>setShowGrocery(true)} className="btn-primary" style={{padding:"7px 13px",fontSize:12,borderRadius:20}}>🛒 Grocery</button>}
          <button onClick={()=>{const u={...planner};DAYS.forEach(d=>MEALS.forEach(m=>{delete u[planKey(d,m)];}));setPlanner(u);save(KEYS.p,u);}} className="btn-ghost" style={{padding:"7px 13px",fontSize:12}}>Clear</button>
        </div>
      </div>

      {/* Day list — ReciMe style */}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
        {DAYS.map(day=>{
          const dayMeals=MEALS.map(meal=>({meal,recipe:get(day,meal)})).filter(m=>m.recipe||true);
          return(
            <div key={day} style={{background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid rgba(255,255,255,.85)",boxShadow:"var(--sh-xs)",overflow:"hidden"}}>
              <div style={{height:3,background:`linear-gradient(90deg,var(--moss),var(--sage))`}}/>
              <div style={{padding:"11px 14px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className="serif" style={{fontWeight:600,fontSize:15,color:"var(--forest)"}}>{day}</span>
                <button onClick={()=>setPicking({day,meal:MEALS[0]})} style={{background:"none",border:"none",color:"var(--sage)",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>+</button>
              </div>
              {MEALS.map(meal=>{
                const r=get(day,meal);
                if(!r) return(
                  <div key={meal} onClick={()=>setPicking({day,meal})} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",cursor:"pointer",borderTop:"1px solid var(--sage-pale)",opacity:.5}}>
                    <div style={{width:36,height:36,borderRadius:8,background:"var(--sage-pale)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>+</div>
                    <div style={{fontSize:12,color:"var(--mist)",fontWeight:500}}>{meal}</div>
                  </div>
                );
                return(
                  <div key={meal} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 14px",borderTop:"1px solid var(--sage-pale)",cursor:"pointer"}} onClick={()=>setRecipeModal(r)}>
                    <div style={{width:44,height:44,borderRadius:10,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--forest)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.title}</div>
                      <Chip label={meal} sm/>
                    </div>
                    <button onClick={e=>{e.stopPropagation();clear(day,meal);}} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Pick recipe sheet */}
      {picking&&(
        <Sheet onClose={()=>setPicking(null)}>
          <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
            <div style={{padding:"14px 18px 12px",flexShrink:0}}>
              <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:12}}>{picking.meal} · {picking.day}</div>
              <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                {MEALS.map(m=><button key={m} onClick={()=>setPicking(p=>({...p,meal:m}))} style={{flexShrink:0,background:picking.meal===m?"var(--forest)":"var(--cream)",color:picking.meal===m?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 13px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase"}}>{m}</button>)}
              </div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
                style={{background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"}}/>
            </div>
            <div style={{overflowY:"auto",padding:"0 16px 20px"}}>
              {searched.map(r=>(
                <div key={r.id} onClick={()=>assign(picking.day,picking.meal,r.id)} style={{display:"flex",alignItems:"center",gap:13,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                  <div style={{width:52,height:52,borderRadius:13,overflow:"hidden",flexShrink:0,boxShadow:"var(--sh-xs)"}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--forest)",lineHeight:1.3}}>{r.title}</div>
                    <div style={{display:"flex",gap:3,marginTop:3}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                  </div>
                  <span style={{color:"var(--sage-lt)",fontSize:22}}>›</span>
                </div>
              ))}
              {searched.length===0&&<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",paddingTop:30}}>No recipes found.</div>}
            </div>
          </div>
        </Sheet>
      )}

      {/* Grocery list sheet */}
      {showGrocery&&<GrocerySheet items={buildGroceryList()} onClose={()=>setShowGrocery(false)} onRefresh={buildGroceryList}/>}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)} onUpdate={r=>{if(onUpdate)onUpdate(r);setRecipeModal(r);}}/>
    </div>
  );
}

// ─── GROCERY LIST ─────────────────────────────────────────────────────────────
function GrocerySheet({items:initItems,onClose,onRefresh}){
  const[items,setItems]=useState(()=>{
    const saved=load(KEYS.g);
    return saved&&saved.length>0?saved:initItems;
  });
  const[manualInput,setManualInput]=useState("");

  function setAndSave(fn){setItems(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(KEYS.g,next);return next;});}
  function toggle(id){setAndSave(is=>is.map(i=>i.id===id?{...i,checked:!i.checked}:i));}
  function remove(id){setAndSave(is=>is.filter(i=>i.id!==id));}
  function addManual(){
    if(!manualInput.trim())return;
    setAndSave(is=>[...is,{id:Date.now().toString()+Math.random(),text:manualInput.trim(),recipe:"Added manually",checked:false}]);
    setManualInput("");
  }
  function refresh(){
    const fresh=onRefresh?onRefresh():initItems;
    setAndSave(fresh);
  }
  function clearChecked(){setAndSave(is=>is.filter(i=>!i.checked));}

  const unchecked=items.filter(i=>!i.checked);
  const checked=items.filter(i=>i.checked);

  const groups={};
  for(const item of unchecked){
    const g=item.recipe||"Other";
    if(!groups[g])groups[g]=[];
    groups[g].push(item);
  }

  return(
    <Sheet onClose={onClose} tall>
      <div style={{padding:"14px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Grocery List</div>
          <span style={{fontSize:12,color:"var(--mist)"}}>{unchecked.length} left</span>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={refresh} className="btn-ghost" style={{fontSize:11,padding:"4px 10px",borderRadius:20,color:"var(--sage)"}}>↺ Refresh from plan</button>
          {checked.length>0&&<button onClick={clearChecked} className="btn-ghost" style={{fontSize:11,padding:"4px 10px",borderRadius:20,color:"var(--dust)"}}>Clear checked</button>}
        </div>

        {/* Add manual item */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={manualInput} onChange={e=>setManualInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addManual()} placeholder="Add item…"
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"9px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          <button onClick={addManual} className="btn-primary" style={{padding:"0 16px",borderRadius:12,fontSize:18}}>+</button>
        </div>

        {/* Grouped items */}
        {Object.entries(groups).map(([recipe,its])=>(
          <div key={recipe} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>{recipe}</div>
            {its.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {item.checked&&<div style={{width:10,height:10,borderRadius:"50%",background:"var(--moss)"}}/>}
                </button>
                <span style={{fontSize:14,color:"var(--ink)",flex:1,lineHeight:1.5}}>{item.text}</span>
                <button onClick={()=>remove(item.id)} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        ))}

        {checked.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--mist)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Got it ✓</div>
            {checked.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)",opacity:.5}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"var(--sage)",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:"#fff"}}/>
                </button>
                <span style={{fontSize:14,color:"var(--mist)",flex:1,textDecoration:"line-through"}}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {items.length===0&&<div style={{textAlign:"center",paddingTop:40,color:"var(--mist)",fontSize:14}}>No items. Add meals to your planner first.</div>}
      </div>
    </Sheet>
  );
}

// ─── GROCERY TAB ──────────────────────────────────────────────────────────────
function GroceryTab(){
  const[items,setItems]=useState(()=>load(KEYS.g));
  const[manualInput,setManualInput]=useState("");

  function setAndSave(fn){setItems(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(KEYS.g,next);return next;});}
  function toggle(id){setAndSave(is=>is.map(i=>i.id===id?{...i,checked:!i.checked}:i));}
  function remove(id){setAndSave(is=>is.filter(i=>i.id!==id));}
  function addManual(){
    if(!manualInput.trim())return;
    setAndSave(is=>[...is,{id:Date.now().toString()+Math.random(),text:manualInput.trim(),recipe:"Added manually",checked:false}]);
    setManualInput("");
  }
  function clearChecked(){setAndSave(is=>is.filter(i=>!i.checked));}
  function clearAll(){if(items.length===0)return;if(confirm("Clear all grocery items?"))setAndSave([]);}
  async function shareList(){
    const text=items.filter(i=>!i.checked).map(i=>i.text).join("\n");
    if(navigator.share){await navigator.share({title:"Grocery List",text}).catch(()=>{});}
    else{await navigator.clipboard.writeText(text).catch(()=>{});alert("Copied to clipboard!");}
  }

  const unchecked=items.filter(i=>!i.checked);
  const checked=items.filter(i=>i.checked);
  const groups={};
  for(const item of unchecked){const g=item.recipe||"Other";if(!groups[g])groups[g]=[];groups[g].push(item);}

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"14px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Grocery List</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:12,color:"var(--mist)"}}>{unchecked.length} left</span>
            <button onClick={shareList} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",color:"var(--moss)"}}>📤 Share</button>
            {checked.length>0&&<button onClick={clearChecked} style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",color:"#991B1B"}}>Clear done</button>}
            {items.length>0&&<button onClick={clearAll} style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",color:"#991B1B"}}>Clear all</button>}
          </div>
        </div>

        <div style={{display:"flex",gap:8,marginTop:12,marginBottom:16}}>
          <input value={manualInput} onChange={e=>setManualInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addManual()} placeholder="Add item…"
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"9px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          <button onClick={addManual} className="btn-primary" style={{padding:"0 16px",borderRadius:12,fontSize:18}}>+</button>
        </div>

        {Object.entries(groups).map(([recipe,its])=>(
          <div key={recipe} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>{recipe}</div>
            {its.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {item.checked&&<div style={{width:10,height:10,borderRadius:"50%",background:"var(--moss)"}}/>}
                </button>
                <span style={{fontSize:14,color:"var(--ink)",flex:1,lineHeight:1.5}}>{item.text}</span>
                <button onClick={()=>remove(item.id)} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        ))}

        {checked.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--mist)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>Got it ✓</div>
            {checked.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)",opacity:.5}}>
                <button onClick={()=>toggle(item.id)} style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"var(--sage)",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:"#fff"}}/>
                </button>
                <span style={{fontSize:14,color:"var(--mist)",flex:1,textDecoration:"line-through"}}>{item.text}</span>
              </div>
            ))}
          </div>
        )}
        {items.length===0&&<div style={{textAlign:"center",paddingTop:60,color:"var(--mist)",fontSize:14}}>No items yet. Add one above or build from the Planner tab.</div>}
      </div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({session,onSignIn,onSignOut,syncStatus}){
  const[dark,setDark]=useState(()=>{try{return localStorage.getItem(KEYS.t)==="dark";}catch{return false;}});
  const[signingIn,setSigningIn]=useState(false);

  function toggleDark(){
    const next=!dark;setDark(next);
    try{
      if(next){localStorage.setItem(KEYS.t,"dark");document.documentElement.setAttribute("data-theme","dark");}
      else{localStorage.removeItem(KEYS.t);document.documentElement.removeAttribute("data-theme");}
    }catch{}
  }

  async function handleSignIn(){
    setSigningIn(true);
    await onSignIn();
    setSigningIn(false);
  }

  const user=session?.user;
  const row={display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid var(--sage-pale)"};
  const label={fontSize:14,fontWeight:600,color:"var(--ink)"};
  const sub={fontSize:12,color:"var(--mist)",marginTop:2};
  const googleIcon=(
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"14px 18px 0"}}>

        {/* Account */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>Account</div>
          {user?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                {user.user_metadata?.avatar_url
                  ?<img src={user.user_metadata.avatar_url} style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                  :<div style={{width:48,height:48,borderRadius:"50%",background:"var(--sage)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:20,fontWeight:700,flexShrink:0}}>{(user.user_metadata?.full_name||user.email||"?")[0].toUpperCase()}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:15,color:"var(--ink)",marginBottom:2}}>{user.user_metadata?.full_name||"Account"}</div>
                  <div style={{fontSize:13,color:"var(--mist)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:syncStatus==="synced"?"#4ADE80":syncStatus==="syncing"?"#FBBF24":"#94A3B8",flexShrink:0}}/>
                <span style={{fontSize:13,color:"var(--mist)"}}>{syncStatus==="synced"?"Recipes synced to cloud":syncStatus==="syncing"?"Syncing…":"Not synced"}</span>
              </div>
              <div style={{marginTop:14}}>
                <button onClick={onSignOut} className="btn-ghost" style={{width:"100%",padding:"12px 0",borderRadius:"var(--r-md)",fontSize:14,fontWeight:600,color:"var(--rose)"}}>Sign out</button>
              </div>
            </>
          ):(
            <>
              <div style={{padding:"16px 0 14px",fontSize:13,color:"var(--charcoal)",lineHeight:1.6}}>Sign in to sync your recipes across all your devices and back them up to the cloud.</div>
              <button onClick={handleSignIn} disabled={signingIn} className="btn-ghost"
                style={{width:"100%",padding:"13px 0",borderRadius:"var(--r-md)",border:"1.5px solid var(--sage-lt)",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:signingIn?"wait":"pointer",opacity:signingIn?0.7:1}}>
                {googleIcon}
                {signingIn?"Redirecting to Google…":"Sign in with Google"}
              </button>
            </>
          )}
        </div>

        {/* Appearance */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>Appearance</div>
          <div style={row}>
            <div>
              <div style={label}>Dark Mode</div>
              <div style={sub}>Easy on the eyes at night</div>
            </div>
            <button onClick={toggleDark} style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",background:dark?"var(--moss)":"var(--mist)",position:"relative",transition:"background .2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:dark?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
            </button>
          </div>
        </div>

        {/* About */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>About</div>
          <div style={row}>
            <div style={label}>App Version</div>
            <span style={{fontSize:13,color:"var(--mist)"}}>Fork n Pantry v1.0</span>
          </div>
          <div style={{marginTop:14,padding:"14px 16px",background:"var(--sage-pale)",borderRadius:"var(--r-md)",border:"1px solid var(--sage-lt)"}}>
            <div className="serif" style={{fontWeight:600,fontSize:16,color:"var(--forest)",marginBottom:6}}>Fork n Pantry</div>
            <div style={{fontSize:13,color:"var(--bark)",lineHeight:1.7}}>Your personal recipe collection — save, organise, and cook from any device. Import recipes from URLs, photos, or voice. Plan your week and build a grocery list automatically.</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── SCAN TAB ─────────────────────────────────────────────────────────────────
function ScanTab({recipes=[],onOpenRecipe}){
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState(()=>{try{const v=localStorage.getItem("fnp_scan");return v?JSON.parse(v):null;}catch{return null;}});
  const[error,setError]=useState("");
  const[imgPreview,setImgPreview]=useState(()=>{try{return localStorage.getItem("fnp_scan_img")||null;}catch{return null;}});
  const fileRef=useRef(null);

  // Score saved recipes by how many scanned ingredients they contain.
  // Uses whole-word matching to avoid "banana" matching "an" from a recipe ingredient.
  function matchedRecipes(){
    if(!result?.ingredients?.length||!recipes.length)return[];
    const have=result.ingredients.map(s=>s.toLowerCase().trim()).filter(s=>s.length>=3);
    return recipes.map(r=>{
      const ings=(r.ingredients||[]).map(i=>(typeof i==="string"?i:i.name||"").toLowerCase());
      const hits=have.filter(h=>{
        const re=new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`);
        return ings.some(i=>re.test(i));
      });
      return{...r,_hits:hits.length};
    }).filter(r=>r._hits>0).sort((a,b)=>b._hits-a._hits).slice(0,5);
  }

  function searchOnline(){
    if(!result?.ingredients?.length)return;
    const q=encodeURIComponent("recipes with "+result.ingredients.slice(0,6).join(", "));
    window.open("https://www.google.com/search?q="+q,"_blank","noopener");
  }

  async function scan(base64,mediaType){
    setLoading(true);setError("");setResult(null);setImgPreview(null);
    try{
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64:base64,imageMediaType:mediaType,mode:"nutrition"})});
      const data=await res.json();
      if(!data.ok)throw new Error();
      setResult(data);
      try{localStorage.setItem("fnp_scan",JSON.stringify(data));}catch{}
    }catch{setError("Couldn't scan — try again.");}
    finally{setLoading(false);}
  }

  function handleFile(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const dataUrl=ev.target.result;
      setImgPreview(dataUrl);
      try{localStorage.setItem("fnp_scan_img",dataUrl);}catch{}
      scan(dataUrl.split(",")[1],file.type||"image/jpeg");
    };
    reader.readAsDataURL(file);
    e.target.value="";
  }

  function addToGrocery(){
    if(!result?.ingredients?.length)return;
    const newItems=result.ingredients.map(text=>({id:Date.now().toString()+Math.random(),text,recipe:result.summary||"Scanned",checked:false}));
    const existing=JSON.parse(localStorage.getItem(KEYS.g)||"[]");
    localStorage.setItem(KEYS.g,JSON.stringify([...existing,...newItems]));
    alert(`${newItems.length} items added to grocery list`);
  }

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"18px 18px 0"}}>
        <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:4}}>Ingredient Scanner</div>
        <div style={{fontSize:13,color:"var(--dust)",marginBottom:20,lineHeight:1.6}}>Take a photo of ingredients or a meal — AI will identify what's there and estimate the nutrition.</div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>

        {!loading&&!result&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <button onClick={()=>{if(fileRef.current){fileRef.current.setAttribute("capture","environment");fileRef.current.click();}}} className="btn-primary"
              style={{width:"100%",padding:"18px 0",borderRadius:"var(--r-lg)",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              📷 Open Camera
            </button>
            <button onClick={()=>{if(fileRef.current){fileRef.current.removeAttribute("capture");fileRef.current.click();}}} className="btn-ghost"
              style={{width:"100%",padding:"16px 0",borderRadius:"var(--r-lg)",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              🖼️ Choose from Library
            </button>
          </div>
        )}

        {loading&&(
          <div style={{textAlign:"center",paddingTop:40}}>
            {imgPreview&&<img src={imgPreview} style={{width:140,height:140,objectFit:"cover",borderRadius:16,marginBottom:18,boxShadow:"var(--sh-md)"}}/>}
            <div style={{fontSize:40,marginBottom:12}}>🔍</div>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:6}}>Scanning…</div>
            <div style={{fontSize:13,color:"var(--dust)"}}>AI is identifying ingredients</div>
          </div>
        )}

        {error&&<div style={{color:"#B91C1C",fontSize:14,marginBottom:16,textAlign:"center"}}>{error}</div>}

        {result&&(
          <div>
            {imgPreview&&<img src={imgPreview} style={{width:"100%",height:180,objectFit:"cover",borderRadius:16,marginBottom:16,boxShadow:"var(--sh-md)"}}/>}
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:12}}>{result.summary||"Scan result"}</div>

            {/* Nutrition grid */}
            {result.nutrition&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {[["🔥","Calories",result.nutrition.calories,"kcal"],["💪","Protein",result.nutrition.protein,"g"],["🌾","Carbs",result.nutrition.carbs,"g"],["🥑","Fat",result.nutrition.fat,"g"]].map(([icon,label,val,unit])=>(
                  <div key={label} style={{background:"var(--cream)",borderRadius:"var(--r-md)",padding:"12px",border:"1px solid var(--sage-lt)",textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                    <div style={{fontWeight:700,fontSize:18,color:"var(--forest)"}}>{val}<span style={{fontSize:11,fontWeight:500,color:"var(--dust)"}}>{unit}</span></div>
                    <div style={{fontSize:11,color:"var(--dust)",fontWeight:600}}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Ingredient list */}
            {result.ingredients?.length>0&&(
              <div style={{background:"var(--cream)",borderRadius:"var(--r-md)",padding:"14px",border:"1px solid var(--sage-lt)",marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>Detected ingredients</div>
                {result.ingredients.map((ing,i)=>(
                  <div key={i} style={{fontSize:14,color:"var(--ink)",padding:"6px 0",borderBottom:i<result.ingredients.length-1?"1px solid var(--sage-pale)":"none"}}>· {ing}</div>
                ))}
              </div>
            )}

            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <button onClick={addToGrocery} className="btn-primary" style={{flex:1,padding:"13px 0",borderRadius:"var(--r-md)",fontSize:14}}>+ Add to Grocery</button>
              <button onClick={()=>{setResult(null);setImgPreview(null);setError("");try{localStorage.removeItem("fnp_scan");localStorage.removeItem("fnp_scan_img");}catch{}}} className="btn-ghost" style={{flex:1,padding:"13px 0",borderRadius:"var(--r-md)",fontSize:14}}>Scan again</button>
            </div>

            {/* Saved recipe matches */}
            {(()=>{const matches=matchedRecipes();return matches.length>0&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>Recipes you could make</div>
                {matches.map(r=>(
                  <button key={r.id} onClick={()=>onOpenRecipe&&onOpenRecipe(r)}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 12px",marginBottom:8,background:"var(--cream)",border:"1px solid var(--sage-lt)",borderRadius:"var(--r-md)",cursor:"pointer",textAlign:"left"}}>
                    {r.ogImage&&<img src={r.ogImage.startsWith("http")?`/api/img?url=${encodeURIComponent(r.ogImage)}`:r.ogImage} style={{width:44,height:44,borderRadius:10,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14,color:"var(--ink)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                      <div style={{fontSize:12,color:"var(--moss)",fontWeight:600}}>{r._hits} ingredient{r._hits!==1?"s":""} matched</div>
                    </div>
                    <span style={{fontSize:18,color:"var(--sage)",flexShrink:0}}>›</span>
                  </button>
                ))}
              </div>
            );})()}

            {/* Search online */}
            <button onClick={searchOnline} className="btn-ghost"
              style={{width:"100%",padding:"13px 0",borderRadius:"var(--r-md)",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
              🔍 Search online for recipes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({tab,setTab}){
  const tabs=[
    {id:"recipes",label:"Recipes",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="13" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"categories",label:"Categories",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <rect x="3" y="13" width="18" height="8" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
      </svg>)},
    {id:"planner",label:"Planner",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M8 2v4M16 2v4M3 9h18" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="8" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="12" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
        <circle cx="16" cy="14" r="1.5" fill={a?"#fff":"var(--mist)"}/>
      </svg>)},
    {id:"scan",label:"Scan",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="13" rx="2.5" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <circle cx="12" cy="13.5" r="3" fill={a?"#fff":"none"} stroke={a?"#fff":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="18" cy="10" r="1" fill={a?"#fff":"var(--mist)"}/>
      </svg>)},
    {id:"grocery",label:"Grocery",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 6h18" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M16 10a4 4 0 01-8 0" stroke={a?"#fff":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>)},
    {id:"settings",label:"Settings",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>)},
  ];
  return(
    <div className="tab-bar" style={{position:"fixed",bottom:0,left:0,right:0,display:"flex",paddingBottom:"env(safe-area-inset-bottom)",zIndex:100}}>
      {tabs.map(t=>{
        const a=tab===t.id;
        return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"11px 0 8px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all .2s",position:"relative"}}>
            <div style={{width:44,height:32,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,background:a?"rgba(45,84,65,.12)":"transparent",transition:"background .2s"}}>
              {t.icon(a)}
            </div>
            <span style={{fontSize:10,fontWeight:700,color:a?"var(--pine)":"var(--silver)",letterSpacing:"0.03em",textTransform:"uppercase",transition:"color .2s"}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Help modal ───────────────────────────────────────────────────────────────
const HELP_SECTIONS=[
  {icon:"📋",title:"Adding Recipes",body:"Tap + Add Recipe on the Recipes tab. Paste a URL from any recipe website and AI will extract everything automatically. You can also take a photo of a cookbook page, paste copied text, or enter a recipe manually."},
  {icon:"🔍",title:"Searching & Filtering",body:"Use the search bar to find recipes by name, tag, or source. Filter by tag using the pills below the search bar. Toggle ❤️ Favourites to see only your saved favourites. Use A–Z or Calories sort to reorder."},
  {icon:"🥗",title:"What Can I Make?",body:"Tap '🥗 What can I make?' on the Recipes tab. Type in ingredients you have on hand separated by commas — the app will score and rank your recipes by how many ingredients match."},
  {icon:"👨‍🍳",title:"Cook Mode",body:"Open any recipe and scroll to the Method section. Tap 'Cook Mode' for a full-screen step-by-step guide with a large font. The screen stays on while you cook. Swipe back or tap × to exit."},
  {icon:"⏱",title:"Timers",body:"Inside a recipe, tap the prep time or cook time chip to start a countdown timer. The timer banner shows at the top of the recipe. Tap Pause/Resume as needed. The banner turns amber when under 30 seconds and red when done."},
  {icon:"🛒",title:"Grocery List",body:"Open any recipe and tap '+ All' under Ingredients to add everything to your list, or tick individual ingredients and tap '+ Grocery' to add just those. The Grocery tab shows your full list. Tap items to check them off. Share the list via the 📤 button."},
  {icon:"📅",title:"Meal Planner",body:"The Planner tab shows a weekly meal grid. Tap any slot to assign a recipe. Use the ‹ › arrows to navigate between weeks. Tap 'Grocery' to build a shopping list from all planned meals automatically."},
  {icon:"📷",title:"Ingredient Scanner",body:"Go to the Scan tab (camera icon). Take a photo of ingredients, a meal, or food packaging. AI will identify what it sees and estimate the total calories, protein, carbs, and fat. Tap '+ Add to Grocery List' to add identified ingredients."},
  {icon:"🗂",title:"Categories",body:"The Categories tab lets you group recipes into custom collections — e.g. 'Weeknight Dinners' or 'Meal Prep'. Create a category, choose a colour, then add recipes to it. Tap a category to browse its recipes."},
  {icon:"📤",title:"Sharing",body:"Open any recipe and tap the 📤 Share button to share the recipe title, ingredients, and method via any app. On the Grocery tab the 📤 button shares your shopping list. Both fall back to clipboard copy if native sharing isn't available."},
  {icon:"💾",title:"Backup & Export",body:"On the Recipes tab, scroll the filter pills to find ⬇ Export. This downloads all your recipes as a JSON file you can keep as a backup or import into another device in future."},
  {icon:"🌙",title:"Dark Mode",body:"Go to Settings (gear icon) and toggle Dark Mode. The theme is saved and applied automatically each time you open the app."},
];

function HelpModal({onClose}){
  const[open,setOpen]=useState(null);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 48px rgba(15,24,17,.25)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0",flexShrink:0}}/>
        <div style={{padding:"14px 20px 10px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Help & Features</div>
            <div style={{fontSize:13,color:"var(--dust)",marginTop:2}}>Tap any topic to learn more</div>
          </div>
          <button onClick={onClose} style={{background:"var(--sage-pale)",border:"none",borderRadius:"50%",width:32,height:32,fontSize:18,cursor:"pointer",color:"var(--forest)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"0 16px 24px"}}>
          {HELP_SECTIONS.map((s,i)=>(
            <div key={i} style={{marginBottom:8,borderRadius:"var(--r-md)",border:"1px solid var(--sage-lt)",overflow:"hidden",background:"var(--cream)"}}>
              <button onClick={()=>setOpen(open===i?null:i)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:24,flexShrink:0}}>{s.icon}</span>
                <span style={{flex:1,fontWeight:600,fontSize:15,color:"var(--ink)"}}>{s.title}</span>
                <span style={{color:"var(--sage)",fontSize:18,transition:"transform .2s",display:"inline-block",transform:open===i?"rotate(90deg)":"none"}}>›</span>
              </button>
              {open===i&&(
                <div style={{padding:"0 16px 16px",fontSize:14,color:"var(--charcoal)",lineHeight:1.75,borderTop:"1px solid var(--sage-pale)"}}>
                  <div style={{paddingTop:12}}>{s.body}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({onSignIn,onContinue}){
  const[busy,setBusy]=useState(false);
  async function handleSignIn(){setBusy(true);await onSignIn();setBusy(false);}
  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:"linear-gradient(160deg,#1E3828 0%,#0F1F17 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 28px",paddingTop:"calc(32px + env(safe-area-inset-top))"}}>
      <img src="/icons/icon-512.png" style={{width:110,height:110,borderRadius:"50%",objectFit:"cover",marginBottom:24,boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}/>
      <div className="serif" style={{fontSize:32,fontWeight:600,color:"#F5F2EC",letterSpacing:"-0.02em",marginBottom:6}}>Fork n Pantry</div>
      <div style={{fontSize:14,color:"rgba(122,184,154,.85)",marginBottom:48,textAlign:"center",lineHeight:1.6}}>Your personal recipe collection.{"\n"}Save, plan and cook from any device.</div>

      <div style={{width:"100%",maxWidth:360,display:"flex",flexDirection:"column",gap:14}}>
        <button onClick={handleSignIn} disabled={busy}
          style={{width:"100%",padding:"15px 0",borderRadius:"var(--r-lg)",border:"none",background:"#fff",color:"#1a1a1a",fontSize:15,fontWeight:700,cursor:busy?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,opacity:busy?0.7:1,boxShadow:"0 4px 20px rgba(0,0,0,.25)"}}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {busy?"Redirecting…":"Continue with Google"}
        </button>
        <button onClick={onContinue}
          style={{width:"100%",padding:"14px 0",borderRadius:"var(--r-lg)",border:"1.5px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:600,cursor:"pointer"}}>
          Continue without account
        </button>
        <div style={{fontSize:12,color:"rgba(255,255,255,.35)",textAlign:"center",marginTop:4,lineHeight:1.6}}>Sign in to sync recipes across all your devices.</div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({count,onHelp,session,onAccountPress}){
  const avatar=session?.user?.user_metadata?.avatar_url;
  const initial=(session?.user?.user_metadata?.full_name||session?.user?.email||"")[0]?.toUpperCase();
  return(
    <div style={{background:"linear-gradient(160deg,#1E3828 0%,#152A20 60%,#0F1F17 100%)",paddingTop:"env(safe-area-inset-top)",flexShrink:0,boxShadow:"0 1px 0 rgba(255,255,255,.06),0 4px 24px rgba(10,20,14,.35)"}}>
      <div style={{padding:"14px 18px 15px",display:"flex",alignItems:"center",gap:12}}>
        <Logo size={38}/>
        <div style={{flex:1}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"#F5F2EC",lineHeight:1,letterSpacing:"-0.02em"}}>Fork n Pantry</div>
          <div style={{fontSize:11,color:"rgba(122,184,154,.85)",marginTop:3,letterSpacing:"0.07em",textTransform:"uppercase",fontWeight:600}}>
            {count===0?"Your collection awaits":`${count} recipe${count!==1?"s":""} saved`}
          </div>
        </div>
        <button onClick={onHelp} style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.85)",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>?</button>
        <button onClick={onAccountPress} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center"}}>
          {session
            ?(avatar
              ?<img src={avatar} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(74,222,128,.6)"}}/>
              :<div style={{width:30,height:30,borderRadius:"50%",background:"var(--sage)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:700,border:"2px solid rgba(74,222,128,.6)"}}>{initial}</div>)
            :<div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,.7)" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,.7)" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Cloud sync helpers ────────────────────────────────────────────────────────
async function cloudUpsert(recipe,userId){
  const sb=getSupabase();if(!sb)return;
  await sb.from("recipes").upsert({id:recipe.id,user_id:userId,data:recipe,updated_at:new Date().toISOString()},{onConflict:"id,user_id"});
}
async function cloudDelete(id,userId){
  const sb=getSupabase();if(!sb)return;
  await sb.from("recipes").delete().eq("id",id).eq("user_id",userId);
}
async function cloudLoad(userId){
  const sb=getSupabase();if(!sb)return null;
  const{data,error}=await sb.from("recipes").select("data").eq("user_id",userId);
  if(error||!data)return null;
  return data.map(r=>r.data);
}
async function cloudUploadAll(recipes,userId){
  const sb=getSupabase();if(!sb||!recipes.length)return;
  const rows=recipes.map(r=>({id:r.id,user_id:userId,data:r,updated_at:new Date().toISOString()}));
  await sb.from("recipes").upsert(rows,{onConflict:"id,user_id"});
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function AppInner(){
  const[recipes,setRecipes]=useState([]);
  const[categories,setCategories]=useState([]);
  const[planner,setPlanner]=useState({});
  const[tab,setTab]=useState("recipes");
  const[sharedPrefill,setSharedPrefill]=useState("");
  const[backToast,setBackToast]=useState(false);
  const[showHelp,setShowHelp]=useState(false);
  const[globalModalRecipe,setGlobalModalRecipe]=useState(null);
  const[session,setSession]=useState(null);
  const[syncStatus,setSyncStatus]=useState("idle");
  const[welcomed,setWelcomed]=useState(true); // true = skip screen until we check storage
  function setSelectedRecipeGlobal(r){setGlobalModalRecipe(r);}
  const lastBackRef=useRef(0);
  const searchParams=useSearchParams();
  const router=useRouter();

  // Load local data on mount, then check auth session
  useEffect(()=>{
    const localRecipes=load(KEYS.r);
    setRecipes(localRecipes);
    setCategories(load(KEYS.c));
    const p=localStorage.getItem(KEYS.p);
    try{const parsed=JSON.parse(p||"{}");setPlanner(Array.isArray(parsed)?{}:parsed);}catch{setPlanner({});}
    if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
    const shared=searchParams.get("shared");
    if(shared){setSharedPrefill(decodeURIComponent(shared));setTab("recipes");router.replace("/");}
    try{const t=localStorage.getItem(KEYS.t);if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch{}
    // Show welcome screen on first ever open
    const seen=localStorage.getItem("fnp_welcomed");
    if(!seen)setWelcomed(false);
    history.pushState({page:"app"},"");

    // Auth: get existing session, then listen for changes
    const sb=getSupabase();
    if(sb){
      sb.auth.getSession().then(({data:{session:s}})=>{
        setSession(s);
        if(s)syncOnLogin(s.user.id,localRecipes);
      });
      const{data:{subscription}}=sb.auth.onAuthStateChange((_event,s)=>{
        setSession(s);
        if(s){syncOnLogin(s.user.id,load(KEYS.r));}
      });
      return()=>subscription.unsubscribe();
    }
  },[]);

  async function syncOnLogin(userId,localRecipes){
    setSyncStatus("syncing");
    const cloud=await cloudLoad(userId);
    if(cloud===null){setSyncStatus("idle");return;}
    if(cloud.length===0&&localRecipes.length>0){
      // First login — upload local recipes to cloud
      await cloudUploadAll(localRecipes,userId);
      setSyncStatus("synced");
    } else {
      // Merge: cloud is source of truth; add any local-only recipes
      const cloudIds=new Set(cloud.map(r=>r.id));
      const localOnly=localRecipes.filter(r=>!cloudIds.has(r.id));
      const merged=[...cloud,...localOnly];
      if(localOnly.length>0)await cloudUploadAll(localOnly,userId);
      setRecipes(merged);
      save(KEYS.r,merged);
      setSyncStatus("synced");
    }
  }

  useEffect(()=>{
    function onPop(){
      if(_closeModal){_closeModal();_closeModal=null;history.pushState({page:"app"},"");return;}
      const now=Date.now();
      const timeSinceLast=now-lastBackRef.current;
      if(timeSinceLast<2000&&lastBackRef.current>0){return;}
      lastBackRef.current=now;
      if(tab!=="recipes"){setTab("recipes");history.pushState({page:"app"},"");return;}
      setBackToast(true);
      history.pushState({page:"app"},"");
      setTimeout(()=>setBackToast(false),2000);
    }
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[tab]);

  function addRecipe(r){
    const u=[r,...recipes];setRecipes(u);save(KEYS.r,u);
    if(session)cloudUpsert(r,session.user.id).then(()=>setSyncStatus("synced"));
  }
  function deleteRecipe(id){
    const u=recipes.filter(r=>r.id!==id);setRecipes(u);save(KEYS.r,u);
    if(session)cloudDelete(id,session.user.id);
  }
  function updateRecipe(r){
    const u=recipes.map(x=>x.id===r.id?r:x);setRecipes(u);save(KEYS.r,u);
    if(session)cloudUpsert(r,session.user.id).then(()=>setSyncStatus("synced"));
  }

  function dismissWelcome(){
    localStorage.setItem("fnp_welcomed","1");
    setWelcomed(true);
  }

  async function handleSignIn(){
    const sb=getSupabase();
    if(!sb){alert("Config error: Supabase not initialised. Check env vars in Vercel.");return;}
    dismissWelcome();
    const{error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
    if(error)alert("Sign in error: "+error.message);
  }
  async function handleSignOut(){
    const sb=getSupabase();if(!sb)return;
    await sb.auth.signOut();
    setSession(null);setSyncStatus("idle");
  }

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"var(--linen)"}}>
      {!welcomed&&<WelcomeScreen onSignIn={handleSignIn} onContinue={()=>{dismissWelcome();}}/>}
      <Header count={recipes.length} onHelp={()=>setShowHelp(true)} session={session} onAccountPress={()=>setTab("settings")}/>
      {showHelp&&<HelpModal onClose={()=>setShowHelp(false)}/>}
      <RecipeModal recipe={globalModalRecipe} onClose={()=>setGlobalModalRecipe(null)} onUpdate={r=>{updateRecipe(r);setGlobalModalRecipe(r);}}/>
      {tab==="recipes"&&<RecipesTab recipes={recipes} onAdd={addRecipe} onDelete={deleteRecipe} onUpdate={updateRecipe} sharedPrefill={sharedPrefill} clearShared={()=>setSharedPrefill("")}/>}
      {tab==="categories"&&<CategoriesTab recipes={recipes} categories={categories} setCategories={setCategories} onUpdate={updateRecipe}/>}
      {tab==="planner"&&<PlannerTab recipes={recipes} planner={planner} setPlanner={setPlanner} onUpdate={updateRecipe}/>}
      {tab==="scan"&&<ScanTab recipes={recipes} onOpenRecipe={r=>setSelectedRecipeGlobal(r)}/>}
      {tab==="grocery"&&<GroceryTab/>}
      {tab==="settings"&&<SettingsTab session={session} onSignIn={handleSignIn} onSignOut={handleSignOut} syncStatus={syncStatus}/>}
      <TabBar tab={tab} setTab={setTab}/>
      {backToast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(15,24,17,.88)",color:"#fff",borderRadius:24,padding:"10px 20px",fontSize:13,fontWeight:600,zIndex:500,pointerEvents:"none",backdropFilter:"blur(8px)",whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,.3)"}}>
          Press back again to exit
        </div>
      )}
    </div>
  );
}

export default function App(){return <Suspense><AppInner/></Suspense>;}
