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

	private args() {
		const chromiumFlags = [
			"--ash-no-nudges", // Avoids blue bubble "user education" nudges (eg., "… give your browser a new look", Memory Saver)
			"--disable-domain-reliability", // Disables Domain Reliability Monitoring, which tracks whether the browser has difficulty contacting Google-owned sites and uploads reports to Google.
			"--disable-print-preview", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisablePrintPreview&ss=chromium
			"--disk-cache-size=33554432", // https://source.chromium.org/search?q=lang:cpp+symbol:kDiskCacheSize&ss=chromium Forces the maximum disk space to be used by the disk cache, in bytes.
			"--no-default-browser-check", // Disable the default browser check, do not prompt to set it as such. (This is already set by Playwright, but not Puppeteer)
			"--no-pings", // Don't send hyperlink auditing pings
			"--single-process", // Runs the renderer and plugins in the same process as the browser. NOTES: Needs to be single-process to avoid `prctl(PR_SET_NO_NEW_PRIVS) failed` error
			"--font-render-hinting=none", // https://github.com/puppeteer/puppeteer/issues/2410#issuecomment-560573612
		];
		const chromiumDisableFeatures = [
			"AudioServiceOutOfProcess",
			"IsolateOrigins",
			"site-per-process", // Disables OOPIF. https://www.chromium.org/Home/chromium-security/site-isolation
		];
		const chromiumEnableFeatures = ["SharedArrayBuffer"];

		const graphicsFlags = [
			"--ignore-gpu-blocklist", // https://source.chromium.org/search?q=lang:cpp+symbol:kIgnoreGpuBlocklist&ss=chromium
			"--in-process-gpu", // Saves some memory by moving GPU process into a browser process thread
		];

		graphicsFlags.push("--disable-webgl");

		const insecureFlags = [
			"--allow-running-insecure-content", // https://source.chromium.org/search?q=lang:cpp+symbol:kAllowRunningInsecureContent&ss=chromium
			"--disable-setuid-sandbox", // Lambda runs as root, so this is required to allow Chromium to run as root
			"--disable-site-isolation-trials", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableSiteIsolation&ss=chromium
			"--disable-web-security", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableWebSecurity&ss=chromium
		];

		const headlessFlags = [
			"--headless='shell'", // We only support running chrome-headless-shell
			"--no-sandbox", // https://source.chromium.org/search?q=lang:cpp+symbol:kNoSandbox&ss=chromium
			"--no-zygote", // https://source.chromium.org/search?q=lang:cpp+symbol:kNoZygote&ss=chromium
		];

		return [
			...chromiumFlags,
			`--disable-features=${[...chromiumDisableFeatures].join(",")}`,
			`--enable-features=${[...chromiumEnableFeatures].join(",")}`,
			...graphicsFlags,
			...insecureFlags,
			...headlessFlags,
		];
	}

	async launchBrowser() {
		const installResult = await this.runCommand({
			cmd: "dnf",
			args: ["install", "-y", "chromium"],
			sudo: true,
		});

		if (installResult.exitCode !== 0) {
			console.error(await installResult.stderr());
			throw new Error("Failed to install chromium");
		}

		console.log(await installResult.stdout());

		const launchResult = await this.runCommand({
			cmd: "chromium",
			args: this.args(),
			sudo: true,
		});

		if (launchResult.exitCode !== 0) {
			console.error(await launchResult.stderr());
			throw new Error("Failed to install chromium");
		}

		console.log(await launchResult.stdout());
	}
}
