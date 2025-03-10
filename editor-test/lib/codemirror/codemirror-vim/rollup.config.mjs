import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript";

import path from 'path';

// rollup.config.mjs
export default {
	input: './src/index.ts',
	plugins: [resolve(), typescript({
		outDir: path.resolve("./dist")
	})],
	output: {
		format: 'es',
		dir: path.resolve("./dist"),
		preserveModules: true,
	},
};
