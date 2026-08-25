const { withXcodeProject } = require('expo/config-plugins');

/**
 * Turns off Xcode's user-script sandboxing.
 *
 * The "Bundle React Native code and images" phase shells out to node, which
 * writes main.jsbundle into DerivedData and reads across the project dir.
 * Under sandboxing those are denied and the archive fails with
 * `Sandbox: node(...) deny(1) file-write-create .../main.jsbundle`.
 *
 * Set at the project level, which is where prebuild writes YES. A plugin
 * rather than an Xcode edit because prebuild regenerates ios/ on every
 * release and on every Xcode Cloud build.
 */
module.exports = function withScriptSandboxDisabled(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    // Written unconditionally, not only where the key already exists: prebuild
    // does not always emit it, and relying on Xcode's default would let a
    // future template silently reintroduce YES.
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }

    return cfg;
  });
};
