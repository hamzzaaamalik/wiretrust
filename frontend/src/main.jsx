import { Buffer } from 'buffer';
if (!globalThis.Buffer) globalThis.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Web3AuthProvider } from '@web3auth/modal/react';
import { web3AuthConfig } from './config/web3auth';
import { store } from './store';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';
import { ToastProvider } from './contexts/ToastContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <Web3AuthProvider config={web3AuthConfig}>
          <WalletProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </WalletProvider>
        </Web3AuthProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
