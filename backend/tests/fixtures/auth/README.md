# Auth Test Fixtures

This directory contains JSON fixtures for testing authentication endpoints. These files eliminate JSON encoding issues when testing from the command line.

## Usage

### Manual Testing with curl
```bash
# Test registration
curl -X POST "https://your-api-url/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/auth/register.json

# Test login
curl -X POST "https://your-api-url/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/auth/login.json
```

### Automated Testing
```bash
# Run the complete test suite
npm run test:endpoints

# Or run the script directly
./scripts/test/test-auth-endpoints.sh
```

## Available Fixtures

### Valid Test Cases
- `register.json` - Valid user registration data
- `login.json` - Valid login credentials
- `refresh.json` - Template for refresh token (updated dynamically by test script)

### Invalid Test Cases
- `register-existing.json` - Registration with existing email (should return CONFLICT)
- `register-invalid-email.json` - Registration with invalid email format
- `register-weak-password.json` - Registration with weak password
- `login-invalid-credentials.json` - Login with wrong password

## Benefits

1. **No JSON escaping issues** - Avoid shell quoting problems with special characters
2. **Reusable test data** - Same fixtures work across different testing tools
3. **Version controlled** - Test data is tracked in git
4. **Easy maintenance** - Update test cases by editing JSON files
5. **Consistent testing** - Same data used in manual testing, CI/CD, and automated tests

## Test Data Management

The test script automatically:
- Extracts tokens from responses
- Creates temporary fixtures with actual tokens for dependent tests
- Cleans up temporary files after completion
- Provides colored output for easy result interpretation