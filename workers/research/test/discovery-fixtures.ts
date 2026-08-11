const STATCAN_INDEX = [
  {
    productId: 17100005,
    cansimId: null,
    cubeTitleEn: 'Population estimates on July 1, by age and gender',
    frequencyCode: 12,
    cubeStartDate: '2001-01-01T05:00:00Z',
    cubeEndDate: '2025-01-01T05:00:00Z',
    issueDate: '2026-01-15',
    archived: '2',
  },
  {
    productId: 17100009,
    cansimId: null,
    cubeTitleEn: 'Population estimates, quarterly',
    frequencyCode: 9,
    cubeStartDate: '1991-01-01T05:00:00Z',
    cubeEndDate: '2026-04-01T04:00:00Z',
    issueDate: '2026-07-01',
    archived: '2',
  },
  {
    productId: 13100319,
    cansimId: null,
    cubeTitleEn: 'Anthropometry measures of the household population',
    frequencyCode: 18,
    cubeEndDate: '2024-01-01T05:00:00Z',
    archived: '2',
  },
];

const JUSTICE_LOOKUP = `<?xml version="1.0"?><Database>
  <D t="a"><C>C-24.5</C><T>Cannabis Act</T></D>
  <D t="r"><C>SOR/2018-144</C><T>Cannabis Regulations</T></D>
  <D t="r" rep="true"><C>SOR/2018-178</C><T>Cannabis Tracking System Order [Repealed]</T></D>
</Database>`;

const JUSTICE_ACT_HTML = `<!doctype html><html><body>
  <h1 id="wb-cont">Cannabis Act (S.C. 2018, c. 16)</h1>
  <div id="printAll"><a href="/eng/XML/C-24.5.xml">XML</a></div>
  <p id="assentedDate">Act current to 2026-06-17 and last amended on 2026-03-26. <a href="PITIndex.html">Previous Versions</a></p>
  <a href="rpdc.html">Related Provisions</a>
  <p>Shaded provisions are not in force.</p>
</body></html>`;

const JUSTICE_REGULATION_HTML = `<!doctype html><html><body>
  <h1 id="wb-cont">Cannabis Regulations (SOR/2018-144)</h1>
  <div id="printAll"><a href="/eng/XML/SOR-2018-144.xml">XML</a></div>
  <p id="assentedDate">Regulations current to 2026-06-17 and last amended on 2025-03-12. <a href="PITIndex.html">Previous Versions</a></p>
  <a href="rpdc.html">Related Provisions</a>
  <p>Shaded provisions are not in force.</p>
</body></html>`;

const JUSTICE_ACT_XML = `<?xml version="1.0"?><Statute lims:id="76865" lims:current-date="2026-03-31" hasPreviousVersion="true" in-force="yes"><Identification><ShortTitle>Cannabis Act</ShortTitle><Chapter><ConsolidatedNumber>C-24.5</ConsolidatedNumber></Chapter></Identification></Statute>`;
const JUSTICE_REGULATION_XML = `<?xml version="1.0"?><Regulation lims:id="90001" lims:current-date="2026-03-31" hasPreviousVersion="true" in-force="yes"><Identification><ShortTitle>Cannabis Regulations</ShortTitle><ConsolidatedNumber>SOR/2018-144</ConsolidatedNumber></Identification></Regulation>`;

const JUSTICE_ACT_EXTRACTION_XML = `<?xml version="1.0"?><Statute lims:id="76865" lims:current-date="2026-03-31" hasPreviousVersion="true" in-force="yes">
  <Identification><ShortTitle>Cannabis Act</ShortTitle><Chapter><ConsolidatedNumber>C-24.5</ConsolidatedNumber></Chapter></Identification>
  <Body>
    <Section><Label>8</Label><MarginalNote>Possession</MarginalNote><Subsection><Label>(1)</Label>
      <Paragraph><Label>(c)</Label><Text>for a young person to possess cannabis of one or more classes of cannabis the total amount of which, as determined in accordance with Schedule 3, is equivalent to more than 5 g of dried cannabis;</Text></Paragraph>
    </Subsection></Section>
    <Definitions><Definition><DefinedTermEn>young person</DefinedTermEn><Text>for purposes of sections 8, 9 and 12, an individual who is 12 years of age or older but under 18 years of age</Text></Definition></Definitions>
  </Body>
</Statute>`;

const STATCAN_POPULATION_POINTS = [
  { refPerRaw: '2022-07-01', value: '38929902', vectorId: 466668, frequencyCode: 12 },
  { refPerRaw: '2023-07-01', value: '40049088', vectorId: 466668, frequencyCode: 12 },
  { refPerRaw: '2024-07-01', value: '41262329', vectorId: 466668, frequencyCode: 12 },
  { refPerRaw: '2025-07-01', value: '41651653', vectorId: 466668, frequencyCode: 12 },
];

const GAC_MONTHLY_VALUES = [
  993989072, 848139381, 1007666688, 911892727, 954273584, 903213602,
  1042160946, 675120634, 777795044, 813544051, 690746976, 644220964,
];

const GAC_INDEX = `<html><body>
  ${Array.from({ length: 12 }, (_, index) => `<a href="https://www.eics-scei.gc.ca/report-rapport/SWL monthly Exports Report_2025${String(index + 1).padStart(2, '0')}.htm">${index + 1}</a>`).join('\n')}
  <a href="https://international.canada.ca/en/global-affairs/corporate/reports/export-import-controls/administration-2025">Annual report</a>
</body></html>`;
const GAC_ANNUAL = '<html><body>Softwood lumber products exported to the United States totalled 10,631,142,309 board feet in 2025.</body></html>';
const GAC_SCOPE = '<html><body>ECL Item 5105 covers defined softwood lumber products exported to the United States under the monitoring program.</body></html>';
const STATCAN_LUMBER_CONTEXT = '<html><body>2025 total Canadian lumber exports: 28,275.8 thousand cubic metres. The table includes softwood and hardwood and all destinations.</body></html>';

const CROSSREF_ITEMS = [
  {
    DOI: '10.1097/ebp.0000000000002506',
    title: ['Does creatine supplementation improve cognitive function in healthy adults? A systematic review'],
    author: [{ given: 'Socorro', family: 'Shelton' }],
    published: { 'date-parts': [[2025, 8, 27]] },
    type: 'journal-article',
    'container-title': ['Evidence-Based Practice'],
    publisher: 'Wolters Kluwer',
    funder: [{ name: 'Example Research Funder' }],
    update: [{ label: 'Correction', type: 'correction' }],
  },
  {
    DOI: '10.1007/s00726-024-00001-1',
    title: ['Creatine supplementation and cognitive performance in healthy adults: a randomized controlled trial'],
    author: [{ given: 'A.', family: 'Researcher' }, { given: 'B.', family: 'Scientist' }],
    issued: { 'date-parts': [[2024, 4, 1]] },
    type: 'journal-article',
    'container-title': ['Amino Acids'],
    publisher: 'Springer Nature',
    funder: [],
    update: [],
  },
  {
    DOI: '10.1097/ebp.0000000000002506',
    title: ['Duplicate deposited metadata record for the same review'],
    author: [{ given: 'Socorro', family: 'Shelton' }],
    published: { 'date-parts': [[2025, 8, 27]] },
    type: 'journal-article',
  },
];

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

function textResponse(value: string, contentType: string): Response {
  return new Response(value, { headers: { 'content-type': contentType } });
}

export const discoveryFixtureFetcher = async (input: string, init?: RequestInit): Promise<Response> => {
  const url = new URL(input);
  if (url.href === 'https://www.international.gc.ca/controls-controles/softwood-bois_oeuvre/index.aspx?lang=eng') {
    return textResponse(GAC_INDEX, 'text/html');
  }
  if (url.hostname === 'international.canada.ca' && decodeURIComponent(url.pathname).includes('administration-2025')) {
    return textResponse(GAC_ANNUAL, 'text/html');
  }
  if (url.hostname === 'www.eics-scei.gc.ca' && decodeURIComponent(url.pathname).includes('SWL monthly Exports Report_2025')) {
    const month = Number(decodeURIComponent(url.pathname).match(/Report_2025(\d{2})/)?.[1] ?? 0);
    return textResponse(`<html><body><h1>Canada-US Softwood Lumber Exports Report</h1><p>Region Exports (FBM)</p><p>Total ${GAC_MONTHLY_VALUES[month - 1]?.toLocaleString('en-CA')}</p></body></html>`, 'text/html');
  }
  if (url.href === 'https://www.international.gc.ca/controls-controles/report-rapports/list_liste/handbook-manuel/H1-Mon.aspx?lang=eng') {
    return textResponse(GAC_SCOPE, 'text/html');
  }
  if (url.href === 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorByReferencePeriodRange?vectorIds=%221066366737%22&startRefPeriod=2025-01-01&endReferencePeriod=2025-12-31') {
    return jsonResponse([{ status: 'SUCCESS', object: { vectorDataPoint: [{ vectorId: 1066366737, refPerRaw: '2025-01-01', value: 28275.8 }] } }]);
  }
  if (url.href === 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1610001801') {
    return textResponse(STATCAN_LUMBER_CONTEXT, 'text/html');
  }
  if (url.href === 'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite') {
    return jsonResponse(STATCAN_INDEX);
  }
  if (url.href === 'https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata') {
    const body = JSON.parse(String(init?.body ?? '[]')) as Array<{ productId: number }>;
    const productId = body[0]?.productId;
    const metadata = productId === 17100005
      ? {
          productId: '17100005',
          cubeTitleEn: 'Population estimates on July 1, by age and gender',
          cubeEndDate: '2025-01-01',
          issueDate: '2026-01-15',
          frequencyCode: 12,
          archiveStatusCode: '2',
          archiveStatusEn: 'CURRENT',
          dimension: [{ dimensionNameEn: 'Geography', member: [{ memberNameEn: 'Canada' }] }],
        }
      : {
          productId: String(productId),
          cubeTitleEn: 'Population estimates, quarterly',
          cubeEndDate: '2026-04-01',
          frequencyCode: 9,
          archiveStatusCode: '2',
          archiveStatusEn: 'CURRENT',
          dimension: [{ dimensionNameEn: 'Geography', member: [{ memberNameEn: 'Canada' }] }],
        };
    return jsonResponse([{ status: 'SUCCESS', object: metadata }]);
  }
  if (url.href === 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods') {
    return jsonResponse([{ status: 'SUCCESS', object: { vectorDataPoint: STATCAN_POPULATION_POINTS } }]);
  }
  if (url.href === 'https://laws-lois.justice.gc.ca/js/lookup_e.xml') return textResponse(JUSTICE_LOOKUP, 'application/xml');
  if (url.href === 'https://laws-lois.justice.gc.ca/eng/acts/C-24.5/index.html') return textResponse(JUSTICE_ACT_HTML, 'text/html');
  if (url.href === 'https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-144/index.html') return textResponse(JUSTICE_REGULATION_HTML, 'text/html');
  if (url.href === 'https://laws-lois.justice.gc.ca/eng/XML/C-24.5.xml') return textResponse(JUSTICE_ACT_EXTRACTION_XML, 'application/xml');
  if (url.href === 'https://laws-lois.justice.gc.ca/eng/XML/SOR-2018-144.xml') return textResponse(JUSTICE_REGULATION_XML, 'application/xml');
  if (url.hostname === 'api.crossref.org' && url.pathname === '/works') {
    return jsonResponse({ status: 'ok', 'message-type': 'work-list', message: { items: CROSSREF_ITEMS } });
  }
  if (url.hostname === 'api.crossref.org' && url.pathname.startsWith('/works/')) {
    const doi = decodeURIComponent(url.pathname.slice('/works/'.length));
    const item = CROSSREF_ITEMS.find((candidate) => candidate.DOI === doi);
    return jsonResponse({ status: 'ok', 'message-type': 'work', message: item ?? { DOI: doi, title: ['Unknown work'] } });
  }
  throw new Error(`fixture_not_found:${url.href}`);
};
