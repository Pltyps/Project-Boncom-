import Icon, { type IconName } from "./Icon";

// Each Toolshed app gets its own launcher-style badge - a symbol on a tinted
// square, like a home-screen app icon. Keyed by slug so the visual identity
// lives here in one place; the DB only knows names and descriptions. Unknown
// slugs (e.g. the seeded "coming soon" placeholders) fall back to a wrench -
// it is a toolshed, after all.
interface Branding {
  displayName?: string;
  icon?: IconName;
  /** Typographic mark used instead of an icon (Quot:D's "Q:D" monogram). */
  text?: string;
  tone: "green" | "navy-soft" | "gold" | "neutral";
}

const BRANDING: Record<string, Branding> = {
  quoted: { displayName: "Quot:D", text: "Q:D", tone: "green" },
  timesheets: { icon: "clock", tone: "gold" },
  "asset-library": { icon: "image", tone: "navy-soft" },
  "admin/users": { icon: "users", tone: "navy-soft" },
};

const FALLBACK: Branding = { icon: "wrench", tone: "neutral" };

export function appDisplayName(slug: string, fallback: string): string {
  return BRANDING[slug]?.displayName ?? fallback;
}

export default function AppBadge({ slug }: { slug: string }) {
  const b = BRANDING[slug] ?? FALLBACK;
  return (
    <span className={`app-badge app-badge-${b.tone}`} aria-hidden="true">
      {b.text ? <span className="app-badge-text">{b.text}</span> : <Icon name={b.icon!} size={24} />}
    </span>
  );
}
