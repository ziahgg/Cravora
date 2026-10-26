import { Bell, Settings } from 'lucide-react';
import type { Metadata } from 'next';

import { NotificationList } from '@/components/notification-list';
import { Screen } from '@/components/screen';
import { EmptyState, IconButton, TopBar } from '@/components/ui';
import { listNotifications } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };

/** Figma 13 Notifications — created by the database when an order changes status. */
export default async function NotificationsPage() {
  const { supabase, userId } = await requireUser();
  const rows = await listNotifications(supabase, userId);
  const today = new Date().toDateString();
  const items = rows.map((n) => {
    const d = new Date(n.created_at);
    const isToday = d.toDateString() === today;
    return { ...n, group: isToday ? 'Today' : 'Earlier', when: isToday ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
  });
  return (
    <Screen>
      <TopBar title="Notifications" back="/" right={<IconButton icon={Settings} label="Notification settings" href="/profile" />} />
      {items.length ? <NotificationList items={items} /> : <EmptyState icon={Bell} title="No notifications yet" message="Order updates show up here." />}
    </Screen>
  );
}
