/** @type {import('next').NextConfig} */
const nextConfig = {
	// Silence workspace root warning and ensure server output tracing resolves to repo root
	outputFileTracingRoot: process.cwd(),
	webpack: (config, { isServer }) => {
		if (isServer) {
			// Prevent accidental SSR import of socket.io-client
			config.externals = config.externals || [];
			config.externals.push('socket.io-client');
			// Prevent SSR import of sweetalert2 (browser-only)
			config.externals.push('sweetalert2');
		}
		return config;
	},
};

export default nextConfig;
