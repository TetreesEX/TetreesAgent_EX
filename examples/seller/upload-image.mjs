import { createClient, redact } from "../../src/api-client.mjs";

const [productId, imagePath] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
if (!productId || !imagePath) throw new Error("Usage: node examples/seller/upload-image.mjs <pack-id> <image-path> --confirm-upload");
if (!process.argv.includes("--confirm-upload")) throw new Error("Image upload was not started. Add --confirm-upload after checking its content and rights.");

const result = await createClient().uploadImage(productId, imagePath);
console.log(JSON.stringify(redact({ result, next: "Run check-readiness to verify the sanitized catalogue image is attached." }), null, 2));
