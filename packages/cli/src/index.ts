#!/usr/bin/env node
import { Command } from 'commander';
import { uploadSourcemap } from './upload-sourcemap';

const program = new Command();

program.name('edot').description('EDOT React Native CLI').version('0.1.0');

program
  .command('upload-sourcemap')
  .description('Upload a JS bundle and source map for server-side symbolication')
  .requiredOption('--server-url <url>', 'EDOT server URL')
  .requiredOption('--service-name <name>', 'Service name (must match SDK config)')
  .requiredOption('--service-version <version>', 'Service version (must match SDK config)')
  .requiredOption('--bundle-path <path>', 'Path to the minified JS bundle')
  .requiredOption('--sourcemap-path <path>', 'Path to the source map file')
  .option('--secret-token <token>', 'Secret token for authentication')
  .option('--api-key <key>', 'API key for authentication')
  .action(
    async (opts: {
      serverUrl: string;
      serviceName: string;
      serviceVersion: string;
      bundlePath: string;
      sourcemapPath: string;
      secretToken?: string;
      apiKey?: string;
    }) => {
      try {
        await uploadSourcemap(opts);
        console.log(`Source map uploaded for ${opts.serviceName}@${opts.serviceVersion}`);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );

program.parse();
