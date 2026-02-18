import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditPanelProps {
  node: any;
  onClose: () => void;
  onSave: (nodeId: string, newData: any) => void;
}

export const EditPanel = ({ node, onClose, onSave }: EditPanelProps) => {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(node.data, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonValue(JSON.stringify(node.data, null, 2));
    setError(null);
  }, [node]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonValue(val);
    try {
      const parsed = JSON.parse(val);
      setError(null);
      onSave(node.id, parsed);
    } catch (err: any) {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-80 bg-zinc-900 text-zinc-100 shadow-2xl border-l border-zinc-700 z-[1000] flex flex-col transition-transform duration-300 transform translate-x-0">
      <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-950">
        <h2 className="font-bold">Edit Node</h2>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors">
          <X size={20} className="text-zinc-400" />
        </button>
      </div>
      <div className="p-4 flex-1 overflow-auto">
        <div className="mb-6">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Node ID</label>
          <div className="text-xs font-mono text-zinc-400">{node.id}</div>
        </div>
        <div className="mb-6">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Type</label>
          <div className="inline-block text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 uppercase">{node.type}</div>
        </div>
        <div className="mb-4 flex-1 flex flex-col">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Data (JSON)</label>
          <textarea
            className={`w-full flex-1 p-3 font-mono text-xs bg-zinc-950 text-green-400 border rounded focus:outline-none focus:ring-1 ${error ? 'border-red-500 focus:ring-red-500/20' : 'border-zinc-700 focus:ring-zinc-500/20'}`}
            value={jsonValue}
            onChange={handleJsonChange}
            rows={20}
            spellCheck={false}
          />
          {error && <div className="text-red-400 text-[10px] mt-1 font-bold uppercase tracking-tighter">{error}</div>}
        </div>
      </div>
      <div className="p-4 border-t border-zinc-700 bg-zinc-950">
        <p className="text-[10px] text-zinc-500 italic">Changes are auto-saved.</p>
      </div>
    </div>
  );
};
