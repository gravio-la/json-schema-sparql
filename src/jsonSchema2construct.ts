import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

import {
  isJSONSchema,
  isJSONSchemaDefinition,
  JsonSchema,
  resolveSchema,
} from './core';

const propertiesContainStopSymbol = (
  properties: object,
  stopSymbols: string[]
) => {
  const propKeys = Object.keys(properties);
  for (const stopSymbol of stopSymbols) {
    if (propKeys.includes(stopSymbol)) return true;
  }
  return false;
};

const MAX_RECURSION = 42;
const makePrefixed = (key: string) => (key.includes(':') ? key : `:${key}`);

/**
 *  options for jsonSchema2construct
 */
export type JsonSchema2ConstructOptions = {
  stopSymbols?: string[];
  excludedProperties?: string[];
  /**
   * default is 42
   * because of the recursive nature of the algorithm, it is possible to have an infinite loop
   * this option allows to stop the algorithm after a certain number of recursions
   * @see MAX_RECURSION
   */
  maxRecursion?: number;
  doNotFollowItemsRefs?: boolean;
};

/**
 * create a SPARQL construct query from a JSON Schema
 *
 * @param subjectURI
 * @param rootSchema
 * @param options
 */
export const jsonSchema2construct: (
  subjectURI: string,
  rootSchema: JSONSchema7,
  options?: JsonSchema2ConstructOptions
) => { whereRequired: string; whereOptionals: string; construct: string } = (
  subjectURI,
  rootSchema,
  options = {}
) => {
  const {
    stopSymbols = [],
    excludedProperties = [],
    maxRecursion = MAX_RECURSION,
    doNotFollowItemsRefs = false,
  } = options;
  let construct = '',
    whereOptionals = '',
    varIndex = 0;
  const whereRequired = '';
  const s = `<${subjectURI}>`;
  const propertiesToSPARQLPatterns = (
    sP: string,
    subSchema: JSONSchema7,
    level: number
  ) => {
    if (level > maxRecursion) {
      console.warn(
        `will stop at level ${level} to prevent infinite loop because maximum recursion is set to ${maxRecursion}`
      );
      return;
    }
    if (
      level > 0 &&
      propertiesContainStopSymbol(subSchema.properties || {}, stopSymbols)
    ) {
      return;
    }
    const __type = `?__type_${varIndex++}`;
    whereOptionals += `OPTIONAL { ${sP} a ${__type} . }\n`;
    construct += `${sP} a ${__type} .\n`;
    Object.entries(subSchema.properties || {}).forEach(([property, schema]) => {
      if (isJSONSchema(schema) && !excludedProperties.includes(property)) {
        const required = subSchema.required?.includes(property),
          p = makePrefixed(property),
          o = `?${property}_${varIndex++}`;
        if (!required) {
          whereOptionals += `OPTIONAL {\n${sP} ${p} ${o} .\n`;
        } else {
          whereOptionals += `${sP} ${p} ${o} .\n`;
        }
        construct += `${sP} ${p} ${o} .\n`;
        if (schema.$ref) {
          const subSchema = resolveSchema(
            schema as JsonSchema,
            '',
            rootSchema as JsonSchema
          );
          if (
            subSchema &&
            subSchema.properties &&
            !propertiesContainStopSymbol(subSchema.properties, stopSymbols)
          ) {
            propertiesToSPARQLPatterns(o, subSchema as JSONSchema7, level + 1);
          }
        } else if (
          schema.properties &&
          !propertiesContainStopSymbol(schema.properties, stopSymbols)
        ) {
          propertiesToSPARQLPatterns(o, schema, level + 1);
        } else if (schema.items) {
          if (
            isJSONSchemaDefinition(schema.items) &&
            isJSONSchema(schema.items) &&
            schema.items.properties &&
            !propertiesContainStopSymbol(schema.items.properties, stopSymbols)
          ) {
            propertiesToSPARQLPatterns(o, schema.items, level + 1);
          }
          if (
            !doNotFollowItemsRefs &&
            isJSONSchemaDefinition(schema.items) &&
            isJSONSchema(schema.items) &&
            schema.items.$ref
          ) {
            //const ref = schema.items.$ref
            const subSchema = resolveSchema(
              schema.items as JsonSchema,
              '',
              rootSchema as JsonSchema
            );
            if (
              subSchema &&
              isJSONSchemaDefinition(subSchema as JSONSchema7Definition) &&
              isJSONSchema(subSchema as JSONSchema7)
            ) {
              propertiesToSPARQLPatterns(
                o,
                subSchema as JSONSchema7,
                level + 1
              );
            }
          }
        }
        if (!required) {
          whereOptionals += '}\n';
        }
      }
    });
  };
  propertiesToSPARQLPatterns(s, rootSchema, 0);
  if (
    isJSONSchemaDefinition(rootSchema.items) &&
    isJSONSchema(rootSchema.items) &&
    rootSchema.items.properties
  ) {
    propertiesToSPARQLPatterns(s, rootSchema.items, 0);
  }
  return { construct, whereRequired, whereOptionals };
};
