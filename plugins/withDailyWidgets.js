const fs = require('node:fs');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  createRunOncePlugin,
} = require('expo/config-plugins');

const TARGET = 'DailyPlusWidget';
const SOURCE_ROOT = path.join(__dirname, '..', 'modules', 'daily-widget');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extensionPlist(group, version, buildNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Daily+</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>XPC!</string>
<key>CFBundleShortVersionString</key><string>${escapeXml(version)}</string>
<key>CFBundleVersion</key><string>${escapeXml(buildNumber)}</string>
<key>DailyWidgetAppGroup</key><string>${escapeXml(group)}</string>
<key>CFBundleLocalizations</key><array><string>en</string><string>zh-Hans</string></array>
<key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
</dict></plist>
`;
}

function groupEntitlements(group) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${escapeXml(group)}</string></array></dict></plist>
`;
}

function copyIosSources(iosRoot, group, version, buildNumber) {
  const destination = path.join(iosRoot, TARGET);
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(path.join(SOURCE_ROOT, 'ios', 'widget'), destination, { recursive: true });
  fs.writeFileSync(
    path.join(destination, `${TARGET}-Info.plist`),
    extensionPlist(group, version, buildNumber),
  );
  fs.writeFileSync(path.join(destination, `${TARGET}.entitlements`), groupEntitlements(group));
}

function copyAndroidSources(androidRoot, packageName) {
  const mainRoot = path.join(androidRoot, 'app', 'src', 'main');
  const kotlinDirectory = path.join(mainRoot, 'java', ...packageName.split('.'));
  fs.mkdirSync(kotlinDirectory, { recursive: true });
  for (const name of ['DailyWidgetProvider.kt', 'DailyWidgetDatabase.kt']) {
    const source = fs.readFileSync(path.join(SOURCE_ROOT, 'android', 'widget', name), 'utf8');
    fs.writeFileSync(
      path.join(kotlinDirectory, name),
      source.replaceAll('__PACKAGE__', packageName),
    );
  }
  fs.cpSync(path.join(SOURCE_ROOT, 'android', 'widget', 'res'), path.join(mainRoot, 'res'), {
    recursive: true,
  });
}

function applyAndroidManifest(manifest, packageName) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.receiver = application.receiver ?? [];
  const receiverName = `${packageName}.DailyWidgetProvider`;
  const receiver = {
    $: { 'android:name': receiverName, 'android:exported': 'false', 'android:label': 'Daily+' },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
          { $: { 'android:name': 'android.intent.action.DATE_CHANGED' } },
          { $: { 'android:name': 'android.intent.action.TIME_SET' } },
          { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } },
          { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
        ],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': '@xml/daily_widget_info',
        },
      },
    ],
  };
  const index = application.receiver.findIndex((entry) => entry.$['android:name'] === receiverName);
  if (index === -1) application.receiver.push(receiver);
  else application.receiver[index] = receiver;
  manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] ?? [];
  if (
    !manifest.manifest['uses-permission'].some(
      (entry) => entry.$['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED',
    )
  ) {
    manifest.manifest['uses-permission'].push({
      $: { 'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED' },
    });
  }
  return manifest;
}

function addWidgetTarget(project, bundleIdentifier, group, teamId) {
  if (!group.startsWith('group.'))
    throw new Error('The widget extension needs a valid shared App Group.');
  const targets = project.pbxNativeTargetSection();
  const existing = Object.entries(targets).find(
    ([key, target]) => !key.endsWith('_comment') && target.name?.replaceAll('"', '') === TARGET,
  );
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency ?? {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy ?? {};
  const mainTarget = project.getFirstTarget();
  const target = existing
    ? { uuid: existing[0], pbxNativeTarget: existing[1] }
    : project.addTarget(TARGET, 'app_extension', TARGET, `${bundleIdentifier}.${TARGET}`);
  if (!existing) {
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    const folder = project.addPbxGroup([], TARGET);
    const rootGroup = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup({ fileRef: folder.uuid, basename: TARGET }, rootGroup);
    if (!project.pbxGroupByName('Resources')) {
      const resources = project.addPbxGroup([], 'Resources');
      project.addToPbxGroup({ fileRef: resources.uuid, basename: 'Resources' }, rootGroup);
    }
    project.addSourceFile(`${TARGET}/DailyPlusWidget.swift`, { target: target.uuid }, folder.uuid);
    project.addResourceFile(`${TARGET}/Assets.xcassets`, { target: target.uuid }, folder.uuid);
    project.addResourceFile(
      `${TARGET}/en.lproj/Localizable.strings`,
      { target: target.uuid },
      folder.uuid,
    );
    project.addResourceFile(
      `${TARGET}/zh-Hans.lproj/Localizable.strings`,
      { target: target.uuid },
      folder.uuid,
    );
    project.addFile(`${TARGET}/${TARGET}-Info.plist`, folder.uuid);
    project.addFile(`${TARGET}/${TARGET}.entitlements`, folder.uuid);
  }

  // Also upgrade an existing generated target without duplicating its source phase.
  if (!project.hasFile(`${TARGET}/DailyWidgetDatabase.swift`)) {
    const folder = project.findPBXGroupKey({ name: TARGET });
    project.addSourceFile(`${TARGET}/DailyWidgetDatabase.swift`, { target: target.uuid }, folder);
  }

  const configurationList =
    project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  const mainList = project.pbxXCConfigurationList()[mainTarget.firstTarget.buildConfigurationList];
  const buildConfigurations = project.pbxXCBuildConfigurationSection();
  for (const item of configurationList.buildConfigurations) {
    const configuration = buildConfigurations[item.value];
    const parentReference = mainList.buildConfigurations.find(
      (reference) => reference.comment === configuration.name,
    );
    const parent = parentReference ? buildConfigurations[parentReference.value]?.buildSettings : {};
    Object.assign(configuration.buildSettings, {
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: 'WidgetBackground',
      CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
      CODE_SIGN_STYLE: 'Automatic',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `"${TARGET}/${TARGET}-Info.plist"`,
      IPHONEOS_DEPLOYMENT_TARGET: '16.0',
      SWIFT_VERSION: '5.9',
      OTHER_LDFLAGS: '"$(inherited) -lsqlite3"',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      SDKROOT: 'iphoneos',
      CURRENT_PROJECT_VERSION: parent.CURRENT_PROJECT_VERSION ?? '1',
      MARKETING_VERSION: parent.MARKETING_VERSION ?? '1.0.0',
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}.${TARGET}"`,
      SWIFT_OPTIMIZATION_LEVEL: configuration.name === 'Debug' ? '"-Onone"' : '"-O"',
    });
    const signingTeam = teamId || parent.DEVELOPMENT_TEAM;
    if (signingTeam) configuration.buildSettings.DEVELOPMENT_TEAM = signingTeam;
  }
  const attributes = project.getFirstProject().firstProject.attributes;
  attributes.TargetAttributes = attributes.TargetAttributes ?? {};
  attributes.TargetAttributes[target.uuid] = {
    CreatedOnToolsVersion: '16.0',
    ProvisioningStyle: 'Automatic',
    SystemCapabilities: { 'com.apple.ApplicationGroups.iOS': { enabled: 1 } },
  };
  attributes.TargetAttributes[mainTarget.uuid] = attributes.TargetAttributes[mainTarget.uuid] ?? {};
  attributes.TargetAttributes[mainTarget.uuid].SystemCapabilities =
    attributes.TargetAttributes[mainTarget.uuid].SystemCapabilities ?? {};
  attributes.TargetAttributes[mainTarget.uuid].SystemCapabilities[
    'com.apple.ApplicationGroups.iOS'
  ] = { enabled: 1 };
  // addTarget embeds and adds the app dependency; retain the generated product reference.
  for (const phase of Object.values(objects.PBXCopyFilesBuildPhase ?? {})) {
    if (typeof phase !== 'object' || !Array.isArray(phase.files)) continue;
    for (const item of phase.files) {
      const file = objects.PBXBuildFile[item.value];
      if (file?.fileRef === target.pbxNativeTarget.productReference) {
        file.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] };
      }
    }
  }
  return target.uuid;
}

function withDailyWidgets(config, options = {}) {
  const bundleIdentifier = config.ios?.bundleIdentifier;
  const packageName = config.android?.package;
  if (!bundleIdentifier || !packageName)
    throw new Error('Daily+ widgets require ios.bundleIdentifier and android.package.');
  const group = options.appGroupIdentifier ?? `group.${bundleIdentifier}`;
  if (!/^group\.[a-zA-Z0-9.-]+$/.test(group))
    throw new Error('Invalid Daily+ App Group identifier.');
  config = withInfoPlist(config, (mod) => {
    mod.modResults.DailyWidgetAppGroup = group;
    return mod;
  });
  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] ?? [];
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...groups, group])];
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = applyAndroidManifest(mod.modResults, packageName);
    return mod;
  });
  config = withDangerousMod(config, [
    'android',
    (mod) => {
      copyAndroidSources(mod.modRequest.platformProjectRoot, packageName);
      return mod;
    },
  ]);
  config = withXcodeProject(config, (mod) => {
    copyIosSources(
      mod.modRequest.platformProjectRoot,
      group,
      config.version ?? '1.0.0',
      config.ios?.buildNumber ?? '1',
    );
    addWidgetTarget(mod.modResults, bundleIdentifier, group, config.ios?.appleTeamId);
    return mod;
  });
  config.extra = config.extra ?? {};
  config.extra.eas = config.extra.eas ?? {};
  config.extra.eas.build = config.extra.eas.build ?? {};
  config.extra.eas.build.experimental = config.extra.eas.build.experimental ?? {};
  config.extra.eas.build.experimental.ios = config.extra.eas.build.experimental.ios ?? {};
  const extensions = config.extra.eas.build.experimental.ios.appExtensions ?? [];
  config.extra.eas.build.experimental.ios.appExtensions = [
    ...extensions.filter((extension) => extension.targetName !== TARGET),
    {
      targetName: TARGET,
      bundleIdentifier: `${bundleIdentifier}.${TARGET}`,
      entitlements: { 'com.apple.security.application-groups': [group] },
    },
  ];
  return config;
}

module.exports = createRunOncePlugin(withDailyWidgets, 'daily-plus-widgets', '1.2.1');
module.exports.helpers = {
  addWidgetTarget,
  applyAndroidManifest,
  copyAndroidSources,
  copyIosSources,
  extensionPlist,
  groupEntitlements,
};
