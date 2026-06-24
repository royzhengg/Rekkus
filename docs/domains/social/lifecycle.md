# Social Lifecycle

## Follow Requests

```text
pending
 ├─ approve/manual      -> approved
 ├─ approve/bulk        -> approved
 ├─ approve/auto_public -> approved
 ├─ decline             -> declined
 ├─ requester_cancel    -> cancelled
 └─ block               -> declined or cancelled, hidden from Alerts

approved  -> terminal
declined  -> terminal
cancelled -> terminal
```

Pending follow requests do not expire today.

## Relationship Resolution

```text
blocked
following
incoming_request
requested
none
```

Use the relationship RPC/view instead of ad hoc table checks in UI code.

