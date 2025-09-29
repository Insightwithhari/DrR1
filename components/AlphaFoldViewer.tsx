import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, LinkIcon, CheckIcon } from './icons';

declare const $3Dmol: any;

interface AlphaFoldViewerProps {
  uniprotId: string;
}

const AlphaFoldViewer: React.FC<AlphaFoldViewerProps> = ({ uniprotId }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const pdbUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId.toUpperCase()}-F1-model_v4.pdb`;

  useEffect(() => {
    let viewer: any = null;
    if (viewerRef.current && uniprotId) {
      setIsLoading(true);
      setError(null);
      const element = viewerRef.current;
      const config = { backgroundColor: '#1e293b' }; // slate-800
      viewer = $3Dmol.createViewer(element, config);

      fetch(pdbUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch AlphaFold data for ${uniprotId}. Status: ${res.status}`);
          }
          return res.text();
        })
        .then((pdbData) => {
          viewer.addModel(pdbData, 'pdb');
          viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
          viewer.zoomTo();
          viewer.render(() => {
            viewer.zoom(0.8);
          });
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("AlphaFold fetch error:", err);
          setError(`Could not load AlphaFold structure for UniProt ID: ${uniprotId}. This protein may not have a predicted structure available.`);
          setIsLoading(false);
        });
    }

    return () => {
      if (viewer && viewer.clear) {
        viewer.clear();
      }
    };
  }, [uniprotId, pdbUrl]);
  
  const handleDownload = () => {
    fetch(pdbUrl)
      .then(res => res.text())
      .then(data => {
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AF-${uniprotId}-F1-model_v4.pdb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(err => console.error("Download error:", err));
  };

  const handleShareLink = () => {
    const url = `https://alphafold.ebi.ac.uk/entry/${uniprotId.toUpperCase()}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-800 min-h-[400px] w-full max-w-2xl relative">
      {isLoading && <div className="absolute inset-0 flex items-center justify-center text-white bg-slate-800 bg-opacity-70 z-10">Loading AlphaFold Prediction...</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center text-red-400 p-4 text-center z-10">{error}</div>}
      <div ref={viewerRef} style={{ width: '100%', height: '400px', position: 'relative' }} />
      {!isLoading && !error && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
            <button onClick={handleShareLink} className="p-2 bg-slate-900/70 text-white rounded-full hover:bg-slate-700 transition-colors" title="Copy link to AlphaFold entry">
                {copied ? <CheckIcon className="w-5 h-5 text-emerald-400" /> : <LinkIcon />}
            </button>
            <button onClick={handleDownload} className="p-2 bg-slate-900/70 text-white rounded-full hover:bg-slate-700 transition-colors" title="Download PDB file">
                <DownloadIcon />
            </button>
        </div>
      )}
    </div>
  );
};

export default AlphaFoldViewer;
