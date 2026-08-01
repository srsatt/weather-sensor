const requiredFiles = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/sw.js",
  "public/manifest.webmanifest",
  "public/icons/weather.svg",
  "public/icons/weather-192.png",
  "public/icons/weather-512.png"
];

for (const path of requiredFiles) {
  if (!(await Bun.file(path).exists())) throw new Error(`missing ${path}`);
}

const html = await Bun.file("public/index.html").text();
for (const forbidden of ["http://", "innerHTML", "<script>"]) {
  if (html.includes(forbidden)) throw new Error(`index.html contains ${forbidden}`);
}
for (const required of [
  'rel="manifest"',
  'id="screen-current"',
  'id="screen-history"',
  'src="/config.js"',
  'type="module"'
]) {
  if (!html.includes(required)) throw new Error(`index.html omits ${required}`);
}

const manifest = await Bun.file("public/manifest.webmanifest").json();
if (manifest.display !== "standalone" || manifest.start_url !== "/") {
  throw new Error("manifest is not installable as a standalone root app");
}

const trackedConfig = Bun.spawnSync(["git", "ls-files", "--error-unmatch", "public/config.js"], {
  stdout: "ignore",
  stderr: "ignore"
});
if (trackedConfig.exitCode === 0) {
  throw new Error("runtime config.js must not be committed");
}

console.log("static PWA checks passed");
