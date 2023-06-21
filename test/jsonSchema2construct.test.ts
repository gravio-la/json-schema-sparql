import {describe, expect, test} from '@jest/globals'
import {JSONSchema7} from 'json-schema'
import {jsonSchema2construct} from "../src";


const schema: JSONSchema7 = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    '$id': 'https://example.com/person.schema.json',
    'title': 'Person',
    'description': 'A human being',
    'type': 'object',
    'required': ['name', 'father'],
    'properties': {
        'name': {
            'type': 'string'
        },
        'knows': {
            'type': 'array',
            'items': {
                'required': ['nick'],
                'properties': {
                    'nick': {'type': 'string'},
                }
            }
        },
        'father': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'description': {'type': 'string'}
            }
        }
    }
}

const schema2: JSONSchema7 = {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    '$id': 'https://example.com/person.schema.json',
    'title': 'Person',
    'description': 'A human being',
    'type': 'object',
    'required': ['name', 'father'],
    'properties': {
        'name': {
            'type': 'string'
        },
        'knows': {
            'type': 'array',
            'items': {
                'required': ['nick'],
                'properties': {
                    'nick': {'type': 'string'},
                }
            }
        },
        'father': {
            'type': 'object',
            'properties': {
                '@id': {'type': 'string'},
                'name': {'type': 'string'},
                'description': {'type': 'string'}
            }
        }
    }
}


const subject = 'http://www.example.com/test'
const buildConstructQuery = (subjectURI: string,schema: JSONSchema7) => {
    const {
        construct, whereRequired, whereOptionals
    } = jsonSchema2construct(subjectURI, schema)
    return `CONSTRUCT ${construct} WHERE${whereRequired}\n${whereOptionals}`
}
describe('make construct query', () => {


    test('can build construct query from simple schema', () => {
        const constructQuery = buildConstructQuery(subject, schema)
        const expected = `CONSTRUCT <http://www.example.com/test> a ?__type_0 .
<http://www.example.com/test> :name ?name_1 .
<http://www.example.com/test> :knows ?knows_2 .
?knows_2 a ?__type_3 .
?knows_2 :nick ?nick_4 .
<http://www.example.com/test> :father ?father_5 .
?father_5 a ?__type_6 .
?father_5 :name ?name_7 .
?father_5 :description ?description_8 .
 WHERE
OPTIONAL { <http://www.example.com/test> a ?__type_0 . }
<http://www.example.com/test> :name ?name_1 .
OPTIONAL {
<http://www.example.com/test> :knows ?knows_2 .
OPTIONAL { ?knows_2 a ?__type_3 . }
?knows_2 :nick ?nick_4 .
}
<http://www.example.com/test> :father ?father_5 .
OPTIONAL { ?father_5 a ?__type_6 . }
OPTIONAL {
?father_5 :name ?name_7 .
}
OPTIONAL {
?father_5 :description ?description_8 .
}
`
        expect(constructQuery).toMatch(expected)
    })

    test('use stop symbols', () => {
        const {whereOptionals} = jsonSchema2construct(subject, schema2, { stopSymbols: ['@id'] })
        expect(whereOptionals).toMatch(subject)
    })

})
