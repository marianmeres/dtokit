# CLAUDE.md - AI Assistant Guide for DTOKit

This file provides context for AI assistants working with the DTOKit codebase.

## Quick Reference

- **Package**: `@marianmeres/dtokit`
- **Purpose**: Type-safe DTO factory for discriminated unions in TypeScript
- **Entry Point**: `src/mod.ts` (re-exports from `src/dtokit.ts`)
- **Tests**: `tests/dtokit.test.ts` (33 tests)
- **Documentation**: See [API.md](./API.md) for full API reference

## Documentation Files

| File | Purpose |
|------|---------|
| [llm.txt](./llm.txt) | Machine-readable package report with structured metadata |
| [API.md](./API.md) | Complete API documentation with examples |
| [README.md](./README.md) | User-facing documentation and quick start guide |

## Project Structure

```
src/
  mod.ts          # Main export barrel
  dtokit.ts       # Core implementation (~590 lines)
tests/
  dtokit.test.ts  # Test suite (33 tests)
scripts/
  build-npm.ts    # NPM distribution builder
```

## Development Commands

```bash
# Run tests (watch mode)
deno task test

# Type check
deno check src/mod.ts

# Build for npm
deno task npm:build

# Publish to npm
deno task npm:publish
```

## Key Concepts

### Discriminated Unions

The library works with TypeScript's discriminated union pattern where a literal string field identifies the type:

```typescript
// OpenAPI schemas typically generate types like:
interface StartMessage { id: "start"; timestamp: number }
interface StopMessage { id: "stop"; reason: string }

// The 'id' field with literal values enables type narrowing
```

### Curried Factory Pattern

Both `createDtoFactory` and `createDtoHandler` use currying to work around TypeScript's lack of partial type inference:

```typescript
// First call: specify Schemas type explicitly
// Second call: Field type is inferred from string
const factory = createDtoFactory<Schemas>()('id');
```

### Minimal Validation

The factory intentionally performs minimal runtime validation (only checks discriminator field exists and is non-empty string). This is by design for:
- Performance (minimal overhead)
- Trust of upstream data
- OpenAPI types as source of truth

## Code Patterns

### Type Guards

The `is()` method returns a type predicate:
```typescript
if (factory.is(dto, 'start')) {
  // dto is narrowed to StartMessage
}
```

### Exhaustive Handlers

`createDtoHandler` enforces handling all discriminator values at compile time:
```typescript
const handle = createDtoHandler<Schemas>()('id', {
  start: (dto) => { /* StartMessage */ },
  stop: (dto) => { /* StopMessage */ },
  // TypeScript ERROR if any type is missing
});
```

## Common Tasks

### Adding a New Feature

1. Modify `src/dtokit.ts`
2. Add tests in `tests/dtokit.test.ts`
3. Run `deno check src/mod.ts` to verify types
4. Run `deno test` to verify tests pass
5. Update JSDoc comments as needed

### Fixing Type Errors

The codebase uses advanced TypeScript features:
- Conditional types (`T extends U ? X : Y`)
- Mapped types with key remapping (`[K in Keys as ...]`)
- Type inference with `infer`
- Type predicates (`dto is Type`)

Key helper types for type safety:
- `ValueOf<T>` - Gets union of all values in mapped type
- `SafeIndex<T, K>` - Safely indexes into type (returns `never` if invalid)

### Running Tests

```bash
# All tests
deno test

# Watch mode
deno task test

# Specific test file
deno test tests/dtokit.test.ts
```

## Architecture Notes

- **Zero dependencies**: No external runtime dependencies
- **Deno-first**: Primary development target, with npm build for Node.js
- **Type-driven**: Heavy reliance on TypeScript's type system for compile-time safety
- **Minimal runtime**: Validation is intentionally light for performance

## Common Issues

### "Type cannot be used to index" Errors

These usually occur when TypeScript can't prove a generic type is valid for indexing. Solutions:
- Use `SafeIndex<T, K>` helper type
- Add type constraints (`K extends keyof T`)
- Use conditional types to handle edge cases

### Test Type Errors

Tests use `@std/assert` from Deno. Ensure imports match:
```typescript
import { assertEquals, assertExists } from "@std/assert";
```

## Formatting

The project uses Deno's formatter with these settings (from `deno.json`):
- Tabs for indentation
- 90 character line width
- 4-space tab width
