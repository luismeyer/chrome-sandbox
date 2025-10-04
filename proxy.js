// @ts-check

import http from "node:http";
import httProxy from "http-proxy";

const PORT = 3000;
export const CHROME_DEBUG_PORT = 9222;

/**
 * Create a proxy server
 * @returns {void}
 */
export function createProxy() {
	console.info("Creating proxy server");
	const proxy = httProxy.createProxyServer({
		target: `http://127.0.0.1:${CHROME_DEBUG_PORT}`,
		ws: true,
		changeOrigin: true,
	});

	// Main server
	const server = http.createServer(async (req, res) => {
		const url = new URL(`http://127.0.0.1${req.url}`);

		const target = `http://127.0.0.1:${CHROME_DEBUG_PORT}${url.pathname}${url.search}`;

		if (url.pathname.startsWith("/json/version")) {
			try {
				const response = await fetch(target);
				const json = await response.json();

				const publicHost = req.headers.host;
				console.log({ publicHost });

				/**
				 * Replace the WebSocket URL with the public host
				 * @param {string} u
				 * @returns {string}
				 */
				const replaceWsUrl = (u) =>
					u.replace("ws://127.0.0.1:9222", `wss://${publicHost}`);

				if (json.webSocketDebuggerUrl) {
					json.webSocketDebuggerUrl = replaceWsUrl(json.webSocketDebuggerUrl);
				}

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(json, null, 2));
			} catch (err) {
				res.writeHead(502);
				res.end(`Proxy fetch failed: ${err.message}`);
			}

			return;
		}

		// Health check
		if (url.pathname === "/healthz") {
			res.writeHead(200, { "Content-Type": "text/plain" });
			res.end("OK");
			return;
		}

		// Otherwise, proxy directly
		proxy.web(req, res, {}, (err) => {
			res.writeHead(502);
			res.end(`Proxy error: ${err.message}`);
		});
	});

	// Handle WebSocket upgrades
	server.on("upgrade", (req, socket, head) => {
		proxy.ws(req, socket, head);
	});

	server.on("error", (err) => {
		console.error(err);
	});

	server.listen(PORT, () => {
		console.log(`🌐 Proxy server listening at http://localhost:${PORT}`);
	});
}

createProxy();
