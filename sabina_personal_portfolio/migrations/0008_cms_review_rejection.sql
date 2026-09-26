-- Rejecting a review stops deleting it — cms_document_revision.reason gains
-- 'reject' and 'requeue'.
--
-- Run after 0007_cms_archive.sql (Supabase SQL editor, or psql with the
-- connection string from Project Settings -> Database). Re-runnable: the
-- constraint is dropped before it is created and the index is created with
-- IF NOT EXISTS.
--
-- Numbered 0008 because 0007 is the highest that exists.
--
-- ---------------------------------------------------------------------------
-- What was happening before this, stated plainly
-- ---------------------------------------------------------------------------
-- studio/views/ModerationView.jsx `reject()` called `port.remove()`. Rejecting a
-- review DELETED the row. The only way back was a toast button that lived 7.5
-- seconds and re-created the document with a new id, so it was not the same
-- record even when somebody caught it. `r` was bound on window with no modifier
-- and no confirmation.
--
-- That is a data-loss bug on its own. It is also a legal exposure: these are
-- consumer reviews, and the Omnibus amendment to zákona o ochraně spotřebitele
-- requires a business that publishes them to be able to account for how it
-- handles them, and specifically not to suppress unfavourable ones. A deleted
-- review is not evidence of good moderation and not evidence of bad moderation —
-- it is no evidence at all, which is the worst position to be in when asked.
-- Keeping the rejection, with who and when and why, is the thing that shows the
-- queue is not being cherry-picked.
--
-- ---------------------------------------------------------------------------
-- Why this migration is four lines and not a table
-- ---------------------------------------------------------------------------
-- Nothing new is needed to hold a rejection. `archived_at` (0003) already is the
-- orthogonal withdrawal column: it is filtered out of the public read path, it
-- is denied to anon by the RLS policy, it is type-agnostic, and 0003's header
-- argues at length why it is a column instead of a third `status`. A rejected
-- review is an archived document. What was missing was only the REASON, and the
-- reason has two halves that live in two places on purpose:
--
--   the document body   rejectedAt, rejectedBy, rejectedReason — written into
--                       `draft` by server/documents.js reject(). Editable-shaped
--                       data an editor reads, and the thing the rejected queue
--                       filters on: `draft->>'rejectedAt' is not null`, one
--                       predicate whether the body sat in `draft` or in `data`.
--
--   the revision        reason = 'reject', with changed_by and changed_at.
--                       Append-only, owner-only, and nothing in the application
--                       updates it. This is the half that is evidence: a body
--                       field can be edited by whoever is holding the mouse, and
--                       a row in cms_document_revision cannot.
--
-- Body fields rather than columns because rejection is moderation and moderation
-- is a fact about reviews. cms_document has stayed type-agnostic — 0003 names no
-- type, which is how one migration gave archiving to every content type — and
-- three columns for one type's workflow would be the first crack in that.
--
-- ---------------------------------------------------------------------------
-- The two new transitions
-- ---------------------------------------------------------------------------
-- `reject`   archive + stamp. The review leaves the pending queue, cannot reach
--            the public site (it is archived AND unpublished AND approved is
--            false), and keeps its id.
-- `requeue`  the way back: clears archived_at and the three stamps, so the same
--            id is pending again. Not `restore`, which deliberately leaves a
--            document exactly as it was filed — right for a consultant somebody
--            archived, wrong for a decision being taken back.
--
-- The revision the rejection wrote is NOT removed by a requeue. Taking a
-- decision back does not unmake the fact that it was taken, and a ledger that
-- empties when you press the button twice is not evidence.
--
-- Both are transitions in handlers/documents.js beside the original four, which
-- is where revalidation and the revision write already hang, so neither needed a
-- second place to be remembered.

-- ---------------------------------------------------------------------------
-- reason
-- ---------------------------------------------------------------------------
-- Still the transition's name and still not free text — 0007's header is right
-- that a note column collects prose and stops being answerable. "Which of the
-- fixed reasons" lives in the body as `rejectedReason` (schemas/review.js holds
-- the list) and is a closed set for the same argument.

alter table public.cms_document_revision
  drop constraint if exists cms_document_revision_reason_check;

alter table public.cms_document_revision
  add constraint cms_document_revision_reason_check
  check (reason in ('publish', 'unpublish', 'archive', 'restore', 'reject', 'requeue'));

-- ---------------------------------------------------------------------------
-- The rejected queue's index
-- ---------------------------------------------------------------------------
-- The Studio's third moderation tab is `archived_at is not null and
-- draft->>'rejectedAt' is not null`, ordered by the rejection date. Partial on
-- exactly that predicate, for the reason 0003 and 0007 both give: Postgres uses
-- a partial index only for a query whose WHERE clause it can prove the index
-- covers, so the predicate is repeated here rather than the column indexed on
-- its own.

create index if not exists cms_document_rejected_idx
  on public.cms_document ((draft->>'rejectedAt') desc)
  where archived_at is not null and (draft->>'rejectedAt') is not null;

-- ---------------------------------------------------------------------------
-- What this migration deliberately does NOT do
-- ---------------------------------------------------------------------------
-- No backfill, and here that is not a technical limitation but the honest
-- answer: every review rejected before today was deleted, and there is no row
-- left to stamp. The rejection ledger starts empty and fills forward, exactly as
-- 0007's revisions do.
--
-- No change to the anon grant or to the policy. A rejected review is archived,
-- and 0003's policy already denies anon every row with a non-null `archived_at`
-- — before the site's own filter, before `getApprovedReviews`, before anything
-- in JavaScript gets a say. The three stamps are in `draft`, which has never
-- been in the anon grant at all.
