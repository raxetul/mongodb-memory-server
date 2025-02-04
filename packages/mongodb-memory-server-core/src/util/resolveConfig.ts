import camelCase from 'camelcase';
import { findSync } from 'new-find-package-json';
import debug from 'debug';
import * as path from 'path';
import { readFileSync } from 'fs';

const log = debug('MongoMS:ResolveConfig');

export enum ResolveConfigVariables {
  DOWNLOAD_DIR = 'DOWNLOAD_DIR',
  PLATFORM = 'PLATFORM',
  ARCH = 'ARCH',
  VERSION = 'VERSION',
  DEBUG = 'DEBUG',
  DOWNLOAD_MIRROR = 'DOWNLOAD_MIRROR',
  DOWNLOAD_URL = 'DOWNLOAD_URL',
  PREFER_GLOBAL_PATH = 'PREFER_GLOBAL_PATH',
  DISABLE_POSTINSTALL = 'DISABLE_POSTINSTALL',
  SYSTEM_BINARY = 'SYSTEM_BINARY',
  MD5_CHECK = 'MD5_CHECK',
  ARCHIVE_NAME = 'ARCHIVE_NAME',
  RUNTIME_DOWNLOAD = 'RUNTIME_DOWNLOAD',
  USE_HTTP = 'USE_HTTP',
  SYSTEM_BINARY_VERSION_CHECK = 'SYSTEM_BINARY_VERSION_CHECK',
}

export const ENV_CONFIG_PREFIX = 'MONGOMS_';
export const defaultValues = new Map<ResolveConfigVariables, string>([
  // apply app-default values here
  [ResolveConfigVariables.VERSION, '4.0.25'],
  [ResolveConfigVariables.PREFER_GLOBAL_PATH, 'true'],
  [ResolveConfigVariables.RUNTIME_DOWNLOAD, 'true'],
  [ResolveConfigVariables.USE_HTTP, 'false'],
  [ResolveConfigVariables.SYSTEM_BINARY_VERSION_CHECK, 'true'],
]);

/**
 * Set an Default value for an specific key
 * Mostly only used internally (for the "global-x.x" packages)
 * @param key The Key the default value should be assigned to
 * @param value The Value what the default should be
 */
export function setDefaultValue(key: ResolveConfigVariables, value: string): void {
  defaultValues.set(key, value);
}

let packageJsonConfig: Record<string, string> = {};
/**
 * Find the nearest package.json (that has an non-empty config field) for the provided directory
 * @param directory Set an custom directory to search the config in (default: process.cwd())
 */
export function findPackageJson(directory?: string): Record<string, string> {
  let filepath: string | undefined;
  for (const filename of findSync(directory || process.cwd())) {
    log(`findPackageJson: Found package.json at "${filename}"`);
    const readout: Record<string, any> = JSON.parse(readFileSync(filename).toString());

    if (Object.keys(readout?.config?.mongodbMemoryServer ?? {}).length > 0) {
      log(`findPackageJson: Found package with non-empty config field at "${filename}"`);

      // the optional chaining is needed, because typescript wont accept an "isNullOrUndefined" in the if with "&& Object.keys"
      packageJsonConfig = readout?.config?.mongodbMemoryServer;
      filepath = path.dirname(filename);
      break;
    }
  }

  // block for all file-path resolving
  if (filepath) {
    // These are so that "camelCase" doesnt get executed much & de-duplicate code
    // "cc*" means "camelcase"
    const ccDownloadDir = camelCase(ResolveConfigVariables.DOWNLOAD_DIR);
    const ccSystemBinary = camelCase(ResolveConfigVariables.SYSTEM_BINARY);

    if (ccDownloadDir in packageJsonConfig) {
      packageJsonConfig[ccDownloadDir] = path.resolve(filepath, packageJsonConfig[ccDownloadDir]);
    }

    if (ccSystemBinary in packageJsonConfig) {
      packageJsonConfig[ccSystemBinary] = path.resolve(filepath, packageJsonConfig[ccSystemBinary]);
    }
  }

  return packageJsonConfig;
}

/**
 * Resolve "variableName" value (process.env | packagejson | default | undefined)
 * @param variableName The variable to search an value for
 */
export function resolveConfig(variableName: ResolveConfigVariables): string | undefined {
  return (
    process.env[envName(variableName)] ??
    packageJsonConfig[camelCase(variableName)] ??
    defaultValues.get(variableName)
  )?.toString();
}

export default resolveConfig;

/**
 * Helper Function to add the prefix for "process.env[]"
 */
export function envName(variableName: ResolveConfigVariables): string {
  return `${ENV_CONFIG_PREFIX}${variableName}`;
}

/**
 * Convert "1, on, yes, true" to true (otherwise false)
 * @param env The String / Environment Variable to check
 */
export function envToBool(env: string = ''): boolean {
  if (typeof env !== 'string') {
    log('envToBool: input was not a string!');

    return false;
  }

  return ['1', 'on', 'yes', 'true'].indexOf(env.toLowerCase()) !== -1;
}

// enable debug if "MONGOMS_DEBUG" is true
if (envToBool(resolveConfig(ResolveConfigVariables.DEBUG))) {
  debug.enable('MongoMS:*');
  log('Debug Mode Enabled, through Environment Variable');
}

// run this after env debug enable to be able to debug this function too
findPackageJson();

// enable debug if "config.mongodbMemoryServer.debug" is true
if (envToBool(resolveConfig(ResolveConfigVariables.DEBUG))) {
  debug.enable('MongoMS:*');
  log('Debug Mode Enabled, through package.json');
}
