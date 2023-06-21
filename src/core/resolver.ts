import isEmpty from 'lodash/isEmpty';
import get from 'lodash/get';
import { JSONSchema4, JSONSchema7 } from 'json-schema';

export type JsonSchema = JSONSchema4 | JSONSchema7;
/**
 * Decodes a given JSON Pointer segment to its "normal" representation
 */
export const decode = (pointerSegment: string) =>
  pointerSegment?.replace(/~1/g, '/').replace(/~0/, '~');
/**
 * Map for storing refs and the respective schemas they are pointing to.
 */
export interface ReferenceSchemaMap {
  [ref: string]: JsonSchema;
}

const isObjectSchema = (schema: JsonSchema): boolean => {
  return schema.properties !== undefined;
};
const isArraySchema = (schema: JsonSchema): boolean => {
  return schema.type === 'array' && schema.items !== undefined;
};

/**
 * Finds all references inside the given schema.
 *
 * @param schema The {@link JsonSchema} to find the references in
 * @param result The initial result map, default: empty map (this parameter is used for recursion
 *               inside the function)
 * @param resolveTuples Whether arrays of tuples should be considered; default: false
 */
export const findAllRefs = (
  schema: JsonSchema,
  result: ReferenceSchemaMap = {},
  resolveTuples = false
): ReferenceSchemaMap => {
  if (isObjectSchema(schema)) {
    // @ts-ignore
    Object.values(schema.properties).forEach(propSchema =>
        // @ts-ignore
      findAllRefs(propSchema, result)
    );
  }
  if (isArraySchema(schema)) {
    if (Array.isArray(schema.items)) {
      if (resolveTuples) {
        // @ts-ignore
        const items: JsonSchema[] = schema.items;
        items.forEach(child => findAllRefs(child, result));
      }
    } else {
      findAllRefs(schema.items as JsonSchema, result);
    }
  }
  if (Array.isArray(schema.anyOf)) {
    // @ts-ignore
    const anyOf: JsonSchema[] = schema.anyOf;
    anyOf.forEach(child => findAllRefs(child, result));
  }
  if (schema.$ref !== undefined) {
    result[schema.$ref] = schema;
  }

  return result;
};

const invalidSegment = (pathSegment: string) =>
  pathSegment === '#' || pathSegment === undefined || pathSegment === '';

/**
 * Resolve the given schema path in order to obtain a subschema.
 * @param {JsonSchema} schema the root schema from which to start
 * @param {string} schemaPath the schema path to be resolved
 * @param {JsonSchema} rootSchema the actual root schema
 * @returns {JsonSchema} the resolved sub-schema
 */
export const resolveSchema = (
  schema: JsonSchema,
  schemaPath: string,
  rootSchema: JsonSchema
): JsonSchema => {
  const segments = schemaPath?.split('/').map(decode);
  const resolvedSchema = resolveSchemaWithSegments(
    schema,
    segments,
    rootSchema
  );
  if (!resolvedSchema) {
    throw new Error(`Could not resolve schema ${schemaPath}`);
  }
  return resolvedSchema;
};

const resolveSchemaWithSegments = (
  schema: JsonSchema,
  pathSegments: string[],
  rootSchema: JsonSchema
): JsonSchema | undefined => {
  if (isEmpty(schema)) {
    return undefined;
  }

  if (schema.$ref) {
    schema = resolveSchema(rootSchema, schema.$ref, rootSchema);
  }

  if (!pathSegments || pathSegments.length === 0) {
    return schema;
  }

  const [segment, ...remainingSegments] = pathSegments;

  if (invalidSegment(segment)) {
    return resolveSchemaWithSegments(schema, remainingSegments, rootSchema);
  }

  const singleSegmentResolveSchema = get(schema, segment);

  const resolvedSchema = resolveSchemaWithSegments(
    singleSegmentResolveSchema,
    remainingSegments,
    rootSchema
  );
  if (resolvedSchema) {
    return resolvedSchema;
  }

  if (segment === 'properties' || segment === 'items') {
    // Let's try to resolve the path, assuming oneOf/allOf/anyOf/then/else was omitted.
    // We only do this when traversing an object or array as we want to avoid
    // following a property which is named oneOf, allOf, anyOf, then or else.
    let alternativeResolveResult = undefined;

    const subSchemas = [].concat(
      // @ts-ignore
      schema.oneOf ?? [],
      schema.allOf ?? [],
      schema.anyOf ?? [],
      ((schema as JSONSchema7).then as any[]) ?? [],
      ((schema as JSONSchema7).else as any[]) ?? []
    );

    for (const subSchema of subSchemas) {
      alternativeResolveResult = resolveSchemaWithSegments(
        subSchema,
        [segment, ...remainingSegments],
        rootSchema
      );
      if (alternativeResolveResult) {
        break;
      }
    }
    return alternativeResolveResult;
  }

  return undefined;
};
