"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
require("react-native-url-polyfill/auto");
require("expo-sqlite/localStorage/install");
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("@/lib/config");
function requiredConfig(value, key) {
    if (!value)
        throw new Error(`Missing required public configuration: ${key}`);
    return value;
}
exports.supabase = (0, supabase_js_1.createClient)(requiredConfig(config_1.SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'), requiredConfig(config_1.SUPABASE_ANON_KEY, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
