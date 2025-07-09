import { useState, useEffect } from 'react';
import { ethers, BrowserProvider } from 'ethers';
import './App.css';
import { SwapUI } from './components/SwapUI';
import { PriceViewer } from './components/PriceViewer';

// Types for the state
interface AppState {
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
}

function App() {
  const [state, setState] = useState<AppState>({
    provider: null,
    signer: null,
    account: null,
  });

  const connectWallet = async () => {
    // @ts-ignore: `ethereum` is injected by MetaMask
    const { ethereum } = window;
    if (ethereum) {
      try {
        //Ask to connect the account
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        
        // Configure the ethers.js provider and signer
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const account = await signer.getAddress();
        
        // Update the application status
        setState({ provider, signer, account });
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Failed to connect wallet.");
      }
    } else {
      alert("Please install MetaMask to use this app!");
    }
  };

  // Effect for listening to changes in the MetaMask account
  useEffect(() => {
    // @ts-ignore: `ethereum` is injected by MetaMask
    const { ethereum } = window;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        connectWallet(); // Reconnect to update your signature and account.
      } else {
        setState({ provider: null, signer: null, account: null });
      }
    };

    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
    }

    // Clear the listener when the component is unmounted
    return () => {
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🦄 SimpleSwap</h1>
        {state.account ? (
          <div className="connected-account">
            Connected: {`${state.account.substring(0, 6)}...${state.account.substring(state.account.length - 4)}`}
          </div>
        ) : (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
      
      <main className="App-main">
        {state.signer ? (
          <>
            <SwapUI signer={state.signer} />
            <PriceViewer provider={state.provider!} />
          </>
        ) : (
          <p>Please connect your wallet to use the Swap.</p>
        )}
      </main>
    </div>
  );
}

export default App;