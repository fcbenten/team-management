import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  subscription?: webpush.PushSubscription | string;
  memberId?: string;
  targetAll?: boolean;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

interface TargetSubscription {
  memberId?: string;
  memberName?: string;
  subscription: webpush.PushSubscription;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64Url(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function loadVapidKeys(): Promise<CryptoKeyPair> {
  const jsonRaw = Deno.env.get("VAPID_KEYS_JSON");
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as webpush.ExportedVapidKeys;
    return await webpush.importVapidKeys(parsed);
  }

  const pubB64 = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const privB64 = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  if (!pubB64 || !privB64) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定です。supabase secrets set で設定してください。",
    );
  }

  const pubBytes = decodeBase64Url(pubB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY の形式が不正です（65バイト非圧縮P-256公開鍵が必要）。");
  }

  const x = encodeBase64Url(pubBytes.slice(1, 33));
  const y = encodeBase64Url(pubBytes.slice(33, 65));

  const exported: webpush.ExportedVapidKeys = {
    publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: privB64, ext: true },
  };
  return await webpush.importVapidKeys(exported);
}

function parseSubscription(raw: unknown): webpush.PushSubscription | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const sub = obj as Record<string, unknown>;
  const keys = sub.keys as Record<string, unknown> | undefined;
  if (
    typeof sub.endpoint !== "string" ||
    !sub.endpoint ||
    !keys ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string"
  ) {
    return null;
  }
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as RequestBody;
    const title = (body.title || "FC Benten テスト通知").trim();
    const messageBody = (body.body || "Web Push 通知の受信テストです。").trim();
    const url = body.url || "./";
    const tag = body.tag || "fcb-webpush-test";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = (supabaseUrl && serviceRoleKey)
      ? createClient(supabaseUrl, serviceRoleKey)
      : null;

    const targets: TargetSubscription[] = [];

    if (body.subscription) {
      const parsed = parseSubscription(body.subscription);
      if (!parsed) {
        return jsonResponse({ success: false, error: "subscription の形式が不正です。" }, 400);
      }
      targets.push({ subscription: parsed });
    } else {
      if (!supabaseAdmin) {
        return jsonResponse({ success: false, error: "Supabase 管理クライアントを初期化できません。" }, 500);
      }
      let query = supabaseAdmin
        .from("members")
        .select("member_id, name, push_subscription")
        .not("push_subscription", "is", null)
        .neq("push_subscription", "");

      if (body.memberId) {
        query = query.eq("member_id", body.memberId);
      } else if (body.targetAll) {
        query = query.eq("is_past", false);
      } else {
        return jsonResponse({
          success: false,
          error: "subscription, memberId, または targetAll のいずれかを指定してください。",
        }, 400);
      }

      const { data: rows, error } = await query;
      if (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
      for (const row of rows || []) {
        const parsed = parseSubscription(row.push_subscription);
        if (parsed) {
          targets.push({
            memberId: row.member_id,
            memberName: row.name,
            subscription: parsed,
          });
        }
      }
    }

    if (targets.length === 0) {
      return jsonResponse({
        success: false,
        error: "送信可能な Push 購読情報が見つかりませんでした。",
        sentCount: 0,
        failedCount: 0,
      }, 404);
    }

    const vapidKeys = await loadVapidKeys();
    const contactInformation = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:fc.benten.tokyo@gmail.com";
    const appServer = await webpush.ApplicationServer.new({
      contactInformation,
      vapidKeys,
    });

    const notificationPayload = JSON.stringify({
      title,
      body: messageBody,
      icon: "./icon-192.png",
      badge: "./badge-96.png",
      url,
      tag,
      sentAt: new Date().toISOString(),
    });

    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          const subscriber = appServer.subscribe(target.subscription);
          await subscriber.pushTextMessage(notificationPayload, {
            urgency: webpush.Urgency.High,
          });
          return {
            memberId: target.memberId ?? null,
            memberName: target.memberName ?? null,
            endpointPreview: target.subscription.endpoint.slice(0, 60) + "...",
            success: true,
          };
        } catch (err) {
          let status: number | null = null;
          let detail = err instanceof Error ? err.message : String(err);

          if (err instanceof webpush.PushMessageError) {
            status = err.response.status;
            detail = `${err.response.status} ${err.response.statusText}`;
            if ((err.isGone() || status === 404) && target.memberId && supabaseAdmin) {
              await supabaseAdmin
                .from("members")
                .update({ push_subscription: null, updated_at: new Date().toISOString() })
                .eq("member_id", target.memberId);
            }
          }

          return {
            memberId: target.memberId ?? null,
            memberName: target.memberName ?? null,
            endpointPreview: target.subscription.endpoint.slice(0, 60) + "...",
            success: false,
            status,
            error: detail,
          };
        }
      }),
    );

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.length - sentCount;

    return jsonResponse({
      success: sentCount > 0,
      sentCount,
      failedCount,
      results,
    }, sentCount > 0 ? 200 : 502);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

