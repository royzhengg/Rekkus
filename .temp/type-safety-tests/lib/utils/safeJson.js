"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonUnknown = parseJsonUnknown;
exports.parseJsonWithGuard = parseJsonWithGuard;
exports.isStringArray = isStringArray;
exports.isRecord = isRecord;
function parseJsonUnknown(raw) {
    return JSON.parse(raw);
}
function parseJsonWithGuard(raw, guard) {
    try {
        const parsed = parseJsonUnknown(raw);
        return guard(parsed) ? parsed : null;
    }
    catch {
        return null;
    }
}
function isStringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
