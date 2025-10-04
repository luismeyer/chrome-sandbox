// @ts-check

import puppeteer from "puppeteer-core";

import { args, loadChromium } from "./chrome.js";
import { CHROME_DEBUG_PORT, createProxy } from "./proxy.js";

async function main() {
	const path = await loadChromium();

	try {
		const browser = await puppeteer.launch({
			executablePath: path,
			headless: process.env.DEBUG === "true" ? false : "shell",
			args: puppeteer.defaultArgs({ args: args(), headless: "shell" }),
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
			debuggingPort: CHROME_DEBUG_PORT,
		});

		console.log(browser.wsEndpoint());

		const server = await createProxy();

		// Clean exit
		const shutdown = async () => {
			console.log("Shutting down...");
			await browser.close();
			server.close();
			process.exit(0);
		};

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);

		console.log("CHROME_SANDBOX_READY");
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(new Date().toISOString(), "unexpected error", error);
	process.exitCode = 1;
});
