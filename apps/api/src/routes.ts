import { encryptTnx, decryptTnx, txSecureRecord } from "@repo/crypto";
import dotenv from "dotenv";
import type { FastifyInstance } from "fastify";
import { recordsLibrary } from "./storage.js";
dotenv.config();

//here the fastifyInstance is the app we created as a instance of fastify by: app = fastify() in server.ts
//then we will inject all our routes to that instance, means to app via app.register(routes)

//helper function
function isNonEmptyString(str: unknown) : str is string {
    return typeof str === 'string' && str.trim().length > 0;
}
function validateBody(body: unknown) : {recordId: string, payload: unknown} | null {
    // console.log(typeof body); //object
    console.log('body from backend',body);
    if (!body || typeof body !== 'object' || typeof body === null) return null;
    const b  = body  as {recordId?: unknown, payload?: unknown}
    //checking emptiness of partyId
    if (!isNonEmptyString(b.recordId)) return null;
    //below is what can be done to check if the b.payload is a valid js object (means it has keys).. so.. do if type of b.payload !== object && b.payload !== null because in js, type of null is an object, as a result we cant check if the user entered null value('': empty string is null) as a payload obect.
    // 2 ways to check 
    //1
    // if (typeof b.payload === 'undefined') return null;
    console.log('b.payload',b.payload);
    // console.log(typeof body);
    if (typeof b.payload !== 'object' || typeof b.payload === null ) return null
    return { recordId: b.recordId, payload: b.payload};
    // console.log(body);
    // return null;
}
function getHexmasterKey() : string | null {
    const mk = process.env.MASTER_KEY_HEX;
    if (!mk || typeof mk !== 'string') return null;
    return mk;
}
// function validId(id: unknown) : id is string | null{
//     //checking with uuid() regex
//     return id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
// }

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
//to check is hex?
function isHex(str: string): boolean {
    if (typeof str !== 'string' || str.length % 2 !== 0) return false;
    //converting the input string into buffer
    const buf = Buffer.from(str, 'hex');
    //converting the buf back to hex and matching with input string
    return buf.toString('hex') === str.toLowerCase();  
}
export async function routes (app: FastifyInstance) {
    //POST: /tx/encrypt output will be the record that just got encrypted
    app.post('/tx/encrypt', async (request, reply) => {
        const body = validateBody(request.body);
        // const body = request.body
        console.log(body);
        //if my body includes null: throw error
        if (!body) {
            return reply.code(400).send({error: 'invalid body'})
        }
        const hexMasterKey = getHexmasterKey();
        //if hexMasterKey is null => throw error
        if (!hexMasterKey) {
            return reply.code(500).send({ error: 'error configuring master key' })
        }
        try {
            const result = encryptTnx({
                payload: body.payload,
                partyId: body.recordId,
                mkHex: hexMasterKey
            })
            //setting this result to the recordsLibrary
            recordsLibrary.set(result.id, result);
            return reply.code(200).send(result);
        } catch (err) {
            return reply.code(400).send({error: 'encryption failed.'})
        }
        
    })  
    //GET: /tx/:id return the stored encrypted record
    app.get('/tx/:id', async (request, reply) => {
      //extracting id
      const {id} = request.params as {id: string}  
      //checking the valid entered id: as is was created using crypto.uuid()... so we will create a helper function that will match it with regex
        if (!uuidRegex.test(id)) {
            return reply.code(400).send({error: 'Invalid uuid'})
        }
        //search the record in the library.
        const isRecordExist = recordsLibrary.has(id); //an object of type txSecureRecord
        if (!isRecordExist) {
            return reply.code(404).send({error: 'record not found'})
        }
        const record = recordsLibrary.get(id);

        return reply.code(200).send(record);
    })
    //POST: /tx/:id/decrypt return the decrypted record of the entered recod id
    app.post('/tx/:id/decrypt',async (request, reply) => {
        const { id } = request.params as {id: string}
        //checking valid regex
        if (!uuidRegex.test(id)) {
            return reply.code(400).send({ error: 'Invalid uuid' })
        }
        //search the record in the library.
        const isRecordExist = recordsLibrary.has(id); //an object of type txSecureRecord
        if (!isRecordExist) {
            return reply.code(404).send({ error: 'record not found' })
        }
        //means that record with id exist
        const record = recordsLibrary.get(id);
        const hexMasterKey = getHexmasterKey();
        //if hexMasterKey is null => throw error
        if (!hexMasterKey) {
            return reply.code(500).send({ error: 'error configuring master key' })
        }

        //now perform the decryption of the record
        try {
            const decryptedPayload = decryptTnx({
                result: record as txSecureRecord,
                masterkey: hexMasterKey as string
            })
            return reply.code(200).send({ decryptedPayload }); //decryptedPayload is a js object containing the original data/payload
        } catch(err) {
            //if our the tag authentication fails-- will be catched here
            return reply.code(400).send({error: 'failed decryption'})
        }
    })
}
