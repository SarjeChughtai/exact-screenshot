import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/context/MessagesContext';

export function MessagesButton() {
  const navigate = useNavigate();
  const { isMessagingEnabled, unreadCount } = useMessages();

  if (!isMessagingEnabled) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0"
      onClick={() => navigate('/messages')}
      title="Messages"
    >
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
