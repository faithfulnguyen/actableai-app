import React from 'react'

interface IHighlighterProps {
  text: string;
  highlight?: RegExp;
  HighlightComponent: Function;
}

function Highlighter({text, highlight, HighlightComponent}: IHighlighterProps) {
  if (!text || !highlight) return <>{text}</>;
  const matches = text?.toString().match(highlight);
  const parts: React.ReactNode[] = text?.toString().split(highlight);

  if(!matches) return <>{text}</>;

  for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
    let match = matches[partIndex];
    // While the next part is an empty string, merge the corresponding match with the current
    // match into a single <span/> to avoid consequent spans with nothing between them.
    while(parts[partIndex + 1] === '') {
      match += matches[++partIndex];
    }

    parts[partIndex] = (
      <React.Fragment key={partIndex}>
        {parts[partIndex]}<HighlightComponent>{match}</HighlightComponent>
      </React.Fragment>
    );
  }
  return <div className="highlighter">{parts}</div>;
};
export default Highlighter


