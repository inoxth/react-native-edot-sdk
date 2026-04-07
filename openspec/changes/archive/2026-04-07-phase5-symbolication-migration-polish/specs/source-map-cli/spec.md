## ADDED Requirements

### Requirement: `@inox-edot/cli` package scaffold
The monorepo SHALL include a `packages/cli` package named `@inox-edot/cli` with a `bin` entry pointing to the compiled CLI entry point. It SHALL be a plain Node.js package with no React Native runtime dependency.

#### Scenario: CLI binary is executable after install
- **WHEN** `@inox-edot/cli` is installed in a project
- **THEN** `npx edot --help` prints available commands without error

### Requirement: `upload-sourcemap` command
The CLI SHALL provide an `upload-sourcemap` subcommand that accepts: `--server-url` (required), `--service-name` (required), `--service-version` (required), `--bundle-path` (required, path to the minified JS bundle), `--sourcemap-path` (required, path to the `.map` file). Optional: `--secret-token`, `--api-key`.

#### Scenario: Successful source map upload
- **WHEN** `edot upload-sourcemap --server-url https://apm.example.com --service-name my-app --service-version 1.0.0 --bundle-path main.jsbundle --sourcemap-path main.jsbundle.map` is run
- **THEN** the CLI reads both files from disk
- **THEN** it POSTs a `multipart/form-data` request to `<serverUrl>/intake/v2/sourcemaps`
- **THEN** it exits with code 0 on HTTP 2xx response
- **THEN** it prints a success message including the service name and version

#### Scenario: Missing required flag prints usage error
- **WHEN** `edot upload-sourcemap` is run without `--bundle-path`
- **THEN** the CLI prints an error message indicating the missing flag
- **THEN** it exits with code 1

#### Scenario: Server returns error response
- **WHEN** the server responds with HTTP 4xx or 5xx
- **THEN** the CLI prints the status code and response body
- **THEN** it exits with code 1

### Requirement: Source map upload request format
The upload request SHALL be a `multipart/form-data` POST with fields: `service_name`, `service_version`, `bundle_filepath` (the original bundle filename, not full path), and file attachments for the bundle and source map. Authentication SHALL use `Authorization: Bearer <secretToken>` or `Authorization: ApiKey <apiKey>` header when provided.

#### Scenario: Request includes correct fields
- **WHEN** a valid upload is executed
- **THEN** the multipart body includes `service_name` and `service_version` as text fields
- **THEN** the JS bundle is attached as a file field named `sourcemap`
- **THEN** the source map file is attached as a file field named `sourcemap`
