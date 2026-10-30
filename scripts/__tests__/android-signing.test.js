// Run with: pnpm test:signing (needs a JDK: JAVA_HOME, or keytool/jarsigner/jar on PATH).
// Tests the production module scripts/android-signing.js. Every key is generated for the run and deleted
// after; passwords only travel through environment variables and are never printed.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const s = require("../android-signing");

const bin = (t) => (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", t) : t);
let dir;
const pw = () => crypto.randomBytes(12).toString("hex");
const keys = {};

function run(tool, args, env = {}) {
  const r = spawnSync(bin(tool), args, { encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `${tool} ${args[0]} failed`);
  return r.stdout;
}
function genKey(name, alias, dname) {
  const store = path.join(dir, `${name}.keystore`);
  const pass = pw();
  run("keytool", ["-genkeypair", "-storetype", "PKCS12", "-keystore", store, "-alias", alias, "-keyalg", "RSA",
    "-keysize", "2048", "-validity", "2", "-dname", dname, "-storepass:env", "P", "-keypass:env", "P"], { P: pass });
  const fp = /SHA256:\s*(\S+)/.exec(run("keytool", ["-list", "-v", "-keystore", store, "-alias", alias, "-storepass:env", "P"], { P: pass }))[1];
  return { store, alias, pass, fp };
}
function writeProps(name, fields) {
  const f = path.join(dir, name);
  fs.writeFileSync(f, Object.entries(fields).map(([k, v]) => `${k}=${v}`).join("\n"));
  return f;
}
// A small "bundle": a jar with two entries, optionally signed (bundles use the same JAR signature).
function makeJar(name, signer) {
  const src = fs.mkdtempSync(path.join(dir, "src-"));
  fs.writeFileSync(path.join(src, "a.txt"), "skate");
  fs.writeFileSync(path.join(src, "b.txt"), "hive");
  const jar = path.join(dir, name);
  run("jar", ["cf", jar, "-C", src, "a.txt", "-C", src, "b.txt"]);
  if (signer) run("jarsigner", ["-keystore", signer.store, "-storepass:env", "P", jar, signer.alias], { P: signer.pass });
  return jar;
}
function replaceEntry(jar, entry, content) {
  const src = fs.mkdtempSync(path.join(dir, "edit-"));
  fs.writeFileSync(path.join(src, entry), content);
  run("jar", ["uf", jar, "-C", src, entry]);
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "skh-signing-test-"));
  keys.upload = genKey("upload", "upload", "CN=SkateHive Upload Test");
  keys.debug = genKey("debug", "androiddebugkey", "CN=Android Debug,O=Android,C=US");
  keys.other = genKey("other", "release", "CN=Someone Else");
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const good = () => ({
  storeFile: path.basename(keys.upload.store), storePassword: keys.upload.pass, keyAlias: "upload",
  keyPassword: keys.upload.pass, uploadCertSha256: keys.upload.fp,
});

// ---------------------------------------------------------------- config
test("a missing or unreadable config is refused", () => {
  assert.throws(() => s.readProps(path.join(dir, "nope.properties")), /No readable upload key config/);
  const f = writeProps("locked.properties", good());
  fs.chmodSync(f, 0o000);
  try {
    if (process.getuid && process.getuid() !== 0) assert.throws(() => s.readProps(f), /No readable/);
  } finally {
    fs.chmodSync(f, 0o600);
  }
});

test("an incomplete config is refused, field by field", () => {
  for (const field of ["storeFile", "storePassword", "keyAlias", "keyPassword", "uploadCertSha256"]) {
    const props = good();
    delete props[field];
    assert.throws(() => s.readProps(writeProps(`no-${field}.properties`, props)), new RegExp(`missing ${field}`));
  }
});

test("a missing keystore or an invalid declared fingerprint is refused", () => {
  assert.throws(() => s.readProps(writeProps("nostore.properties", { ...good(), storeFile: "absent.keystore" })), /not readable/);
  for (const bad of ["AA:BB", "not-a-fingerprint", keys.upload.fp.replace(/:/g, "")]) {
    assert.throws(() => s.readProps(writeProps("badfp.properties", { ...good(), uploadCertSha256: bad })), /not a SHA-256/);
  }
});

test("a relative storeFile resolves against the config file; a lower-case fingerprint is accepted", () => {
  const props = s.readProps(writeProps("ok.properties", { ...good(), uploadCertSha256: keys.upload.fp.toLowerCase() }));
  assert.equal(props.storeFile, keys.upload.store);
  assert.equal(props.uploadCertSha256, keys.upload.fp);
});

test("a relative config path resolves against the repo root from any working directory", () => {
  const root = path.join(dir, "repo");
  const cwd = process.cwd();
  try {
    fs.mkdirSync(path.join(root, "android"), { recursive: true });
    const a = s.resolvePropsPath(root, "keys/upload.properties");
    process.chdir(path.join(root, "android"));
    assert.equal(s.resolvePropsPath(root, "keys/upload.properties"), a);
    assert.equal(a, path.join(root, "keys/upload.properties"));
  } finally {
    process.chdir(cwd);
  }
});

// ---------------------------------------------------------------- keystore
test("wrong store password, alias or key password, or a keystore that isn't the declared key, is caught before building", () => {
  const ok = s.readProps(writeProps("ok2.properties", good()));
  assert.equal(s.expectedFingerprint(ok), keys.upload.fp);
  s.checkKeyPassword(ok);
  assert.throws(() => s.expectedFingerprint({ ...ok, storePassword: pw() }), /wrong store password or key alias/);
  assert.throws(() => s.expectedFingerprint({ ...ok, keyAlias: "nope" }), /wrong store password or key alias/);
  assert.throws(() => s.checkKeyPassword({ ...ok, keyPassword: pw() }), /wrong key password/);
  assert.throws(() => s.expectedFingerprint({ ...ok, uploadCertSha256: keys.other.fp }), /not the declared upload certificate/);
});

// ---------------------------------------------------------------- bundle
test("a bundle signed by the upload certificate passes", () => {
  assert.equal(s.verifyBundle(makeJar("upload.jar", keys.upload), keys.upload.fp), keys.upload.fp);
});

test("a signed bundle laid out like an AGP .aab (META-INF after the content) passes", () => {
  const jar = makeJar("agp-order.jar", keys.upload);
  const x = fs.mkdtempSync(path.join(dir, "agp-"));
  spawnSync("unzip", ["-q", jar, "-d", x]);
  const reordered = path.join(dir, "agp-order-reordered.jar");
  const z = spawnSync("zip", ["-q", "-X", "-r", reordered, "a.txt", "b.txt", "META-INF"], { cwd: x });
  assert.equal(z.status, 0, "zip failed");
  assert.equal(s.verifyBundle(reordered, keys.upload.fp), keys.upload.fp);
});

test("unsigned, debug-signed and wrongly signed bundles are refused", () => {
  assert.throws(() => s.verifyBundle(makeJar("unsigned.jar", null), keys.upload.fp), /not signed/);
  assert.throws(() => s.verifyBundle(makeJar("debug.jar", keys.debug), keys.upload.fp), /another key/);
  assert.throws(() => s.verifyBundle(makeJar("other.jar", keys.other), keys.upload.fp), /another key/);
});

test("a tampered or partly unsigned bundle is refused", () => {
  const tampered = makeJar("tampered.jar", keys.upload);
  replaceEntry(tampered, "a.txt", "changed after signing");
  assert.throws(() => s.verifyBundle(tampered, keys.upload.fp), /failed signature verification|unsigned entries/);
  const extra = makeJar("extra.jar", keys.upload);
  replaceEntry(extra, "c.txt", "added after signing");
  assert.throws(() => s.verifyBundle(extra, keys.upload.fp), /unsigned entries|failed signature verification/);
});

test("a missing or invalid expected fingerprint, or a missing bundle, is refused", () => {
  const jar = makeJar("upload2.jar", keys.upload);
  for (const bad of [undefined, null, "", "AA:BB", "zz"]) {
    assert.throws(() => s.verifyBundle(jar, bad), /No valid expected upload certificate/);
  }
  assert.throws(() => s.verifyBundle(path.join(dir, "absent.aab"), keys.upload.fp), /does not exist/);
});
