import Chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const launch = async () => {
	const executablePath = await Chromium.executablePath(
		"/vercel/sandbox/browser",
	);

	return puppeteer.launch({
		executablePath,
		headless: "shell",
		args: puppeteer.defaultArgs({ args: Chromium.args, headless: "shell" }),
		defaultViewport: {
			width: 1920,
			height: 1080,
		},
	});
};
