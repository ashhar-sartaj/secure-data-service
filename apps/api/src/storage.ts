import { txSecureRecord } from "@repo/crypto";
//this will provide us the blueprint that will be used to place values and the entire object is stored in memory.
export const recordsLibrary = new Map<string, txSecureRecord>();
//we intentionally defined the storage on the server side-- to persist the data. 
//it only vanishes when re-satrted/craches. Unlike on the browser/client side, 
// if we refresh- the data would have gone.
