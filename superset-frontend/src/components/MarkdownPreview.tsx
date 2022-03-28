import React from 'react'
import ReactMarkdown from 'react-markdown';

type Props = {
  source: string;
}


function isSafeMarkup(node: ReactMarkdown.MarkdownAbstractSyntaxTree) {
  if (node.type === 'html') {
    return /href="(javascript|vbscript|file):.*"/gim.test(node.value || '') === false;
  }

  return true;
}

function MarkdownPreview({ source }: Props) {
  return (
    <ReactMarkdown
      source={source}
      escapeHtml={false}
      allowNode={isSafeMarkup}
    />
  );
}

export default MarkdownPreview
