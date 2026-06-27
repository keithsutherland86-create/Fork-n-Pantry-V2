export const metadata = { title: "Fork n Pantry – Your Personal Recipe Collection" };

export default function About() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#1a1a1a", background: "#F4F0E6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🍴</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#2A3D2A", marginBottom: 8 }}>Fork n Pantry</h1>
        <p style={{ fontSize: 20, color: "#4a6741", marginBottom: 40, lineHeight: 1.5 }}>
          Your personal recipe collection — save, organise, and cook with ease.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2A3D2A", marginBottom: 16 }}>What is Fork n Pantry?</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, marginBottom: 24, color: "#333" }}>
          Fork n Pantry is a free progressive web app (PWA) that lets you save recipes from anywhere —
          paste a URL, share from Instagram, snap a photo, or speak them aloud. Your recipes sync
          across devices when you sign in with Google.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2A3D2A", marginBottom: 16 }}>Features</h2>
        <ul style={{ fontSize: 16, lineHeight: 2, paddingLeft: 20, marginBottom: 32, color: "#333" }}>
          <li>Save recipes from any website, Instagram, or TikTok caption</li>
          <li>AI-powered recipe parsing — just paste a URL or text</li>
          <li>Organise into categories and plan your weekly meals</li>
          <li>Cook Mode with step-by-step instructions and screen-on</li>
          <li>Grocery list builder from recipe ingredients</li>
          <li>Scan food labels to check nutrition</li>
          <li>Works offline — installable as an app on Android and iOS</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#2A3D2A", marginBottom: 16 }}>Sign in with Google</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, marginBottom: 32, color: "#333" }}>
          Signing in with Google is optional. It lets you sync your recipes across devices.
          You can also use the app as a visitor — your recipes are saved locally on your device.
          We only use your name, email, and profile photo to identify your account.
          We never sell your data. See our{" "}
          <a href="/privacy" style={{ color: "#2A3D2A" }}>Privacy Policy</a>.
        </p>

        <a href="/"
          style={{ display: "inline-block", background: "#2A3D2A", color: "#fff", padding: "14px 32px",
            borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: "none" }}>
          Open the App →
        </a>
      </div>
    </div>
  );
}
