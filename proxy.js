// @ts-check

import http from "node:http";
import { createProxyServer } from "http-proxy";

const PORT = 3000;
export const CHROME_DEBUG_PORT = 9222;

/**
 * Create a proxy server
 * @returns {Promise<http.Server>}
 */
export async function createProxy() {
	console.info("Creating proxy server");
	const proxy = createProxyServer({
		target: `http://127.0.0.1:${CHROME_DEBUG_PORT}`,
		ws: true,
		changeOrigin: true,
	});

	// Main server
	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url ?? "");

		// Only proxy /devtools and /json requests
		if (
			url.pathname.startsWith("/devtools") ||
			url.pathname.startsWith("/json")
		) {
			proxy.web(req, res, {}, (err) => {
				res.writeHead(502);
				res.end(`Proxy error: ${err.message}`);
			});
		} else if (url.pathname === "/healthz") {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("OK");
		} else {
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not found");
		}
	});

	// Handle WebSocket upgrades
	server.on("upgrade", (req, socket, head) => {
		proxy.ws(req, socket, head);
	});

	server.listen(PORT, () => {
		console.log(`🌐 Proxy server listening at http://localhost:${PORT}`);
		console.log(`🧭 Try: http://localhost:${PORT}/json/version`);
	});

	return server;
}
