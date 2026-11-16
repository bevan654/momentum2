import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../lib/supabase';
import { makeUuid } from '../../utils/uuid';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * AI coach chat state: loads the last 100 messages, sends a message to the `ai-coach` edge
 * function (raw fetch, 60 s timeout) and saves both sides, and tracks the AI response being reported.
 */
export function useAiCoachChat() {
  const userId = useAuthStore((s) => s.user?.id);
  const aiCoachEnabled = useAuthStore((s) => s.profile?.ai_coach_enabled ?? false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; content: string } | null>(null);

  const handleReportAi = useCallback((content: string) => {
    Alert.alert(
      'Report this response?',
      'Tell us why this AI response was harmful or inappropriate. We review every report and act within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            // Synthetic UUID — AI messages aren't tracked individually in client state.
            // The actual content goes into the report's details field via ReportSheet.
            const id = makeUuid();
            setReportTarget({ id, content });
          },
        },
      ],
    );
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('ai_coach_messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (cancelled || !data) return;
      setMessages(
        data.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(next);
      setInput('');

      if (!aiCoachEnabled) {
        setMessages([
          ...next,
          {
            role: 'assistant',
            content:
              "AI coach isn't enabled for your account yet. Reach out to the Momentum team to request early access.",
          },
        ]);
        return;
      }

      setLoading(true);

      if (userId) {
        supabase
          .from('ai_coach_messages')
          .insert({ user_id: userId, role: 'user', content: trimmed })
          .then(() => {}, () => {});
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session?.access_token) {
          setMessages([...next, { role: 'assistant', content: 'You need to be signed in.' }]);
          return;
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60_000);

        const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ messages: next }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.text();
          if (__DEV__) console.warn('[AiCoach] HTTP', res.status, err.slice(0, 200));
          setMessages([
            ...next,
            { role: 'assistant', content: 'Sorry, I hit an error. Try again in a moment.' },
          ]);
          return;
        }

        const payload = await res.json();
        const reply = typeof payload?.message === 'string' ? payload.message.trim() : '';
        if (!reply) {
          setMessages([...next, { role: 'assistant', content: 'No reply generated. Try rephrasing.' }]);
          return;
        }
        setMessages([...next, { role: 'assistant', content: reply }]);
        if (userId) {
          supabase
            .from('ai_coach_messages')
            .insert({ user_id: userId, role: 'assistant', content: reply })
            .then(() => {}, () => {});
        }
      } catch (err: any) {
        if (__DEV__) console.warn('[AiCoach] fetch failed:', err?.message || err);
        setMessages([...next, { role: 'assistant', content: 'Network issue. Try again.' }]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, userId, aiCoachEnabled],
  );

  return { messages, input, setInput, loading, sendMessage, reportTarget, setReportTarget, handleReportAi };
}

export type AiCoachChat = ReturnType<typeof useAiCoachChat>;
