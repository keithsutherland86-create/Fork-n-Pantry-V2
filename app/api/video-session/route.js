// Opens a Gemini Files API upload session for a recipe video, and hands back the session URL.
// The phone then uploads the video DIRECTLY to Google with it — videos are far beyond the ~4.5MB
// a Vercel function can accept, and Google requires non-final chunks of 8MB, so relaying through
// here can't work. The session URL carries no API key (the key stays on this server), and Google
// only allows a browser to use it from the origin declared below.

const MAX_BYTES = 500 * 1024 * 1024;

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch { return Response.json({ ok:false, error:"Bad request" }, { status:400 }); }
  const size = Number(body.size);
  const mimeType = String(body.mimeType || "");
  if (!/^video\//.test(mimeType)) return Response.json({ ok:false, error:"That file isn't a video" }, { status:400 });
  if (!(size > 0)) return Response.json({ ok:false, error:"Empty video" }, { status:400 });
  if (size > MAX_BYTES) return Response.json({ ok:false, error:"That video is too large — record a shorter clip (under about 3 minutes)" }, { status:413 });

  // Only this app's own pages may open a session: each one is billed to our Gemini key.
  const origin = req.headers.get("origin");
  let sameSite = false;
  try { sameSite = !!origin && new URL(origin).host === req.headers.get("host"); } catch {}
  if (!sameSite) return Response.json({ ok:false, error:"Not allowed" }, { status:403 });

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Origin": origin, // lets the browser at this origin use the session URL (CORS)
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "recipe-video" } }),
    });
    const uploadUrl = res.headers.get("x-goog-upload-url");
    if (!res.ok || !uploadUrl) {
      console.error("video-session: start failed", res.status, await res.text().catch(() => ""));
      return Response.json({ ok:false, error:"Couldn't start the video upload" }, { status:502 });
    }
    return Response.json({ ok:true, uploadUrl });
  } catch (e) {
    console.error("video-session:", e?.message);
    return Response.json({ ok:false, error:"Couldn't start the video upload" }, { status:502 });
  }
}
