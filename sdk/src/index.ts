import { Sandbox } from "@vercel/sandbox";
import type { Writable } from "node:stream";

export class ChromeSandbox extends Sandbox {
	// use outside the sandbox to create a new instance
	static async create(): Promise<ChromeSandbox> {
		const sandbox = await Sandbox.create({
			source: {
				type: "git",
				url: "https://github.com/luismeyer/chrome-sandbox",
			},
			ports: [9222],
		});

		// Rebuild as ChromeSandbox with the same params/state
		const chromeSandbox = Object.create(ChromeSandbox.prototype);
		Object.assign(chromeSandbox, sandbox);

		return chromeSandbox;
	}

	async launchBrowser() {
		await this.runCommand({
			cmd: "npm",
			args: ["install"],
			stderr: process.stderr,
			stdout: process.stdout,
		});

		await this.runCommand({
			cmd: "node",
			args: ["index.js"],
			detached: true,
			stderr: process.stderr,
			stdout: process.stdout,
		});

		return this.domain(9222);
	}
}
