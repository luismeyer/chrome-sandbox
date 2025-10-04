import { join } from "node:path";

export const CHROME_DEBUG_PORT = 9222;

/**
 * Serverless chrome arguments
 * @returns {string[]}
 */
export function args() {
	const chromiumFlags = [
		"--ash-no-nudges", // Avoids blue bubble "user education" nudges (eg., "… give your browser a new look", Memory Saver)
		"--disable-domain-reliability", // Disables Domain Reliability Monitoring, which tracks whether the browser has difficulty contacting Google-owned sites and uploads reports to Google.
		"--disable-print-preview", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisablePrintPreview&ss=chromium
		"--disk-cache-size=33554432", // https://source.chromium.org/search?q=lang:cpp+symbol:kDiskCacheSize&ss=chromium Forces the maximum disk space to be used by the disk cache, in bytes.
		"--no-default-browser-check", // Disable the default browser check, do not prompt to set it as such. (This is already set by Playwright, but not Puppeteer)
		"--no-pings", // Don't send hyperlink auditing pings
		"--single-process", // Runs the renderer and plugins in the same process as the browser. NOTES: Needs to be single-process to avoid `prctl(PR_SET_NO_NEW_PRIVS) failed` error
		"--font-render-hinting=none", // https://github.com/puppeteer/puppeteer/issues/2410#issuecomment-560573612
		"--disable-dev-shm-usage",
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
		"--disable-gpu",
		"--disable-webgl",
	];

	const insecureFlags = [
		"--allow-running-insecure-content", // https://source.chromium.org/search?q=lang:cpp+symbol:kAllowRunningInsecureContent&ss=chromium
		"--disable-setuid-sandbox", // Lambda runs as root, so this is required to allow Chromium to run as root
		"--disable-site-isolation-trials", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableSiteIsolation&ss=chromium
		"--disable-web-security", // https://source.chromium.org/search?q=lang:cpp+symbol:kDisableWebSecurity&ss=chromium
	];

	const headlessFlags = [
		"--headless='new'",
		"--no-sandbox", // https://source.chromium.org/search?q=lang:cpp+symbol:kNoSandbox&ss=chromium
		"--no-zygote", // https://source.chromium.org/search?q=lang:cpp+symbol:kNoZygote&ss=chromium
		"--remote-debugging-address=0.0.0.0",
		`--remote-debugging-port=${CHROME_DEBUG_PORT}`,
		"--enable-logging=stderr",
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

export const createEnv = (targetDir: string) => {
	const env: Record<string, string> = {};

	// If the FONTCONFIG_PATH is not set, set it to /tmp/fonts
	env.FONTCONFIG_PATH ??= join(targetDir, "fonts");
	// Set up Home folder if not already set
	env.HOME ??= targetDir;

	const libdir = join(targetDir, "lib");

	// If LD_LIBRARY_PATH is undefined, set it to baseLibPath, otherwise, add it
	if (env.LD_LIBRARY_PATH === undefined) {
		env.LD_LIBRARY_PATH = libdir;
	}

	return env;
};
