-- ==========================================
-- AUTO-NOTIFICATION TRIGGERS
-- ==========================================

-- 1. Direct Message Notification
CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    SELECT name INTO sender_name FROM public.user_profiles WHERE user_id = NEW.sender_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
        NEW.receiver_id,
        'New Message',
        COALESCE(sender_name, 'A hunter') || ': ' || LEFT(NEW.message, 50) || CASE WHEN LENGTH(NEW.message) > 50 THEN '...' ELSE '' END,
        'message',
        '/social?chat=' || NEW.sender_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_dm ON public.direct_messages;
CREATE TRIGGER trg_notify_dm
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();


-- 2. Friend Request Notification
CREATE OR REPLACE FUNCTION public.notify_on_friendship()
RETURNS TRIGGER AS $$
DECLARE
    requester_name TEXT;
BEGIN
    -- Handle NEW REQUEST (INSERT)
    IF (TG_OP = 'INSERT') THEN
        SELECT name INTO requester_name FROM public.user_profiles WHERE user_id = NEW.requester_id;
        
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            NEW.receiver_id,
            'Companion Invitation',
            COALESCE(requester_name, 'A hunter') || ' wants to join your party.',
            'friend',
            '/social'
        );
    -- Handle ACCEPTANCE (UPDATE)
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        SELECT name INTO requester_name FROM public.user_profiles WHERE user_id = NEW.receiver_id;
        
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            NEW.requester_id,
            'Invitation Accepted',
            COALESCE(requester_name, 'The hunter') || ' has joined your party.',
            'friend',
            '/social'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_friendship ON public.friendship;
CREATE TRIGGER trg_notify_friendship
    AFTER INSERT OR UPDATE ON public.friendship
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_friendship();

-- 3. Task Assignment Notification (Optional but good)
CREATE OR REPLACE FUNCTION public.notify_on_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to)) THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            NEW.assigned_to,
            'New Task Assigned',
            'You have been assigned a new quest: ' || NEW.title,
            'assignment',
            '/dungeon-gate'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_task_assign ON public.tasks;
CREATE TRIGGER trg_notify_task_assign
    AFTER INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_assignment();
