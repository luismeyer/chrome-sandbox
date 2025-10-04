import { Sandbox, type Command } from "@vercel/sandbox";

export class ChromeSandbox extends Sandbox {
	private run: Command | null = null;

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

		const output = await this.runCommand({
			cmd: "npm",
			args: ["install"],
			stderr: process.stderr,
			stdout: process.stdout,
		});

		for await (const line of output.logs()) {
			console.log(line.data);
		}

		this.run = await this.runCommand({
			cmd: "node",
			args: ["index.js"],
			detached: true,
			stderr: process.stderr,
			stdout: process.stdout,
		});

		for await (const line of this.run.logs()) {
			console.log(line.data);

			if (line.data === "CHROME_SANDBOX_READY") {
				break;
			}
		}

		return this.domain(3000);
	}

	async killBrowser() {
		if (this.run?.exitCode) {
			console.log("Browser killed");
			return;
		}

		if (!this.run) {
			console.error("Browser not running");
			return;
		}

		console.log("Killing browser");

		await this.run?.kill();
	}
}
