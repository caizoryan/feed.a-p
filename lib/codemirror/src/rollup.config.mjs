import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";
import path from "path"

// rollup.config.mjs
export default [{
	input: './cm.js',
	plugins: [resolve(), typescript({
		compilerOptions: {
			checkJs: true,
			declaration: true,
			declarationDir: path.resolve("../dist"),
		}
	})],

	output: {
		format: 'es',
		dir: '../dist',
		preserveModulesRoot: 'src',
		preserveModules: true,
	},
}
	,
{
	input: './cm.js',
	plugins: [resolve(), dts()],
	output: {
		format: 'es',
		dir: '../dist',
		preserveModulesRoot: 'src',
		preserveModules: true,
	},
}
];
