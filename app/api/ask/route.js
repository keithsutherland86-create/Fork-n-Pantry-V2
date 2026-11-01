// "Ask about this recipe": answers a cooking question (substitutions, scaling, make-ahead, what to
// serve with it…) in the context of one specific recipe. Advice only — the client never changes
// the recipe from an answer; the user can choose to save an answer to their private notes.
// [PRO] When the paywall lands: check the user is Pro and enforce a per-user cap here (server-side,
// so it can't be bypassed), sized so their AI cost stays well below the subscription price.

export const maxDuration = 60;

const SYSTEM = `You are the cooking assistant inside a recipe app. The user is looking at one specific recipe (given below) and asking about it.

How to answer:
- Be brief and practical: a few sentences, or a short list using "- " lines. Plain text only — no headings, bold or other markdown.
- Use the recipe's actual ingredients, amounts and steps. When quantities matter, give them for the number of servings the user is currently viewing.
- Substitutions: suggest the best 1-3 options, with amounts, and say briefly how each changes the dish.
- Facts about THIS recipe must come from the recipe text. If the recipe doesn't say something (an oven temperature, a cooking time), say that it doesn't, then give general guidance and make clear it's general guidance.
- Food safety: be accurate and conservative (safe internal temperatures, how long food keeps). For allergies, also remind them to check the labels of packaged ingredients.
- If the question isn't about food or cooking, say in one sentence that you can help with this recipe.
- Reply in the language the user writes in.`;

function recipeText(r, servings) {
  const ing = (r.ingredients || []).map(i => {
    if (typeof i === "string") return `- ${i}`;
    return `- ${[i.amount || "", i.unit || "", i.name || ""].join(" ").replace(/\s+/g, " ").trim()}`;
  }).join("\n");
  const steps = (r.steps || []).map((s, n) => `${n + 1}. ${s}`).join("\n");
  const base = Number(r.servings) || 0;
  const now = Number(servings) || base;
  return [
    `Recipe: ${r.title || "Untitled"}`,
    r.description ? `Description: ${r.description}` : "",
    base ? `Serves: ${base}${now && now !== base ? ` (the user is viewing it scaled to ${now} servings — scale amounts by ${+(now / base).toFixed(2)})` : ""}` : "",
    [r.prepTime && `Prep: ${r.prepTime}`, r.cookTime && `Cook: ${r.cookTime}`].filter(Boolean).join(" · "),
    ing ? `Ingredients:\n${ing}` : "Ingredients: (none listed)",
    steps ? `Method:\n${steps}` : "Method: (none listed)",
    r.notes ? `Notes: ${r.notes}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 12000);
}

export async function POST(req) {
  // Only this app's own pages: every question is billed to our Gemini key.
  const origin = req.headers.get("origin");
  let sameSite = false;
  try { sameSite = !!origin && new URL(origin).host === req.headers.get("host"); } catch {}
  if (!sameSite) return Response.json({ ok:false, error:"Not allowed" }, { status:403 });

  let body = {};
  try { body = await req.json(); } catch { return Response.json({ ok:false, error:"Bad request" }, { status:400 }); }
  const question = String(body.question || "").trim();
  if (!question) return Response.json({ ok:false, error:"Ask a question first" }, { status:400 });
  if (question.length > 500) return Response.json({ ok:false, error:"That question is too long — keep it under 500 characters" }, { status:400 });
  if (!body.recipe || typeof body.recipe !== "object") return Response.json({ ok:false, error:"No recipe" }, { status:400 });

  // Earlier questions in this conversation, so follow-ups ("what about for 8 people?") make sense
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter(t => t && typeof t.q === "string" && typeof t.a === "string")
    .flatMap(t => [
      { role:"user", parts:[{ text:t.q.slice(0, 500) }] },
      { role:"model", parts:[{ text:t.a.slice(0, 1500) }] },
    ]);

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts:[{ text:`${SYSTEM}\n\n---\n${recipeText(body.recipe, body.servings)}` }] },
        contents: [...history, { role:"user", parts:[{ text:question }] }],
        // Thinking must stay non-zero (these models reject 0) and well below the output cap, or it
        // can eat the whole budget — see the parse route.
        generationConfig: { maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 512 } },
      }),
      signal: AbortSignal.timeout(45000),
    });
    const data = await res.json();
    const answer = (data.candidates?.[0]?.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
    if (!res.ok || data.error || !answer) {
      console.error("ask: Gemini", res.status, JSON.stringify(data.error || data.candidates?.[0]?.finishReason));
      return Response.json({ ok:false, error:"Couldn't get an answer just now — try again" }, { status:502 });
    }
    return Response.json({ ok:true, answer });
  } catch (e) {
    console.error("ask:", e?.message);
    return Response.json({ ok:false, error:"Couldn't get an answer just now — try again" }, { status:502 });
  }
}
