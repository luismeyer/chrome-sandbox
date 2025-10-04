// @ts-check

import { args, loadChromium } from "./chrome.js";
import { createProxy } from "./proxy.js";
import { spawn } from "node:child_process";

async function main() {
	const path = await loadChromium();

	try {
		const chrome = spawn(path, args());

		chrome.stdout.on("data", (d) => console.log("chrome:", d.toString()));
		chrome.stderr.on("data", (d) => console.error("chrome:", d.toString()));

		await createProxy();

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
