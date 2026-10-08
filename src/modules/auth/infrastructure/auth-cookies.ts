import { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const REFRESH_TOKEN_COOKIE_PATH = '/';

export function baseAuthCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax' };
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseAuthCookieOptions(secure), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseAuthCookieOptions(secure), path: REFRESH_TOKEN_COOKIE_PATH });
}
