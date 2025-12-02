/**
 * @module dtokit
 * @packageDocumentation
 *
 * A generic, type-safe factory for creating DTOs from discriminated unions.
 * Works with any OpenAPI-generated types that use a literal string field as discriminator.
 *
 * This library provides:
 * - Type-safe parsing of unknown data into discriminated union types
 * - Type guards for narrowing to specific DTO types
 * - Exhaustive switch-style handlers with compile-time checks
 * - Zero external dependencies
 *
 * @example
 * ```typescript
 * import { createDtoFactory, DiscriminatorMap } from '@marianmeres/dtokit';
 * import type { components } from './types';
 *
 * // Create factory for schemas using 'id' as discriminator
 * const messages = createDtoFactory<components['schemas']>()('id');
 *
 * // Parse incoming data
 * const dto = messages.parse(rawWebSocketMessage);
 *
 * // Type-safe narrowing
 * if (dto && messages.is(dto, 'bar')) {
 *   console.log(dto.data?.text); // fully typed!
 * }
 * ```
 *
 * @author Marian Meres
 * @license MIT
 */

// ============================================
// Core Type Utilities
// ============================================

/**
 * Filters types that have a literal (non-generic) string value for the given field.
 * Returns `never` if the field doesn't exist or is a generic `string` type.
 *
 * This utility type is used internally to identify which schemas in a collection
 * have a literal string discriminator field that can be used for type narrowing.
 *
 * @typeParam T - The type to check for a literal field
 * @typeParam Field - The name of the field to check (must be a string literal)
 *
 * @example
 * ```typescript
 * interface MessageA { id: "a"; data: string }  // Has literal field
 * interface MessageB { id: string; data: string }  // Has generic string - excluded
 * interface MessageC { name: string }  // Missing field - excluded
 *
 * type A = HasLiteralField<MessageA, "id">; // MessageA
 * type B = HasLiteralField<MessageB, "id">; // never
 * type C = HasLiteralField<MessageC, "id">; // never
 * ```
 */
export type HasLiteralField<T, Field extends string> = Field extends keyof T
	? T[Field] extends string
		? string extends T[Field]
			? never // reject generic string - we need literal types
			: T
		: never
	: never;

/**
 * Extracts the literal string value of a discriminator field from a type.
 *
 * Given a type with a literal string field, this extracts the literal value itself.
 * Returns `never` if the field doesn't exist or isn't a string.
 *
 * @typeParam T - The type containing the discriminator field
 * @typeParam Field - The name of the discriminator field
 *
 * @example
 * ```typescript
 * interface Message { id: "my_message"; data: string }
 *
 * type Value = ExtractFieldValue<Message, "id">; // "my_message"
 * ```
 */
export type ExtractFieldValue<T, Field extends string> = Field extends keyof T
	? T[Field] extends infer V extends string
		? V
		: never
	: never;

/**
 * Gets all schema keys that have a literal value for the discriminator field.
 *
 * Iterates through all keys of a schemas object and returns only those
 * whose corresponding types have a literal string value for the discriminator field.
 *
 * @typeParam Schemas - An object type mapping schema names to their types
 * @typeParam Field - The discriminator field name to check
 *
 * @example
 * ```typescript
 * interface Schemas {
 *   MessageA: { id: "a"; payload: string };
 *   MessageB: { id: "b"; data: number };
 *   Other: { name: string };  // No 'id' field
 * }
 *
 * type Keys = DiscriminatedKey<Schemas, "id">; // "MessageA" | "MessageB"
 * ```
 */
export type DiscriminatedKey<Schemas, Field extends string> = {
	[K in keyof Schemas]: HasLiteralField<Schemas[K], Field> extends never
		? never
		: K;
}[keyof Schemas];

/**
 * Builds a map from discriminator values to their corresponding types.
 *
 * This is a key type utility that transforms a schemas object into a lookup table
 * where keys are the literal discriminator values and values are the corresponding types.
 *
 * @typeParam Schemas - An object type mapping schema names to their types
 * @typeParam Field - The discriminator field name
 *
 * @example
 * ```typescript
 * interface Schemas {
 *   MessageA: { id: "a"; payload: string };
 *   MessageB: { id: "b"; data: number };
 * }
 *
 * type Map = DiscriminatorMap<Schemas, "id">;
 * // Results in: { a: { id: "a"; payload: string }; b: { id: "b"; data: number } }
 *
 * // Access specific type by discriminator value:
 * type TypeA = Map["a"]; // { id: "a"; payload: string }
 * ```
 */
export type DiscriminatorMap<Schemas, Field extends string> = {
	[K in DiscriminatedKey<Schemas, Field> as ExtractFieldValue<
		Schemas[K],
		Field
	>]: Schemas[K];
};

/**
 * Helper type to safely get all values from a mapped type as a union.
 * @internal
 */
type ValueOf<T> = T[keyof T];

/**
 * Helper type to safely index into a mapped type with a constrained key.
 * Returns `never` if the key is not valid for the type.
 * @internal
 */
type SafeIndex<T, K> = K extends keyof T ? T[K] : never;

/**
 * Union of all discriminator values (literal strings) for a given field.
 *
 * Extracts all possible discriminator values from schemas that have a literal
 * value for the specified field.
 *
 * @typeParam Schemas - An object type mapping schema names to their types
 * @typeParam Field - The discriminator field name
 *
 * @example
 * ```typescript
 * interface Schemas {
 *   MessageA: { id: "start"; data: string };
 *   MessageB: { id: "stop"; data: string };
 *   MessageC: { id: "pause"; data: string };
 * }
 *
 * type Id = DiscriminatorId<Schemas, "id">; // "start" | "stop" | "pause"
 * ```
 */
export type DiscriminatorId<Schemas, Field extends string> = keyof DiscriminatorMap<
	Schemas,
	Field
> &
	string;

/**
 * Union of all DTO types that match the discriminator pattern.
 *
 * Creates a union type of all schemas that have a literal discriminator field,
 * useful for typing variables that can hold any valid DTO.
 *
 * @typeParam Schemas - An object type mapping schema names to their types
 * @typeParam Field - The discriminator field name
 *
 * @example
 * ```typescript
 * interface Schemas {
 *   MessageA: { id: "a"; payload: string };
 *   MessageB: { id: "b"; data: number };
 * }
 *
 * type Any = AnyDto<Schemas, "id">;
 * // Results in: { id: "a"; payload: string } | { id: "b"; data: number }
 *
 * function processMessage(msg: Any) {
 *   // msg can be either MessageA or MessageB
 * }
 * ```
 */
export type AnyDto<Schemas, Field extends string> = ValueOf<
	DiscriminatorMap<Schemas, Field>
>;

// ============================================
// Factory Interface
// ============================================

/**
 * Interface for a type-safe DTO factory.
 *
 * Provides methods to parse unknown data into typed DTOs, check discriminator values,
 * and narrow types using type guards.
 *
 * @typeParam Schemas - The schemas object type (e.g., `components['schemas']` from openapi-typescript)
 * @typeParam Field - The discriminator field name (e.g., `'id'`, `'type'`, `'kind'`)
 *
 * @example
 * ```typescript
 * import type { components } from './api-types';
 *
 * const factory: DtoFactory<components['schemas'], 'id'> =
 *   createDtoFactory<components['schemas']>()('id');
 *
 * const dto = factory.parse(unknownData);
 * if (dto && factory.is(dto, 'my_message')) {
 *   // dto is narrowed to the specific type
 * }
 * ```
 */
export interface DtoFactory<Schemas, Field extends string> {
	/**
	 * The discriminator field name used by this factory.
	 *
	 * This is the property name that contains the literal string value
	 * used to discriminate between different DTO types.
	 *
	 * @readonly
	 *
	 * @example
	 * ```typescript
	 * const factory = createDtoFactory<Schemas>()('id');
	 * console.log(factory.field); // "id"
	 * ```
	 */
	readonly field: Field;

	/**
	 * Parse raw data into a typed DTO.
	 *
	 * Performs minimal validation to check that the discriminator field exists
	 * and contains a non-empty string. Does NOT validate the full structure
	 * of the data - this is intentional for performance and trust of upstream data.
	 *
	 * @param raw - Unknown data from any source (WebSocket, postMessage, API response, etc.)
	 * @returns The data cast to the DTO union type, or `null` if validation fails
	 *
	 * @example
	 * ```typescript
	 * const factory = createDtoFactory<Schemas>()('id');
	 *
	 * // Valid input
	 * const dto = factory.parse({ id: "my_message", data: "hello" });
	 * // dto: AnyDto<Schemas, "id"> | null
	 *
	 * // Invalid inputs return null
	 * factory.parse(null);           // null
	 * factory.parse({});             // null (no id field)
	 * factory.parse({ id: "" });     // null (empty string)
	 * factory.parse({ id: 123 });    // null (not a string)
	 * ```
	 */
	parse(raw: unknown): AnyDto<Schemas, Field> | null;

	/**
	 * Type guard to narrow a DTO to a specific type.
	 *
	 * Checks if the DTO's discriminator field matches the given value and
	 * narrows the TypeScript type accordingly. The `id` parameter provides
	 * autocomplete for all valid discriminator values.
	 *
	 * @typeParam K - The discriminator value to check (inferred from `id` parameter)
	 * @param dto - Any valid DTO from this factory
	 * @param id - The discriminator value to check (autocompletes!)
	 * @returns Type predicate that narrows `dto` to the specific type
	 *
	 * @example
	 * ```typescript
	 * const factory = createDtoFactory<Schemas>()('id');
	 * const dto = factory.parse(data);
	 *
	 * if (dto && factory.is(dto, 'bar')) {
	 *   // TypeScript knows dto is BarMessage here
	 *   console.log(dto.text); // fully typed access
	 * }
	 * ```
	 */
	is<K extends DiscriminatorId<Schemas, Field>>(
		dto: AnyDto<Schemas, Field>,
		id: K
	): dto is SafeIndex<DiscriminatorMap<Schemas, Field>, K>;

	/**
	 * Get the discriminator value from a DTO.
	 *
	 * Extracts the discriminator field value with proper typing as a union
	 * of all possible discriminator values.
	 *
	 * @param dto - Any valid DTO from this factory
	 * @returns The discriminator value with proper literal union typing
	 *
	 * @example
	 * ```typescript
	 * const factory = createDtoFactory<Schemas>()('id');
	 * const dto = factory.parse(data);
	 *
	 * if (dto) {
	 *   const id = factory.getId(dto);
	 *   // id: "message_a" | "message_b" | "message_c" | ...
	 *
	 *   switch (id) {
	 *     case 'message_a':
	 *       // Handle message_a
	 *       break;
	 *     // TypeScript knows all possible cases
	 *   }
	 * }
	 * ```
	 */
	getId(dto: AnyDto<Schemas, Field>): DiscriminatorId<Schemas, Field>;

	/**
	 * Check if raw data has a valid discriminator field.
	 *
	 * Performs the same validation as `parse()` but returns a boolean instead
	 * of the parsed value. Useful for pre-validation or filtering.
	 *
	 * Validation rules:
	 * - Must be a non-null object
	 * - Must have the discriminator field
	 * - Discriminator value must be a non-empty string
	 *
	 * @param raw - Unknown data to validate
	 * @returns `true` if the data has a valid string discriminator field
	 *
	 * @example
	 * ```typescript
	 * const factory = createDtoFactory<Schemas>()('id');
	 *
	 * const messages = rawMessages.filter(msg => factory.isValid(msg));
	 * // messages now contains only valid DTOs
	 * ```
	 */
	isValid(raw: unknown): boolean;
}

// ============================================
// Factory Implementation
// ============================================

/**
 * Creates a DTO factory for a specific schema set and discriminator field.
 *
 * This is the main entry point for using DTOKit. The function uses a curried pattern
 * to allow specifying the Schemas type parameter while letting TypeScript infer
 * the Field type from the string argument.
 *
 * @typeParam Schemas - The schemas object type containing all your DTO definitions.
 *   Typically `components['schemas']` from openapi-typescript generated types.
 *
 * @returns A function that takes a discriminator field name and returns a {@link DtoFactory}
 *
 * @example Basic Usage
 * ```typescript
 * import type { components } from './api-types';
 *
 * // Create factory with 'id' as the discriminator field
 * const messages = createDtoFactory<components['schemas']>()('id');
 *
 * // Parse incoming WebSocket message
 * websocket.onmessage = (event) => {
 *   const dto = messages.parse(JSON.parse(event.data));
 *
 *   if (dto && messages.is(dto, 'bar')) {
 *     handleBar(dto.text);
 *   }
 * };
 * ```
 *
 * @example Multiple Discriminator Fields
 * ```typescript
 * // Different APIs might use different discriminator fields
 * const wsMessages = createDtoFactory<components['schemas']>()('id');
 * const apiResponses = createDtoFactory<components['schemas']>()('type');
 * ```
 *
 * @example Exporting Derived Types
 * ```typescript
 * import { createDtoFactory, DiscriminatorMap, AnyDto } from '@marianmeres/dtokit';
 *
 * export const messages = createDtoFactory<components['schemas']>()('id');
 *
 * // Export useful type aliases
 * export type MessageMap = DiscriminatorMap<components['schemas'], 'id'>;
 * export type MessageId = DiscriminatorId<components['schemas'], 'id'>;
 * export type AnyMessage = AnyDto<components['schemas'], 'id'>;
 * ```
 */
export function createDtoFactory<Schemas>() {
	/**
	 * @param discriminatorField - The name of the field used as the discriminator
	 *   (e.g., 'id', 'type', 'kind'). This field must exist on schemas and have
	 *   a literal string type for those schemas to be included in the factory.
	 * @returns A configured {@link DtoFactory} instance
	 */
	return function <Field extends string>(
		discriminatorField: Field
	): DtoFactory<Schemas, Field> {
		type Map = DiscriminatorMap<Schemas, Field>;
		type Id = DiscriminatorId<Schemas, Field>;
		type Dto = AnyDto<Schemas, Field>;

		return {
			field: discriminatorField,

			parse(raw: unknown): Dto | null {
				if (!this.isValid(raw)) {
					return null;
				}
				return raw as Dto;
			},

			is<K extends Id>(dto: Dto, id: K): dto is SafeIndex<Map, K> {
				return (
					(dto as Record<string, unknown>)[discriminatorField] === id
				);
			},

			getId(dto: Dto): Id {
				return (dto as Record<string, unknown>)[
					discriminatorField
				] as Id;
			},

			isValid(raw: unknown): boolean {
				if (raw === null || raw === undefined) {
					return false;
				}
				if (typeof raw !== "object") {
					return false;
				}
				const value = (raw as Record<string, unknown>)[
					discriminatorField
				];
				return typeof value === "string" && value.length > 0;
			},
		};
	};
}

// ============================================
// Utility: Switch Handler
// ============================================

/**
 * Type definition for exhaustive switch-style handlers.
 *
 * Maps each discriminator value to a handler function that receives
 * the correctly-typed DTO for that value. TypeScript will error if
 * any discriminator value is not handled.
 *
 * @typeParam Schemas - The schemas object type
 * @typeParam Field - The discriminator field name
 * @typeParam R - The return type of all handler functions (must be the same)
 *
 * @example
 * ```typescript
 * type Handlers = DtoHandlers<components['schemas'], 'id', void>;
 * // Results in: {
 * //   message_a: (dto: MessageA) => void;
 * //   message_b: (dto: MessageB) => void;
 * //   // ... one handler for each discriminator value
 * // }
 * ```
 */
export type DtoHandlers<Schemas, Field extends string, R> = {
	[K in DiscriminatorId<Schemas, Field>]: (
		dto: SafeIndex<DiscriminatorMap<Schemas, Field>, K>
	) => R;
};

/**
 * Creates a switch-style handler that exhaustively handles all DTO types.
 *
 * This utility provides compile-time guarantees that all discriminator values
 * are handled. If a new message type is added to the schema, TypeScript will
 * error until a handler is added.
 *
 * Uses a curried pattern similar to {@link createDtoFactory} to allow
 * specifying the Schemas type while inferring Field and R types.
 *
 * @typeParam Schemas - The schemas object type
 *
 * @returns A curried function that takes the discriminator field and handlers object
 *
 * @example Basic Usage
 * ```typescript
 * const handleMessage = createDtoHandler<components['schemas']>()('id', {
 *   start: (dto) => console.log('Started'),
 *   stop: (dto) => console.log('Stopped'),
 *   data: (dto) => processData(dto.payload),
 *   // TypeScript ERROR if any message type is missing!
 * });
 *
 * // Use with parsed DTOs
 * const dto = factory.parse(data);
 * if (dto) {
 *   handleMessage(dto);
 * }
 * ```
 *
 * @example With Return Values
 * ```typescript
 * const getMessage = createDtoHandler<components['schemas']>()('id', {
 *   start: (dto) => `Started at ${dto.timestamp}`,
 *   stop: (dto) => `Stopped: ${dto.reason}`,
 *   data: (dto) => `Data: ${dto.payload}`,
 * });
 *
 * const message: string = getMessage(dto);
 * ```
 *
 * @example Logging All Message Types
 * ```typescript
 * const logMessage = createDtoHandler<components['schemas']>()('id', {
 *   foo: () => console.log('[WS] Foo received'),
 *   bar: (dto) => console.log('[WS] Bar:', dto.text),
 *   baz: (dto) => console.log('[WS] Baz:', dto.value),
 *   error: (dto) => console.error('[WS] Error:', dto.message),
 * });
 *
 * websocket.onmessage = (event) => {
 *   const dto = messages.parse(JSON.parse(event.data));
 *   if (dto) logMessage(dto);
 * };
 * ```
 */
export function createDtoHandler<Schemas>() {
	/**
	 * @typeParam Field - The discriminator field name (inferred from argument)
	 * @typeParam R - The return type of handlers (inferred from handlers object)
	 *
	 * @param discriminatorField - The name of the discriminator field
	 * @param handlers - Object mapping each discriminator value to its handler function.
	 *   All discriminator values must be present - TypeScript will error on missing handlers.
	 *
	 * @returns A function that takes a DTO and calls the appropriate handler
	 */
	return function <Field extends string, R>(
		discriminatorField: Field,
		handlers: DtoHandlers<Schemas, Field, R>
	) {
		/**
		 * Handles a DTO by calling the appropriate handler based on its discriminator value.
		 *
		 * @param dto - A valid DTO matching the Schemas and Field parameters
		 * @returns The return value from the matched handler
		 */
		return function (dto: AnyDto<Schemas, Field>): R {
			const id = (dto as Record<string, unknown>)[
				discriminatorField
			] as DiscriminatorId<Schemas, Field>;
			const handler = handlers[id];
			return handler(dto as never);
		};
	};
}
