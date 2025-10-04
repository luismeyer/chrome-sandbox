import { defineConfig } from "@rslib/core";

export default defineConfig({
	lib: [
		{
			id: "chrome-sandbox",
			format: "esm",
			dts: true,
			source: { entry: { index: "src/index.ts" } },
		},
	],
});
