import { Sandbox, type Command } from "@vercel/sandbox";
import { args, createEnv } from "./chrome";

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

		// Rebuild as ChromeSandbox with the same params/state
		const chromeSandbox = Object.create(ChromeSandbox.prototype);
		Object.assign(chromeSandbox, sandbox);

		return chromeSandbox;
	}

	async launchBrowser() {
		console.log("Installing dependencies");
		this.currentCommand = await this.runCommand({
			cmd: "npm",
			args: ["install", "--production"],
			stdout: process.stdout,
			stderr: process.stderr,
		});
		for await (const line of this.currentCommand.logs()) {
			console.log(line.data);
		}

		console.log("RUNNING TEST");
		this.currentCommand = await this.runCommand({
			cmd: "node",
			args: ["test.js"],
			detached: true,
			stdout: process.stdout,
			stderr: process.stderr,
		});
		for await (const line of this.currentCommand.logs()) {
			console.log(line.data);

			const value = this.parseCommandOutput(line.data, "DONE");
			if (value) {
				console.log("DONE");
				break;
			}
		}

		console.log("Starting proxy server");
		this.currentCommand = await this.runCommand({
			cmd: "node",
			args: ["proxy.js"],
			detached: true,
			stdout: process.stdout,
			stderr: process.stderr,
		});
		for await (const line of this.currentCommand.logs()) {
			console.log(line.data);

			const value = this.parseCommandOutput(line.data, "PROXY_SERVER_READY");
			if (value) {
				break;
			}
		}

		console.log("Loading browser");
		this.currentCommand = await this.runCommand({
			cmd: "node",
			args: ["browser.js"],
			stdout: process.stdout,
			stderr: process.stderr,
		});

		let chromeSandboxPath = "";

		for await (const line of this.currentCommand.logs()) {
			console.log(line.data);

			const value = this.parseCommandOutput(line.data, "CHROME_SANDBOX_PATH");
			if (value) {
				chromeSandboxPath = value;
				break;
			}
		}

		console.log({ chromeSandboxPath });

		console.log("Starting browser");
		this.currentCommand = await this.runCommand({
			cmd: `${chromeSandboxPath}/chromium`,
			args: args(),
			env: createEnv(chromeSandboxPath),
			detached: true,
			stdout: process.stdout,
			stderr: process.stderr,
		});

		for await (const line of this.currentCommand.logs()) {
			console.log(line.data);
		}

		return this.domain(3000);
	}

	async killBrowser() {
		if (this.currentCommand?.exitCode) {
			console.log("Browser killed");
			return;
		}

		if (!this.currentCommand) {
			console.error("Browser not running");
			return;
		}

		console.log("Killing browser");

		await this.currentCommand?.kill();
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
