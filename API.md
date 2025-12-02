# DTOKit API Reference

Complete API documentation for `@marianmeres/dtokit`.

## Table of Contents

- [Functions](#functions)
  - [createDtoFactory](#createdtofactory)
  - [createDtoHandler](#createdtohandler)
- [Interfaces](#interfaces)
  - [DtoFactory](#dtofactory)
- [Type Utilities](#type-utilities)
  - [HasLiteralField](#hasliteralfield)
  - [ExtractFieldValue](#extractfieldvalue)
  - [DiscriminatedKey](#discriminatedkey)
  - [DiscriminatorMap](#discriminatormap)
  - [DiscriminatorId](#discriminatorid)
  - [AnyDto](#anydto)
  - [DtoHandlers](#dtohandlers)

---

## Functions

### createDtoFactory

Creates a DTO factory for a specific schema set and discriminator field.

```typescript
function createDtoFactory<Schemas>(): <Field extends string>(
  discriminatorField: Field
) => DtoFactory<Schemas, Field>
```

#### Type Parameters

| Parameter | Description |
|-----------|-------------|
| `Schemas` | The schemas object type containing all DTO definitions. Typically `components['schemas']` from openapi-typescript generated types. |

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `discriminatorField` | `Field extends string` | The name of the field used as the discriminator (e.g., `'id'`, `'type'`, `'kind'`). |

#### Returns

`DtoFactory<Schemas, Field>` - A configured factory instance.

#### Example

```typescript
import { createDtoFactory } from '@marianmeres/dtokit';
import type { components } from './api-types';

// Create factory with 'id' as the discriminator field
const messages = createDtoFactory<components['schemas']>()('id');

// Parse incoming WebSocket message
websocket.onmessage = (event) => {
  const dto = messages.parse(JSON.parse(event.data));

  if (dto && messages.is(dto, 'subtitle')) {
    updateSubtitles(dto.text);
  }
};
```

#### Why Curried?

TypeScript doesn't support partial type inference. The curried form lets you:
1. Specify the `Schemas` type explicitly
2. Let TypeScript infer the `Field` type from the string argument

---

### createDtoHandler

Creates a switch-style handler that exhaustively handles all DTO types.

```typescript
function createDtoHandler<Schemas>(): <Field extends string, R>(
  discriminatorField: Field,
  handlers: DtoHandlers<Schemas, Field, R>
) => (dto: AnyDto<Schemas, Field>) => R
```

#### Type Parameters

| Parameter | Description |
|-----------|-------------|
| `Schemas` | The schemas object type. |
| `Field` | The discriminator field name (inferred from argument). |
| `R` | The return type of handlers (inferred from handlers object). |

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `discriminatorField` | `Field extends string` | The name of the discriminator field. |
| `handlers` | `DtoHandlers<Schemas, Field, R>` | Object mapping each discriminator value to its handler. All values must be present. |

#### Returns

`(dto: AnyDto<Schemas, Field>) => R` - A function that takes a DTO and calls the appropriate handler.

#### Example

```typescript
import { createDtoHandler } from '@marianmeres/dtokit';
import type { components } from './api-types';

const handleMessage = createDtoHandler<components['schemas']>()('id', {
  listening_start: (dto) => console.log('Started listening'),
  listening_stop: (dto) => console.log('Stopped listening'),
  subtitle: (dto) => console.log('Subtitle:', dto.text),
  error: (dto) => console.error('Error:', dto.message),
  // TypeScript ERROR if any message type is missing!
});

// Usage
const dto = factory.parse(data);
if (dto) {
  handleMessage(dto);
}
```

#### With Return Values

```typescript
const getMessage = createDtoHandler<components['schemas']>()('id', {
  start: (dto) => `Started at ${dto.timestamp}`,
  stop: (dto) => `Stopped: ${dto.reason}`,
  data: (dto) => `Data: ${dto.payload}`,
});

const message: string = getMessage(dto);
```

---

## Interfaces

### DtoFactory

Interface for a type-safe DTO factory.

```typescript
interface DtoFactory<Schemas, Field extends string> {
  readonly field: Field;
  parse(raw: unknown): AnyDto<Schemas, Field> | null;
  is<K extends DiscriminatorId<Schemas, Field>>(
    dto: AnyDto<Schemas, Field>,
    id: K
  ): dto is SafeIndex<DiscriminatorMap<Schemas, Field>, K>;
  getId(dto: AnyDto<Schemas, Field>): DiscriminatorId<Schemas, Field>;
  isValid(raw: unknown): boolean;
}
```

#### Properties

##### field

```typescript
readonly field: Field
```

The discriminator field name used by this factory.

```typescript
const factory = createDtoFactory<Schemas>()('id');
console.log(factory.field); // "id"
```

#### Methods

##### parse

```typescript
parse(raw: unknown): AnyDto<Schemas, Field> | null
```

Parse raw data into a typed DTO.

Performs minimal validation:
- Must be a non-null object
- Must have the discriminator field
- Discriminator value must be a non-empty string

Does NOT validate the full structure of the data.

**Parameters:**
- `raw` - Unknown data from any source (WebSocket, postMessage, API response, etc.)

**Returns:**
- The data cast to the DTO union type, or `null` if validation fails

**Example:**
```typescript
const factory = createDtoFactory<Schemas>()('id');

// Valid input
const dto = factory.parse({ id: "my_message", data: "hello" });

// Invalid inputs return null
factory.parse(null);           // null
factory.parse({});             // null (no id field)
factory.parse({ id: "" });     // null (empty string)
factory.parse({ id: 123 });    // null (not a string)
```

---

##### is

```typescript
is<K extends DiscriminatorId<Schemas, Field>>(
  dto: AnyDto<Schemas, Field>,
  id: K
): dto is SafeIndex<DiscriminatorMap<Schemas, Field>, K>
```

Type guard to narrow a DTO to a specific type.

**Parameters:**
- `dto` - Any valid DTO from this factory
- `id` - The discriminator value to check (autocompletes!)

**Returns:**
- Type predicate that narrows `dto` to the specific type

**Example:**
```typescript
const factory = createDtoFactory<Schemas>()('id');
const dto = factory.parse(data);

if (dto && factory.is(dto, 'subtitle')) {
  // TypeScript knows dto is SubtitleMessage here
  console.log(dto.text); // fully typed access
}
```

---

##### getId

```typescript
getId(dto: AnyDto<Schemas, Field>): DiscriminatorId<Schemas, Field>
```

Get the discriminator value from a DTO.

**Parameters:**
- `dto` - Any valid DTO from this factory

**Returns:**
- The discriminator value with proper literal union typing

**Example:**
```typescript
const factory = createDtoFactory<Schemas>()('id');
const dto = factory.parse(data);

if (dto) {
  const id = factory.getId(dto);
  // id: "message_a" | "message_b" | "message_c" | ...

  switch (id) {
    case 'message_a':
      // Handle message_a
      break;
  }
}
```

---

##### isValid

```typescript
isValid(raw: unknown): boolean
```

Check if raw data has a valid discriminator field.

**Validation rules:**
- Must be a non-null object
- Must have the discriminator field
- Discriminator value must be a non-empty string

**Parameters:**
- `raw` - Unknown data to validate

**Returns:**
- `true` if the data has a valid string discriminator field

**Example:**
```typescript
const factory = createDtoFactory<Schemas>()('id');

const messages = rawMessages.filter(msg => factory.isValid(msg));
// messages now contains only valid DTOs
```

---

## Type Utilities

### HasLiteralField

Filters types that have a literal (non-generic) string value for the given field.

```typescript
type HasLiteralField<T, Field extends string> = /* ... */
```

Returns `T` if the field exists and has a literal string value, `never` otherwise.

**Type Parameters:**
- `T` - The type to check
- `Field` - The field name to check

**Example:**
```typescript
interface MessageA { id: "a"; data: string }  // Has literal field
interface MessageB { id: string; data: string }  // Generic string - excluded
interface MessageC { name: string }  // Missing field - excluded

type A = HasLiteralField<MessageA, "id">; // MessageA
type B = HasLiteralField<MessageB, "id">; // never
type C = HasLiteralField<MessageC, "id">; // never
```

---

### ExtractFieldValue

Extracts the literal string value of a discriminator field from a type.

```typescript
type ExtractFieldValue<T, Field extends string> = /* ... */
```

**Type Parameters:**
- `T` - The type containing the field
- `Field` - The field name

**Example:**
```typescript
interface Message { id: "my_message"; data: string }

type Value = ExtractFieldValue<Message, "id">; // "my_message"
```

---

### DiscriminatedKey

Gets all schema keys that have a literal value for the discriminator field.

```typescript
type DiscriminatedKey<Schemas, Field extends string> = /* ... */
```

**Type Parameters:**
- `Schemas` - An object type mapping schema names to their types
- `Field` - The discriminator field name

**Example:**
```typescript
interface Schemas {
  MessageA: { id: "a"; payload: string };
  MessageB: { id: "b"; data: number };
  Other: { name: string };  // No 'id' field
}

type Keys = DiscriminatedKey<Schemas, "id">; // "MessageA" | "MessageB"
```

---

### DiscriminatorMap

Builds a map from discriminator values to their corresponding types.

```typescript
type DiscriminatorMap<Schemas, Field extends string> = /* ... */
```

**Type Parameters:**
- `Schemas` - An object type mapping schema names to their types
- `Field` - The discriminator field name

**Example:**
```typescript
interface Schemas {
  MessageA: { id: "a"; payload: string };
  MessageB: { id: "b"; data: number };
}

type Map = DiscriminatorMap<Schemas, "id">;
// Results in: { a: { id: "a"; payload: string }; b: { id: "b"; data: number } }

// Access specific type by discriminator value:
type TypeA = Map["a"]; // { id: "a"; payload: string }
```

---

### DiscriminatorId

Union of all discriminator values (literal strings) for a given field.

```typescript
type DiscriminatorId<Schemas, Field extends string> = /* ... */
```

**Type Parameters:**
- `Schemas` - An object type mapping schema names to their types
- `Field` - The discriminator field name

**Example:**
```typescript
interface Schemas {
  MessageA: { id: "start"; data: string };
  MessageB: { id: "stop"; data: string };
  MessageC: { id: "pause"; data: string };
}

type Id = DiscriminatorId<Schemas, "id">; // "start" | "stop" | "pause"
```

---

### AnyDto

Union of all DTO types that match the discriminator pattern.

```typescript
type AnyDto<Schemas, Field extends string> = /* ... */
```

**Type Parameters:**
- `Schemas` - An object type mapping schema names to their types
- `Field` - The discriminator field name

**Example:**
```typescript
interface Schemas {
  MessageA: { id: "a"; payload: string };
  MessageB: { id: "b"; data: number };
}

type Any = AnyDto<Schemas, "id">;
// Results in: { id: "a"; payload: string } | { id: "b"; data: number }

function processMessage(msg: Any) {
  // msg can be either MessageA or MessageB
}
```

---

### DtoHandlers

Type definition for exhaustive switch-style handlers.

```typescript
type DtoHandlers<Schemas, Field extends string, R> = {
  [K in DiscriminatorId<Schemas, Field>]: (
    dto: SafeIndex<DiscriminatorMap<Schemas, Field>, K>
  ) => R;
}
```

Maps each discriminator value to a handler function. TypeScript will error if any discriminator value is not handled.

**Type Parameters:**
- `Schemas` - The schemas object type
- `Field` - The discriminator field name
- `R` - The return type of all handler functions

**Example:**
```typescript
type Handlers = DtoHandlers<Schemas, 'id', void>;
// Results in: {
//   message_a: (dto: MessageA) => void;
//   message_b: (dto: MessageB) => void;
//   // ... one handler for each discriminator value
// }
```

---

## Type Utilities Summary Table

| Type | Description |
|------|-------------|
| `HasLiteralField<T, F>` | Filter for types with literal field |
| `ExtractFieldValue<T, F>` | Extract literal value from type |
| `DiscriminatedKey<S, F>` | Schema keys with literal discriminator |
| `DiscriminatorMap<S, F>` | Map from discriminator values to types |
| `DiscriminatorId<S, F>` | Union of all discriminator values |
| `AnyDto<S, F>` | Union of all DTO types |
| `DtoHandlers<S, F, R>` | Handler map type for exhaustive handling |
