# AGENTS.md - Machine-Readable Package Documentation

## Package Metadata

```yaml
name: "@marianmeres/dtokit"
version: "1.0.1"
description: "Type-safe DTO factory for discriminated unions in TypeScript"
author: "Marian Meres"
license: "MIT"
repository: "https://github.com/marianmeres/dtokit"
runtime: "Deno-first, npm-compatible"
dependencies: "none"
```

## Package Purpose

DTOKit provides compile-time type safety for discriminated unions in TypeScript. It is designed for scenarios where:

1. Data arrives from untyped sources (WebSocket, postMessage, API responses)
2. Data uses a discriminator pattern (literal string field identifies type)
3. Full TypeScript narrowing is needed after identifying the type
4. Runtime validation overhead should be minimal

## Architecture

```
src/
├── mod.ts          # Re-export barrel (1 line)
└── dtokit.ts       # Core implementation (~590 lines)
    ├── Type utilities (lines 35-211)
    ├── DtoFactory interface (lines 213-363)
    ├── createDtoFactory function (lines 365-469)
    └── createDtoHandler function (lines 471-590)

tests/
└── dtokit.test.ts  # Test suite (33 tests, ~580 lines)
```

## Public API Summary

### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `createDtoFactory` | `<Schemas>() => <Field>(field) => DtoFactory` | Create DTO factory |
| `createDtoHandler` | `<Schemas>() => <Field, R>(field, handlers) => (dto) => R` | Create exhaustive handler |

### Interfaces

| Interface | Type Parameters | Methods |
|-----------|-----------------|---------|
| `DtoFactory` | `Schemas, Field extends string` | `field`, `parse`, `is`, `getId`, `isValid` |

### Type Utilities

| Type | Parameters | Returns |
|------|------------|---------|
| `HasLiteralField<T, F>` | Type T, Field F | T if has literal, never otherwise |
| `ExtractFieldValue<T, F>` | Type T, Field F | Literal string value |
| `DiscriminatedKey<S, F>` | Schemas S, Field F | Union of schema keys |
| `DiscriminatorMap<S, F>` | Schemas S, Field F | Map: discriminator value -> type |
| `DiscriminatorId<S, F>` | Schemas S, Field F | Union of discriminator values |
| `AnyDto<S, F>` | Schemas S, Field F | Union of all DTO types |
| `DtoHandlers<S, F, R>` | Schemas S, Field F, Return R | Handler map type |

## DtoFactory Interface Methods

### field (readonly property)
- Type: `Field`
- Returns: The discriminator field name

### parse(raw: unknown)
- Input: Unknown data
- Output: `AnyDto<Schemas, Field> | null`
- Validation: Checks discriminator field exists and is non-empty string
- Behavior: Returns same object reference if valid, null if invalid

### is(dto, id)
- Input: Valid DTO, discriminator value
- Output: Type predicate narrowing dto to specific type
- Use case: Type guards in conditionals

### getId(dto)
- Input: Valid DTO
- Output: Discriminator value with literal union type
- Use case: Switch statements, logging

### isValid(raw: unknown)
- Input: Unknown data
- Output: boolean
- Use case: Pre-filtering, validation

## Validation Rules

The factory performs minimal runtime validation:

```
1. raw !== null && raw !== undefined
2. typeof raw === "object"
3. raw[field] exists
4. typeof raw[field] === "string"
5. raw[field].length > 0
```

Does NOT validate:
- Full object structure
- Nested properties
- Type correctness beyond discriminator

## Type System Mechanics

### Discriminated Union Detection

```typescript
// Type with literal field (included)
interface Msg { id: "foo"; data: string }

// Type with generic string (excluded)
interface Bad { id: string; data: string }

// Type without field (excluded)
interface Other { name: string }
```

### Curried Pattern Rationale

TypeScript lacks partial type argument inference. Currying separates:
1. First call: Explicit Schemas type
2. Second call: Inferred Field type from string literal

```typescript
createDtoFactory<Schemas>()('id')
//              ↑ explicit   ↑ inferred
```

## Development Commands

```bash
deno test              # Run tests once
deno task test         # Run tests (watch mode)
deno check src/mod.ts  # Type check
deno task npm:build    # Build npm distribution
deno task npm:publish  # Build and publish to npm
```

## Test Coverage

33 tests covering:
- Factory creation (2 tests)
- isValid validation (8 tests)
- parse behavior (3 tests)
- is type guard (3 tests)
- getId behavior (2 tests)
- Different discriminator fields (2 tests)
- createDtoHandler (3 tests)
- Type utilities (3 tests)
- Edge cases (4 tests)
- DtoFactory interface (1 test)
- Real-world simulations (2 tests)

## File Dependencies

```
src/mod.ts
└── src/dtokit.ts (no external dependencies)

tests/dtokit.test.ts
├── @std/assert (Deno standard library)
└── src/mod.ts
```

## Common Modification Patterns

### Adding a new factory method

1. Add method signature to `DtoFactory` interface (line ~239)
2. Implement method in returned object (line ~433)
3. Add JSDoc documentation
4. Add test cases

### Adding a new type utility

1. Add type definition in type utilities section (lines 35-211)
2. Export from dtokit.ts if public
3. Add JSDoc documentation with examples
4. Add compile-time test in test file

## Error Handling

- No exceptions thrown
- Invalid input returns null from parse()
- Invalid input returns false from isValid()
- Type errors caught at compile time

## Performance Characteristics

- O(1) parse validation (single property check)
- O(1) is() type guard (single comparison)
- O(1) getId() (single property access)
- No deep cloning (returns same reference)
- No schema iteration at runtime

## Integration Patterns

### WebSocket Messages
```typescript
const factory = createDtoFactory<Schemas>()('id');
ws.onmessage = (e) => {
  const dto = factory.parse(JSON.parse(e.data));
  if (dto && factory.is(dto, 'foo')) { /* typed */ }
};
```

### OpenAPI Generated Types
```typescript
import type { components } from './generated-types';
const factory = createDtoFactory<components['schemas']>()('id');
```

### Exhaustive Handling
```typescript
const handle = createDtoHandler<Schemas>()('id', {
  foo: (dto) => /* ... */,
  bar: (dto) => /* ... */,
  // TypeScript error if any type missing
});
```

## Related Files

| File | Purpose |
|------|---------|
| CLAUDE.md | AI assistant guide (human-readable) |
| API.md | Full API documentation |
| README.md | User-facing documentation |
| llm.txt | Machine-readable package report |
| deno.json | Project configuration |
