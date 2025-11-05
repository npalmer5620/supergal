import { createApp } from "./app.js";

const port = process.env.PORT ?? 8787;
const app = createApp();

app.listen(port, () => {
    console.log(`API on http://localhost:${port}`);
});
