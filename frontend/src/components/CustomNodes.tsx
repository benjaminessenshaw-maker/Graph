
import { Handle, Position } from '@xyflow/react';
import { Database, Bot, FileText } from 'lucide-react';

export const DataNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-2xl rounded-md bg-zinc-900 border-2 border-green-500 min-w-[150px] text-zinc-100">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-green-900/30 mr-2 border border-green-500/30">
          <Database size={16} className="text-green-400" />
        </div>
        <div className="ml-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Data Node</div>
          <div className="text-sm font-semibold text-zinc-100">{data.label || 'New Record'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-green-500 border-none" />
    </div>
  );
};

export const PromptNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-2xl rounded-md bg-zinc-900 border-2 border-yellow-500 min-w-[200px] text-zinc-100">
      <div className="flex items-center mb-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-yellow-900/30 mr-2 border border-yellow-500/30">
          <FileText size={16} className="text-yellow-400" />
        </div>
        <div className="ml-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Prompt Node</div>
        </div>
      </div>
      <div className="text-xs text-zinc-300 italic bg-zinc-950 p-2 rounded border border-zinc-800 max-h-20 overflow-hidden">
        {data.prompt || 'Enter instructions...'}
      </div>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-yellow-500 border-none" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-yellow-500 border-none" />
    </div>
  );
};

export const AgentNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-2xl rounded-md bg-zinc-900 border-2 border-purple-500 min-w-[150px] text-zinc-100">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-purple-900/30 mr-2 border border-purple-500/30">
          <Bot size={16} className="text-purple-400" />
        </div>
        <div className="ml-2">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Agent Node</div>
          <div className="text-sm font-semibold text-zinc-100">{data.model || 'GPT-4o'}</div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-purple-500 border-none" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-purple-500 border-none" />
    </div>
  );
};
