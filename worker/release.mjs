import pkg from '../package.json' with { type:'json' };
import config from '../release.config.json' with { type:'json' };
export function releaseInfo(env) {
  return {version:env.NCHEF_RELEASE_VERSION || pkg.version,commit:env.NCHEF_RELEASE_COMMIT || 'development',databaseEpoch:config.databaseEpoch};
}
export function requireCurrentClient(request, env, path) {
  const writes=path==='/api/changes' || /^\/api\/(stock|purchase-orders|indents|requests)\//.test(path) || path==='/api/cuisines/add';
  if(request.method==='POST' && writes && env.NCHEF_RELEASE_COMMIT && request.headers.get('X-NCHEF-Client-Release')!==env.NCHEF_RELEASE_COMMIT) {
    throw Object.assign(new Error('Application version changed. Refresh this page before saving.'),{status:409});
  }
}
