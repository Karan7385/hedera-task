// encrypt.js
import crypto from "crypto";

/**
 * Simple symmetric AES-256-GCM helpers.
 * In production use KMS and never store keys in plaintext.
 */

export function generateSymKey() {
    return crypto.randomBytes(32); // 256-bit key (Buffer)
}

export function keyToBase64(key) {
    return Buffer.from(key).toString("base64");
}

export function keyFromBase64(b64) {
    return Buffer.from(b64, "base64");
}

/**
 * Encrypt plaintext (string) and return a Buffer containing:
 * iv(12) | tag(16) | ciphertext
 */
export function encryptMessage(key, plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypt a packaged buffer (iv|tag|ciphertext) and return plaintext string.
 * Throws on auth failure.
 */
export function decryptMessage(key, packaged) {
    const data = Buffer.from(packaged);
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const ciphertext = data.slice(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return out.toString("utf8");
}
