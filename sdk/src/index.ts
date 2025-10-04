import { Sandbox, type Command } from "@vercel/sandbox";
import { args, createEnv } from "./chrome";
import puppeteer from "puppeteer-core";

export class ChromeSandbox extends Sandbox {
	private currentCommand: Command | null = null;

	// use outside the sandbox to create a new instance
	static async create(): Promise<ChromeSandbox> {
		const sandbox = await Sandbox.create({
			source: {
				type: "git",
				url: "https://github.com/luismeyer/chrome-sandbox",
			},
			ports: [3000],
		});

		await sandbox.runCommand({
			cmd: "node",
			args: ["chrome-proxy.js"],
			detached: true,
			stdout: process.stdout,
			stderr: process.stderr,
		});

		await sandbox.runCommand({
			cmd: "npm",
			args: ["install", "--production"],
			stdout: process.stdout,
			stderr: process.stderr,
		});

		// Rebuild as ChromeSandbox with the same params/state
		const chromeSandbox = Object.create(ChromeSandbox.prototype);
		Object.assign(chromeSandbox, sandbox);

		return chromeSandbox;
	}

	async launchBrowser() {
		const installBrowserCommand = await this.runCommand({
			cmd: "node",
			args: ["chrome-install.js"],
			stdout: process.stdout,
			stderr: process.stderr,
		});

		let chromeSandboxPath = "";
		for await (const line of installBrowserCommand.logs()) {
			const value = this.parseCommandOutput(line.data, "CHROME_SANDBOX_PATH");

			if (value) {
				chromeSandboxPath = value;
				break;
			}
		}

		this.currentCommand = await this.runCommand({
			cmd: `${chromeSandboxPath}/chromium`,
			args: args(),
			env: createEnv(chromeSandboxPath),
			detached: true,
			stdout: process.stdout,
			stderr: process.stderr,
		});

		const domain = this.domain(3000);

		const browser = await puppeteer.connect({
			browserURL: domain,
		});

		browser.on("disconnected", () => {
			this.currentCommand?.kill();
		});

		browser.on("closed", () => {
			this.currentCommand?.kill();
		});

		return browser;
	}

	private parseCommandOutput(output: string, symbol: string) {
		const prefix = `${symbol}_`;
		const suffix = `_${symbol}`;

		// Find start index of prefix
		const start = output.indexOf(prefix);
		if (start === -1) return;

		// Find end index of suffix (after the prefix)
		const end = output.indexOf(suffix, start + prefix.length);
		if (end === -1) return;

		// Extract the path
		return output.slice(start + prefix.length, end);
	}
}
