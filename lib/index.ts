import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setGraphicsMode = false;

export async function launchBrowser(): Promise<Browser> {
	const executablePath = await chromium.executablePath();

	return puppeteer.launch({
		executablePath,
		headless: "shell",
		args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
		defaultViewport: {
			width: 1920,
			height: 1080,
		},
	});
}
