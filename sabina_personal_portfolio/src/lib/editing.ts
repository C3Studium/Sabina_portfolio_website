// Jsme v editačním rámu Studia (překryv „Upravit" je zapnutý)?
//
// Komponenty se dřív ptaly `Boolean(copy?.docId)`. Jenže `docId` dorazí při
// KAŽDÉM čtení konceptu — a koncept čte i VEŘEJNÁ stránka v prohlížeči
// redaktora: jakmile si otevře Studio, Next dostane cookie draft módu
// (/api/studio/preview, `res.setDraftMode`), platí pro celý web a drží do
// zavření prohlížeče. Hero se pak i na veřejné adrese choval jako v editoru
// (žádný TextMorph, bannery, rámeček nadpisu, náčrt portrétu) — úvod po
// obnovení stránky „nehrál", dokud cookie nezmizela.
//
// Proto se ptáme přímo enginu úprav: příznak zapíná jen efekt v rámu Studia
// s `?edit=1` (valecms edit/arm.js) a withStudio po něm stránku přemountuje,
// takže čtení při renderu je spolehlivé. Na serveru i při hydrataci je
// `false` — stejně jako HTML ze serveru, žádný rozdíl po hydrataci.
//
// `docId` dál slouží anotacím (`editableIn(copy?.docId ?? null)`); mimo rám
// z nich stejně nic nevyjde.

import { isEditMode } from "@c3studium/valecms/edit";

/** `true` jen uvnitř editačního rámu Studia. */
export const inStudio = () => isEditMode();
