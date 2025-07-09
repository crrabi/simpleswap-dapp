import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import {
    SimpleSwapAddress, SimpleSwapABI,
    TokenAAddress, TokenABI, TokenBAddress
} from '../config';

interface SwapUIProps {
    signer: ethers.Signer;
}

export function SwapUI({ signer }: SwapUIProps) {
    const [amountIn, setAmountIn] = useState('');
    const [amountOut, setAmountOut] = useState('');
    const [isApproving, setIsApproving] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);

    // instantiate the contracts
    const simpleSwapContract = new Contract(SimpleSwapAddress, SimpleSwapABI, signer);
    const tokenAContract = new Contract(TokenAAddress, TokenABI, signer);

    useEffect(() => {
        const getAmountOut = async () => {
            if (!amountIn || Number(amountIn) <= 0) {
                setAmountOut('');
                return;
            }
            try {
                const amountInWei = ethers.parseEther(amountIn);
                const reserves = await simpleSwapContract.getReserves(TokenAAddress, TokenBAddress);
                const reserveIn = reserves[0]; // reserveA
                const reserveOut = reserves[1]; // reserveB

                const amountOutWei = await simpleSwapContract.getAmountOut(amountInWei, reserveIn, reserveOut);
                setAmountOut(ethers.formatEther(amountOutWei));
            } catch (error) {
                console.error("Could not get amount out", error);
                setAmountOut('0');
            }
        };

        const timeoutId = setTimeout(() => {
            getAmountOut();
        }, 500); // Debounce to avoid calling on every keystroke

        return () => clearTimeout(timeoutId);

    }, [amountIn, simpleSwapContract]);


    const handleSwap = async () => {
        if (!amountIn || Number(amountIn) <= 0) return alert("Please enter a valid amount.");

        setIsApproving(true);
        try {
            const amountInWei = ethers.parseEther(amountIn);
            
            // 1. Approve token spending
            const allowance = await tokenAContract.allowance(await signer.getAddress(), SimpleSwapAddress);

            if (allowance < amountInWei) {
                const approveTx = await tokenAContract.approve(SimpleSwapAddress, amountInWei);
                await approveTx.wait();
            }

            // 2. Execute the swap
            setIsApproving(false);
            setIsSwapping(true);
            const swapTx = await simpleSwapContract.swapExactTokensForTokens(
                amountInWei,
                0, // slippage protection (0 to simplify)
                [TokenAAddress, TokenBAddress],
                await signer.getAddress(),
                Math.floor(Date.now() / 1000) + 60 // 1 minute of deadline
            );

            await swapTx.wait();
            alert('Swap successful!');

        } catch (error) {
            console.error("Swap failed:", error);
            alert("Swap failed. Check console for details.");
        } finally {
            setIsApproving(false);
            setIsSwapping(false);
            setAmountIn('');
            setAmountOut('');
        }
    };


    return (
        <div className="swap-container">
            <h3>Swap Tokens</h3>
            <div className="input-group">
                <label htmlFor="token-in">You Pay (TKA)</label>
                <input
                    id="token-in"
                    type="number"
                    value={amountIn}
                    onChange={(e) => setAmountIn(e.target.value)}
                    placeholder="0.0"
                />
            </div>
            <div className="input-group">
                <label htmlFor="token-out">You Receive (TKB)</label>
                <input
                    id="token-out"
                    type="number"
                    value={amountOut ? Number(amountOut).toFixed(4) : ''}
                    placeholder="0.0"
                    disabled
                />
            </div>
            <button onClick={handleSwap} disabled={isApproving || isSwapping}>
                {isApproving ? "Approving..." : isSwapping ? "Swapping..." : "Swap"}
            </button>
        </div>
    );
}