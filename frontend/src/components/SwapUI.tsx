import { useState, useEffect } from 'react';
import { ethers, Contract, Signer } from 'ethers';
import {
    SimpleSwapAddress, SimpleSwapABI,
    TokenAAddress, TokenABI, TokenBAddress
} from '../config';

interface SwapUIProps {
    signer: Signer;
}

export function SwapUI({ signer }: SwapUIProps) {
    // --- STATE MANAGEMENT ---
    const [amountIn, setAmountIn] = useState('');
    const [amountOut, setAmountOut] = useState('');
    const [isAtoB, setIsAtoB] = useState(true); // NEW: State to track swap direction. true = A -> B, false = B -> A
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');

    // --- CONTRACT INSTANCES ---
    // We need instances for both tokens to handle approvals dynamically
    const simpleSwapContract = new Contract(SimpleSwapAddress, SimpleSwapABI, signer);
    const tokenAContract = new Contract(TokenAAddress, TokenABI, signer);
    const tokenBContract = new Contract(TokenBAddress, TokenABI, signer);

    // --- DYNAMIC VARIABLES BASED ON SWAP DIRECTION ---
    // MODIFIED: Determine tokens and symbols based on the isAtoB state
    const tokenInAddress = isAtoB ? TokenAAddress : TokenBAddress;
    const tokenOutAddress = isAtoB ? TokenBAddress : TokenAAddress;
    const tokenInSymbol = isAtoB ? 'TKA' : 'TKB';
    const tokenOutSymbol = isAtoB ? 'TKB' : 'TKA';
    const tokenInContract = isAtoB ? tokenAContract : tokenBContract;

    // --- LOGIC HOOKS ---
    // MODIFIED: This effect now dynamically calculates amountOut based on the selected direction
    useEffect(() => {
        const getAmountOut = async () => {
            if (!amountIn || Number(amountIn) <= 0) {
                setAmountOut('');
                return;
            }
            try {
                const amountInWei = ethers.parseEther(amountIn);
                const [reserveA, reserveB] = await simpleSwapContract.getReserves(TokenAAddress, TokenBAddress);
                
                // Determine which reserve is "in" and which is "out"
                const reserveIn = isAtoB ? reserveA : reserveB;
                const reserveOut = isAtoB ? reserveB : reserveA;

                const amountOutWei = await simpleSwapContract.getAmountOut(amountInWei, reserveIn, reserveOut);
                setAmountOut(ethers.formatEther(amountOutWei));

            } catch (error) {
                console.error("Could not get amount out", error);
                setAmountOut('0');
            }
        };

        const timeoutId = setTimeout(getAmountOut, 500);
        return () => clearTimeout(timeoutId);

    }, [amountIn, isAtoB, simpleSwapContract]); // NEW: Added isAtoB as a dependency


    // --- HANDLER FUNCTIONS ---

    // NEW: Function to flip the swap direction
    const handleFlipDirection = () => {
        setIsAtoB(prev => !prev);
        // Swap the input and output amounts to maintain context for the user
        setAmountIn(amountOut);
        setAmountOut(amountIn);
    };

    // MODIFIED: This function now dynamically approves and swaps based on direction
    const handleSwap = async () => {
        if (!amountIn || Number(amountIn) <= 0) return alert("Please enter a valid amount.");

        setIsProcessing(true);
        setProcessingMessage('Approving...');
        try {
            const amountInWei = ethers.parseEther(amountIn);
            
            // 1. Approve the correct input token
            const allowance = await tokenInContract.allowance(await signer.getAddress(), SimpleSwapAddress);
            if (allowance < amountInWei) {
                const approveTx = await tokenInContract.approve(SimpleSwapAddress, amountInWei);
                await approveTx.wait();
            }

            // 2. Execute the swap with the correct path
            setProcessingMessage('Swapping...');
            const swapPath = [tokenInAddress, tokenOutAddress];
            const swapTx = await simpleSwapContract.swapExactTokensForTokens(
                amountInWei,
                0, // 0 slippage for simplicity
                swapPath,
                await signer.getAddress(),
                Math.floor(Date.now() / 1000) + 60
            );

            await swapTx.wait();
            alert('Swap successful!');

        } catch (error) {
            console.error("Swap failed:", error);
            alert("Swap failed. Check console for details.");
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
            setAmountIn('');
            setAmountOut('');
        }
    };

    // --- RENDER ---
    return (
        <div className="swap-container">
            <h3>Swap Tokens</h3>
            
            <div className="input-group">
                <label htmlFor="token-in">You Pay ({tokenInSymbol})</label>
                <input
                    id="token-in"
                    type="number"
                    value={amountIn}
                    onChange={(e) => setAmountIn(e.target.value)}
                    placeholder="0.0"
                />
            </div>

            {/* NEW: Flip button */}
            <div style={{ margin: '-0.5rem 0', cursor: 'pointer' }} onClick={handleFlipDirection}>
                <span style={{ fontSize: '1.5rem' }}>↓</span>
            </div>

            <div className="input-group">
                <label htmlFor="token-out">You Receive ({tokenOutSymbol})</label>
                <input
                    id="token-out"
                    type="number"
                    value={amountOut ? Number(amountOut).toFixed(4) : ''}
                    placeholder="0.0"
                    disabled
                />
            </div>
            <button onClick={handleSwap} disabled={isProcessing}>
                {isProcessing ? processingMessage : "Swap"}
            </button>
        </div>
    );
}