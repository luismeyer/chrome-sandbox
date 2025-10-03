import { defineConfig } from "@rslib/core";

export default defineConfig({
	lib: [
		{
			id: "chrome-sandbox",
			format: "cjs",
			dts: true,
			autoExternal: false,
			source: { entry: { index: "lib/index.ts" } },
		},
	],
});
