import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, WhatsAppIcon } from './icons';

declare const $3Dmol: any;

interface PDBViewerProps {
  id: string;
  source: 'rcsb' | 'alphafold';
}

const PDBViewer: React.FC<PDBViewerProps> = ({ id, source }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let viewer: any = null;
    if (viewerRef.current && id) {
      setIsLoading(true);
      setError(null);
      
      const element = viewerRef.current;
      const config = { backgroundColor: 'black' };
      viewer = $3Dmol.createViewer(element, config);

      const url = source === 'alphafold'
        ? `https://alphafold.ebi.ac.uk/files/AF-${id}-F1-model_v4.pdb`
        : `https://files.rcsb.org/view/${id}.pdb`;

      fetch(url)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch PDB data for ${id} from ${source}. Status: ${res.status}`);
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
          console.error("PDB fetch error:", err);
          const dbName = source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB';
          setError(`Could not load structure for ID: ${id} from ${dbName}. Please ensure it's a valid ID.`);
          setIsLoading(false);
        });
    }

    return () => {
      if (viewer && viewer.clear) {
        viewer.clear();
      }
    };
  }, [id, source]);
  
  const handleDownload = () => {
    const url = source === 'alphafold'
      ? `https://alphafold.ebi.ac.uk/files/AF-${id}-F1-model_v4.pdb`
      : `https://files.rcsb.org/view/${id}.pdb`;
    const filename = source === 'alphafold' ? `AF-${id}-model_v4.pdb` : `${id}.pdb`;

    fetch(url)
      .then(res => res.text())
      .then(data => {
        const blob = new Blob([data], { type: 'text/plain' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(err => console.error("Download error:", err));
  };

  const handleWhatsAppShare = () => {
    const dbName = source === 'alphafold' ? "AlphaFold DB" : "RCSB PDB";
    const text = `Check out this protein structure on ${dbName}: ${id}`;
    const url = source === 'alphafold' 
      ? `https://alphafold.ebi.ac.uk/entry/${id}`
      : `https://www.rcsb.org/structure/${id}`;
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
