
import { OSRS_WIKI_API_BASE_URL } from '../constants';
import type { Item, TimeseriesData, LatestPrice, AggregatePrice } from '../types';

// The OSRS Wiki API is being called directly. The previously used CORS proxy
// was causing 403 Forbidden errors. The API is expected to have CORS properly
// configured to allow direct browser requests. While the API docs state a
// User-Agent is required, this header cannot be set from browser-side JavaScript.
// The browser's default User-Agent and Origin headers should be sufficient.

async function apiFetch<T,>(endpoint: string): Promise<T> {
  const response = await fetch(`${OSRS_WIKI_API_BASE_URL}${endpoint}`);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Fetch Error for ${endpoint}:`, response.status, errorText);
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

export const fetchItemMapping = async (): Promise<Item[]> => {
  const data = await apiFetch<Record<string, Omit<Item, 'id'>>>('/mapping');
  return Object.entries(data).map(([id, itemData]) => ({
    id: parseInt(id, 10),
    ...itemData
  }));
};

export const fetchLatestPrices = async (): Promise<Record<string, LatestPrice>> => {
  const response = await apiFetch<{data: Record<string, LatestPrice>}>('/latest');
  return response.data;
};

export const fetch1hPrices = async (): Promise<Record<string, AggregatePrice>> => {
  const response = await apiFetch<{data: Record<string, AggregatePrice>}>('/1h');
  return response.data;
};

export const fetch24hPrices = async (): Promise<Record<string, AggregatePrice>> => {
  const response = await apiFetch<{data: Record<string, AggregatePrice>}>('/24h');
  return response.data;
};

export const fetchTimeseries = async (id: number, timestep: '5m' | '1h' | '6h'): Promise<TimeseriesData[]> => {
  const response = await apiFetch<{ data: TimeseriesData[] }>(`/timeseries?timestep=${timestep}&id=${id}`);
  return response.data;
};
