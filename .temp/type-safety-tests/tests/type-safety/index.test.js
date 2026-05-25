"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const edgeFunctionGuards_test_1 = require("./edgeFunctionGuards.test");
const googlePlacesGuards_test_1 = require("./googlePlacesGuards.test");
const moderationGuards_test_1 = require("./moderationGuards.test");
const routeParams_test_1 = require("./routeParams.test");
const runtimeBoundaryGuards_test_1 = require("./runtimeBoundaryGuards.test");
const safeJson_test_1 = require("./safeJson.test");
(0, node_test_1.default)('safe JSON guards', () => (0, safeJson_test_1.runSafeJsonTests)(strict_1.default));
(0, node_test_1.default)('route param guards', () => (0, routeParams_test_1.runRouteParamsTests)(strict_1.default));
(0, node_test_1.default)('Google Places guards', () => (0, googlePlacesGuards_test_1.runGooglePlacesGuardTests)(strict_1.default));
(0, node_test_1.default)('moderation guards', () => (0, moderationGuards_test_1.runModerationGuardTests)(strict_1.default));
(0, node_test_1.default)('Edge Function guards', () => (0, edgeFunctionGuards_test_1.runEdgeFunctionGuardTests)(strict_1.default));
(0, node_test_1.default)('runtime boundary guards', () => (0, runtimeBoundaryGuards_test_1.runRuntimeBoundaryGuardTests)(strict_1.default));
