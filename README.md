# DTOKit

A generic, type-safe factory for working with discriminated unions in TypeScript. Designed to work seamlessly with OpenAPI-generated types.

**Zero dependencies. Full type safety. Minimal runtime overhead.**

## Disclaimer

Built by a mass of highly-evolved neural connections (Claude) under the loose supervision of a mass of slightly-less-evolved neural connections ([@marianmeres](https://github.com/marianmeres)). The human contributed the big ideas, mass caffeine consumption, and a frankly heroic number of "no, not like that" prompts. The AI did the actual typing. We make a great team—one of us just happens to be better at remembering semicolons.

Also, thanks to [Lukas Votypka](https://github.com/lukas-votypka) for the initial idea.

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
import type { components } from './types'; // your openapi-typescript generated types

// 1. Create a factory for your schemas, specifying the discriminator field
const messages = createDtoFactory<components['schemas']>()('id');

// 2. Parse incoming data
const dto = messages.parse(rawWebSocketMessage);

// 3. Use type guards for full type safety
if (dto && messages.is(dto, 'subtitle')) {
  // dto is fully typed as SubtitleMessage
  console.log(dto.data?.text);
}
```

## How It Works

### The Discriminator Pattern

Your OpenAPI schemas likely look like this:

```yaml
components:
  schemas:
    ListeningStartMessage:
      properties:
        id:
          type: string
          enum: ["listening_start"]  # literal value!

    SubtitleMessage:
      properties:
        id:
          type: string
          enum: ["subtitle"]  # literal value!
        data:
          $ref: '#/components/schemas/SubtitleData'
```

The generated TypeScript types have literal string types:

```ts
interface ListeningStartMessage {
  id: "listening_start";  // literal, not string
}

interface SubtitleMessage {
  id: "subtitle";  // literal, not string
  data: SubtitleData | null;
}
```

### Automatic Type Discovery

The factory uses TypeScript's type system to:

1. **Find all schemas** with a literal value for your discriminator field
2. **Build a map** from discriminator values to their types
3. **Provide type guards** that narrow to the exact type

```ts
// The factory automatically discovers:
// {
//   "listening_start": ListeningStartMessage,
//   "subtitle": SubtitleMessage,
//   "custom": CustomMessage,
//   ... all other schemas with literal `id` field
// }
```

## API Reference

For complete API documentation, see [API.md](./API.md).

### Quick Reference

#### `createDtoFactory<Schemas>()(field)`

Creates a factory bound to your schemas and discriminator field.

```ts
const factory = createDtoFactory<components['schemas']>()('id');
```

**Parameters:**
- `Schemas` - Type parameter: your schemas object (e.g., `components['schemas']`)
- `field` - The discriminator field name (e.g., `'id'`, `'type'`, `'kind'`)

**Returns:** `DtoFactory` instance

---

#### `factory.parse(raw)`

Parses unknown data into a typed DTO.

```ts
const dto = factory.parse(rawData);
// dto: AnyMessage | null
```

**Parameters:**
- `raw` - Unknown data from any source

**Returns:** Typed DTO or `null` if invalid

---

#### `factory.is(dto, id)`

Type guard to narrow a DTO to a specific type.

```ts
if (factory.is(dto, 'subtitle')) {
  // dto: SubtitleMessage
  dto.data?.text; // fully typed
}
```

**Parameters:**
- `dto` - Any valid DTO from this factory
- `id` - The discriminator value to check (autocompletes!)

**Returns:** Type predicate

---

#### `factory.getId(dto)`

Gets the discriminator value from a DTO.

```ts
const id = factory.getId(dto);
// id: "listening_start" | "subtitle" | "custom" | ...
```

---

#### `factory.isValid(raw)`

Checks if raw data has a valid discriminator field.

```ts
if (factory.isValid(rawData)) {
  // rawData has a non-empty string for the discriminator field
}
```

---

#### `factory.field`

The discriminator field name (readonly).

```ts
console.log(factory.field); // "id"
```

## Advanced Usage

### Switch-Style Exhaustive Handling

Use `createDtoHandler` for exhaustive switch-like handling:

```ts
import { createDtoHandler } from '@marianmeres/dtokit';
import type { components } from './types';

const handleMessage = createDtoHandler<components['schemas']>()('id', {
  listening_start: (dto) => {
    console.log('Started listening');
  },
  listening_stop: (dto) => {
    console.log('Stopped listening');
  },
  subtitle: (dto) => {
    console.log('Subtitle:', dto.data?.text);
  },
  // TypeScript ERROR if you miss any message type!
});

// Usage
handleMessage(dto);
```

### Exporting Derived Types

Export types for use in other modules:

```ts
import {
  createDtoFactory,
  DiscriminatorMap,
  DiscriminatorId,
  AnyDto
} from '@marianmeres/dtokit';
import type { components } from './types';

type Schemas = components['schemas'];

// Create factory
export const messages = createDtoFactory<Schemas>()('id');

// Export derived types
export type MessageMap = DiscriminatorMap<Schemas, 'id'>;
export type MessageId = DiscriminatorId<Schemas, 'id'>;
export type AnyMessage = AnyDto<Schemas, 'id'>;

// Now other modules can use these types
// import type { MessageId, AnyMessage } from './messages';
```

### Changing the Discriminator Field

If you later decide to use `type` instead of `id`:

```ts
// Before
const messages = createDtoFactory<components['schemas']>()('id');

// After - just change one string!
const messages = createDtoFactory<components['schemas']>()('type');
```

All your existing code continues to work.

### Multiple Discriminator Patterns

If your API has different discriminator fields for different schema groups:

```ts
// WebSocket messages use 'id'
const wsMessages = createDtoFactory<components['schemas']>()('id');

// REST responses use 'type'
const apiResponses = createDtoFactory<components['schemas']>()('type');
```

### WebSocket Integration Example

```ts
import { createDtoFactory } from '@marianmeres/dtokit';
import type { components } from './types';

const messages = createDtoFactory<components['schemas']>()('id');

websocket.onmessage = (event) => {
  const raw = JSON.parse(event.data);
  const dto = messages.parse(raw);

  if (!dto) {
    console.warn('Unknown message format:', raw);
    return;
  }

  // Handle specific message types
  if (messages.is(dto, 'subtitle')) {
    updateSubtitles(dto.data?.text);
  } else if (messages.is(dto, 'listening_start')) {
    showListeningIndicator();
  } else if (messages.is(dto, 'conversation_done')) {
    closeConversation();
  }

  // Or use switch for exhaustive handling
  switch (messages.getId(dto)) {
    case 'subtitle':
      // TypeScript knows dto could be SubtitleMessage here,
      // but for full narrowing use messages.is()
      break;
  }
};
```

### Svelte 5 Integration Example

```svelte
<script lang="ts">
  import { createDtoFactory } from '@marianmeres/dtokit';
  import type { components } from './types';

  const messages = createDtoFactory<components['schemas']>()('id');

  let subtitleText = $state('');
  let isListening = $state(false);

  function handleMessage(raw: unknown) {
    const dto = messages.parse(raw);
    if (!dto) return;

    if (messages.is(dto, 'subtitle')) {
      subtitleText = dto.data?.text ?? '';
    } else if (messages.is(dto, 'listening_start')) {
      isListening = true;
    } else if (messages.is(dto, 'listening_stop')) {
      isListening = false;
    }
  }
</script>

<div class="subtitle" class:listening={isListening}>
  {subtitleText}
</div>
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

### Why not use Zod/Valibot for runtime validation?

This factory is intentionally lightweight. It only checks that the discriminator field exists and is a string—it trusts the shape beyond that. This is appropriate when:

- Your data comes from a trusted source (your own backend)
- You want minimal runtime overhead
- The OpenAPI types are your source of truth

If you need full runtime validation, consider using `openapi-zod-client` to generate Zod schemas.

### Why the double function call `createDtoFactory<S>()(field)`?

This is a workaround for a TypeScript limitation: **you cannot partially specify generic type parameters**. It's either all or nothing.

#### The Problem

In an ideal world, you'd write:

```ts
// HYPOTHETICAL - doesn't work in TypeScript
const messages = createDtoFactory<components['schemas']>('id');
//                                 ↑ explicit            ↑ inferred
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
createDtoFactory<components['schemas']>('id');
// ERROR: Expected 2 type arguments, but got 1

// Option 2: Specify both - works but verbose and error-prone
createDtoFactory<components['schemas'], 'id'>('id');
//                                      ↑ redundant! must match the string exactly

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
const messages = createDtoFactory<components['schemas']>()('id');
//               ↑ first call: you specify Schemas explicitly
//                                                      ↑ second call: Field inferred as literal "id"
```

#### Is This Pattern Common?

Yes! This curried pattern is used by many TypeScript libraries facing the same limitation, including Zod, tRPC, and others. It's the standard workaround until TypeScript adds partial type argument inference (a long-requested feature)

### What if a schema has both `id` and `type` fields?

The factory only looks at the field you specify. A schema will be included if it has a literal value for that specific field.

## License

MIT
