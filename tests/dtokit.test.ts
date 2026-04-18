import {
	assertEquals,
	assertExists,
	assertStrictEquals,
	assertThrows,
} from "@std/assert";
import {
	createDtoFactory,
	createDtoHandler,
	type AnyDto,
	type DiscriminatorId,
	type DiscriminatorMap,
	type DtoFactory,
} from "../src/mod.ts";

// ============================================
// Test Schema Definitions
// ============================================

/**
 * Mock schemas simulating OpenAPI-generated types with discriminated unions.
 * These represent typical message types you'd receive from a WebSocket or API.
 */
interface TestSchemas {
	MessageA: {
		id: "message_a";
		payload: string;
	};
	MessageB: {
		id: "message_b";
		data: {
			value: number;
			nested: boolean;
		};
	};
	MessageC: {
		id: "message_c";
		items: string[];
	};
	// Schema without the discriminator field - should be excluded
	NoDiscriminator: {
		name: string;
		value: number;
	};
	// Schema with generic string type - should be excluded
	GenericString: {
		id: string;
		content: string;
	};
	// Schema with different discriminator field
	TypedMessage: {
		type: "typed_msg";
		body: string;
	};
	// Schema with both id and type
	DualDiscriminator: {
		id: "dual";
		type: "also_typed";
		mixed: boolean;
	};
}

// Type alias for convenience
type Schemas = TestSchemas;

// ============================================
// createDtoFactory Tests
// ============================================

Deno.test("createDtoFactory - creates factory with correct field property", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(factory.field, "id");
});

Deno.test("createDtoFactory - creates factory with different discriminator fields", () => {
	const idFactory = createDtoFactory<Schemas>()("id");
	const typeFactory = createDtoFactory<Schemas>()("type");

	assertEquals(idFactory.field, "id");
	assertEquals(typeFactory.field, "type");
});

// ============================================
// isValid Tests
// ============================================

Deno.test("isValid - returns true for valid objects with string discriminator", () => {
	const factory = createDtoFactory<Schemas>()("id");

	assertEquals(factory.isValid({ id: "message_a", payload: "test" }), true);
	assertEquals(factory.isValid({ id: "message_b", data: { value: 1, nested: true } }), true);
	assertEquals(factory.isValid({ id: "unknown_type" }), true); // any non-empty string is valid
});

Deno.test("isValid - returns false for null", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(factory.isValid(null), false);
});

Deno.test("isValid - returns false for undefined", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(factory.isValid(undefined), false);
});

Deno.test("isValid - returns false for non-objects", () => {
	const factory = createDtoFactory<Schemas>()("id");

	assertEquals(factory.isValid("string"), false);
	assertEquals(factory.isValid(123), false);
	assertEquals(factory.isValid(true), false);
	assertEquals(factory.isValid(Symbol("test")), false);
	assertEquals(factory.isValid(() => {}), false);
});

Deno.test("isValid - returns false for objects without discriminator field", () => {
	const factory = createDtoFactory<Schemas>()("id");

	assertEquals(factory.isValid({}), false);
	assertEquals(factory.isValid({ name: "test" }), false);
	assertEquals(factory.isValid({ type: "wrong_field" }), false);
});

Deno.test("isValid - returns false for non-string discriminator values", () => {
	const factory = createDtoFactory<Schemas>()("id");

	assertEquals(factory.isValid({ id: 123 }), false);
	assertEquals(factory.isValid({ id: null }), false);
	assertEquals(factory.isValid({ id: undefined }), false);
	assertEquals(factory.isValid({ id: {} }), false);
	assertEquals(factory.isValid({ id: [] }), false);
	assertEquals(factory.isValid({ id: true }), false);
});

Deno.test("isValid - returns false for empty string discriminator", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(factory.isValid({ id: "" }), false);
});

Deno.test("isValid - works with arrays (valid objects)", () => {
	const factory = createDtoFactory<Schemas>()("id");
	// Arrays are objects but don't have string 'id' field
	assertEquals(factory.isValid([]), false);
	assertEquals(factory.isValid(["a", "b"]), false);
});

// ============================================
// parse Tests
// ============================================

Deno.test("parse - returns typed DTO for valid input", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const messageA = factory.parse({ id: "message_a", payload: "test" });
	assertExists(messageA);

	const messageB = factory.parse({ id: "message_b", data: { value: 42, nested: true } });
	assertExists(messageB);
});

Deno.test("parse - returns null for invalid input", () => {
	const factory = createDtoFactory<Schemas>()("id");

	assertEquals(factory.parse(null), null);
	assertEquals(factory.parse(undefined), null);
	assertEquals(factory.parse({}), null);
	assertEquals(factory.parse({ id: "" }), null);
	assertEquals(factory.parse({ id: 123 }), null);
	assertEquals(factory.parse("string"), null);
});

Deno.test("parse - preserves all properties of the original object", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const original = {
		id: "message_a",
		payload: "test",
		extra: "preserved",
	};

	const parsed = factory.parse(original);
	assertExists(parsed);

	// The parsed object should be the same reference
	assertStrictEquals(parsed, original);
});

// ============================================
// is (type guard) Tests
// ============================================

Deno.test("is - returns true for matching discriminator", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dto = factory.parse({ id: "message_a", payload: "test" });
	assertExists(dto);

	assertEquals(factory.is(dto, "message_a"), true);
	assertEquals(factory.is(dto, "message_b"), false);
	assertEquals(factory.is(dto, "message_c"), false);
});

Deno.test("is - correctly narrows type (compile-time check)", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dto = factory.parse({ id: "message_b", data: { value: 42, nested: true } });
	assertExists(dto);

	if (factory.is(dto, "message_b")) {
		// TypeScript should narrow dto to MessageB type here
		// This is a compile-time check - if it compiles, the narrowing works
		const _value: number = dto.data.value;
		const _nested: boolean = dto.data.nested;
		assertEquals(_value, 42);
		assertEquals(_nested, true);
	}
});

Deno.test("is - works with multiple discriminator checks", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const messages = [
		{ id: "message_a", payload: "test" },
		{ id: "message_b", data: { value: 1, nested: false } },
		{ id: "message_c", items: ["a", "b"] },
	];

	for (const raw of messages) {
		const dto = factory.parse(raw);
		assertExists(dto);

		if (factory.is(dto, "message_a")) {
			assertEquals(dto.payload, "test");
		} else if (factory.is(dto, "message_b")) {
			assertEquals(dto.data.value, 1);
		} else if (factory.is(dto, "message_c")) {
			assertEquals(dto.items.length, 2);
		}
	}
});

// ============================================
// getId Tests
// ============================================

Deno.test("getId - returns correct discriminator value", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dtoA = factory.parse({ id: "message_a", payload: "test" });
	assertExists(dtoA);
	assertEquals(factory.getId(dtoA), "message_a");

	const dtoB = factory.parse({ id: "message_b", data: { value: 1, nested: true } });
	assertExists(dtoB);
	assertEquals(factory.getId(dtoB), "message_b");
});

Deno.test("getId - works in switch statements", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dto = factory.parse({ id: "message_c", items: ["x", "y"] });
	assertExists(dto);

	let result = "";
	switch (factory.getId(dto)) {
		case "message_a":
			result = "a";
			break;
		case "message_b":
			result = "b";
			break;
		case "message_c":
			result = "c";
			break;
		case "dual":
			result = "dual";
			break;
	}

	assertEquals(result, "c");
});

// ============================================
// Different Discriminator Field Tests
// ============================================

Deno.test("factory works with 'type' discriminator field", () => {
	const factory = createDtoFactory<Schemas>()("type");

	const dto = factory.parse({ type: "typed_msg", body: "hello" });
	assertExists(dto);

	assertEquals(factory.field, "type");
	assertEquals(factory.getId(dto), "typed_msg");
	assertEquals(factory.is(dto, "typed_msg"), true);
});

Deno.test("factory with 'type' field ignores schemas without 'type' field", () => {
	const factory = createDtoFactory<Schemas>()("type");

	// This should still parse (minimal validation)
	const dto = factory.parse({ type: "typed_msg", body: "test" });
	assertExists(dto);

	// But MessageA with 'id' discriminator won't match 'type' checks
	const wrongDto = factory.parse({ id: "message_a", payload: "test" });
	assertEquals(wrongDto, null); // no 'type' field
});

// ============================================
// createDtoHandler Tests
// ============================================

Deno.test("createDtoHandler - calls correct handler based on discriminator", () => {
	const results: string[] = [];

	const handle = createDtoHandler<Schemas>()("id", {
		message_a: (dto) => {
			results.push(`a:${dto.payload}`);
		},
		message_b: (dto) => {
			results.push(`b:${dto.data.value}`);
		},
		message_c: (dto) => {
			results.push(`c:${dto.items.length}`);
		},
		dual: (dto) => {
			results.push(`dual:${dto.mixed}`);
		},
	});

	const factory = createDtoFactory<Schemas>()("id");

	const dtoA = factory.parse({ id: "message_a", payload: "test" });
	assertExists(dtoA);
	handle(dtoA);

	const dtoB = factory.parse({ id: "message_b", data: { value: 99, nested: false } });
	assertExists(dtoB);
	handle(dtoB);

	const dtoC = factory.parse({ id: "message_c", items: ["x", "y", "z"] });
	assertExists(dtoC);
	handle(dtoC);

	assertEquals(results, ["a:test", "b:99", "c:3"]);
});

Deno.test("createDtoHandler - returns handler result", () => {
	const handle = createDtoHandler<Schemas>()("id", {
		message_a: (dto) => `A: ${dto.payload}`,
		message_b: (dto) => `B: ${dto.data.value}`,
		message_c: (dto) => `C: ${dto.items.join(",")}`,
		dual: (dto) => `D: ${dto.mixed}`,
	});

	const factory = createDtoFactory<Schemas>()("id");

	const dtoA = factory.parse({ id: "message_a", payload: "hello" });
	assertExists(dtoA);
	assertEquals(handle(dtoA), "A: hello");

	const dtoB = factory.parse({ id: "message_b", data: { value: 42, nested: true } });
	assertExists(dtoB);
	assertEquals(handle(dtoB), "B: 42");
});

Deno.test("createDtoHandler - works with 'type' discriminator", () => {
	const handle = createDtoHandler<Schemas>()("type", {
		typed_msg: (dto) => dto.body.toUpperCase(),
		also_typed: (dto) => String(dto.mixed),
	});

	const factory = createDtoFactory<Schemas>()("type");

	const dto = factory.parse({ type: "typed_msg", body: "hello" });
	assertExists(dto);
	assertEquals(handle(dto), "HELLO");
});

// ============================================
// Type Utility Tests (compile-time checks)
// ============================================

Deno.test("DiscriminatorMap type correctly maps discriminator values to types", () => {
	// This test verifies compile-time behavior
	type IdMap = DiscriminatorMap<Schemas, "id">;

	// These type assertions will fail at compile time if incorrect
	const _checkA: IdMap["message_a"] = { id: "message_a", payload: "test" };
	const _checkB: IdMap["message_b"] = {
		id: "message_b",
		data: { value: 1, nested: true },
	};
	const _checkC: IdMap["message_c"] = { id: "message_c", items: [] };
	const _checkDual: IdMap["dual"] = { id: "dual", type: "also_typed", mixed: true };

	// If we get here, types are correct
	assertEquals(true, true);
});

Deno.test("DiscriminatorId type is union of literal discriminator values", () => {
	type IdType = DiscriminatorId<Schemas, "id">;

	// These should compile - they are valid discriminator IDs
	const _validIds: IdType[] = ["message_a", "message_b", "message_c", "dual"];

	assertEquals(_validIds.length, 4);
});

Deno.test("AnyDto type is union of all DTO types", () => {
	type AnyMessage = AnyDto<Schemas, "id">;

	// All of these should be assignable to AnyMessage
	const _a: AnyMessage = { id: "message_a", payload: "test" };
	const _b: AnyMessage = { id: "message_b", data: { value: 1, nested: true } };
	const _c: AnyMessage = { id: "message_c", items: [] };

	assertEquals(true, true);
});

// ============================================
// Edge Case Tests
// ============================================

Deno.test("factory handles object with extra properties", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dto = factory.parse({
		id: "message_a",
		payload: "test",
		extraProp: "should be preserved",
		another: 123,
	});

	assertExists(dto);
	assertEquals(factory.getId(dto), "message_a");
});

Deno.test("factory handles deeply nested objects", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const dto = factory.parse({
		id: "message_b",
		data: {
			value: 100,
			nested: true,
		},
	});

	assertExists(dto);
	if (factory.is(dto, "message_b")) {
		assertEquals(dto.data.value, 100);
		assertEquals(dto.data.nested, true);
	}
});

Deno.test("factory handles whitespace-only discriminator as valid", () => {
	const factory = createDtoFactory<Schemas>()("id");

	// Whitespace is technically a non-empty string
	const dto = factory.parse({ id: "   " });
	assertExists(dto);
});

Deno.test("multiple factories can coexist independently", () => {
	const idFactory = createDtoFactory<Schemas>()("id");
	const typeFactory = createDtoFactory<Schemas>()("type");

	const idDto = idFactory.parse({ id: "message_a", payload: "test" });
	const typeDto = typeFactory.parse({ type: "typed_msg", body: "hello" });

	assertExists(idDto);
	assertExists(typeDto);

	assertEquals(idFactory.getId(idDto), "message_a");
	assertEquals(typeFactory.getId(typeDto), "typed_msg");

	// Cross-factory should fail (no type field in first, no id in second)
	assertEquals(typeFactory.parse({ id: "message_a", payload: "test" }), null);
});

// ============================================
// DtoFactory Interface Tests
// ============================================

Deno.test("DtoFactory interface is properly implemented", () => {
	const factory: DtoFactory<Schemas, "id"> = createDtoFactory<Schemas>()("id");

	// Verify all interface members exist
	assertEquals(typeof factory.field, "string");
	assertEquals(typeof factory.parse, "function");
	assertEquals(typeof factory.is, "function");
	assertEquals(typeof factory.getId, "function");
	assertEquals(typeof factory.isValid, "function");
});

// ============================================
// Real-world Usage Simulation Tests
// ============================================

Deno.test("simulates WebSocket message handling", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const processedMessages: string[] = [];

	// Simulate receiving WebSocket messages
	const rawMessages = [
		JSON.stringify({ id: "message_a", payload: "first" }),
		JSON.stringify({ id: "message_b", data: { value: 10, nested: false } }),
		JSON.stringify({ id: "message_c", items: ["item1", "item2"] }),
		JSON.stringify({ invalid: "no discriminator" }),
		"not json",
	];

	for (const raw of rawMessages) {
		try {
			const parsed = JSON.parse(raw);
			const dto = factory.parse(parsed);

			if (dto) {
				if (factory.is(dto, "message_a")) {
					processedMessages.push(`Received A: ${dto.payload}`);
				} else if (factory.is(dto, "message_b")) {
					processedMessages.push(`Received B: ${dto.data.value}`);
				} else if (factory.is(dto, "message_c")) {
					processedMessages.push(`Received C: ${dto.items.length} items`);
				}
			} else {
				processedMessages.push("Invalid message format");
			}
		} catch {
			processedMessages.push("Parse error");
		}
	}

	assertEquals(processedMessages, [
		"Received A: first",
		"Received B: 10",
		"Received C: 2 items",
		"Invalid message format",
		"Parse error",
	]);
});

// ============================================
// B1: Destructured / detached method usage
// ============================================

Deno.test("parse works when destructured (no `this` dependency)", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const { parse, isValid, getId, is } = factory;

	const dto = parse({ id: "message_a", payload: "hi" });
	assertExists(dto);
	assertEquals(isValid({ id: "message_a" }), true);
	assertEquals(getId(dto), "message_a");
	assertEquals(is(dto, "message_a"), true);
});

Deno.test("methods work as Array callbacks", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const raw: unknown[] = [
		{ id: "message_a", payload: "x" },
		null,
		{ id: "" },
		{ id: "message_b", data: { value: 1, nested: false } },
	];

	const parsed = raw.map(factory.parse).filter((x) => x !== null);
	assertEquals(parsed.length, 2);
});

// ============================================
// B2: Handler unknown-id + default
// ============================================

Deno.test("createDtoHandler throws descriptive error for unknown discriminator", () => {
	const handle = createDtoHandler<Schemas>()("id", {
		message_a: () => "a",
		message_b: () => "b",
		message_c: () => "c",
		dual: () => "d",
	});

	// Bypass type-checking to simulate unexpected runtime data
	const bad = { id: "unknown_id" } as unknown as AnyDto<Schemas, "id">;

	assertThrows(() => handle(bad), Error, 'dtokit: no handler for id="unknown_id"');
});

Deno.test("createDtoHandler calls default handler when provided", () => {
	const seen: string[] = [];
	const handle = createDtoHandler<Schemas>()(
		"id",
		{
			message_a: () => "a",
			message_b: () => "b",
			message_c: () => "c",
			dual: () => "d",
		},
		{
			default: (dto) => {
				seen.push((dto as { id: string }).id);
				return "default";
			},
		}
	);

	const bad = { id: "unknown_id" } as unknown as AnyDto<Schemas, "id">;
	assertEquals(handle(bad), "default");
	assertEquals(seen, ["unknown_id"]);
});

// ============================================
// B3 + D1: Strict mode (allowedIds) + factory.ids
// ============================================

Deno.test("factory.ids is empty when allowedIds not provided", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(factory.ids, []);
});

Deno.test("factory.ids exposes configured allowed ids", () => {
	const factory = createDtoFactory<Schemas>()("id", {
		allowedIds: ["message_a", "message_b"],
	});
	assertEquals(factory.ids, ["message_a", "message_b"]);
});

Deno.test("factory.ids is frozen (not externally mutable)", () => {
	const factory = createDtoFactory<Schemas>()("id", {
		allowedIds: ["message_a"],
	});
	assertEquals(Object.isFrozen(factory.ids), true);
});

Deno.test("strict mode: parse rejects unknown discriminator values", () => {
	const factory = createDtoFactory<Schemas>()("id", {
		allowedIds: ["message_a", "message_b"],
	});

	// Allowed
	assertExists(factory.parse({ id: "message_a", payload: "x" }));
	assertExists(
		factory.parse({ id: "message_b", data: { value: 1, nested: false } })
	);

	// Not in allowedIds — even though non-empty string
	assertEquals(factory.parse({ id: "message_c", items: [] }), null);
	assertEquals(factory.parse({ id: "anything_else" }), null);
});

Deno.test("strict mode: isValid rejects unknown discriminator values", () => {
	const factory = createDtoFactory<Schemas>()("id", {
		allowedIds: ["message_a"],
	});

	assertEquals(factory.isValid({ id: "message_a" }), true);
	assertEquals(factory.isValid({ id: "message_b" }), false);
});

Deno.test("non-strict mode still accepts any non-empty string (unchanged behavior)", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertExists(factory.parse({ id: "totally_made_up" }));
});

// ============================================
// D2: factory.handle method
// ============================================

Deno.test("factory.handle dispatches like createDtoHandler", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const handle = factory.handle({
		message_a: (dto) => `a:${dto.payload}`,
		message_b: (dto) => `b:${dto.data.value}`,
		message_c: (dto) => `c:${dto.items.length}`,
		dual: (dto) => `d:${dto.mixed}`,
	});

	const dtoA = factory.parse({ id: "message_a", payload: "hi" });
	assertExists(dtoA);
	assertEquals(handle(dtoA), "a:hi");

	const dtoB = factory.parse({ id: "message_b", data: { value: 7, nested: true } });
	assertExists(dtoB);
	assertEquals(handle(dtoB), "b:7");
});

Deno.test("factory.handle supports default option", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const handle = factory.handle(
		{
			message_a: () => "a",
			message_b: () => "b",
			message_c: () => "c",
			dual: () => "d",
		},
		{ default: () => "fallback" }
	);

	const bad = { id: "surprise" } as unknown as AnyDto<Schemas, "id">;
	assertEquals(handle(bad), "fallback");
});

Deno.test("factory.handle throws on unknown without default", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const handle = factory.handle({
		message_a: () => "a",
		message_b: () => "b",
		message_c: () => "c",
		dual: () => "d",
	});

	const bad = { id: "surprise" } as unknown as AnyDto<Schemas, "id">;
	assertThrows(() => handle(bad), Error, 'dtokit: no handler for id="surprise"');
});

// ============================================
// D3: getId narrows when input is narrowed
// ============================================

Deno.test("getId return type narrows with input (compile-time check)", () => {
	const factory = createDtoFactory<Schemas>()("id");
	const dto = factory.parse({ id: "message_a", payload: "hi" });
	assertExists(dto);

	if (factory.is(dto, "message_a")) {
		// Must assign to the exact literal — widened type would not compile
		const id: "message_a" = factory.getId(dto);
		assertEquals(id, "message_a");
	}
});

// ============================================
// D5: Factory is frozen
// ============================================

Deno.test("factory is frozen (readonly at runtime)", () => {
	const factory = createDtoFactory<Schemas>()("id");
	assertEquals(Object.isFrozen(factory), true);
});

// ============================================
// Original tests continue below
// ============================================

Deno.test("simulates exhaustive handler pattern", () => {
	const factory = createDtoFactory<Schemas>()("id");

	const messageLog: string[] = [];

	const logMessage = createDtoHandler<Schemas>()("id", {
		message_a: (dto) => {
			messageLog.push(`[A] ${dto.payload}`);
			return "logged_a";
		},
		message_b: (dto) => {
			messageLog.push(`[B] value=${dto.data.value}`);
			return "logged_b";
		},
		message_c: (dto) => {
			messageLog.push(`[C] items=${dto.items.join(",")}`);
			return "logged_c";
		},
		dual: (dto) => {
			messageLog.push(`[D] mixed=${dto.mixed}`);
			return "logged_d";
		},
	});

	const messages = [
		{ id: "message_a", payload: "hello" },
		{ id: "message_b", data: { value: 42, nested: true } },
		{ id: "message_c", items: ["x", "y"] },
	];

	const results: string[] = [];
	for (const raw of messages) {
		const dto = factory.parse(raw);
		if (dto) {
			const result = logMessage(dto);
			results.push(result as string);
		}
	}

	assertEquals(messageLog, ["[A] hello", "[B] value=42", "[C] items=x,y"]);
	assertEquals(results, ["logged_a", "logged_b", "logged_c"]);
});
