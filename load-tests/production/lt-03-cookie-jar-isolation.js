import http from 'k6/http';
import { check } from 'k6';

/*
 * Network-free regression for LT-03 setup-session isolation. http.cookieJar()
 * returns the current VU's default jar; each setup login must instead use a
 * distinct http.CookieJar instance so session regeneration cannot replace a
 * previous login's cookie.
 */
export const options = { vus: 1, iterations: 1 };

export default function () {
  const defaultJarA = http.cookieJar();
  const defaultJarB = http.cookieJar();
  const localJars = Array.from({ length: 4 }, () => new http.CookieJar());

  defaultJarA.set('https://example.test/', 'lt03_default_probe', 'default');
  localJars[0].set('https://example.test/', 'lt03_local_probe', 'slot-1');

  const defaultJarBValues = defaultJarB.cookiesForURL('https://example.test/');
  const localJarValues = localJars.map((jar) => jar.cookiesForURL('https://example.test/'));

  check({ defaultJarBValues, localJarValues }, {
    'default cookieJar calls share VU state': (value) => (
      Array.isArray(value.defaultJarBValues.lt03_default_probe) &&
      value.defaultJarBValues.lt03_default_probe[0] === 'default'
    ),
    'four local CookieJar instances are isolated': (value) => (
      Array.isArray(value.localJarValues[0].lt03_local_probe) &&
      value.localJarValues[0].lt03_local_probe[0] === 'slot-1' &&
      value.localJarValues.slice(1).every((cookies) => !cookies.lt03_local_probe)
    ),
  });
}
