import { Inbox } from '@novu/nextjs';
import Title from '@/components/Title';
import { novuConfig } from '@/utils/config';

export default function Home() {
  return (
    <>
      <Title title="Render Bell props" />
      <Inbox
        {...novuConfig}
        appearance={{
          icons: {
            bell: () => '🔔',
            cogs: () => '🔩',
            dots: () => '🔘',
            unread: () => '🔴',
            markAsArchived: () => '🔵',
            email: () => '📧',
            sms: () => '📱',
            push: () => '📡',
            inApp: () => '📱',
          },
        }}
      />
    </>
  );
}
