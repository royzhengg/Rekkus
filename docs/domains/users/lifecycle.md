# Users Lifecycle

## 1. Follow Lifecycle

```text
follow requested
 └─ follow_requests row created (status: pending)
     ├─ target approves (manual or bulk)  -> approved
     │   └─ follows row created
     ├─ target declines                   -> declined  (terminal)
     ├─ requester cancels                 -> cancelled (terminal)
     └─ either party blocks               -> declined or cancelled, hidden from Alerts

approved  -> terminal (follow row persists until unfollow)
declined  -> terminal
cancelled -> terminal
```

- Pending requests do not expire automatically.
- `follow_requests` and `follows` are separate tables. Approved state = row in both tables.
- Use the relationship RPC/view to resolve follow state; do not query both tables ad hoc in UI code.

## 2. User Account Lifecycle

```text
sign up / onboarding
 └─ users row created + user_settings row created (atomically)
     └─ onboarding profile step (username, photo, bio)
         └─ active

active
 ├─ self-deactivate  -> deactivated (reversible, access blocked)
 └─ admin ban        -> banned      (terminal for normal flows)
```

- `user_settings` row is always present. Never null-check it without a fallback.

## 3. Privacy Mode Change

```text
public account
 └─ user switches to private
     └─ user_settings.privacy_mode = 'private'
         └─ future follow requests require approval

private account
 └─ user switches to public
     └─ user_settings.privacy_mode = 'public'
         └─ all pending follow_requests auto-approved OR auto-cancelled (atomically via RPC)
         └─ existing follows are retained
```

- The public → private switch does not cancel existing follows — only future requests require approval.
- The private → public switch must atomically resolve all pending requests (approve or cancel). No pending requests should remain after the mode change.
