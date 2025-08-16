# CDK Deployment Protection

## Quick Setup

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Source deployment safeguards (adjust path as needed)
source ./.bashrc_deployment
```

## What This Does

- **Blocks `cdk deploy`** commands
- **Shows correct CI/CD workflow** instead
- **Reminds about proper deployment process**

## Generic Deployment Process

1. Work on your designated implementation branch
2. Follow your project's methodology guidelines
3. Use git workflow:
   ```bash
   git add [files]
   git commit -m 'descriptive message'
   git push origin [branch-name]
   ```
4. CI/CD pipeline handles deployment automatically

## Emergency Override

If absolutely necessary, unset the function:
```bash
unset -f cdk
```

But this should NEVER be needed in normal development.

## Project-Specific Notes

Check your project's documentation for:
- Specific branch names to use
- Methodology requirements 
- CI/CD pipeline details