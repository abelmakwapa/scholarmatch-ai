import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextRoot = path.join(root, ".next");
const budgets = JSON.parse(
  await readFile(path.join(root, "performance-budgets.json"), "utf8"),
);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? filesUnder(target) : [target];
      }),
    )
  ).flat();
}

async function bytesFor(files) {
  const sizes = await Promise.all(files.map((file) => stat(file)));
  return sizes.reduce((total, item) => total + item.size, 0);
}

async function manifestFor(relativePath) {
  const raw = await readFile(path.join(root, relativePath), "utf8");
  const assignment = raw.indexOf(" = {");
  if (assignment < 0) throw new Error(`Cannot parse ${relativePath}`);
  return JSON.parse(raw.slice(assignment + 3, raw.lastIndexOf(";")));
}

function assertWithin(label, actual, limit, failures) {
  console.log(`${label}: ${actual} bytes (budget ${limit})`);
  if (actual > limit) failures.push(`${label}: ${actual} > ${limit}`);
}

const failures = [];
const staticFiles = await filesUnder(path.join(nextRoot, "static"));
const jsFiles = staticFiles.filter((file) => file.endsWith(".js"));
const cssFiles = staticFiles.filter((file) => file.endsWith(".css"));
const fontFiles = staticFiles.filter((file) => file.endsWith(".woff2"));
const jsStats = await Promise.all(jsFiles.map((file) => stat(file)));

assertWithin(
  "all static JavaScript",
  jsStats.reduce((total, item) => total + item.size, 0),
  budgets.buildAssets.totalJsBytes,
  failures,
);
assertWithin(
  "largest JavaScript chunk",
  Math.max(...jsStats.map((item) => item.size)),
  budgets.buildAssets.maxJsChunkBytes,
  failures,
);
assertWithin(
  "all static CSS",
  await bytesFor(cssFiles),
  budgets.buildAssets.totalCssBytes,
  failures,
);
assertWithin(
  "self-hosted fonts",
  await bytesFor(fontFiles),
  budgets.buildAssets.totalFontBytes,
  failures,
);

for (const [route, budget] of Object.entries(budgets.routes)) {
  const manifest = await manifestFor(budget.manifest);
  const js = new Set(Object.values(manifest.entryJSFiles).flat());
  const css = new Set(
    Object.values(manifest.entryCSSFiles)
      .flat()
      .map((item) => (typeof item === "string" ? item : item.path)),
  );
  assertWithin(
    `${route} route JavaScript`,
    await bytesFor([...js].map((file) => path.join(nextRoot, file))),
    budget.jsBytes,
    failures,
  );
  assertWithin(
    `${route} route CSS`,
    await bytesFor([...css].map((file) => path.join(nextRoot, file))),
    budget.cssBytes,
    failures,
  );
}

if (failures.length) {
  console.error(`Performance budget failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
}
