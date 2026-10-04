#!/usr/bin/env node
// esbuild based build, same commands as the other beavers modules.
// Usage: node build.mjs <build | dev | devwatch | watch | zip | clean>

import esbuild from "esbuild";
import archiver from "archiver";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let PACKAGE = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

const DIST = path.join(__dirname, "dist");
const BUNDLE_DIR = path.join(__dirname, "package");
const ASSET_DIRS = ["css", "lang", "icons", "templates", "packs"];
const BUNDLE_JS_PATH = "src/main.js";

const devDist = () => path.join(PACKAGE.devDir, PACKAGE.name);

// Single bundled file: Foundry loads it as one ES module, no ".js" import suffix dance needed.
const esbuildOptions = (root) => ({
  entryPoints: [path.join(__dirname, PACKAGE.main)],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: path.join(root, BUNDLE_JS_PATH),
  sourcemap: true,
  logLevel: "info",
});

async function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  await fsp.mkdir(dest, { recursive: true });
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fsp.copyFile(s, d);
  }
}

function collectCss() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".css")) out.push(path.relative(__dirname, full).replaceAll(path.sep, "/"));
    }
  };
  walk(path.join(__dirname, "css"));
  return out;
}

const formatArray = (arr) =>
  arr.length === 0 ? "[]" : "[\n\t\t" + arr.map((s) => JSON.stringify(s)).join(",\n\t\t") + "\n\t]";

async function buildManifest(root) {
  const template = await fsp.readFile(path.join(__dirname, "module.json"), "utf8");
  const output = template
    .replaceAll("{{name}}", PACKAGE.name)
    .replaceAll("{{title}}", PACKAGE.title)
    .replaceAll("{{version}}", PACKAGE.version)
    .replaceAll("{{description}}", PACKAGE.description)
    .replace('"{{sources}}"', formatArray([BUNDLE_JS_PATH]))
    .replace('"{{css}}"', formatArray(collectCss()));
  await fsp.mkdir(root, { recursive: true });
  await fsp.writeFile(path.join(root, "module.json"), output, "utf8");
  console.log(`[manifest] -> ${root}`);
}

async function copyAssets(root) {
  await Promise.all([
    ...ASSET_DIRS.map((d) => copyDir(path.join(__dirname, d), path.join(root, d))),
    fsp.copyFile(path.join(__dirname, "LICENSE"), path.join(root, "LICENSE")).catch(() => {}),
    fsp.copyFile(path.join(__dirname, "README.md"), path.join(root, "README.md")).catch(() => {}),
  ]);
  console.log(`[assets] -> ${root}`);
}

const rimraf = async (dir) => {
  await fsp.rm(dir, { recursive: true, force: true });
  console.log(`[clean] ${dir}`);
};

async function buildAll(root) {
  await rimraf(root);
  await esbuild.build(esbuildOptions(root));
  await Promise.all([buildManifest(root), copyAssets(root)]);
}

async function watchAll(root) {
  await rimraf(root);
  const ctx = await esbuild.context(esbuildOptions(root));
  await ctx.watch();
  await Promise.all([buildManifest(root), copyAssets(root)]);
  let timer;
  const onChange = (_evt, file) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (file === "package.json") PACKAGE = JSON.parse(await fsp.readFile(path.join(__dirname, "package.json"), "utf8"));
      await Promise.all([buildManifest(root), copyAssets(root)]).catch(console.error);
    }, 100);
  };
  for (const d of ASSET_DIRS) {
    if (fs.existsSync(path.join(__dirname, d))) fs.watch(path.join(__dirname, d), { recursive: true }, onChange);
  }
  for (const f of ["module.json", "package.json", "README.md", "LICENSE"]) fs.watch(path.join(__dirname, f), onChange);
  console.log(`[watch] -> ${root}. Press Ctrl+C to stop.`);
}

async function cmdZip() {
  await buildAll(DIST);
  await fsp.mkdir(BUNDLE_DIR, { recursive: true });
  const zipPath = path.join(BUNDLE_DIR, `${PACKAGE.name}.zip`);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    out.on("close", () => {
      console.log(`[zip] ${zipPath} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on("error", reject);
    archive.pipe(out);
    archive.directory(DIST + path.sep, PACKAGE.name);
    archive.finalize();
  });
  await fsp.copyFile(path.join(DIST, "module.json"), path.join(BUNDLE_DIR, "module.json"));
  await rimraf(DIST);
}

const COMMANDS = {
  build: () => buildAll(DIST),
  dev: () => buildAll(devDist()),
  devwatch: () => watchAll(devDist()),
  watch: () => watchAll(DIST),
  zip: cmdZip,
  clean: () => Promise.all([rimraf(DIST), rimraf(BUNDLE_DIR)]),
};

const command = process.argv[2];
if (!command || !COMMANDS[command]) {
  console.error(`Usage: node build.mjs <${Object.keys(COMMANDS).join(" | ")}>`);
  process.exit(1);
}
COMMANDS[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
