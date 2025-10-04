// @ts-check

import { createReadStream, createWriteStream, Stats } from "node:fs";
import fs from "node:fs/promises";
import path, { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";
import { ReadableStream as WebReadableStream } from "node:stream/web";

import { glob } from "glob";
import * as tar from "tar";
import { CHROME_DEBUG_PORT } from "./proxy.js";

const outdir = "/vercel/sandbox/";

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

const URL =
	"https://github.com/Sparticuz/chromium/releases/download/v140.0.0/chromium-v140.0.0-pack.x64.tar";

/**
 * Setup the environment for the chrome sandbox
 * @param {string} targetDir
 */
export const setupEnvironment = (targetDir) => {
	// If the FONTCONFIG_PATH is not set, set it to /tmp/fonts
	process.env.FONTCONFIG_PATH ??= join(targetDir, "fonts");
	// Set up Home folder if not already set
	process.env.HOME ??= targetDir;

	const libdir = join(targetDir, "lib");

	// If LD_LIBRARY_PATH is undefined, set it to baseLibPath, otherwise, add it
	if (process.env.LD_LIBRARY_PATH === undefined) {
		process.env.LD_LIBRARY_PATH = libdir;
	} else if (!process.env.LD_LIBRARY_PATH.startsWith(libdir)) {
		process.env.LD_LIBRARY_PATH = [
			libdir,
			...new Set(process.env.LD_LIBRARY_PATH.split(":")),
		].join(":");
	}
};

/**
 * Load the chromium browser
 * @returns {Promise<string>}
 */
export async function loadChromium() {
	await fs.mkdir(outdir, { recursive: true });

	const tarballName = path.basename(URL);
	const tarballPath = path.join(outdir, tarballName);

	const targetDir = path.join(outdir, "browser");

	await downloadTarball(URL, tarballPath);

	await extractTarball(tarballPath, targetDir);

	await inflateBrotliFiles(targetDir);

	// clean up
	await fs.unlink(tarballPath);

	setupEnvironment(targetDir);

	return `${targetDir}/chromium`;
}

/**
 * Inflate the brotli files
 * @param {string} targetDir
 */
async function inflateBrotliFiles(targetDir) {
	const entries = await glob("**/*.br", {
		cwd: targetDir,
		dot: true,
		nodir: true,
	});
	await Promise.all(
		entries.map(async (relativePath) => {
			const absolutePath = path.join(targetDir, relativePath);
			const decompressedPath = absolutePath.replace(/\.br$/, "");
			await withTempFile(async (tempPath) => {
				await pipeline(
					createReadStream(absolutePath),
					createBrotliDecompress(),
					createWriteStream(tempPath, { mode: 0o700 }),
				);
				await fs.rename(tempPath, decompressedPath);
			});
			await fs.unlink(absolutePath);
			await maybeExtractTar(decompressedPath);
		}),
	);
}

/**
 * Extract the tarball
 * @param {string} tarballPath
 * @param {string} targetDir
 * @returns {Promise<void>}
 */
async function extractTarball(tarballPath, targetDir) {
	await fs.rm(targetDir, { recursive: true, force: true });
	await fs.mkdir(targetDir, { recursive: true });
	await tar.x({ file: tarballPath, cwd: targetDir });
}

/**
 * Maybe extract the tarball
 * @param {string} candidatePath
 * @returns {Promise<void>}
 */
async function maybeExtractTar(candidatePath) {
	if (!candidatePath.toLowerCase().endsWith(".tar")) {
		return;
	}

	/** @type {Stats} */
	let stats;
	try {
		stats = await fs.stat(candidatePath);
	} catch {
		return;
	}

	if (!stats.isFile()) {
		return;
	}

	console.info("[Chrome] Extracting tarball:", candidatePath);
	const destination = path.dirname(candidatePath);
	console.info("[Chrome] Destination:", destination);
	await tar.x({ file: candidatePath, cwd: destination });
	console.info("[Chrome] Unlinking tarball:", candidatePath);
	await fs.unlink(candidatePath);
}

/**
 * Download the tarball
 * @param {string} url
 * @param {string} destination
 * @returns {Promise<void>}
 */
async function downloadTarball(url, destination) {
	const response = await fetch(url);
	if (!response.ok || !response.body) {
		throw new Error(
			`Failed to download ${url}: ${response.status} ${response.statusText}`,
		);
	}

	const body = response.body;
	const source = isNodeReadableStream(body)
		? body
		: Readable.fromWeb(/** @type {WebReadableStream<Uint8Array>} */ (body));

	await withTempFile(async (tempPath) => {
		await pipeline(source, createWriteStream(tempPath));
		await fs.rename(tempPath, destination);
	});
}

/**
 * Check if the value is a node readable stream
 * @param {unknown} value
 * @returns {value is NodeJS.ReadableStream}
 */
function isNodeReadableStream(value) {
	return (
		typeof value === "object" &&
		value !== null &&
		"pipe" in value &&
		typeof value.pipe === "function"
	);
}

/**
 * With a temp file
 * @param {function(string): Promise<unknown>} fn
 * @returns {Promise<unknown>}
 */
async function withTempFile(fn) {
	const tempDir = await fs.mkdtemp(path.join(outdir, "chromium-temp-"));
	const tempFile = path.join(tempDir, Math.random().toString(36).slice(2));

	try {
		const result = await fn(tempFile);
		await fs.rm(tempDir, { recursive: true, force: true });
		return result;
	} catch (error) {
		await fs.rm(tempDir, { recursive: true, force: true });
		throw error;
	}
}
