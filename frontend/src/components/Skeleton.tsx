// Placeholder block shown while data loads - shaped like the content it
// stands in for, so the page doesn't jump when real rows arrive. The pulse
// animation lives in index.css and is disabled under prefers-reduced-motion.
export default function Skeleton({ width, height = "1rem", className = "" }: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return <span className={`skeleton ${className}`.trim()} style={{ width, height }} aria-hidden="true" />;
}
