import { readFile } from "node:fs/promises";
import { join } from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { Sandbox } from "@vercel/sandbox";

chromium.setGraphicsMode = false;

export class ChromeSandbox extends Sandbox {
	// use outside the sandbox to create a new instance
	static async create(): Promise<ChromeSandbox> {
		const sandbox = await Sandbox.create({
			source: {
				type: "git",
				url: "https://github.com/luismeyer/chrome-sandbox",
			},
		});

		// Rebuild as ChromeSandbox with the same params/state
		const chromeSandbox = Object.create(ChromeSandbox.prototype);
		Object.assign(chromeSandbox, sandbox);

		return chromeSandbox;
	}

	async launchBrowser(): Promise<Browser> {
		await this.writeFiles([
			{
				content: Buffer.from(
					JSON.stringify({
						private: true,
						type: "module",
						dependencies: { ws: "8.18.3" },
					}),
				),
				path: "package.json",
			},
			{
				content: await readFile(join(import.meta.dirname, "./server.js")),
				path: "server.js",
			},
		]);

		const executablePath = await chromium.executablePath();

		return puppeteer.launch({
			executablePath,
			headless: "shell",
			args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
		});
	}
}
