"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCoolingDown = isCoolingDown;
exports.checkCooldown = checkCooldown;
exports.setCooldown = setCooldown;
const cooldowns = new Map();
function isCoolingDown(key, windowMs) {
    const now = Date.now();
    const last = cooldowns.get(key);
    if (last && now - last < windowMs)
        return true;
    cooldowns.set(key, now);
    return false;
}
// Pure read — does not update the timestamp
function checkCooldown(key, windowMs) {
    const last = cooldowns.get(key);
    return !!(last && Date.now() - last < windowMs);
}
// Explicit set — call after a failure event to start a cooldown
function setCooldown(key) {
    cooldowns.set(key, Date.now());
}
