'use client';

import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createDepositInstruction, createWithdrawInstruction, DEVNET_USDC_MINT } from '../../lib/anchor-client';

export function VaultControl() {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0]; // Primary wallet

  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  const handleAction = async () => {
    if (!authenticated || !wallet) {
        login();
        return;
    }

    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    try {
        // Mock connection - in real app use generic provider or configured RPC
        const connection = new Connection('https://api.devnet.solana.com');
        const userPublicKey = new PublicKey(wallet.address);
        
        // Convert amount to atoms (USDC has 6 decimals)
        const amountAtoms = Math.floor(Number(amount) * 1_000_000);

        let instruction;
        if (activeTab === 'deposit') {
            // owner = userPublicKey (self-custody vault), user = userPublicKey
            instruction = await createDepositInstruction(userPublicKey, userPublicKey, amountAtoms, DEVNET_USDC_MINT);
        } else {
            instruction = await createWithdrawInstruction(userPublicKey, userPublicKey, amountAtoms, DEVNET_USDC_MINT);
        }

        const tx = new Transaction().add(instruction);
        
        const latestBlockhash = await connection.getLatestBlockhash();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = userPublicKey;

        // Privy sign/send
        await wallet.signAndSendTransaction(tx);
        
        alert(`${activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`);
        setAmount('');
    } catch (e: any) {
        console.error(e);
        alert(`Failed: ${e.message}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg className="w-32 h-32 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
      </div>

      <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
        <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        Vault Controls
      </h3>

      {!authenticated ? (
        <div className="text-center py-8">
            <p className="text-slate-400 mb-4">Connect wallet to manage funds</p>
            <button 
                onClick={login}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-indigo-500/20"
            >
                Connect Wallet
            </button>
        </div>
      ) : (
        <div>
            {/* Tabs */}
            <div className="flex space-x-2 mb-6 bg-slate-800/50 p-1 rounded-lg inline-flex">
                <button 
                    onClick={() => setActiveTab('deposit')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'deposit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    Deposit
                </button>
                <button 
                    onClick={() => setActiveTab('withdraw')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'withdraw' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                    Withdraw
                </button>
            </div>

            {/* Input */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Amount (USDC)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        />
                        <div className="absolute right-4 top-3.5 text-slate-500 font-medium">USDC</div>
                    </div>
                </div>

                {/* Summary / Fee (Mock) */}
                <div className="bg-slate-800/30 rounded px-4 py-3 text-sm text-slate-400 flex justify-between">
                    <span>Estimated Fee</span>
                    <span className="text-slate-300">~0.000005 SOL</span>
                </div>

                <button 
                    onClick={handleAction}
                    disabled={loading || !amount}
                    className={`w-full py-3.5 font-medium rounded-lg transition-all shadow-lg flex justify-center items-center ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/25'}`}
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Processing...
                        </>
                    ) : (
                        `${activeTab === 'deposit' ? 'Deposit to' : 'Withdraw from'} Vault`
                    )}
                </button>
                
                <p className="text-xs text-center text-slate-500 mt-4">
                    Protected by <span className="text-indigo-400 font-semibold">AEGIS Sentinel</span> • Risk Checks Active
                </p>
            </div>
        </div>
      )}
    </div>
  );
