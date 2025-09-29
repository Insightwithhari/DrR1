import React from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { LinkIcon } from './icons';

interface UniProtSummaryProps {
  uniprotId: string;
  summary: string;
}

const UniProtSummary: React.FC<UniProtSummaryProps> = ({ uniprotId, summary }) => {
  const url = `https://www.uniprot.org/uniprotkb/${uniprotId.toUpperCase()}/entry`;
  return (
    <div className="p-4 my-2 bg-[var(--input-background-color)] rounded-lg border border-[var(--border-color)]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold primary-text">UniProt Summary: {uniprotId.toUpperCase()}</h3>
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[var(--muted-foreground-color)] hover:primary-text">
            View on UniProt <LinkIcon className="w-3 h-3" />
        </a>
      </div>
      <MarkdownRenderer content={summary} />
    </div>
  );
};

export default UniProtSummary;
