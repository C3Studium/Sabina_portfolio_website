// Každá serverová operace CMS na jedné catch-all routě.
//
// Jedna routa místo souboru na endpoint proto, že rozhodnutí o přihlášení,
// mapování chyb a limit velikosti těla jsou pro všechny stejné — a rozdělit je
// znamená opsat to na patnácti místech.
//
// `registerSchemas` místo přímého importu typů: registr odmítá duplicity
// záměrně a hot reload tenhle modul vyhodnotí znovu.
import type { NextApiRequest, NextApiResponse } from 'next'

import '@c3studium/valecms/server/registerSchemas.js'
import { handleCmsRequest } from '@c3studium/valecms/server/handlers/index.js'

export const config = {
    api: {
        // Vypnuto ze dvou důvodů: nahrávaná média chodí jako syrové bajty
        // a každé jiné tělo dostane vlastní limit v handlers/http.js.
        bodyParser: false,
    },
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    return handleCmsRequest(req, res)
}
