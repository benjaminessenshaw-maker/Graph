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
    <div className="fixed right-0 top-0 h-full w-full sm:w-80 bg-white shadow-2xl border-l z-[1000] flex flex-col transition-transform duration-300 transform translate-x-0">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="font-bold">Edit Node: {node.id}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <X size={20} />
        </button>
      </div>
      <div className="p-4 flex-1 overflow-auto">
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
          <div className="text-sm px-2 py-1 bg-gray-100 rounded">{node.type}</div>
        </div>
        <div className="mb-4 flex-1 flex flex-col">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data (JSON)</label>
          <textarea
            className={`w-full flex-1 p-2 font-mono text-xs border rounded focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'}`}
            value={jsonValue}
            onChange={handleJsonChange}
            rows={20}
          />
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      </div>
      <div className="p-4 border-t bg-gray-50">
        <p className="text-[10px] text-gray-400">Changes are automatically saved to the backend.</p>
      </div>
    </div>
  );
};
