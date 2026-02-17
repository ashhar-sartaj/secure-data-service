import fastify from "fastify"
import cors from "@fastify/cors"
import {routes} from "./routes.js"
import { greeting } from "@repo/crypto";
import dotenv from 'dotenv'

dotenv.config();
const app=fastify();

await app.register(cors, {
    origin: true,
})

// app.get('/health', async() =>{
//     return {status: 'ok'}
// })
app.register(routes)
app.get('/', () => {
    return {status: 'ok', content: greeting() }
})

const port = Number(process.env.PORT || 3001)
// const port = 4000;
app.listen({port, host:'0.0.0.0'}, () => {
    console.log(`api is running on http://localhost:${port}`);
})