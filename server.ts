//import express, { Request, Response } from 'express';
import express from 'express';
import type { Request, Response } from 'express';

import path from 'path';
import fs from 'fs';

//import dns from 'dns';  // for at cache dns opslag, kan ikke lade sige gøre fordi ip-adr hoster mange under domæner
// --- ØVERST I FILEN (DNS Cache opsætning) ---
import dns from 'node:dns/promises';
// 1. Undgå IPv6 timeout
dns.setDefaultResultOrder('ipv4first');


/* duer ikke, idet bjarnephys.com ikke har fast op-adr, eller rettere ip-adr har mange under domænes

const DNS_TTL = 5 * 60 * 1000; // 5 minutter
const dnsCache = new Map<string, { address: string; expires: number }>();

async function cachedLookup(hostname: string): Promise<string> {
  const now = Date.now();
  const cached = dnsCache.get(hostname);

  if (cached && cached.expires > now) {
    console.log(`⚡ DNS CACHE ${hostname} → ${cached.address}`);
    return cached.address;
  }

  const result = await dns.lookup(hostname, { family: 4 });
  console.log(`🌐 DNS LOOKUP ${hostname} → ${result.address}`);

  dnsCache.set(hostname, {
    address: result.address,
    expires: now + DNS_TTL,
  });

  return result.address;
}
*/

import { Agent, setGlobalDispatcher } from 'undici';
// 2. Opret en Undici Agent med udvidet Keep-Alive, så undgås TLS-handshakeing hver gang, første req 1400ms, næste 800ms
const keepAliveAgent = new Agent({
  connections: 10,           // Max samtidige forbindelser
  pipelining: 1,
  keepAliveTimeout: 60000,   // Hold forbindelsen åben i 60 sekunder
  keepAliveMaxTimeout: 60000
});
// Sæt den som standard for al fetch i Node.js
setGlobalDispatcher(keepAliveAgent);
/*
//import dnscache from 'dnscache'; // kan ikke importe, i øvrigt gl løsning

// Aktiver automatisk DNS-caching i Node.js
dnscache({
  enable: true,
  ttl: 300,      // Gem DNS-svar i 5 minutter (300 sekunder)
  cachesize: 1000
});
*/





import { fileURLToPath } from 'url';
import {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  toggleSettledTransaction,
  resetDatabase,
} from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

const db_choice = 'php';
const phpBaseUrl = 'https://bjarnephys.com/MySQL/transactions.php';
// --- REST API ENDPOINTS ---


// 1. GET /api/transactions (with optional filters)
// Mærk dig "async" ud for (req: Request, res: Response)
app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    
    const t0 = performance.now(); // Start
    const { type, category, search } = req.query;

 
    
    if (db_choice === 'php') {
      /*
      const hostname = 'bjarnephys.com';
      // 1. Hent IP via vores egen cache (eller lav opslag hvis cache er udløbet)
      const t_dns_start = performance.now();
      const ipAddress = await cachedLookup(hostname);
      const t_dns_end = performance.now();
      */
      // 2. Byg URL'en ved at erstatte domænet med IP-adressen
      //let url = `https://${ipAddress}/MySQL/transactions.php`;  //duer ikke, 
      let url =  phpBaseUrl;
      
      const query: string[] = [];

      if (typeof req.query.type === 'string') {
        query.push(`type=${encodeURIComponent(req.query.type)}`);
      }
      if (typeof req.query.category === 'string') {
        query.push(`category=${encodeURIComponent(req.query.category)}`);
      }
      if (typeof req.query.search === 'string') {
        query.push(`search=${encodeURIComponent(req.query.search)}`);
      }
      if (query.length > 0) {
        url += '?' + query.join('&');
      }
      const t1 = performance.now(); // Lige før HTTP fetch
      const response = await fetch(url);
      const t2 = performance.now(); // Svar modtaget over netværket

      if (!response.ok) {
        throw new Error(`PHP API svarede med status ${response.status}`);
      }

      const result = await response.json();
      const t3 = performance.now(); // JSON parsed

      // Tider udregnet i Node
      // Tider udregnet i Node
      //const dns_time          = (t_dns_end - t_dns_start).toFixed(2);
      const network_roundtrip = (t2 - t1).toFixed(2);
      const json_parse_time   = (t3 - t2).toFixed(2);
      const node_total        = (t3 - t0).toFixed(2);

      // Udskriv det samlede tidsforløb i konsollen
      console.log('--- 📊 TIDSFORLØB FOR GET-REQUEST ---');
      //console.log(`1. DNS opslag / Cache:       ${dns_time} ms`);
      console.log(`1. Node forberedelse:        ${(t1 - t0).toFixed(2)} ms`);
      console.log(`2. Netværk tur/retur (HTTP): ${network_roundtrip} ms`);
      if (result._debug) {
        console.log(`   ├── PHP DB Forbindelse:   ${result._debug.php_db_connect_ms} ms`);
        console.log(`   ├── PHP SQL Forespørgsel: ${result._debug.php_query_ms} ms`);
        console.log(`   └── PHP Samlet tid:       ${result._debug.php_total_ms} ms`);
      }
      console.log(`3. Node JSON Parsing:        ${json_parse_time} ms`);
      console.log(`-----------------------------------`);
      console.log(`⏱️ SAMLET TID (Node total):  ${node_total} ms\n`);

      // Send kun selve data-arrayet videre til frontenden
      res.json(result.data || result);

    }
    
    else {
      // Synkron SQLite-gren
      const transactions = getAllTransactions({
        type: typeof type === 'string' ? type : undefined,
        category: typeof category === 'string' ? category : undefined,
        search: typeof search === 'string' ? search : undefined,
      });

      const duration = (performance.now() - t0).toFixed(2);
      console.log(`⏱️ Hentede ${transactions.length} transaktioner fra SQLite på ${duration} ms`);

      res.json(transactions);
    }
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});




// 2. GET /api/transactions/:id
app.get('/api/transactions/:id', async(req: Request, res: Response) => {

  try{ 
    const t0 = performance.now(); // Start
    if (db_choice === 'php') {
      let url =  phpBaseUrl;
  
      const query: string[] = [];

      if (typeof req.params.id === 'string') {
        query.push(`id=${encodeURIComponent(req.params.id)}`);
      }

       if (query.length > 0) {
        url += '?' + query.join('&');
      }

      console.log('url', url);
      
      const t1 = performance.now(); // Lige før HTTP fetch
      const response = await fetch(url);
      const t2 = performance.now(); // Svar modtaget over netværket

      
      if (!response.ok) {
        throw new Error(`PHP API svarede med status ${response.status}`);
      }

      const result = await response.json();
      const t3 = performance.now(); // JSON parsed

      // Tider udregnet i Node
      // Tider udregnet i Node
     
      const network_roundtrip = (t2 - t1).toFixed(2);
      const json_parse_time   = (t3 - t2).toFixed(2);
      const node_total        = (t3 - t0).toFixed(2);

      // Udskriv det samlede tidsforløb i konsollen
      console.log('--- 📊 TIDSFORLØB FOR REQUEST ---');
     
      console.log(`1. Node forberedelse:        ${(t1 - t0).toFixed(2)} ms`);
      console.log(`2. Netværk tur/retur (HTTP): ${network_roundtrip} ms`);
      if (result._debug) {
        console.log(`   ├── PHP DB Forbindelse:   ${result._debug.php_db_connect_ms} ms`);
        console.log(`   ├── PHP SQL Forespørgsel: ${result._debug.php_query_ms} ms`);
        console.log(`   └── PHP Samlet tid:       ${result._debug.php_total_ms} ms`);
      }
      console.log(`3. Node JSON Parsing:        ${json_parse_time} ms`);
      console.log(`-----------------------------------`);
      console.log(`⏱️ SAMLET TID (Node total):  ${node_total} ms\n`);

      // Send kun selve data-arrayet videre til frontenden
      res.json(result.data || result);
  } 

  else{
    const startTime = performance.now();
    const transaction = getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`⏱️ Hentede een transaktion på ${duration} ms`);
   }
  } catch (error: any) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
 

});

// 3. POST /api/transactions
app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const t0 = performance.now();

    if (db_choice === 'php') {
      const response = await fetch(phpBaseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      const responseText = await response.text();
      console.log('responseText (rå):', responseText);
      console.log('response:', response);

      let result: any = {};
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        // Hvis der er støj efter JSON, prøver vi at finde det første { eller [
        try {
          const jsonStart = responseText.search(/[\{\[]/);
          const jsonEnd = Math.max(responseText.lastIndexOf('}'), responseText.lastIndexOf(']'));
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
            result = JSON.parse(cleanJson);
            console.log('⚠️ Renset JSON succesfuldt ud af støj fra PHP!');
          } else {
            throw new Error('Ingen gyldig JSON fundet i svaret');
          }
        } catch (innerErr) {
          result = { error: 'Ugyldigt svar fra PHP: ' + responseText };
        }
      } 

      if (!response.ok) {
        return res.status(response.status).json({ error: result.error || 'Fejl ved oprettelse' });
      }

      const duration = (performance.now() - t0).toFixed(2);
      console.log(`✨ Oprettet transaktion via PHP-API på ${duration} ms`);

      res.json({ success: true, ...result });
    } else {
      // SQLite-gren
      const newTx = createTransaction(req.body);
      res.json({ success: true, transaction: newTx });
    }
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// 4. PUT /api/transactions/:id, til updatering
app.put('/api/transactions/:id', async(req: Request, res: Response) => {
  try {

    const t0 = performance.now();

    if (db_choice === 'php') {
      const t1 = performance.now(); // Lige før HTTP fetch
      const response = await fetch(phpBaseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
     
      const responseText = await response.text();
      const t2 = performance.now(); // Svar modtaget over netværket
      const network_roundtrip = (t2 - t1).toFixed(2);
      console.log('responseText (rå):', responseText);
      console.log('response:', response);

      let result: any = {};
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        // Hvis der er støj efter JSON, prøver vi at finde det første { eller [
        try {
          const jsonStart = responseText.search(/[\{\[]/);
          const jsonEnd = Math.max(responseText.lastIndexOf('}'), responseText.lastIndexOf(']'));
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
            result = JSON.parse(cleanJson);
            console.log('⚠️ Renset JSON succesfuldt ud af støj fra PHP!');
          } else {
            throw new Error('Ingen gyldig JSON fundet i svaret');
          }
        } catch (innerErr) {
          result = { error: 'Ugyldigt svar fra PHP: ' + responseText };
        }
      } 

      if (!response.ok) {
        return res.status(response.status).json({ error: result.error || 'Fejl ved oprettelse' });
      }

      const duration = (performance.now() - t0).toFixed(2);
      
      console.log(`✨ Opdateret transaktion via PHP-API på ${duration} ms`);
      console.log(`🌐 Netværksrundtrip: ${network_roundtrip} ms`);

      res.json({ success: true, ...result });
    } else {
      // SQLite-gren
    const updated = updateTransaction(req.params.id, req.body);
    
    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(updated);
    }
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});


app.get('/api/transactions/delete/:id', async (req: Request, res: Response) => {
// kan kaldes i browseren med http://localhost:3000/api/transactions/delete/tx-123 
  try {
    const t0 = performance.now();
    const id = req.params.id;

    if (db_choice === 'php') {
      // Byg URL med ID som query-parameter
      const url = `${phpBaseUrl}?id=${encodeURIComponent(id)}`;

      const t1 = performance.now();
      const response = await fetch(url, {
        method: 'DELETE', // Sætter HTTP-metoden til DELETE, selve url'en er som get een id
      });
      const t2 = performance.now();

      // Læs svaret som rå tekst først (så vi ikke crasher, hvis PHP sender plain text eller tomt svar)
      //const responseText = await response.text();
     
      const responseText = await response.text();
      console.log('responseText (rå):', responseText);
      console.log('response:', response);

      
      //throw new Error(`PHP API svarede med status ${response.status}`);


      let result: any = {};
      try {
        result = JSON.parse(responseText);  //json der afsendes fra PHP 
      } catch (e) {
        // Hvis der er støj efter JSON, prøver vi at finde det første { eller [
        try {
          const jsonStart = responseText.search(/[\{\[]/);
          const jsonEnd = Math.max(responseText.lastIndexOf('}'), responseText.lastIndexOf(']'));
          
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
            result = JSON.parse(cleanJson);
            console.log('⚠️ Renset JSON succesfuldt ud af støj fra PHP!');
          } else {
            throw new Error('Ingen gyldig JSON fundet i svaret');
          }
        } catch (innerErr) {
          result = { error: 'Ugyldigt svar fra PHP: ' + responseText };
        }
      } 
      
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'Transaction not found' });
        }
        const errorMessage = result.error || `PHP API svarede med status ${response.status}`;
        console.error(`❌ PHP Fejl (${response.status}):`, errorMessage);
        return res.status(response.status).json({ error: errorMessage });
        //throw new Error(`PHP API svarede med status ${response.status}`);
      }

      const duration = (performance.now() - t0).toFixed(2);
      
      console.log(`🗑️ Slettet transaktion (${id}) via PHP-API på ${duration} ms`);

      res.json({ success: true, ...result }); //res udskrives i browseren 

    } 
    
    else {
      // SQLite-gren, kalder metoder i db.ts som bruges i frontend 
      const success = deleteTransaction(id);
      if (!success) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const duration = (performance.now() - t0).toFixed(2);
      console.log(`⏱️ Slettet transaktion fra SQLite på ${duration} ms`);

      res.json({ success: true });
    }
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});



// 3. DELETE /api/transactions/:id,  metoden er angivet med foranstillet delete, kan ikke kaldes fra browseren 
app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const t0 = performance.now();
    const id = req.params.id;

    if (db_choice === 'php') {
      // Byg URL med ID som query-parameter
      const url = `${phpBaseUrl}?id=${encodeURIComponent(id)}`;

      const t1 = performance.now();
      const response = await fetch(url, {
        method: 'DELETE', // Sætter HTTP-metoden til DELETE, selve url'en er som get een id
      });
      const t2 = performance.now();

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'Transaction not found' });
        }
        throw new Error(`PHP API svarede med status ${response.status}`);
      }

      const result = await response.json();
      const duration = (performance.now() - t0).toFixed(2);
      
      console.log(`🗑️ Slettet transaktion (${id}) via PHP-API på ${duration} ms`);

      res.json({ success: true, ...result });

    } 
    
    else {
      // SQLite-gren
      const success = deleteTransaction(id);
      if (!success) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const duration = (performance.now() - t0).toFixed(2);
      console.log(`⏱️ Slettet transaktion fra SQLite på ${duration} ms`);

      res.json({ success: true });
    }
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// 6. PATCH /api/transactions/:id/settled
app.patch('/api/transactions/:id/settled', (req: Request, res: Response) => {
  try {
    const updated = toggleSettledTransaction(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(updated);
  } catch (error: any) {
    console.error('Error toggling settled state:', error);
    res.status(500).json({ error: 'Failed to update settled state' });
  }
});

// 7. POST /api/transactions/reset
app.post('/api/transactions/reset', (_req: Request, res: Response) => {
  try {
    const resetList = resetDatabase();
    res.json({ message: 'Database reset to initial test transactions', data: resetList });
  } catch (error: any) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// 8. GET /api/export/csv (CSV Export Endpoint)
app.get('/api/export/csv', (req: Request, res: Response) => {
  try {
    const { type, category } = req.query;
    const transactions = getAllTransactions({
      type: typeof type === 'string' ? type : undefined,
      category: typeof category === 'string' ? category : undefined,
    });

    const headers = [
      'ID',
      'Dato',
      'Beskrivelse',
      'Type',
      'Kategori',
      'Beloeb_DKK',
      'Er_Delt',
      'Antal_Personer',
      'Din_Andel_DKK',
      'Afregnet'
    ];

    const rows = transactions.map((t) => {
      const yourShare = t.is_shared && t.split_between_count && t.split_between_count > 0
        ? (t.amount / t.split_between_count).toFixed(2)
        : t.amount.toFixed(2);

      return [
        `"${t.id}"`,
        `"${t.date}"`,
        `"${t.title.replace(/"/g, '""')}"`,
        `"${t.type}"`,
        `"${t.category.replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        t.is_shared ? 'Ja' : 'Nej',
        t.is_shared ? (t.split_between_count || 1) : 1,
        yourShare,
        t.settled ? 'Ja' : 'Nej'
      ].join(',');
    });

    const csvData = [headers.join(','), ...rows].join('\r\n');
    const today = new Date().toISOString().split('T')[0];

    // UTF-8 BOM + CSV content
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="campuscash_export_${today}.csv"`);
    res.send(bom + csvData);
  } catch (error: any) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

// --- FRONTEND INTEGRATION (Vite Dev Server / Static Production) ---
async function startServer() {
  if (!isProduction) {
    // Dynamic import of Vite in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }

      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production: serve built static files from dist
    console.log(`prod udgave opstartet`);
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.use('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CampusCash backend server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
