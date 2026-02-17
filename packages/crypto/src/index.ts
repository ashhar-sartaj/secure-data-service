import crypto from 'node:crypto';

export type txSecureRecord = {
    //this serves as the blueprint for all our enteries/payload including their encrypted keys and data
    id: string,
    partyId: string,
    createdAt: string

    //payload_iv: iv of payload generated  that number of times ou perform encryption, thus resulting in unique cyphertext (everytime)
    //payload_ct: payload ciphertext
    //payload_tag: proves that the payload hasn't been modified.
    data_iv: string,
    data_ct: string,
    data_tag: string,

    dek_wrap_iv: string,
    dek_wrapped: string,
    dek_wrapped_tag: string,

    alg: "AES-256-GCM",
    mk_version: 1,
}
//check if the input is a hex string
function isHex(str: string): boolean {
    if (typeof str !== 'string' || str.length % 2 !== 0) return false;
    const buf = Buffer.from(str, 'hex'); //coverting the input hex to binary
    //then, binary to hex and comparing with the input string 
    return buf.toString('hex') === str.toLowerCase();
}
function hexToBuffer(str: string, field: string): Buffer {
    if (!isHex(str)) {
        //if isHex is false
        throw new Error(`entered value in field: ${field} is invalid. Please enter valid hex value.`)
    }
    //if isHex is true, return the Buffer 
    return Buffer.from(str, 'hex')    
}
function bufToHex(bufVal: Buffer): string {
    return bufVal.toString('hex');
}
//below function will be used to validate the size of the key: as to create createcipher, the master key must be of 32 bytes binary key (not in hex)
function validateSize(suppliedBuf: Buffer, expectedLength: number, field: String) {
    if (suppliedBuf.length !== expectedLength) {
        throw new Error(`the provided ${field} must be of size ${expectedLength}`);
    }
}
function parseMasterKey(masterKeyInHex : string): Buffer {
    const masterKey = hexToBuffer(masterKeyInHex, "MASTER_KEY_HEX");//this is master key in binary
    validateSize(masterKey, 32, "MASTER_KEY_HEX");
    return masterKey;
}
//encryption function- function to encrypt the data: We require: data (Buffer), iv (Buffer), dek(Buffer)
//the plainText has to be buffer type (raw binary), cipher.update(payload, 'utf-8') will bydefault provide Buffer. To explicityely mention the return type: cipher.update(payload, 'utf-8', 'hex'). result to be a Hex or Base64 string immediately, you add a third argument
//key could be either DEK when doing data encryption or master key when doing dek encryption.
//when doing data encryption: key: dek, iv: specifi iv, plainText: payload
//when doung dek encryption: key: mk, iv: specific iv, plainText: dek
function dataEncryption(params:{key: Buffer, iv: Buffer, plainText: Buffer }) {
    //validating the size of dek, iv
    validateSize(params.key, 32, 'DEK');
    validateSize(params.iv, 12, 'data_iv');
    //initializes the engine. You provide the Algorithm (AES-256-GCM), the DEK (Data Encryption Key - 32 bytes), and the IV (Initialization Vector - 12 bytes for GCM).

    const cipher = crypto.createCipheriv("aes-256-gcm", params.key, params.iv); 
    const ct = Buffer.concat([cipher.update(params.plainText), cipher.final()]);
    const tag = cipher.getAuthTag();
    // GCM tag is always 16 bytes in Node
    validateSize(tag, 16, 'dataTag');
    return  {ct, tag};
}
//decryption of data. We require:  dataTag(buffer), encrypteddata(ct)(buffer), dek(buffer), iv (buffer)
function dataDecryption(params: {ct: Buffer, key: Buffer, iv: Buffer, tag: Buffer}) {
    //validating size
    validateSize(params.tag, 16, 'dataTag');
    validateSize(params.key, 32, 'DEK');
    validateSize(params.iv,12, 'data_iv');
    const decipher = crypto.createDecipheriv('aes-256-gcm', params.key, params.iv);
    decipher.setAuthTag(params.tag);
    // If ct/tag/nonce wrong → throws here
    const pt = Buffer.concat([decipher.update(params.ct), decipher.final()]);
    return pt;
    //pt(Plaintext) is the raw, decrypted binary data.
}

//public api
// to encrypt the tnx: we require the following: the payload, th master key(may be from env: so it is in hex), partyId
export function encryptTnx(input: { payload: unknown, partyId: string, mkHex: string }): txSecureRecord {
    const {payload, partyId, mkHex} = input;
    if (!partyId || typeof partyId !== "string") {
        throw new Error('valid partyId is required');
    }

    //converting mkHex to Buffer.
    const mk = parseMasterKey(mkHex);
    const dek = crypto.randomBytes(32);
    const dataIv = crypto.randomBytes(12);
    const data = Buffer.from(JSON.stringify(payload), 'utf-8'); //data must be in raw binary (Buffer)
    const payloadEncryption = dataEncryption({
        key:dek, 
        iv:dataIv,
        plainText:data
    });
    //wrapping the dek with the master key
    //creating iv for dek wrapping
    const dekIv = crypto.randomBytes(12);
    const dekEncryption = dataEncryption({
        key: mk,
        iv: dekIv,
        plainText: dek
    })

    //storing the encryption result as hex
    const result : txSecureRecord = {
        id: crypto.randomUUID(),
        partyId,
        createdAt: new Date().toISOString(),

        data_iv: bufToHex(dataIv),
        data_ct: bufToHex(payloadEncryption.ct),
        data_tag: bufToHex(payloadEncryption.tag),

        dek_wrap_iv: bufToHex(dekIv),
        dek_wrapped: bufToHex(dekEncryption.ct),
        dek_wrapped_tag: bufToHex(dekEncryption.tag),
        alg: "AES-256-GCM",
        mk_version: 1,

    }
    return result;
}

export function decryptTnx(input: {result: txSecureRecord, masterkey: string}) : unknown {
    const {result, masterkey} = input;
    //convert the master key hex string to buffer
    const mk = parseMasterKey(masterkey);
    //validating the size of master key
    validateSize(mk, 32, 'master key');
    //fetching all the record fields from the result object, and since everything is tored in hex-> covert back to buffer
    //first we require to decrypt the wrappedDek to get the dek (in buffer), second with the help of decrypted dek, decrypt the payload and return.
    const dekWrapped = hexToBuffer( result.dek_wrapped, 'wrapped dek');
    const dekIv = hexToBuffer( result.dek_wrap_iv, 'dek iv');
    const dektag = hexToBuffer( result.dek_wrapped_tag, 'dek tag');
    //validate the size of dekIv and dektag
    validateSize(dekIv, 12, 'dek iv');
    validateSize(dektag, 16, 'dek tag');
    //now decrypt the dek
    const dekDecryption = dataDecryption({
        ct: dekWrapped,
        key: mk,
        iv: dekIv,
        tag: dektag,
    })
    //validating the size od decrypted dek
    validateSize(dekDecryption, 32, 'dek')
    //our dek (in buffer) is contained in dekDecryption.
    //moving to decrypt data using decrypted dek
    //converting all the fetched fields from hex to buffer
    const dataCt = hexToBuffer( result.data_ct, 'data ct')
    const dataTag = hexToBuffer( result.data_tag, 'data tag')
    const dataIv = hexToBuffer( result.data_iv, 'data iv')
    //validating the size of dataTag and dataIv
    validateSize(dataTag, 16, 'data tag')
    validateSize(dataIv, 12, 'data iv')
    //now decrypt the data using decrypted dek
    const payloadDecryption = dataDecryption({
        ct: dataCt,
        key: dekDecryption,
        iv: dataIv,
        tag: dataTag,
    }); //my decrypted payload is contained in payloadDecryption as Buffer (as we supplied as Buffer during encryption). So, turn back to string:
    return JSON.parse(payloadDecryption.toString('utf-8'));  //call toString('utf-8'), you are telling the computer: "Take these raw bytes and interpret them as text characters. Thus, the output of JSON.parse() is a js object
}
export function greeting() {
    return "welcome!";
}