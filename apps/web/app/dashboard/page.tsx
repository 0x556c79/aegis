import { PendingActions } from '../../components/agents/PendingActions';
import { VaultControl } from '../../components/portfolio/VaultControl';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">AEGIS Dashboard</h1>
          <p className="text-slate-400">Autonomous Economic Guardian & Investment System</p>
        </header>
        
        {/* Human-in-the-loop Approvals */}
        <PendingActions />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Vault Controls */}
            <VaultControl />

            {/* Portfolio Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 min-h-[400px] flex flex-col">
                <h3 className="text-lg font-medium text-slate-200 mb-4">Portfolio Performance</h3>
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg">
                    <span className="text-slate-500">Portfolio Chart Visualization</span>
                </div>
            </div>

            {/* Agent Activity */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-slate-200 mb-4">Agent Swarm Activity</h3>
                <div className="space-y-3 text-sm">
                    <div className="flex items-center text-slate-300">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                        <span className="font-mono text-indigo-400 mr-2">[SENTINEL]</span>
                        Monitoring wallet risk metrics (Risk Score: 92/100)
                    </div>
                    <div className="flex items-center text-slate-300">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
                        <span className="font-mono text-cyan-400 mr-2">[ANALYST]</span>
                        Analyzing volume spikes in JUP/SOL pairs
                    </div>
                    <div className="flex items-center text-slate-300">
                        <span className="w-2 h-2 bg-slate-600 rounded-full mr-3"></span>
                        <span className="font-mono text-purple-400 mr-2">[TRADER]</span>
                        Idle - Waiting for opportunities
                    </div>
                </div>
            </div>
          </div>
          
          <div className="space-y-6">
             {/* Chat Interface */}
             <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 h-full flex flex-col">
                <h3 className="text-lg font-medium text-slate-200 mb-4">Swarm Intelligence</h3>
                <div className="flex-1 bg-slate-950 rounded-lg mb-4 p-4 border border-slate-800 text-sm text-slate-400 overflow-y-auto">
                    <p className="mb-2"><span className="text-indigo-400 font-bold">AEGIS:</span> Welcome back, Commander. All systems operational. Portfolio is balanced.</p>
                </div>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Ask AEGIS..." 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-4 pr-10 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                    />
                    <button className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}
