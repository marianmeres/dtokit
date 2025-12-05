# @marianmeres/dtokit

[![NPM Version](https://img.shields.io/npm/v/@marianmeres/dtokit)](https://www.npmjs.com/package/@marianmeres/dtokit)
[![JSR Version](https://jsr.io/badges/@marianmeres/dtokit)](https://jsr.io/@marianmeres/dtokit)

A generic, type-safe factory for working with discriminated unions in TypeScript.

**Zero dependencies. Full type safety. Minimal runtime overhead.**

Thanks to [Lukas Votypka](https://github.com/lukasvotypka) for the initial idea.

## The Problem

When receiving data through transports like WebSockets, postMessage, or custom protocols, you often need to:

1. Identify what type of message you received
2. Get full TypeScript type safety for that specific message type
3. Do this without runtime validation overhead

If your API uses a discriminator pattern (a field like `id` or `type` with literal string values), this factory automates the type narrowing.

## Installation

### Deno (JSR)

```bash
deno add jsr:@marianmeres/dtokit
```

### Node.js (npm)

```bash
npm install @marianmeres/dtokit
```

## Quick Start

```ts
import { createDtoFactory } from '@marianmeres/dtokit';

// Your schema: an object where each property is a type with a literal discriminator field
interface Schemas {
  FooMessage: { id: 'foo' };
  BarMessage: { id: 'bar'; data?: { text: string } };
}

// 1. Create a factory for your schemas, specifying the discriminator field
const messages = createDtoFactory<Schemas>()('id');

// 2. Parse incoming data
const dto = messages.parse(rawWebSocketMessage);

// 3. Use type guards for full type safety
if (dto && messages.is(dto, 'bar')) {
  // dto is fully typed as BarMessage
  console.log(dto.data?.text);
}
```

## Why Not Class Instances?

You might wonder: "Why does `parse()` return plain objects? Couldn't there be a `factory()` method that returns actual class instances with methods?"

Technically yes, but it would defeat the purpose of this library.

The core value of dtokit is **zero boilerplate**:

```
schema types → immediate type-safe usage
```

To support class instances, you'd need to:

1. Manually write a class for each message type
2. Register each class constructor with the factory
3. Keep classes in sync with schema changes

At that point, you're just writing:

```ts
if (raw.id === 'bar') return new BarMessage(raw);
```

...which requires no library at all. The "factory" would be syntactic sugar over a switch statement you have to maintain anyway.

**Bottom line:** If you need class instances with methods, you're solving a different problem than what dtokit addresses. This library is for when your types are sufficient and you just need type-safe runtime narrowing.

## How It Works

### The Discriminator Pattern

Your schemas must be an object type where each property represents a message type with a **literal string value** for the discriminator field:

```ts
interface Schemas {
  FooMessage: { id: 'foo' };                           // literal "foo"
  BarMessage: { id: 'bar'; data: { text: string } };   // literal "bar"
}
```

The factory uses TypeScript's type system to:

1. **Find all types** with a literal value for your discriminator field
2. **Build a map** from discriminator values to their types
3. **Provide type guards** that narrow to the exact type

```ts
// The factory automatically discovers:
// { "foo": FooMessage, "bar": BarMessage, ... }
```

### Real-World Example: OpenAPI

A common source of such schemas is [openapi-typescript](https://github.com/openapi-ts/openapi-typescript), which generates TypeScript types from OpenAPI specs:

```yaml
# OpenAPI schema
components:
  schemas:
    FooMessage:
      properties:
        id:
          type: string
          enum: ["foo"]  # becomes literal type!
```

```ts
// Generated TypeScript
import type { components } from './generated-types';

const messages = createDtoFactory<components['schemas']>()('id');
```

## API Reference

For complete API documentation, see [API.md](./API.md).

| Method | Description |
|--------|-------------|
| `createDtoFactory<Schemas>()(field)` | Creates a factory for your schemas with the given discriminator field |
| `factory.parse(raw)` | Parses unknown data into a typed DTO (returns `null` if invalid) |
| `factory.is(dto, id)` | Type guard to narrow a DTO to a specific type |
| `factory.getId(dto)` | Gets the discriminator value from a DTO |
| `factory.isValid(raw)` | Checks if raw data has a valid discriminator field |
| `factory.field` | The discriminator field name (readonly) |

## Advanced Usage

### Switch-Style Exhaustive Handling

Use `createDtoHandler` for exhaustive switch-like handling:

```ts
import { createDtoHandler } from '@marianmeres/dtokit';

const handleMessage = createDtoHandler<Schemas>()('id', {
  foo: (dto) => console.log('Foo received'),
  bar: (dto) => console.log('Bar:', dto.data?.text),
  // TypeScript ERROR if you miss any message type!
});

handleMessage(dto);
```

### Exporting Derived Types

Export types for use in other modules:

```ts
import { createDtoFactory, DiscriminatorMap, DiscriminatorId, AnyDto } from '@marianmeres/dtokit';

export const messages = createDtoFactory<Schemas>()('id');

export type MessageMap = DiscriminatorMap<Schemas, 'id'>;
export type MessageId = DiscriminatorId<Schemas, 'id'>;
export type AnyMessage = AnyDto<Schemas, 'id'>;
```

### Changing the Discriminator Field

If you later decide to use `type` instead of `id`:

```ts
// Before
const messages = createDtoFactory<Schemas>()('id');

// After - just change one string!
const messages = createDtoFactory<Schemas>()('type');
```

All your existing code continues to work.

### Multiple Discriminator Patterns

If your API has different discriminator fields for different schema groups:

```ts
// WebSocket messages use 'id'
const wsMessages = createDtoFactory<WsSchemas>()('id');

// REST responses use 'type'
const apiResponses = createDtoFactory<ApiSchemas>()('type');
```

### Real World Integration Example

The [@marianmeres/actor](https://github.com/marianmeres/actor) library provides typed actors with compile-time exhaustive message handling powered by dtokit:

```ts
import { createTypedStateActor } from '@marianmeres/actor';

type Schemas = {
  INC: { type: 'INC' };
  DEC: { type: 'DEC' };
  ADD: { type: 'ADD'; amount: number };
};

const counter = createTypedStateActor<Schemas, number>(0, {
  INC: (_, state) => state + 1,
  DEC: (_, state) => state - 1,
  // ADD: (msg, state) => state + msg.amount, // intentionally omitted
  // TypeScript will error as we missed the ADD message type
});
```

## Type Utilities Reference

These types are exported for advanced use cases:

| Type | Description |
|------|-------------|
| `DiscriminatorMap<S, F>` | Map from discriminator values to types |
| `DiscriminatorId<S, F>` | Union of all discriminator values |
| `AnyDto<S, F>` | Union of all DTO types |
| `HasLiteralField<T, F>` | Filter for types with literal field |
| `ExtractFieldValue<T, F>` | Extract literal value from type |
| `DtoHandlers<S, F, R>` | Handler map type for exhaustive handling |

For detailed documentation of each type, see [API.md](./API.md).

## FAQ

### Why not use XYZ library for runtime validation?

This factory is intentionally lightweight. It only checks that the discriminator field exists and is a string—it trusts the shape beyond that. This is appropriate when:

- Your data comes from a trusted source (your own backend)
- You want minimal runtime overhead
- Your schema types are your source of truth

If you need full runtime validation, consider using Zod or similar libraries.

### Why the double function call `createDtoFactory<S>()(field)`?

This is a workaround for a TypeScript limitation: **you cannot partially specify generic type parameters**. It's either all or nothing.

#### The Problem

In an ideal world, you'd write:

```ts
// HYPOTHETICAL - doesn't work in TypeScript
const messages = createDtoFactory<Schemas>('id');
//                                 ↑ explicit  ↑ inferred
```

You want to:
1. **Explicitly specify** `Schemas` (because it can't be inferred from arguments)
2. **Let TypeScript infer** `Field` from the string `'id'`

But TypeScript requires you to specify **all** type parameters or **none**.

#### Without Currying (Doesn't Work Well)

If the function had a single call signature:

```ts
function createDtoFactory<Schemas, Field extends string>(
  discriminatorField: Field
): DtoFactory<Schemas, Field>
```

Your options would be:

```ts
// Option 1: Specify only Schemas
createDtoFactory<Schemas>('id');
// ERROR: Expected 2 type arguments, but got 1

// Option 2: Specify both - works but verbose and error-prone
createDtoFactory<Schemas, 'id'>('id');
//                        ↑ redundant! must match the string exactly

// Option 3: Specify neither
createDtoFactory('id');
// Schemas becomes `unknown` - useless, no type safety
```

#### The Curried Solution

By splitting into two function calls, each function gets its own generic scope:

```ts
function createDtoFactory<Schemas>() {
  return function <Field extends string>(
    discriminatorField: Field
  ): DtoFactory<Schemas, Field>;
}
```

Now TypeScript can handle each step independently:

```ts
const messages = createDtoFactory<Schemas>()('id');
//               ↑ first call: you specify Schemas explicitly
//                                          ↑ second call: Field inferred as literal "id"
```

#### Is This Pattern Common?

Yes! This curried pattern is used by many TypeScript libraries facing the same limitation, including Zod, tRPC, and others. It's the standard workaround until TypeScript adds partial type argument inference (a long-requested feature)

### What if a schema has both `id` and `type` fields?

The factory only looks at the field you specify. A schema will be included if it has a literal value for that specific field.

## License

MIT
