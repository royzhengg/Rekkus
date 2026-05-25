"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportInvalidBoundary = reportInvalidBoundary;
const analytics_1 = require("@/lib/analytics");
function reportInvalidBoundary(boundary) {
    analytics_1.analytics.actionError(null, 'runtime_boundary', boundary);
}
