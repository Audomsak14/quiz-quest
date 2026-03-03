import LocalNetworkBridge from "@/components/LocalNetworkBridge";

export default function App({ Component, pageProps }) {
  return (
    <>
      <LocalNetworkBridge />
      <Component {...pageProps} />
    </>
  );
}
