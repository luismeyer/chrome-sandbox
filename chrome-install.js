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

const outdir = "/vercel/sandbox/";

const URL =
	"https://github.com/Sparticuz/chromium/releases/download/v140.0.0/chromium-v140.0.0-pack.x64.tar";

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

	return targetDir;
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

function main() {
	const path = loadChromium();

	console.log(`CHROME_SANDBOX_PATH_${path}_CHROME_SANDBOX_PATH`);
}

main();
