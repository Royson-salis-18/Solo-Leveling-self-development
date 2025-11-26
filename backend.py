import streamlit as st
import json
import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from supabase import create_client, Client


@st.cache_resource
def init_supabase() -> Client:
    
    try:
        url = st.secrets["supabase_url"]
        key = st.secrets["supabase_key"]
    except Exception:
        url = "https://vznqvdfncckbatgleapf.supabase.co"
    return create_client(url, key)

supabase = init_supabase()

def parse_iso_naive(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    cleaned = re.sub(r'([+-]\d{2}:\d{2}|Z)$', '', ts)
    try:
        dt = datetime.fromisoformat(cleaned)
    except Exception:
        try:
            if 'T' in cleaned:
                date_part, _, time_part = cleaned.partition('T')
                time_clean = time_part.split('.')[0]
                dt = datetime.fromisoformat(f"{date_part}T{time_clean}")
            else:
                dt = datetime.fromisoformat(cleaned)
        except Exception:
            return None
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_by_email(email: str) -> Optional[Dict]:
    try:
        resp = supabase.table('users').select('*').eq('email', (email or "").strip().lower()).execute()
        if resp and resp.data:
            return resp.data[0]
        return None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return None

def register_user(email: str, password: str, name: str, avatar: str) -> bool:
    try:
        email_norm = (email or "").strip().lower()
        response = supabase.table('users').select('email').eq('email', email_norm).execute()
        st.session_state['last_db_response'] = response.data if hasattr(response, 'data') else None
        st.session_state['last_db_error'] = response.error if hasattr(response, 'error') else None
        if response and response.data:
            return False
        password_hash = hash_password(password)
        res = supabase.table('users').insert({
            'email': email_norm,
            'password_hash': password_hash,
            'name': name,
            'avatar_url': avatar,
            'level': 1,
            'total_points': 0,
            'created_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }).execute()
        st.session_state['last_db_response'] = res.data if hasattr(res, 'data') else None
        st.session_state['last_db_error'] = res.error if hasattr(res, 'error') else None
        if getattr(res, "error", None):
            return False
        check = supabase.table('users').select('*').eq('email', email_norm).execute()
        st.session_state['last_db_response'] = check.data if hasattr(check, 'data') else None
        st.session_state['last_db_error'] = check.error if hasattr(check, 'error') else None
        return bool(check and check.data)
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        st.error(f"Registration error: {e}")
        return False

def verify_login(email: str, password: str) -> Optional[Dict]:
    try:
        email_norm = (email or "").strip().lower()
        password_hash = hash_password(password or "")
        response = supabase.table('users').select('*').eq('email', email_norm).execute()
        st.session_state['last_db_response'] = response.data if hasattr(response, 'data') else None
        st.session_state['last_db_error'] = response.error if hasattr(response, 'error') else None
        if not response or not response.data:
            return None
        user_row = response.data[0]
        stored_hash = (user_row.get('password_hash') or "").strip()
        if stored_hash and stored_hash == password_hash:
            return user_row
        else:
            return None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        st.error(f"Login error: {e}")
        return None

def update_user_activity(email: str):
    try:
        supabase.table('users').update({'last_active': datetime.now().isoformat()}).eq('email', email).execute()
    except Exception:
        pass

def create_task(email: str, title: str, category: str, points: int, deadline: datetime, description: str = ""):
    try:
        if deadline.tzinfo is not None:
            deadline = deadline.replace(tzinfo=None)
        result = supabase.table('tasks').insert({
            'email': email,
            'title': title,
            'category': category,
            'points': points,
            'deadline': deadline.isoformat(),
            'description': description,
            'is_completed': False,
            'created_at': datetime.now().isoformat()
        }).execute()
        st.session_state['last_db_response'] = result.data if hasattr(result, 'data') else result
        st.session_state['last_db_error'] = result.error if hasattr(result, 'error') else None
        if getattr(result, "error", None):
            return False
        if result.data and len(result.data) > 0:
            return result.data[0]
        try:
            recent = supabase.table('tasks').select('*').eq('email', email).eq('title', title).order('created_at', desc=True).limit(5).execute()
            if recent and recent.data:
                now = datetime.now()
                for r in recent.data:
                    created = parse_iso_naive(r.get('created_at')) or None
                    if created and abs((now - created).total_seconds()) <= 120:
                        return r
                return recent.data[0]
        except Exception:
            pass
        return True
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        st.error(f"Error creating task: {e}")
        return False

def get_tasks(email: str, completed: bool = False):
    try:
        response = supabase.table('tasks').select('*').eq('email', email).eq('is_completed', completed).order('deadline').execute()
        if response and response.data:
            return response.data
        return []
    except Exception:
        return []

def _get_task_row(task_key):
    try:
        if task_key is None:
            return None
        try:
            task_key_int = int(task_key)
        except Exception:
            task_key_int = None
        if task_key_int is not None:
            resp = supabase.table('tasks').select('*').eq('task_id', task_key_int).execute()
            if resp and resp.data:
                return resp.data[0]
        resp2 = supabase.table('tasks').select('*').eq('task_id', task_key).execute()
        if resp2 and resp2.data:
            return resp2.data[0]
        if task_key_int is not None:
            resp3 = supabase.table('tasks').select('*').eq('id', task_key_int).execute()
            if resp3 and resp3.data:
                return resp3.data[0]
        resp4 = supabase.table('tasks').select('*').eq('id', task_key).execute()
        if resp4 and resp4.data:
            return resp4.data[0]
        resp_all = supabase.table('tasks').select('*').eq('email', st.session_state.get('user_email')).order('created_at', desc=True).limit(20).execute()
        if resp_all and resp_all.data:
            for r in resp_all.data:
                if str(task_key) in json.dumps(r, default=str):
                    return r
    except Exception:
        pass
    return None

def _apply_task_update_by_pk(pk_val, pk_col, payload):
    try:
        res = supabase.table('tasks').update(payload).eq(pk_col, pk_val).execute()
        st.session_state['last_db_response'] = getattr(res, 'data', res)
        st.session_state['last_db_error'] = getattr(res, 'error', None)
        return getattr(res, 'error', None) is None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return False

def complete_task(task_id, email, points):
    try:
        success = False
        try:
            pk_int = int(task_id)
        except Exception:
            pk_int = None
        if pk_int is not None:
            res = supabase.table('tasks').update({
                'is_completed': True,
                'completed_at': datetime.now().isoformat()
            }).eq('task_id', pk_int).execute()
            st.session_state['last_db_response'] = getattr(res, 'data', res)
            st.session_state['last_db_error'] = getattr(res, 'error', None)
            if not getattr(res, 'error', None):
                success = True
        if not success:
            task_row = _get_task_row(task_id)
            if not task_row:
                st.session_state['last_db_error'] = f"Unable to locate task {task_id}"
                st.error("Task not found.")
                return False
            pk_col = 'id' if 'id' in task_row else 'task_id'
            pk_val = task_row.get(pk_col)
            success = _apply_task_update_by_pk(pk_val, pk_col, {'is_completed': True, 'completed_at': datetime.now().isoformat()})
            if not success:
                st.error("Failed to mark task completed.")
                return False
        user_response = supabase.table('users').select('total_points').eq('email', email).execute()
        current_points = 0
        if user_response and getattr(user_response, 'data', None):
            current_points = user_response.data[0].get('total_points', 0) or 0
        new_points = current_points + (points or 0)
        new_level = (new_points // 100) + 1
        update_user_res = supabase.table('users').update({'total_points': new_points, 'level': new_level, 'last_active': datetime.now().isoformat()}).eq('email', email).execute()
        st.session_state['last_db_response'] = getattr(update_user_res, 'data', update_user_res)
        st.session_state['last_db_error'] = getattr(update_user_res, 'error', None)

        # Always try to log activity and update user_points (non-fatal)
        try:
            # fetch task title for activity description (best effort)
            task_row_for_log = _get_task_row(task_id)
            title = task_row_for_log.get('title') if task_row_for_log else f"task {task_id}"
            log_activity(email, f"Completed task: {title}", points or 0)
            update_user_points(email, points or 0)
        except Exception:
            # ignore activity/log errors but record them
            pass

        # If DB update failed due to RLS/permissions, keep the app consistent by updating the local user state
        if getattr(update_user_res, 'error', None):
            st.warning("Unable to persist XP update to database. Value updated locally for this session.")

        if 'user_data' in st.session_state and st.session_state['user_data']:
            st.session_state['user_data']['total_points'] = int(new_points)
            st.session_state['user_data']['level'] = int(new_level)

        return {"ok": True, "new_points": int(new_points), "new_level": int(new_level)}
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        st.error(f"Error completing task: {e}")
        return False

def delete_task(task_id):
    try:
        try:
            pk_int = int(task_id)
        except Exception:
            pk_int = None
        if pk_int is not None:
            res = supabase.table('tasks').delete().eq('task_id', pk_int).execute()
            st.session_state['last_db_response'] = getattr(res, 'data', res)
            st.session_state['last_db_error'] = getattr(res, 'error', None)
            if not getattr(res, 'error', None):
                return True
        task_row = _get_task_row(task_id)
        if not task_row:
            st.session_state['last_db_error'] = f"Unable to locate task {task_id}"
            return False
        pk_col = 'id' if 'id' in task_row else 'task_id'
        pk_val = task_row.get(pk_col)
        del_res = supabase.table('tasks').delete().eq(pk_col, pk_val).execute()
        st.session_state['last_db_response'] = getattr(del_res, 'data', del_res)
        st.session_state['last_db_error'] = getattr(del_res, 'error', None)
        return getattr(del_res, 'error', None) is None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        st.error(f"Delete failed: {e}")
        return False

def get_leaderboard(limit: int = 10):
    try:
        response = supabase.table('users').select('name, avatar_url, level, total_points, email').order('total_points', desc=True).limit(limit).execute()
        return response.data
    except Exception:
        return []

def update_user_profile(email: str, name: Optional[str] = None, avatar: Optional[str] = None, bio: Optional[str] = None, preferred_categories: Optional[List[str]] = None):
    """
    Try to update provided user profile fields.
    Returns: {"ok": bool, "not_saved": [fields]} where not_saved lists any fields that could not be updated.
    """
    try:
        # Build initial payload from provided values
        payload = {}
        if name is not None:
            payload['name'] = name
        if avatar is not None:
            payload['avatar_url'] = avatar
        if bio is not None:
            payload['bio'] = bio
        if preferred_categories is not None:
            payload['preferred_categories'] = json.dumps(preferred_categories)

        if not payload:
            return {"ok": False, "not_saved": []}

        # Try to update. On missing-column errors, remove offending keys and retry.
        attempt_payload = dict(payload)
        not_saved = []
        while attempt_payload:
            res = supabase.table('users').update(attempt_payload).eq('email', email).execute()
            st.session_state['last_db_response'] = getattr(res, 'data', res)
            st.session_state['last_db_error'] = getattr(res, 'error', None)

            # success -> done
            if not getattr(res, 'error', None):
                # any originally requested fields that were not in attempt_payload are "not saved"
                for k in payload.keys():
                    if k not in attempt_payload:
                        not_saved.append(k)
                return {"ok": True, "not_saved": not_saved}

            # If error indicates missing column(s), parse and remove them then retry
            err = getattr(res, 'error', None)
            msg = ""
            if isinstance(err, dict):
                msg = err.get('message', '') or str(err)
            else:
                msg = str(err)

            # find missing column name(s) in message (PostgREST uses "Could not find the 'col' column" pattern)
            missing = re.findall(r"Could not find the '([^']+)' column", msg)
            if not missing:
                # can't handle this error automatically; return failure with message
                return {"ok": False, "not_saved": list(payload.keys())}
            # remove missing columns and add to not_saved list
            for col in missing:
                if col in attempt_payload:
                    attempt_payload.pop(col, None)
                    not_saved.append(col)
            # loop will retry with reduced payload

        # if we get here there was nothing to update (all removed)
        return {"ok": False, "not_saved": list(payload.keys())}
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return {"ok": False, "not_saved": list(payload.keys())}

def log_activity(email: str, action: str, points: int = 0):
    """Insert a row into activity_log (non-fatal on error)."""
    try:
        payload = {
            "email": email,
            "action": action,
            "points_earned": int(points or 0),
            "timestamp": datetime.now().isoformat()
        }
        res = supabase.table('activity_log').insert(payload).execute()
        st.session_state['last_db_response'] = getattr(res, 'data', res)
        st.session_state['last_db_error'] = getattr(res, 'error', None)
        return getattr(res, 'error', None) is None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return False

def update_user_points(email: str, points: int):
    """Upsert today's user_points (daily_points and cumulative_points)."""
    try:
        today = datetime.now().date().isoformat()
        # get today's record
        resp = supabase.table('user_points').select('*').eq('email', email).eq('date', today).execute()
        if resp and resp.data:
            # update existing row (increment)
            record = resp.data[0]
            new_daily = (record.get('daily_points') or 0) + int(points or 0)
            new_cum = (record.get('cumulative_points') or 0) + int(points or 0)
            upd = supabase.table('user_points').update({
                'daily_points': new_daily,
                'cumulative_points': new_cum
            }).eq('record_id', record.get('record_id')).execute()
            st.session_state['last_db_response'] = getattr(upd, 'data', upd)
            st.session_state['last_db_error'] = getattr(upd, 'error', None)
            return getattr(upd, 'error', None) is None
        else:
            # compute previous cumulative (latest record) if any
            prev = supabase.table('user_points').select('*').eq('email', email).order('date', desc=True).limit(1).execute()
            prev_cum = 0
            if prev and prev.data:
                prev_cum = prev.data[0].get('cumulative_points') or 0
            new_cum = prev_cum + int(points or 0)
            ins = supabase.table('user_points').insert({
                'email': email,
                'date': today,
                'daily_points': int(points or 0),
                'cumulative_points': new_cum
            }).execute()
            st.session_state['last_db_response'] = getattr(ins, 'data', ins)
            st.session_state['last_db_error'] = getattr(ins, 'error', None)
            return getattr(ins, 'error', None) is None
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return False

# Add: fetch last N days of user_points (fill missing dates with zeros)
def get_user_points_history(email: str, days: int = 30) -> List[Dict]:
    try:
        today = datetime.now().date()
        start = today - timedelta(days=days - 1)
        # fetch rows from start date
        resp = supabase.table('user_points') \
            .select('*') \
            .eq('email', (email or "").strip().lower()) \
            .gte('date', start.isoformat()) \
            .order('date') \
            .execute()
        rows = resp.data if (resp and getattr(resp, 'data', None)) else []
        # map rows by date string
        rows_map = {str(r.get('date')): r for r in rows}
        out = []
        cum = 0
        # build contiguous list for the last `days` days
        for i in range(days):
            d = (start + timedelta(days=i))
            ds = d.isoformat()
            if ds in rows_map:
                r = rows_map[ds]
                daily = int(r.get('daily_points') or 0)
                cum = int(r.get('cumulative_points') or cum + daily)
            else:
                daily = 0
                # cum stays at previous value
            out.append({'date': ds, 'daily_points': daily, 'cumulative_points': cum})
        return out
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return []

# Add: quick helper to fetch today's points (0 if none)
def get_today_points(email: str) -> Dict:
    try:
        today = datetime.now().date().isoformat()
        resp = supabase.table('user_points').select('*').eq('email', (email or "").strip().lower()).eq('date', today).execute()
        if resp and getattr(resp, 'data', None):
            r = resp.data[0]
            return {'daily_points': int(r.get('daily_points') or 0), 'cumulative_points': int(r.get('cumulative_points') or 0)}
        return {'daily_points': 0, 'cumulative_points': 0}
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return {'daily_points': 0, 'cumulative_points': 0}

# Add: fetch recent activity log entries
def get_recent_activity(email: str, limit: int = 30) -> List[Dict]:
    try:
        resp = supabase.table('activity_log').select('*').eq('email', (email or "").strip().lower()).order('timestamp', desc=True).limit(limit).execute()
        return resp.data if (resp and getattr(resp, 'data', None)) else []
    except Exception as e:
        st.session_state['last_db_error'] = str(e)
        return []
