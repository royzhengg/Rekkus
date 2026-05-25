"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isModerationResponse = isModerationResponse;
function isModerationResponse(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    return 'safe' in value && typeof value.safe === 'boolean';
}
