import { Sandbox } from "@vercel/sandbox";

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

	async launchBrowser() {
		const install = await this.runCommand({
			cmd: "npm",
			args: ["install"],
		});

		if (install.exitCode !== 0) {
			console.error(await install.stderr());
		}

		console.log(await install.stdout());

		const launch = await this.runCommand({
			cmd: "node",
			args: ["index.js"],
		});

		if (launch.exitCode !== 0) {
			console.error(await launch.stderr());
		}

		console.log(await launch.stdout());
	}
}
