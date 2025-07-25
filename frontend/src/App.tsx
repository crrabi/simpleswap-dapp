import { useState, useEffect } from 'react';
import { ethers, BrowserProvider } from 'ethers';
import './App.css';
import { SwapUI } from './components/SwapUI';
import { PriceViewer } from './components/PriceViewer';
import { Faucet } from './components/Faucet'; // --- STEP 1: Import the new Faucet component ---

// Define the type for the application's state to ensure type safety
interface AppState {
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
}

function App() {
  // State to hold the provider, signer, and connected account information
  const [state, setState] = useState<AppState>({
    provider: null,
    signer: null,
    account: null,
  });

  // Function to handle the wallet connection process
  const connectWallet = async () => {
    // Check if MetaMask (or another browser wallet) is installed
    // @ts-ignore: `ethereum` is injected by MetaMask at runtime
    const { ethereum } = window;
    if (ethereum) {
      try {
        // Request access to the user's accounts
        await ethereum.request({ method: 'eth_requestAccounts' });
        
        // Configure the ethers.js provider and signer
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const account = await signer.getAddress();
        
        // Update the application's state with the connection details
        setState({ provider, signer, account });
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet.");
      }
    } else {
      // Prompt the user to install MetaMask if it's not detected
      alert("Please install MetaMask to use this app!");
    }
  };

  // This `useEffect` hook handles wallet account changes
  useEffect(() => {
    // @ts-ignore: `ethereum` is injected by MetaMask
    const { ethereum } = window;
    // Define a handler that runs when the user changes accounts in MetaMask
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        // If the user selects a new account, reconnect to update the state
        connectWallet(); 
      } else {
        // If the user disconnects all accounts, reset the application state
        setState({ provider: null, signer: null, account: null });
      }
    };

    if (ethereum) {
      // Listen for the 'accountsChanged' event from MetaMask
      ethereum.on('accountsChanged', handleAccountsChanged);
    }

    // Cleanup function: remove the event listener when the component unmounts
    // This prevents memory leaks
    return () => {
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount

  return (
    <div className="App">
      <header className="App-header">
        <h1>🦄 SimpleSwap</h1>
        {state.account ? (
          // If an account is connected, display a shortened version of the address
          <div className="connected-account">
            Connected: {`${state.account.substring(0, 6)}...${state.account.substring(state.account.length - 4)}`}
          </div>
        ) : (
          // If no account is connected, display the "Connect Wallet" button
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
      
      <main className="App-main">
        {state.signer ? (
          // If the signer is available (meaning the wallet is connected), render the DApp's core components
          <>
            <SwapUI signer={state.signer} />
            <PriceViewer provider={state.provider!} />
            <PoolInfo provider={state.provider!} />
            <Faucet signer={state.signer} /> {/* --- STEP 2: Render the Faucet component here --- */}
          </>
        ) : (
          // If the signer is not available, prompt the user to connect their wallet
          <p>Please connect your wallet to use the Swap.</p>
        )}
      </main>
    </div>
  );
}

export default App;