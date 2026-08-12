"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { encodeStageItemsForStorage } from "@/lib/stage-item-storage";
import type { PresenceMember, StageItem } from "@/lib/types";

type StageMessage = { senderId: string; items: StageItem[] };

export function useStageRealtime(teamId: string, cutId: string, member: PresenceMember, onRemoteItems: (items: StageItem[]) => void) {
  const [presence, setPresence] = useState<PresenceMember[]>([member]);
  const channelName = `stage:${teamId}:${cutId}`;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    if (supabase) {
      const channel = supabase.channel(channelName, { config: { presence: { key: member.id } } });
      channel
        .on("broadcast", { event: "stage-items" }, ({ payload }) => {
          const message = payload as StageMessage;
          if (message.senderId !== member.id) onRemoteItems(message.items);
        })
        .on("presence", { event: "sync" }, () => {
          const members = Object.values(channel.presenceState()).flat().map((value) => value as unknown as PresenceMember);
          setPresence(members);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel.track(member);
        });
      return () => { void supabase.removeChannel(channel); };
    }

    const channel = new BroadcastChannel(channelName);
    channel.onmessage = ({ data }: MessageEvent<StageMessage | { presence: PresenceMember }>) => {
      if ("items" in data && data.senderId !== member.id) onRemoteItems(data.items);
      if ("presence" in data) setPresence((current) => Array.from(new Map([...current, data.presence].map((item) => [item.id, item])).values()));
    };
    channel.postMessage({ presence: member });
    return () => channel.close();
  }, [channelName, member, onRemoteItems, supabase]);

  function broadcast(items: StageItem[]) {
    const message: StageMessage = { senderId: member.id, items };
    if (supabase) void supabase.channel(channelName).send({ type: "broadcast", event: "stage-items", payload: message });
    else {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage(message);
      channel.close();
    }
  }

  async function persist(items: StageItem[]) {
    if (!supabase) return;
    await supabase.rpc("save_stage_items", { target_team: teamId, target_cut: cutId, payload: encodeStageItemsForStorage(items) });
  }

  return { presence, broadcast, persist, mode: supabase ? "Supabase Realtime" : "데모 실시간" };
}
