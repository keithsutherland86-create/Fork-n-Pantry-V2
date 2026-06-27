export const metadata = { title: "Privacy Policy – Fork n Pantry" };

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif", color: "#1a1a1a", lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Fork n Pantry · Last updated: June 2026</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>What we collect</h2>
      <p>When you sign in with Google, we receive your name, email address, and profile photo from Google. We use this only to identify your account and display your name in the app.</p>
      <p>Your recipes, grocery lists, and meal plans are stored in our secure database (Supabase) and are only accessible to you.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>How we use your data</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>To sync your recipes across your devices</li>
        <li>To display your name and profile photo in the app</li>
        <li>We do not sell your data to third parties</li>
        <li>We do not use your data for advertising</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Data storage</h2>
      <p>Your data is stored securely using Supabase (hosted on AWS). Each user's data is isolated and protected using row-level security — only you can access your recipes.</p>
      <p>Camera images used in the ingredient scanner are sent to Anthropic's Claude API for analysis and are not stored on our servers.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Deleting your data</h2>
      <p>You can sign out at any time from the Settings tab. To permanently delete your account and all associated data, email us at <a href="mailto:keith.sutherland@levelelectrical.com.au" style={{ color: "#2D5441" }}>keith.sutherland@levelelectrical.com.au</a>.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Third-party services</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li><strong>Google OAuth</strong> — for sign-in only</li>
        <li><strong>Supabase</strong> — secure data storage</li>
        <li><strong>Anthropic Claude</strong> — AI recipe parsing and ingredient scanning</li>
        <li><strong>Vercel</strong> — app hosting</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 }}>Contact</h2>
      <p>Questions? Email <a href="mailto:keith.sutherland@levelelectrical.com.au" style={{ color: "#2D5441" }}>keith.sutherland@levelelectrical.com.au</a></p>

      <p style={{ marginTop: 48, color: "#999", fontSize: 13 }}>© 2026 Fork n Pantry</p>
    </div>
  );
}
