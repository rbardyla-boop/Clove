import { SOURCE_CATALOG } from '../src/research';

const bodies: Record<string, string> = {
  'statcan-2024': `
    <h1>Electricity supply and disposition, 2024 (preliminary)</h1>
    <p>Canada's total electricity generation in 2024 reached 622.2 million megawatt-hours (MWh).</p>
    <p>Nuclear energy generation fell by 3.9% compared with the previous year to 80.7 million MWh in 2024.</p>
  `,
  'cer-2021': `
    <h1>Canada's Energy Future 2023</h1>
    <p>Nationally, nuclear power generation made up 14% of total electricity generation in 2021.</p>
  `,
};

export function fixtureFetcher(input: string): Promise<Response> {
  const source = SOURCE_CATALOG.find((candidate) => candidate.url === input);
  if (!source) return Promise.resolve(new Response('not found', { status: 404 }));
  return Promise.resolve(new Response(bodies[source.id], {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }));
}
