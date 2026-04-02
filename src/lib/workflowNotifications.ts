import { supabase } from '@/integrations/supabase/client';

export async function notifyUsers({
  userIds,
  title,
  message,
  link,
  type = 'info',
}: {
  userIds: (string | null | undefined)[];
  title: string;
  message: string;
  link?: string | null;
  type?: string;
}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (uniqueUserIds.length === 0) return;

  await (supabase.from as any)('notifications').insert(
    uniqueUserIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      link: link || null,
    })),
  );
}

export async function getUserIdsForRole(role: string): Promise<string[]> {
  const { data, error } = await (supabase.from as any)('user_roles')
    .select('user_id')
    .eq('role', role);

  if (error || !Array.isArray(data)) return [];
  return data.map((row: { user_id?: string }) => row.user_id).filter(Boolean);
}

export async function sendWorkflowEmailNotification({
  userIds,
  subject,
  text,
  html,
}: {
  userIds: (string | null | undefined)[];
  subject: string;
  text: string;
  html?: string;
}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (uniqueUserIds.length === 0) return { skipped: true };

  const { data, error } = await supabase.functions.invoke('workflow-email-notify', {
    body: {
      userIds: uniqueUserIds,
      subject,
      text,
      html: html || null,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
