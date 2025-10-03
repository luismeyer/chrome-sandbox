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
		});

		// Rebuild as ChromeSandbox with the same params/state
		const chromeSandbox = Object.create(ChromeSandbox.prototype);
		Object.assign(chromeSandbox, sandbox);

		return chromeSandbox;
	}

	async launchBrowser({
		stdout,
		stderr,
	}: {
		stdout?: Writable;
		stderr?: Writable;
	}) {
		await this.runCommand({
			cmd: "npm",
			args: ["install"],
			stdout,
			stderr,
		});

		await this.runCommand({
			cmd: "node",
			args: ["index.js"],
			detached: true,
			stdout,
			stderr,
		});

		return this.domain(9222);
	}
}
