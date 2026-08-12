import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function uploadMedia(bucket: "recordings" | "dubbings" | "music" | "final-videos", path: string, file: File | Blob) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return URL.createObjectURL(file);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
