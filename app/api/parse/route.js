import { fetchViaApify } from "../../../lib/social";

// Pull og:image, og:title and a clean recipe text summary (from JSON-LD if present) out of a page's HTML
function extractFromHtml(html, fallbackTitle = "") {
  let ogImage = "", ogTitle = fallbackTitle, pageText = "", hasRecipeLd = false;

  const imgPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
    /"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
  ];
  for (const p of imgPatterns) {
    const m = html.match(p);
    if (m?.[1]?.startsWith("http")) { ogImage = m[1].replace(/&amp;/g,"&").replace(/&#38;/g,"&"); break; }
  }
  const t = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (t) ogTitle = t[1];

  // Extract JSON-LD structured recipe data (most recipe sites include this)
  const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of ldMatches) {
    try {
      const json = JSON.parse(match[1].trim());
      const items = Array.isArray(json) ? json : (json["@graph"] || [json]);
      const recipe = items.find(i => (i["@type"] === "Recipe" || (Array.isArray(i["@type"]) && i["@type"].includes("Recipe"))));
      if (recipe) {
        hasRecipeLd = true;
        if (!ogImage) {
          const img = recipe.image;
          let imgUrl = typeof img === "string" ? img : Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : img[0]?.url || img[0]?.contentUrl) : img?.url || img?.contentUrl;
          if (imgUrl) imgUrl = imgUrl.replace(/&amp;/g,"&").replace(/&#38;/g,"&");
          if (imgUrl?.startsWith("http")) ogImage = imgUrl;
        }
        const ingList = (recipe.recipeIngredient || []).join("\n");
        const stepList = (recipe.recipeInstructions || []).map((s,i) => `${i+1}. ${typeof s === "string" ? s : s.text || ""}`).join("\n");
        pageText = `Title: ${recipe.name || ogTitle}
Description: ${recipe.description || ""}
Yield: ${recipe.recipeYield || ""}
Prep time: ${recipe.prepTime || ""}
Cook time: ${recipe.cookTime || ""}
Total time: ${recipe.totalTime || ""}
Category: ${recipe.recipeCategory || ""}
Cuisine: ${recipe.recipeCuisine || ""}

INGREDIENTS:
${ingList}

INSTRUCTIONS:
${stepList}

Nutrition per serving: calories ${recipe.nutrition?.calories || ""}, protein ${recipe.nutrition?.proteinContent || ""}, carbs ${recipe.nutrition?.carbohydrateContent || ""}, fat ${recipe.nutrition?.fatContent || ""}`.trim();
        break;
      }
    } catch {}
  }

  if (!pageText) {
    pageText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<script[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,5000);
  }
  return { ogImage, ogTitle, pageText, hasRecipeLd };
}

// Find the first external recipe-page link in a caption/description (skips the social platforms and link aggregators)
function findRecipeLinkInText(text) {
  if (!text) return "";
  const urls = text.match(/https?:\/\/[^\s)"'<>]+/gi) || [];
  const skip = /(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|twitter\.com|x\.com|threads\.net|pinterest\.|cdninstagram|fbcdn|amzn\.|amazon\.)/i;
  for (const u of urls) {
    const clean = u.replace(/[.,);]+$/,"");
    if (!skip.test(clean)) return clean;
  }
  return "";
}

async function fetchHtml(url, timeout = 7000) {
  const agents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "facebookexternalhit/1.1",
  ];
  for (const ua of agents) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": ua, "Accept": "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeout) });
      if (r.ok) return await r.text();
    } catch {}
  }
  return "";
}

export async function POST(req) {
  const body = await req.json();
  const { input = "", imageBase64 = "", imageMediaType = "image/jpeg", mode = "", existing = null, robust = false } = body;
  const isDeep = mode === "deep";

  // ── Nutrition scan mode ───────────────────────────────────────────────────────
  if (mode === "nutrition" && imageBase64) {
    const msgContent = [
      { type:"image", source:{ type:"base64", media_type:imageMediaType, data:imageBase64 } },
      { type:"text", text:`Look at this image of ingredients/food. List what you can see and estimate the total nutrition.\nReturn ONLY raw JSON, no markdown:\n{"ingredients": ["2 chicken breasts", "1 cup rice"], "nutrition": {"calories": 450, "protein": 35, "carbs": 60, "fat": 8}, "summary": "Grilled chicken with rice"}` }
    ];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:600, messages:[{ role:"user", content:msgContent }] }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return Response.json({ ok:false, error:"API error" }, { status:500 });
    const text = data.content?.find(b=>b.type==="text")?.text || "{}";
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      return Response.json({ ok:true, mode:"nutrition", ...parsed });
    } catch {
      return Response.json({ ok:false, error:"Parse failed" }, { status:422 });
    }
  }

  const isUrl = input.trim().startsWith("http");
  const isSocial = /(instagram\.com|tiktok\.com|facebook\.com|fb\.watch)/i.test(input);
  let pageText = "", ogImage = "", ogTitle = "", caption = "";

  // ── oEmbed for Instagram / TikTok — gets caption text without auth ────────────
  if (isUrl) {
    const isInstagram = /instagram\.com\/(p|reel|tv)\//i.test(input);
    const isTikTok = /tiktok\.com\/@[^/]+\/video\//i.test(input);
    if (isInstagram || isTikTok) {
      // ── Robust tier: dedicated scraper (Apify). Slow cold-start, so only run when the
      //    client escalates (robust:true) after the quick methods failed. Inert without a key.
      if (robust) {
        const ap = await fetchViaApify(input, isInstagram, isTikTok);
        if (ap) {
          if (ap.caption) { caption = ap.caption; pageText = caption; }
          if (ap.image && !ogImage) ogImage = ap.image;
          if (ap.title && !ogTitle) ogTitle = ap.title;
        }
      }
      // ── Quick + free: public oEmbed (deprecated for IG, but harmless & fast to try) ──
      if (!caption) {
        try {
          const oEmbedUrl = isInstagram
            ? `https://api.instagram.com/oembed/?url=${encodeURIComponent(input)}&maxwidth=400`
            : `https://www.tiktok.com/oembed?url=${encodeURIComponent(input)}`;
          const oRes = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(5000) });
          if (oRes.ok) {
            const oData = await oRes.json();
            // caption / title is typically in oData.title — strip leading username
            caption = (oData.title || "").replace(/^@[\w.]+:\s*/,"");
            if (caption) pageText = caption;
            if (oData.thumbnail_url && !ogImage) ogImage = oData.thumbnail_url;
            ogTitle = ogTitle || oData.title || "";
          }
        } catch {}
      }
    }
  }

  if (isUrl) {
    // ── Step 1: Direct fetch for page content (needed for Claude to parse the recipe) ──
    const html = await fetchHtml(input, 6000);
    if (html) {
      const ex = extractFromHtml(html, ogTitle);
      if (ex.ogImage) ogImage = ex.ogImage;
      if (ex.ogTitle) ogTitle = ex.ogTitle;
      if (ex.pageText) pageText = ex.pageText;
      // If the page itself is a social caption, capture it so we can hunt for a recipe link
      if (!caption && ex.pageText) caption = ex.pageText;
    }

    // ── Step 1b: Follow a recipe link found in the video caption/description ──
    // Videos often say "Full recipe 👉 https://myblog.com/..." — that page parses far better than the caption.
    if (!/INGREDIENTS:/.test(pageText)) {
      const link = findRecipeLinkInText(caption || pageText);
      if (link) {
        const linkHtml = await fetchHtml(link, 7000);
        if (linkHtml) {
          const lx = extractFromHtml(linkHtml, ogTitle);
          // Only prefer the linked page if it actually yielded a structured recipe
          if (lx.hasRecipeLd && lx.pageText) {
            pageText = lx.pageText;
            if (lx.ogImage) ogImage = lx.ogImage; // a blog's recipe photo is cleaner & more stable than a social CDN thumbnail
            if (lx.ogTitle) ogTitle = lx.ogTitle;
          }
        }
      }
    }

    // For social posts the HTML fetch only ever returns a login wall, so any pageText we
    // extracted from it is junk. Unless oEmbed gave us a real caption, drop it so Microlink's
    // headless-browser description (which usually contains the caption) can take over.
    const haveRealRecipeText = /INGREDIENTS:/.test(pageText) || !!caption;
    if (isSocial && !haveRealRecipeText) pageText = "";

    // ── Step 2: Microlink (headless browser — run in deep mode, when we lack an image,
    //    or for social posts where we still have no usable recipe text) ──
    if (!ogImage || isDeep || (isSocial && !pageText)) {
      try {
        const mlKey = process.env.MICROLINK_API_KEY;
        const mlUrl = `https://api.microlink.io?url=${encodeURIComponent(input)}${mlKey ? `&apiKey=${mlKey}` : ""}`;
        const mlRes = await fetch(mlUrl, { signal: AbortSignal.timeout(10000) });
        const mlData = await mlRes.json();
        if (mlData.status === "success") {
          if (!ogImage && mlData.data?.image?.url) ogImage = mlData.data.image.url;
          const mlText = [mlData.data?.title, mlData.data?.description].filter(Boolean).join("\n");
          if (!pageText) { ogTitle = ogTitle || mlData.data?.title || ""; pageText = mlText; }
          else if (isDeep && mlText) pageText = pageText + "\n\n[Additional context from page]\n" + mlText;
        }
      } catch {}
    }
  }

  const schema = `{
  "title": "",
  "source": "",
  "description": "",
  "servings": 4,
  "prepTime": "",
  "cookTime": "",
  "ingredients": [{ "amount": 2, "unit": "cup", "name": "plain flour" }],
  "steps": [],
  "tags": [],
  "emoji": "",
  "imageSearch": "",
  "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
}`;

  const rules = `Rules:
- nutrition: estimate per serving (all integers)
- servings: integer
- prepTime/cookTime: "15 mins" style
- ingredients: amount (number), unit (abbrev or null for countable), name MUST include descriptive prep words if available e.g. "finely chopped onion", "sliced chicken breast", "whole garlic cloves", "roughly torn basil leaves" — never just "onion" if the recipe says "finely chopped onion"
- tags: 2-5 lowercase: chicken,dinner,pasta,vegan,quick,vegetarian,dessert,breakfast,soup,salad,beef,fish,seafood
- emoji: one dish emoji
- source: site/platform name
- imageSearch: 2-3 English words describing the dish for a food photo search e.g. "spaghetti carbonara pasta", "chocolate lava cake", "green thai curry"`;

  const context = imageBase64
    ? null
    : isUrl && pageText
      ? `URL: ${input}${ogTitle?`\nTitle: ${ogTitle}`:""}\n\nPage content:\n${pageText}`
      : isUrl ? `URL: ${input}` : input;

  const deepPrefix = isDeep && existing ? `A previous parse of this recipe was incomplete. What was found so far:
- Title: ${existing.title || "unknown"}
- Ingredients: ${existing.ingredientCount || 0} items found (expected more)
- Steps: ${existing.stepCount || 0} items found (expected more)

Dig deeper into the content below. Infer and reconstruct ingredients and steps from any context clues — amounts mentioned, techniques described, visuals referenced. Be thorough and fill every field.\n\n` : "";

  const prompt = isDeep
    ? `${deepPrefix}Extract a COMPLETE recipe from this content. Be exhaustive — infer missing details from context. Return ONLY raw JSON, no markdown:\n\n${context}\n\n${schema}\n\n${rules}`
    : `Extract recipe details from this content. Return ONLY raw JSON, no markdown:\n\n${context}\n\n${schema}\n\n${rules}`;

  const msgContent = imageBase64
    ? [
        { type:"image", source:{ type:"base64", media_type:imageMediaType, data:imageBase64 } },
        { type:"text", text:`Extract recipe details from this image. Return ONLY raw JSON, no markdown:\n\n${schema}\n\n${rules}` }
      ]
    : [{ type:"text", text:prompt }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({
      model: isDeep ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
      max_tokens: isDeep ? 3000 : 1400,
      messages:[{ role:"user", content:msgContent }]
    }),
  });

  const data = await res.json();
  if(!res.ok || data.error) {
    console.error("Claude API error:", JSON.stringify(data));
    return Response.json({ ok:false, error: data.error?.message || "API error" }, { status:500 });
  }
  const text = data.content?.find(b=>b.type==="text")?.text || "";
  // No text came back (e.g. only a non-text block, or hit max_tokens before any output)
  if(!text.trim()){
    console.error("Claude returned no text. stop_reason:", data.stop_reason, "content:", JSON.stringify(data.content));
    const msg = isSocial
      ? "Instagram/TikTok didn't share this post's caption. Open the post, copy its full caption text, and paste that here instead of the link."
      : `No recipe text returned (${data.stop_reason||"empty"})`;
    return Response.json({ ok:false, error: msg }, { status:422 });
  }

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    // Guard against a successful-but-empty result becoming a blank "Untitled" card
    const hasContent = parsed && (parsed.title || (parsed.ingredients||[]).length || (parsed.steps||[]).length);
    if(!hasContent){
      const msg = isSocial
        ? "Instagram/TikTok didn't share this post's caption. Open the post, copy its full caption text, and paste that here instead of the link."
        : "Couldn't extract a recipe from that — try a different link or manual entry.";
      return Response.json({ ok:false, error: msg }, { status:422 });
    }

    let finalImage = ogImage;

    if (!finalImage && parsed.imageSearch) {
      // ── Option A: Unsplash API (50 req/hr free — add UNSPLASH_ACCESS_KEY in Vercel env vars) ──
      if (process.env.UNSPLASH_ACCESS_KEY) {
        try {
          const uRes = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(parsed.imageSearch)}&per_page=1&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`,
            { signal: AbortSignal.timeout(4000) }
          );
          const uData = await uRes.json();
          const url = uData.results?.[0]?.urls?.regular;
          if (url) finalImage = url + "&w=600&q=80";
        } catch {}
      }

      // ── Option B: Hardcoded curated food photos by tag (always available, no key needed) ──
      if (!finalImage) {
        const foodPhotos = {
          pasta:       "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
          spaghetti:   "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
          chicken:     "https://images.unsplash.com/photo-1598103442097-8b74394b95c7?w=600&q=80",
          beef:        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
          steak:       "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
          fish:        "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          salmon:      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
          seafood:     "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          shrimp:      "https://images.unsplash.com/photo-1565680018093-ebb6b9ab5460?w=600&q=80",
          prawn:       "https://images.unsplash.com/photo-1565680018093-ebb6b9ab5460?w=600&q=80",
          salad:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          soup:        "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
          stew:        "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
          dessert:     "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          cake:        "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          chocolate:   "https://images.unsplash.com/photo-1606312619070-d48b2c0a3b3a?w=600&q=80",
          cookie:      "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80",
          breakfast:   "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
          pancake:     "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
          egg:         "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80",
          vegetarian:  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          vegan:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          pizza:       "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
          curry:       "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
          rice:        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80",
          fried:       "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
          stir:        "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
          sandwich:    "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80",
          wrap:        "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80",
          taco:        "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
          burger:      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
          bread:       "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&q=80",
          muffin:      "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&q=80",
          noodle:      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
          ramen:       "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
          pork:        "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80",
          lamb:        "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80",
          mushroom:    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
          default:     "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
        };
        const search = (parsed.imageSearch + " " + (parsed.tags||[]).join(" ") + " " + (parsed.title||"")).toLowerCase();
        const match = Object.keys(foodPhotos).find(k => search.includes(k));
        finalImage = foodPhotos[match || "default"];
      }
    }

    // If image was uploaded, use it as the recipe image
    if (imageBase64 && !finalImage) {
      finalImage = `data:${imageMediaType};base64,${imageBase64}`;
    }

    return Response.json({ ok:true, recipe:parsed, ogImage:finalImage });
  } catch {
    return Response.json({ ok:false, error:"Parse failed" }, { status:422 });
  }
}
