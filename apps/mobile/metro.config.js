// Metro config for a pnpm monorepo: watch the workspace root so changes in
// packages/shared hot-reload, and resolve modules from both the app and the
// root store. NativeWind wraps the config to compile global.css.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm's symlinked layout: let Metro follow links to workspace packages.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

// Prefer browser/react-native export conditions over "node". Without
// this, packages with conditional exports (jose, pulled in by the Privy
// SDK) resolve to their Node build and import node:crypto, which the
// React Native runtime has no implementation for.
config.resolver.unstable_conditionNames = ["react-native", "browser", "require", "default"];

module.exports = withNativeWind(config, { input: "./src/global.css" });
