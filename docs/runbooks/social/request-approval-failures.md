# Request Approval Failures

1. Check the request row in `follow_requests`.
2. Confirm target ownership and block state.
3. Check RPC audit records in `follow_request_audit_events`.
4. If the request is approved but an event is missing, rebuild `social_events` from `follow_requests`.
5. Never create a `follows` row without an audit record.

