import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, Bot, FileText } from 'lucide-react';

export const DataNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-green-500 min-w-[150px]">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-green-100 mr-2">
          <Database size={16} className="text-green-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Data Node</div>
          <div className="text-sm font-semibold">{data.label || 'New Record'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-green-500" />
    </div>
  );
};

export const PromptNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-yellow-500 min-w-[200px]">
      <div className="flex items-center mb-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-yellow-100 mr-2">
          <FileText size={16} className="text-yellow-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Prompt Node</div>
        </div>
      </div>
      <div className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded max-h-20 overflow-hidden">
        {data.prompt || 'Enter instructions...'}
      </div>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-yellow-500" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-yellow-500" />
    </div>
  );
};

export const AgentNode = ({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-purple-500 min-w-[150px]">
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-purple-100 mr-2">
          <Bot size={16} className="text-purple-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Agent Node</div>
          <div className="text-sm font-semibold">{data.model || 'GPT-4o'}</div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-purple-500" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-purple-500" />
    </div>
  );
};
