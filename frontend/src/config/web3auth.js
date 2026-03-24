import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";

const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "";

if (!clientId) {
  console.error("VITE_WEB3AUTH_CLIENT_ID is not set. Get one from https://dashboard.web3auth.io");
}

export const web3AuthConfig = {
  web3AuthOptions: {
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    chainConfig: {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0x16975",
      rpcTarget: "https://evm.wirefluid.com",
      displayName: "WireFluid Testnet",
      blockExplorerUrl: "https://wirefluidscan.com",
      ticker: "WIRE",
      tickerName: "WIRE",
    },
    uiConfig: {
      appName: "WireTrust",
      theme: { primary: "#6C3CE1" },
      mode: "dark",
      loginMethodsOrder: ["google"],
      defaultLanguage: "en",
    },
  },
};
