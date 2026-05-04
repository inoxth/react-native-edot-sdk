import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB
const REQUEST_TIMEOUT_MS = 60_000; // 60 s

export interface UploadOptions {
  serverUrl: string;
  serviceName: string;
  serviceVersion: string;
  bundlePath: string;
  sourcemapPath: string;
  secretToken?: string;
  apiKey?: string;
}

function buildMultipartBody(
  fields: Record<string, string>,
  files: Array<{ fieldName: string; filePath: string; filename: string }>,
): { body: Buffer; boundary: string } {
  const boundary = `----EdotUpload${Date.now()}`;
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  for (const file of files) {
    const content = fs.readFileSync(file.filePath);
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
    );
    parts.push(content);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), boundary };
}

/**
 * Returns true when the string contains ASCII control characters (U+0000–U+001F
 * or U+007F) — characters that enable HTTP header injection.
 */
function containsControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

export function uploadSourcemap(options: UploadOptions): Promise<void> {
  const { serverUrl, serviceName, serviceVersion, bundlePath, sourcemapPath, secretToken, apiKey } =
    options;

  if (!fs.existsSync(bundlePath)) {
    return Promise.reject(new Error(`Bundle file not found: ${bundlePath}`));
  }
  if (!fs.existsSync(sourcemapPath)) {
    return Promise.reject(new Error(`Source map file not found: ${sourcemapPath}`));
  }

  const bundleFilename = path.basename(bundlePath);

  const { body, boundary } = buildMultipartBody(
    {
      service_name: serviceName,
      service_version: serviceVersion,
      bundle_filepath: bundleFilename,
    },
    [
      { fieldName: 'bundle', filePath: bundlePath, filename: bundleFilename },
      {
        fieldName: 'sourcemap',
        filePath: sourcemapPath,
        filename: path.basename(sourcemapPath),
      },
    ],
  );

  const url = new URL('/intake/v2/sourcemaps', serverUrl);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(body.length),
  };

  if (secretToken) {
    // Trim surrounding whitespace then reject any remaining control characters
    // to prevent HTTP header injection via corrupted CI env vars.
    const trimmed = secretToken.trim();
    if (containsControlChars(trimmed)) {
      return Promise.reject(new Error('secretToken contains invalid control characters'));
    }
    headers['Authorization'] = `Bearer ${trimmed}`;
  } else if (apiKey) {
    headers['Authorization'] = `ApiKey ${apiKey}`;
  }

  return new Promise<void>((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytesReceived = 0;

        res.on('data', (chunk: Buffer) => {
          bytesReceived += chunk.length;
          if (bytesReceived > MAX_RESPONSE_BYTES) {
            res.destroy(new Error('Response body exceeded MAX_RESPONSE_BYTES limit'));
            req.destroy();
            reject(new Error('Upload response body too large (> 5 MB)'));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${statusCode}: ${responseBody}`));
          }
        });
      },
    );

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Upload request timed out after ${REQUEST_TIMEOUT_MS} ms`));
    });

    req.on('error', (err) => {
      reject(new Error(`Upload request failed: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}
