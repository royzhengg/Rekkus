"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPostUploadJob = isPostUploadJob;
exports.isPostUploadJobList = isPostUploadJobList;
const safeJson_1 = require("../utils/safeJson");
function isStatus(value) {
    return value === 'preparing' || value === 'uploading' || value === 'publishing' || value === 'posted' || value === 'failed';
}
function isMediaStatus(value) {
    return (value === 'local_ready' || value === 'queued' || value === 'preparing' || value === 'ready' ||
        value === 'failed' || value === 'uploading' || value === 'uploaded' || value === 'processing');
}
function isMedia(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.localId === 'string' &&
        typeof value.uri === 'string' &&
        (value.type === 'image' || value.type === 'video') &&
        (value.processingStatus === undefined || isMediaStatus(value.processingStatus)));
}
function isPostUploadJob(value) {
    return ((0, safeJson_1.isRecord)(value) &&
        typeof value.id === 'string' &&
        typeof value.title === 'string' &&
        typeof value.progress === 'number' &&
        isStatus(value.status) &&
        (value.coverUri === undefined || typeof value.coverUri === 'string') &&
        (value.error === undefined || value.error === null || typeof value.error === 'string') &&
        (value.media === undefined || (Array.isArray(value.media) && value.media.every(isMedia))));
}
function isPostUploadJobList(value) {
    return Array.isArray(value) && value.every(isPostUploadJob);
}
