import { supabase } from "../lib/supabase.js";

function isValidDiscordId(value) {
    return (
        typeof value === "string" &&
        /^\d{17,20}$/.test(value)
    );
}

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
        response.setHeader("Allow", "POST");

        return response.status(405).json({
            success: false,
            error: "Method not allowed."
        });
    }

    const expectedSecret = process.env.BOTGHOST_API_SECRET;
    const providedSecret = getAuthorizationToken(request);

    if (
        !expectedSecret ||
        !providedSecret ||
        providedSecret !== expectedSecret
    ) {
        return response.status(401).json({
            success: false,
            error: "Unauthorized request."
        });
    }

    const {
        guild_id: guildId,
        verified_role_id: verifiedRoleId,
        verification_channel_id: verificationChannelId,
        log_channel_id: logChannelId
    } = request.body || {};

    if (!isValidDiscordId(guildId)) {
        return response.status(400).json({
            success: false,
            error: "A valid guild_id is required."
        });
    }

    if (!isValidDiscordId(verifiedRoleId)) {
        return response.status(400).json({
            success: false,
            error: "A valid verified_role_id is required."
        });
    }

    if (!isValidDiscordId(verificationChannelId)) {
        return response.status(400).json({
            success: false,
            error: "A valid verification_channel_id is required."
        });
    }

    if (!isValidDiscordId(logChannelId)) {
        return response.status(400).json({
            success: false,
            error: "A valid log_channel_id is required."
        });
    }

    try {
        const { data, error } = await supabase
            .from("guild_settings")
            .upsert(
                {
                    guild_id: guildId,
                    verified_role_id: verifiedRoleId,
                    verification_channel_id: verificationChannelId,
                    log_channel_id: logChannelId,
                    updated_at: new Date().toISOString()
                },
                {
                    onConflict: "guild_id"
                }
            )
            .select()
            .single();

        if (error) {
            console.error("Guild setup database error:", error);

            return response.status(500).json({
                success: false,
                error: "The server settings could not be saved."
            });
        }

        const baseUrl =
            process.env.PUBLIC_BASE_URL ||
            `https://${request.headers.host}`;

        const verificationUrl =
            `${baseUrl}/api/login?guild=${encodeURIComponent(guildId)}`;

        return response.status(200).json({
            success: true,
            message: "Aegis has been configured for this server.",
            verification_url: verificationUrl,
            settings: {
                guild_id: data.guild_id,
                verified_role_id: data.verified_role_id,
                verification_channel_id:
                    data.verification_channel_id,
                log_channel_id: data.log_channel_id
            }
        });
    } catch (error) {
        console.error("Guild setup endpoint error:", error);

        return response.status(500).json({
            success: false,
            error: "An unexpected setup error occurred."
        });
    }
}
