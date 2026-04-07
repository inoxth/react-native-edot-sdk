import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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

export function uploadSourcemap(options: UploadOptions): Promise<void> {
  const {
    serverUrl,
    serviceName,
    serviceVersion,
    bundlePath,
    sourcemapPath,
    secretToken,
    apiKey,
  } = options;

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
    headers['Authorization'] = `Bearer ${secretToken}`;
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
        let responseBody = '';
        res.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          const statusCode = res.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Upload failed with status ${statusCode}: ${responseBody}`,
              ),
            );
          }
        });
      },
    );

    req.on('error', (err) => {
      reject(new Error(`Upload request failed: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}
