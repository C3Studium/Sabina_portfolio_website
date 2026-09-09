// Kde Studio na tomhle webu bydlí.
//
// Všechno, co administrace potřebuje, je v balíčku — tenhle soubor existuje
// jen proto, aby to mělo adresu. Je to catch-all, takže jedna deklarace pokrývá
// všechny pohledy Studia a ten, který přibude zítra, na nic nezapomene.
//
// Změň titulek, případně přidej `booting` pro jiný text načítací obrazovky.
import { createStudioPage } from '@c3studium/valecms/studio/page.jsx'

export default createStudioPage({ title: 'Studio' })
