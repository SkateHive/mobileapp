// Upload-key checks for the Play bundle (see build-android-aab.js). Secrets are only ever handed to keytool
// and jarsigner through environment variables (-storepass:env / -keypass:env), never on a command line or
// in output.
//
// The properties file (default ~/.skatehive/android-upload.properties) must declare, besides the four
// Gradle signing fields, the upload certificate's SHA-256 as `uploadCertSha256`: the keystore must hold that
// certificate, and the bundle must be signed by it and nothing else.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REQUIRED = ["storeFile", "storePassword", "keyAlias", "keyPassword", "uploadCertSha256"];
const SHA256 = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

class SigningError extends Error {}

const javaBin = (tool) => (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", tool) : tool);

/** The properties file path: absolute, a relative path being relative to the repo root. */
function resolvePropsPath(root, configured) {
  return path.resolve(
    root,
    configured || path.join(os.homedir(), ".skatehive", "android-upload.properties"),
  );
}

/** Normalises a SHA-256 fingerprint to AA:BB:… upper case, or null when it isn't one. */
function normalizeSha256(value) {
  const v = String(value ?? "").trim().toUpperCase();
  return SHA256.test(v) ? v : null;
}

/** Reads and validates the properties file; storeFile comes back absolute (relative to the file). */
function readProps(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
  } catch {
    throw new SigningError(`No readable upload key config at ${file}.`);
  }
  const props = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([^#!=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) props[m[1]] = m[2];
  }
  const missing = REQUIRED.filter((k) => !props[k]);
  if (missing.length) throw new SigningError(`${file} is missing ${missing.join(", ")}.`);
  const declared = normalizeSha256(props.uploadCertSha256);
  if (!declared) throw new SigningError(`${file}: uploadCertSha256 is not a SHA-256 fingerprint (AA:BB:… 32 bytes).`);
  props.uploadCertSha256 = declared;
  props.storeFile = path.resolve(path.dirname(file), props.storeFile);
  try {
    fs.accessSync(props.storeFile, fs.constants.R_OK);
  } catch {
    throw new SigningError(`The keystore named in ${file} is not readable.`);
  }
  return props;
}

const fingerprints = (text) => [...String(text).matchAll(/SHA256:\s*([0-9A-F:]{95})/g)].map((m) => m[1]);

/**
 * The upload certificate's SHA-256, read from the keystore and required to equal the declared
 * uploadCertSha256. Fails on a wrong store password or alias, or a keystore holding another key.
 */
function expectedFingerprint(props) {
  const r = spawnSync(
    javaBin("keytool"),
    ["-list", "-v", "-keystore", props.storeFile, "-alias", props.keyAlias, "-storepass:env", "SKH_STOREPASS"],
    { encoding: "utf8", env: { ...process.env, SKH_STOREPASS: props.storePassword } },
  );
  const [fp] = r.status === 0 ? fingerprints(r.stdout) : [];
  if (!fp) throw new SigningError("Couldn't read the upload certificate: wrong store password or key alias?");
  if (fp !== props.uploadCertSha256) {
    throw new SigningError(`The keystore's key (SHA-256 ${fp}) is not the declared upload certificate (${props.uploadCertSha256}).`);
  }
  return fp;
}

/** Signs a throwaway file with the key, so a wrong key password fails here and not mid-build. */
function checkKeyPassword(props) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skh-sign-"));
  const jar = path.join(dir, "probe.jar");
  try {
    // An empty zip is enough for jarsigner to need the private key.
    fs.writeFileSync(jar, Buffer.from("504b0506000000000000000000000000000000000000", "hex"));
    const r = spawnSync(
      javaBin("jarsigner"),
      ["-keystore", props.storeFile, "-storepass:env", "SKH_STOREPASS", "-keypass:env", "SKH_KEYPASS", jar, props.keyAlias],
      { encoding: "utf8", env: { ...process.env, SKH_STOREPASS: props.storePassword, SKH_KEYPASS: props.keyPassword } },
    );
    if (r.status !== 0) throw new SigningError("Couldn't use the upload key: wrong key password?");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Throws unless the bundle's signature is intact AND every signer is the expected upload certificate.
 * Integrity: jarsigner -verify (not -strict: a self-signed upload certificate is normal and only a
 * warning there). It must say "jar verified." and must not report unsigned entries.
 * Signer: keytool -printcert lists each signer certificate; there must be at least one, all expected.
 */
function verifyBundle(aab, expected) {
  const want = normalizeSha256(expected);
  if (!want) throw new SigningError("No valid expected upload certificate SHA-256 to check the bundle against.");
  if (!fs.existsSync(aab)) throw new SigningError(`${aab} does not exist.`);

  const v = spawnSync(javaBin("jarsigner"), ["-verify", "-verbose", aab], { encoding: "utf8" });
  const out = `${v.stdout}\n${v.stderr}`;
  // Only jarsigner's own verdict line: an AGP bundle stores META-INF after the content, which makes jarsigner
  // warn that entries are "not signed in JarInputStream". That warning is expected and not a failure.
  if (/^jar is unsigned\.$/m.test(out)) throw new SigningError(`${aab} is not signed.`);
  if (v.status !== 0 || !/jar verified\./.test(out)) {
    throw new SigningError(`${aab} failed signature verification (tampered or corrupt).`);
  }
  if (/unsigned entries/i.test(out)) throw new SigningError(`${aab} contains unsigned entries.`);

  const p = spawnSync(javaBin("keytool"), ["-printcert", "-jarfile", aab], { encoding: "utf8" });
  // One "Signer #N:" block per signer; its first certificate is the signer's own (the rest is its chain).
  const blocks = p.status === 0 ? String(p.stdout).split(/^Signer #\d+:/m).slice(1) : [];
  const signers = blocks.map((b) => fingerprints(b)[0]).filter(Boolean);
  if (!signers.length) throw new SigningError(`${aab}: couldn't read its signer certificate.`);
  const other = signers.find((s) => s !== want);
  if (other) throw new SigningError(`${aab} is signed by another key (SHA-256 ${other}), not the upload key (${want}).`);
  return want;
}

module.exports = {
  SigningError, resolvePropsPath, normalizeSha256, readProps, expectedFingerprint, checkKeyPassword, verifyBundle,
};
