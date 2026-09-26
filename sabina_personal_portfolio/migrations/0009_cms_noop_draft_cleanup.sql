-- Clear the drafts that are copies of what is already published.
--
-- Run after 0008_cms_review_rejection.sql (Supabase SQL editor, or psql with the
-- connection string from Project Settings -> Database). Re-runnable and safe to
-- run twice: the second run matches nothing.
--
-- Numbered 0009 because 0008 is the highest that exists.
--
-- NOT A SCHEMA CHANGE. No column, index, constraint or policy moves. This is a
-- one-time repair of rows that the code above it can no longer create, and it is
-- written as a migration only because a production store cannot be repaired from
-- a developer's machine.
--
-- ---------------------------------------------------------------------------
-- What it repairs
-- ---------------------------------------------------------------------------
-- Contract 3's invariant is that `draft` is non-null exactly when there is
-- something the public has not seen. Every part of the Studio reads it that way:
-- the state chip (studio/lib/documents.js `stateOf`), the `state = 'edited'`
-- filter (server/query.js `STATE_CONDITIONS`), and the publish dialog on
-- /studio/edit.
--
-- The invariant was never enforced on the way in. `documents.update()` stored
-- whatever body it was handed, including a body identical to `data` — which is
-- what an editor produces by opening a document, reading it and pressing Uložit.
-- Measured on the development store before this: 125 documents, 43 carrying a
-- draft, 10 of those identical to their published body. Every one of the ten
-- showed as pending work that did not exist, and the publish dialog offered them
-- alongside the block the editor had actually changed.
--
-- `documents.update()` now stores no draft for a body that matches `data`, so
-- nothing new arrives in this state. This clears what arrived before that.
--
-- ---------------------------------------------------------------------------
-- Why `draft = data` is the right test
-- ---------------------------------------------------------------------------
-- Both columns are jsonb, and jsonb equality is canonical: key order and
-- whitespace are not part of the value, so two objects with the same keys and
-- the same values are equal whichever way round they were written. That is the
-- same comparison @/cms/core/body.js makes in JavaScript, where it has to be
-- built by hand because JSON.stringify does treat key order as content.
--
-- `status` and `published_at` are not named below, and `data` is not named
-- below. Clearing a draft cannot change what a visitor sees — that is the whole
-- reason this needs no revision and no revalidation, and it is why this file is
-- an UPDATE of one column and nothing else.

update cms_document
   set draft = null
 where draft is not null
   and draft = data;

-- Afterwards, to confirm nothing is left:
--
--   select count(*) from cms_document where draft is not null and draft = data;
--   -- expected: 0
