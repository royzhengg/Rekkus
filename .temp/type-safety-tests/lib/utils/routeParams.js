"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeParamString = routeParamString;
exports.routeParamNumber = routeParamNumber;
exports.routeParamsObject = routeParamsObject;
function routeParamString(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return value.find(item => typeof item === 'string');
    return undefined;
}
function routeParamNumber(value) {
    const parsed = Number(routeParamString(value));
    return Number.isFinite(parsed) ? parsed : null;
}
function routeParamsObject(params, keys) {
    const normalized = {};
    for (const key of keys) {
        const value = routeParamString(params[key]);
        if (value !== undefined)
            normalized[String(key)] = value;
    }
    return normalized;
}
