import fastify from "fastify"
import cors from "@fastify/cors"
import {routes} from "./routes.js"
import { greeting } from "@repo/crypto";

export function createServer() {
    const app = fastify();

    app.register(cors, {
        origin: true,
    });

    app.register(routes);

    app.get("/", async () => {
        return { status: "ok", content: greeting() };
    });

    return app;
}