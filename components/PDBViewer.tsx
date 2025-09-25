import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, WhatsAppIcon } from './icons';

declare const $3Dmol: any;

interface PDBViewerProps {
  pdbId: string;
}

const PDBViewer: React.FC<PDBViewerProps> = ({ pdbId }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let viewer: any = null;
    if (viewerRef.current && pdbId) {
      setIsLoading(true);
      setError(null);
      const element = viewerRef.current;
      const config = { backgroundColor: 'black' };
      viewer = $3Dmol.createViewer(element, config);

      fetch(`https://files.rcsb.org/view/${pdbId}.pdb`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch PDB data for ${pdbId}. Status: ${res.status}`);
          }
          return res.text();
        })
        .then((pdbData) => {
          viewer.addModel(pdbData, 'pdb');
          viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
          viewer.zoomTo();
          viewer.render(() => {
            // Adjust zoom after initial render for a better default view
            viewer.zoom(0.8);
          });
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("PDB fetch error:", err);
          setError(`Could not load PDB structure for ID: ${pdbId}. Please ensure it's a valid ID.`);
          setIsLoading(false);
        });
    }

    return () => {
      if (viewer && viewer.clear) {
        viewer.clear();
      }
    };
  }, [pdbId]);
  
  const handleDownload = () => {
    fetch(`https://files.rcsb.org/view/${pdbId}.pdb`)
      .then(res => res.text())
      .then(data => {
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pdbId}.pdb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(err => console.error("Download error:", err));
  };

  const handleWhatsAppShare = () => {
    const text = `Check out this protein structure on RCSB PDB: ${pdbId}`;
    const url = `https://www.rcsb.org/structure/${pdbId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black min-h-[400px] w-full max-w-2xl relative">
      {isLoading && <div className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-70 z-10">Loading 3D View...</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center text-red-400 p-4 text-center z-10">{error}</div>}
      <div ref={viewerRef} style={{ width: '100%', height: '400px', position: 'relative' }} />
      {!isLoading && !error && (
        <div className="absolute top-2 right-2 flex gap-2 z-10">
            <button onClick={handleWhatsAppShare} className="p-2 bg-slate-800/70 text-white rounded-full hover:bg-slate-700 transition-colors" title="Share via WhatsApp">
                <WhatsAppIcon className="w-5 h-5" />
            </button>
            <button onClick={handleDownload} className="p-2 bg-slate-800/70 text-white rounded-full hover:bg-slate-700 transition-colors" title="Download PDB file">
                <DownloadIcon />
            </button>
        </div>
      )}
    </div>
  );
};

export default PDBViewer;