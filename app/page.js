"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabase } from "../lib/supabase";

// ─── Version & release notes ────────────────────────────────────────────────
// Bump APP_VERSION +0.01 each push and add a CHANGELOG entry for notable changes.
const APP_VERSION = "2.58";
// Mark an entry `major:true` for a significant release — only those auto-pop the What's New
// screen on open. Minor +0.01 pushes (major omitted) update the list silently.
const CHANGELOG = [
  { v:"2.58", title:"Import shows why a social fetch failed", items:[
    "Failed Instagram/TikTok imports now show the underlying reason to help diagnose issues",
  ]},
  { v:"2.57", title:"Force re-upgrade photos", items:[
    "New 'Force re-upgrade' option re-fetches fresh photos for all Instagram/TikTok recipes",
  ]},
  { v:"2.56", title:"More Instagram/TikTok links can upgrade photos", items:[
    "Photo upgrade now accepts all Instagram/TikTok link formats (reels, share links, short links)",
  ]},
  { v:"2.55", title:"Screen stays awake during image fix", items:[
    "The screen no longer sleeps while Fix Images is running, so long batches finish uninterrupted",
  ]},
  { v:"2.54", title:"Upgraded photos actually refresh", items:[
    "Sharper re-hosted photos now reload instead of showing the old cached version",
  ]},
  { v:"2.53", title:"Broader photo detection", items:[
    "Recognise more Instagram/TikTok image formats (carousels, reels) so more photos upgrade",
  ]},
  { v:"2.52", title:"Fix photo upgrade upload", items:[
    "Photo re-hosting now uses the Supabase SDK with upsert, fixing the upload rejection",
  ]},
  { v:"2.51", title:"Photo-upgrade diagnostics", items:[
    "Fix Images now reports how many photo upgrades succeeded and why any failed",
  ]},
  { v:"2.50", title:"Live progress for Fix Images", items:[
    "Fixing images now shows a progress bar and live tally of restored / already-OK / failed",
    "The run keeps going if you leave Settings, and re-running resumes where it left off",
  ]},
  { v:"2.49", title:"Fix slow image upgrades timing out", items:[
    "Raised the import timeout so the slower high-res photo fetch isn't cut off partway",
  ]},
  { v:"2.48", title:"Import services status check", items:[
    "Settings → Import services shows at a glance which import/hosting keys are connected",
  ]},
  { v:"2.47", title:"Upgrade photos on existing recipes", items:[
    "'Fix all images' now also pulls sharper, permanent photos for your existing Instagram/TikTok recipes",
  ]},
  { v:"2.46", title:"Sharper photos on Instagram recipes", items:[
    "After a quick import, a higher-resolution photo is fetched in the background and swapped in",
    "Imported photos are saved permanently so they never break when the original link expires",
  ]},
  { v:"2.45", title:"Quieter import wait message", items:[
    "The 'taking longer' notice now only appears if an import is genuinely slow, not on every quick retry",
  ]},
  { v:"2.44", title:"Faster imports, robust fallback", items:[
    "Imports try the quick method first; only escalates to the slower deep fetch if needed",
    "A clear message now shows when an Instagram import is taking the longer route",
  ]},
  { v:"2.43", title:"Robust social import backbone", items:[
    "Instagram/TikTok imports can now use a dedicated scraper for much higher reliability",
  ]},
  { v:"2.42", title:"Better Instagram/TikTok imports", items:[
    "Social links now read the caption via a headless browser instead of hitting a login wall",
    "If a caption still can't be read, paste the post's caption text instead of the link",
  ]},
  { v:"2.41", title:"Clear voice readout — mic fully releases first", items:[
    "Step readouts wait for the microphone to fully turn off before speaking, removing the echo-cancellation distortion",
  ]},
  { v:"2.40", title:"Mic reopens only after speech truly ends", items:[
    "The mic now waits for the spoken step to actually finish instead of a time estimate that cut long steps short",
  ]},
  { v:"2.39", title:"Further reduce readout distortion", items:[
    "Audio output is briefly delayed so the mic fully releases, and the chime engine is paused during readouts",
  ]},
  { v:"2.38", title:"Eliminate voice readout distortion", items:[
    "The mic is now fully blocked while a step is read aloud — the watchdog was reopening it mid-speech",
  ]},
  { v:"2.37", title:"Reinstate audio tones", items:[
    "Activation chime and wake-phrase double-beep are back — distortion fix was separate",
  ]},
  { v:"2.36", title:"Fix voice readout distortion", items:[
    "Recognition mic now pauses while a step is being read aloud, eliminating audio interference",
  ]},
  { v:"2.35", title:"Rainbow breathing when wake phrase heard", items:[
    "A slow cycling rainbow border pulses around Cook Mode when it's waiting for your command",
  ]},
  { v:"2.34", title:"Remove all audio tones", items:[
    "Removed all beeps — Web Audio API was causing distortion in the step readout on mobile",
  ]},
  { v:"2.32", title:"Fix audio interference with voice readout", items:[
    "Beeps no longer interfere with spoken step readouts — shared audio context, speech delayed slightly after tone",
  ]},
  { v:"2.31", title:"Wake phrase audio cue", items:[
    "A rising two-tone chime plays when the wake phrase is heard — so you know to speak your command",
  ]},
  { v:"2.30", title:"Back button & voice improvements", items:[
    "Pressing back in Cook Mode now reliably returns to the recipe, then to the recipe list",
    "'What's next' now advances to the next step AND reads it aloud",
  ]},
  { v:"2.29", title:"Voice reliability & audio feedback", items:[
    "Audible chime when voice mode activates; soft tone confirms each command",
    "Wake phrase detection tightened — common words like 'for' no longer trigger it accidentally",
    "Voice recovers from stalls 3× faster (800ms watchdog instead of 2500ms)",
  ]},
  { v:"2.28", title:"Voice restart fix", items:[
    "Voice listening restarts immediately after a command instead of waiting up to 10 seconds",
  ]},
  { v:"2.26", title:"Voice feedback & custom wake word", items:[
    "Cook Mode now shows animated listening bars and flashes green when it hears a command",
    "Set your own wake phrase (e.g. \"hey chef\") in Settings → Appearance",
  ]},
  { v:"2.25", title:"Hands-free cooking & polish", major:true, items:[
    "Cook Mode is now front-and-centre — a big 'Start Cook Mode' button on every recipe",
    "🔊 Read aloud reads the current step; hands-free voice is much more reliable now",
    "Just say 'next', 'back', 'repeat', 'what's next' or 'timer' — no exact wake phrase needed",
    "The back button now consistently closes whatever's open — modal, sheet or page",
    "Bigger, easier-to-tap buttons for Favourites, Share and adding to your grocery list",
    "Clearer text throughout in light mode, and the sort menu is readable in dark mode",
    "Cookbook covers show your recipe photos (emoji only shows for empty cookbooks)",
    "Instagram/TikTok imports that can't be read now tell you to paste the caption instead",
  ]},
  { v:"2.17", title:"Cook, Track & Plan", items:[
    "Cook history: tap 'Made it ★' on any recipe to log when you cooked it and give it a personal rating",
    "Personal notes: a private notes field on every recipe that AI Refresh never overwrites",
    "Pantry tracker: mark ingredients you have at home — grocery list auto-hides them",
    "Smart weekly planner: 'Plan my week' auto-fills your week with a balanced mix of your recipes",
    "Voice cook mode: say 'next', 'back', 'repeat' or 'timer' hands-free while cooking",
    "Keep screen awake during cooking — toggle in Settings under Cook Mode",
    "App now works offline: saved recipes and images load without internet",
  ]},
  { v:"2.16", title:"Feature spotlight", items:[
    "What's New now spotlights standout features like AI Refresh and Shared Cookbooks",
  ]},
  { v:"2.15", title:"What's New screen", items:[
    "Added this What's New screen — it pops up once after a big update, and you can reopen it any time under Settings → What's New",
  ]},
  { v:"2.13", title:"Collaboration & polish", major:true, items:[
    "Shared cookbooks now show recipes added by collaborators, live — and your additions sync to them too",
    "See who's joined a cookbook you own, with an invite button right in the cookbook",
    "Tap a time in any recipe step or Cook Mode (e.g. \"15 minutes\") to start a timer instantly",
    "Grocery unit changer can now convert between cups and grams for dry and wet ingredients",
    "Smarter grocery aisles — items like almond butter now land in Pantry, not Dairy",
    "New 'Fix Images' tool in Settings to permanently restore photos on older recipes",
    "Recipe imports now follow a 'full recipe' link in a video's caption for far better results",
    "Images load more reliably, and AI Refresh reports clearly what it improved",
  ]},
];
// Most recent significant release — the only one that auto-pops What's New on open
const LATEST_NOTABLE = (CHANGELOG.find(c=>c.major)||CHANGELOG[0]).v;
// [PRO] Features showcased in What's New — flagged for a future Pro tier
const PRO_FEATURES = [
  { icon:"🔍", name:"AI Refresh", desc:"Recipe imported with missing steps or ingredients? Tap AI Refresh in the editor and it digs deeper into the source — re-reading the page and video for everything the quick import missed, then fills the gaps automatically." },
  { icon:"🌐", name:"Shared Cookbooks", desc:"Invite family or friends to a cookbook and build it together. Everyone's additions sync live, you can see who's joined, and recipes flow both ways — perfect for planning meals as a household." },
  { icon:"✓", name:"Cook History & Rating", desc:"Tap 'Made it ★' after cooking to log it and give a star rating. See when you last cooked a recipe, your average rating, and sort your whole collection by what you love most." },
  { icon:"🏠", name:"Pantry Tracker", desc:"Mark the ingredients you always have at home. The grocery list automatically hides pantry staples so your shopping list only shows what you actually need to buy." },
  { icon:"✨", name:"Smart Weekly Planner", desc:"Tap 'Plan week' and the app fills your week automatically — picking from your highest-rated recipes and mixing up the variety so every day feels different." },
  { icon:"🎙️", name:"Voice Cook Mode", desc:"Cook completely hands-free. Say 'next', 'back', 'repeat', or 'timer' and the app responds — no need to touch your phone with floury hands." },
];

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEYS = { r:"fnp_r4", c:"fnp_c3", p:"fnp_p3", g:"fnp_g1", t:"fnp_theme", pantry:"fnp_pantry1" };
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

// Splits step text into plain strings and ⏱ timer buttons for detected time patterns
const TIME_RE=/\b((?:\d+\s*(?:hour|hr|h)s?\s*)?(?:\d+\s*(?:minute|min|m)s?)\b|\d+\s*(?:hour|hr|h)s?\b|\d+\s*(?:second|sec|s)s?\b)/gi;
function renderStepWithTimers(text,onTimer,btnStyle={}){
  const parts=[];let last=0,key=0;
  for(const m of text.matchAll(TIME_RE)){
    if(m.index>last)parts.push(text.slice(last,m.index));
    const match=m[0];
    parts.push(<button key={key++} onClick={()=>onTimer(match,match)} style={{display:"inline-flex",alignItems:"center",gap:3,background:"rgba(74,154,114,.18)",border:"1px solid rgba(74,154,114,.4)",borderRadius:20,padding:"1px 8px",fontSize:"0.9em",fontWeight:700,cursor:"pointer",verticalAlign:"middle",lineHeight:1.4,...btnStyle}}>⏱ {match}</button>);
    last=m.index+match.length;
  }
  if(last<text.length)parts.push(text.slice(last));
  return parts.length>1?parts:text;
}

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

// ─── Global back-button registry ─────────────────────────────────────────────
// LIFO stack of close handlers. The hardware/gesture back button (and the ×/Back
// buttons) all funnel through here so behaviour is consistent everywhere: back
// always closes the topmost open overlay (modal, sheet, sub-view) first.
const _backHandlers = [];
function useBackHandler(active, onClose){
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(()=>{
    if(!active) return;
    const fn = ()=>{ try{ ref.current && ref.current(); }catch{} };
    _backHandlers.push(fn);
    return ()=>{ const i=_backHandlers.indexOf(fn); if(i>=0) _backHandlers.splice(i,1); };
  },[active]);
}

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
  const[retries,setRetries]=useState(0);
  const retryTimer=useRef(null);
  const imgRef=useRef(null);
  const baseSrc=recipe?.ogImage?pImg(recipe.ogImage):null;
  // Append a cache-buster on retry so the browser re-fetches instead of reusing a failed response
  const src=baseSrc&&retries>0?`${baseSrc}${baseSrc.includes("?")?"&":"?"}_r=${retries}`:baseSrc;
  useEffect(()=>{setErr(false);setLoaded(false);setRetries(0);return()=>clearTimeout(retryTimer.current);},[recipe?.ogImage]);
  // If the image was already in the browser cache, onLoad may never fire after mount — detect it directly
  useEffect(()=>{
    const im=imgRef.current;
    if(im&&im.complete&&im.naturalWidth>0)setLoaded(true);
  },[src]);
  function onError(){
    if(retries<3){
      // Silent retry — proxy/CDN timeouts on a cold fetch are often transient
      retryTimer.current=setTimeout(()=>{setRetries(r=>r+1);setErr(false);},800*(retries+1));
    } else {
      setErr(true);
    }
  }
  // vw-based so it scales with the actual card size on screen, not the parent font-size
  const emojiSize="min(52px, 13vw)";
  if(src&&!err) return(
    <div style={{position:"relative",overflow:"hidden",...st}} className={className}>
      {!loaded&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 30% 30%,${tb(recipe.tags?.[0])},var(--parchment))`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:emojiSize}}>{recipe.emoji||"🍽️"}</div>}
      <img ref={imgRef} src={src} alt="" onError={onError} onLoad={()=>setLoaded(true)}
        style={{width:"100%",height:"100%",objectFit:"cover",transition:"opacity .4s",opacity:loaded?1:0,display:"block"}}/>
    </div>
  );
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(ellipse at 30% 30%,${tb(recipe?.tags?.[0])},var(--parchment) 70%)`,fontSize:emojiSize,overflow:"hidden",...st}} className={className}>
      {recipe?.emoji||"🍽️"}
    </div>
  );
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────
function Sheet({children,onClose,tall}){
  useBackHandler(true, onClose);
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
      {recipe.cookHistory?.length>0&&(
        <div style={{position:"absolute",top:8,left:onToggleFav?(recipe.nutrition?.calories>0?80:44):(recipe.nutrition?.calories>0?52:8),background:"rgba(10,18,14,.52)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,.18)",borderRadius:20,padding:"3px 8px",fontSize:10,color:"rgba(255,255,255,.95)",fontWeight:700}}>✓ {recipe.cookHistory.length}×</div>
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
function getStepEmojis(text){
  if(!text)return[];
  const lower=text.toLowerCase();
  const found=COOK_EMOJIS.filter(e=>e.words.some(w=>new RegExp(`\\b${w}`).test(lower))).map(e=>e.emoji);
  return[...new Set(found)].slice(0,3);
}

let _audioCtx=null;
function getAudioCtx(){
  try{
    if(!_audioCtx||_audioCtx.state==="closed") _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==="suspended") _audioCtx.resume().catch(()=>{});
    return _audioCtx;
  }catch{return null;}
}
function playTone(freq=880,dur=0.13,vol=0.18){
  try{
    const ctx=getAudioCtx();if(!ctx)return;
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.connect(g);g.connect(ctx.destination);
    osc.frequency.value=freq;osc.type="sine";
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+dur);
  }catch{}
}
function CookMode({recipe,onClose}){
  const[step,setStep]=useState(0);
  const[ingsOpen,setIngsOpen]=useState(false);
  const[timer,setTimer]=useState(null);
  const[voiceActive,setVoiceActive]=useState(false);
  const[voiceHint,setVoiceHint]=useState("");
  const[voiceFlash,setVoiceFlash]=useState(false); // brief confirmation when a command lands
  const[voiceArmed,setVoiceArmed]=useState(false); // rainbow breathing when waiting for command
  useBackHandler(true, onClose);
  const timerRef=useRef(null);
  const voiceRef=useRef(null);
  const steps=recipe.steps||[];
  const ings=recipe.ingredients||[];
  const total=steps.length;
  const wakeLockRef=useRef(null);
  const stepRef=useRef(step);
  useEffect(()=>{stepRef.current=step;},[step]);

  // Wake lock: only if user has it enabled (default on)
  useEffect(()=>{
    const enabled=localStorage.getItem("fnp_wakelock")!=="off";
    if(!enabled)return;
    (async()=>{try{wakeLockRef.current=await navigator.wakeLock?.request("screen");}catch{}})();
    return()=>{try{wakeLockRef.current?.release();}catch{}};
  },[]);

  // [PRO] Voice navigation in Cook Mode — stays active until manually stopped.
  // Recognition runs in short bursts (continuous=false) and auto-restarts, which is far
  // more reliable on mobile than continuous=true. Saying "Hey Fork" arms it for ~8s; the
  // command can be in the same breath ("Hey Fork next") or a follow-up utterance ("next").
  // Text-to-speech: pause recognition while speaking to avoid mic/speaker interference,
  // then restart recognition automatically when speech ends.
  function speak(text){
    if(!window.speechSynthesis)return;
    // The mic's echo-canceller garbles TTS if recognition is still live, so we must wait
    // for the mic to TRULY release before speaking. abort() is async — the hardware isn't
    // freed until the recognition's onend fires (which sets voiceRef=null), and that can
    // lag well past a fixed delay on mobile. So: block recognition, abort, then poll until
    // voiceRef is null (mic released) before starting speech.
    speakingRef.current=true;
    clearInterval(speakPollRef.current);
    clearInterval(speakWaitRef.current);
    try{voiceRef.current?.abort();}catch{}
    voiceSpawningRef.current=false;
    window.speechSynthesis.cancel();

    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-AU";u.rate=0.92;u.pitch=1;
    let resumed=false;
    const resume=()=>{
      if(resumed)return; resumed=true;
      clearInterval(speakPollRef.current);
      speakingRef.current=false;
      if(voiceShouldRunRef.current) setTimeout(spawnRecognition,500);
    };
    u.onend=resume;
    u.onerror=resume;

    function beginSpeech(){
      try{window.speechSynthesis.speak(u);}catch{}
      const start=Date.now();
      // Reopen the mic only once speech has ACTUALLY finished (poll speechSynthesis.speaking;
      // reliable where onend is flaky on mobile, and never reopens mid-readout).
      speakPollRef.current=setInterval(()=>{
        const ss=window.speechSynthesis;
        const el=Date.now()-start;
        if(el>700 && ss && !ss.speaking && !ss.pending) resume();
        else if(el>30000) resume();
      },250);
    }
    // Wait for the mic to be released (voiceRef cleared by onend), then add a small
    // settle buffer before speaking. Fall back after 1500ms if onend never fires.
    const t0=Date.now();
    speakWaitRef.current=setInterval(()=>{
      if(!voiceRef.current || Date.now()-t0>1500){
        clearInterval(speakWaitRef.current);
        setTimeout(beginSpeech,300); // settle buffer after mic release
      }
    },60);
  }
  const voiceShouldRunRef=useRef(false);
  const speakingRef=useRef(false);      // true while a step is being read aloud
  const speakPollRef=useRef(null);      // interval that detects when speech truly ends
  const speakWaitRef=useRef(null);      // interval that waits for the mic to release before speaking
  const voiceSpawningRef=useRef(false); // prevents concurrent instances
  const armedRef=useRef(false);         // true after wake phrase, awaiting a command
  const armTimerRef=useRef(null);
  const lastActRef=useRef({t:0,cmd:""}); // debounce: interim + final fire the same command
  // Wake phrase: user can set a custom one in Settings. When a custom phrase IS set it is
  // REQUIRED for every command (no bare-command shortcut). With no custom phrase we use the
  // default "hey fork" matcher AND allow short bare commands for convenience.
  let _customWake="";
  try{ _customWake=(localStorage.getItem("fnp_wakephrase")||"").trim().toLowerCase(); }catch{}
  const hasCustomWake=!!_customWake;
  const WAKE_RE=hasCustomWake
    ? new RegExp(`\\b${_customWake.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`)
    // "for" alone is too common — require hey/ok prefix for homophones, allow "fork" bare
    : /\b(?:(?:hey|hi|ok|okay)\s+(?:fork|four|folk|forks|ford|for\b)|fork)\b/;
  const wakeLabel=hasCustomWake ? `"${_customWake}"` : "Hey Fork";
  const IDLE_HINT=hasCustomWake ? `🎙️ Say ${wakeLabel} + a command` : "🎙️ Listening — say a command";

  // Map a phrase to a command key (or null). Order matters — most specific first.
  function classify(t){
    if(/\b(what'?s?\s+next|whats\s+next|read\s+next)\b/.test(t)) return "whatsnext";
    if(/\b(read|repeat|again|say)\b/.test(t)) return "repeat";
    if(/\b(next|forward|continue|go on)\b/.test(t)) return "next";
    if(/\b(back|previous|prev|last|go back)\b/.test(t)) return "back";
    if(/\b(timer|countdown|set\s+a?\s*timer)\b/.test(t)) return "timer";
    return null;
  }
  function act(cmd){
    if(cmd==="whatsnext"){
      const nextIdx=Math.min(stepRef.current+1,total-1);
      if(nextIdx>stepRef.current){setStep(nextIdx);speak(steps[nextIdx]);setVoiceHint(`→ Step ${nextIdx+1}`);}
      else{speak("That's the last step.");setVoiceHint("Last step");}
    }
    else if(cmd==="repeat"){speak(steps[stepRef.current]);setVoiceHint("↻ Reading step");}
    else if(cmd==="next"){setStep(s=>Math.min(total-1,s+1));setVoiceHint("→ Next step");}
    else if(cmd==="back"){setStep(s=>Math.max(0,s-1));setVoiceHint("← Back");}
    else if(cmd==="timer"){
      const m=steps[stepRef.current]?.match(TIME_RE);
      if(m){startTimer(m[0],m[0]);setVoiceHint("⏱ Timer started");}
      else{speak("No timer found in this step.");setVoiceHint("No timer in this step");}
    }
    setVoiceFlash(true);
    setTimeout(()=>setVoiceFlash(false),650);
    if(navigator.vibrate)try{navigator.vibrate(40);}catch{}
    setTimeout(()=>setVoiceHint(IDLE_HINT),1800);
  }
  function disarm(){armedRef.current=false;clearTimeout(armTimerRef.current);setVoiceArmed(false);}
  function arm(){
    armedRef.current=true;
    setVoiceArmed(true);
    playTone(660,0.11,0.28);
    setTimeout(()=>playTone(880,0.14,0.32),120);
    setVoiceHint("👂 Yes? (say a command)");
    clearTimeout(armTimerRef.current);
    armTimerRef.current=setTimeout(()=>{armedRef.current=false;setVoiceArmed(false);setVoiceHint(IDLE_HINT);},8000);
  }

  // Decide whether a heard phrase should trigger a command.
  // Paths: (1) wake phrase present → run the command after it (or arm if none yet);
  //        (2) recently armed by a wake phrase → any command counts;
  //        (3) ONLY when no custom wake phrase is set: a short (≤3 word) bare command.
  // If the user set a custom wake phrase, it is required — the bare-command shortcut is off.
  function handleVoiceResult(raw){
    const lc=(raw||"").toLowerCase().trim().replace(/[.,!?]/g,"");
    if(!lc)return false;
    const hasWake=WAKE_RE.test(lc);
    const after=hasWake?lc.replace(WAKE_RE,"").trim():lc;
    const wordCount=after.split(/\s+/).filter(Boolean).length;
    let cmd=null;
    if(hasWake){
      cmd=classify(after);
      if(!cmd){arm();return false;}   // wake phrase alone → arm and wait
    } else if(armedRef.current){
      cmd=classify(lc);
    } else if(!hasCustomWake && wordCount<=3){
      cmd=classify(lc);   // convenience shortcut only when no custom wake phrase is set
    }
    if(!cmd)return false;
    // Debounce: interim + final results repeat the same phrase within a moment
    const now=Date.now();
    if(now-lastActRef.current.t<1400 && lastActRef.current.cmd===cmd) return false;
    lastActRef.current={t:now,cmd};
    disarm();
    act(cmd);
    return true;
  }

  function spawnRecognition(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR||!voiceShouldRunRef.current)return;
    if(speakingRef.current)return; // never open the mic while reading a step aloud
    // One live instance at a time. The previous one has already ended (onend cleared
    // these refs) by the time we restart — do NOT abort here, that caused a restart loop.
    if(voiceSpawningRef.current||voiceRef.current)return;
    voiceSpawningRef.current=true;
    const r=new SR();
    // interimResults=true → react to a command the moment it's recognised (don't wait
    // for the final result). continuous=false + auto-restart stays reliable on mobile.
    r.continuous=false;r.interimResults=true;r.lang="en-AU";
    r.onresult=e=>{
      for(let i=e.resultIndex;i<e.results.length;i++){
        const raw=e.results[i]?.[0]?.transcript||"";
        if(handleVoiceResult(raw)){
          // Defer abort so we're outside the onresult callback — avoids edge cases
          // where some mobile browsers don't fire onend when abort() is called inline.
          setTimeout(()=>{try{r.abort();}catch{}},0);
          break;
        }
      }
    };
    r.onerror=err=>{
      if(err.error!=="no-speech"&&err.error!=="aborted")setVoiceHint("Mic error — retrying…");
    };
    r.onend=()=>{
      voiceRef.current=null;
      voiceSpawningRef.current=false;
      // Restart quickly so listening feels continuous
      if(voiceShouldRunRef.current)setTimeout(spawnRecognition,200);
    };
    try{r.start();voiceRef.current=r;voiceSpawningRef.current=false;}
    catch{voiceRef.current=null;voiceSpawningRef.current=false;if(voiceShouldRunRef.current)setTimeout(spawnRecognition,500);}
  }
  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setVoiceHint("Voice not supported in this browser");return;}
    playTone(880,0.13,0.18);
    voiceShouldRunRef.current=true;
    voiceSpawningRef.current=false;
    voiceRef.current=null;
    lastActRef.current={t:0,cmd:""};
    setVoiceActive(true);
    setVoiceHint(IDLE_HINT);
    spawnRecognition();
  }
  function stopVoice(){
    voiceShouldRunRef.current=false;
    voiceSpawningRef.current=false;
    speakingRef.current=false;
    clearInterval(speakPollRef.current);
    clearInterval(speakWaitRef.current);
    disarm();
    try{voiceRef.current?.abort();}catch{}
    voiceRef.current=null;
    try{window.speechSynthesis?.cancel();}catch{}
    setVoiceActive(false);setVoiceHint("");
  }
  useEffect(()=>()=>{voiceShouldRunRef.current=false;clearTimeout(armTimerRef.current);clearInterval(speakPollRef.current);clearInterval(speakWaitRef.current);try{voiceRef.current?.abort();}catch{};window.speechSynthesis?.cancel();},[]);
  // Watchdog: if listening should be on but no instance is alive, restart it.
  // Guarantees voice never silently dies after a command.
  useEffect(()=>{
    if(!voiceActive)return;
    const iv=setInterval(()=>{
      if(voiceShouldRunRef.current && !speakingRef.current && !voiceRef.current && !voiceSpawningRef.current) spawnRecognition();
    },800);
    return()=>clearInterval(iv);
  },[voiceActive]);
  useEffect(()=>{
    if(timer?.running){
      timerRef.current=setInterval(()=>setTimer(t=>{
        if(!t||t.secs<=0){clearInterval(timerRef.current);return t?{...t,secs:0,running:false}:null;}
        return{...t,secs:t.secs-1};
      }),1000);
    } else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[timer?.running]);
  function startTimer(label,str){const s=parseTimeSecs(str);if(s){clearInterval(timerRef.current);setTimer({label,total:s,secs:s,running:true});}}
  if(total===0)return null;
  const pct=Math.round((step/total)*100);
  const hasStr=ings.length>0&&typeof ings[0]==="object";
  const stepEmojis=getStepEmojis(steps[step]);

  return(
    <div style={{position:"fixed",inset:0,background:"#0A1A10",zIndex:700,display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top)",paddingBottom:"calc(24px + env(safe-area-inset-bottom)",overflow:"hidden"}}>

      {/* Wake-phrase heard — slow rainbow breathing border */}
      {voiceArmed&&!voiceFlash&&(
        <div style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",animation:"rainbowBreath 3s linear infinite"}}/>
      )}
      {/* Command-heard flash — green glow around the whole screen */}
      {voiceFlash&&(
        <div style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",boxShadow:"inset 0 0 0 4px rgba(74,222,128,.9), inset 0 0 60px rgba(74,222,128,.45)",animation:"voiceFlash .65s ease-out"}}/>
      )}

      {/* Background emojis — top and bottom bands, avoiding centre text */}
      {stepEmojis.length>0&&(
        <div style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",userSelect:"none"}}>
          <div style={{position:"absolute",top:"6%",left:0,right:0,display:"flex",justifyContent:"space-evenly",alignItems:"center"}}>
            {stepEmojis.slice(0,Math.ceil(stepEmojis.length/2)).map((em,i)=>(
              <div key={`t${step}${i}`} style={{fontSize:130,opacity:0.13,lineHeight:1}}>{em}</div>
            ))}
          </div>
          <div style={{position:"absolute",bottom:"22%",left:0,right:0,display:"flex",justifyContent:"space-evenly",alignItems:"center"}}>
            {stepEmojis.slice(Math.ceil(stepEmojis.length/2)).map((em,i)=>(
              <div key={`b${step}${i}`} style={{fontSize:130,opacity:0.13,lineHeight:1}}>{em}</div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onClose} style={{position:"absolute",top:"calc(env(safe-area-inset-top)+14px)",right:18,background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:"50%",width:36,height:36,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>×</button>

      {/* Title + progress */}
      <div style={{padding:"18px 60px 14px 20px",flexShrink:0,position:"relative",zIndex:1}}>
        <div style={{fontSize:12,color:"rgba(255,255,255,.55)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{recipe.title}</div>
        <div style={{background:"rgba(255,255,255,.18)",borderRadius:4,height:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#7AB89A,#4ADE80)",borderRadius:4,transition:"width .4s"}}/>
        </div>
        <div style={{marginTop:5,fontSize:11,color:"rgba(255,255,255,.45)"}}>{pct}% · Step {step+1} of {total}</div>
      </div>

      {/* Timer banner (cook mode) */}
      {timer&&(
        <div style={{background:timer.secs===0?"#7F1D1D":timer.secs<30?"#78350F":"rgba(74,154,114,.25)",border:"1px solid rgba(255,255,255,.15)",margin:"0 16px",borderRadius:"var(--r-md)",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,position:"relative",zIndex:1}}>
          <span style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.8)",flex:1}}>{timer.secs===0?"⏰ Time's up!":timer.label}</span>
          <span style={{fontFamily:"monospace",fontSize:22,fontWeight:700,color:"#fff",minWidth:52,textAlign:"center"}}>{fmtTime(timer.secs)}</span>
          {timer.secs>0&&<button onClick={()=>setTimer(t=>({...t,running:!t.running}))} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{timer.running?"Pause":"Resume"}</button>}
          <button onClick={()=>{clearInterval(timerRef.current);setTimer(null);}} style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}

      {/* Step text */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",textAlign:"center",position:"relative",zIndex:1}}>
        <div className="serif" style={{fontSize:28,fontWeight:600,color:"#FFFFFF",lineHeight:1.6,maxWidth:480,textShadow:"0 2px 16px rgba(0,0,0,.6)"}}>{renderStepWithTimers(steps[step],startTimer,{color:"#fff",borderColor:"rgba(122,184,154,.6)",background:"rgba(122,184,154,.15)"})}</div>
        <button onClick={()=>speak(steps[step])} title="Read step aloud"
          style={{marginTop:18,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.7)",borderRadius:20,padding:"6px 16px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          🔊 Read aloud
        </button>
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

      {/* Listening indicator — animated bars while actively listening, with the live hint */}
      {voiceActive&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:8,flexShrink:0,position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:3,height:18}}>
            {[0,1,2,3].map(i=>(
              <span key={i} style={{display:"inline-block",width:3,height:18,borderRadius:2,background:voiceFlash?"#4ADE80":"#7AB89A",transformOrigin:"center",animation:`listenBar 0.9s ease-in-out ${i*0.15}s infinite`}}/>
            ))}
          </div>
          <span style={{fontSize:13,color:voiceFlash?"#4ADE80":"rgba(255,255,255,.78)",fontWeight:700,transition:"color .2s"}}>{voiceHint||IDLE_HINT}</span>
        </div>
      )}
      {/* Static hint when voice is off but a message is showing */}
      {!voiceActive&&voiceHint&&<div style={{textAlign:"center",fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600,marginBottom:4,flexShrink:0,position:"relative",zIndex:1}}>{voiceHint}</div>}

      {/* Nav buttons */}
      <div style={{padding:"0 24px",display:"flex",gap:14,flexShrink:0,position:"relative",zIndex:1}}>
        <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} style={{flex:1,padding:"15px 0",borderRadius:"var(--r-md)",border:"1.5px solid rgba(255,255,255,.25)",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:15,fontWeight:600,cursor:step===0?"default":"pointer",opacity:step===0?0.3:1,transition:"opacity .15s",fontFamily:"var(--font-ui)"}}>← Back</button>
        {step<total-1
          ?<button onClick={()=>setStep(s=>s+1)} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,#3A6B50,#1E3828)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.4)",fontFamily:"var(--font-ui)"}}>Next Step →</button>
          :<button onClick={onClose} style={{flex:2,padding:"15px 0",borderRadius:"var(--r-md)",border:"none",background:"linear-gradient(160deg,#7AB89A,#4A9A72)",color:"#0A1A10",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 4px 20px rgba(74,222,128,.25)",fontFamily:"var(--font-ui)"}}>Done! 🎉</button>
        }
        <button onClick={voiceActive?stopVoice:startVoice}
          title={voiceActive?"Tap to stop voice — just say: next, back, repeat, what's next, or timer":"Tap to enable hands-free voice — stays on until you tap again"}
          style={{width:54,padding:"15px 0",borderRadius:"var(--r-md)",border:`1.5px solid ${voiceFlash?"#4ADE80":voiceActive?"rgba(122,184,154,.7)":"rgba(255,255,255,.25)"}`,background:voiceFlash?"rgba(74,222,128,.35)":voiceActive?"rgba(122,184,154,.25)":"rgba(255,255,255,.08)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:voiceActive?"0 0 0 0 rgba(122,184,154,.5)":"none",animation:voiceActive?"pulse 1.6s ease-in-out infinite":"none",transition:"background .2s,border-color .2s",fontFamily:"var(--font-ui)"}}>🎙️</button>
      </div>
    </div>
  );
}

// ─── Recipe detail modal ──────────────────────────────────────────────────────
// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({recipe,onSave,onClose}){
  useBackHandler(true, onClose);
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"9px 12px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};
  const ingToStr=ing=>typeof ing==="string"?ing:fmtIng(ing,"original",1);
  const[refreshing,setRefreshing]=useState(false);
  const[refreshMsg,setRefreshMsg]=useState("");
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

  // [PRO] AI Refresh — deep re-parse with Sonnet for incomplete recipes
  async function handleAiRefresh(){
    const url=form.url||recipe.url;
    if(!url)return;
    setRefreshing(true);setRefreshMsg("");
    try{
      const oldIngCount=form.ingredientsText.split("\n").filter(l=>l.trim()).length;
      const oldStepCount=form.stepsText.split("\n").filter(l=>l.trim()).length;
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({input:url,mode:"deep",existing:{title:form.title,ingredientCount:oldIngCount,stepCount:oldStepCount}})});
      const data=await res.json();
      if(!data.ok)throw new Error(data.error||"Parse failed");
      const r=data.recipe;
      const newIngCount=(r.ingredients||[]).length;
      const newStepCount=(r.steps||[]).length;
      const newIngText=(r.ingredients||[]).map(ingToStr).join("\n");
      const newStepText=(r.steps||[]).join("\n");
      // Compute what actually changed up-front (not inside setForm, which can run twice)
      const improvements=[];
      if(r.title&&!form.title)improvements.push("title");
      if((r.description||"").length>(form.description||"").length+10)improvements.push("description");
      if(newIngCount>oldIngCount)improvements.push(`ingredients ${oldIngCount}→${newIngCount}`);
      else if(newIngCount===oldIngCount&&newIngText.trim()&&newIngText.trim()!==form.ingredientsText.trim())improvements.push("ingredient detail");
      if(newStepCount>oldStepCount)improvements.push(`steps ${oldStepCount}→${newStepCount}`);
      else if(newStepCount===oldStepCount&&newStepText.trim()&&newStepText.trim()!==form.stepsText.trim())improvements.push("step detail");
      if(r.prepTime&&!form.prepTime)improvements.push("prep time");
      if(r.cookTime&&!form.cookTime)improvements.push("cook time");
      if(r.servings&&!form.servings)improvements.push("servings");
      if((r.tags||[]).length&&!form.tags)improvements.push("tags");
      if(data.ogImage&&!form.ogImage)improvements.push("photo");
      setForm(f=>{
        const next={...f};
        if(r.title&&!f.title)next.title=r.title;
        if((r.description||"").length>(f.description||"").length)next.description=r.description;
        if(newIngCount>=oldIngCount&&newIngText.trim())next.ingredientsText=newIngText;
        if(newStepCount>=oldStepCount&&newStepText.trim())next.stepsText=newStepText;
        if(r.prepTime&&!f.prepTime)next.prepTime=r.prepTime;
        if(r.cookTime&&!f.cookTime)next.cookTime=r.cookTime;
        if(r.servings&&!f.servings)next.servings=r.servings;
        if((r.tags||[]).length&&!f.tags)next.tags=r.tags.join(", ");
        if(data.ogImage&&!f.ogImage)next.ogImage=data.ogImage;
        return next;
      });
      if(improvements.length)setRefreshMsg("✓ Updated: "+improvements.join(", "));
      else setRefreshMsg("ℹ Recipe already looks complete — nothing more to add.");
    }catch(e){setRefreshMsg("✗ "+(e.message||"Refresh failed"));}
    setRefreshing(false);
  }

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
        <div style={{padding:"14px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Edit Recipe</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>Cancel</button>
            <button onClick={handleSave} className="btn-primary" style={{padding:"7px 16px",fontSize:13,borderRadius:20}}>Save ✓</button>
          </div>
        </div>
        {(form.url||recipe.url)&&(
          <div style={{padding:"0 18px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <button onClick={handleAiRefresh} disabled={refreshing}
              style={{display:"flex",alignItems:"center",gap:6,background:"var(--sage-pale)",border:"1.5px solid var(--sage-lt)",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:refreshing?"wait":"pointer",color:"var(--moss)",opacity:refreshing?.7:1}}>
              {refreshing?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span> Searching deeper…</>:<>🔍 AI Refresh</>}
            </button>
            {refreshMsg&&<span style={{fontSize:12,color:refreshMsg.startsWith("✓")?"var(--moss)":refreshMsg.startsWith("ℹ")?"var(--mist)":"#991B1B",flex:1}}>{refreshMsg}</span>}
          </div>
        )}

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
  const[myNotes,setMyNotes]=useState("");
  const[notesEditing,setNotesEditing]=useState(false);
  const[ratingPending,setRatingPending]=useState(false);

  function handleImgReplace(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>onUpdate({...recipe,ogImage:ev.target.result});
    reader.readAsDataURL(file);
    e.target.value="";
  }

  useEffect(()=>{
    if(recipe){setServings(recipe.servings||4);setEditing(false);setCookMode(false);setCheckedIngs(new Set());setTimer(null);setMyNotes(recipe.myNotes||"");setNotesEditing(false);setRatingPending(false);}
  },[recipe?.id]);

  // Always registered — Cook Mode and Edit sit on top (LIFO), so they fire first.
  // Do NOT deactivate here when cookMode/editing; that causes a de-register/re-register
  // race where React's effect scheduling leaves the stack empty between presses.
  useBackHandler(!!recipe, onClose);

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

  // [PRO] Cook history & rating
  function madeIt(rating){
    const history=[...(recipe.cookHistory||[]),{date:Date.now(),rating}];
    onUpdate({...recipe,cookHistory:history});
    setRatingPending(false);
  }

  // Last cooked display
  const lastCook=recipe?.cookHistory?.length>0?recipe.cookHistory[recipe.cookHistory.length-1]:null;
  function daysAgo(ts){const d=Math.floor((Date.now()-ts)/86400000);return d===0?"today":d===1?"yesterday":`${d}d ago`;}
  const avgRating=recipe?.cookHistory?.length>0
    ?Math.round(recipe.cookHistory.reduce((s,h)=>s+h.rating,0)/recipe.cookHistory.length)
    :0;
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
                }} className="btn-primary" style={{fontSize:13,padding:"7px 14px",borderRadius:20}}>+ Grocery</button>}
                <button onClick={()=>{
                  const lines=recipe.ingredients.map(ing=>hasStr?fmtIng(ing,unit,scale):(typeof ing==="string"?ing:ing.name||""));
                  const newItems=lines.map(text=>({id:Date.now().toString()+Math.random(),text,recipe:recipe.title,checked:false}));
                  const existing=JSON.parse(localStorage.getItem(KEYS.g)||"[]");
                  localStorage.setItem(KEYS.g,JSON.stringify([...existing,...newItems]));
                  alert(`All ${newItems.length} ingredients added to grocery list`);
                }} className="btn-ghost" style={{fontSize:13,padding:"7px 14px",borderRadius:20}}>+ All</button>
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
            {/* Prominent Cook Mode launcher */}
            <button onClick={()=>setCookMode(true)}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:"linear-gradient(135deg,#2D5441,#1A3028)",color:"#fff",border:"none",borderRadius:"var(--r-lg)",padding:"16px 0",fontSize:17,fontWeight:800,cursor:"pointer",marginBottom:18,boxShadow:"0 6px 22px rgba(26,48,40,.35),0 2px 6px rgba(26,48,40,.2)",letterSpacing:"-0.01em"}}>
              <span style={{fontSize:22}}>👨‍🍳</span> Start Cook Mode
            </button>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,paddingBottom:7,borderBottom:"1.5px solid var(--parchment)"}}>
              <h3 className="serif" style={{fontSize:19,fontWeight:600,color:"var(--forest)"}}>Method</h3>
            </div>
            <ol style={{listStyle:"none",paddingBottom:8}}>
              {recipe.steps.map((step,i)=>(
                <li key={i} style={{fontSize:14,color:"var(--ink)",marginBottom:16,lineHeight:1.75,display:"flex",gap:13,alignItems:"flex-start"}}>
                  <span style={{background:"linear-gradient(145deg,var(--moss),var(--forest))",color:"#fff",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,marginTop:1,boxShadow:"var(--sh-xs)"}}>{i+1}</span>
                  <span>{renderStepWithTimers(step,(label,str)=>startTimer(label,str))}</span>
                </li>
              ))}
            </ol>
          </>}
          {recipe.notes&&<p style={{fontSize:13,color:"var(--mist)",fontStyle:"italic",paddingBottom:10,lineHeight:1.65}}>{recipe.notes}</p>}

          {/* Cook history + Made it */}
          <div style={{background:"var(--sage-pale)",borderRadius:"var(--r-md)",padding:"13px 14px",marginBottom:16,border:"1px solid var(--sage-lt)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:lastCook||ratingPending?10:0}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>Cook History</div>
                {lastCook&&<div style={{fontSize:11,color:"var(--mist)",marginTop:2}}>Last cooked {daysAgo(lastCook.date)} · {recipe.cookHistory.length} time{recipe.cookHistory.length!==1?"s":""}{avgRating>0?" · "+"★".repeat(avgRating)+"☆".repeat(5-avgRating):""}</div>}
              </div>
              {!ratingPending&&<button onClick={()=>setRatingPending(true)} style={{background:"var(--forest)",color:"#fff",border:"none",borderRadius:20,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✓ Made it</button>}
            </div>
            {ratingPending&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:12,color:"var(--mist)"}}>How did it go?</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} onClick={()=>madeIt(n)} style={{flex:1,padding:"8px 0",borderRadius:10,border:"1px solid var(--sage-lt)",background:"var(--cream)",fontSize:18,cursor:"pointer"}}>{"★".repeat(n)}</button>
                  ))}
                </div>
                <button onClick={()=>setRatingPending(false)} style={{background:"none",border:"none",color:"var(--mist)",fontSize:12,cursor:"pointer",textAlign:"center"}}>Cancel</button>
              </div>
            )}
          </div>

          {/* Personal notes (AI-proof) */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:700,color:"var(--forest)"}}>My Notes</span>
              <span style={{fontSize:11,color:"var(--mist)"}}>private · AI never overwrites this</span>
              {!notesEditing&&<button onClick={()=>setNotesEditing(true)} style={{marginLeft:"auto",background:"none",border:"none",color:"var(--moss)",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏️ Edit</button>}
            </div>
            {notesEditing?(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <textarea value={myNotes} onChange={e=>setMyNotes(e.target.value)} placeholder="e.g. added extra garlic, reduce salt next time…"
                  style={{background:"var(--cream)",border:"1.5px solid var(--sage-lt)",borderRadius:"var(--r-md)",padding:"9px 12px",fontSize:13,outline:"none",color:"var(--ink)",minHeight:72,resize:"none",lineHeight:1.65}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{onUpdate({...recipe,myNotes});setNotesEditing(false);}} className="btn-primary" style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10}}>Save</button>
                  <button onClick={()=>{setMyNotes(recipe.myNotes||"");setNotesEditing(false);}} className="btn-ghost" style={{flex:1,padding:"8px 0",fontSize:13,borderRadius:10}}>Cancel</button>
                </div>
              </div>
            ):(
              myNotes
                ?<p style={{fontSize:13,color:"var(--bark)",lineHeight:1.65,background:"var(--cream)",borderRadius:"var(--r-md)",padding:"9px 12px",border:"1px solid var(--sage-lt)"}}>{myNotes}</p>
                :<button onClick={()=>setNotesEditing(true)} style={{fontSize:13,color:"var(--mist)",background:"var(--sage-pale)",border:"1px dashed var(--sage-lt)",borderRadius:"var(--r-md)",padding:"9px 12px",width:"100%",textAlign:"left",cursor:"pointer"}}>+ Add a private note about this recipe…</button>
            )}
          </div>
        </div>
      </div>
    </div>
    {editing&&<EditModal recipe={recipe} onSave={r=>{onUpdate(r);setEditing(false);}} onClose={()=>setEditing(false)}/>}
    </>
  );
}

// ─── Add sheet with photo import ──────────────────────────────────────────────
function AddSheet({onAdd,onClose,prefill="",recipes=[],onFail}){
  const[tab,setTab]=useState(prefill?"paste":"paste");
  const[input,setInput]=useState(prefill);
  const[loading,setLoading]=useState(false);
  const[loadMsg,setLoadMsg]=useState("");
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

  function callParse(text,imageBase64,imageMediaType,robust){
    return fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({input:text,imageBase64,imageMediaType,robust})}).then(r=>r.json());
  }

  async function parseAndSave({text="",imageBase64="",imageMediaType="image/jpeg",force=false}){
    if(!force&&text.trim().startsWith("http")){
      const dup=checkDuplicate(text);
      if(dup){setDupWarning(dup);return;}
    }
    setDupWarning(null);
    setLoading(true);setError("");setLoadMsg("");
    try{
      // Phase 1 — quick methods (fast: oEmbed / page HTML / Microlink)
      let data=await callParse(text,imageBase64,imageMediaType,false);
      // Phase 2 — if a social link failed the quick way, escalate to the robust scraper.
      // It's slower (cold start), so warn the user why the wait is longer.
      const isSocial=/instagram\.com|tiktok\.com|facebook\.com|fb\.watch/i.test(text);
      if(!data.ok && isSocial && text.trim().startsWith("http")){
        // Only surface the "taking longer" notice if the retry is actually slow —
        // most retries finish in a few seconds and shouldn't alarm the user.
        const slowTimer=setTimeout(()=>setLoadMsg("Fetching the full post from Instagram — hang tight…"),4000);
        try{ data=await callParse(text,imageBase64,imageMediaType,true); }
        finally{ clearTimeout(slowTimer); }
      }
      if(!data.ok)throw new Error(data.error||"Couldn't parse — try manual entry.");
      const r=data.recipe||{};
      // Never save an empty shell — guard against blank "Untitled" cards
      if(!r.title&&!(r.ingredients||[]).length&&!(r.steps||[]).length){
        throw new Error("Couldn't extract a recipe — try a different link or manual entry.");
      }
      // If image was uploaded, use it as the recipe image
      const ogImage = data.ogImage || (imageBase64 ? `data:${imageMediaType};base64,${imageBase64}` : "");
      onAdd({id:Date.now().toString(),...r,ogImage,url:text.startsWith("http")?text:"",savedAt:Date.now()});
      onClose();
    }catch(e){setError(e.message||"Couldn't parse — try manual entry.");if(onFail)onFail();}
    finally{setLoading(false);setLoadMsg("");}
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
        <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:6}}>{loadMsg?"Still working…":photoMode==="nutrition"?"Scanning ingredients…":"Reading recipe…"}</div>
        <div style={{fontSize:13,color:"var(--mist)",lineHeight:1.5}}>{loadMsg||(photoMode==="nutrition"?"AI is analysing ingredients & nutrition":"AI is extracting ingredients & steps")}</div>
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
function RecipesTab({recipes,onAdd,onDelete,onUpdate,sharedPrefill,clearShared,onImportFail,onRefresh}){
  const[search,setSearch]=useState("");
  const[tag,setTag]=useState("");
  const[showFavs,setShowFavs]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[selected,setSelected]=useState(null);
  const[sort,setSort]=useState("newest");
  const[showMake,setShowMake]=useState(false);
  const[makeInput,setMakeInput]=useState("");
  const[pullY,setPullY]=useState(0);
  const[refreshing,setRefreshing]=useState(false);
  const pullRef=useRef({startY:0,pulling:false});
  const scrollRef=useRef(null);
  useEffect(()=>{ if(sharedPrefill)setShowAdd(true); },[sharedPrefill]);

  function onTouchStart(e){
    if(scrollRef.current?.scrollTop===0){pullRef.current={startY:e.touches[0].clientY,pulling:true};}
  }
  function onTouchMove(e){
    if(!pullRef.current.pulling)return;
    const dy=e.touches[0].clientY-pullRef.current.startY;
    if(dy>0){setPullY(Math.min(dy*0.4,60));}else{pullRef.current.pulling=false;setPullY(0);}
  }
  async function onTouchEnd(){
    if(pullY>=50&&onRefresh&&!refreshing){
      setRefreshing(true);setPullY(0);
      await onRefresh();
      setRefreshing(false);
    } else {setPullY(0);}
    pullRef.current.pulling=false;
  }

  function exportRecipes(){
    const blob=new Blob([JSON.stringify(recipes,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="fork-n-pantry-recipes.json";a.click();URL.revokeObjectURL(a.href);
  }

  const allTags=[...new Set(recipes.flatMap(r=>r.tags||[]))];
  let filtered=recipes.filter(r=>{
    const q=search.toLowerCase();
    const matchQ=!q||r.title?.toLowerCase().includes(q)||(r.tags||[]).some(t=>t.toLowerCase().includes(q))||r.source?.toLowerCase().includes(q)||(r.ingredients||[]).some(i=>(typeof i==="string"?i:i.name||"").toLowerCase().includes(q));
    const matchTag=!tag||(r.tags||[]).includes(tag);
    const matchFav=!showFavs||r.fav;
    return matchQ&&matchTag&&matchFav;
  });
  if(sort==="newest") filtered=[...filtered].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  if(sort==="az") filtered=[...filtered].sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  if(sort==="calories") filtered=[...filtered].sort((a,b)=>(a.nutrition?.calories||0)-(b.nutrition?.calories||0));
  if(sort==="rating") filtered=[...filtered].sort((a,b)=>{const ar=a.cookHistory?.length?a.cookHistory.reduce((s,h)=>s+h.rating,0)/a.cookHistory.length:0;const br=b.cookHistory?.length?b.cookHistory.reduce((s,h)=>s+h.rating,0)/b.cookHistory.length:0;return br-ar;});
  if(sort==="cooked") filtered=[...filtered].sort((a,b)=>{const al=a.cookHistory?.length?a.cookHistory[a.cookHistory.length-1].date:0;const bl=b.cookHistory?.length?b.cookHistory[b.cookHistory.length-1].date:0;return bl-al;});

  // What can I make? — score recipes by ingredient overlap
  const makeResults=makeInput.trim()?recipes.map(r=>{
    const have=makeInput.toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
    const ings=(r.ingredients||[]).map(i=>(typeof i==="string"?i:i.name||"").toLowerCase());
    const hits=have.filter(h=>ings.some(i=>i.includes(h)));
    return{...r,_score:hits.length,_have:hits.length,_total:have.length};
  }).filter(r=>r._score>0).sort((a,b)=>b._score-a._score):[];

  return(
    <div ref={scrollRef} style={{flex:1,overflowY:"auto",paddingBottom:90,overscrollBehavior:"none"}}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pullY>0||refreshing)&&(
        <div style={{textAlign:"center",padding:"8px 0",fontSize:13,color:"var(--moss)",fontWeight:600,transition:"opacity .2s"}}>
          {refreshing?"🔄 Refreshing…":pullY>=50?"↑ Release to refresh":"↓ Pull to refresh"}
        </div>
      )}
      {/* Search bar */}
      <div style={{padding:"14px 16px 0",display:"flex",gap:8}}>
        <div style={{flex:1,position:"relative"}}>
          <svg style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",opacity:.35,pointerEvents:"none"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes…"
            style={{background:"var(--white)",border:"1.5px solid rgba(0,0,0,0.08)",borderRadius:16,padding:"11px 14px 11px 36px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",transition:"border-color .15s,box-shadow .15s"}}
            onFocus={e=>{e.target.style.borderColor="var(--sage)";e.target.style.boxShadow="0 0 0 3px rgba(74,122,94,.12)";}}
            onBlur={e=>{e.target.style.borderColor="rgba(0,0,0,0.08)";e.target.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";}}/>
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"var(--white)",border:"1.5px solid rgba(0,0,0,0.08)",borderRadius:14,padding:"11px 10px",fontSize:13,outline:"none",color:"var(--ink)",cursor:"pointer",flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <option value="newest">Newest</option>
          <option value="az">A–Z</option>
          <option value="calories">Calories</option>
          <option value="rating">★ Rating</option>
          <option value="cooked">Recently cooked</option>
        </select>
      </div>

      {/* Filter pills row */}
      <div style={{display:"flex",gap:6,padding:"10px 16px 0",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {/* Favourites pill */}
        <button onClick={()=>{setShowFavs(f=>!f);setTag("");}} style={{flexShrink:0,background:showFavs?"#E11D48":"var(--cream)",color:showFavs?"#fff":"var(--ink)",border:`1px solid ${showFavs?"#E11D48":"var(--sage-lt)"}`,borderRadius:22,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:"0.02em",transition:"all .15s"}}>❤️ Favourites</button>
        {/* What can I make? */}
        <button onClick={()=>setShowMake(true)} style={{flexShrink:0,background:"var(--cream)",color:"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:22,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:"0.02em",whiteSpace:"nowrap"}}>🥗 What can I make?</button>
        {allTags.map(t=>(
          <button key={t} onClick={()=>{setTag(t===tag?"":t);setShowFavs(false);}} style={{flexShrink:0,background:t===tag?"var(--forest)":"var(--cream)",color:t===tag?"#fff":"var(--ink)",border:"1px solid var(--sage-lt)",borderRadius:22,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.04em",transition:"all .15s",boxShadow:t===tag?"var(--sh-xs)":"none"}}>{t}</button>
        ))}
        {(tag||showFavs)&&<button onClick={()=>{setTag("");setShowFavs(false);}} style={{flexShrink:0,background:"#FEE2E2",color:"#991B1B",border:"1px solid #FECACA",borderRadius:22,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Clear</button>}
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

      {showAdd&&<AddSheet onAdd={r=>{onAdd(r);setShowAdd(false);clearShared();}} onClose={()=>{setShowAdd(false);clearShared();}} prefill={sharedPrefill} recipes={recipes} onFail={onImportFail}/>}
      <RecipeModal recipe={selected} onClose={()=>setSelected(null)} onUpdate={r=>{onUpdate(r);setSelected(r);}}/>
    </div>
  );
}

// ─── COOKBOOKS TAB (replaces Categories) ─────────────────────────────────────
const BOOK_EMOJIS=["📗","📘","📙","📕","📒","📔","🍳","🥘","🍜","🥗","🍱","🧆","🥩","🥦","🌮","🍰","🎂","🫕"];

// Shows owner + members who have joined a shared cookbook
function CollaboratorsStrip({book,recipeRows=[],sessionUserId}){
  if(!book)return null;
  const seen=new Map();
  seen.set(book.owner_id,{name:book.owner_name,isOwner:true,recipeCount:0});
  (book.member_ids||[]).forEach((id,i)=>{
    const name=(book.member_names||[])[i]||"Member";
    if(!seen.has(id))seen.set(id,{name,isOwner:false,recipeCount:0});
  });
  for(const row of recipeRows){
    if(!seen.has(row.added_by))seen.set(row.added_by,{name:row.added_by_name,isOwner:false,recipeCount:0});
    seen.get(row.added_by).recipeCount++;
  }
  const contributors=[...seen.values()];
  const memberCount=(book.member_ids||[]).length;
  function initials(name){return(name||"?").split(/\s+/).map(w=>w[0]?.toUpperCase()||"").slice(0,2).join("");}
  function avatarColor(name){const colors=["#3A5E42","#5E2A5E","#2A5E8C","#8C5E2A","#2A5E5E","#5E2A2A","#4A6E1A","#8C3A1A"];let h=0;for(const c of(name||""))h=(h*31+c.charCodeAt(0))%colors.length;return colors[h];}
  return(
    <div style={{padding:"8px 16px 12px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      {contributors.map((c,i)=>(
        <div key={i} title={`${c.name}${c.isOwner?" (owner)":""} · ${c.recipeCount} recipe${c.recipeCount!==1?"s":""}`}
          style={{display:"flex",alignItems:"center",gap:6,background:"var(--cream)",border:"1px solid var(--parchment)",borderRadius:20,padding:"4px 10px 4px 4px"}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:avatarColor(c.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>
            {initials(c.name)}
          </div>
          <span style={{fontSize:12,fontWeight:600,color:"var(--forest)"}}>{c.name?.split(" ")[0]}</span>
          {c.isOwner&&<span style={{fontSize:10}}>👑</span>}
          {c.recipeCount>0&&<span style={{fontSize:10,color:"var(--mist)"}}>·{c.recipeCount}</span>}
        </div>
      ))}
      {memberCount===0&&<span style={{fontSize:12,color:"var(--mist)"}}>No one's joined yet — share the invite link</span>}
    </div>
  );
}
function CookbooksTab({recipes,categories:books,setCategories:setBooks,onUpdate,onAdd,session,sharedBooks=[],onRefreshShared}){
  const[showNew,setShowNew]=useState(false);
  const[newName,setNewName]=useState("");
  const[newEmoji,setNewEmoji]=useState(BOOK_EMOJIS[0]);
  const[selected,setSelected]=useState(null);
  const[addingTo,setAddingTo]=useState(null);
  const[recipeModal,setRecipeModal]=useState(null);
  const[sharing,setSharing]=useState(null);
  const[selectedShared,setSelectedShared]=useState(null);
  const[sharedRecipes,setSharedRecipes]=useState([]);
  const[loadingShared,setLoadingShared]=useState(false);
  const[addingToShared,setAddingToShared]=useState(false);
  const[publishing,setPublishing]=useState(false);
  const[ownerSharedRecipes,setOwnerSharedRecipes]=useState([]); // collaborator-added recipes for the owner's own shared book

  // Back button returns from an open book sub-view to the cookbook list
  useBackHandler(!!selected, ()=>setSelected(null));
  useBackHandler(!!selectedShared, ()=>setSelectedShared(null));

  function createBook(){if(!newName.trim())return;const u=[...books,{id:Date.now().toString(),name:newName.trim(),color:CAT_COLORS[books.length%CAT_COLORS.length],emoji:newEmoji,recipeIds:[]}];setBooks(u);save(KEYS.c,u);setNewName("");setShowNew(false);}
  function deleteBook(id){const u=books.filter(c=>c.id!==id);setBooks(u);save(KEYS.c,u);if(selected===id)setSelected(null);}
  function addToBook(bookId,recipeId){
    const u=books.map(c=>c.id===bookId?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),recipeId])]}:c);setBooks(u);save(KEYS.c,u);setAddingTo(null);
    // If this book is shared, push the recipe to Supabase so collaborators see it too
    if(session&&sharedBooks.some(sb=>sb.id===bookId)){
      const recipe=recipes.find(r=>r.id===recipeId);
      if(recipe)sbAddSharedRecipe(bookId,recipe,session);
    }
  }
  function removeFromBook(bookId,recipeId){const u=books.map(c=>c.id===bookId?{...c,recipeIds:(c.recipeIds||[]).filter(id=>id!==recipeId)}:c);setBooks(u);save(KEYS.c,u);}

  // [PRO] Share cookbook — publish to Supabase and generate invite link
  async function shareBook(book){
    if(!session){alert("Sign in to share cookbooks.");return;}
    setPublishing(true);
    const published=await sbPublishBook(book,session);
    setPublishing(false);
    if(!published){alert("Could not publish cookbook. Please try again.");return;}
    const url=`${window.location.origin}/?join=${published.invite_code}`;
    if(navigator.share){navigator.share({title:book.name,text:`Join my cookbook "${book.name}" on Fork n Pantry`,url}).catch(()=>{});}
    else{navigator.clipboard.writeText(url).then(()=>alert(`Invite link copied!\n\n${url}`));}
    if(onRefreshShared)onRefreshShared();
  }

  useEffect(()=>{
    if(!selectedShared){setSharedRecipes([]);return;}
    setLoadingShared(true);
    sbLoadSharedRecipes(selectedShared).then(r=>{setSharedRecipes(r);setLoadingShared(false);});
    const sb=getSupabase();
    if(!sb)return;
    const chan=sb.channel("scr-"+selectedShared)
      .on("postgres_changes",{event:"*",schema:"public",table:"shared_cookbook_recipes",filter:`cookbook_id=eq.${selectedShared}`},
        ()=>sbLoadSharedRecipes(selectedShared).then(setSharedRecipes))
      .subscribe();
    return()=>chan.unsubscribe();
  },[selectedShared]);

  const book=books.find(c=>c.id===selected);
  const sharedMatch=book?sharedBooks.find(sb=>sb.id===book.id):null; // is this local book also a shared cookbook?

  // When viewing a local book that is also shared, load recipes collaborators added (live)
  useEffect(()=>{
    if(!sharedMatch){setOwnerSharedRecipes([]);return;}
    sbLoadSharedRecipes(sharedMatch.id).then(setOwnerSharedRecipes);
    const sb=getSupabase();if(!sb)return;
    const chan=sb.channel("owner-scr-"+sharedMatch.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"shared_cookbook_recipes",filter:`cookbook_id=eq.${sharedMatch.id}`},
        ()=>sbLoadSharedRecipes(sharedMatch.id).then(setOwnerSharedRecipes))
      .subscribe();
    return()=>chan.unsubscribe();
  },[sharedMatch?.id]);

  const bookRecipes=book?(book.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean):[];
  // Collaborator-added recipes not already saved locally in this book
  const localIds=new Set(book?(book.recipeIds||[]):[]);
  const collabRecipes=ownerSharedRecipes.filter(row=>row.added_by!==session?.user?.id&&!localIds.has(row.recipe?.id));
  const notInBook=book?recipes.filter(r=>!(book.recipeIds||[]).includes(r.id)):[];
  const inp={background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"11px 14px",fontSize:14,outline:"none",color:"var(--ink)",width:"100%"};

  // Shared book detail view
  const sharedBook=sharedBooks.find(b=>b.id===selectedShared);
  if(selectedShared&&sharedBook) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelectedShared(null)} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>← Back</button>
        <span style={{fontSize:22}}>{sharedBook.emoji}</span>
        <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)",flex:1}}>{sharedBook.name}</span>
        {sharedBook.owner_id===session?.user?.id&&(
          <button onClick={async()=>{
            const link=`${window.location.origin}/?join=${sharedBook.invite_code}`;
            if(navigator.share){await navigator.share({title:sharedBook.name,text:"Join my cookbook!",url:link}).catch(()=>{});}
            else{await navigator.clipboard.writeText(link).catch(()=>{});alert("Invite link copied!");}
          }} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:12,padding:"3px 9px",fontSize:10,fontWeight:700,color:"var(--moss)",cursor:"pointer",flexShrink:0}}>
            📤 Invite
          </button>
        )}
        {sharedBook.owner_id!==session?.user?.id&&(
          <button onClick={async()=>{if(!confirm("Leave this cookbook?"))return;await sbLeaveCookbook(sharedBook.id);setSelectedShared(null);if(onRefreshShared)onRefreshShared();}}
            style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:12,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#991B1B",cursor:"pointer",flexShrink:0}}>
            Leave
          </button>
        )}
      </div>
      <div style={{padding:"0 16px 6px",fontSize:12,color:"var(--mist)"}}>{sharedRecipes.length} recipe{sharedRecipes.length!==1?"s":""}</div>
      <CollaboratorsStrip book={sharedBook} recipeRows={sharedRecipes} sessionUserId={session?.user?.id}/>
      <div style={{padding:"4px 16px"}}>
        {loadingShared&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--mist)",fontSize:14}}>Loading…</div>}
        {sharedRecipes.map(row=>(
          <div key={row.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}} onClick={()=>setRecipeModal({...row.recipe,_sharedRowId:row.id})}>
            <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><RImg recipe={row.recipe} style={{width:"100%",height:"100%"}}/></div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{row.recipe.title}</div>
              <div style={{fontSize:11,color:"var(--mist)",marginTop:2}}>Added by {row.added_by_name}</div>
            </div>
            {row.added_by===session?.user?.id&&(
              <button onClick={e=>{e.stopPropagation();sbRemoveSharedRecipe(row.id).then(()=>sbLoadSharedRecipes(selectedShared).then(setSharedRecipes));}}
                style={{background:"none",border:"none",color:"var(--mist)",fontSize:18,cursor:"pointer"}}>×</button>
            )}
          </div>
        ))}
        {!loadingShared&&sharedRecipes.length===0&&<div style={{textAlign:"center",paddingTop:40,color:"var(--mist)",fontSize:14}}>No recipes yet — add the first one!</div>}
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <button onClick={()=>setAddingToShared(true)} className="btn-ghost" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ Add a recipe</button>
      </div>
      {addingToShared&&(
        <Sheet onClose={()=>setAddingToShared(false)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:14}}>Add to {sharedBook.name}</div>
            {recipes.length===0
              ?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",padding:"20px 0"}}>No recipes saved yet.</div>
              :recipes.map(r=>(
                <div key={r.id} onClick={async()=>{await sbAddSharedRecipe(selectedShared,r,session);sbLoadSharedRecipes(selectedShared).then(setSharedRecipes);setAddingToShared(false);}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
                  <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><RImg recipe={r} style={{width:"100%",height:"100%"}}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{r.title}</div>
                    <div style={{display:"flex",gap:3,marginTop:2}}>{(r.tags||[]).slice(0,2).map(t=><Chip key={t} label={t} sm/>)}</div>
                  </div>
                  <div style={{background:"var(--sage-pale)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--moss)",fontSize:18,fontWeight:700}}>+</div>
                </div>
              ))
            }
          </div>
        </Sheet>
      )}
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)} onUpdate={r=>{if(onUpdate)onUpdate(r);setRecipeModal(r);}}/>
    </div>
  );

  if(selected&&book) return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {/* Book header */}
      <div style={{padding:"12px 16px 10px",display:"flex",alignItems:"center",gap:10}}>
        <button onClick={()=>setSelected(null)} className="btn-ghost" style={{padding:"7px 13px",fontSize:13}}>← Back</button>
        <span style={{fontSize:22}}>{book.emoji||"📗"}</span>
        <span className="serif" style={{fontWeight:600,fontSize:19,color:"var(--forest)",flex:1}}>{book.name}</span>
        {sharedBooks.some(sb=>sb.id===book.id)
          ?<div style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:12,padding:"3px 9px",fontSize:10,fontWeight:700,color:"var(--moss)"}}>🌐 Shared</div>
          :null}
        <button onClick={()=>shareBook(book)} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",color:"var(--moss)"}}>📤 {sharedBooks.some(sb=>sb.id===book.id)?"Invite":"Share"}</button>
      </div>
      {sharedMatch&&<CollaboratorsStrip book={sharedMatch} recipeRows={ownerSharedRecipes} sessionUserId={session?.user?.id}/>}
      <div style={{padding:"0 16px 6px",fontSize:12,color:"var(--mist)"}}>{bookRecipes.length+collabRecipes.length} recipe{(bookRecipes.length+collabRecipes.length)!==1?"s":""}</div>
      <div style={{padding:"4px 16px"}}>
        {bookRecipes.map(r=><MiniCard key={r.id} recipe={r} onOpen={setRecipeModal} onRemove={()=>removeFromBook(book.id,r.id)}/>)}
        {/* Recipes added by collaborators (live from Supabase) */}
        {collabRecipes.map(row=>(
          <div key={row.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}} onClick={()=>setRecipeModal(row.recipe)}>
            <div style={{width:50,height:50,borderRadius:12,overflow:"hidden",flexShrink:0}}><RImg recipe={row.recipe} style={{width:"100%",height:"100%"}}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,color:"var(--forest)"}}>{row.recipe?.title}</div>
              <div style={{fontSize:11,color:"var(--moss)",marginTop:2}}>✛ Added by {row.added_by_name}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();
              if(onAdd)onAdd(row.recipe);
              // add to local book only — it's already in Supabase, so don't re-push (would duplicate)
              const u=books.map(c=>c.id===book.id?{...c,recipeIds:[...new Set([...(c.recipeIds||[]),row.recipe.id])]}:c);setBooks(u);save(KEYS.c,u);
            }}
              title="Save to my recipes" style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,width:30,height:30,fontSize:16,fontWeight:700,color:"var(--moss)",cursor:"pointer",flexShrink:0}}>↓</button>
          </div>
        ))}
        {bookRecipes.length===0&&collabRecipes.length===0&&<div style={{textAlign:"center",paddingTop:50,color:"var(--mist)",fontSize:14}}>No recipes yet — add some below</div>}
      </div>
      <div style={{padding:"12px 16px 0"}}>
        <button onClick={()=>setAddingTo(book.id)} className="btn-ghost" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ Add recipes to {book.name}</button>
      </div>
      {addingTo&&(
        <Sheet onClose={()=>setAddingTo(null)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:20,color:"var(--forest)",marginBottom:14}}>Add to {book.name}</div>
            {notInBook.length===0?<div style={{color:"var(--mist)",fontSize:14,textAlign:"center",padding:"20px 0"}}>All recipes already in this cookbook.</div>
            :notInBook.map(r=>(
              <div key={r.id} onClick={()=>addToBook(book.id,r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid var(--parchment)",cursor:"pointer"}}>
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
      <div style={{padding:"16px 16px 4px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Cookbooks</div>
        <span style={{fontSize:12,color:"var(--mist)"}}>{books.length} book{books.length!==1?"s":""}</span>
      </div>
      {/* List */}
      <div style={{padding:"8px 16px 0",display:"flex",flexDirection:"column",gap:10}}>
        {books.length===0&&(
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:52,marginBottom:14}}>📗</div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:8}}>No cookbooks yet</div>
            <div style={{fontSize:14,color:"var(--mist)",lineHeight:1.75}}>Create collections like<br/>"Weeknight Dinners" or "Batch Cook"</div>
          </div>
        )}
        {books.map(bk=>{
          const bkRecs=(bk.recipeIds||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
          const coverRecipes=bkRecs.slice(0,3);
          return(
            <div key={bk.id} onClick={()=>setSelected(bk.id)}
              style={{display:"flex",alignItems:"center",gap:14,background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1px solid var(--parchment)",boxShadow:"var(--sh-sm)",padding:"12px 14px",cursor:"pointer",position:"relative",transition:"transform .15s,box-shadow .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--sh-sm)";}}>
              {/* Stacked covers — recipe images fanned out; emoji only when the book is empty */}
              <div style={{position:"relative",width:64,height:64,flexShrink:0}}>
                {coverRecipes.length===0?(
                  <div style={{position:"absolute",borderRadius:10,overflow:"hidden",width:50,height:50,top:0,left:0,boxShadow:"var(--sh-xs)",background:bk.color||"var(--sage-pale)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{bk.emoji||"📗"}</div>
                ):(
                  // Render back-to-front so the first recipe sits on top
                  [...coverRecipes].map((r,idx)=>({r,idx})).reverse().map(({r,idx})=>(
                    <div key={idx} style={{position:"absolute",borderRadius:10,overflow:"hidden",width:50,height:50,top:idx*4,left:idx*4,zIndex:3-idx,boxShadow:"var(--sh-xs)",background:bk.color||"var(--sage-pale)"}}>
                      <RImg recipe={r} style={{width:"100%",height:"100%"}}/>
                    </div>
                  ))
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  <span style={{fontSize:18}}>{bk.emoji||"📗"}</span>
                  <span style={{fontWeight:700,fontSize:15,color:"var(--forest)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bk.name}</span>
                  {sharedBooks.some(sb=>sb.id===bk.id)&&<span style={{fontSize:10,background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:8,padding:"1px 6px",color:"var(--moss)",fontWeight:700,flexShrink:0}}>🌐</span>}
                </div>
                <div style={{fontSize:12,color:"var(--mist)"}}>{bkRecs.length} recipe{bkRecs.length!==1?"s":""}</div>
                {bkRecs.length>0&&<div style={{fontSize:11,color:"var(--dust)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bkRecs.slice(0,3).map(r=>r.title).join(" · ")}</div>}
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Delete "${bk.name}"?`))deleteBook(bk.id);}} style={{background:"none",border:"none",color:"var(--mist)",fontSize:18,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
            </div>
          );
        })}
      </div>
      {session&&sharedBooks.filter(sb=>sb.owner_id!==session?.user?.id).length>0&&(
        <div style={{padding:"16px 16px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--mist)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>Shared with me</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sharedBooks.filter(sb=>sb.owner_id!==session?.user?.id).map(bk=>(
              <div key={bk.id} onClick={()=>setSelectedShared(bk.id)}
                style={{display:"flex",alignItems:"center",gap:14,background:"var(--cream)",borderRadius:"var(--r-lg)",border:"1.5px solid var(--sage-lt)",boxShadow:"var(--sh-sm)",padding:"12px 14px",cursor:"pointer"}}>
                <div style={{width:44,height:44,borderRadius:10,background:"var(--sage-pale)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{bk.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontWeight:700,fontSize:15,color:"var(--forest)"}}>{bk.name}</span>
                    <span style={{fontSize:10,background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:8,padding:"1px 6px",color:"var(--moss)",fontWeight:700}}>🌐</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--mist)",marginTop:2}}>by {bk.owner_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{padding:"16px 16px 0"}}>
        <button onClick={()=>setShowNew(true)} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)"}}>+ New Cookbook</button>
      </div>
      {showNew&&(
        <Sheet onClose={()=>setShowNew(false)}>
          <div style={{padding:"14px 18px 24px"}}>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)",marginBottom:16}}>New Cookbook</div>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:4}}>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Weeknight Dinners" style={{...inp,marginBottom:16}} autoFocus/>
            <label style={{fontSize:12,fontWeight:600,color:"var(--mist)",display:"block",marginBottom:8}}>Icon</label>
            <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>
              {BOOK_EMOJIS.map(em=><button key={em} onClick={()=>setNewEmoji(em)} style={{width:38,height:38,borderRadius:10,border:newEmoji===em?"2.5px solid var(--forest)":"1.5px solid var(--parchment)",background:newEmoji===em?"var(--sage-pale)":"transparent",fontSize:22,cursor:"pointer",transition:"all .12s"}}>{em}</button>)}
            </div>
            <button onClick={createBook} disabled={!newName.trim()} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:15,borderRadius:"var(--r-md)",opacity:newName.trim()?1:.6}}>Create Cookbook</button>
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
          {recipes.length>0&&<button onClick={()=>{
            // [PRO] Smart weekly planner — auto-fills week with highest-rated recipes
            // Smart auto-fill: pick recipes with variety (different tags) avoiding repeats
            const available=[...recipes].sort(()=>Math.random()-0.5);
            const u={...planner};
            const used=new Set();
            // Prefer highly-rated recipes
            const pool=[...recipes].sort((a,b)=>{
              const ar=a.cookHistory?.length?a.cookHistory.reduce((s,h)=>s+h.rating,0)/a.cookHistory.length:3;
              const br=b.cookHistory?.length?b.cookHistory.reduce((s,h)=>s+h.rating,0)/b.cookHistory.length:3;
              return br-ar+Math.random()-0.5;
            });
            let pi=0;
            DAYS.forEach(day=>{
              ['Dinner','Lunch'].forEach(meal=>{
                const k=planKey(day,meal);
                if(u[k])return; // don't overwrite existing
                while(pi<pool.length&&used.has(pool[pi].id))pi++;
                if(pi<pool.length){u[k]=pool[pi].id;used.add(pool[pi].id);pi++;}
              });
            });
            setPlanner(u);save(KEYS.p,u);
          }} className="btn-ghost" style={{padding:"7px 13px",fontSize:12}}>✨ Plan week</button>}
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

// ─── PANTRY TRACKER ──────────────────────────────────────────────────────────
// [PRO] Pantry tracker — mark what you have at home; grocery list hides those items
function PantrySheet({onClose}){
  const[items,setItems]=useState(()=>load(KEYS.pantry)||[]);
  const[input,setInput]=useState("");

  function setAndSave(next){setItems(next);save(KEYS.pantry,next);}
  function addItem(){
    if(!input.trim())return;
    setAndSave([...items,{id:Date.now().toString(),name:input.trim().toLowerCase()}]);
    setInput("");
  }
  function remove(id){setAndSave(items.filter(i=>i.id!==id));}
  function clearAll(){if(confirm("Clear your whole pantry list?"))setAndSave([]);}

  return(
    <Sheet onClose={onClose} tall>
      <div style={{padding:"14px 18px 24px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>My Pantry</div>
          {items.length>0&&<button onClick={clearAll} style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:20,padding:"4px 11px",fontSize:11,fontWeight:700,cursor:"pointer",color:"#991B1B"}}>Clear all</button>}
        </div>
        <div style={{fontSize:13,color:"var(--mist)",marginBottom:14,lineHeight:1.5}}>Ingredients you have at home. Grocery list auto-hides them.</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="e.g. olive oil, eggs, garlic…"
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"9px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          <button onClick={addItem} className="btn-primary" style={{padding:"0 16px",borderRadius:12,fontSize:18}}>+</button>
        </div>
        {items.length===0&&<div style={{textAlign:"center",paddingTop:30,color:"var(--mist)",fontSize:14}}>No pantry items yet — add staples like oil, salt, eggs…</div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {items.map(it=>(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:5,background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"5px 12px 5px 10px",fontSize:13,fontWeight:600,color:"var(--forest)"}}>
              ✓ {it.name}
              <button onClick={()=>remove(it.id)} style={{background:"none",border:"none",color:"var(--mist)",fontSize:15,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

// ─── GROCERY TAB ──────────────────────────────────────────────────────────────
// Ingredient quantity parsing helpers
const _FM={'½':0.5,'¼':0.25,'¾':0.75,'⅓':1/3,'⅔':2/3,'⅛':0.125,'⅜':0.375,'⅝':0.625,'⅞':0.875};
const _VOL={'tsp':4.929,'teaspoon':4.929,'teaspoons':4.929,'tbsp':14.787,'tablespoon':14.787,'tablespoons':14.787,'cup':236.588,'cups':236.588,'ml':1,'l':1000,'litre':1000,'litres':1000,'liter':1000,'liters':1000};
const _WGT={'g':1,'gram':1,'grams':1,'kg':1000,'kilogram':1000,'kilograms':1000,'oz':28.349,'ounce':28.349,'ounces':28.349,'lb':453.592,'lbs':453.592,'pound':453.592,'pounds':453.592};
const VOL_CYCLE=['cup','tbsp','tsp','ml'];
const WGT_CYCLE=['g','kg','oz'];
// Approx grams per US cup for common dry/semi-dry ingredients — lets us convert cups↔grams.
// Keyword match is longest-wins so "brown sugar" beats "sugar", "almond flour" beats "flour".
const _GPC={
  // dry / semi-dry — grams per US cup
  'plain flour':120,'all purpose flour':120,'all-purpose flour':120,'self raising flour':120,'self-raising flour':120,'bread flour':127,'flour':120,'almond meal':96,'almond flour':96,'almonds':143,'cashews':137,'walnuts':117,'caster sugar':200,'white sugar':200,'granulated sugar':200,'brown sugar':220,'icing sugar':120,'powdered sugar':120,'sugar':200,'cocoa':100,'cacao':100,'rolled oats':90,'oats':90,'rice':185,'breadcrumbs':108,'desiccated coconut':80,'shredded coconut':80,'cornflour':120,'cornstarch':120,'cornmeal':122,'polenta':160,'chocolate chips':170,'choc chips':170,'chia seeds':170,'chia':170,'flaxseed':150,'protein powder':120,'peanut butter':256,'almond butter':256,'salt':273,
  // wet — grams per US cup (≈ density × 236.588)
  'water':237,'milk':245,'almond milk':240,'oat milk':240,'soy milk':245,'coconut milk':237,'buttermilk':245,'cream':238,'thickened cream':238,'heavy cream':238,'sour cream':230,'yoghurt':245,'yogurt':245,'olive oil':216,'vegetable oil':218,'oil':218,'melted butter':227,'butter':227,'honey':340,'maple syrup':322,'golden syrup':340,'molasses':328,'stock':240,'broth':240,'tomato paste':262,'passata':244,'coconut cream':237,'condensed milk':306,'evaporated milk':252,'vanilla':208,'soy sauce':255,'vinegar':239};
function _densityGPerMl(name){
  if(!name)return null;
  const n=name.toLowerCase();
  let best=null,bestLen=0;
  for(const k in _GPC){if(k.length>bestLen&&n.includes(k)){best=_GPC[k];bestLen=k.length;}}
  return best?best/236.588:null; // grams per ml
}
function _evalFrac(s){return s.trim().split(/\s+/).reduce((t,p)=>{if(p.includes('/'))return t+parseFloat(p.split('/')[0])/parseFloat(p.split('/')[1]);return t+(parseFloat(p)||0);},0);}
function _fmtQty(n){
  if(!n||!isFinite(n)||n===0)return'';
  const fracs=[[1,4],[1,3],[1,2],[2,3],[3,4],[1,8],[3,8]];
  const whole=Math.floor(n);const rem=n-whole;
  for(const[a,b]of fracs){if(Math.abs(rem-a/b)<0.04){const f=`${a}/${b}`;return whole>0?`${whole} ${f}`:f;}}
  if(Math.abs(n-Math.round(n))<0.04)return String(Math.round(n));
  return parseFloat(n.toFixed(2))+'';
}
function _parseIng(raw){
  let s=raw.trim().replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g,m=>' '+(_FM[m]||0)+' ');
  let qty=0,unit='';
  const numM=s.match(/^([\d\s./]+)/);
  if(numM){qty=_evalFrac(numM[1]);s=s.slice(numM[0].length).trim();}
  const uM=s.match(/^(tsp|tbsp|tablespoon(?:s)?|teaspoon(?:s)?|cup(?:s)?|ml|l|kg|g|oz|lb(?:s)?|pound(?:s)?|gram(?:s)?|ounce(?:s)?|liter(?:s)?|litre(?:s)?|kilogram(?:s)?)\b\.?\s*/i);
  if(uM){unit=uM[1].toLowerCase();s=s.slice(uM[0].length).trim();}
  const name=s.replace(/^of\s+/i,'').trim().toLowerCase();
  return{qty,unit,name,raw};
}
function _utype(u){if(_VOL[u])return'vol';if(_WGT[u])return'wgt';return'count';}
function _toBase(qty,unit,type){if(type==='vol')return qty*(_VOL[unit]||1);if(type==='wgt')return qty*(_WGT[unit]||1);return qty;}
function _display(base,type,ov,density){
  if(type==='vol'){
    // base is in ml; if user picked grams and we know the density, convert
    if(ov==='g'&&density)return{qty:_fmtQty(base*density),unit:'g'};
    const u=ov||(base<14?'tsp':base<60?'tbsp':base<500?'cup':'ml');return{qty:_fmtQty(base/(_VOL[u]||1)),unit:u};
  }
  if(type==='wgt'){
    // base is in grams; if user picked a volume unit and we know the density, convert
    if((ov==='cup'||ov==='tbsp'||ov==='tsp'||ov==='ml')&&density){const ml=base/density;return{qty:_fmtQty(ml/(_VOL[ov]||1)),unit:ov};}
    const u=ov||(base<1000?'g':'kg');return{qty:_fmtQty(base/(_WGT[u]||1)),unit:u};
  }
  return{qty:_fmtQty(base),unit:ov||''};
}
function _nextUnit(unit,type,hasDensity){
  if(type==='vol'){const cyc=hasDensity?[...VOL_CYCLE,'g']:VOL_CYCLE;const i=cyc.indexOf(unit);return cyc[(i<0?0:i+1)%cyc.length];}
  if(type==='wgt'){const cyc=hasDensity?[...WGT_CYCLE,'cup']:WGT_CYCLE;const i=cyc.indexOf(unit);return cyc[(i<0?0:i+1)%cyc.length];}
  return unit;
}
function _mergeItems(items){
  const map=new Map();
  for(const it of items){
    const p=_parseIng(it.text);
    const type=_utype(p.unit);
    const key=p.name+'|'+type;
    if(!map.has(key))map.set(key,{key,name:p.name,type,baseQty:_toBase(p.qty,p.unit,type),ids:[it.id],sources:[it]});
    else{const m=map.get(key);m.baseQty+=_toBase(p.qty,p.unit,type);m.ids.push(it.id);m.sources.push(it);}
  }
  return[...map.values()];
}

const AISLES=[
  {name:"🥦 Produce",words:["apple","apples","banana","bananas","lemon","lemons","lime","orange","grape","tomato","tomatoes","potato","potatoes","onion","onions","garlic","carrot","carrots","celery","broccoli","spinach","lettuce","salad","capsicum","pepper","cucumber","zucchini","avocado","mushroom","mushrooms","ginger","herbs","basil","parsley","coriander","mint","rosemary","thyme","bay","spring onion","shallot","shallots","kale","corn","peas","bean","beans","asparagus","eggplant","cauliflower","leek","pumpkin","squash","sweet potato","beetroot","radish","fennel"]},
  {name:"🥩 Meat & Seafood",words:["chicken","beef","pork","lamb","mince","steak","bacon","ham","sausage","chorizo","prawn","prawns","fish","salmon","tuna","shrimp","seafood","turkey","duck","veal","brisket","rib","ribs","fillet","breast","thigh","wing","cutlet","schnitzel","meatball","anchovy","anchovies","scallop","crab","lobster","squid","calamari"]},
  {name:"🥛 Dairy & Eggs",words:["milk","cream","butter","cheese","yoghurt","yogurt","egg","eggs","parmesan","mozzarella","cheddar","feta","ricotta","brie","halloumi","sour cream","cream cheese","condensed milk","evaporated milk","ghee"]},
  {name:"🍞 Bakery & Bread",words:["bread","sourdough","baguette","roll","rolls","pita","tortilla","wrap","croissant","bagel","muffin","bun","loaf","crouton","breadcrumb","breadcrumbs"]},
  {name:"🥫 Pantry & Canned",words:["flour","almond meal","almond flour","sugar","salt","pepper","oil","olive oil","vinegar","soy sauce","sauce","stock","broth","pasta","rice","noodle","noodles","lentil","lentils","chickpea","chickpeas","can","canned","tomato paste","coconut milk","coconut cream","coconut","honey","maple syrup","syrup","jam","peanut butter","almond butter","cashew butter","nut butter","tahini","nutella","oats","cereal","biscuit","cracker","cornstarch","baking powder","baking soda","yeast","vanilla","cocoa","chocolate","mustard","ketchup","mayonnaise","relish","chutney","curry paste","hoisin","oyster sauce","fish sauce","worcestershire","tabasco","sriracha","harissa","almond","almonds","cashew","cashews","walnut","walnuts","pecan","pecans","peanut","peanuts","pistachio","seeds","chia","flaxseed","raisin","raisins","sultana","sultanas","date","dates","dried fruit","protein powder"]},
  {name:"🧊 Frozen",words:["frozen","ice cream","gelato","sorbet","popsicle","fish fingers","frozen peas","frozen corn","frozen berries","pastry","puff pastry","shortcrust"]},
  {name:"🧃 Drinks & Beverages",words:["water","juice","wine","beer","coffee","tea","milk","soda","sparkling","mineral water","stock","broth"]},
  {name:"🧂 Spices & Condiments",words:["cumin","paprika","turmeric","cinnamon","cayenne","chilli","chili","oregano","sage","cardamom","nutmeg","cloves","coriander seed","fennel seed","star anise","allspice","curry powder","garam masala","sumac","za'atar","dried","spice","seasoning","dressing","marinade"]},
];
const OTHER_AISLE="🛒 Other";
function getAisle(text){
  const t=text.toLowerCase();
  // Longest matching keyword wins, so "almond butter" (Pantry) beats the generic "butter" (Dairy).
  // Word-boundary matching avoids "ham" matching "graham" etc.
  let best=OTHER_AISLE,bestLen=0;
  for(const a of AISLES){
    for(const w of a.words){
      if(w.length<=bestLen)continue;
      const re=new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`);
      if(re.test(t)){best=a.name;bestLen=w.length;}
    }
  }
  return best;
}

function GroceryTab(){
  const[items,setItems]=useState(()=>load(KEYS.g));
  const[manualInput,setManualInput]=useState("");
  const[groupBy,setGroupBy]=useState("aisle");
  const[unitOv,setUnitOv]=useState({}); // {mergeKey: unitString}
  const[showPantry,setShowPantry]=useState(false);
  const[hidePantry,setHidePantry]=useState(false);
  const pantryItems=()=>(load(KEYS.pantry)||[]).map(i=>i.name.toLowerCase());

  function setAndSave(fn){setItems(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(KEYS.g,next);return next;});}
  function toggle(id){setAndSave(is=>is.map(i=>i.id===id?{...i,checked:!i.checked}:i));}
  function toggleMany(ids){setAndSave(is=>is.map(i=>ids.includes(i.id)?{...i,checked:true}:i));}
  function remove(id){setAndSave(is=>is.filter(i=>i.id!==id));}
  function removeMany(ids){setAndSave(is=>is.filter(i=>!ids.includes(i.id)));}
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
  function cycleUnit(key,type,currentUnit,hasDensity){
    setUnitOv(ov=>({...ov,[key]:_nextUnit(currentUnit,type,hasDensity)}));
  }

  const pantry=pantryItems();
  const unchecked=items.filter(i=>!i.checked&&(!hidePantry||!pantry.some(p=>i.text.toLowerCase().includes(p))));
  const hiddenByPantry=hidePantry?items.filter(i=>!i.checked&&pantry.some(p=>i.text.toLowerCase().includes(p))).length:0;
  const checked=items.filter(i=>i.checked);
  const aisleOrder=[...AISLES.map(a=>a.name),OTHER_AISLE];

  // Build groups
  const groups={};
  if(groupBy==="aisle"){
    const merged=_mergeItems(unchecked);
    for(const m of merged){
      const g=getAisle(m.name||m.sources[0]?.text||'');
      if(!groups[g])groups[g]=[];
      groups[g].push(m);
    }
  } else {
    for(const item of unchecked){const g=item.recipe||"Other";if(!groups[g])groups[g]=[];groups[g].push({key:item.id,name:'',type:'count',baseQty:1,ids:[item.id],sources:[item]});}
  }
  const sortedGroupKeys=Object.keys(groups).sort((a,b)=>{const ai=aisleOrder.indexOf(a),bi=aisleOrder.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi);});

  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      <div style={{padding:"14px 18px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>Grocery List</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:12,color:"var(--mist)"}}>{unchecked.length} left</span>
            <button onClick={shareList} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",color:"var(--moss)"}}>📤 Share</button>
            {checked.length>0&&<button onClick={clearChecked} style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:20,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",color:"#991B1B"}}>Clear done</button>}
            {items.length>0&&<button onClick={clearAll} style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:20,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",color:"#991B1B"}}>Clear all</button>}
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>setGroupBy("aisle")} style={{borderRadius:20,border:"1px solid var(--sage-lt)",padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer",background:groupBy==="aisle"?"var(--forest)":"var(--cream)",color:groupBy==="aisle"?"#fff":"var(--ink)"}}>🛒 By Aisle</button>
          <button onClick={()=>setGroupBy("recipe")} style={{borderRadius:20,border:"1px solid var(--sage-lt)",padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer",background:groupBy==="recipe"?"var(--forest)":"var(--cream)",color:groupBy==="recipe"?"#fff":"var(--ink)"}}>📋 By Recipe</button>
          <button onClick={()=>setShowPantry(true)} style={{borderRadius:20,border:"1px solid var(--sage-lt)",padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer",background:"var(--cream)",color:"var(--ink)"}}>🏠 Pantry</button>
          {pantry.length>0&&<button onClick={()=>setHidePantry(h=>!h)} style={{borderRadius:20,border:`1px solid ${hidePantry?"var(--moss)":"var(--sage-lt)"}`,padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer",background:hidePantry?"var(--sage-pale)":"var(--cream)",color:hidePantry?"var(--moss)":"var(--ink)"}}>
            {hidePantry?`✓ Hiding ${hiddenByPantry} pantry items`:"Hide pantry items"}
          </button>}
        </div>

        <div style={{display:"flex",gap:8,marginTop:4,marginBottom:16}}>
          <input value={manualInput} onChange={e=>setManualInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addManual()} placeholder="Add item…"
            style={{flex:1,background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:12,padding:"9px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          <button onClick={addManual} className="btn-primary" style={{padding:"0 16px",borderRadius:12,fontSize:18}}>+</button>
        </div>

        {sortedGroupKeys.map(grp=>{const its=groups[grp];return(
          <div key={grp} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:8}}>{grp}</div>
            {its.map(m=>{
              const isMerged=groupBy==="aisle";
              const src=m.sources[0];
              const density=_densityGPerMl(m.name);
              const {qty,unit}=isMerged&&m.baseQty>0?_display(m.baseQty,m.type,unitOv[m.key],density):({qty:'',unit:''});
              const displayName=isMerged?(m.name||src?.text||''):(src?.text||'');
              const displayText=isMerged?`${qty?qty+' ':''}`:``;
              const merged=m.sources.length>1;
              return(
                <div key={m.key} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--sage-pale)"}}>
                  <button onClick={()=>isMerged?toggleMany(m.ids):toggle(src.id)}
                    style={{width:22,height:22,borderRadius:"50%",border:"2px solid var(--sage)",background:"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      {qty&&<span style={{fontSize:14,fontWeight:700,color:"var(--forest)"}}>{qty}</span>}
                      {unit&&<button onClick={()=>cycleUnit(m.key,m.type,unit,!!density)}
                        title="Tap to change unit"
                        style={{fontSize:11,fontWeight:700,background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:10,padding:"1px 7px",cursor:"pointer",color:"var(--moss)",flexShrink:0}}>
                        {unit} ↕
                      </button>}
                      <span style={{fontSize:14,color:"var(--ink)"}}>{displayName||src?.text}</span>
                    </div>
                    {merged&&<div style={{fontSize:11,color:"var(--mist)",marginTop:2}}>from {m.sources.map(s=>s.recipe).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}</div>}
                  </div>
                  <button onClick={()=>isMerged?removeMany(m.ids):remove(src.id)} style={{background:"none",border:"none",color:"var(--sage-lt)",fontSize:18,cursor:"pointer",lineHeight:1,flexShrink:0}}>×</button>
                </div>
              );
            })}
          </div>
        );})}

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
      {showPantry&&<PantrySheet onClose={()=>setShowPantry(false)}/>}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({session,onSignIn,onSignOut,syncStatus,recipes,onImport,onRunFix,fixProgress,onWhatsNew}){
  const[dark,setDark]=useState(()=>{try{return localStorage.getItem(KEYS.t)==="dark";}catch{return false;}});
  const[wakeLock,setWakeLock]=useState(()=>{try{return localStorage.getItem("fnp_wakelock")!=="off";}catch{return true;}});
  const[wakePhrase,setWakePhrase]=useState(()=>{try{return localStorage.getItem("fnp_wakephrase")||"";}catch{return "";}});
  const[signingIn,setSigningIn]=useState(false);
  const[cfg,setCfg]=useState(null);
  const[showDiag,setShowDiag]=useState(false);
  const importRef=useRef(null);
  const fixing=!!fixProgress?.running;

  useEffect(()=>{ if(showDiag&&!cfg){
    fetch("/api/config-check").then(r=>r.json()).then(setCfg).catch(()=>setCfg({error:true}));
  }},[showDiag,cfg]);

  function exportRecipes(){
    const blob=new Blob([JSON.stringify(recipes,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="fork-n-pantry-recipes.json";a.click();URL.revokeObjectURL(a.href);
  }
  function handleImportFile(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        const arr=Array.isArray(data)?data:[data];
        const valid=arr.filter(r=>r&&r.title);
        if(!valid.length){alert("No valid recipes found in file.");return;}
        onImport(valid);
        alert(`${valid.length} recipe${valid.length!==1?"s":""} imported!`);
      }catch{alert("Couldn't read file — make sure it's a Fork n Pantry JSON export.");}
    };
    reader.readAsText(file);
    e.target.value="";
  }

  function toggleDark(){
    const next=!dark;setDark(next);
    try{
      if(next){localStorage.setItem(KEYS.t,"dark");document.documentElement.setAttribute("data-theme","dark");}
      else{localStorage.removeItem(KEYS.t);document.documentElement.removeAttribute("data-theme");}
    }catch{}
  }
  function toggleWakeLock(){
    const next=!wakeLock;setWakeLock(next);
    try{next?localStorage.removeItem("fnp_wakelock"):localStorage.setItem("fnp_wakelock","off");}catch{}
  }
  function saveWakePhrase(v){
    const clean=v.replace(/[\n\r]/g,"");
    setWakePhrase(clean);
    try{clean.trim()?localStorage.setItem("fnp_wakephrase",clean.trim()):localStorage.removeItem("fnp_wakephrase");}catch{}
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
            <button onClick={toggleDark} style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",background:dark?"var(--moss)":"var(--sage-lt)",position:"relative",transition:"background .2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:dark?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
            </button>
          </div>
          <div style={row}>
            <div>
              <div style={label}>Keep Screen Awake in Cook Mode</div>
              <div style={sub}>Prevents phone screen sleep while cooking</div>
            </div>
            <button onClick={toggleWakeLock} style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",background:wakeLock?"var(--moss)":"var(--sage-lt)",position:"relative",transition:"background .2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:wakeLock?24:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
            </button>
          </div>
          <div style={{padding:"14px 0",borderBottom:"1px solid var(--sage-pale)"}}>
            <div style={label}>Cook Mode Wake Phrase</div>
            <div style={{...sub,marginBottom:8}}>Optional. Set a custom phrase (e.g. "hey chef") and you'll need to say it before every command — "hey chef, next". Leave blank to use the default, where you can also just say a short command like "next" on its own.</div>
            <input value={wakePhrase} onChange={e=>saveWakePhrase(e.target.value)} placeholder="Hey Fork (default)" maxLength={30}
              style={{width:"100%",background:"var(--cream)",border:"1.5px solid var(--parchment)",borderRadius:"var(--r-md)",padding:"10px 13px",fontSize:14,outline:"none",color:"var(--ink)"}}/>
          </div>
        </div>

        {/* Data */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>Data</div>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} style={{display:"none"}}/>
          <div style={row}>
            <div>
              <div style={label}>Export Recipes</div>
              <div style={sub}>Download all recipes as a JSON backup</div>
            </div>
            <button onClick={exportRecipes} disabled={!recipes.length} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:recipes.length?"pointer":"default",color:"var(--moss)",opacity:recipes.length?1:0.5}}>⬇ Export</button>
          </div>
          <div style={row}>
            <div>
              <div style={label}>Import Recipes</div>
              <div style={sub}>Restore from a JSON backup file</div>
            </div>
            <button onClick={()=>importRef.current?.click()} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",color:"var(--moss)"}}>⬆ Import</button>
          </div>
          {session&&(
            <div style={{...row,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={label}>Fix Recipe Images</div>
                <div style={sub}>Re-download &amp; permanently store photos, and pull sharper images for Instagram/TikTok recipes</div>
                {fixProgress&&(()=>{
                  const p=fixProgress,pct=p.total?Math.round((p.done/p.total)*100):0;
                  return(
                    <div style={{marginTop:8}}>
                      {/* progress bar */}
                      <div style={{height:6,borderRadius:4,background:"var(--parchment)",overflow:"hidden",marginBottom:6}}>
                        <div style={{height:"100%",width:`${pct}%`,background:"var(--moss)",transition:"width .3s"}}/>
                      </div>
                      <div style={{fontSize:12,color:"var(--charcoal)",fontWeight:600}}>
                        {p.running?`Checking ${p.done}/${p.total}…`:`Done — checked ${p.total}`}
                      </div>
                      <div style={{display:"flex",gap:12,marginTop:3,fontSize:12,flexWrap:"wrap"}}>
                        <span style={{color:"#15803D",fontWeight:700}}>✓ {p.fixed||0} restored</span>
                        <span style={{color:"var(--mist)"}}>— {p.skipped||0} already OK</span>
                        {(p.failed>0)&&<span style={{color:"#B91C1C",fontWeight:700}}>✗ {p.failed} failed</span>}
                      </div>
                      {p.running&&p.current&&<div style={{fontSize:11,color:"var(--mist)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Last: {p.current}</div>}
                      {/* Photo-upgrade (Apify) diagnostics */}
                      {p.enrichTried>0&&(
                        <div style={{fontSize:11,color:"var(--mist)",marginTop:3}}>
                          📸 Photo upgrades: {p.upgraded||0}/{p.enrichTried} succeeded
                          {(p.upgraded||0)<p.enrichTried&&p.enrichReason&&<span style={{color:"#B45309"}}> — issue: {p.enrichReason}</span>}
                        </div>
                      )}
                      {!p.running&&p.failed>0&&p.lastErr&&<div style={{fontSize:11,color:"#B91C1C",marginTop:3}}>{p.lastErr}</div>}
                    </div>
                  );
                })()}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                <button onClick={()=>onRunFix(false)} disabled={fixing||!recipes.length} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:fixing?"wait":"pointer",color:"var(--moss)",opacity:(fixing||!recipes.length)?.6:1,whiteSpace:"nowrap"}}>
                  {fixing?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span> Fixing…</>:(fixProgress&&!fixProgress.running?"🖼 Run again":"🖼 Fix Images")}
                </button>
                {!fixing&&<button onClick={()=>{if(confirm("Re-fetch fresh photos for ALL Instagram/TikTok recipes? Uses a little Apify credit."))onRunFix(true);}} disabled={!recipes.length} style={{background:"none",border:"none",fontSize:11,color:"var(--mist)",textDecoration:"underline",cursor:"pointer",whiteSpace:"nowrap"}}>Force re-upgrade</button>}
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--moss)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:4,paddingBottom:6,borderBottom:"1.5px solid var(--parchment)"}}>About</div>
          <div style={row}>
            <div>
              <div style={label}>What's New</div>
              <div style={sub}>See recent changes and improvements</div>
            </div>
            <button onClick={onWhatsNew} style={{background:"var(--sage-pale)",border:"1px solid var(--sage-lt)",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",color:"var(--moss)"}}>✨ What's New</button>
          </div>
          <div style={row}>
            <div style={label}>App Version</div>
            <span style={{fontSize:13,color:"var(--mist)"}}>Fork n Pantry v{APP_VERSION}</span>
          </div>
          <div style={{...row,cursor:"pointer"}} onClick={()=>setShowDiag(v=>!v)}>
            <div style={label}>Import services</div>
            <span style={{fontSize:13,color:"var(--mist)"}}>{showDiag?"Hide":"Check ▸"}</span>
          </div>
          {showDiag&&(
            <div style={{padding:"12px 16px",background:"var(--cream)",borderRadius:"var(--r-md)",border:"1px solid var(--parchment)",marginBottom:6}}>
              {!cfg&&<div style={{fontSize:13,color:"var(--mist)"}}>Checking…</div>}
              {cfg?.error&&<div style={{fontSize:13,color:"#B91C1C"}}>Couldn't reach the server.</div>}
              {cfg&&!cfg.error&&(()=>{
                const rows=[
                  ["AI parsing (Anthropic)",cfg.anthropic,true],
                  ["Cloud sync (Supabase)",cfg.supabaseUrl&&cfg.supabaseAnon,true],
                  ["Social scraper (Apify)",cfg.apify,false],
                  ["Permanent photos (Supabase key)",cfg.supabaseServiceKey,false],
                ];
                return rows.map(([name,ok,req])=>(
                  <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
                    <span style={{color:"var(--charcoal)"}}>{name}</span>
                    <span style={{fontWeight:700,color:ok?"#15803D":(req?"#B91C1C":"var(--mist)")}}>{ok?"✓ on":(req?"✗ missing":"— off")}</span>
                  </div>
                ));
              })()}
              <div style={{fontSize:11,color:"var(--mist)",marginTop:8,lineHeight:1.5}}>Grey "off" is optional. Set keys in Vercel → Environment Variables, then redeploy.</div>
            </div>
          )}
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
    // Strip quantities and stop-words; extract meaningful nouns from scanned items
    const stopWords=new Set(["a","an","the","of","with","and","or","fresh","dried","large","small","medium","big","whole","half","sliced","chopped","diced","minced","grated","ground","cooked","raw","frozen","canned","cup","cups","tbsp","tsp","oz","g","kg","ml","lb","lbs","teaspoon","tablespoon","pinch","handful","bunch","clove","cloves","piece","pieces","can","bottle"]);
    function extractNouns(s){
      return s.toLowerCase().replace(/[\d¼½¾⅓⅔⅛]/g,"").split(/[\s,]+/).map(w=>w.replace(/[^a-z]/g,"")).filter(w=>w.length>=3&&!stopWords.has(w));
    }
    const haveNouns=result.ingredients.flatMap(s=>extractNouns(s)).filter(Boolean);
    if(!haveNouns.length)return[];
    return recipes.map(r=>{
      const ings=(r.ingredients||[]).map(i=>(typeof i==="string"?i:i.name||"").toLowerCase());
      const recipeNouns=[...new Set(ings.flatMap(i=>extractNouns(i)))];
      const hits=haveNouns.filter(h=>recipeNouns.some(rn=>rn.includes(h)||h.includes(rn)));
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
    {id:"categories",label:"Cookbooks",icon:a=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" fill={a?"var(--moss)":"none"} stroke={a?"var(--moss)":"var(--mist)"} strokeWidth="1.8"/>
        <path d="M7 7h10M7 12h10M7 17h6" stroke={a?"#fff":"var(--mist)"} strokeWidth="1.8" strokeLinecap="round"/>
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
  {icon:"👨‍🍳",title:"Cook Mode",body:"Open any recipe and tap the big 'Start Cook Mode' button for a full-screen, step-by-step guide. Tap 🔊 Read aloud to hear the current step. Tap 🎙️ once to enable hands-free voice — it stays on until you tap again. Then just say a short command: 'next', 'back', 'repeat', 'what's next' (previews the next step without moving), or 'timer'. You can also prefix with 'Hey Fork' if you like. The screen stays awake while you cook (toggle in Settings)."},
  {icon:"⏱",title:"Timers",body:"Inside a recipe, tap the prep time or cook time chip to start a countdown timer. The timer banner shows at the top of the recipe. Tap Pause/Resume as needed. The banner turns amber when under 30 seconds and red when done."},
  {icon:"🛒",title:"Grocery List",body:"Open any recipe and tap '+ All' under Ingredients to add everything to your list, or tick individual ingredients and tap '+ Grocery' to add just those. The Grocery tab shows your full list. Tap items to check them off. Share the list via the 📤 button."},
  {icon:"📅",title:"Meal Planner",body:"The Planner tab shows a weekly meal grid. Tap any slot to assign a recipe. Use the ‹ › arrows to navigate between weeks. Tap 'Grocery' to build a shopping list from all planned meals automatically."},
  {icon:"📷",title:"Ingredient Scanner",body:"Go to the Scan tab (camera icon). Take a photo of ingredients, a meal, or food packaging. AI will identify what it sees and estimate the total calories, protein, carbs, and fat. Tap '+ Add to Grocery List' to add identified ingredients."},
  {icon:"📗",title:"Cookbooks",body:"The Cookbooks tab lets you group recipes into named collections — e.g. 'Weeknight Dinners' or 'Meal Prep'. Create a cookbook, pick an icon, then add recipes to it. Tap a cookbook to browse its recipes and share it with others."},
  {icon:"📤",title:"Sharing",body:"Open any recipe and tap the 📤 Share button to share the recipe title, ingredients, and method via any app. On the Grocery tab the 📤 button shares your shopping list. Both fall back to clipboard copy if native sharing isn't available."},
  {icon:"💾",title:"Backup & Export",body:"On the Recipes tab, scroll the filter pills to find ⬇ Export. This downloads all your recipes as a JSON file you can keep as a backup or import into another device in future."},
  {icon:"🌙",title:"Dark Mode",body:"Go to Settings (gear icon) and toggle Dark Mode. The theme is saved and applied automatically each time you open the app."},
];

function HelpModal({onClose}){
  const[open,setOpen]=useState(null);
  useBackHandler(true, onClose);
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

function WhatsNewModal({onClose}){
  useBackHandler(true, onClose);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.65)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)",zIndex:600,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--linen)",borderRadius:"24px 24px 0 0",width:"100%",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 48px rgba(15,24,17,.25)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div style={{width:34,height:4,background:"var(--sage-lt)",borderRadius:2,margin:"12px auto 0",flexShrink:0}}/>
        <div style={{padding:"14px 20px 10px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div className="serif" style={{fontWeight:600,fontSize:22,color:"var(--forest)"}}>✨ What's New</div>
            <div style={{fontSize:13,color:"var(--dust)",marginTop:2}}>Recent improvements to Fork n Pantry</div>
          </div>
          <button onClick={onClose} style={{background:"var(--sage-pale)",border:"none",borderRadius:"50%",width:32,height:32,fontSize:18,cursor:"pointer",color:"var(--forest)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"0 20px 24px"}}>
          {/* [PRO] Showcase block */}
          <div style={{marginBottom:22,borderRadius:"var(--r-lg)",overflow:"hidden",border:"1px solid var(--sage-lt)",background:"linear-gradient(160deg,#1E3828,#16291D)"}}>
            <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,fontWeight:800,letterSpacing:"0.08em",color:"#0A1A10",background:"linear-gradient(90deg,#FFD66B,#E8B84B)",borderRadius:20,padding:"3px 9px"}}>★ PRO</span>
              <span className="serif" style={{fontWeight:600,fontSize:16,color:"#F5F2EC"}}>Powerful new features</span>
            </div>
            <div style={{padding:"0 16px 16px",display:"flex",flexDirection:"column",gap:14}}>
              {PRO_FEATURES.map((f,i)=>(
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontSize:22,flexShrink:0,marginTop:1}}>{f.icon}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F5F2EC",marginBottom:3}}>{f.name}</div>
                    <div style={{fontSize:13,color:"rgba(245,242,236,.78)",lineHeight:1.55}}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {CHANGELOG.map((rel,i)=>(
            <div key={rel.v} style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:700,color:"#fff",background:"var(--forest)",borderRadius:20,padding:"3px 10px"}}>v{rel.v}</span>
                <span className="serif" style={{fontWeight:600,fontSize:16,color:"var(--forest)"}}>{rel.title}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {rel.items.map((it,j)=>(
                  <div key={j} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{color:"var(--moss)",fontSize:14,flexShrink:0,marginTop:1}}>✓</span>
                    <span style={{fontSize:14,color:"var(--charcoal)",lineHeight:1.5}}>{it}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={onClose} className="btn-primary" style={{width:"100%",padding:"13px 0",fontSize:14,borderRadius:"var(--r-md)",marginTop:4}}>Got it 👍</button>
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
async function storeImagePermanently(url,recipeId,userId,onErr){
  // Upload to Supabase Storage so Instagram/TikTok CDN expiry never breaks the image
  if(!url||url.startsWith("data:")||url.includes("supabase.co"))return url;
  try{
    const sb=getSupabase();if(!sb){onErr&&onErr("not signed in");return url;}
    const res=await fetch(`/api/img?url=${encodeURIComponent(url)}`);
    if(!res.ok||!res.headers.get("content-type")?.startsWith("image/")){onErr&&onErr("image source dead");return url;}
    const blob=await res.blob();
    const ext=blob.type.includes("png")?"png":blob.type.includes("webp")?"webp":"jpg";
    const path=`${userId}/${recipeId}.${ext}`;
    const{error}=await sb.storage.from("recipe-images").upload(path,blob,{contentType:blob.type,upsert:true});
    if(error){onErr&&onErr("storage: "+(error.message||"upload failed"));return url;}
    const{data:{publicUrl}}=sb.storage.from("recipe-images").getPublicUrl(path);
    return publicUrl;
  }catch(e){onErr&&onErr(e.message||"unknown error");return url;}
}

// ─── Shared cookbook cloud helpers ──────────────────────────────────────────── [PRO] Shared Cookbooks
async function sbPublishBook(book, session) {
  const sb = getSupabase(); if (!sb) return null;
  const { data, error } = await sb.from("shared_cookbooks").upsert({
    id: book.id,
    name: book.name,
    emoji: book.emoji || "📗",
    owner_id: session.user.id,
    owner_name: session.user.user_metadata?.full_name || session.user.email,
  }, { onConflict: "id" }).select().maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}
async function sbLoadMySharedBooks(session) {
  const sb = getSupabase(); if (!sb) return [];
  const { data } = await sb.from("shared_cookbooks").select("*").order("created_at");
  return data || [];
}
async function sbLoadSharedRecipes(cookbookId) {
  const sb = getSupabase(); if (!sb) return [];
  const { data } = await sb.from("shared_cookbook_recipes").select("*").eq("cookbook_id", cookbookId).order("created_at");
  return data || [];
}
async function sbAddSharedRecipe(cookbookId, recipe, session) {
  const sb = getSupabase(); if (!sb) return;
  await sb.from("shared_cookbook_recipes").insert({
    cookbook_id: cookbookId,
    recipe,
    added_by: session.user.id,
    added_by_name: session.user.user_metadata?.full_name || session.user.email,
  });
}
async function sbRemoveSharedRecipe(rowId) {
  const sb = getSupabase(); if (!sb) return;
  await sb.from("shared_cookbook_recipes").delete().eq("id", rowId);
}
async function sbGetBookByInvite(code) {
  const sb = getSupabase(); if (!sb) return null;
  const { data } = await sb.rpc("cookbook_by_invite", { code });
  return data?.[0] || null;
}
async function sbJoinCookbook(code, displayName="") {
  const sb = getSupabase(); if (!sb) return null;
  const { data, error } = await sb.rpc("join_cookbook", { code, display_name: displayName });
  if (error) throw new Error(error.message);
  return data;
}
async function sbLeaveCookbook(cookbookId) {
  const sb = getSupabase(); if (!sb) return;
  await sb.rpc("leave_cookbook", { p_cookbook_id: cookbookId });
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
  const[showWhatsNew,setShowWhatsNew]=useState(false);
  const[globalModalRecipe,setGlobalModalRecipe]=useState(null);
  const[session,setSession]=useState(null);
  const[syncStatus,setSyncStatus]=useState("idle");
  const[fixProgress,setFixProgress]=useState(null);
  const[sharedBooks,setSharedBooks]=useState([]);
  const[joinPreview,setJoinPreview]=useState(null);
  const[welcomed,setWelcomed]=useState(true); // true = skip screen until we check storage
  const[toast,setToast]=useState(null); // {type:"success"|"error", recipe?, message}
  const toastTimer=useRef(null);
  function setSelectedRecipeGlobal(r){setGlobalModalRecipe(r);}
  function showToast(type,recipe,message){
    clearTimeout(toastTimer.current);
    setToast({type,recipe,message});
    toastTimer.current=setTimeout(()=>setToast(null),4500);
  }
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
    const joinCode=searchParams.get("join");
    if(joinCode){router.replace("/");sessionStorage.setItem("fnp_join_code",joinCode);}
    try{const t=localStorage.getItem(KEYS.t);if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch{}
    // Show welcome screen on first ever open
    const seen=localStorage.getItem("fnp_welcomed");
    if(!seen)setWelcomed(false);
    // Auto-show What's New once per significant release. Skips first-ever install (welcome covers that),
    // and stays dismissed until a newer release is flagged `major` in CHANGELOG.
    try{
      const ack=localStorage.getItem("fnp_whatsnew_seen");
      if(seen&&ack!==LATEST_NOTABLE)setShowWhatsNew(true);
    }catch{}
    history.pushState({page:"app"},"");

    // Auth: get existing session, then listen for changes
    const sb=getSupabase();
    if(sb){
      sb.auth.getSession().then(({data:{session:s}})=>{
        setSession(s);
        if(s){
          syncOnLogin(s.user.id,localRecipes);
          sbLoadMySharedBooks(s).then(setSharedBooks);
          const pendingJoin=sessionStorage.getItem("fnp_join_code");
          if(pendingJoin){
            sessionStorage.removeItem("fnp_join_code");
            sbGetBookByInvite(pendingJoin).then(info=>{if(info)setJoinPreview({...info,code:pendingJoin});});
          }
        }
      });
      const{data:{subscription}}=sb.auth.onAuthStateChange((_event,s)=>{
        setSession(s);
        if(s){syncOnLogin(s.user.id,load(KEYS.r));sbLoadMySharedBooks(s).then(setSharedBooks);}
      });
      return()=>subscription.unsubscribe();
    }
  },[]);

  // Real-time subscription: refresh sharedBooks whenever any shared_cookbooks row changes
  useEffect(()=>{
    if(!session)return;
    const sb=getSupabase();if(!sb)return;
    const chan=sb.channel("shared-books-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"shared_cookbooks"},
        ()=>sbLoadMySharedBooks(session).then(setSharedBooks))
      .subscribe();
    return()=>chan.unsubscribe();
  },[session]);

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

  // Cookbook join prompt closes on back too
  useBackHandler(!!joinPreview, ()=>setJoinPreview(null));

  useEffect(()=>{
    function onPop(){
      // Close the topmost open overlay (modal, sheet, sub-view) first — consistent everywhere
      if(_backHandlers.length){
        const fn=_backHandlers[_backHandlers.length-1];
        fn();
        history.pushState({page:"app"},"");
        return;
      }
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
    // Save immediately so the UI responds instantly (Microlink's quick image shows first)
    setRecipes(prev=>{const u=[r,...prev.filter(x=>x.id!==r.id)];save(KEYS.r,u);return u;});
    if(session)cloudUpsert(r,session.user.id).then(()=>setSyncStatus("synced"));
    showToast("success",r,`"${r.title||"Recipe"}" saved`);
    if(!session?.user?.id)return;
    const uid=session.user.id;
    let cur=r; // latest version, so each swap compares against the freshest image
    const swapImage=(img,enriched)=>{
      if((!img||img===cur.ogImage)&&!enriched)return;
      const updated={...cur,...(img?{ogImage:img}:{}),...(enriched?{imgEnriched:true}:{})};cur=updated;
      setRecipes(prev=>{const u=prev.map(x=>x.id===updated.id?updated:x);save(KEYS.r,u);return u;});
      cloudUpsert(updated,uid);
    };
    const isSocial=/instagram\.com|tiktok\.com|facebook\.com|fb\.watch/i.test(r.url||"");
    (async()=>{
      // Social posts: fetch a full-res image via Apify + permanent re-host (server-side,
      // avoids the browser CORS block on Instagram CDN), then swap it in when ready.
      if(isSocial){
        try{
          const res=await fetch("/api/enrich-image",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({url:r.url,recipeId:r.id,userId:uid})});
          const data=await res.json();
          if(data.ok&&data.image){swapImage(data.image,data.permanent);if(data.permanent)return;}
        }catch{}
      }
      // Fallback / non-social: re-host the current image so a CDN link never expires
      if(cur.ogImage){
        const stored=await storeImagePermanently(cur.ogImage,r.id,uid);
        swapImage(stored);
      }
    })();
  }
  function deleteRecipe(id){
    const u=recipes.filter(r=>r.id!==id);setRecipes(u);save(KEYS.r,u);
    if(session)cloudDelete(id,session.user.id);
  }
  function updateRecipe(r){
    const u=recipes.map(x=>x.id===r.id?r:x);setRecipes(u);save(KEYS.r,u);
    if(session)cloudUpsert(r,session.user.id).then(()=>setSyncStatus("synced"));
  }

  // Re-store images for already-saved recipes so expired CDN links get replaced with permanent
  // Supabase copies, and upgrade social recipes to full-res Apify photos. onProgress is called
  // after each recipe with {done,total,fixed,failed,skipped,current}. Resumable: already-done
  // recipes are skipped, so re-running continues where an interrupted run left off.
  async function fixAllImages(onProgress,force){
    if(!session?.user?.id)return{fixed:0,failed:0,total:0};
    const uid=session.user.id;
    let fixed=0,failed=0,skipped=0,done=0,lastErr="",upgraded=0,enrichTried=0,enrichReason="";
    const total=recipes.length;
    const report=current=>{done++;onProgress&&onProgress({done,total,fixed,failed,skipped,current,upgraded,enrichTried,enrichReason});};
    for(const r of recipes){
      const isSocial=/instagram\.com|tiktok\.com|facebook\.com|fb\.watch/i.test(r.url||"");
      // Social posts: upgrade to the full-res Apify image once (even if already hosted).
      // imgEnriched guards against re-spending Apify credits on later repair runs;
      // force re-attempts regardless (used to redo images from earlier buggy runs).
      if(isSocial&&(force||!r.imgEnriched)){
        try{
          enrichTried++;
          const res=await fetch("/api/enrich-image",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({url:r.url,recipeId:r.id,userId:uid})});
          const data=await res.json();
          if(data.ok&&data.image&&data.permanent){
            const updated={...r,ogImage:data.image,imgEnriched:true};
            setRecipes(prev=>{const u=prev.map(x=>x.id===updated.id?updated:x);save(KEYS.r,u);return u;});
            cloudUpsert(updated,uid);
            fixed++;upgraded++;report(r.title);continue;
          }
          if(data&&data.reason)enrichReason=data.reason;
        }catch(e){enrichReason="request-failed";}
      }
      // Already permanent — nothing to do
      if(r.ogImage&&r.ogImage.includes("supabase.co")){skipped++;report(r.title);continue;}
      const onErr=msg=>{lastErr=msg;};
      let stored=r.ogImage?await storeImagePermanently(r.ogImage,r.id,uid,onErr):"";
      // If the current URL was dead (still not on supabase) try re-parsing the source for a fresh image
      if((!stored||!stored.includes("supabase.co"))&&r.url){
        try{
          const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:r.url})});
          const data=await res.json();
          if(data.ok&&data.ogImage)stored=await storeImagePermanently(data.ogImage,r.id,uid,onErr);
        }catch{}
      }
      if(stored&&stored!==r.ogImage&&stored.includes("supabase.co")){
        const updated={...r,ogImage:stored};
        setRecipes(prev=>{const u=prev.map(x=>x.id===updated.id?updated:x);save(KEYS.r,u);return u;});
        cloudUpsert(updated,uid);
        fixed++;
      } else if(r.ogImage&&!r.ogImage.includes("supabase.co")){
        failed++;
      } else {
        skipped++;
      }
      report(r.title);
    }
    return{fixed,failed,skipped,total,lastErr,upgraded,enrichTried,enrichReason};
  }

  // App-level so the run survives leaving the Settings screen (SettingsTab unmounting).
  async function runFixImages(force){
    if(fixProgress?.running)return;
    setFixProgress({running:true,done:0,total:recipes.length,fixed:0,failed:0,skipped:0,current:""});
    const res=await fixAllImages(p=>setFixProgress({running:true,...p}),force);
    setFixProgress({running:false,done:res.total,total:res.total,fixed:res.fixed,failed:res.failed,skipped:res.skipped,lastErr:res.lastErr,upgraded:res.upgraded,enrichTried:res.enrichTried,enrichReason:res.enrichReason});
  }

  // Keep the screen awake while the (potentially long) image fix runs; release when done.
  useEffect(()=>{
    if(!fixProgress?.running)return;
    let lock=null;
    const req=async()=>{try{lock=await navigator.wakeLock?.request("screen");}catch{}};
    req();
    // Wake locks auto-drop when the tab is hidden — re-acquire when it returns.
    const onVis=()=>{if(document.visibilityState==="visible"&&fixProgress?.running)req();};
    document.addEventListener("visibilitychange",onVis);
    return()=>{document.removeEventListener("visibilitychange",onVis);try{lock?.release();}catch{}};
  },[fixProgress?.running]);

  function dismissWelcome(){
    localStorage.setItem("fnp_welcomed","1");
    // New users start fresh — don't show them old release notes
    try{localStorage.setItem("fnp_whatsnew_seen",LATEST_NOTABLE);}catch{}
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
    setSession(null);setSyncStatus("idle");setSharedBooks([]);
  }

  async function handleJoin(){
    if(!joinPreview||!session)return;
    const displayName=session.user.user_metadata?.full_name||session.user.email||"Member";
    try{
      await sbJoinCookbook(joinPreview.code,displayName);
      const updated=await sbLoadMySharedBooks(session);
      setSharedBooks(updated);
      setJoinPreview(null);
      setTab("categories");
    }catch(e){
      alert("Couldn't join cookbook: "+e.message+"\n\nAsk the owner to check their Supabase SQL is up to date.");
    }
  }

  return(
    <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"var(--linen)"}}>
      {!welcomed&&<WelcomeScreen onSignIn={handleSignIn} onContinue={()=>{dismissWelcome();}}/>}
      <Header count={recipes.length} onHelp={()=>setShowHelp(true)} session={session} onAccountPress={()=>setTab("settings")}/>
      {showHelp&&<HelpModal onClose={()=>setShowHelp(false)}/>}
      {showWhatsNew&&<WhatsNewModal onClose={()=>{try{localStorage.setItem("fnp_whatsnew_seen",LATEST_NOTABLE);}catch{}setShowWhatsNew(false);}}/>}
      <RecipeModal recipe={globalModalRecipe} onClose={()=>setGlobalModalRecipe(null)} onUpdate={r=>{updateRecipe(r);setGlobalModalRecipe(r);}}/>
      {tab==="recipes"&&<RecipesTab recipes={recipes} onAdd={addRecipe} onDelete={deleteRecipe} onUpdate={updateRecipe} sharedPrefill={sharedPrefill} clearShared={()=>setSharedPrefill("")} onImportFail={()=>showToast("error",null,"Import failed — couldn't read that recipe")} onRefresh={session?async()=>{setSyncStatus("syncing");const cloud=await cloudLoad(session.user.id);if(cloud){setRecipes(cloud);save(KEYS.r,cloud);setSyncStatus("synced");}else setSyncStatus("idle");}:null}/>}
      {tab==="categories"&&<CookbooksTab recipes={recipes} categories={categories} setCategories={setCategories} onUpdate={updateRecipe} onAdd={addRecipe} session={session} sharedBooks={sharedBooks} onRefreshShared={()=>sbLoadMySharedBooks(session).then(setSharedBooks)}/>}
      {joinPreview&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,24,17,.6)",backdropFilter:"blur(5px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"var(--linen)",borderRadius:"var(--r-xl)",padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
            <div style={{fontSize:48,marginBottom:8}}>{joinPreview.emoji}</div>
            <div className="serif" style={{fontWeight:700,fontSize:22,color:"var(--forest)",marginBottom:6}}>{joinPreview.name}</div>
            <div style={{fontSize:13,color:"var(--mist)",marginBottom:24}}>Shared by {joinPreview.owner_name}</div>
            <div style={{fontSize:14,color:"var(--ink)",marginBottom:24,lineHeight:1.6}}>You've been invited to collaborate on this cookbook. Both of you can add and view recipes.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setJoinPreview(null)} className="btn-ghost" style={{flex:1,padding:"12px 0",borderRadius:"var(--r-md)"}}>Decline</button>
              <button onClick={handleJoin} className="btn-primary" style={{flex:1,padding:"12px 0",borderRadius:"var(--r-md)"}}>Join Cookbook</button>
            </div>
          </div>
        </div>
      )}
      {tab==="planner"&&<PlannerTab recipes={recipes} planner={planner} setPlanner={setPlanner} onUpdate={updateRecipe}/>}
      {tab==="scan"&&<ScanTab recipes={recipes} onOpenRecipe={r=>setSelectedRecipeGlobal(r)}/>}
      {tab==="grocery"&&<GroceryTab/>}
      {tab==="settings"&&<SettingsTab session={session} onSignIn={handleSignIn} onSignOut={handleSignOut} syncStatus={syncStatus} recipes={recipes} onImport={rs=>{const merged=[...rs.filter(r=>!recipes.find(x=>x.id===r.id)),...recipes];setRecipes(merged);save(KEYS.r,merged);}} onRunFix={runFixImages} fixProgress={fixProgress} onWhatsNew={()=>setShowWhatsNew(true)}/>}
      <TabBar tab={tab} setTab={setTab}/>
      {backToast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"rgba(15,24,17,.88)",color:"#fff",borderRadius:24,padding:"10px 20px",fontSize:13,fontWeight:600,zIndex:500,pointerEvents:"none",backdropFilter:"blur(8px)",whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,.3)"}}>
          Press back again to exit
        </div>
      )}
      {toast&&(
        <div style={{position:"fixed",bottom:90,left:12,right:12,zIndex:501,display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,.28)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",background:toast.type==="success"?"rgba(30,56,40,.95)":"rgba(120,20,20,.92)",color:"#fff",border:`1px solid ${toast.type==="success"?"rgba(74,222,128,.3)":"rgba(255,120,120,.3)"}`}}>
          <span style={{fontSize:20}}>{toast.type==="success"?"✓":"✕"}</span>
          <span style={{flex:1,fontSize:13,fontWeight:600,lineHeight:1.4}}>{toast.message}</span>
          {toast.type==="success"&&toast.recipe&&<button onClick={()=>{setGlobalModalRecipe(toast.recipe);setToast(null);}} style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>Open →</button>}
          <button onClick={()=>setToast(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:18,cursor:"pointer",lineHeight:1,padding:0,flexShrink:0}}>×</button>
        </div>
      )}
    </div>
  );
}

export default function App(){return <Suspense><AppInner/></Suspense>;}
