interface Props {
  text: string;
}

// CSS-only tooltip (:hover/:focus-within in index.css) so this needs no
// state, no positioning library, and works with both mouse and keyboard.
export default function InfoTooltip({ text }: Props) {
  return (
    <span className="info-tooltip" tabIndex={0} aria-label={text}>
      <span aria-hidden="true">ⓘ</span>
      <span className="info-tooltip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
