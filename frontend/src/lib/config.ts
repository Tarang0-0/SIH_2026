const env = (value: string | undefined): string => value?.trim() || '';

export const frontendConfig = {
  leafletCssUrl: env(process.env.NEXT_PUBLIC_LEAFLET_CSS_URL),
  leafletScriptUrl: env(process.env.NEXT_PUBLIC_LEAFLET_SCRIPT_URL),
  mapTileUrl: env(process.env.NEXT_PUBLIC_MAP_TILE_URL),
  mapTileAttribution: env(process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION),
  railwayTileUrl: env(process.env.NEXT_PUBLIC_RAILWAY_TILE_URL),
  railwayTileAttribution: env(process.env.NEXT_PUBLIC_RAILWAY_TILE_ATTRIBUTION),
  mapSearchUrl: env(process.env.NEXT_PUBLIC_MAP_SEARCH_URL),
};
