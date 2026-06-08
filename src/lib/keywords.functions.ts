import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_PASS = "6746";

// Default 32 forbidden keywords from UI specification
let serverKeywords: string[] = [
  "crypto", "payment", "instagram", "linkedin", "facebook", "negative", "star", "transferwise",
  "account", "bank", "messenger", "skype", "card", "credit", "purchase", "whatsapp",
  "sms", "transaction", "stripe", "paypal", "rating", "review", "euro", "dollar",
  "money", "pay", "contact", "email", "gmail", "mail", "@", "feedback"
];

export const listKeywords = createServerFn({ method: "GET" }).handler(async () => {
  const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasDb) {
    console.warn("[Keywords] Supabase environment variables missing. Using server in-memory fallback.");
    return { words: serverKeywords };
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("keywords")
      .select("word")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    
    // If database query succeeded but returned no keywords, initialize with server defaults
    if (!data || data.length === 0) {
      return { words: serverKeywords };
    }
    return { words: data.map((r) => r.word) };
  } catch (e) {
    console.error("[Keywords] Supabase query failed, falling back to in-memory:", e);
    return { words: serverKeywords };
  }
});

export const addKeyword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ word: z.string().min(1).max(100), password: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASS) throw new Error("Wrong password");
    const word = data.word.trim().toLowerCase();
    if (!word) throw new Error("Empty word");

    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasDb) {
      if (!serverKeywords.includes(word)) {
        serverKeywords.push(word);
      }
      return { ok: true };
    }

    try {
      const { error } = await supabaseAdmin
        .from("keywords")
        .insert({ word })
        .select()
        .single();
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
      return { ok: true };
    } catch (e) {
      console.error("[Keywords] Supabase insert failed, falling back to in-memory:", e);
      if (!serverKeywords.includes(word)) {
        serverKeywords.push(word);
      }
      return { ok: true };
    }
  });

export const removeKeyword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ word: z.string().min(1).max(100), password: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.password !== ADMIN_PASS) throw new Error("Wrong password");
    const word = data.word.trim().toLowerCase();

    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasDb) {
      serverKeywords = serverKeywords.filter((w) => w !== word);
      return { ok: true };
    }

    try {
      const { error } = await supabaseAdmin
        .from("keywords")
        .delete()
        .eq("word", word);
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) {
      console.error("[Keywords] Supabase delete failed, falling back to in-memory:", e);
      serverKeywords = serverKeywords.filter((w) => w !== word);
      return { ok: true };
    }
  });
