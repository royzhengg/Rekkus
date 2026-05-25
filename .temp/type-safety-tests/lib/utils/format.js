"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLikes = parseLikes;
exports.todayHoursIndex = todayHoursIndex;
exports.avatarPalette = avatarPalette;
function parseLikes(s) {
    const n = parseFloat(s);
    return s.includes('k') ? n * 1000 : n;
}
function todayHoursIndex() {
    return (new Date().getDay() + 6) % 7;
}
const DEFAULT_AVATAR_PALETTE = { bg: '#FBEAF0', color: '#993556' };
const AVATAR_PALETTES = [
    DEFAULT_AVATAR_PALETTE,
    { bg: '#E1F5EE', color: '#0F6E56' },
    { bg: '#E6F1FB', color: '#185FA5' },
    { bg: '#FAEEDA', color: '#854F0B' },
    { bg: '#F1EEFE', color: '#534AB7' },
    { bg: '#F2F2EF', color: '#4A4A45' },
];
function avatarPalette(username) {
    return AVATAR_PALETTES[username.charCodeAt(0) % AVATAR_PALETTES.length] ?? DEFAULT_AVATAR_PALETTE;
}
