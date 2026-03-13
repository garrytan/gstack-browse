/**
 * URL validation utilities to prevent SSRF and local resource access attacks.
 */

import { URL } from 'url';

/**
 * Private network IP ranges that should be blocked by default.
 */
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

/**
 * Private IP ranges (RFC1918).
 */
const BLOCKED_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
];

/**
 * Cloud metadata IP addresses.
 */
const METADATA_IPS = new Set([
  '169.254.169.254',  // AWS, GCP, Azure
  '169.254.169.253',  // AWS
  '169.254.169.249',  // Azure
  'metadata.google.internal',  // GCP
]);

/**
 * Checks if an IP is within a blocked range.
 */
function isIPInRange(ip: string, range: { start: string; end: string }): boolean {
  const ipNum = ipToNumber(ip);
  if (ipNum === null) return false;
  const startNum = ipToNumber(range.start);
  const endNum = ipToNumber(range.end);
  if (startNum === null || endNum === null) return false;
  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * Converts IP string to number for range comparison.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (let i = 0; i < 4; i++) {
    const part = parseInt(parts[i], 10);
    if (isNaN(part) || part < 0 || part > 255) return null;
    result = result * 256 + part;
  }
  return result;
}

/**
 * Validates a URL for SSRF and local resource access.
 * @param urlString - The URL to validate
 * @param allowPrivate - Whether to allow private network access (default: false)
 * @param allowFile - Whether to allow file:// URLs (default: false)
 * @throws Error if the URL is blocked
 */
export function validateUrl(
  urlString: string,
  allowPrivate: boolean = false,
  allowFile: boolean = false
): void {
  // Handle file:// URLs
  if (urlString.startsWith('file://')) {
    if (!allowFile) {
      throw new Error('Security: file:// URLs are not allowed by default. Use --allow-file to enable.');
    }
    return;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Security: Invalid URL format: ${urlString}`);
  }

  const scheme = url.protocol.toLowerCase();
  
  // Block non-http(s) schemes unless explicitly allowed
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new Error(`Security: Only http:// and https:// URLs are allowed. Got: ${scheme}`);
  }

  const hostname = url.hostname.toLowerCase();
  
  // Block blocked hosts
  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error(`Security: Access to localhost/loopback is not allowed. Host: ${hostname}`);
  }

  // Block cloud metadata endpoints
  if (METADATA_IPS.has(hostname)) {
    throw new Error(`Security: Cloud metadata endpoints are not allowed. Host: ${hostname}`);
  }

  // Check if hostname is an IP
  const ipNum = ipToNumber(hostname);
  if (ipNum !== null) {
    // Block link-local (169.254.x.x)
    if (ipNum >= 0xA9FE0000 && ipNum <= 0xA9FEFFFF) {
      throw new Error(`Security: Link-local addresses are not allowed. Host: ${hostname}`);
    }
    
    // Block private ranges unless explicitly allowed
    if (!allowPrivate) {
      for (const range of BLOCKED_RANGES) {
        if (isIPInRange(hostname, range)) {
          throw new Error(`Security: Private network access is not allowed. Host: ${hostname}`);
        }
      }
    }
  }

  // Block .internal, .localhost, etc.
  if (hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    throw new Error(`Security: Internal/reserved hostnames are not allowed. Host: ${hostname}`);
  }
}
