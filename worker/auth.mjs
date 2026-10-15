const encoder = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function equalSecret(a, b) {
  // HMAC verification avoids comparing secret strings with timing-dependent equality.
  const key = await crypto.subtle.importKey('raw', encoder.encode('nchef-constant-time-comparison'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(a)));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(String(b)));
}
export async function hashPassword(password, salt = randomToken()) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) {
    throw Object.assign(new Error('Password is required (up to 128 characters).'), { status: 400 });
  }
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2-sha256:100000:${salt}:${hex(bits)}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [, iterations, salt] = stored.split(':');
    if (iterations !== '100000') return false;
    return equalSecret(await hashPassword(password, salt), stored);
  } catch { return false; }
}
export function sessionCookie(request, token = '', maxAge = 28800) {
  const secure = new URL(request.url).protocol === 'https:';
  const name = secure ? '__Host-nchef_session' : 'nchef_session';
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export function getSessionToken(request) {
  const name = new URL(request.url).protocol === 'https:' ? '__Host-nchef_session' : 'nchef_session';
  return (request.headers.get('Cookie') || '').split(';').map(p => p.trim()).find(p => p.startsWith(name + '='))?.slice(name.length + 1) || '';
}
