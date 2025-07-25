import { useState, useEffect } from 'react';
import { ethers, Contract, BrowserProvider } from 'ethers';
import { SimpleSwapAddress, SimpleSwapABI, TokenAAddress, TokenBAddress } from '../config';

// Define the shape of our state object for clarity
interface PoolStats {
    totalSupply: string;
    reserveA: string;
    reserveB: string;
    error: string | null;
}

interface PoolInfoProps {
    provider: BrowserProvider;
}

export function PoolInfo({ provider }: PoolInfoProps) {
    const [stats, setStats] = useState<PoolStats>({
        totalSupply: "...",
        reserveA: "...",
        reserveB: "...",
        error: null,
    });

    useEffect(() => {
        // Create a read-only instance of the SimpleSwap contract
        const simpleSwapContract = new Contract(SimpleSwapAddress, SimpleSwapABI, provider);

        const fetchPoolStats = async () => {
            try {
                // Fetch all data points in parallel for efficiency
                const [rawTotalSupply, rawReserves] = await Promise.all([
                    simpleSwapContract.totalSupply(),
                    simpleSwapContract.getReserves(TokenAAddress, TokenBAddress)
                ]);

                // Format the numbers for display
                const formattedTotalSupply = ethers.formatEther(rawTotalSupply);
                const formattedReserveA = ethers.formatEther(rawReserves[0]);
                const formattedReserveB = ethers.formatEther(rawReserves[1]);
                
                // Update the state with the new data
                setStats({
                    totalSupply: `${Number(formattedTotalSupply).toFixed(4)} SLP`,
                    reserveA: `${Number(formattedReserveA).toFixed(4)} TKA`,
                    reserveB: `${Number(formattedReserveB).toFixed(4)} TKB`,
                    error: null,
                });

            } catch (error: any) {
                console.error("Failed to fetch pool stats:", error);
                const reason = error.reason || "Could not fetch pool data";
                setStats(prev => ({ ...prev, error: reason, totalSupply: 'N/A', reserveA: 'N/A', reserveB: 'N/A' }));
            }
        };

        // Fetch once on load, then set an interval to refresh every 15 seconds
        fetchPoolStats();
        const interval = setInterval(fetchPoolStats, 15000);

        // Cleanup: clear the interval when the component is unmounted
        return () => clearInterval(interval);

    }, [provider]);

    return (
        <div className="pool-info-container">
            <h3>💧 Pool Liquidity</h3>
            <div className="stats-grid">
                <span>Total LP Tokens:</span>
                <span className="stat-value">{stats.totalSupply}</span>

                <span>Token A Reserve:</span>
                <span className="stat-value">{stats.reserveA}</span>
                
                <span>Token B Reserve:</span>
                <span className="stat-value">{stats.reserveB}</span>
            </div>
            {stats.error && <p style={{color: '#ff9999', fontSize: '0.8rem', marginTop: '1rem'}}>Error: {stats.error}</p>}
        </div>
    );
}