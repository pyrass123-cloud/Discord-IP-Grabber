import crypto from "node:crypto";
import { supabase } from "../lib/supabase.js";

function getCookie(request, name) {
    const cookies = request.headers.cookie || "";

    const match = cookies
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${name}=`));

    return match
        ? decodeURIComponent(match.substring(name.length + 1))
        : null;
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getClientIp(request) {
    const forwardedFor = request.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
        return forwardedFor.split(",")[0].trim();
    }

    const realIp = request.headers["x-real-ip"];

    if (typeof realIp === "string" && realIp.length > 0) {
        return realIp.trim();
    }

    return null;
}

function createIpFingerprint(ip) {
    const secret = process.env.IP_HASH_SECRET;

    if (!ip || !secret) {
        return null;
    }

    return crypto
        .createHmac("sha256", secret)
        .update(ip)
        .digest("hex");
}

function isValidDiscordId(value) {
    return typeof value === "string" && /^\d{17,20}$/.test(value);
}

export default async function handler(request, response) {
    if (request.method !== "GET") {
        return response.status(405).json({
            error: "Method not allowed."
        });
    }

    const {
        code,
        state,
        error,
        error_description: errorDescription
    } = request.query;

    if (error) {
        return response.status(400).send(`
            <h1>Authorization cancelled</h1>
            <p>${escapeHtml(errorDescription || error)}</p>
        `);
    }

    if (!code || !state) {
        return response.status(400).json({
            error: "Missing Discord authorization code or state."
        });
    }

    const savedState = getCookie(request, "oauth_state");
    const guildId = getCookie(request, "verification_guild");

    if (
        !savedState ||
        state !== savedState ||
        !isValidDiscordId(guildId)
    ) {
        return response.status(403).json({
            error: "Invalid verification session. Please restart verification."
        });
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return response.status(500).json({
            error: "Discord OAuth environment variables are missing."
        });
    }

    try {
        const tokenBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri
        });

        const tokenResponse = await fetch(
            "https://discord.com/api/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },
                body: tokenBody.toString()
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error("Discord token error:", tokenData);

            return response.status(400).json({
                error: "Discord authorization failed."
            });
        }

        const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
                headers: {
                    Authorization:
                        `${tokenData.token_type} ${tokenData.access_token}`
                }
            }
        );

        const discordUser = await userResponse.json();

        if (!userResponse.ok || !discordUser.id) {
            console.error("Discord user error:", discordUser);

            return response.status(400).json({
                error: "Could not retrieve the Discord account."
            });
        }

        const displayName =
            discordUser.global_name ||
            discordUser.username ||
            "Discord User";

        const clientIp = getClientIp(request);
        const ipFingerprint = createIpFingerprint(clientIp);

        if (!ipFingerprint) {
            console.error(
                "IP fingerprint could not be created. Check IP_HASH_SECRET."
            );

            return response.status(500).json({
                error: "Verification security processing failed."
            });
        }

        const { error: databaseError } = await supabase
            .from("verifications")
            .upsert(
                {
                    guild_id: guildId,
                    discord_user_id: discordUser.id,
                    discord_username: discordUser.username,
                    discord_display_name: displayName,
                    ip_fingerprint: ipFingerprint,
                    verified_at: new Date().toISOString()
                },
                {
                    onConflict: "guild_id,discord_user_id"
                }
            );

        if (databaseError) {
            console.error(
                "Supabase verification save error:",
                databaseError
            );

            return response.status(500).json({
                error: "Your Discord account was connected, but the verification record could not be saved."
            });
        }

        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`
            : "https://cdn.discordapp.com/embed/avatars/0.png";

        response.setHeader("Set-Cookie", [
            [
                "oauth_state=",
                "HttpOnly",
                "Secure",
                "SameSite=Lax",
                "Path=/",
                "Max-Age=0"
            ].join("; "),
            [
                "verification_guild=",
                "HttpOnly",
                "Secure",
                "SameSite=Lax",
                "Path=/",
                "Max-Age=0"
            ].join("; ")
        ]);

        return response.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Aegis Verification Complete</title>

    <style>
        :root {
            --background: #090a0c;
            --panel: rgba(20, 22, 27, 0.94);
            --border: rgba(212, 175, 55, 0.28);
            --gold: #d4af37;
            --gold-light: #f2cf63;
            --text: #ffffff;
            --muted: #a5aab4;
            --success: #4fd18b;
        }

        * {
            box-sizing: border-box;
        }

        body {
            min-height: 100vh;
            margin: 0;
            padding: 24px;

            display: grid;
            place-items: center;

            color: var(--text);

            background:
                radial-gradient(
                    circle at top,
                    rgba(212, 175, 55, 0.12),
                    transparent 38%
                ),
                var(--background);

            font-family:
                Inter,
                ui-sans-serif,
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;
        }

        .card {
            width: min(100%, 480px);
            padding: 40px;

            text-align: center;

            border: 1px solid var(--border);
            border-radius: 24px;

            background: var(--panel);

            box-shadow:
                0 25px 80px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(212, 175, 55, 0.08);

            backdrop-filter: blur(18px);
        }

        .check {
            width: 72px;
            height: 72px;
            margin: 0 auto 22px;

            display: grid;
            place-items: center;

            border: 1px solid rgba(79, 209, 139, 0.45);
            border-radius: 50%;

            color: var(--success);
            background: rgba(79, 209, 139, 0.1);

            font-size: 38px;
            font-weight: 700;
        }

        .avatar {
            width: 88px;
            height: 88px;
            margin: 8px auto 18px;

            display: block;

            border: 2px solid var(--gold);
            border-radius: 50%;

            object-fit: cover;
        }

        h1 {
            margin: 0 0 10px;
            font-size: clamp(28px, 6vw, 38px);
        }

        .status {
            margin: 0 0 25px;
            color: var(--success);
            font-weight: 700;
        }

        .account {
            padding: 18px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.035);
        }

        .name {
            margin: 0 0 5px;
            color: var(--gold-light);
            font-size: 20px;
            font-weight: 750;
        }

        .username {
            margin: 0;
            color: var(--muted);
        }

        .message {
            margin: 24px 0 0;
            color: var(--muted);
            line-height: 1.6;
        }
    </style>
</head>

<body>
    <main class="card">
        <div class="check">✓</div>

        <h1>Verification Complete</h1>

        <p class="status">
            Discord account connected
        </p>

        <img
            class="avatar"
            src="${escapeHtml(avatarUrl)}"
            alt="Discord avatar"
        >

        <section class="account">
            <p class="name">
                ${escapeHtml(displayName)}
            </p>

            <p class="username">
                @${escapeHtml(discordUser.username)}
            </p>
        </section>

        <p class="message">
            Your Discord identity has been confirmed and
            your verification record has been saved for this server.
            You may now close this page and return to Discord.
        </p>
    </main>
</body>
</html>
        `);
    } catch (error) {
        console.error("OAuth callback error:", error);

        return response.status(500).json({
            error: "An unexpected verification error occurred."
        });
    }
}
