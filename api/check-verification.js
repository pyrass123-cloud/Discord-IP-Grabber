import { supabase } from "../lib/supabase.js";

function getAuthorizationToken(request) {
    const authorization = request.headers.authorization;

    if (
        typeof authorization !== "string" ||
        !authorization.startsWith("Bearer ")
    ) {
        return null;
    }

    return authorization.substring(7).trim();
}

export default async function handler(request, response) {
    if (request.method !== "POST") {
        return response.status(405).json({
            error: "Method not allowed."
        });
    }

    const secret = getAuthorizationToken(request);

    if (
        !process.env.BOTGHOST_API_SECRET ||
        secret !== process.env.BOTGHOST_API_SECRET
    ) {
        return response.status(401).json({
            error: "Unauthorized."
        });
    }

    const {
        guild_id,
        discord_user_id
    } = request.body;

    const { data: verification } = await supabase
        .from("verifications")
        .select("*")
        .eq("guild_id", guild_id)
        .eq("discord_user_id", discord_user_id)
        .maybeSingle();

    if (!verification) {
        return response.json({
            verified: false
        });
    }

    const { data: settings } = await supabase
        .from("guild_settings")
        .select("verified_role_id, log_channel_id")
        .eq("guild_id", guild_id)
        .maybeSingle();

    return response.json({
        verified: true,
        verified_role_id: settings?.verified_role_id ?? null,
        log_channel_id: settings?.log_channel_id ?? null
    });
}
