# DG Clicks Agency OS

## Product model

DG Clicks is client-first. Work is never created in a global project bucket.
The durable hierarchy is:

```text
Workspace -> Client -> Department -> Board -> Task -> Subtask
```

A department is one purchased service for one client. The service catalogue is
closed and centrally defined: SEO, Web Design, Development, Social Media,
Graphic Design, Content Writing, Paid Ads, and Branding. A client can have each
service once, and every department owns its delivery team.

## Data boundaries

- `Client` owns account and relationship information.
- `Department` joins a client to a service and owns delivery membership.
- `Board` will own ordered workflow columns. The default workflow is Backlog,
  To Do, In Progress, Review, and Done, but columns belong to a board rather
  than being embedded in task status constants.
- `Task` will reference its client, department, and board directly. This small
  amount of denormalisation keeps My Tasks, Calendar, and dashboard queries
  indexable in MongoDB; writes will enforce that all three references agree.
- `Subtask` will be a task with a `parentTask` reference, capped at one nesting
  level so scheduling and completion rules stay understandable.
- `TaskTemplate` will describe reusable work. Generated task instances will
  store a template version and an idempotency key so a scheduler can safely
  retry without creating duplicates.
- Comments, attachments, time entries, and activity remain append-oriented
  records instead of growing an unbounded task document.

## Interaction model

The client workspace is the primary navigation context. Departments are
managed inside that workspace; there is no global Projects destination.
Boards will open inside the client/department context, and task details will
open in a right-side sheet so the board position and filters are preserved.

Global surfaces such as My Tasks, Calendar, Reports, and Search are projections
of the same task data, not separate sources of truth. Navigation entries are
only added when their underlying module is complete.

## Delivery order

1. Client service departments and delivery teams.
2. Boards and task core, including the Kanban and task sheet.
3. Recurring templates and idempotent generation.
4. My Tasks, Calendar, dashboard, and global search projections.
5. Files, reporting, team management, and resource-level permissions.

This sequence keeps each release usable and avoids empty navigation or
abstractions with no caller.
