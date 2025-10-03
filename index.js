// @ts-check

import puppeteer from "puppeteer-core";
import { args, loadChromium } from "./chrome.js";

async function main() {
	const path = await loadChromium();

	try {
		puppeteer.launch({
			executablePath: path,
			headless: process.env.DEBUG === "true" ? false : "shell",
			args: puppeteer.defaultArgs({ args: args(), headless: "shell" }),
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
			debuggingPort: 9222,
		});

		console.log("Browser launched");
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(new Date().toISOString(), "unexpected error", error);
	process.exitCode = 1;
});
