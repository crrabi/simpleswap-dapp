import { useState, useEffect } from 'react';
import { ethers, Contract, BrowserProvider } from 'ethers';
import { SimpleSwapAddress, SimpleSwapABI, TokenAAddress, TokenBAddress } from '../config';

interface PriceViewerProps {
    provider: BrowserProvider;
}

export function PriceViewer({ provider }: PriceViewerProps) {
    const [price, setPrice] = useState<string>("Loading price...");

    useEffect(() => {
        // Read-only contract instance
        const simpleSwapContract = new Contract(SimpleSwapAddress, SimpleSwapABI, provider);

        const fetchPrice = async () => {
            try {
                //Call the contract's getPrice function
                const rawPrice = await simpleSwapContract.getPrice(TokenAAddress, TokenBAddress);
                
                // Format the price for display
                const formattedPrice = ethers.formatEther(rawPrice);
                setPrice(`1 TKA = ${Number(formattedPrice).toFixed(4)} TKB`);
            } catch (error) {
                console.error("Failed to fetch price:", error);
                setPrice("Could not fetch price");
            }
        };

        // Calls once on load and then every 10 seconds
        fetchPrice();
        const interval = setInterval(fetchPrice, 10000);

        // Clean the gap when the component is disassembled
        return () => clearInterval(interval);

    }, [provider]);

    return (
        <div className="price-container">
            <h3>Live Price</h3>
            <p>{price}</p>
        </div>
    );
}