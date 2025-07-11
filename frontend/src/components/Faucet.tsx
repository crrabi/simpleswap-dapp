import { useState } from 'react';
import { ethers, Contract } from 'ethers';
import { TokenAAddress, TokenBAddress, TokenABI } from '../config';

// Define the type for the props that this component will receive.
// It expects a 'signer' object from ethers.js, which is required to send transactions.
interface FaucetProps {
    signer: ethers.Signer;
}

export function Faucet({ signer }: FaucetProps) {
    // State to track if a transaction is currently in progress to disable buttons.
    const [isClaiming, setIsClaiming] = useState(false);
    // State to specify which token ('A' or 'B') is being claimed for specific button feedback.
    const [claimTarget, setClaimTarget] = useState<'A' | 'B' | null>(null);
    // State to display feedback messages (e.g., success, error, or loading) to the user.
    const [message, setMessage] = useState(''); 

    // Instantiate the contract objects for both Token A and Token B.
    // We connect them with the 'signer' to enable transaction sending capabilities.
    const tokenAContract = new Contract(TokenAAddress, TokenABI, signer);
    const tokenBContract = new Contract(TokenBAddress, TokenABI, signer);

    // This asynchronous function handles the logic for claiming tokens.
    const handleClaim = async (tokenType: 'A' | 'B') => {
        // Disable buttons and set the target token to provide visual feedback.
        setIsClaiming(true);
        setClaimTarget(tokenType);
        setMessage('Processing transaction...');

        try {
            // Select the correct contract instance based on which button was clicked.
            const contract = tokenType === 'A' ? tokenAContract : tokenBContract;
            
            // Call the public `claimTokens` function on the selected token contract.
            // Any user can call this function.
            console.log(`Sending 'claimTokens' transaction for Token ${tokenType}...`);
            const claimTx = await contract.claimTokens();
            
            // Wait for the transaction to be mined and confirmed on the blockchain.
            console.log('Waiting for transaction confirmation...');
            await claimTx.wait();

            // On success, update the message and show an alert.
            const successMsg = `Successfully claimed 100 ${tokenType === 'A' ? 'TKA' : 'TKB'}!`;
            setMessage(successMsg);
            alert(successMsg);

        } catch (error: any) {
            console.error(`Claiming failed for Token ${tokenType}:`, error);
            
            // If the transaction reverts, try to extract the readable error reason.
            // This is useful for telling the user *why* it failed (e.g., the cooldown is active).
            const reason = error.reason || "Transaction failed. Have you claimed in the last 24 hours?";
            setMessage(`Error: ${reason}`);
            alert(`Error: ${reason}`);

        } finally {
            // After 3 seconds, reset the component's state, re-enabling the buttons.
            // This delay gives the user time to read the success/error message.
            setTimeout(() => {
                setIsClaiming(false);
                setClaimTarget(null);
                setMessage('');
            }, 3000);
        }
    };

    return (
        <div className="faucet-container">
            <h3>💰 Public Token Faucet</h3>
            <p style={{ fontSize: '0.8rem', color: '#aaa' }}>
                Need test tokens? Claim 100 TKA or TKB for free.
                (24-hour cooldown per token per address).
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button onClick={() => handleClaim('A')} disabled={isClaiming}>
                    {isClaiming && claimTarget === 'A' ? 'Processing...' : 'Claim 100 TKA'}
                </button>
                <button onClick={() => handleClaim('B')} disabled={isClaiming}>
                    {isClaiming && claimTarget === 'B' ? 'Processing...' : 'Claim 100 TKB'}
                </button>
            </div>
            {/* Display the feedback message to the user if it exists */}
            {message && <p style={{marginTop: '1rem', fontSize: '0.9rem'}}>{message}</p>}
        </div>
    );
}