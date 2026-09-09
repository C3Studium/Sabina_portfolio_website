-- Cropping a picture without minting a second one — cms_media.source_path, .crop.
--
-- Run after 0009. Re-runnable: every column is added with IF NOT EXISTS.
--
-- ---------------------------------------------------------------------------
-- What this is for
-- ---------------------------------------------------------------------------
-- An editor framing a portrait wants the crop to BE that picture — the same
-- library item, not a near-duplicate sitting beside the original with a name
-- one character different. So the crop rewrites the row's bytes in place: same
-- id, new object, and every document that re-picks it gets the new framing.
--
-- Rewriting bytes in place is normally how an archive rots, and this project
-- has one it is keeping for legislative reasons (0007). Two things stop that
-- here. The original object is never deleted — `source_path` remembers where it
-- is, so a revision from March still resolves to the picture March saw. And a
-- document body carries the asset WHOLE (core/fieldTypes.js: "kept whole in the
-- document so the public site renders without a second lookup"), so an old
-- revision points at the old URL rather than at whatever the row says today.
--
-- ---------------------------------------------------------------------------
-- Why the rectangle is stored at all
-- ---------------------------------------------------------------------------
-- Without it a second crop would crop the crop, and there is no way back to a
-- wider frame — the pixels outside it are gone from the file the editor is
-- looking at. With `source_path` plus `crop`, re-opening the tool shows the
-- ORIGINAL with the previous rectangle drawn on it, so the frame can be widened
-- again, moved, or cleared. That is what makes this feel like a crop handle
-- rather than a destructive edit, and it is the whole reason for two columns
-- instead of none.
--
-- `crop` is {x, y, width, height} in the SOURCE image's own pixels. Not
-- normalised: the source dimensions are already known from the file, integers
-- survive a round trip through JSON unchanged, and sharp's extract() wants
-- pixels anyway.

alter table public.cms_media
  add column if not exists source_path text,
  add column if not exists source_url  text,
  add column if not exists crop        jsonb;

comment on column public.cms_media.source_path is
  'Objekt s původními bajty, když je řádek oříznutý. NULL = řádek je originál.';
comment on column public.cms_media.source_url is
  'Veřejná adresa originálu. Držena vedle source_path, protože seedované řádky '
  'ukazují do /public a nemají objekt v žádném bucketu.';
comment on column public.cms_media.crop is
  'Obdélník {x, y, width, height} v pixelech ORIGINÁLU. NULL = neoříznuto.';

-- Grants are unchanged on purpose: 0001 revoked everything from anon and
-- authenticated on this table and added no policy, so these columns are
-- reachable only by the service role, exactly like the ten before them.
