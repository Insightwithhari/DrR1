// This is a Vercel Serverless Function. Place it in the `/api` directory of your project.
// It acts as a secure and reliable proxy to the EMBL-EBI BLAST API, solving CORS issues.

const EBI_API_URL = 'https://www.ebi.ac.uk/Tools/services/rest/ncbiblast';

// Helper to parse the request body if it's not pre-parsed by the environment
async function getBody(request: any) {
    if (request.body) {
        return typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }
    const chunks: any[] = [];
    for await (const chunk of request) {
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
}


export default async function handler(request: any, response: any) {
    // Set CORS headers for the response to allow our frontend to call this API
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*'); // Or lock down to a specific origin in production
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const { searchParams } = url;
    const action = searchParams.get('action');
    const jobId = searchParams.get('jobId');

    try {
        if (request.method === 'POST' && action === 'run') {
            const body = await getBody(request);
            const { program, database, sequence } = body;
            
            // EBI API expects form data
            const formData = new URLSearchParams();
            formData.append('email', 'test@example.com'); // Required by EBI API
            formData.append('program', program);
            formData.append('stype', 'protein');
            formData.append('database', database);
            formData.append('sequence', sequence);

            const ebiResponse = await fetch(`${EBI_API_URL}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/plain' },
                body: formData.toString(),
            });

            if (!ebiResponse.ok) {
                const errorText = await ebiResponse.text();
                throw new Error(`EBI API Error (${ebiResponse.status}): ${errorText}`);
            }

            const newJobId = await ebiResponse.text();
            response.status(200).json({ jobId: newJobId });

        } else if (request.method === 'GET' && action === 'status' && jobId) {
            const ebiResponse = await fetch(`${EBI_API_URL}/status/${jobId}`, { headers: { 'Accept': 'text/plain' } });
            if (!ebiResponse.ok) throw new Error(`Failed to check job status. EBI responded with ${ebiResponse.status}`);
            const status = await ebiResponse.text();
            response.status(200).json({ status });

        } else if (request.method === 'GET' && action === 'result' && jobId) {
            const ebiResponse = await fetch(`${EBI_API_URL}/result/${jobId}/json`, { headers: { 'Accept': 'application/json' } });
            if (!ebiResponse.ok) throw new Error(`Failed to fetch BLAST results. EBI responded with ${ebiResponse.status}`);
            const results = await ebiResponse.json();
            response.status(200).json(results);

        } else {
            response.status(400).json({ error: 'Invalid request' });
        }
    } catch (error: any) {
        console.error('[BLAST PROXY ERROR]', error);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
