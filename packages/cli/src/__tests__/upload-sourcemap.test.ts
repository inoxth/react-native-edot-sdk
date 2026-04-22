import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import { uploadSourcemap } from '../upload-sourcemap';
import type { UploadOptions } from '../upload-sourcemap';

const BASE_OPTIONS: UploadOptions = {
  serverUrl: 'http://localhost:8200',
  serviceName: 'my-app',
  serviceVersion: '1.0.0',
  bundlePath: '/tmp/edot-test-bundle.js',
  sourcemapPath: '/tmp/edot-test-bundle.js.map',
};

let server: http.Server;
let serverPort: number;
let lastRequest: {
  headers: http.IncomingHttpHeaders;
  body: string;
  method: string;
  url: string;
};
let serverStatusCode = 202;
let serverResponseBody = 'ok';

beforeAll((done) => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      lastRequest = {
        headers: req.headers,
        body,
        method: req.method ?? '',
        url: req.url ?? '',
      };
      res.writeHead(serverStatusCode);
      res.end(serverResponseBody);
    });
  });
  server.listen(0, () => {
    const addr = server.address();
    if (addr && typeof addr === 'object') {
      serverPort = addr.port;
    }
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  serverStatusCode = 202;
  serverResponseBody = 'ok';

  fs.writeFileSync(BASE_OPTIONS.bundlePath, 'var a=1;');
  fs.writeFileSync(BASE_OPTIONS.sourcemapPath, '{"version":3}');
});

afterEach(() => {
  try {
    fs.unlinkSync(BASE_OPTIONS.bundlePath);
  } catch { /* ignore */ }
  try {
    fs.unlinkSync(BASE_OPTIONS.sourcemapPath);
  } catch { /* ignore */ }
});

describe('uploadSourcemap', () => {
  it('sends multipart POST to /intake/v2/sourcemaps', async () => {
    await uploadSourcemap({
      ...BASE_OPTIONS,
      serverUrl: `http://localhost:${serverPort}`,
    });

    expect(lastRequest.method).toBe('POST');
    expect(lastRequest.url).toBe('/intake/v2/sourcemaps');
    expect(lastRequest.headers['content-type']).toContain('multipart/form-data');
    expect(lastRequest.body).toContain('service_name');
    expect(lastRequest.body).toContain('my-app');
    expect(lastRequest.body).toContain('service_version');
    expect(lastRequest.body).toContain('1.0.0');
  });

  it('includes authorization header with secret token', async () => {
    await uploadSourcemap({
      ...BASE_OPTIONS,
      serverUrl: `http://localhost:${serverPort}`,
      secretToken: 'my-secret',
    });

    expect(lastRequest.headers['authorization']).toBe('Bearer my-secret');
  });

  it('includes authorization header with api key', async () => {
    await uploadSourcemap({
      ...BASE_OPTIONS,
      serverUrl: `http://localhost:${serverPort}`,
      apiKey: 'my-key',
    });

    expect(lastRequest.headers['authorization']).toBe('ApiKey my-key');
  });

  it('rejects when bundle file not found', async () => {
    await expect(
      uploadSourcemap({
        ...BASE_OPTIONS,
        bundlePath: '/tmp/nonexistent-bundle.js',
      }),
    ).rejects.toThrow('Bundle file not found');
  });

  it('rejects on server error response', async () => {
    serverStatusCode = 400;
    serverResponseBody = 'Bad request';

    await expect(
      uploadSourcemap({
        ...BASE_OPTIONS,
        serverUrl: `http://localhost:${serverPort}`,
      }),
    ).rejects.toThrow('Upload failed with status 400');
  });

  // F-27: secretToken header injection guard
  it('rejects secretToken containing newline (\\n)', async () => {
    await expect(
      uploadSourcemap({
        ...BASE_OPTIONS,
        serverUrl: `http://localhost:${serverPort}`,
        secretToken: 'valid-token\nX-Injected: evil',
      }),
    ).rejects.toThrow('secretToken contains invalid control characters');
  });

  it('rejects secretToken containing carriage-return+newline (\\r\\n)', async () => {
    await expect(
      uploadSourcemap({
        ...BASE_OPTIONS,
        serverUrl: `http://localhost:${serverPort}`,
        secretToken: 'valid-token\r\nX-Injected: evil',
      }),
    ).rejects.toThrow('secretToken contains invalid control characters');
  });

  it('rejects secretToken containing null byte (\\x00)', async () => {
    await expect(
      uploadSourcemap({
        ...BASE_OPTIONS,
        serverUrl: `http://localhost:${serverPort}`,
        secretToken: 'tok\x00en',
      }),
    ).rejects.toThrow('secretToken contains invalid control characters');
  });

  it('trims surrounding whitespace from secretToken', async () => {
    await uploadSourcemap({
      ...BASE_OPTIONS,
      serverUrl: `http://localhost:${serverPort}`,
      secretToken: '  my-token  ',
    });
    expect(lastRequest.headers['authorization']).toBe('Bearer my-token');
  });

  // F-29: response body size cap
  it('rejects and destroys connection when response body exceeds 5 MB', async () => {
    // Spin up a server that streams > 5 MB without sending a status body end
    const bigServer = http.createServer((req, res) => {
      req.resume(); // drain request
      res.writeHead(200);
      const chunk = Buffer.alloc(1024 * 1024, 'x'); // 1 MB
      let sent = 0;
      const interval = setInterval(() => {
        res.write(chunk);
        sent += chunk.length;
        if (sent >= 6 * 1024 * 1024) {
          clearInterval(interval);
          res.end();
        }
      }, 0);
    });

    await new Promise<void>((resolve) => bigServer.listen(0, resolve));
    const bigPort = (bigServer.address() as net.AddressInfo).port;

    try {
      await expect(
        uploadSourcemap({
          ...BASE_OPTIONS,
          serverUrl: `http://localhost:${bigPort}`,
        }),
      ).rejects.toThrow('too large');
    } finally {
      await new Promise<void>((resolve) => bigServer.close(() => resolve()));
    }
  });

  // F-30: request timeout
  it('rejects with timeout error when server never responds', async () => {
    // A server that accepts the connection but never sends a response
    const hangServer = net.createServer((socket) => {
      socket.on('data', () => { /* intentionally consume and ignore */ });
    });

    await new Promise<void>((resolve) => hangServer.listen(0, resolve));
    const hangPort = (hangServer.address() as net.AddressInfo).port;

    try {
      await expect(
        uploadSourcemap({
          ...BASE_OPTIONS,
          serverUrl: `http://localhost:${hangPort}`,
        }),
      ).rejects.toThrow(/timed out|Upload request failed/);
    } finally {
      await new Promise<void>((resolve) => hangServer.close(() => resolve()));
    }
  }, 70_000);
});
