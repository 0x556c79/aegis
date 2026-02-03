'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

interface PendingAction {
  id: string;
  type: string;
  estimatedValue: number;
  description: string;
  payload?: any;
}

export function PendingActions() {
  const [actions, setActions] = useState<PendingAction[]>([]);
  // We handle privy auth gracefully even if mocked in dev
  const { login, authenticated } = usePrivy();

  useEffect(() => {
    fetchActions();
    const interval = setInterval(fetchActions, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchActions = async () => {
    try {
      const res = await fetch('/api/actions');
      const data = await res.json();
      if (data.actions) setActions(data.actions);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (action: PendingAction) => {
    if (!authenticated) {
        login();
        return;
    }

    try {
        // Simulating approval - in real world, sign the tx if payload has it
        // if (action.payload?.transaction) {
            // const signature = await signTransaction(action.payload.transaction);
        // }

        const res = await fetch(`/api/actions/${action.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvedBy: 'user' }), 
        });
        
        if (res.ok) {
            // Optimistically remove
            setActions(prev => prev.filter(a => a.id !== action.id));
        }
    } catch (e) {
        console.error('Approval failed', e);
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
        Pending Approvals ({actions.length})
      </h3>
      <div className="space-y-3">
        {actions.map(action => (
          <div key={action.id} className="bg-slate-800 p-3 rounded flex justify-between items-center border-l-4 border-yellow-500">
            <div>
              <p className="text-slate-200 font-medium">{action.description}</p>
              <p className="text-xs text-slate-400 uppercase mt-1">
                <span className="bg-slate-700 px-1.5 py-0.5 rounded mr-2">{action.type}</span> 
                Est. Value: ${action.estimatedValue}
              </p>
            </div>
            <button 
              onClick={() => handleApprove(action)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors shadow-lg shadow-indigo-500/20"
            >
              Approve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
