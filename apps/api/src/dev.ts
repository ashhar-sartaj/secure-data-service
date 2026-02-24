import dotenv from "dotenv";
import { createServer } from "./server.js";

dotenv.config();

async function start() {
    const app = createServer();
    const port = Number(process.env.PORT) || 3000;

    try {
        await app.listen({
            port,
            host: "0.0.0.0",
        });

        console.log(`Dev server running on http://localhost:${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();