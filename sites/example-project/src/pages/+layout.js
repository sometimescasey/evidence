import { browser, building } from '$app/environment';
import { initDB, setParquetURL, query } from '@evidence-dev/universal-sql/client-duckdb';
import { tableFromIPC } from 'apache-arrow';

/** @satisfies {import("./$types").LayoutLoad} */
export const load = async ({
	fetch,
	data: { customFormattingSettings, routeHash, renderedFiles, isUserPage, evidencemeta }
}) => {
	let data = {};
	// let SSR saturate the cache first
	if (!building && browser && isUserPage) {
		await Promise.all(
			evidencemeta.queries?.map(async ({ id }) => {
				const res = await fetch(`/api/${routeHash}/${id}.arrow`);
				if (res.ok) data[id] = (await tableFromIPC(res)).toArray();
			}) ?? []
		);
	}
	data.evidencemeta = evidencemeta;

	await initDB();

	for (const url of renderedFiles) {
		await setParquetURL(url.split('/').at(-1).slice(0, -'.parquet'.length), url);
	}

	return {
		__db: {
			query(sql, query_name) {
				if (browser) return query(sql);

				const query_results = query(sql, { route_hash: routeHash, query_name });

				// trigger the prerendering of the cache endpoint
				// should make sure this isn't a race condition
				fetch(`/api/${routeHash}/${query_name}.arrow`);

				return query_results;
			}
		},
		data,
		customFormattingSettings,
		isUserPage
	};
};
