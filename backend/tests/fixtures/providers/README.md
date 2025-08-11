# Provider Test Fixtures

This directory contains JSON fixtures for testing provider-related endpoints.

## Planned Fixtures

- `list-providers.json` - Parameters for listing all providers
- `get-provider.json` - Parameters for getting specific provider details
- `provider-search.json` - Search parameters for finding providers
- `provider-invalid-id.json` - Invalid provider ID for error testing

## Endpoints to be tested

- `GET /v1/providers` - List all available exam providers
- `GET /v1/providers/{id}` - Get specific provider details
- `GET /v1/providers/search` - Search providers by criteria

## Implementation Status

⏳ **Not yet implemented** - Will be created during Phase 6: Provider Listing Feature