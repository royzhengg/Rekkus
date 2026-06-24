# Social Permissions

- `social_events`: users may select their own target events and update only their own `read_at`.
- `notification_deliveries`: service role only.
- `privacy_audit_events`: no direct client writes.
- `follow_requests`: users may select their own incoming/outgoing requests; mutations go through RPCs.
- `follows`: approved relationship truth; writes go through service/RPC paths when request state is involved.

Every `SECURITY DEFINER` social RPC must set `search_path = public` and enforce ownership with `auth.uid()`.

